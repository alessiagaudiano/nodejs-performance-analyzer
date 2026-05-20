import pytest

from app.schemas.metrics import Criticality
from app.services.apps_service import AppsService
from app.services.metrics_service import MetricsService, RUN_METRIC_ALIASES


class FakeMappings:
    def __init__(self, rows):
        self._rows = list(rows)

    def __iter__(self):
        return iter(self._rows)

    def all(self):
        return list(self._rows)

    def first(self):
        return self._rows[0] if self._rows else None


class FakeResult:
    def __init__(self, rows=None, mappings=None):
        self._rows = list(rows or [])
        self._mappings = list(mappings or [])

    def all(self):
        return list(self._rows)

    def first(self):
        return self._rows[0] if self._rows else None

    def mappings(self):
        return FakeMappings(self._mappings)


class FakeSession:
    def __init__(self, results):
        self._results = list(results)
        self.calls = []

    async def execute(self, query, params=None):
        self.calls.append({"query": str(query), "params": params})
        if not self._results:
            raise AssertionError("No fake results left for execute")
        return self._results.pop(0)


def _run_metrics(value):
    return {alias: value for alias in RUN_METRIC_ALIASES.values()}


@pytest.mark.asyncio
async def test_apps_service_get_app_names():
    session = FakeSession([FakeResult(rows=[("acorn",), ("babel",)])])
    svc = AppsService(session)
    names = await svc.get_app_names()
    assert names == ["acorn", "babel"]


@pytest.mark.asyncio
async def test_apps_service_get_apps():
    rows = [
        {
            "app_name": "acorn",
            "runs_count": 2,
            "total_system_samples": 10,
            "total_gc_events": 5,
            "high_cpu_count": None,
            "high_cpu_ratio": None,
            "low_memory_samples": None,
            "long_gc_minor_pauses": None,
            "long_gc_major_pauses": None,
            "high_promotion_count": None,
            "failed_count": None,
            "crash_detected_count": None,
            "oom_detected_count": None,
        },
        {
            "app_name": "babel",
            "runs_count": 1,
            "total_system_samples": 8,
            "total_gc_events": 3,
            "high_cpu_count": 2,
            "high_cpu_ratio": 0.25,
            "low_memory_samples": 0,
            "long_gc_minor_pauses": 0,
            "long_gc_major_pauses": 0,
            "high_promotion_count": 0,
            "failed_count": 0,
            "crash_detected_count": 0,
            "oom_detected_count": 0,
        },
    ]
    session = FakeSession([FakeResult(mappings=rows)])
    svc = AppsService(session)

    apps, has_next = await svc.get_apps(limit=1, offset=0)

    assert has_next is True
    assert len(apps) == 1
    assert apps[0]["app_name"] == "acorn"
    assert apps[0]["high_cpu_count"] == 0
    assert apps[0]["high_cpu_ratio"] is None


@pytest.mark.asyncio
async def test_apps_service_get_configs():
    session = FakeSession(
        [
            FakeResult(rows=[(1000, 2000)]),
            FakeResult(rows=[(128,), (256,), (None,)]),
            FakeResult(rows=[(111,), (222,)]),
            FakeResult(mappings=[{"min_cpu": 1.0, "p50": 2.0, "p95": 3.0, "max_cpu": 4.0}]),
            FakeResult(rows=[("s",), ("mc",)]),
        ]
    )
    svc = AppsService(session)

    cfg = await svc.get_configs("acorn")

    assert cfg["app_name"] == "acorn"
    assert cfg["time_range"] == {"start_ts": 1000, "end_ts": 2000}
    assert cfg["heap_capacity_mb_bins"] == [128, 256]
    assert cfg["runs"] == [111, 222]
    assert cfg["cpu_active"]["p95"] == 3.0
    assert cfg["gc_types"] == ["s", "mc"]


@pytest.mark.asyncio
async def test_metrics_service_timeseries():
    rows = [
        {
            "timestamp_ms": 1000,
            "node_rss_mb": 10.0,
            "mem_available_mb": 20.0,
            "mem_free_mb": 30.0,
            "cpu_system": 1.0,
            "cpu_idle": 2.0,
            "cpu_iowait": 3.0,
            **_run_metrics(1.0),
        },
        {
            "timestamp_ms": 2000,
            "node_rss_mb": 11.0,
            "mem_available_mb": 21.0,
            "mem_free_mb": 31.0,
            "cpu_system": 1.1,
            "cpu_idle": 2.1,
            "cpu_iowait": 3.1,
            **_run_metrics(1.5),
        },
    ]
    session = FakeSession([FakeResult(mappings=rows)])
    svc = MetricsService(session)

    points, has_next = await svc.fetch_metrics_timeseries("acorn", limit=1, offset=0)

    assert has_next is True
    assert len(points) == 1
    assert points[0]["runs_per_sec"]["geometric_mean_runs_per_sec"] == 1.0


@pytest.mark.asyncio
async def test_metrics_service_gc_pauses():
    rows = [
        {
            "timestamp_ms": 1000,
            "pause_ms": 2000.0,
            "mutator_ms": 10.0,
            "verbose_total_gc_time_ms": 20.0,
            "gc_type": "mc",
        },
        {
            "timestamp_ms": 2000,
            "pause_ms": 10.0,
            "mutator_ms": 5.0,
            "verbose_total_gc_time_ms": 6.0,
            "gc_type": "s",
        },
    ]
    session = FakeSession([FakeResult(mappings=rows)])
    svc = MetricsService(session)

    pauses, has_next = await svc.fetch_gc_pauses("acorn", start_ts=None, end_ts=None, limit=1, offset=0)

    assert has_next is True
    assert pauses[0]["criticality"] == Criticality.critical
    assert pauses[0]["gc_type"] == "mc"


