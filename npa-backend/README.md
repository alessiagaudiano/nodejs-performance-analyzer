# Node.js Performance Analyzer — Backend

FastAPI backend for the Node.js performance analyzer project. Provides a small API surface and a utility to import Parquet timeseries data into Postgres (seeded from a Parquet file on startup if missing).

## Running instructions
- Put the Parquet file named [`memory_gc_timeseries_v1.7.parquet`](https://drive.google.com/file/d/1V2JnRiIBxRsBv99pKaNdkpkDAwUE0QGL/view) in `app/database/` before running `make up` (if it already exists there, you're set).

Docker / Make commands
- REMOVE EXISTING DB CONTAINERS BEFORE RUNNING THIS. If `make` isn’t available, run the `docker compose` command(s) in parentheses directly.
- `make up` (`docker compose up -d --build`): starts both db and server in detached mode.
- `make down` (`docker compose down`): stop the stack when you’re done.
- `make logs` (`docker compose logs -f`): follow logs from running containers (db, web).
- `make ps` (`docker compose ps`): see container status.
- `make restart` (`docker compose restart`): restart running services if you need a quick bounce.
- `make test` (`docker compose up -d --build` then `docker compose exec web pytest tests/unit/test_services.py -vv`, `docker compose exec web pytest tests/integration/test_services.py -vv`, `docker compose exec web pytest tests/integration/test_apis.py -vv`, `docker compose exec web pytest tests/api_scenarios/test_api_scenarios.py -vv`, then `docker compose down`): run the full test suite in detached mode and stop the stack when finished.
- `make console` (`docker compose up -d --build` then `docker compose exec web sh`): start the web console (detached) and open the web container shell; use this to trial‑install a package. If you want it permanent, add it to `requirements.txt` afterward so the image picks it up.
- `make db-shell` (`docker compose up -d db` then `docker compose exec db psql -U $POSTGRES_USER -d $POSTGRES_DB`): start the db service and open a psql shell with the configured user/db.
- `make clean` (`docker compose down -v --remove-orphans --rmi local` then `docker volume prune -f && docker network prune -f && docker image prune -f`): removes everything including data, containers, and images for a clean state.
- `http://localhost:8000/scalar` will show the api docs.

## Quick start (Docker)

1) Ensure `app/database/memory_gc_timeseries_v1.7.parquet` is present.
2) Edit `.env.docker` if you need to change defaults (it ships with non‑sensitive defaults).
3) Start the stack:
   ```sh
   make up
   ```
4) Open a shell in the web container for running tests/commands:
   ```sh
   make console
   # inside container:
   pytest tests/unit
   pytest tests/api_scenarios
   ```
   (Dependencies install as part of the Docker build; no local `pip install` needed.)

Seeding note
- On startup, the app checks for `gc_events` and `system_metrics` tables. If missing, it imports from `app/database/memory_gc_timeseries_v1.7.parquet` into those tables and converts them to TimescaleDB hypertables.

## API Guide (End‑to‑End)

This section shows the typical flow the frontend should follow, with ordered API calls, parameter explanations, and sample curl commands plus example responses. The example `app_name` used is `lebab` (present in sample data/tests). Replace with another app from your environment as needed.

Base URL
- Local dev default: `http://localhost:8000`
- Interactive API docs: `http://localhost:8000/docs`

1) List available applications
- Endpoint: `GET /api/apps/`
- Purpose: Discover which `app_name` values exist in the database with quick health/activity stats.
- Sample request:
  ```sh
  curl -s "http://localhost:8000/api/apps/?page=1&limit=20"
  ```
- Sample response:
  ```json
  {
    "page": 1,
    "per_page": 20,
    "has_next": false,
    "items": [
      {
        "app_name": "lebab",
        "runs_count": 3,
        "total_system_samples": 1200,   // system_metrics rows
        "total_gc_events": 3400,        // gc_events rows
        "high_cpu_count": 40,
        "high_cpu_ratio": 0.0333,
        "low_memory_samples": 2,
        "long_gc_minor_pauses": 1,
        "long_gc_major_pauses": 0,
        "high_promotion_count": 0,
        "failed_count": 0,
        "crash_detected_count": 0,
        "oom_detected_count": 0
      }
    ]
  }
  ```
 - Frontend: Render app_name as the label and optionally surface the quick stats (runs_count, high_cpu_ratio, long pauses).

