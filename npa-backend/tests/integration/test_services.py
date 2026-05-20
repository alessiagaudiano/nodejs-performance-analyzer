import pytest
from sqlalchemy import text

from app.database import session as db_session_module
from app.services.apps_service import AppsService
from app.services.metrics_service import MetricsService

PREFERRED_APP = "acorn"
PAGE_LIMIT = 10


def _time_bounds(time_range: dict[str, int]) -> tuple[int | None, int | None]:
    start = time_range.get("start_ts") or None
    end = time_range.get("end_ts") or None
    return start, end


async def _count_rows(session, table: str, app_name: str, start_ts: int | None, end_ts: int | None) -> int:
    query = text(f"""
        SELECT COUNT(*) FROM {table}
        WHERE app_name = :app_name
          AND (CAST(:start_ts AS BIGINT) IS NULL OR CAST(extract(epoch from event_time)*1000 AS BIGINT) >= CAST(:start_ts AS BIGINT))
          AND (CAST(:end_ts AS BIGINT) IS NULL OR CAST(extract(epoch from event_time)*1000 AS BIGINT) <= CAST(:end_ts AS BIGINT))
    """)
    row = (await session.execute(query, {"app_name": app_name, "start_ts": start_ts, "end_ts": end_ts})).first()
    return row[0] if row else 0


async def _app_ctx(session):
    apps_service = AppsService(session)
    names = await apps_service.get_app_names()
    if not names:
        pytest.skip("No apps found in the real DB; cannot run service tests.")
    app_name = PREFERRED_APP if PREFERRED_APP in names else names[0]
    cfg = await apps_service.get_configs(app_name)
    time_range = cfg.get("time_range") or {"start_ts": 0, "end_ts": 0}
    if time_range.get("start_ts") == 0 and time_range.get("end_ts") == 0:
        pytest.skip(f"App {app_name} has no time range data; cannot run service tests.")
    return {"app_name": app_name, "time_range": time_range}


@pytest.mark.asyncio
async def test_apps_service_get_app_names():
    db_session_module.init_engine()
    assert db_session_module.SessionLocal is not None
    async with db_session_module.SessionLocal() as session:
        svc = AppsService(session)
        names = await svc.get_app_names()
        assert names  # should match real DB
        sql_names = await session.execute(text("SELECT DISTINCT app_name FROM system_metrics ORDER BY app_name"))
        assert names == [row[0] for row in sql_names.fetchall()]


@pytest.mark.asyncio
async def test_apps_service_get_apps():
    db_session_module.init_engine()
    assert db_session_module.SessionLocal is not None
    async with db_session_module.SessionLocal() as session:
        svc = AppsService(session)
        apps, has_next = await svc.get_apps(limit=PAGE_LIMIT, offset=0)
        total_apps_row = await session.execute(text("SELECT COUNT(DISTINCT app_name) FROM system_metrics"))
        total_apps = total_apps_row.scalar_one()
        assert isinstance(has_next, bool)
        assert len(apps) <= PAGE_LIMIT
        if apps:
            assert "app_name" in apps[0]
        assert has_next == (total_apps > PAGE_LIMIT)


@pytest.mark.asyncio
async def test_apps_service_get_configs():
    db_session_module.init_engine()
    assert db_session_module.SessionLocal is not None
    async with db_session_module.SessionLocal() as session:
        ctx = await _app_ctx(session)
        app_name = ctx["app_name"]
        svc = AppsService(session)
        cfg = await svc.get_configs(app_name)
        start_ts, end_ts = _time_bounds(cfg["time_range"])
        # Compare to raw SQL for time range and runs
        range_row = await session.execute(
            text("""
                SELECT 
                    CAST(MIN(extract(epoch from event_time)) * 1000 AS BIGINT) as start_ts,
                    CAST(MAX(extract(epoch from event_time)) * 1000 AS BIGINT) as end_ts
                FROM system_metrics
                WHERE app_name = :app_name
            """),
            {"app_name": app_name},
        )
        expected_start, expected_end = range_row.first()
        assert start_ts == (expected_start or 0)
        assert end_ts == (expected_end or 0)

        runs_rows = await session.execute(
            text("""
                SELECT DISTINCT CAST(process_start_time AS BIGINT) as run_id
                FROM system_metrics 
                WHERE app_name = :app_name 
                ORDER BY 1 DESC 
                LIMIT 100
            """),
            {"app_name": app_name},
        )
        assert cfg["runs"] == [row[0] for row in runs_rows.fetchall()]