@pytest.mark.asyncio
async def test_metrics_service_cpu_usage():
    rows = [
        {
            "timestamp_ms": 1000,
            "cgroup_cpu_system_pct": 75.0,
            "cpu_user": 10.0,
            "cpu_system": 20.0,
            "cpu_idle": 70.0,
            "cpu_iowait": 0.0,
        }
    ]
    session = FakeSession([FakeResult(mappings=rows)])
    svc = MetricsService(session)

    points, has_next = await svc.fetch_cpu_usage("acorn", limit=1, offset=0)

    assert has_next is False
    assert points[0]["cpu_percent"] == 75.0
    assert points[0]["criticality"] == Criticality.ok


@pytest.mark.asyncio
async def test_metrics_service_memory_usage():
    rows = [{"timestamp_ms": 1000, "node_rss_mb": 100.0, "node_rss_anon_mb": 40.0}]
    session = FakeSession([FakeResult(mappings=rows)])
    svc = MetricsService(session)

    points, has_next = await svc.fetch_memory_usage("acorn", limit=1, offset=0)

    assert has_next is False
    assert points[0]["heap_used_mb"] == 40.0
    assert points[0]["heap_total_mb"] == 100.0
    assert points[0]["rss_mb"] == 100.0


@pytest.mark.asyncio
async def test_metrics_service_heap_spaces():
    rows = [
        {
            "timestamp_ms": 1000,
            "verbose_new_space_used_mb": 1.0,
            "verbose_old_space_used_mb": 2.0,
            "verbose_code_space_used_mb": 3.0,
            "verbose_large_object_space_used_mb": 4.0,
            "verbose_code_large_object_space_used_mb": 5.0,
            "verbose_new_large_object_space_used_mb": 6.0,
        }
    ]
    session = FakeSession([FakeResult(mappings=rows)])
    svc = MetricsService(session)

    points, has_next = await svc.fetch_heap_spaces("acorn", limit=1, offset=0)

    assert has_next is False
    assert points[0]["new_space_mb"] == 1.0
    assert points[0]["old_space_mb"] == 2.0
    assert points[0]["code_space_mb"] == 3.0


@pytest.mark.asyncio
async def test_metrics_service_correlations():
    row = {
        "corr_pause_vs_run": 0.1,
        "corr_alloc_vs_run": 0.2,
        "corr_promo_vs_major": 0.3,
        "corr_old_space_vs_run": 0.4,
        "corr_semi_space_vs_run": 0.5,
    }
    session = FakeSession([FakeResult(mappings=[row])])
    svc = MetricsService(session)

    corrs = await svc.fetch_correlations("acorn", start_ts=None, end_ts=None, runs_metric="geometric_mean_runs_per_sec")

    assert len(corrs) == 5
    assert corrs[0] == {"x": "pause_ms", "y": "geometric_mean_runs_per_sec", "pearson": 0.1}


@pytest.mark.asyncio
async def test_metrics_service_leak_trend():
    row = {"slope_mb_per_ms": 0.00001, "r2": 0.1}
    session = FakeSession([FakeResult(mappings=[row])])
    svc = MetricsService(session)

    trend = await svc.fetch_leak_trend("acorn", start_ts=None, end_ts=None)

    assert trend["slope_mb_per_min"] == 0.6
    assert trend["leak_suspected"] is False
    assert trend["criticality"] == Criticality.ok


@pytest.mark.asyncio
async def test_metrics_service_gc_stats():
    session = FakeSession(
        [
            FakeResult(mappings=[{"total": 10, "minor": 8, "major": 2}]),
            FakeResult(mappings=[{"p50": 1.0, "p95": 2.0, "p99": 3.0, "avg": 4.0, "avg_total_gc": 5.0}]),
        ]
    )
    svc = MetricsService(session)

    stats = await svc.fetch_gc_stats("acorn", start_ts=None, end_ts=None)

    assert stats["total"] == 10
    assert stats["minor_ratio"] == 0.8
    assert stats["pause_ms"]["p95"] == 2.0
    assert stats["avg_total_gc_time_ms"] == 5.0
    assert stats["criticality"] == Criticality.ok


@pytest.mark.asyncio
async def test_metrics_service_anomalies():
    session = FakeSession(
        [
            FakeResult(
                mappings=[
                    {
                        "total_rows": 10,
                        "swap_usage_count": 0,
                        "avg_mem_availability": 0.5,
                        "high_cpu_count": 2,
                        "low_memory_samples": 0,
                    }
                ]
            ),
            FakeResult(
                mappings=[
                    {
                        "total_gc": 5,
                        "minor_count": 4,
                        "major_count": 1,
                        "bad_minor_pauses": 1,
                        "bad_major_pauses": 2,
                        "high_promotion_count": 0,
                    }
                ]
            ),
            FakeResult(mappings=[{"delta_mb": 5.0}]),
        ]
    )
    svc = MetricsService(session)

    anomalies = await svc.fetch_anomalies("acorn", start_ts=None, end_ts=None)

    assert anomalies["high_cpu_ratio"] == 0.2
    assert anomalies["long_gc_pauses_count"] == 3
    assert anomalies["old_space_trend_positive"] is True
    assert anomalies["messages"][0] == "Analyzed 10 system samples and 5 GC events."
    assert anomalies["criticality"] in {Criticality.warning, Criticality.critical, Criticality.ok}