2) Fetch app configuration and ranges
- Endpoint: `GET /api/apps/configs`
- Purpose: Returns helper metadata for the given app (or default values). Use this to populate filter controls and pick valid query ranges.
- Important fields:
  - `gc_types`: available GC types (e.g., `s`, `mc`)
  - `time_range`: min/max timestamp in ms
  - `run_status`: allowed flags for failed/crash/oom
  - `heap_capacity_mb_bins`: allowed heap capacity “bins” (MB)
  - `cpu_active`: summary of CPU activity
  - `runs`: recent run IDs (process_start_time)
- Sample request:
  ```sh
  curl -s "http://localhost:8000/api/apps/configs?app_name=lebab"
  ```
- Sample response (shape):
  ```json
  {
    "app_name": "lebab",
    "gc_types": ["s", "mc"],
    "time_range": {"start_ts": 3, "end_ts": 57270},
    "run_status": {"crash_detected": [false, true], "failed": [false, true], "oom_detected": [false, true]},
    "heap_capacity_mb_bins": [128],
    "cpu_active": {"min": 10012173, "p50": 16250866, "p95": 31020965, "max": 31109413},
    "runs": [1761736815, 1761736816, 1761736818]
  }
  ```
 - Frontend: Summary cards for totals and percentiles; optional bar chart for minor vs major counts.
 - Frontend: Pre-fill filters (time range pickers, heap_bin_mb dropdown, run selector) and suggest cpu_active_min from cpu_active (e.g., p50/p95).

Version 1 note
- For the sample dataset, the `runs` list (process_start_time values) for `lebab` is hardcoded in the backend. A future version will fetch this dynamically from the database again.

Common query parameters (and how configs informs them)
- app_name: Pick from /api/apps; matches `configs.app_name`.
- start_ts/end_ts: Optional bounds; omit to use the full range (see `configs.time_range`).
- run_status (configs): A convenience map of available failure flags; use the individual boolean query params (`failed`, `crash_detected`, `oom_detected`) when calling endpoints.
- Failure flags: Optional booleans `failed`, `crash_detected`, `oom_detected` to match rows where those flags equal the provided value; omit to include all rows.
- cpu_active_min: Min `cpu_system`; use `configs.cpu_active` (e.g., p50 or p95) to choose. Note: applied to system_metrics‑based endpoints (time-series, cpu-usage, memory-usage) and not applied to GC‑only endpoints (gc-pauses, heap-spaces, correlations, gc-stats, leak-trend).
- heap_bin_mb: Select a heap capacity from `configs.heap_capacity_mb_bins` (e.g., 128).
- run_id: Focus a single run from `configs.runs`; optionally add start/end to zoom within it.
- page: 1‑based page number; responses echo the requested `page`.
- limit: Max rows for list endpoints (also returned as `per_page` in responses); default is 100 (shared across endpoints). Increase for denser charts.

Paginated endpoints (`/api/apps`, `/api/metrics/time-series`, `/api/metrics/gc-pauses`, `/api/metrics/cpu-usage`, `/api/metrics/memory-usage`, `/api/metrics/heap-spaces`) return an envelope:
```json
{"page": 1, "per_page": 100, "has_next": false, "items": [/* rows */]}
```
`has_next` is true when more pages exist (calculated without a full COUNT).

Quick examples
- `app_name=lebab`
- Failures only: `+failed=true` (or `crash_detected=true` / `oom_detected=true`)
- Busy-only: `+cpu_active_min=85` (from `cpu_active.p95`)
- Single run: `run_id=1700000000` (optionally drop `start_ts/end_ts`)

3) Time‑series (CPU, memory, throughput)
- Endpoint: `GET /api/metrics/time-series`
- Purpose: Plot per‑sample CPU (system/idle/iowait), RSS, mem available/free, and multiple `runs_per_sec` metrics.
- Params: required `app_name`; optional `start_ts`, `end_ts`, `failed`, `crash_detected`, `oom_detected`, `cpu_active_min`, `heap_bin_mb`, `run_id`, `limit`, `page`.
- Sample (window):
  ```sh
  curl -s "http://localhost:8000/api/metrics/time-series?app_name=lebab&limit=100"
  ```