@pytest.mark.asyncio
async def test_metrics_service_timeseries():
    db_session_module.init_engine()
    assert db_session_module.SessionLocal is not None
    async with db_session_module.SessionLocal() as session:
        ctx = await _app_ctx(session)
        app_name = ctx["app_name"]
        start_ts, end_ts = _time_bounds(ctx["time_range"])
        svc = MetricsService(session)
        points, has_next = await svc.fetch_metrics_timeseries(
            app_name=app_name,
            start_ts=start_ts,
            end_ts=end_ts,
            limit=PAGE_LIMIT,
        )
        total_rows = await _count_rows(session, "system_metrics", app_name, start_ts, end_ts)
        assert len(points) <= PAGE_LIMIT
        assert has_next == (total_rows > PAGE_LIMIT)
        if points:
            assert {"timestamp_ms", "runs_per_sec"} <= set(points[0].keys())


@pytest.mark.asyncio
async def test_metrics_service_gc_pauses():
    db_session_module.init_engine()
    assert db_session_module.SessionLocal is not None
    async with db_session_module.SessionLocal() as session:
        ctx = await _app_ctx(session)
        app_name = ctx["app_name"]
        start_ts, end_ts = _time_bounds(ctx["time_range"])
        svc = MetricsService(session)
        pauses, has_next = await svc.fetch_gc_pauses(
            app_name=app_name,
            start_ts=start_ts,
            end_ts=end_ts,
            limit=PAGE_LIMIT,
        )
        total_rows = await _count_rows(session, "gc_events", app_name, start_ts, end_ts)
        assert len(pauses) <= PAGE_LIMIT
        assert has_next == (total_rows > PAGE_LIMIT)
        if pauses:
            assert {"timestamp_ms", "pause_ms", "gc_type", "criticality"} <= set(pauses[0].keys())


@pytest.mark.asyncio
async def test_metrics_service_cpu_usage():
    db_session_module.init_engine()
    assert db_session_module.SessionLocal is not None
    async with db_session_module.SessionLocal() as session:
        ctx = await _app_ctx(session)
        app_name = ctx["app_name"]
        start_ts, end_ts = _time_bounds(ctx["time_range"])
        svc = MetricsService(session)
        points, has_next = await svc.fetch_cpu_usage(
            app_name=app_name,
            start_ts=start_ts,
            end_ts=end_ts,
            limit=PAGE_LIMIT,
        )
        total_rows = await _count_rows(session, "system_metrics", app_name, start_ts, end_ts)
        assert len(points) <= PAGE_LIMIT
        assert has_next == (total_rows > PAGE_LIMIT)
        if points:
            assert "cpu_percent" in points[0]


@pytest.mark.asyncio
async def test_metrics_service_memory_usage():
    db_session_module.init_engine()
    assert db_session_module.SessionLocal is not None
    async with db_session_module.SessionLocal() as session:
        ctx = await _app_ctx(session)
        app_name = ctx["app_name"]
        start_ts, end_ts = _time_bounds(ctx["time_range"])
        svc = MetricsService(session)
        points, has_next = await svc.fetch_memory_usage(
            app_name=app_name,
            start_ts=start_ts,
            end_ts=end_ts,
            limit=PAGE_LIMIT,
        )
        total_rows = await _count_rows(session, "system_metrics", app_name, start_ts, end_ts)
        assert len(points) <= PAGE_LIMIT
        assert has_next == (total_rows > PAGE_LIMIT)
        if points:
            assert {"heap_used_mb", "heap_total_mb"} <= set(points[0].keys())


@pytest.mark.asyncio
async def test_metrics_service_heap_spaces():
    db_session_module.init_engine()
    assert db_session_module.SessionLocal is not None
    async with db_session_module.SessionLocal() as session:
        ctx = await _app_ctx(session)
        app_name = ctx["app_name"]
        start_ts, end_ts = _time_bounds(ctx["time_range"])
        svc = MetricsService(session)
        points, has_next = await svc.fetch_heap_spaces(
            app_name=app_name,
            start_ts=start_ts,
            end_ts=end_ts,
            limit=PAGE_LIMIT,
        )
        total_rows = await _count_rows(session, "gc_events", app_name, start_ts, end_ts)
        assert len(points) <= PAGE_LIMIT
        assert has_next == (total_rows > PAGE_LIMIT)
        if points:
            assert {"old_space_mb", "new_space_mb"} <= set(points[0].keys())


