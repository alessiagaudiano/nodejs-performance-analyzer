from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.types import Boolean, Float, Integer, String
from app.core.constants import DEFAULT_LIMIT, ANOMALY_THRESHOLDS, CRITICALITY_THRESHOLDS
from app.schemas.metrics import Criticality


RUN_METRIC_ALIASES = {
    "terser_runs_per_sec": "terser_runs_per_sec",
    "geometric_mean_runs_per_sec": "geometric_mean_runs_per_sec",
    "lebab_runs_per_sec": "lebab_runs_per_sec",
    "chai_runs_per_sec": "chai_runs_per_sec",
    "jshint_runs_per_sec": "jshint_runs_per_sec",
    "esprima_runs_per_sec": "esprima_runs_per_sec",
    "espree_runs_per_sec": "espree_runs_per_sec",
    "uglify-js_runs_per_sec": "uglify_js_runs_per_sec",
    "prepack_runs_per_sec": "prepack_runs_per_sec",
    "babel_runs_per_sec": "babel_runs_per_sec",
    "coffeescript_runs_per_sec": "coffeescript_runs_per_sec",
    "acorn_runs_per_sec": "acorn_runs_per_sec",
    "typescript_runs_per_sec": "typescript_runs_per_sec",
    "prettier_runs_per_sec": "prettier_runs_per_sec",
    "babel-minify_runs_per_sec": "babel_minify_runs_per_sec",
    "babylon_runs_per_sec": "babylon_runs_per_sec",
    "buble_runs_per_sec": "buble_runs_per_sec",
    "source-map_runs_per_sec": "source_map_runs_per_sec",
    "postcss_runs_per_sec": "postcss_runs_per_sec",
}