- Response shape:
  ```json
  {
    "page": 1,
    "per_page": 100,
    "has_next": false,
    "items": [
      {"timestamp_ms": 12345, "node_rss_mb": 350.0, "mem_available_mb": 512.0, "mem_free_mb": 256.0, "cpu_system": 17.5, "cpu_idle": 60.0, "cpu_iowait": 22.5, "runs_per_sec": {"geometric_mean_runs_per_sec": 130.0}}
    ]
  }
  ```
 - Frontend: Use `/api/metrics/cpu-usage` for CPU percent; this endpoint returns raw CPU counters (system/idle/iowait), memory (RSS/available/free), and throughput.

4) GC pauses
- Endpoint: `GET /api/metrics/gc-pauses`
- Purpose: Table/plot of GC pauses with mutator times; filterable by `gc_type`.
- Params: required `app_name`; optional `start_ts`, `end_ts`, `gc_type`, `failed`, `crash_detected`, `oom_detected`, `heap_bin_mb`, `run_id`, `limit`, `page`.
- Sample:
  ```sh
  curl -s "http://localhost:8000/api/metrics/gc-pauses?app_name=lebab&limit=50"
  ```
 - Sample response (shape):
   ```json
   {
     "page": 1,
     "per_page": 50,
     "has_next": false,
     "items": [
       {
         "timestamp_ms": 12345,
         "pause_ms": 12.3,
         "mutator_ms": 220.0,
         "gc_type": "s",
         "total_gc_time_ms": 4.5
       },
       {
         "timestamp_ms": 13345,
         "pause_ms": 180.0,
         "mutator_ms": 150.0,
         "gc_type": "mc",
         "total_gc_time_ms": 55.0
       }
     ]
   }
   ```

5) CPU usage
- Endpoint: `GET /api/metrics/cpu-usage`
- Purpose: System CPU percent per sample. `cpu_percent` uses `cgroup_cpu_system_pct` when available; `cpu_system/idle/iowait` are raw cumulative counters.
- Params: required `app_name`; optional `start_ts`, `end_ts`, `failed`, `crash_detected`, `oom_detected`, `cpu_active_min`, `run_id`, `limit`, `page`.
- Sample:
  ```sh
  curl -s "http://localhost:8000/api/metrics/cpu-usage?app_name=lebab&limit=100"
  ```
 - Sample response (shape):
   ```json
   {
     "page": 1,
     "per_page": 100,
     "has_next": false,
     "items": [
       {
         "timestamp_ms": 12345,
         "cpu_percent": 17.5,
         "cpu_system": 17.5,
         "cpu_idle": 60.0,
         "cpu_iowait": 22.5
       }
     ]
   }
   ```

6) Memory usage (heap+RSS)
- Endpoint: `GET /api/metrics/memory-usage`
- Purpose: Per‑sample heap used/total (MB) and process RSS (MB).
- Params: required `app_name`; optional `start_ts`, `end_ts`, `failed`, `crash_detected`, `oom_detected`, `cpu_active_min`, `run_id`, `limit`, `page`.
- Sample:
  ```sh
  curl -s "http://localhost:8000/api/metrics/memory-usage?app_name=lebab"
  ```
 - Sample response (shape):
   ```json
   {
     "page": 1,
     "per_page": 100,
     "has_next": false,
     "items": [
       {
         "timestamp_ms": 12345,
         "heap_used_mb": 200.5,
         "heap_total_mb": 256.0,
         "rss_mb": 350.0
       }
     ]
   }
   ```

7) GC
- Use two endpoints for GC analysis:
  - `GET /api/metrics/gc-pauses` for the raw events timeline (pause_ms, mutator_ms, gc_type)
  - `GET /api/metrics/gc-stats` for the summary (counts and pause percentiles)
 - Frontend: Simple bar for p50/p95/p99 (gc-stats) and a basic scatter of pause_ms over time; color major (mc) vs minor (s) differently.

8) Correlations
- Endpoint: `GET /api/metrics/correlations`
- Purpose: Pearson correlations for GC and heap vs throughput (pause_ms vs runs, allocated_mb/mutator_ms vs runs, promotion_rate vs is_major_gc, and heap config vs runs).
- Params: required `app_name`; optional `start_ts`, `end_ts`, `runs_metric` (e.g., `geometric_mean_runs_per_sec`), `failed`, `crash_detected`, `oom_detected`, `heap_bin_mb`, `run_id`.
- Pairs computed:
  - `pause_ms` vs selected `runs_per_sec` (inverse expected)
  - `allocated_mb / mutator_ms` vs selected `runs_per_sec`
  - `promotion_rate` vs major-GC indicator (1 for mc)
  - `old_space_mib` and `semi_space_mib` vs selected `runs_per_sec`
