import pytest
from fastapi.testclient import TestClient

from app.main import app


LIST_ENDPOINTS = [
    "/api/metrics/time-series",
    "/api/metrics/gc-pauses",
    "/api/metrics/cpu-usage",
    "/api/metrics/memory-usage",
    "/api/metrics/heap-spaces",
]

OBJECT_ENDPOINTS = [
    "/api/metrics/correlations",
    "/api/metrics/leak-trend",
    "/api/metrics/gc-stats",
    "/api/metrics/anomalies",
]


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as test_client:
        yield test_client


def _first_app_name(client):
    resp = client.get("/api/apps/", params={"page": 1, "limit": 1})
    assert resp.status_code == 200
    data = resp.json()
    items = data.get("items", [])
    if not items:
        pytest.skip("No apps in DB; API tests require seeded data.")
    return items[0]["app_name"]


def _configs(client, app_name):
    resp = client.get("/api/apps/configs", params={"app_name": app_name})
    assert resp.status_code == 200
    return resp.json()


def _context(client):
    app_name = _first_app_name(client)
    cfg = _configs(client, app_name)
    time_range = cfg.get("time_range") or {}
    start_ts = time_range.get("start_ts") or None
    end_ts = time_range.get("end_ts") or None
    runs = cfg.get("runs") or []
    heap_bins = cfg.get("heap_capacity_mb_bins") or []
    cpu_active = cfg.get("cpu_active") or {}
    return {
        "app_name": app_name,
        "start_ts": start_ts,
        "end_ts": end_ts,
        "run_id": runs[0] if runs else None,
        "heap_bin_mb": heap_bins[0] if heap_bins else None,
        "cpu_active_min": cpu_active.get("p50"),
    }


def _drop_none(params):
    return {k: v for k, v in params.items() if v is not None}


def _assert_paginated(data):
    assert set(["page", "per_page", "items", "has_next"]).issubset(data.keys())
    assert isinstance(data["items"], list)


def _assert_list_response(client, path, params):
    resp = client.get(path, params=_drop_none(params))
    assert resp.status_code == 200, resp.text
    _assert_paginated(resp.json())


def _assert_object_response(client, path, params, required_keys):
    resp = client.get(path, params=_drop_none(params))
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert set(required_keys).issubset(data.keys())


def _assert_array_response(client, path, params, required_keys):
    resp = client.get(path, params=_drop_none(params))
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert isinstance(data, list)
    if data:
        assert set(required_keys).issubset(data[0].keys())


def test_apps_list_happy(client):
    resp = client.get("/api/apps/")
    assert resp.status_code == 200
    _assert_paginated(resp.json())


@pytest.mark.parametrize(
    "params",
    [
        {"page": 0},
        {"limit": 0},
        {"page": "bad"},
        {"limit": "bad"},
    ],
)
def test_apps_list_invalid_params(client, params):
    resp = client.get("/api/apps/", params=params)
    assert resp.status_code == 422


def test_apps_configs_happy(client):
    app_name = _first_app_name(client)
    data = _configs(client, app_name)
    assert set(["app_name", "gc_types", "time_range", "run_status"]).issubset(data.keys())


def test_apps_configs_no_app_name(client):
    resp = client.get("/api/apps/configs")
    assert resp.status_code == 200


def test_apps_configs_unknown_app(client):
    resp = client.get("/api/apps/configs", params={"app_name": "unknown-app"})
    assert resp.status_code == 200


@pytest.mark.parametrize("path", LIST_ENDPOINTS + OBJECT_ENDPOINTS)
def test_metrics_missing_app_name(client, path):
    resp = client.get(path)
    assert resp.status_code == 422


@pytest.mark.parametrize("path", LIST_ENDPOINTS)
def test_metrics_list_invalid_pagination(client, path):
    resp = client.get(path, params={"app_name": "acorn", "page": 0})
    assert resp.status_code == 422
    resp = client.get(path, params={"app_name": "acorn", "limit": 0})
    assert resp.status_code == 422


def test_metrics_time_series_variants(client):
    ctx = _context(client)
    base = {"app_name": ctx["app_name"], "limit": 5, "page": 1}
    _assert_list_response(client, "/api/metrics/time-series", base)
    _assert_list_response(
        client,
        "/api/metrics/time-series",
        {**base, "start_ts": ctx["start_ts"], "end_ts": ctx["end_ts"]},
    )
    _assert_list_response(
        client,
        "/api/metrics/time-series",
        {
            **base,
            "run_id": ctx["run_id"],
            "failed": True,
            "crash_detected": False,
            "oom_detected": False,
            "cpu_active_min": ctx["cpu_active_min"],
        },
    )


