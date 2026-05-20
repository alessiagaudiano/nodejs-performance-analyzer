import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as test_client:
        yield test_client


def _get_apps(client, limit=5, page=1):
    resp = client.get("/api/apps/", params={"limit": limit, "page": page})
    assert resp.status_code == 200
    data = resp.json()
    return data.get("items", []), data.get("has_next", False)


def _get_context(client):
    items, _ = _get_apps(client, limit=5)
    if not items:
        pytest.skip("No apps in DB; flow tests require seeded data.")
    app_name = items[0]["app_name"]
    resp = client.get("/api/apps/configs", params={"app_name": app_name})
    assert resp.status_code == 200
    cfg = resp.json()
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


def _assert_paginated(resp):
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert set(["page", "per_page", "items", "has_next"]).issubset(data.keys())
    assert isinstance(data["items"], list)
    return data


def _assert_object(resp, required_keys):
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert set(required_keys).issubset(data.keys())


def _drop_none(params):
    return {k: v for k, v in params.items() if v is not None}


def _assert_has_next_consistency(client, path, params):
    small = _assert_paginated(client.get(path, params={**params, "limit": 1, "page": 1}))
    large = _assert_paginated(client.get(path, params={**params, "limit": 100, "page": 1}))
    if not large["items"]:
        pytest.skip(f"No data for {path}; cannot verify has_next.")
    assert small["has_next"] == (len(large["items"]) > 1)


def test_api_flow_basic(client):
    ctx = _get_context(client)

    items, _ = _get_apps(client)
    assert items
    cfg_resp = client.get("/api/apps/configs", params={"app_name": ctx["app_name"]})
    assert cfg_resp.status_code == 200

    list_params = {"app_name": ctx["app_name"], "limit": 5, "page": 1}
    _assert_paginated(client.get("/api/metrics/time-series", params=list_params))
    _assert_paginated(client.get("/api/metrics/gc-pauses", params=list_params))
    _assert_paginated(client.get("/api/metrics/cpu-usage", params=list_params))
    _assert_paginated(client.get("/api/metrics/memory-usage", params=list_params))
    _assert_paginated(client.get("/api/metrics/heap-spaces", params=list_params))

    _assert_object(client.get("/api/metrics/leak-trend", params={"app_name": ctx["app_name"]}),
                   ["slope_mb_per_min", "r2", "leak_suspected", "criticality"])
    _assert_object(client.get("/api/metrics/gc-stats", params={"app_name": ctx["app_name"]}),
                   ["total", "minor", "major", "pause_ms", "criticality"])
    _assert_object(client.get("/api/metrics/anomalies", params={"app_name": ctx["app_name"]}),
                   ["total_rows", "messages", "criticality"])

    corr_resp = client.get("/api/metrics/correlations", params={"app_name": ctx["app_name"]})
    assert corr_resp.status_code == 200
    assert isinstance(corr_resp.json(), list)


def test_api_flow_filters_with_time_range_and_flags(client):
    ctx = _get_context(client)
    params = _drop_none({
        "app_name": ctx["app_name"],
        "start_ts": ctx["start_ts"],
        "end_ts": ctx["end_ts"],
        "failed": False,
        "crash_detected": False,
        "oom_detected": False,
        "cpu_active_min": ctx["cpu_active_min"],
        "limit": 5,
        "page": 1,
    })
    _assert_paginated(client.get("/api/metrics/time-series", params=params))
    _assert_paginated(client.get("/api/metrics/gc-pauses", params=params))
    _assert_paginated(client.get("/api/metrics/cpu-usage", params=params))
    _assert_paginated(client.get("/api/metrics/memory-usage", params=params))


