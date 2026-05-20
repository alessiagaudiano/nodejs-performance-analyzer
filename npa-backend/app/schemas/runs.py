from typing import List, Literal, Optional

from pydantic import BaseModel


class RunSummary(BaseModel):
    run_id: int
    app_name: str
    start_ts: int
    end_ts: int
    duration_ms: int
    old_space_mib: Optional[int] = None
    semi_space_mib: Optional[int] = None
    failed: bool = False
    failure_type: Optional[str] = None


class RunIssue(BaseModel):
    code: str
    severity: Literal["info", "warning", "critical"]
    message: str
    metric: Optional[str] = None
    value: Optional[str] = None
    reason: Optional[str] = None


class RunStats(BaseModel):
    start_ts: int
    end_ts: int
    duration_ms: int
    avg_cpu_percent: float
    heap_growth_mb: float
    heap_growth_mb_per_min: float
    max_rss_mb: float
    gc_events: int
    minor_gc_events: int
    major_gc_events: int
    gc_events_per_min: float
    gc_pause_avg_ms: float
    gc_pause_p95_ms: float
    failed: bool
    failure_type: Optional[str] = None
    failure_reason: Optional[str] = None
    oom_detected: Optional[bool] = None
    crash_detected: Optional[bool] = None
    old_space_mib: Optional[int] = None
    semi_space_mib: Optional[int] = None


class RunIssuesResponse(BaseModel):
    run_id: int
    app_name: str
    stats: RunStats
    issues: List[RunIssue]