def test_metrics_gc_pauses_variants(client):
    ctx = _context(client)
    base = {"app_name": ctx["app_name"], "limit": 5, "page": 1}
    _assert_list_response(client, "/api/metrics/gc-pauses", base)
    _assert_list_response(
        client,
        "/api/metrics/gc-pauses",
        {**base, "start_ts": ctx["start_ts"], "end_ts": ctx["end_ts"], "gc_type": "s"},
    )
    _assert_list_response(
        client,
        "/api/metrics/gc-pauses",
        {
            **base,
            "heap_bin_mb": ctx["heap_bin_mb"],
            "run_id": ctx["run_id"],
            "failed": False,
            "crash_detected": False,
            "oom_detected": False,
        },
    )


def test_metrics_cpu_usage_variants(client):
    ctx = _context(client)
    base = {"app_name": ctx["app_name"], "limit": 5, "page": 1}
    _assert_list_response(client, "/api/metrics/cpu-usage", base)
    _assert_list_response(
        client,
        "/api/metrics/cpu-usage",
        {**base, "start_ts": ctx["start_ts"], "end_ts": ctx["end_ts"], "cpu_active_min": ctx["cpu_active_min"]},
    )
    _assert_list_response(
        client,
        "/api/metrics/cpu-usage",
        {**base, "run_id": ctx["run_id"], "failed": True},
    )


def test_metrics_memory_usage_variants(client):
    ctx = _context(client)
    base = {"app_name": ctx["app_name"], "limit": 5, "page": 1}
    _assert_list_response(client, "/api/metrics/memory-usage", base)
    _assert_list_response(
        client,
        "/api/metrics/memory-usage",
        {**base, "start_ts": ctx["start_ts"], "end_ts": ctx["end_ts"]},
    )
    _assert_list_response(
        client,
        "/api/metrics/memory-usage",
        {**base, "run_id": ctx["run_id"], "failed": False},
    )


def test_metrics_heap_spaces_variants(client):
    ctx = _context(client)
    base = {"app_name": ctx["app_name"], "limit": 5, "page": 1}
    _assert_list_response(client, "/api/metrics/heap-spaces", base)
    _assert_list_response(
        client,
        "/api/metrics/heap-spaces",
        {**base, "start_ts": ctx["start_ts"], "end_ts": ctx["end_ts"], "heap_bin_mb": ctx["heap_bin_mb"]},
    )
    _assert_list_response(
        client,
        "/api/metrics/heap-spaces",
        {**base, "run_id": ctx["run_id"], "failed": True},
    )


def test_metrics_correlations_variants(client):
    ctx = _context(client)
    base = {"app_name": ctx["app_name"]}
    _assert_array_response(client, "/api/metrics/correlations", base, ["x", "y", "pearson"])
    _assert_array_response(
        client,
        "/api/metrics/correlations",
        {
            **base,
            "start_ts": ctx["start_ts"],
            "end_ts": ctx["end_ts"],
            "runs_metric": "geometric_mean_runs_per_sec",
        },
        ["x", "y", "pearson"],
    )


def test_metrics_leak_trend_variants(client):
    ctx = _context(client)
    base = {"app_name": ctx["app_name"]}
    _assert_object_response(client, "/api/metrics/leak-trend", base, ["slope_mb_per_min", "r2", "leak_suspected", "criticality"])
    _assert_object_response(
        client,
        "/api/metrics/leak-trend",
        {**base, "start_ts": ctx["start_ts"], "end_ts": ctx["end_ts"], "heap_bin_mb": ctx["heap_bin_mb"]},
        ["slope_mb_per_min", "r2", "leak_suspected", "criticality"],
    )


def test_metrics_gc_stats_variants(client):
    ctx = _context(client)
    base = {"app_name": ctx["app_name"]}
    _assert_object_response(client, "/api/metrics/gc-stats", base, ["total", "minor", "major", "pause_ms", "criticality"])
    _assert_object_response(
        client,
        "/api/metrics/gc-stats",
        {**base, "start_ts": ctx["start_ts"], "end_ts": ctx["end_ts"], "gc_type": "mc"},
        ["total", "minor", "major", "pause_ms", "criticality"],
    )


def test_metrics_anomalies_variants(client):
    ctx = _context(client)
    base = {"app_name": ctx["app_name"]}
    _assert_object_response(client, "/api/metrics/anomalies", base, ["total_rows", "messages", "criticality"])
    _assert_object_response(
        client,
        "/api/metrics/anomalies",
        {**base, "start_ts": ctx["start_ts"], "end_ts": ctx["end_ts"], "heap_bin_mb": ctx["heap_bin_mb"]},
        ["total_rows", "messages", "criticality"],
    )


@pytest.mark.parametrize(
    "path,param",
    [
        ("/api/metrics/time-series", {"failed": "notabool"}),
        ("/api/metrics/gc-pauses", {"crash_detected": "notabool"}),
        ("/api/metrics/cpu-usage", {"oom_detected": "notabool"}),
    ],
)
def test_metrics_invalid_bool(client, path, param):
    ctx = _context(client)
    resp = client.get(path, params={"app_name": ctx["app_name"], **param})
    assert resp.status_code == 422
