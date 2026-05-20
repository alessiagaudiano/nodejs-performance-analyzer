from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.constants import ANOMALY_THRESHOLDS, GC_TYPES, DEFAULT_LIMIT

class AppsService:
    def __init__(self, client: AsyncSession):
        self.client = client

    async def get_app_names(self) -> List[str]:
        """Return distinct application names from system_metrics."""
        query = text("SELECT DISTINCT app_name FROM system_metrics ORDER BY app_name")
        result = await self.client.execute(query)
        return [row[0] for row in result.all()]

    async def get_apps(self, *, limit: int = DEFAULT_LIMIT, offset: int = 0) -> Tuple[List[Dict[str, Any]], bool]:
        """Return application names with lightweight health/usage metadata."""
        query = text("""
            WITH sys AS (
                SELECT
                    app_name,
                    COUNT(*) AS total_samples,
                    COUNT(DISTINCT CASE WHEN process_start_time IS NOT NULL THEN process_start_time END) AS runs_count,
                    COUNT(*) FILTER (
                        WHERE cgroup_cpu_system_pct IS NOT NULL AND cgroup_cpu_system_pct >= CAST(:high_cpu_percent AS FLOAT)
                    ) AS high_cpu_count,
                    COUNT(*) FILTER (
                        WHERE (mem_available_mb / NULLIF(mem_total_mb, 0)) < CAST(:low_mem_ratio AS FLOAT)
                    ) AS low_memory_samples,
                    COUNT(*) FILTER (WHERE failed IS TRUE) AS failed_count,
                    COUNT(*) FILTER (WHERE crash_detected IS TRUE) AS crash_detected_count,
                    COUNT(*) FILTER (WHERE oom_detected IS TRUE) AS oom_detected_count
                FROM system_metrics
                GROUP BY app_name
            ),
            gc AS (
                SELECT
                    app_name,
                    COUNT(*) AS total_gc_events,
                    COUNT(*) FILTER (
                        WHERE gc_type IN ('s', 'scavenge') AND pause_ms > CAST(:pause_minor_ms AS FLOAT)
                    ) AS long_gc_minor_pauses,
                    COUNT(*) FILTER (
                        WHERE gc_type IN ('mc', 'mark-compact') AND pause_ms > CAST(:pause_major_ms AS FLOAT)
                    ) AS long_gc_major_pauses,
                    COUNT(*) FILTER (WHERE promotion_ratio > CAST(:promotion_ratio AS FLOAT)) AS high_promotion_count
                FROM gc_events
                GROUP BY app_name
            )
            SELECT
                COALESCE(sys.app_name, gc.app_name) AS app_name,
                COALESCE(sys.total_samples, 0) AS total_system_samples,
                COALESCE(sys.runs_count, 0) AS runs_count,
                COALESCE(gc.total_gc_events, 0) AS total_gc_events,
                COALESCE(sys.high_cpu_count, 0) AS high_cpu_count,
                CASE 
                    WHEN sys.total_samples IS NOT NULL AND sys.total_samples > 0 THEN ROUND(COALESCE(sys.high_cpu_count, 0)::numeric / sys.total_samples, 4)
                    ELSE NULL
                END AS high_cpu_ratio,
                COALESCE(sys.low_memory_samples, 0) AS low_memory_samples,
                COALESCE(gc.long_gc_minor_pauses, 0) AS long_gc_minor_pauses,
                COALESCE(gc.long_gc_major_pauses, 0) AS long_gc_major_pauses,
                COALESCE(gc.high_promotion_count, 0) AS high_promotion_count,
                COALESCE(sys.failed_count, 0) AS failed_count,
                COALESCE(sys.crash_detected_count, 0) AS crash_detected_count,
                COALESCE(sys.oom_detected_count, 0) AS oom_detected_count
            FROM sys
            FULL OUTER JOIN gc ON gc.app_name = sys.app_name
            ORDER BY 1
            LIMIT CAST(:limit AS INTEGER)
            OFFSET CAST(:offset AS INTEGER)
        """)

        limit_plus_one = limit + 1
        params = {
            "high_cpu_percent": ANOMALY_THRESHOLDS.get("high_cpu_percent", 80.0),
            "low_mem_ratio": ANOMALY_THRESHOLDS.get("low_memory_ratio", 0.10),
            "pause_minor_ms": ANOMALY_THRESHOLDS.get("pause_minor_ms", 100.0),
            "pause_major_ms": ANOMALY_THRESHOLDS.get("pause_major_ms", 1000.0),
            "promotion_ratio": ANOMALY_THRESHOLDS.get("promotion_ratio", 80.0),
            "limit": limit_plus_one,
            "offset": offset,
        }

        result = await self.client.execute(query, params)
        rows = result.mappings().all()
        has_next = len(rows) > limit
        rows = rows[:limit]
        apps: List[Dict[str, Any]] = []
        for row in rows:
            apps.append({
                "app_name": row["app_name"],
                "runs_count": self._safe_int(row.get("runs_count")),
                "total_system_samples": self._safe_int(row.get("total_system_samples")),
                "total_gc_events": self._safe_int(row.get("total_gc_events")),
                "high_cpu_count": self._safe_int(row.get("high_cpu_count")),
                "high_cpu_ratio": self._nullable_float(row.get("high_cpu_ratio")),
                "low_memory_samples": self._safe_int(row.get("low_memory_samples")),
                "long_gc_minor_pauses": self._safe_int(row.get("long_gc_minor_pauses")),
                "long_gc_major_pauses": self._safe_int(row.get("long_gc_major_pauses")),
                "high_promotion_count": self._safe_int(row.get("high_promotion_count")),
                "failed_count": self._safe_int(row.get("failed_count")),
                "crash_detected_count": self._safe_int(row.get("crash_detected_count")),
                "oom_detected_count": self._safe_int(row.get("oom_detected_count")),
            })
        return apps, has_next

    async def get_configs(self, app_name: str | None = None) -> Dict[str, Any]:
        """Fetch configuration metadata for filters (heap, CPU, runs, GC types)."""
        # Default to the first app when none is provided
        if not app_name:
            apps = await self.get_app_names()
            if apps:
                app_name = apps[0]
            else:
                return self._empty_configs()

        params = {"app_name": app_name}

        # Time range from system_metrics (1 Hz sampling gives best bounds)
        range_q = text("""
            SELECT 
                CAST(MIN(extract(epoch from event_time)) * 1000 AS BIGINT) as start_ts,
                CAST(MAX(extract(epoch from event_time)) * 1000 AS BIGINT) as end_ts
            FROM system_metrics
            WHERE app_name = :app_name
        """)
        range_row = (await self.client.execute(range_q, params)).first()

        # Heap capacity bins
        heap_q = text("""
            SELECT DISTINCT old_space_mib 
            FROM gc_events 
            WHERE app_name = :app_name 
            ORDER BY old_space_mib
        """)
        heap_rows = (await self.client.execute(heap_q, params)).all()
        heap_bins = [row[0] for row in heap_rows if row[0] is not None]

        # Recent run IDs (process_start_time)
        runs_q = text("""
            SELECT DISTINCT CAST(process_start_time AS BIGINT) as run_id
            FROM system_metrics 
            WHERE app_name = :app_name 
            ORDER BY 1 DESC 
            LIMIT 100
        """)
        runs_rows = (await self.client.execute(runs_q, params)).all()
        runs = [row[0] for row in runs_rows]

        # CPU system percentiles for a useful slider range
        cpu_q = text("""
            SELECT 
                MIN(cpu_system) as min_cpu,
                PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cpu_system) as p50,
                PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY cpu_system) as p95,
                MAX(cpu_system) as max_cpu
            FROM system_metrics
            WHERE app_name = :app_name
        """)
        cpu_row = (await self.client.execute(cpu_q, params)).mappings().first()

        # GC types present in the data (e.g., 's', 'mc')
        gc_type_q = text("SELECT DISTINCT gc_type FROM gc_events WHERE app_name = :app_name")
        gc_type_rows = (await self.client.execute(gc_type_q, params)).all()
        found_gc_types = [r[0] for r in gc_type_rows if r[0]]

        return {
            "app_name": app_name,
            "gc_types": found_gc_types if found_gc_types else GC_TYPES,
            "time_range": {
                "start_ts": range_row[0] if range_row and range_row[0] else 0,
                "end_ts": range_row[1] if range_row and range_row[1] else 0
            },
            # Run status filters
            "run_status": {
                "crash_detected": [False, True],
                "failed": [False, True],
                "oom_detected": [False, True],
            },
            "heap_capacity_mb_bins": heap_bins,
            "cpu_active": {
                "min": self._safe_float(cpu_row["min_cpu"]) if cpu_row else 0.0,
                "p50": self._safe_float(cpu_row["p50"]) if cpu_row else 0.0,
                "p95": self._safe_float(cpu_row["p95"]) if cpu_row else 0.0,
                "max": self._safe_float(cpu_row["max_cpu"]) if cpu_row else 0.0,
            },
            "runs": runs,
        }

    def _empty_configs(self) -> Dict[str, Any]:
        return {
            "app_name": None,
            "gc_types": GC_TYPES,
            "time_range": {"start_ts": 0, "end_ts": 0},
            "run_status": {"crash_detected": [], "failed": [], "oom_detected": []},
            "heap_capacity_mb_bins": [],
            "cpu_active": {"min": 0, "p50": 0, "p95": 0, "max": 0},
            "runs": [],
        }

    def _safe_float(self, value: Any) -> float:
        if value is None:
            return 0.0
        return float(value)

    def _nullable_float(self, value: Any) -> Optional[float]:
        if value is None:
            return None
        return float(value)

    def _safe_int(self, value: Any) -> int:
        if value is None:
            return 0
        return int(value)
