from typing import Optional, List
from enum import Enum

from pydantic import BaseModel


class Criticality(str, Enum):
    ok = "ok"
    warning = "warning"
    critical = "critical"


class RunsPerSecondMetrics(BaseModel):
    terser_runs_per_sec: Optional[float] = None
    geometric_mean_runs_per_sec: Optional[float] = None
    lebab_runs_per_sec: Optional[float] = None
    chai_runs_per_sec: Optional[float] = None
    jshint_runs_per_sec: Optional[float] = None
    esprima_runs_per_sec: Optional[float] = None
    espree_runs_per_sec: Optional[float] = None
    uglify_js_runs_per_sec: Optional[float] = None
    prepack_runs_per_sec: Optional[float] = None
    babel_runs_per_sec: Optional[float] = None
    coffeescript_runs_per_sec: Optional[float] = None
    acorn_runs_per_sec: Optional[float] = None
    typescript_runs_per_sec: Optional[float] = None
    prettier_runs_per_sec: Optional[float] = None
    babel_minify_runs_per_sec: Optional[float] = None
    babylon_runs_per_sec: Optional[float] = None
    buble_runs_per_sec: Optional[float] = None
    source_map_runs_per_sec: Optional[float] = None
    postcss_runs_per_sec: Optional[float] = None


class MetricsTimeseriesPoint(BaseModel):
    timestamp_ms: int
    node_rss_mb: float
    mem_available_mb: float
    mem_free_mb: float
    cpu_system: float
    cpu_idle: float
    cpu_iowait: float
    runs_per_sec: RunsPerSecondMetrics


class CpuUsagePoint(BaseModel):
    timestamp_ms: int
    cpu_percent: float
    cpu_system: float
    cpu_idle: float
    cpu_iowait: float
    criticality: Optional[Criticality] = None


class MemoryUsagePoint(BaseModel):
    timestamp_ms: int
    heap_used_mb: float
    heap_total_mb: float
    rss_mb: float


class HeapSpacesPoint(BaseModel):
    timestamp_ms: int
    new_space_mb: float
    old_space_mb: float
    code_space_mb: float
    large_object_space_mb: float
    code_large_object_space_mb: float
    new_large_object_space_mb: float


class GcPauseResponse(BaseModel):
    timestamp_ms: int
    pause_ms: float
    mutator_ms: float
    gc_type: str
    total_gc_time_ms: float
    criticality: Optional[Criticality] = None


 


class CorrelationResult(BaseModel):
    x: str
    y: str
    pearson: Optional[float]


class LeakTrendResponse(BaseModel):
    slope_mb_per_min: float
    r2: float
    leak_suspected: bool
    criticality: Criticality


class GcPauseStats(BaseModel):
    p50: Optional[float]
    p95: Optional[float]
    p99: Optional[float]
    avg: Optional[float]


class GcStatsResponse(BaseModel):
    total: int
    minor: int
    major: int
    minor_ratio: float
    pause_ms: GcPauseStats
    avg_total_gc_time_ms: Optional[float]
    criticality: Criticality


class AnomaliesResponse(BaseModel):
    total_rows: int
    high_cpu_count: int
    high_cpu_ratio: Optional[float] = None
    long_gc_pauses_count: int
    bad_minor_pauses: Optional[int] = 0
    bad_major_pauses: Optional[int] = 0
    high_promotion_count: Optional[int] = 0
    low_memory_samples: Optional[int] = 0
    swap_usage_count: Optional[int] = 0
    major_ratio: float
    overhead_slope_mb_per_min: float
    overhead_trend_positive: bool
    old_space_delta_mb: Optional[float] = 0.0
    old_space_trend_positive: Optional[bool] = False
    messages: Optional[List[str]] = None
    criticality: Criticality


 
