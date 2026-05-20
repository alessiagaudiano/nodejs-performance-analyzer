from typing import List, Optional

from pydantic import BaseModel


class CpuActiveSummary(BaseModel):
    min: Optional[float]
    p50: Optional[float]
    p95: Optional[float]
    max: Optional[float]


class RunStatusOptions(BaseModel):
    crash_detected: List[bool]
    failed: List[bool]
    oom_detected: List[bool]


class AppConfigsResponse(BaseModel):
    app_name: Optional[str] = None
    gc_types: List[str]
    time_range: dict
    run_status: RunStatusOptions
    heap_capacity_mb_bins: List[int]
    cpu_active: CpuActiveSummary
    runs: List[int] = []