- Sample:
  ```sh
  curl -s "http://localhost:8000/api/metrics/correlations?app_name=lebab"
  ```
 - Frontend: Small table or bar chart of Pearson values; color-code positive/negative.
 - Frontend: Line/area chart for heap_used_mb vs heap_total_mb and rss_mb to visualize headroom.
 - Frontend: Line chart of cpu_percent over time (system).
 - Frontend: Plot pause_ms as scatter/bar over time and show a table with mutator_ms and gc_type; allow filtering by gc_type.

9) Leak trend
- Endpoint: `GET /api/metrics/leak-trend`
- Purpose: Estimates whether heap is steadily growing. Returns slope (MB/min), R², and `criticality` (`ok|warning|critical`),  and `leak_suspected` (true when internal thresholds are exceeded). Use failure flags or a single `run_id` to reduce noise.
- Params: required `app_name`; optional `start_ts`, `end_ts`, `failed`, `crash_detected`, `oom_detected`, `heap_bin_mb`, `run_id`.
- Sample:
  ```sh
  curl -s "http://localhost:8000/api/metrics/leak-trend?app_name=lebab&failed=true"
  ```
- Sample response:
  ```json
  {"slope_mb_per_min": 1.25, "r2": 0.55, "leak_suspected": true}
  ```
 - Frontend: Show a badge/indicator (e.g., “Leak suspected”) with slope and R²; link to memory chart.

10) GC stats
- Endpoint: `GET /api/metrics/gc-stats`
- Purpose: Summarizes GC activity in the window: total/minor/major counts, minor_ratio (minor/total), pause latency percentiles (p50/p95/p99/avg), and `criticality` (`ok|warning|critical`). and average total GC time per sample. Use `gc_type=mc` to focus on major collections. High p95 or p99 indicates occasional long pauses; a low minor_ratio implies more major GCs (typically more disruptive).
- Params: required `app_name`; optional `start_ts`, `end_ts`, `gc_type`, `failed`, `crash_detected`, `oom_detected`, `heap_bin_mb`, `run_id`.

- Sample:
  ```sh
  curl -s "http://localhost:8000/api/metrics/gc-stats?app_name=lebab"
  ```
- Sample response (shape):
  ```json
  {
    "total": 1000,
    "minor": 920,
    "major": 80,
    "minor_ratio": 0.92,
    "pause_ms": {"p50": 1.2, "p95": 12.4, "p99": 25.0, "avg": 3.0},
    "avg_total_gc_time_ms": 5.7
  }
  ```

- 11) Anomalies
- Endpoint: `GET /api/metrics/anomalies`
- Purpose: Quick health indicators (CPU, GC pauses, promotion, memory, swap, old-space delta) plus `criticality` (`ok|warning|critical`).
- Purpose: Quick health indicators (high system CPU, long GC pauses, promotion pressure, low memory, swap, major ratio). Thresholds come from `app/core/constants.py`.
- Params: required `app_name`; optional `start_ts`, `end_ts`, `failed`, `crash_detected`, `oom_detected`, `heap_bin_mb`, `run_id`.
- Example:
  ```sh
  curl -s "http://localhost:8000/api/metrics/anomalies?app_name=lebab"
  ```
  Sample response (shape):
  ```json
  {
    "total_rows": 1234,
    "high_cpu_count": 456,
    "high_cpu_ratio": 0.37,
    "long_gc_pauses_count": 12,
    "bad_minor_pauses": 9,
    "bad_major_pauses": 3,
    "high_promotion_count": 17,
    "low_memory_samples": 24,
    "swap_usage_count": 8,
    "major_ratio": 0.42,
    "overhead_slope_mb_per_min": 0.0,
    "overhead_trend_positive": false,
    "old_space_delta_mb": 35.7,
    "old_space_trend_positive": true,
    "messages": [
      "Analyzed 1,234 system samples and 3,210 GC events.",
      "Samples with High System CPU (≥ 80%): 456 samples.",
      "Memory Swapping detected in 8 samples.",
      "Low System Memory: ~7% available on average (threshold 10%).",
      "9 Minor GCs took > 100ms.",
      "3 Major GCs took > 1.0s.",
      "High Promotion Rate (>80%) in 17 events.",
      "Old space used increased by +35.70 MB across the window."
    ]
  }
  ```
 - How it’s computed (from constants):
   - High CPU: fraction of samples where `cgroup_cpu_system_pct >= high_cpu_percent` (default 80%).
   - Long pauses: minor `pause_ms` > 100ms; major `pause_ms` > 1000ms.
   - Promotion pressure: `promotion_ratio` > 80%.
   - Low memory: `mem_available / mem_total` < 10%.
   - Swap usage: any `node_swap` > 0.
   - Major ratio: `1 - minor_ratio` from GC stats.

