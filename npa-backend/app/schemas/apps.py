from typing import Optional

from pydantic import BaseModel


class AppSummary(BaseModel):
    app_name: str
    runs_count: int
    total_system_samples: int
    total_gc_events: int
    high_cpu_count: int
    high_cpu_ratio: Optional[float] = None
    low_memory_samples: int
    long_gc_minor_pauses: int
    long_gc_major_pauses: int
    high_promotion_count: int
    failed_count: int
    crash_detected_count: int
    oom_detected_count: int