@pytest.mark.asyncio
async def test_metrics_service_correlations():
    db_session_module.init_engine()
    assert db_session_module.SessionLocal is not None
    async with db_session_module.SessionLocal() as session:
        ctx = await _app_ctx(session)
        app_name = ctx["app_name"]
        start_ts, end_ts = _time_bounds(ctx["time_range"])
        svc = MetricsService(session)
        corrs = await svc.fetch_correlations(
            app_name=app_name,
            start_ts=start_ts,
            end_ts=end_ts,
            runs_metric="geometric_mean_runs_per_sec",
        )
        assert isinstance(corrs, list)
        if corrs:
            assert {"x", "y", "pearson"} <= set(corrs[0].keys())


@pytest.mark.asyncio
async def test_metrics_service_leak_trend():
    db_session_module.init_engine()
    assert db_session_module.SessionLocal is not None
    async with db_session_module.SessionLocal() as session:
        ctx = await _app_ctx(session)
        app_name = ctx["app_name"]
        start_ts, end_ts = _time_bounds(ctx["time_range"])
        svc = MetricsService(session)
        trend = await svc.fetch_leak_trend(
            app_name=app_name,
            start_ts=start_ts,
            end_ts=end_ts,
        )
        assert set(trend.keys()) >= {"slope_mb_per_min", "r2", "leak_suspected", "criticality"}


@pytest.mark.asyncio
async def test_metrics_service_gc_stats():
    db_session_module.init_engine()
    assert db_session_module.SessionLocal is not None
    async with db_session_module.SessionLocal() as session:
        ctx = await _app_ctx(session)
        app_name = ctx["app_name"]
        start_ts, end_ts = _time_bounds(ctx["time_range"])
        svc = MetricsService(session)
        stats = await svc.fetch_gc_stats(
            app_name=app_name,
            start_ts=start_ts,
            end_ts=end_ts,
        )
        assert set(stats.keys()) >= {"total", "minor", "major", "pause_ms", "criticality"}
        # Cross-check counts
        raw_counts = await session.execute(
            text("""
                SELECT COUNT(*) AS total,
                       COUNT(*) FILTER (WHERE gc_type IN ('scavenge','s')) AS minor,
                       COUNT(*) FILTER (WHERE gc_type IN ('mark-compact','mc')) AS major
                FROM gc_events
                WHERE app_name = :app_name
                  AND (CAST(:start_ts AS BIGINT) IS NULL OR CAST(extract(epoch from event_time)*1000 AS BIGINT) >= CAST(:start_ts AS BIGINT))
                  AND (CAST(:end_ts AS BIGINT) IS NULL OR CAST(extract(epoch from event_time)*1000 AS BIGINT) <= CAST(:end_ts AS BIGINT))
            """),
            {"app_name": app_name, "start_ts": start_ts, "end_ts": end_ts},
        )
        counts = raw_counts.mappings().first()
        if counts:
            assert stats["total"] == counts["total"]
            assert stats["minor"] == counts["minor"]
            assert stats["major"] == counts["major"]


@pytest.mark.asyncio
async def test_metrics_service_anomalies():
    db_session_module.init_engine()
    assert db_session_module.SessionLocal is not None
    async with db_session_module.SessionLocal() as session:
        ctx = await _app_ctx(session)
        app_name = ctx["app_name"]
        start_ts, end_ts = _time_bounds(ctx["time_range"])
        svc = MetricsService(session)
        anomalies = await svc.fetch_anomalies(
            app_name=app_name,
            start_ts=start_ts,
            end_ts=end_ts,
        )
        assert set(anomalies.keys()) >= {
            "total_rows",
            "high_cpu_ratio",
            "long_gc_pauses_count",
            "messages",
            "criticality",
        }
        sys_total = await _count_rows(session, "system_metrics", app_name, start_ts, end_ts)
        assert anomalies["total_rows"] == sys_total