Notes and tips
- Always use millisecond timestamps.
- `failed`, `crash_detected`, and `oom_detected` filter rows where the corresponding boolean matches the provided value.
- `heap_bin_mb` can standardize on a capacity bin (e.g., 128 MB) to compare runs fairly.
- Prefer focusing analysis on a single `run_id` when possible to reduce noise.


## Testing Strategy & Documentation

This project includes unit and integration checks for service logic plus API flow scenarios against seeded Postgres data.

### Testing details

- Scope: unit service logic with fake sessions, integration service checks with raw SQL cross-checks, API tests via FastAPI TestClient, and complete flow API scenarios.
- Runtime: pytest (with pytest-asyncio), typically executed inside Docker.
- Data: integration suites read `system_metrics` and `gc_events`; they skip if the DB has no apps, time ranges, run IDs, or heap bins.
- List endpoints: pagination shape and `has_next` behavior are verified.
- Object endpoints and correlations: required keys are verified, and correlations include `x`, `y`, `pearson`.
- Validation: invalid pagination, missing `app_name`, and non-boolean flags return 422.

### Test Architecture Overview

The tests are organized into the following areas inside the `tests/` directory:

| Directory | Type | Purpose | Dependencies |
|-----------|------|---------|--------------|
| `tests/unit/` | **Unit Service Tests** | Validates service mapping and criticality logic with fake sessions. | None |
| `tests/integration/` | **Integration Service + API Tests** | Validates services against real DB data and API response shape/validation. | PostgreSQL |
| `tests/api_scenarios/` | **API Scenarios** | Exercises multi-step API scenarios with common filters and pagination behavior. | PostgreSQL |



### Prerequisites

Dependencies install during the Docker build. Ensure your `.env.docker` (or environment variables) is configured with the correct database credentials and that the DB container has data.



### Detailed File Descriptions

#### Unit Service Tests (`tests/unit/test_services.py`)

- `test_apps_service_get_app_names`: Confirms the service returns the list of application names from the query results.
- `test_apps_service_get_apps`: Confirms the app list is paginated correctly, includes app names, and reports whether more apps exist.
- `test_apps_service_get_configs`: Confirms the configs for an app include time range, heap bins, run identifiers, CPU activity, and GC types.
- `test_metrics_service_timeseries`: Confirms time-series metrics include expected fields and correct pagination.
- `test_metrics_service_gc_pauses`: Confirms GC pause metrics include pause data, criticality, and correct pagination.
- `test_metrics_service_cpu_usage`: Confirms CPU usage metrics include CPU values and correct pagination.
- `test_metrics_service_memory_usage`: Confirms memory usage metrics include heap and RSS values with correct pagination.
- `test_metrics_service_heap_spaces`: Confirms heap space metrics include space breakdown values with correct pagination.
- `test_metrics_service_correlations`: Confirms correlations return a list of correlation points with x/y/pearson fields.
- `test_metrics_service_leak_trend`: Confirms leak-trend summary includes slope, r2, leak flag, and criticality fields.
- `test_metrics_service_gc_stats`: Confirms GC stats summary includes total/minor/major counts, pause stats, and criticality.
- `test_metrics_service_anomalies`: Confirms anomalies summary includes required fields and derived ratios/messages.

#### Integration Service Tests (`tests/integration/test_services.py`)

These mirror the unit service tests against the real database, using raw SQL checks to validate counts, ranges, and runs. Tests may skip when no apps or time range data exists.

#### Integration API Tests (`tests/integration/test_apis.py`)

