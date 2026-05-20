from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query
from app.core.constants import DEFAULT_LIMIT, DEFAULT_PAGE
from app.schemas.pagination import PaginatedResponse

from app.core.dependency import MetricsServiceDep
from app.schemas.metrics import (
    CpuUsagePoint,
    GcPauseResponse,
    HeapSpacesPoint,
    MemoryUsagePoint,
    MetricsTimeseriesPoint,
    CorrelationResult,
    LeakTrendResponse,
    GcStatsResponse,
    AnomaliesResponse,
)
 

router = APIRouter(prefix="/metrics", tags=["metrics"])

@router.get(
    "/time-series",
    response_model=PaginatedResponse[MetricsTimeseriesPoint],
    summary="Time-series: CPU, memory, throughput",
    description=(
        "Returns per-sample metrics for an app: CPU (system/idle/iowait), RSS, available/free memory, and runs/sec metrics.\n"
        "Use optional start/end timestamps (ms) or a specific run_id to scope the data."
    ),
)
async def read_metrics_timeseries(
    service: MetricsServiceDep,
    app_name: str = Query(..., description="Application name"),
    limit: int = Query(DEFAULT_LIMIT, ge=1, description="Number of samples"),
    page: int = Query(DEFAULT_PAGE, ge=1, description="Page number (1-based)"),
    start_ts: Optional[int] = Query(None, description="Start timestamp in ms"),
    end_ts: Optional[int] = Query(None, description="End timestamp in ms"),
    failed: Optional[bool] = Query(None, description="Filter rows where failed matches this value"),
    crash_detected: Optional[bool] = Query(None, description="Filter rows where crash_detected matches this value"),
    oom_detected: Optional[bool] = Query(None, description="Filter rows where oom_detected matches this value"),
    cpu_active_min: Optional[float] = Query(None, description="Minimum cpu_system threshold"),
    heap_bin_mb: Optional[int] = Query(None, description="Heap capacity bin in MB (e.g., 128)"),
    run_id: Optional[int] = Query(None, description="process_start_time identifying the run"),
):
    offset = (page - 1) * limit
    points, has_next = await service.fetch_metrics_timeseries(
        app_name=app_name,
        limit=limit,
        offset=offset,
        start_ts=start_ts,
        end_ts=end_ts,
        failed=failed,
        crash_detected=crash_detected,
        oom_detected=oom_detected,
        cpu_active_min=cpu_active_min,
        heap_bin_mb=heap_bin_mb,
        run_id=run_id,
    )
    items = [MetricsTimeseriesPoint(**point) for point in points]
    return PaginatedResponse[MetricsTimeseriesPoint](page=page, per_page=limit, items=items, has_next=has_next)