class MetricsService:
    def __init__(self, client: AsyncSession):
        self.client = client

    # Common query parameter mapping
    def _common_params(
        self,
        *,
        app_name: str,
        start_ts: Optional[int] = None,
        end_ts: Optional[int] = None,
        failed: Optional[bool] = None,
        crash_detected: Optional[bool] = None,
        oom_detected: Optional[bool] = None,
        cpu_active_min: Optional[float] = None,
        heap_bin_mb: Optional[int] = None,
        run_id: Optional[int] = None,
        gc_type: Optional[str] = None,
        limit: int = DEFAULT_LIMIT,
        offset: int = 0,
    ) -> Dict[str, Any]:
        return {
            "app_name": app_name,
            "start_ts": start_ts,
            "end_ts": end_ts,
            "failed": failed,
            "crash_detected": crash_detected,
            "oom_detected": oom_detected,
            "cpu_active_min": cpu_active_min,
            "heap_bin_mb": heap_bin_mb,
            "run_id": run_id,
            "gc_type": gc_type,
            "limit": limit,
            "offset": offset,
        }

    def _status_filter_clause(
        self,
        *,
        failed: Optional[bool],
        crash_detected: Optional[bool],
        oom_detected: Optional[bool],
    ) -> str:
        """Return SQL fragment for status flags; omit when not provided."""
        parts: List[str] = []
        if failed is True:
            parts.append("AND failed IS TRUE")
        elif failed is False:
            parts.append("AND failed IS FALSE")

        if crash_detected is True:
            parts.append("AND crash_detected IS TRUE")
        elif crash_detected is False:
            parts.append("AND crash_detected IS FALSE")

        if oom_detected is True:
            parts.append("AND oom_detected IS TRUE")
        elif oom_detected is False:
            parts.append("AND oom_detected IS FALSE")

        return ("\n              " + "\n              ".join(parts)) if parts else ""

    # Time series from system_metrics (CPU, memory, throughput)
    async def fetch_metrics_timeseries(
        self,
        app_name: str,
        limit: int = DEFAULT_LIMIT,
        offset: int = 0,
        *,
        start_ts: Optional[int] = None,
        end_ts: Optional[int] = None,
        failed: Optional[bool] = None,
        crash_detected: Optional[bool] = None,
        oom_detected: Optional[bool] = None,
        cpu_active_min: Optional[float] = None,
        heap_bin_mb: Optional[int] = None, # Ignored for system_metrics
        run_id: Optional[int] = None,
    ) -> Tuple[List[Dict[str, Any]], bool]:
        
        # Select runs_per_sec metrics stored in system_metrics
        run_selects = [f'COALESCE("{col}", 0) AS {alias}' for col, alias in RUN_METRIC_ALIASES.items()]
        run_sql = ",\n                   ".join(run_selects)
        status_filter = self._status_filter_clause(
            failed=failed, crash_detected=crash_detected, oom_detected=oom_detected
        )

        limit_plus_one = limit + 1
        query = text(f"""
            SELECT 
                CAST(extract(epoch from event_time)*1000 AS BIGINT) as timestamp_ms,
                node_rss_mb,
                mem_available_mb,
                mem_free_mb,
                cpu_system, cpu_idle, cpu_iowait,
                {run_sql}
            FROM system_metrics
            WHERE app_name = :app_name
              AND (CAST(:start_ts AS BIGINT) IS NULL OR CAST(extract(epoch from event_time)*1000 AS BIGINT) >= CAST(:start_ts AS BIGINT))
              AND (CAST(:end_ts AS BIGINT) IS NULL OR CAST(extract(epoch from event_time)*1000 AS BIGINT) <= CAST(:end_ts AS BIGINT))
{status_filter}
              AND (CAST(:cpu_active_min AS FLOAT) IS NULL OR (cpu_system >= CAST(:cpu_active_min AS FLOAT)))
              AND (CAST(:run_id AS BIGINT) IS NULL OR CAST(process_start_time AS BIGINT) = CAST(:run_id AS BIGINT))
            ORDER BY event_time
            LIMIT CAST(:limit AS INTEGER)
            OFFSET CAST(:offset AS INTEGER)
        """)

        params = self._common_params(
            app_name=app_name, start_ts=start_ts, end_ts=end_ts,
            failed=failed, crash_detected=crash_detected, oom_detected=oom_detected,
            cpu_active_min=cpu_active_min,
            run_id=run_id, limit=limit_plus_one, offset=offset
        )
        
        result = await self.client.execute(query, params)
        rows = list(result.mappings())
        has_next = len(rows) > limit
        rows = rows[:limit]
        points = []
        for row in rows:
            runs = {alias: self._safe_float(row[alias]) for alias in RUN_METRIC_ALIASES.values()}
            points.append({
                "timestamp_ms": int(row["timestamp_ms"]),
                "node_rss_mb": self._safe_float(row["node_rss_mb"]),
                "mem_available_mb": self._safe_float(row["mem_available_mb"]),
                "mem_free_mb": self._safe_float(row["mem_free_mb"]),
                "cpu_system": self._safe_float(row["cpu_system"]),
                "cpu_idle": self._safe_float(row["cpu_idle"]),
                "cpu_iowait": self._safe_float(row["cpu_iowait"]),
                "runs_per_sec": runs,
            })
        return points, has_next

    # GC pauses from gc_events
    async def fetch_gc_pauses(
        self,
        app_name: str,
        start_ts: Optional[int],
        end_ts: Optional[int],
        gc_type: Optional[str] = None,
        limit: int = DEFAULT_LIMIT,
        offset: int = 0,
        *,
        failed: Optional[bool] = None,
        crash_detected: Optional[bool] = None,
        oom_detected: Optional[bool] = None,
        cpu_active_min: Optional[float] = None, # Ignored for GC events
        heap_bin_mb: Optional[int] = None,
        run_id: Optional[int] = None,
    ) -> Tuple[List[Dict[str, Any]], bool]:
        status_filter = self._status_filter_clause(
            failed=failed, crash_detected=crash_detected, oom_detected=oom_detected
        )

        limit_plus_one = limit + 1
        query = text(f"""
            SELECT 
                CAST(extract(epoch from event_time)*1000 AS BIGINT) as timestamp_ms,
                pause_ms,
                mutator_ms,
                verbose_total_gc_time_ms,
                COALESCE(gc_type, 'unknown') as gc_type
            FROM gc_events
            WHERE app_name = :app_name
              AND (CAST(:start_ts AS BIGINT) IS NULL OR CAST(extract(epoch from event_time)*1000 AS BIGINT) >= CAST(:start_ts AS BIGINT))
              AND (CAST(:end_ts AS BIGINT) IS NULL OR CAST(extract(epoch from event_time)*1000 AS BIGINT) <= CAST(:end_ts AS BIGINT))
              AND (CAST(:gc_type AS TEXT) IS NULL OR gc_type = CAST(:gc_type AS TEXT))
{status_filter}
              AND (CAST(:heap_bin_mb AS INTEGER) IS NULL OR old_space_mib = CAST(:heap_bin_mb AS INTEGER))
              AND (CAST(:run_id AS BIGINT) IS NULL OR CAST(process_start_time AS BIGINT) = CAST(:run_id AS BIGINT))
            ORDER BY event_time
            LIMIT CAST(:limit AS INTEGER)
            OFFSET CAST(:offset AS INTEGER)
        """)
        
        params = self._common_params(
            app_name=app_name, start_ts=start_ts, end_ts=end_ts,
            gc_type=gc_type, failed=failed, crash_detected=crash_detected, oom_detected=oom_detected,
            heap_bin_mb=heap_bin_mb, run_id=run_id, limit=limit_plus_one, offset=offset
        )
        
        result = await self.client.execute(query, params)
        rows_raw = list(result.mappings())
        has_next = len(rows_raw) > limit
        rows_raw = rows_raw[:limit]
        rows = []
        minor_warn = ANOMALY_THRESHOLDS.get("pause_minor_ms", 100.0)
        minor_crit = CRITICALITY_THRESHOLDS.get("gc_p95_minor_crit", minor_warn * 2)
        major_warn = ANOMALY_THRESHOLDS.get("pause_major_ms", 1000.0) * 0.5
        major_crit = ANOMALY_THRESHOLDS.get("pause_major_ms", 1000.0)

        for row in rows_raw:
            pause_ms = self._safe_float(row["pause_ms"])
            gc_type_val = row["gc_type"]
            crit: Criticality = Criticality.ok
            if gc_type_val in ("s", "scavenge"):
                if pause_ms >= minor_crit:
                    crit = Criticality.critical
                elif pause_ms >= minor_warn:
                    crit = Criticality.warning
            elif gc_type_val in ("mc", "mark-compact"):
                if pause_ms >= major_crit:
                    crit = Criticality.critical
                elif pause_ms >= major_warn:
                    crit = Criticality.warning

            rows.append(
                {
                    "timestamp_ms": int(row["timestamp_ms"]),
                    "pause_ms": pause_ms,
                    "mutator_ms": self._safe_float(row["mutator_ms"]),
                    "gc_type": gc_type_val,
                    "total_gc_time_ms": self._safe_float(row["verbose_total_gc_time_ms"]),
                    "criticality": crit,
                }
            )
        return rows, has_next
    # CPU usage from system_metrics
    async def fetch_cpu_usage(
        self,
        app_name: str,
        limit: int = DEFAULT_LIMIT,
        offset: int = 0,
        *,
        start_ts: Optional[int] = None,
        end_ts: Optional[int] = None,
        failed: Optional[bool] = None,
        crash_detected: Optional[bool] = None,
        oom_detected: Optional[bool] = None,
        cpu_active_min: Optional[float] = None,
        heap_bin_mb: Optional[int] = None,
        run_id: Optional[int] = None,
    ) -> Tuple[List[Dict[str, Any]], bool]:
        status_filter = self._status_filter_clause(
            failed=failed, crash_detected=crash_detected, oom_detected=oom_detected
        )

        # Select cgroup system CPU percent when available; filter on cpu_system if requested
        limit_plus_one = limit + 1
        query = text(f"""
            SELECT 
                CAST(extract(epoch from event_time)*1000 AS BIGINT) as timestamp_ms,
                cgroup_cpu_system_pct,
                cpu_user, cpu_system, cpu_idle, cpu_iowait
            FROM system_metrics
            WHERE app_name = :app_name
              AND (CAST(:start_ts AS BIGINT) IS NULL OR CAST(extract(epoch from event_time)*1000 AS BIGINT) >= CAST(:start_ts AS BIGINT))
              AND (CAST(:end_ts AS BIGINT) IS NULL OR CAST(extract(epoch from event_time)*1000 AS BIGINT) <= CAST(:end_ts AS BIGINT))
{status_filter}
              AND (CAST(:cpu_active_min AS FLOAT) IS NULL OR (cpu_system >= CAST(:cpu_active_min AS FLOAT)))
              AND (CAST(:run_id AS BIGINT) IS NULL OR CAST(process_start_time AS BIGINT) = CAST(:run_id AS BIGINT))
            ORDER BY event_time
            LIMIT CAST(:limit AS INTEGER)
            OFFSET CAST(:offset AS INTEGER)
        """)

        params = self._common_params(
            app_name=app_name, start_ts=start_ts, end_ts=end_ts,
            failed=failed, crash_detected=crash_detected, oom_detected=oom_detected,
            cpu_active_min=cpu_active_min,
            run_id=run_id, limit=limit_plus_one, offset=offset
        )

        result = await self.client.execute(query, params)
        rows = list(result.mappings())
        has_next = len(rows) > limit
        rows = rows[:limit]
        points = []
        for row in rows:
            cpu_system = self._safe_float(row["cpu_system"])
            total = self._safe_float(row["cpu_user"]) + cpu_system + self._safe_float(row["cpu_idle"]) + self._safe_float(row["cpu_iowait"])
            
            # Prefer cgroup system CPU percent when available
            if row.get("cgroup_cpu_system_pct") is not None:
                cpu_percent = float(row["cgroup_cpu_system_pct"])
            else:
                cpu_percent = round((cpu_system / total) * 100, 2) if total else 0.0

            # Per-sample criticality
            high_cpu_thresh = ANOMALY_THRESHOLDS.get("high_cpu_percent", 80.0)
            cpu_crit: Criticality = Criticality.ok
            if cpu_percent >= high_cpu_thresh * 1.1:
                cpu_crit = Criticality.critical
            elif cpu_percent >= high_cpu_thresh:
                cpu_crit = Criticality.warning

            points.append({
                "timestamp_ms": int(row["timestamp_ms"]),
                "cpu_percent": cpu_percent,
                "cpu_system": cpu_system,
                "cpu_idle": self._safe_float(row["cpu_idle"]),
                "cpu_iowait": self._safe_float(row["cpu_iowait"]),
                "criticality": cpu_crit,
            })
        return points, has_next

    # Memory usage from system_metrics
    async def fetch_memory_usage(
        self,
        app_name: str,
        limit: int = DEFAULT_LIMIT,
        offset: int = 0,
        *,
        start_ts: Optional[int] = None,
        end_ts: Optional[int] = None,
        failed: Optional[bool] = None,
        crash_detected: Optional[bool] = None,
        oom_detected: Optional[bool] = None,
        cpu_active_min: Optional[float] = None,
        heap_bin_mb: Optional[int] = None,
        run_id: Optional[int] = None,
    ) -> Tuple[List[Dict[str, Any]], bool]:
        status_filter = self._status_filter_clause(
            failed=failed, crash_detected=crash_detected, oom_detected=oom_detected
        )

        # Optional filter on cpu_system
        limit_plus_one = limit + 1
        query = text(f"""
            SELECT 
                CAST(extract(epoch from event_time)*1000 AS BIGINT) as timestamp_ms,
                node_rss_mb,
                node_rss_anon_mb
            FROM system_metrics
            WHERE app_name = :app_name
              AND (CAST(:start_ts AS BIGINT) IS NULL OR CAST(extract(epoch from event_time)*1000 AS BIGINT) >= CAST(:start_ts AS BIGINT))
              AND (CAST(:end_ts AS BIGINT) IS NULL OR CAST(extract(epoch from event_time)*1000 AS BIGINT) <= CAST(:end_ts AS BIGINT))
{status_filter}
              AND (CAST(:cpu_active_min AS FLOAT) IS NULL OR (cpu_system >= CAST(:cpu_active_min AS FLOAT)))
              AND (CAST(:run_id AS BIGINT) IS NULL OR CAST(process_start_time AS BIGINT) = CAST(:run_id AS BIGINT))
            ORDER BY event_time
            LIMIT CAST(:limit AS INTEGER)
            OFFSET CAST(:offset AS INTEGER)
        """)

        params = self._common_params(
            app_name=app_name, start_ts=start_ts, end_ts=end_ts,
            failed=failed, crash_detected=crash_detected, oom_detected=oom_detected,
            cpu_active_min=cpu_active_min,
            run_id=run_id, limit=limit_plus_one, offset=offset
        )

        rows = list((await self.client.execute(query, params)).mappings())
        has_next = len(rows) > limit
        rows = rows[:limit]
        return (
            [
                {
                    "timestamp_ms": int(row["timestamp_ms"]),
                    "heap_used_mb": self._safe_float(row["node_rss_anon_mb"]),
                    "heap_total_mb": self._safe_float(row["node_rss_mb"]),
                    "rss_mb": self._safe_float(row["node_rss_mb"]),
                }
                for row in rows
            ],
            has_next,
        )

    # Heap space usage from gc_events
    async def fetch_heap_spaces(
        self,
        app_name: str,
        limit: int = DEFAULT_LIMIT,
        offset: int = 0,
        *,
        start_ts: Optional[int] = None,
        end_ts: Optional[int] = None,
        failed: Optional[bool] = None,
        crash_detected: Optional[bool] = None,
        oom_detected: Optional[bool] = None,
        cpu_active_min: Optional[float] = None,
        heap_bin_mb: Optional[int] = None,
        run_id: Optional[int] = None,
    ) -> Tuple[List[Dict[str, Any]], bool]:
        status_filter = self._status_filter_clause(
            failed=failed, crash_detected=crash_detected, oom_detected=oom_detected
        )

        limit_plus_one = limit + 1
        query = text(f"""
            SELECT 
                CAST(extract(epoch from event_time)*1000 AS BIGINT) as timestamp_ms,
                verbose_new_space_used_mb,
                verbose_old_space_used_mb,
                verbose_code_space_used_mb,
                verbose_large_object_space_used_mb,
                verbose_code_large_object_space_used_mb,
                verbose_new_large_object_space_used_mb
            FROM gc_events
            WHERE app_name = :app_name
              AND (CAST(:start_ts AS BIGINT) IS NULL OR CAST(extract(epoch from event_time)*1000 AS BIGINT) >= CAST(:start_ts AS BIGINT))
              AND (CAST(:end_ts AS BIGINT) IS NULL OR CAST(extract(epoch from event_time)*1000 AS BIGINT) <= CAST(:end_ts AS BIGINT))
{status_filter}
              AND (CAST(:heap_bin_mb AS INTEGER) IS NULL OR old_space_mib = CAST(:heap_bin_mb AS INTEGER))
              AND (CAST(:run_id AS BIGINT) IS NULL OR CAST(process_start_time AS BIGINT) = CAST(:run_id AS BIGINT))
            ORDER BY event_time
            LIMIT CAST(:limit AS INTEGER)
            OFFSET CAST(:offset AS INTEGER)
        """)

        params = self._common_params(
            app_name=app_name, start_ts=start_ts, end_ts=end_ts,
            failed=failed, crash_detected=crash_detected, oom_detected=oom_detected,
            heap_bin_mb=heap_bin_mb,
            run_id=run_id, limit=limit_plus_one, offset=offset
        )

        rows = list((await self.client.execute(query, params)).mappings())
        has_next = len(rows) > limit
        rows = rows[:limit]
        return (
            [
                {
                    "timestamp_ms": int(row["timestamp_ms"]),
                    "new_space_mb": self._safe_float(row["verbose_new_space_used_mb"]),
                    "old_space_mb": self._safe_float(row["verbose_old_space_used_mb"]),
                    "code_space_mb": self._safe_float(row["verbose_code_space_used_mb"]),
                    "large_object_space_mb": self._safe_float(row["verbose_large_object_space_used_mb"]),
                    "code_large_object_space_mb": self._safe_float(row["verbose_code_large_object_space_used_mb"]),
                    "new_large_object_space_mb": self._safe_float(row["verbose_new_large_object_space_used_mb"]),
                }
                for row in rows
            ],
            has_next,
        )

    # Correlations (gc_events)
    async def fetch_correlations(
        self,
        app_name: str,
        start_ts: Optional[int],
        end_ts: Optional[int],
        failed: Optional[bool] = None,
        crash_detected: Optional[bool] = None,
        oom_detected: Optional[bool] = None,
        cpu_active_min: Optional[float] = None,
        heap_bin_mb: Optional[int] = None,
        runs_metric: Optional[str] = None,
        run_id: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        
        chosen = runs_metric if runs_metric in RUN_METRIC_ALIASES else "geometric_mean_runs_per_sec"
        run_col_sql = f'"{chosen}"'
        status_filter = self._status_filter_clause(
            failed=failed, crash_detected=crash_detected, oom_detected=oom_detected
        )
        
        # Compute Pearson correlations for selected pairs
        query = text(f"""
            SELECT
              corr(pause_ms::float, {run_col_sql}::float) as corr_pause_vs_run,
              corr((allocated_mb / NULLIF(mutator_ms, 0))::float, {run_col_sql}::float) as corr_alloc_vs_run,
              corr(promotion_rate::float, (CASE WHEN gc_type = 'mark-compact' THEN 1 ELSE 0 END)::float) as corr_promo_vs_major,
              corr(old_space_mib::float, {run_col_sql}::float) as corr_old_space_vs_run,
              corr(semi_space_mib::float, {run_col_sql}::float) as corr_semi_space_vs_run
            FROM gc_events
            WHERE app_name = :app_name
              AND (CAST(:start_ts AS BIGINT) IS NULL OR CAST(extract(epoch from event_time)*1000 AS BIGINT) >= CAST(:start_ts AS BIGINT))
              AND (CAST(:end_ts AS BIGINT) IS NULL OR CAST(extract(epoch from event_time)*1000 AS BIGINT) <= CAST(:end_ts AS BIGINT))
{status_filter}
              AND (CAST(:heap_bin_mb AS INTEGER) IS NULL OR old_space_mib = CAST(:heap_bin_mb AS INTEGER))
              AND (CAST(:run_id AS BIGINT) IS NULL OR CAST(process_start_time AS BIGINT) = CAST(:run_id AS BIGINT))
        """)

        params = self._common_params(
            app_name=app_name, start_ts=start_ts, end_ts=end_ts,
            failed=failed, crash_detected=crash_detected, oom_detected=oom_detected,
            heap_bin_mb=heap_bin_mb, run_id=run_id
        )
        
        row = (await self.client.execute(query, params)).mappings().first()
        if not row:
            return []

        return [
            {"x": "pause_ms",              "y": chosen,   "pearson": self._nullable_float(row["corr_pause_vs_run"])},
            {"x": "allocated_mb_per_ms",   "y": chosen,   "pearson": self._nullable_float(row["corr_alloc_vs_run"])},
            {"x": "promotion_rate",        "y": "is_major_gc", "pearson": self._nullable_float(row["corr_promo_vs_major"])},
            {"x": "old_space_mib",         "y": chosen,   "pearson": self._nullable_float(row["corr_old_space_vs_run"])},
            {"x": "semi_space_mib",        "y": chosen,   "pearson": self._nullable_float(row["corr_semi_space_vs_run"])},
        ]

    # Leak trend (gc_events)
    async def fetch_leak_trend(
        self,
        app_name: str,
        start_ts: Optional[int],
        end_ts: Optional[int],
        slope_threshold_mb_per_min: float = 2.0,
        r2_threshold: float = 0.3,
        failed: Optional[bool] = None,
        crash_detected: Optional[bool] = None,
        oom_detected: Optional[bool] = None,
        heap_bin_mb: Optional[int] = None,
        run_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        status_filter = self._status_filter_clause(
            failed=failed, crash_detected=crash_detected, oom_detected=oom_detected
        )

        query = text(f"""
            SELECT
              regr_slope(verbose_old_space_used_mb::double precision,
                         CAST(extract(epoch from event_time)*1000 AS BIGINT)::double precision) AS slope_mb_per_ms,
              regr_r2(verbose_old_space_used_mb::double precision,
                      CAST(extract(epoch from event_time)*1000 AS BIGINT)::double precision) AS r2
            FROM gc_events
            WHERE app_name = :app_name
              AND (CAST(:start_ts AS BIGINT) IS NULL OR CAST(extract(epoch from event_time)*1000 AS BIGINT) >= CAST(:start_ts AS BIGINT))
              AND (CAST(:end_ts AS BIGINT) IS NULL OR CAST(extract(epoch from event_time)*1000 AS BIGINT) <= CAST(:end_ts AS BIGINT))
              AND verbose_old_space_used_mb IS NOT NULL
{status_filter}
              AND (CAST(:heap_bin_mb AS INTEGER) IS NULL OR old_space_mib = CAST(:heap_bin_mb AS INTEGER))
              AND (CAST(:run_id AS BIGINT) IS NULL OR CAST(process_start_time AS BIGINT) = CAST(:run_id AS BIGINT))
        """)

        params = self._common_params(
            app_name=app_name, start_ts=start_ts, end_ts=end_ts,
            failed=failed, crash_detected=crash_detected, oom_detected=oom_detected,
            heap_bin_mb=heap_bin_mb, run_id=run_id
        )

        row = (await self.client.execute(query, params)).mappings().first()
        slope_mb_per_ms = self._nullable_float(row["slope_mb_per_ms"]) if row else None
        r2 = self._nullable_float(row["r2"]) if row else None
        
        slope_mb_per_min = (slope_mb_per_ms * 60000.0) if slope_mb_per_ms else 0.0
        leak = (slope_mb_per_min > slope_threshold_mb_per_min) and (r2 is not None and r2 > r2_threshold)

        criticality = self._criticality_from_leak(
            slope_mb_per_min=slope_mb_per_min,
            r2=r2 if r2 is not None else 0.0,
            leak_suspected=leak
        )

        return {
            "slope_mb_per_min": round(slope_mb_per_min, 3),
            "r2": round(r2, 4) if r2 is not None else 0.0,
            "leak_suspected": leak,
            "criticality": criticality,
        }

    # GC stats (gc_events)
    async def fetch_gc_stats(
        self,
        app_name: str,
        start_ts: Optional[int],
        end_ts: Optional[int],
        failed: Optional[bool] = None,
        crash_detected: Optional[bool] = None,
        oom_detected: Optional[bool] = None,
        gc_type: Optional[str] = None,
        heap_bin_mb: Optional[int] = None,
        run_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        status_filter = self._status_filter_clause(
            failed=failed, crash_detected=crash_detected, oom_detected=oom_detected
        )

        query_counts = text(f"""
            SELECT COUNT(*) AS total,
                   COUNT(*) FILTER (WHERE gc_type = 'scavenge' OR gc_type = 's') AS minor,
                   COUNT(*) FILTER (WHERE gc_type = 'mark-compact' OR gc_type = 'mc') AS major
            FROM gc_events
            WHERE app_name = :app_name
              AND (CAST(:start_ts AS BIGINT) IS NULL OR CAST(extract(epoch from event_time)*1000 AS BIGINT) >= CAST(:start_ts AS BIGINT))
              AND (CAST(:end_ts AS BIGINT) IS NULL OR CAST(extract(epoch from event_time)*1000 AS BIGINT) <= CAST(:end_ts AS BIGINT))
              AND (CAST(:gc_type AS TEXT) IS NULL OR gc_type = CAST(:gc_type AS TEXT))
{status_filter}
              AND (CAST(:heap_bin_mb AS INTEGER) IS NULL OR old_space_mib = CAST(:heap_bin_mb AS INTEGER))
              AND (CAST(:run_id AS BIGINT) IS NULL OR CAST(process_start_time AS BIGINT) = CAST(:run_id AS BIGINT))
        """)

        query_pause = text(f"""
            SELECT
              PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY pause_ms) AS p50,
              PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY pause_ms) AS p95,
              PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY pause_ms) AS p99,
              AVG(pause_ms) AS avg,
              AVG(verbose_total_gc_time_ms) as avg_total_gc
            FROM gc_events
            WHERE app_name = :app_name
              AND (CAST(:start_ts AS BIGINT) IS NULL OR CAST(extract(epoch from event_time)*1000 AS BIGINT) >= CAST(:start_ts AS BIGINT))
              AND (CAST(:end_ts AS BIGINT) IS NULL OR CAST(extract(epoch from event_time)*1000 AS BIGINT) <= CAST(:end_ts AS BIGINT))
              AND pause_ms IS NOT NULL
              AND (CAST(:gc_type AS TEXT) IS NULL OR gc_type = CAST(:gc_type AS TEXT))
{status_filter}
              AND (CAST(:heap_bin_mb AS INTEGER) IS NULL OR old_space_mib = CAST(:heap_bin_mb AS INTEGER))
              AND (CAST(:run_id AS BIGINT) IS NULL OR CAST(process_start_time AS BIGINT) = CAST(:run_id AS BIGINT))
        """)

        params = self._common_params(
            app_name=app_name, start_ts=start_ts, end_ts=end_ts,
            failed=failed, crash_detected=crash_detected, oom_detected=oom_detected,
            heap_bin_mb=heap_bin_mb, run_id=run_id
        )

        counts = (await self.client.execute(query_counts, params)).mappings().first()
        stats = (await self.client.execute(query_pause, params)).mappings().first()

        total = counts["total"]
        minor = counts["minor"]
        major = counts["major"]
        minor_ratio = (minor / total) if total else 0.0
        pause_p95 = stats["p95"] if stats else None
        pause_p95_major = stats["p95"] if stats else None  # same value; severity is based on thresholds

        criticality = self._criticality_from_gc_stats(
            pause_p95_minor=self._nullable_float(pause_p95),
            pause_p95_major=self._nullable_float(pause_p95_major),
            minor_ratio=minor_ratio,
        )

        return {
            "total": total,
            "minor": minor,
            "major": major,
            "minor_ratio": round(minor_ratio, 4),
            "pause_ms": {
                "p50": self._safe_float(stats["p50"]),
                "p95": self._safe_float(stats["p95"]),
                "p99": self._safe_float(stats["p99"]),
                "avg": self._safe_float(stats["avg"]),
            },
            "avg_total_gc_time_ms": self._safe_float(stats["avg_total_gc"]),
            "criticality": criticality,
        }

    # Anomalies summary using threshold rules
    async def fetch_anomalies(
        self,
        app_name: str,
        start_ts: Optional[int],
        end_ts: Optional[int],
        failed: Optional[bool] = None,
        crash_detected: Optional[bool] = None,
        oom_detected: Optional[bool] = None,
        heap_bin_mb: Optional[int] = None,
        run_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        status_filter = self._status_filter_clause(
            failed=failed, crash_detected=crash_detected, oom_detected=oom_detected
        )

        # 1) System checks (swap, memory availability)
        sys_query = text(f"""
            SELECT 
                COUNT(*) as total_rows,
                COUNT(*) FILTER (WHERE node_swap_mb > 0) as swap_usage_count,
                AVG(mem_available_mb / NULLIF(mem_total_mb, 0)) as avg_mem_availability,
                COUNT(*) FILTER (
                    WHERE cgroup_cpu_system_pct IS NOT NULL AND cgroup_cpu_system_pct >= CAST(:high_cpu_percent AS FLOAT)
                ) as high_cpu_count,
                COUNT(*) FILTER (
                    WHERE (mem_available_mb / NULLIF(mem_total_mb, 0)) < CAST(:low_mem_ratio AS FLOAT)
                ) as low_memory_samples
            FROM system_metrics
            WHERE app_name = :app_name
              AND (CAST(:start_ts AS BIGINT) IS NULL OR CAST(extract(epoch from event_time)*1000 AS BIGINT) >= CAST(:start_ts AS BIGINT))
              AND (CAST(:end_ts AS BIGINT) IS NULL OR CAST(extract(epoch from event_time)*1000 AS BIGINT) <= CAST(:end_ts AS BIGINT))
{status_filter}
              AND (CAST(:run_id AS BIGINT) IS NULL OR CAST(process_start_time AS BIGINT) = CAST(:run_id AS BIGINT))
        """)

        # 2) GC checks (pause thresholds, promotion ratio, major/minor)
        gc_query = text(f"""
            SELECT 
                COUNT(*) as total_gc,
                COUNT(*) FILTER (WHERE gc_type IN ('s', 'scavenge')) as minor_count,
                COUNT(*) FILTER (WHERE gc_type IN ('mc', 'mark-compact')) as major_count,
                COUNT(*) FILTER (
                    WHERE gc_type IN ('s', 'scavenge') AND pause_ms > CAST(:pause_minor_ms AS FLOAT)
                ) as bad_minor_pauses,
                COUNT(*) FILTER (
                    WHERE gc_type IN ('mc', 'mark-compact') AND pause_ms > CAST(:pause_major_ms AS FLOAT)
                ) as bad_major_pauses,
                COUNT(*) FILTER (WHERE promotion_ratio > CAST(:promotion_ratio AS FLOAT)) as high_promotion_count
            FROM gc_events
            WHERE app_name = :app_name
              AND (CAST(:start_ts AS BIGINT) IS NULL OR CAST(extract(epoch from event_time)*1000 AS BIGINT) >= CAST(:start_ts AS BIGINT))
              AND (CAST(:end_ts AS BIGINT) IS NULL OR CAST(extract(epoch from event_time)*1000 AS BIGINT) <= CAST(:end_ts AS BIGINT))
{status_filter}
              AND (CAST(:heap_bin_mb AS INTEGER) IS NULL OR old_space_mib = CAST(:heap_bin_mb AS INTEGER))
              AND (CAST(:run_id AS BIGINT) IS NULL OR CAST(process_start_time AS BIGINT) = CAST(:run_id AS BIGINT))
        """)

        # 3) Old-space growth delta across window
        old_space_delta_query = text(f"""
            WITH filtered AS (
                SELECT 
                    CAST(extract(epoch from event_time)*1000 AS BIGINT) as ts_ms,
                    verbose_old_space_used_mb AS val
                FROM gc_events
                WHERE app_name = :app_name
                  AND (CAST(:start_ts AS BIGINT) IS NULL OR CAST(extract(epoch from event_time)*1000 AS BIGINT) >= CAST(:start_ts AS BIGINT))
                  AND (CAST(:end_ts AS BIGINT) IS NULL OR CAST(extract(epoch from event_time)*1000 AS BIGINT) <= CAST(:end_ts AS BIGINT))
{status_filter}
                  AND (CAST(:heap_bin_mb AS INTEGER) IS NULL OR old_space_mib = CAST(:heap_bin_mb AS INTEGER))
                  AND (CAST(:run_id AS BIGINT) IS NULL OR CAST(process_start_time AS BIGINT) = CAST(:run_id AS BIGINT))
                ORDER BY ts_ms
            ), first AS (
                SELECT val FROM filtered ORDER BY ts_ms ASC LIMIT 1
            ), last AS (
                SELECT val FROM filtered ORDER BY ts_ms DESC LIMIT 1
            )
            SELECT (COALESCE((SELECT val FROM last), 0) - COALESCE((SELECT val FROM first), 0)) AS delta_mb
        """)

        params = self._common_params(
            app_name=app_name, start_ts=start_ts, end_ts=end_ts,
            failed=failed, crash_detected=crash_detected, oom_detected=oom_detected,
            heap_bin_mb=heap_bin_mb, run_id=run_id
        )

        sys_params = {
            **params,
            "low_mem_ratio": ANOMALY_THRESHOLDS.get("low_memory_ratio", 0.10),
            "high_cpu_percent": ANOMALY_THRESHOLDS.get("high_cpu_percent", 80.0),
        }
        gc_params = {
            **params,
            "pause_minor_ms": ANOMALY_THRESHOLDS.get("pause_minor_ms", 100.0),
            "pause_major_ms": ANOMALY_THRESHOLDS.get("pause_major_ms", 1000.0),
            "promotion_ratio": ANOMALY_THRESHOLDS.get("promotion_ratio", 80.0),
        }

        sys_res = (await self.client.execute(sys_query, sys_params)).mappings().first()
        gc_res = (await self.client.execute(gc_query, gc_params)).mappings().first()
        old_space_delta_row = (await self.client.execute(old_space_delta_query, params)).mappings().first()

        # Process results
        total_sys = sys_res["total_rows"]
        total_gc = gc_res["total_gc"]
        high_cpu = sys_res.get("high_cpu_count", 0) or 0
        high_cpu_ratio = round(high_cpu / total_sys, 4) if total_sys > 0 else None
        minor_gc = gc_res["minor_count"]
        major_ratio = round(1.0 - (minor_gc / total_gc), 4) if total_gc > 0 else 0.0

        bad_minor = gc_res.get("bad_minor_pauses", 0) or 0
        bad_major = gc_res.get("bad_major_pauses", 0) or 0
        long_pauses = bad_minor + bad_major
        high_promo = gc_res.get("high_promotion_count", 0) or 0

        msgs = [f"Analyzed {total_sys:,} system samples and {total_gc:,} GC events."]
        high_cpu_threshold = ANOMALY_THRESHOLDS.get("high_cpu_percent", 80.0)
        if high_cpu > 0:
            msgs.append(f"Samples with High System CPU (≥ {int(high_cpu_threshold)}%): {high_cpu} samples.")
        if (sys_res.get("swap_usage_count") or 0) > 0:
            msgs.append(f"Memory Swapping detected in {sys_res['swap_usage_count']} samples.")
        avg_mem = sys_res.get("avg_mem_availability")
        low_mem_ratio = ANOMALY_THRESHOLDS.get("low_memory_ratio", 0.10)
        if avg_mem is not None and avg_mem < low_mem_ratio:
            msgs.append(f"Low System Memory: ~{int((avg_mem or 0)*100)}% available on average (threshold {int(low_mem_ratio*100)}%).")
        if bad_minor > 0:
            msgs.append(f"{bad_minor} Minor GCs took > {int(ANOMALY_THRESHOLDS.get('pause_minor_ms', 100))}ms.")
        if bad_major > 0:
            msgs.append(f"{bad_major} Major GCs took > {int(ANOMALY_THRESHOLDS.get('pause_major_ms', 1000))/1000:.1f}s.")
        if high_promo > 0:
            msgs.append(f"High Promotion Rate (>{int(ANOMALY_THRESHOLDS.get('promotion_ratio', 80))}%) in {high_promo} events.")

        old_space_delta_mb = 0.0
        if old_space_delta_row is not None and old_space_delta_row.get("delta_mb") is not None:
            try:
                old_space_delta_mb = float(old_space_delta_row["delta_mb"])
            except Exception:
                old_space_delta_mb = 0.0
        if old_space_delta_mb > 0:
            msgs.append(f"Old space used increased by +{old_space_delta_mb:.2f} MB across the window.")
        elif old_space_delta_mb < 0:
            msgs.append(f"Old space used decreased by {abs(old_space_delta_mb):.2f} MB across the window.")

        criticality = self._criticality_from_anomalies(sys_res, gc_res, high_cpu_ratio, old_space_delta_mb)

        return {
            "total_rows": total_sys,
            "high_cpu_count": high_cpu,
            "high_cpu_ratio": high_cpu_ratio,
            "long_gc_pauses_count": long_pauses,
            "bad_minor_pauses": bad_minor,
            "bad_major_pauses": bad_major,
            "high_promotion_count": high_promo,
            "low_memory_samples": sys_res.get("low_memory_samples", 0) or 0,
            "swap_usage_count": sys_res.get("swap_usage_count", 0) or 0,
            "major_ratio": major_ratio,
            "overhead_slope_mb_per_min": 0.0,
            "overhead_trend_positive": False,
            "old_space_delta_mb": old_space_delta_mb,
            "old_space_trend_positive": old_space_delta_mb > 0,
            "messages": msgs,
            "criticality": criticality,
        }


    # Helpers
    def _safe_float(self, value: Any) -> float:
        if value is None:
            return 0.0
        return float(value)

    def _nullable_float(self, value: Any) -> Optional[float]:
        if value is None:
            return None
        return float(value)

    def _criticality_from_anomalies(self, sys_res, gc_res, high_cpu_ratio, old_space_delta_mb) -> Criticality:
        # Critical triggers
        if high_cpu_ratio is not None and high_cpu_ratio >= CRITICALITY_THRESHOLDS.get("high_cpu_ratio_crit", 0.5):
            return Criticality.critical
        if (gc_res.get("bad_major_pauses") or 0) > 0:
            return Criticality.critical
        if (gc_res.get("bad_minor_pauses") or 0) > 0 and (gc_res.get("bad_minor_pauses") or 0) > 10:
            return Criticality.critical
        if (sys_res.get("swap_usage_count") or 0) > 0:
            return Criticality.critical
        if (sys_res.get("low_memory_samples") or 0) > 0 and (sys_res.get("avg_mem_availability") or 1) < (ANOMALY_THRESHOLDS.get("low_memory_ratio", 0.1) / 2):
            return Criticality.critical

        # Warning triggers
        if (gc_res.get("bad_major_pauses") or 0) > 0 or (gc_res.get("bad_minor_pauses") or 0) > 0:
            return Criticality.warning
        if (sys_res.get("high_cpu_count") or 0) > 0:
            return Criticality.warning
        if (sys_res.get("low_memory_samples") or 0) > 0:
            return Criticality.warning
        if old_space_delta_mb and old_space_delta_mb > 0:
            return Criticality.warning

        return Criticality.ok

    def _criticality_from_gc_stats(self, pause_p95_minor: Optional[float], pause_p95_major: Optional[float], minor_ratio: float) -> Criticality:
        warn_minor = CRITICALITY_THRESHOLDS.get("gc_p95_minor_warn", 100.0)
        crit_minor = CRITICALITY_THRESHOLDS.get("gc_p95_minor_crit", 200.0)
        warn_major = CRITICALITY_THRESHOLDS.get("gc_p95_major_warn", 500.0)
        crit_major = CRITICALITY_THRESHOLDS.get("gc_p95_major_crit", 1000.0)

        if pause_p95_major is not None and pause_p95_major >= crit_major:
            return Criticality.critical
        if pause_p95_minor is not None and pause_p95_minor >= crit_minor:
            return Criticality.critical
        if minor_ratio < 0.5:
            return Criticality.warning
        if pause_p95_major is not None and pause_p95_major >= warn_major:
            return Criticality.warning
        if pause_p95_minor is not None and pause_p95_minor >= warn_minor:
            return Criticality.warning
        return Criticality.ok

    def _criticality_from_leak(self, slope_mb_per_min: float, r2: float, leak_suspected: bool) -> Criticality:
        leak_warn = CRITICALITY_THRESHOLDS.get("leak_slope_warn_mb_per_min", 2.0)
        leak_crit = CRITICALITY_THRESHOLDS.get("leak_slope_crit_mb_per_min", 5.0)
        r2_min = CRITICALITY_THRESHOLDS.get("leak_r2_min", 0.3)
        if leak_suspected and slope_mb_per_min >= leak_crit and r2 >= r2_min:
            return Criticality.critical
        if leak_suspected or slope_mb_per_min >= leak_warn:
            return Criticality.warning
        return Criticality.ok