- `test_apps_list_happy`: Confirms `/api/apps/` responds 200 and includes pagination fields (`page`, `per_page`, `items`, `has_next`).
- `test_apps_list_invalid_params`: Confirms invalid `page`/`limit` values are rejected with 422 validation errors.
- `test_apps_configs_happy`: Confirms `/api/apps/configs` returns core config sections (`app_name`, `gc_types`, `time_range`, `run_status`) for a real app.
- `test_apps_configs_no_app_name`: Confirms `/api/apps/configs` still returns 200 when `app_name` is omitted (defaults are allowed).
- `test_apps_configs_unknown_app`: Confirms `/api/apps/configs` returns 200 for an unknown `app_name` (empty or neutral config is allowed).
- `test_metrics_missing_app_name`: Confirms all metrics endpoints enforce `app_name` as required and return 422 when missing.
- `test_metrics_list_invalid_pagination`: Confirms list endpoints enforce pagination validation and reject invalid `page`/`limit`.
- `test_metrics_time_series_variants`: Confirms `/api/metrics/time-series` supports baseline, time-range, and run/flag filters without error.
- `test_metrics_gc_pauses_variants`: Confirms `/api/metrics/gc-pauses` supports baseline, time-range + `gc_type`, and heap/run filters without error.
- `test_metrics_cpu_usage_variants`: Confirms `/api/metrics/cpu-usage` supports baseline, time-range + CPU threshold, and run/failed filters without error.
- `test_metrics_memory_usage_variants`: Confirms `/api/metrics/memory-usage` supports baseline, time-range, and run/failed filters without error.
- `test_metrics_heap_spaces_variants`: Confirms `/api/metrics/heap-spaces` supports baseline, time-range + heap bin, and run/failed filters without error.
- `test_metrics_correlations_variants`: Confirms `/api/metrics/correlations` returns a list with `x`, `y`, `pearson` keys for base and filtered requests.
- `test_metrics_leak_trend_variants`: Confirms `/api/metrics/leak-trend` returns leak summary fields for base and filtered requests.
- `test_metrics_gc_stats_variants`: Confirms `/api/metrics/gc-stats` returns GC summary fields for base and filtered requests.
- `test_metrics_anomalies_variants`: Confirms `/api/metrics/anomalies` returns anomalies summary fields for base and filtered requests.
- `test_metrics_invalid_bool`: Confirms boolean query params are validated and reject non-boolean values with 422.

#### API Scenario Tests (`tests/api_scenarios/test_api_scenarios.py`)

- `test_api_flow_basic`: Confirms the main user flow works: list apps -> get configs for one app -> fetch each list-style metrics endpoint -> fetch each summary-style endpoint -> get correlations list.
- `test_api_flow_filters_with_time_range_and_flags`: Confirms list endpoints accept a time window plus boolean flags (`failed`, `crash_detected`, `oom_detected`) and a CPU activity threshold.
- `test_api_flow_filters_with_heap_bin_and_run_id`: Confirms list endpoints work when filtering by both a specific run and a heap bin, and that leak-trend/anomalies still return required fields with the same filters.
- `test_api_flow_has_next_consistency`: Confirms pagination behaves correctly by comparing a small page vs a large page for apps and each list metrics endpoint.
- `test_api_flow_filters_with_run_id_only`: Confirms list endpoints support filtering by `run_id` alone for time-series, CPU usage, memory usage, GC pauses, and heap spaces (skips if no run ID exists).
- `test_api_flow_filters_with_heap_bin_only`: Confirms GC-pauses and heap-spaces list endpoints support heap-bin filtering, and leak-trend/anomalies still return expected fields (skips if no heap bin exists).
- `test_api_flow_correlations_with_filters`: Confirms correlations accepts combined filters including time range, run ID/heap bin, and boolean flags (`failed`, `crash_detected`, `oom_detected`).
- `test_api_flow_gc_stats_and_anomalies_with_filters`: Confirms GC-stats and anomalies accept combined filters including time range, heap bin, boolean flags (`failed`, `crash_detected`, `oom_detected`), and `gc_type`.


### How to Run Tests

Run tests inside the Docker container shell (`make console` or `docker compose up -d --build && docker compose exec web sh`):

```bash
pytest tests/unit
pytest tests/integration
pytest tests/api_scenarios
```


### Troubleshooting

#### Connection refused in tests

Ensure the database credentials in `.env.docker` (or env vars) are correct and the DB container is reachable with seeded data.



### Test Coverage Summary

| Test Type | What It Tests | Speed | Dependencies |
|-----------|---------------|-------|--------------|
| Unit Service | Service mapping and criticality logic with fake sessions | Fast | None |
| Integration Service | Service queries validated against DB and raw SQL | Medium | PostgreSQL |
| Integration API | API response shape and validation | Medium | PostgreSQL |
| API Scenarios | Multi-step API flows and filters | Medium | PostgreSQL |

---