def test_api_flow_filters_with_heap_bin_and_run_id(client):
    ctx = _get_context(client)
    if ctx["run_id"] is None and ctx["heap_bin_mb"] is None:
        pytest.skip("No run_id or heap_bin_mb available for filter flow.")

    params = _drop_none({
        "app_name": ctx["app_name"],
        "run_id": ctx["run_id"],
        "heap_bin_mb": ctx["heap_bin_mb"],
        "limit": 5,
        "page": 1,
    })
    _assert_paginated(client.get("/api/metrics/gc-pauses", params=params))
    _assert_paginated(client.get("/api/metrics/heap-spaces", params=params))
    _assert_object(client.get("/api/metrics/leak-trend", params=params),
                   ["slope_mb_per_min", "r2", "leak_suspected", "criticality"])
    _assert_object(client.get("/api/metrics/anomalies", params=params),
                   ["total_rows", "messages", "criticality"])


def test_api_flow_has_next_consistency(client):
    items_small, has_next_small = _get_apps(client, limit=1)
    items_full, _ = _get_apps(client, limit=100)
    if len(items_full) > 1:
        assert has_next_small is True
    else:
        assert has_next_small is False

    ctx = _get_context(client)
    base = {"app_name": ctx["app_name"]}
    _assert_has_next_consistency(client, "/api/metrics/time-series", base)
    _assert_has_next_consistency(client, "/api/metrics/gc-pauses", base)
    _assert_has_next_consistency(client, "/api/metrics/cpu-usage", base)
    _assert_has_next_consistency(client, "/api/metrics/memory-usage", base)
    _assert_has_next_consistency(client, "/api/metrics/heap-spaces", base)


def test_api_flow_filters_with_run_id_only(client):
    ctx = _get_context(client)
    if ctx["run_id"] is None:
        pytest.skip("No run_id available for run-scoped flow.")
    params = {"app_name": ctx["app_name"], "run_id": ctx["run_id"], "limit": 5, "page": 1}
    _assert_paginated(client.get("/api/metrics/time-series", params=params))
    _assert_paginated(client.get("/api/metrics/cpu-usage", params=params))
    _assert_paginated(client.get("/api/metrics/memory-usage", params=params))
    _assert_paginated(client.get("/api/metrics/gc-pauses", params=params))
    _assert_paginated(client.get("/api/metrics/heap-spaces", params=params))


def test_api_flow_filters_with_heap_bin_only(client):
    ctx = _get_context(client)
    if ctx["heap_bin_mb"] is None:
        pytest.skip("No heap_bin_mb available for heap-bin flow.")
    params = {"app_name": ctx["app_name"], "heap_bin_mb": ctx["heap_bin_mb"], "limit": 5, "page": 1}
    _assert_paginated(client.get("/api/metrics/gc-pauses", params=params))
    _assert_paginated(client.get("/api/metrics/heap-spaces", params=params))
    _assert_object(client.get("/api/metrics/leak-trend", params=params),
                   ["slope_mb_per_min", "r2", "leak_suspected", "criticality"])
    _assert_object(client.get("/api/metrics/anomalies", params=params),
                   ["total_rows", "messages", "criticality"])


def test_api_flow_correlations_with_filters(client):
    ctx = _get_context(client)
    params = _drop_none({
        "app_name": ctx["app_name"],
        "start_ts": ctx["start_ts"],
        "end_ts": ctx["end_ts"],
        "heap_bin_mb": ctx["heap_bin_mb"],
        "run_id": ctx["run_id"],
        "failed": False,
        "crash_detected": False,
        "oom_detected": False,
        "runs_metric": "geometric_mean_runs_per_sec",
    })
    resp = client.get("/api/metrics/correlations", params=params)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_api_flow_gc_stats_and_anomalies_with_filters(client):
    ctx = _get_context(client)
    params = _drop_none({
        "app_name": ctx["app_name"],
        "start_ts": ctx["start_ts"],
        "end_ts": ctx["end_ts"],
        "heap_bin_mb": ctx["heap_bin_mb"],
        "failed": False,
        "crash_detected": False,
        "oom_detected": False,
        "gc_type": "mc",
    })
    _assert_object(client.get("/api/metrics/gc-stats", params=params),
                   ["total", "minor", "major", "pause_ms", "criticality"])
    _assert_object(client.get("/api/metrics/anomalies", params=params),
                   ["total_rows", "messages", "criticality"])