@router.get(
    "/gc-pauses",
    response_model=PaginatedResponse[GcPauseResponse],
    summary="GC pauses over time",
    description=(
        "Lists GC pause events and mutator times in the selected window. Optionally filter by GC type, failure flags, heap capacity bin, and run_id."
    ),
)
async def read_gc_pauses(
    service: MetricsServiceDep,
    app_name: str = Query(..., description="Application name"),
    start_ts: Optional[int] = Query(None, description="Start timestamp in ms"),
    end_ts: Optional[int] = Query(None, description="End timestamp in ms"),
    gc_type: Optional[str] = Query(None, description="Filter by GC type"),
    limit: int = Query(DEFAULT_LIMIT, ge=1, description="Maximum rows"),
    page: int = Query(DEFAULT_PAGE, ge=1, description="Page number (1-based)"),
    failed: Optional[bool] = Query(None, description="Filter rows where failed matches this value"),
    crash_detected: Optional[bool] = Query(None, description="Filter rows where crash_detected matches this value"),
    oom_detected: Optional[bool] = Query(None, description="Filter rows where oom_detected matches this value"),
    cpu_active_min: Optional[float] = Query(None, description="Minimum cpu_system threshold"),
    heap_bin_mb: Optional[int] = Query(None, description="Heap capacity bin in MB (e.g., 128)"),
    run_id: Optional[int] = Query(None, description="process_start_time identifying the run"),
):
    try:
        offset = (page - 1) * limit
        results, has_next = await service.fetch_gc_pauses(
            app_name=app_name,
            start_ts=start_ts,
            end_ts=end_ts,
            gc_type=gc_type,
            limit=limit,
            offset=offset,
            failed=failed,
            crash_detected=crash_detected,
            oom_detected=oom_detected,
            cpu_active_min=cpu_active_min,
            heap_bin_mb=heap_bin_mb,
            run_id=run_id,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    items = [GcPauseResponse(**r) for r in results]
    return PaginatedResponse[GcPauseResponse](page=page, per_page=limit, items=items, has_next=has_next)


@router.get(
    "/cpu-usage",
    response_model=PaginatedResponse[CpuUsagePoint],
    summary="CPU usage over time",
    description=(
        "Returns CPU usage per sample focusing on system CPU: cpu_percent uses cgroup_cpu_system_pct when available (system %), with cpu_system/idle/iowait included for context."
    ),
)
async def read_cpu_usage(
    service: MetricsServiceDep,
    app_name: str = Query(..., description="Application name"),
    limit: int = Query(DEFAULT_LIMIT, ge=1, description="Number of samples"),
    page: int = Query(DEFAULT_PAGE, ge=1, description="Page number (1-based)"),
    start_ts: Optional[int] = Query(None, description="Start timestamp in ms"),
    end_ts: Optional[int] = Query(None, description="End timestamp in ms"),
    failed: Optional[bool] = Query(None, description="Filter rows where failed matches this value"),
    crash_detected: Optional[bool] = Query(None, description="Filter rows where crash_detected matches this value"),
    oom_detected: Optional[bool] = Query(None, description="Filter rows where oom_detected matches this value"),
    cpu_active_min: Optional[float] = Query(None, description="Minimum cpu_system threshold"),
    heap_bin_mb: Optional[int] = Query(None, description="Heap capacity bin in MB (e.g., 128)"),
    run_id: Optional[int] = Query(None, description="process_start_time identifying the run"),
):
    offset = (page - 1) * limit
    points, has_next = await service.fetch_cpu_usage(
        app_name=app_name,
        limit=limit,
        offset=offset,
        start_ts=start_ts,
        end_ts=end_ts,
        failed=failed,
        crash_detected=crash_detected,
        oom_detected=oom_detected,
        cpu_active_min=cpu_active_min,
        heap_bin_mb=heap_bin_mb,
        run_id=run_id,
    )
    items = [CpuUsagePoint(**point) for point in points]
    return PaginatedResponse[CpuUsagePoint](page=page, per_page=limit, items=items, has_next=has_next)


@router.get(
    "/memory-usage",
    response_model=PaginatedResponse[MemoryUsagePoint],
    summary="Heap and RSS over time",
    description=(
        "Returns heap used/total (MB) and process RSS (MB) per sample for the selected window or run."
    ),
)
async def read_memory_usage(
    service: MetricsServiceDep,
    app_name: str = Query(..., description="Application name"),
    limit: int = Query(DEFAULT_LIMIT, ge=1, description="Number of samples"),
    page: int = Query(DEFAULT_PAGE, ge=1, description="Page number (1-based)"),
    start_ts: Optional[int] = Query(None, description="Start timestamp in ms"),
    end_ts: Optional[int] = Query(None, description="End timestamp in ms"),
    failed: Optional[bool] = Query(None, description="Filter rows where failed matches this value"),
    crash_detected: Optional[bool] = Query(None, description="Filter rows where crash_detected matches this value"),
    oom_detected: Optional[bool] = Query(None, description="Filter rows where oom_detected matches this value"),
    cpu_active_min: Optional[float] = Query(None, description="Minimum cpu_system threshold"),
    heap_bin_mb: Optional[int] = Query(None, description="Heap capacity bin in MB (e.g., 128)"),
    run_id: Optional[int] = Query(None, description="process_start_time identifying the run"),
):
    offset = (page - 1) * limit
    points, has_next = await service.fetch_memory_usage(
        app_name=app_name,
        limit=limit,
        offset=offset,
        start_ts=start_ts,
        end_ts=end_ts,
        failed=failed,
        crash_detected=crash_detected,
        oom_detected=oom_detected,
        cpu_active_min=cpu_active_min,
        heap_bin_mb=heap_bin_mb,
        run_id=run_id,
    )
    items = [MemoryUsagePoint(**point) for point in points]
    return PaginatedResponse[MemoryUsagePoint](page=page, per_page=limit, items=items, has_next=has_next)


@router.get(
    "/heap-spaces",
    response_model=PaginatedResponse[HeapSpacesPoint],
    summary="V8 heap spaces breakdown",
    description=(
        "Returns per-sample usage for V8 spaces: new, old, code, large object, etc., useful for diagnosing pressure sources."
    ),
)
async def read_heap_spaces(
    service: MetricsServiceDep,
    app_name: str = Query(..., description="Application name"),
    limit: int = Query(DEFAULT_LIMIT, ge=1, description="Number of samples"),
    page: int = Query(DEFAULT_PAGE, ge=1, description="Page number (1-based)"),
    start_ts: Optional[int] = Query(None, description="Start timestamp in ms"),
    end_ts: Optional[int] = Query(None, description="End timestamp in ms"),
    failed: Optional[bool] = Query(None, description="Filter rows where failed matches this value"),
    crash_detected: Optional[bool] = Query(None, description="Filter rows where crash_detected matches this value"),
    oom_detected: Optional[bool] = Query(None, description="Filter rows where oom_detected matches this value"),
    cpu_active_min: Optional[float] = Query(None, description="Minimum cpu_system threshold"),
    heap_bin_mb: Optional[int] = Query(None, description="Heap capacity bin in MB (e.g., 128)"),
    run_id: Optional[int] = Query(None, description="process_start_time identifying the run"),
):
    offset = (page - 1) * limit
    points, has_next = await service.fetch_heap_spaces(
        app_name=app_name,
        limit=limit,
        offset=offset,
        start_ts=start_ts,
        end_ts=end_ts,
        failed=failed,
        crash_detected=crash_detected,
        oom_detected=oom_detected,
        cpu_active_min=cpu_active_min,
        heap_bin_mb=heap_bin_mb,
        run_id=run_id,
    )
    items = [HeapSpacesPoint(**point) for point in points]
    return PaginatedResponse[HeapSpacesPoint](page=page, per_page=limit, items=items, has_next=has_next)


 

@router.get(
    "/correlations",
    response_model=List[CorrelationResult],
    summary="Correlations (GC, heap vs throughput)",
    description=(
        "Computes Pearson correlations for key pairs: pause_ms vs runs_per_sec (inverse expected),\n"
        "allocated_mb/mutator_ms vs runs_per_sec, promotion_rate vs is_major_gc, and heap config (old/semi space MiB) vs runs_per_sec."
    ),
)
async def read_correlations(
    service: MetricsServiceDep,
    app_name: str = Query(..., description="Application name"),
    start_ts: Optional[int] = Query(None, description="Start timestamp in ms"),
    end_ts: Optional[int] = Query(None, description="End timestamp in ms"),
    failed: Optional[bool] = Query(None, description="Filter rows where failed matches this value"),
    crash_detected: Optional[bool] = Query(None, description="Filter rows where crash_detected matches this value"),
    oom_detected: Optional[bool] = Query(None, description="Filter rows where oom_detected matches this value"),
    cpu_active_min: Optional[float] = Query(None, description="Minimum cpu_system threshold"),
    heap_bin_mb: Optional[int] = Query(None, description="Heap capacity bin in MB (e.g., 128)"),
    runs_metric: Optional[str] = Query(
        None,
        description="Which runs_per_sec metric to use (e.g., geometric_mean_runs_per_sec). Defaults to geometric_mean if not set.",
    ),
    run_id: Optional[int] = Query(None, description="process_start_time identifying the run"),
):
    try:
        results = await service.fetch_correlations(
            app_name=app_name,
            start_ts=start_ts,
            end_ts=end_ts,
            failed=failed,
            crash_detected=crash_detected,
            oom_detected=oom_detected,
            cpu_active_min=cpu_active_min,
            heap_bin_mb=heap_bin_mb,
            runs_metric=runs_metric,
            run_id=run_id,
        )
        return [CorrelationResult(**r) for r in results]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/leak-trend",
    response_model=LeakTrendResponse,
    summary="Heap leak trend (linear fit)",
    description=(
        "Estimates whether heap is steadily growing by fitting a line to heap-used over time.\n"
        "Returns slope (MB/min), R^2, and leak_suspected (true when internal thresholds are exceeded).\n"
        "Use failure flags or a single run_id to reduce noise."
    ),
)
async def read_leak_trend(
    service: MetricsServiceDep,
    app_name: str = Query(..., description="Application name"),
    start_ts: Optional[int] = Query(None, description="Start timestamp in ms"),
    end_ts: Optional[int] = Query(None, description="End timestamp in ms"),
    failed: Optional[bool] = Query(None, description="Filter rows where failed matches this value"),
    crash_detected: Optional[bool] = Query(None, description="Filter rows where crash_detected matches this value"),
    oom_detected: Optional[bool] = Query(None, description="Filter rows where oom_detected matches this value"),
    heap_bin_mb: Optional[int] = Query(None, description="Heap capacity bin in MB (e.g., 128)"),
    run_id: Optional[int] = Query(None, description="process_start_time identifying the run"),
):
    try:
        result = await service.fetch_leak_trend(
            app_name=app_name,
            start_ts=start_ts,
            end_ts=end_ts,
            failed=failed,
            crash_detected=crash_detected,
            oom_detected=oom_detected,
            heap_bin_mb=heap_bin_mb,
            run_id=run_id,
        )
        return LeakTrendResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/gc-stats",
    response_model=GcStatsResponse,
    summary="GC statistics (counts and pause percentiles)",
    description=(
        "Summarizes GC activity in the window: total/minor/major counts, minor_ratio (minor/total), pause latency percentiles (p50/p95/p99/avg),\n"
        "and average total GC time per sample. Use gc_type=mc to focus on major collections; high p95/p99 indicates spiky long pauses, while a low\n"
        "minor_ratio implies more major GCs that are often more disruptive."
    ),
)
async def read_gc_stats(
    service: MetricsServiceDep,
    app_name: str = Query(..., description="Application name"),
    start_ts: Optional[int] = Query(None, description="Start timestamp in ms"),
    end_ts: Optional[int] = Query(None, description="End timestamp in ms"),
    failed: Optional[bool] = Query(None, description="Filter rows where failed matches this value"),
    crash_detected: Optional[bool] = Query(None, description="Filter rows where crash_detected matches this value"),
    oom_detected: Optional[bool] = Query(None, description="Filter rows where oom_detected matches this value"),
    gc_type: Optional[str] = Query(None, description="Filter by GC type ('s' or 'mc')"),
    heap_bin_mb: Optional[int] = Query(None, description="Heap capacity bin in MB (e.g., 128)"),
    run_id: Optional[int] = Query(None, description="process_start_time identifying the run"),
):
    try:
        result = await service.fetch_gc_stats(
            app_name=app_name,
            start_ts=start_ts,
            end_ts=end_ts,
            failed=failed,
            crash_detected=crash_detected,
            oom_detected=oom_detected,
            gc_type=gc_type,
            heap_bin_mb=heap_bin_mb,
            run_id=run_id,
        )
        return GcStatsResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/anomalies",
    response_model=AnomaliesResponse,
    summary="Anomalies summary",
    description=(
        "Quick health indicators using thresholds from constants:\n"
        "- High system CPU: cgroup_cpu_system_pct ≥ 80%.\n"
        "- Long GC pauses: minor > 100ms, major > 1000ms.\n"
        "- Promotion pressure: promotion_ratio > 80%.\n"
        "- Low system memory: mem_available/total < 10%.\n"
        "- Swap usage: node_swap > 0.\n"
        "- Major ratio: 1 − minor_ratio from GC stats in the window."
    ),
)
async def read_anomalies(
    service: MetricsServiceDep,
    app_name: str = Query(..., description="Application name"),
    start_ts: Optional[int] = Query(None, description="Start timestamp in ms"),
    end_ts: Optional[int] = Query(None, description="End timestamp in ms"),
    failed: Optional[bool] = Query(None, description="Filter rows where failed matches this value"),
    crash_detected: Optional[bool] = Query(None, description="Filter rows where crash_detected matches this value"),
    oom_detected: Optional[bool] = Query(None, description="Filter rows where oom_detected matches this value"),
    heap_bin_mb: Optional[int] = Query(None, description="Heap capacity bin in MB (e.g., 128)"),
    run_id: Optional[int] = Query(None, description="process_start_time identifying the run"),
):
    try:
        result = await service.fetch_anomalies(
            app_name=app_name,
            start_ts=start_ts,
            end_ts=end_ts,
            failed=failed,
            crash_detected=crash_detected,
            oom_detected=oom_detected,
            heap_bin_mb=heap_bin_mb,
            run_id=run_id,
        )
        return AnomaliesResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
