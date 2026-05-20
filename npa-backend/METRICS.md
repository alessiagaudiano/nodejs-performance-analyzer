# Dataset Metrics Reference

This document provides a comprehensive explanation of all metrics available in the parsed Node.js GC and memory dataset generated from web-tooling-benchmark results with `--trace-gc-nvp` and `--trace-gc-verbose` flags.

## Table of Contents

1. [Core GC Event Metadata](#core-gc-event-metadata)
2. [V8 GC Timing Metrics (NVP Format)](#v8-gc-timing-metrics-nvp-format)
3. [V8 Memory Metrics (NVP Format)](#v8-memory-metrics-nvp-format)
4. [V8 Verbose Heap Metrics](#v8-verbose-heap-metrics)
5. [System Memory Metrics](#system-memory-metrics)
6. [Process Memory Metrics](#process-memory-metrics)
7. [System Performance Metrics](#system-performance-metrics)
8. [Benchmark Results](#benchmark-results)
9. [Configuration & Metadata](#configuration--metadata)

---

## Core GC Event Metadata

### `timestamp_ms`
- **Type**: Integer (milliseconds)
- **Description**: Time elapsed since process start when the GC event occurred
- **Source**: Process-relative timestamp derived from wall clock time
- **Units**: Milliseconds

### `pid`
- **Type**: Integer
- **Description**: Process ID of the Node.js process
- **Source**: `--trace-gc-nvp` output

### `gc_type`
- **Type**: String
- **Description**: Type of garbage collection performed
- **Common Values**:
  - `scavenge` - Minor GC (young generation / new space)
  - `mark-compact` - Major GC (full heap collection)
  - `incremental-marking` - Incremental marking phase
  - `process-weak-callbacks` - Weak reference processing
- **Source**: `--trace-gc-nvp` output

### `execution_phase`
- **Type**: String (categorical)
- **Description**: Phase of benchmark execution when GC occurred
- **Values**:
  - `startup` - Before benchmark execution begins
  - `benchmark` - During active benchmark execution
  - `cleanup` - After benchmark completes successfully
  - `benchmark_incomplete` - Benchmark started but never finished (crash/OOM)
  - `unknown` - Phase could not be determined
- **Source**: Parser inference based on benchmark output markers

### `source`
- **Type**: String (categorical)
- **Description**: Origin of the data record
- **Values**:
  - `gc` - Record from GC trace event
  - `memory` - Record from system memory monitoring
- **Purpose**: Enables filtering time-series data by source type

---

## V8 GC Timing Metrics (NVP Format)

All timing metrics are in milliseconds unless otherwise noted.

### Core Timings

#### `pause_ms`
- **Description**: Total pause time (stop-the-world duration)
- **Units**: Milliseconds
- **Interpretation**: Time when JavaScript execution is paused for GC
- **Lower is better**: Minimizing pause times improves application responsiveness

#### `mutator_ms`
- **Description**: Time spent in mutator (application code) since last GC
- **Units**: Milliseconds
- **Interpretation**: How long the application ran between GC events

### GC Phase Breakdown

These metrics break down the total GC pause time into constituent phases:

#### Prologue & Epilogue
- `prologue` - GC preparation work
- `epilogue` - GC finalization work
- `heap_prologue` - Heap-specific prologue
- `heap_epilogue` - Heap-specific epilogue
- `heap_epilogue_reduce_new_space` - New space reduction during epilogue
- `heap_external_prologue` - External heap prologue
- `heap_external_epilogue` - External heap epilogue
- `heap_embedder_tracing_epilogue` - Embedder tracing finalization

#### Mark Phase (Major GC)
- `mark` - Total marking phase duration
- `mark_roots` - Marking from GC roots (stack, globals)
- `mark_full_closure_parallel` - Parallel marking closure
- `mark_full_closure` - Full marking closure
- `mark_finish_incremental` - Incremental marking finalization
- `mark_ephemeron_marking` - Ephemeron (weak map) marking
- `mark_ephemeron_linear` - Linear ephemeron processing
- `mark_embedder_prologue` - Embedder marking setup
- `mark_embedder_tracing` - Embedder-specific object tracing
- `background_mark` - Marking performed on background threads

#### Sweep Phase (Major GC)
- `sweep` - Total sweeping phase duration
- `sweep_code` - Code space sweeping
- `sweep_map` - Map space sweeping
- `sweep_new` - New space sweeping
- `sweep_new_lo` - New large object space sweeping
- `sweep_old` - Old space sweeping
- `background_sweep` - Sweeping on background threads
- `finish_sweep_array_buffers` - ArrayBuffer sweep finalization
- `complete_sweep_array_buffers` - Complete ArrayBuffer sweeping
- `complete_sweeping` - Sweep completion

#### Evacuate Phase (Scavenge/Compaction)
- `evacuate` - Total evacuation duration
- `evacuate_candidates` - Selecting evacuation candidates
- `evacuate_clean_up` - Post-evacuation cleanup
- `evacuate_copy` - Copying objects to new location
- `background_evacuate_copy` - Background evacuation copying
- `evacuate_prologue` - Evacuation setup
- `evacuate_epilogue` - Evacuation finalization
- `evacuate_rebalance` - Space rebalancing
- `evacuate_update_pointers` - Update pointers to evacuated objects
- `evacuate_update_pointers_to_new_roots` - Root pointer updates
- `evacuate_update_pointers_slots_main` - Slot pointer updates
- `evacuate_update_pointers_weak` - Weak pointer updates
- `background_evacuate_update_pointers` - Background pointer updates

#### Scavenge-Specific (Minor GC)
- `scavenge` - Total scavenge duration
- `fast_promote` - Fast promotion path
- `scavenge_free_remembered_set` - Remembered set freeing
- `scavenge_roots` - Root scanning for scavenge
- `scavenge_weak` - Weak reference processing
- `scavenge_weak_global_handles_identify` - Identify weak global handles
- `scavenge_weak_global_handles_process` - Process weak global handles
- `scavenge_parallel` - Parallel scavenge work
- `background_scavenge_parallel` - Background scavenge work
- `scavenge_update_refs` - Reference updates after scavenge
- `scavenge_sweep_array_buffers` - ArrayBuffer sweep in scavenge

#### Clear Phase
- `clear` - Total clearing phase
- `clear_external_string_table` - External string table cleanup
- `clear_string_forwarding_table` - String forwarding cleanup
- `clear_weak_global_handles` - Weak global handle cleanup
- `heap_external_weak_global_handles` - External weak handles
- `clear_dependent_code` - Dependent code cleanup
- `clear_maps` - Map cleanup
- `clear_slots_buffer` - Slot buffer cleanup
- `clear_weak_collections` - WeakMap/WeakSet cleanup
- `clear_weak_lists` - Weak list cleanup
- `clear_weak_references` - Weak reference cleanup
- `clear_join_job` - Join cleanup jobs

#### Other Phases
- `finish` - GC finalization
- `time_to_safepoint` - Time to reach GC safepoint
- `reduce_memory` - Memory reduction operation
- `unmapper` - Memory unmapping operations
- `background_unmapper` - Background memory unmapping

### Incremental GC Metrics

#### `incremental`
- **Description**: Total time in incremental GC
- **Context**: V8 performs GC incrementally to reduce pause times

#### Incremental Phases
- `incremental_finalize` - Incremental GC finalization
- `incremental_finalize_external_prologue` - External finalization setup
- `incremental_finalize_external_epilogue` - External finalization cleanup
- `incremental_layout_change` - Layout changes during incremental GC
- `incremental_sweep_array_buffers` - Incremental ArrayBuffer sweeping
- `incremental_sweeping` - Incremental sweep work
- `incremental_embedder_prologue` - Embedder incremental setup
- `incremental_embedder_tracing` - Incremental embedder tracing
- `incremental_wrapper_tracing_longest_step` - Longest wrapper tracing step

#### Incremental Statistics
- `incremental_longest_step` - Duration of longest incremental step
- `incremental_steps_count` - Number of incremental steps
- `incremental_steps_took` - Total time across all incremental steps
- `incremental_marking_throughput` - Marking throughput (bytes/ms)
- `incremental_walltime_duration` - Wall-clock duration of incremental GC

---

## V8 Memory Metrics (NVP Format)

All memory sizes are in bytes unless otherwise noted.

### Heap Size Metrics

#### `total_size_before`
- **Description**: Total heap size before GC
- **Units**: Bytes
- **Includes**: All V8 heap spaces

#### `total_size_after`
- **Description**: Total heap size after GC
- **Units**: Bytes
- **Interpretation**: Reduction = memory reclaimed

#### `holes_size_before`
- **Description**: Fragmentation (holes) before GC
- **Units**: Bytes

#### `holes_size_after`
- **Description**: Fragmentation (holes) after GC
- **Units**: Bytes
- **Interpretation**: Lower = better memory compaction

### Allocation & Promotion

#### `allocated`
- **Description**: Bytes allocated since last GC
- **Units**: Bytes
- **Interpretation**: Allocation rate = allocated / mutator_ms

#### `promoted`
- **Description**: Bytes promoted from new space to old space
- **Units**: Bytes
- **Interpretation**: Objects that survived and moved to old generation

#### `new_space_survived`
- **Description**: Bytes that survived in new space (not promoted)
- **Units**: Bytes

### Object Tracking

#### `nodes_died_in_new`
- **Description**: Number of objects collected in new space
- **Units**: Count

#### `nodes_copied_in_new`
- **Description**: Number of objects copied within new space
- **Units**: Count

#### `nodes_promoted`
- **Description**: Number of objects promoted to old space
- **Units**: Count

### Performance Ratios & Rates

#### `promotion_ratio`
- **Description**: Ratio of promoted bytes to total survived bytes
- **Units**: Percentage (0-100)
- **Formula**: `promoted / (promoted + survived) * 100`
- **Interpretation**: Higher = more objects reaching old generation

#### `average_survival_ratio`
- **Description**: Historical average survival rate
- **Units**: Percentage (0-100)
- **Interpretation**: Indicates object lifetime patterns

#### `promotion_rate`
- **Description**: Rate of promotion to old space
- **Units**: Bytes/ms
- **Interpretation**: Speed of old generation growth

#### `new_space_survive_rate` / `new_space_survive_rate_`
- **Description**: Survival rate in new space
- **Units**: Percentage (0-100)
- **Interpretation**: Lower = more efficient collection

#### `new_space_allocation_throughput`
- **Description**: Allocation rate in new space
- **Units**: Bytes/ms
- **Interpretation**: Application allocation speed

#### `scavenge_throughput`
- **Description**: Scavenge processing speed
- **Units**: Bytes/ms
- **Interpretation**: GC efficiency metric

#### `compaction_speed`
- **Description**: Memory compaction speed
- **Units**: Bytes/ms
- **Interpretation**: Defragmentation efficiency

### Unmapper Metrics

#### `unmapper_chunks`
- **Description**: Number of memory chunks to unmap
- **Units**: Count
- **Interpretation**: Tracks memory pages being returned to OS

---

## V8 Verbose Heap Metrics

All verbose metrics use the `verbose_` prefix and are captured from `--trace-gc-verbose` output. All sizes are in **kilobytes (KB)**.

### Memory Allocator

#### `verbose_mem_alloc_used_kb`
- **Description**: Total memory used by V8's memory allocator
- **Units**: KB

#### `verbose_mem_alloc_avail_kb`
- **Description**: Total memory available to V8's allocator
- **Units**: KB

### Per-Space Metrics

For each heap space, three metrics are captured:
- `*_used_kb` - Currently used memory
- `*_avail_kb` - Available memory in space
- `*_committed_kb` - Memory committed from OS

#### Read-Only Space
- `verbose_read_only_space_used_kb`
- `verbose_read_only_space_avail_kb`
- `verbose_read_only_space_committed_kb`
- **Purpose**: Immutable objects (e.g., built-in objects, code)

#### New Space (Young Generation)
- `verbose_new_space_used_kb`
- `verbose_new_space_avail_kb`
- `verbose_new_space_committed_kb`
- **Purpose**: Recently allocated objects
- **GC**: Scavenge (minor GC)
- **Note**: Size controlled by `--max-semi-space-size`

#### New Large Object Space
- `verbose_new_large_object_space_used_kb`
- `verbose_new_large_object_space_avail_kb`
- `verbose_new_large_object_space_committed_kb`
- **Purpose**: Large objects allocated in new generation
- **Threshold**: Typically objects > 128KB

#### Old Space (Old Generation)
- `verbose_old_space_used_kb`
- `verbose_old_space_avail_kb`
- `verbose_old_space_committed_kb`
- **Purpose**: Long-lived objects
- **GC**: Mark-compact (major GC)
- **Note**: Size controlled by `--max-old-space-size`

#### Code Space
- `verbose_code_space_used_kb`
- `verbose_code_space_avail_kb`
- `verbose_code_space_committed_kb`
- **Purpose**: JIT-compiled code

#### Large Object Space
- `verbose_large_object_space_used_kb`
- `verbose_large_object_space_avail_kb`
- `verbose_large_object_space_committed_kb`
- **Purpose**: Large objects in old generation

#### Code Large Object Space
- `verbose_code_large_object_space_used_kb`
- `verbose_code_large_object_space_avail_kb`
- `verbose_code_large_object_space_committed_kb`
- **Purpose**: Large compiled code objects

#### Trusted Space
- `verbose_trusted_space_used_kb`
- `verbose_trusted_space_avail_kb`
- `verbose_trusted_space_committed_kb`
- **Purpose**: Trusted/sandbox-related objects (V8 sandbox feature)

#### Trusted Large Object Space
- `verbose_trusted_large_object_space_used_kb`
- `verbose_trusted_large_object_space_avail_kb`
- `verbose_trusted_large_object_space_committed_kb`
- **Purpose**: Large trusted objects

#### All Spaces Combined
- `verbose_all_spaces_used_kb`
- `verbose_all_spaces_avail_kb`
- `verbose_all_spaces_committed_kb`
- **Description**: Sum of all heap spaces

### External Memory

#### `verbose_external_memory_reported_kb`
- **Description**: Memory reported by external resources
- **Units**: KB
- **Examples**: Buffers, native objects

#### `verbose_backing_store_memory_kb`
- **Description**: Memory used for backing stores (ArrayBuffers, etc.)
- **Units**: KB

#### `verbose_external_memory_global_kb`
- **Description**: Global external memory accounting
- **Units**: KB

### Unmapper (Verbose)

#### `verbose_unmapper_chunks`
- **Description**: Number of memory chunks in unmapper queue
- **Units**: Count

#### `verbose_unmapper_committed_kb`
- **Description**: Memory committed by chunks waiting to be unmapped
- **Units**: KB

### Pool Buffering

#### `verbose_pool_chunks`
- **Description**: Number of memory chunks in pool buffer
- **Units**: Count

#### `verbose_pool_committed_kb`
- **Description**: Memory committed by pooled chunks
- **Units**: KB

### Cumulative GC Time

#### `verbose_total_gc_time_ms`
- **Description**: Cumulative time spent in GC since process start
- **Units**: Milliseconds
- **Interpretation**: Tracks total GC overhead over time

---

## System Memory Metrics

All system memory metrics are sampled every 1 second from `/proc/meminfo` and are in **kibibytes (KiB)** unless noted.

### System-Wide Memory

#### `mem_total_kib`
- **Description**: Total physical RAM
- **Source**: `/proc/meminfo` - `MemTotal`
- **Units**: KiB

#### `mem_free_kib`
- **Description**: Free physical memory
- **Source**: `/proc/meminfo` - `MemFree`
- **Units**: KiB

#### `mem_available_kib`
- **Description**: Memory available for new allocations (without swapping)
- **Source**: `/proc/meminfo` - `MemAvailable`
- **Units**: KiB
- **Interpretation**: Better indicator than `mem_free_kib` for available memory

#### `buffers_kib`
- **Description**: Memory used for file buffers
- **Source**: `/proc/meminfo` - `Buffers`
- **Units**: KiB

#### `cached_kib`
- **Description**: Memory used for page cache
- **Source**: `/proc/meminfo` - `Cached`
- **Units**: KiB

### Container Memory (cgroup)

#### `cgroup_limit_bytes`
- **Description**: Memory limit imposed by cgroup (container limit)
- **Source**: `/sys/fs/cgroup/memory/memory.limit_in_bytes`
- **Units**: Bytes
- **Note**: Relevant for Docker/Kubernetes environments

#### `cgroup_usage_bytes`
- **Description**: Current memory usage in cgroup
- **Source**: `/sys/fs/cgroup/memory/memory.usage_in_bytes`
- **Units**: Bytes

#### `cgroup_cache_bytes`
- **Description**: Page cache memory in cgroup
- **Source**: `/sys/fs/cgroup/memory/memory.stat` - `cache`
- **Units**: Bytes

---

## Process Memory Metrics

All process metrics are from `/proc/[PID]/status` and are in **kibibytes (KiB)**.

### Core Process Memory

#### `node_rss_kib`
- **Description**: Resident Set Size (physical memory used)
- **Source**: `/proc/[PID]/status` - `VmRSS`
- **Units**: KiB
- **Interpretation**: Actual RAM consumed by Node.js process

#### `node_size_kib`
- **Description**: Virtual memory size
- **Source**: `/proc/[PID]/status` - `VmSize`
- **Units**: KiB

#### `node_peak_kib`
- **Description**: Peak virtual memory usage
- **Source**: `/proc/[PID]/status` - `VmPeak`
- **Units**: KiB

#### `node_hwm_kib`
- **Description**: Peak RSS (high water mark)
- **Source**: `/proc/[PID]/status` - `VmHWM`
- **Units**: KiB

### RSS Breakdown

#### `node_rss_anon_kib`
- **Description**: Anonymous memory (heap, stack)
- **Source**: `/proc/[PID]/status` - `RssAnon`
- **Units**: KiB
- **Interpretation**: Primary memory usage for application data

#### `node_rss_file_kib`
- **Description**: File-backed memory (mapped files, libs)
- **Source**: `/proc/[PID]/status` - `RssFile`
- **Units**: KiB

#### `node_rss_shmem_kib`
- **Description**: Shared memory
- **Source**: `/proc/[PID]/status` - `RssShmem`
- **Units**: KiB

### Memory Segments

#### `node_data_kib`
- **Description**: Data segment size
- **Source**: `/proc/[PID]/status` - `VmData`
- **Units**: KiB

#### `node_stk_kib`
- **Description**: Stack size
- **Source**: `/proc/[PID]/status` - `VmStk`
- **Units**: KiB

#### `node_exe_kib`
- **Description**: Executable size
- **Source**: `/proc/[PID]/status` - `VmExe`
- **Units**: KiB

#### `node_lib_kib`
- **Description**: Shared library size
- **Source**: `/proc/[PID]/status` - `VmLib`
- **Units**: KiB

#### `node_pte_kib`
- **Description**: Page table entries size
- **Source**: `/proc/[PID]/status` - `VmPTE`
- **Units**: KiB

#### `node_swap_kib`
- **Description**: Swapped memory
- **Source**: `/proc/[PID]/status` - `VmSwap`
- **Units**: KiB
- **Interpretation**: Non-zero indicates memory pressure

#### `node_lck_kib`
- **Description**: Locked memory
- **Source**: `/proc/[PID]/status` - `VmLck`
- **Units**: KiB

### Process Resources

#### `node_threads`
- **Description**: Number of threads
- **Source**: `/proc/[PID]/status` - `Threads`
- **Units**: Count

#### `node_fds`
- **Description**: Number of open file descriptors
- **Source**: `ls /proc/[PID]/fd | wc -l`
- **Units**: Count

#### `node_fdsize`
- **Description**: File descriptor table size
- **Source**: `/proc/[PID]/status` - `FDSize`
- **Units**: Count

#### `node_state`
- **Description**: Process state
- **Source**: `/proc/[PID]/status` - `State`
- **Values**: `R` (running), `S` (sleeping), `D` (disk sleep), etc.

#### `node_tgid`
- **Description**: Thread group ID
- **Source**: `/proc/[PID]/status` - `Tgid`
- **Units**: Integer

### CPU Affinity

#### `node_cpus_allowed`
- **Description**: CPU affinity list (allowed CPUs)
- **Source**: `/proc/[PID]/status` - `Cpus_allowed_list`
- **Format**: Human-readable list (e.g., "2-3" or "0,2-3")

#### `node_mems_allowed`
- **Description**: NUMA memory node affinity list
- **Source**: `/proc/[PID]/status` - `Mems_allowed_list`
- **Format**: Human-readable list (e.g., "0" or "0-1")

### Context Switches

#### `node_ctxt_voluntary`
- **Description**: Voluntary context switches
- **Source**: `/proc/[PID]/status` - `voluntary_ctxt_switches`
- **Units**: Count
- **Interpretation**: Process yielded CPU

#### `node_ctxt_nonvoluntary`
- **Description**: Involuntary context switches
- **Source**: `/proc/[PID]/status` - `nonvoluntary_ctxt_switches`
- **Units**: Count
- **Interpretation**: Process preempted; high values indicate CPU contention

---

## System Performance Metrics

### Load Average

#### `load_avg_1min`
- **Description**: 1-minute load average
- **Source**: `/proc/loadavg`
- **Interpretation**: Average number of processes in run queue

#### `load_avg_5min`
- **Description**: 5-minute load average
- **Source**: `/proc/loadavg`

#### `load_avg_15min`
- **Description**: 15-minute load average
- **Source**: `/proc/loadavg`

#### `load_avg_1_5_15_semicolon`
- **Description**: Raw semicolon-separated load average values
- **Format**: "1min;5min;15min"
- **Note**: Parsed into separate columns above

### CPU Statistics

All CPU metrics are cumulative counters from `/proc/stat` in jiffies (typically 1/100th second).

#### `cpu_user`
- **Description**: Time in user mode
- **Units**: Jiffies

#### `cpu_nice`
- **Description**: Time in user mode with low priority
- **Units**: Jiffies

#### `cpu_system`
- **Description**: Time in kernel mode
- **Units**: Jiffies

#### `cpu_idle`
- **Description**: Time idle
- **Units**: Jiffies

#### `cpu_iowait`
- **Description**: Time waiting for I/O
- **Units**: Jiffies
- **Interpretation**: High values indicate I/O bottleneck

#### `cpu_irq`
- **Description**: Time servicing interrupts
- **Units**: Jiffies

#### `cpu_softirq`
- **Description**: Time servicing software interrupts
- **Units**: Jiffies

#### `cpu_steal`
- **Description**: Time stolen by hypervisor (VM only)
- **Units**: Jiffies
- **Interpretation**: High values indicate oversubscribed VM host

#### `cpu_user_nice_sys_idle_iowait_irq_softirq_steal_semicolon`
- **Description**: Raw semicolon-separated CPU values
- **Format**: "user;nice;system;idle;iowait;irq;softirq;steal"
- **Note**: Parsed into separate columns above

### System-Wide Counters

#### `ctxt_switches`
- **Description**: Total context switches (system-wide)
- **Source**: `/proc/stat` - `ctxt`
- **Units**: Count (cumulative)

#### `interrupts`
- **Description**: Total interrupts serviced
- **Source**: `/proc/stat` - `intr`
- **Units**: Count (cumulative)

### Monitoring Metadata

#### `monitored_node_pid`
- **Description**: PID being monitored
- **Units**: Integer
- **Purpose**: Tracking which process was monitored

### Container CPU Metrics (cgroup)

These metrics track container-specific CPU usage from cgroup v2 (`/sys/fs/cgroup/cpu.stat`).

#### Raw Cumulative Counters

#### `cgroup_cpu_usage_usec`
- **Description**: Cumulative CPU time used by the container
- **Units**: Microseconds
- **Source**: `/sys/fs/cgroup/cpu.stat` - `usage_usec`

#### `cgroup_cpu_user_usec`
- **Description**: Cumulative user-space CPU time
- **Units**: Microseconds
- **Source**: `/sys/fs/cgroup/cpu.stat` - `user_usec`

#### `cgroup_cpu_system_usec`
- **Description**: Cumulative kernel-space CPU time
- **Units**: Microseconds
- **Source**: `/sys/fs/cgroup/cpu.stat` - `system_usec`

#### Calculated Delta Metrics (Parser-Derived)

These are calculated by the parser from consecutive samples:

#### `interval_usec`
- **Description**: Wall-clock time between consecutive samples
- **Units**: Microseconds
- **Calculation**: `(wall_time[i] - wall_time[i-1]) * 1,000,000`

#### `cgroup_cpu_usage_delta_usec`
- **Description**: CPU time used during the interval
- **Units**: Microseconds
- **Calculation**: `cgroup_cpu_usage_usec[i] - cgroup_cpu_usage_usec[i-1]`

#### `cgroup_cpu_user_delta_usec`
- **Description**: User CPU time used during the interval
- **Units**: Microseconds
- **Calculation**: `cgroup_cpu_user_usec[i] - cgroup_cpu_user_usec[i-1]`

#### `cgroup_cpu_system_delta_usec`
- **Description**: System CPU time used during the interval
- **Units**: Microseconds
- **Calculation**: `cgroup_cpu_system_usec[i] - cgroup_cpu_system_usec[i-1]`

#### CPU Utilization Percentages (Parser-Derived)

#### `cgroup_cpu_utilization_pct`
- **Description**: Total CPU utilization percentage
- **Units**: Percentage (0-200% for 2 cores)
- **Calculation**: `(cgroup_cpu_usage_delta_usec / interval_usec) * 100`
- **Interpretation**: 100% = 1 fully utilized core, 200% = 2 fully utilized cores

#### `cgroup_cpu_user_pct`
- **Description**: User-space CPU utilization percentage
- **Units**: Percentage (0-200% for 2 cores)
- **Calculation**: `(cgroup_cpu_user_delta_usec / interval_usec) * 100`

#### `cgroup_cpu_system_pct`
- **Description**: Kernel-space CPU utilization percentage
- **Units**: Percentage (0-200% for 2 cores)
- **Calculation**: `(cgroup_cpu_system_delta_usec / interval_usec) * 100`

---

## Benchmark Results

### Per-Application Performance

Each JavaScript tool/application has a corresponding metric:

- `acorn_runs_per_sec` - Acorn parser
- `babel_runs_per_sec` - Babel transpiler
- `babel-minify_runs_per_sec` - Babel minifier
- `babylon_runs_per_sec` - Babylon parser
- `buble_runs_per_sec` - Bublé transpiler
- `chai_runs_per_sec` - Chai assertion library
- `coffeescript_runs_per_sec` - CoffeeScript compiler
- `espree_runs_per_sec` - Espree parser
- `esprima_runs_per_sec` - Esprima parser

**Units**: Iterations per second
**Interpretation**: Higher is better; measures throughput for each tool

### Aggregate Performance

#### `geometric_mean_runs_per_sec`
- **Description**: Geometric mean across all benchmark applications
- **Units**: Runs per second
- **Formula**: nth root of product of all individual runs/sec
- **Interpretation**: Overall benchmark score; higher is better
- **Note**: Geometric mean prevents any single fast benchmark from dominating the score

---

## Configuration & Metadata

### Time Reference

The dataset uses two different time reference systems depending on the data source:

**Memory monitoring samples** (`source = "memory"`):
- Have `wall_time` directly populated with the actual Unix timestamp
- Real datetime can be computed as: `pd.to_datetime(wall_time, unit='s')`

**GC event records** (`source = "gc"`):
- Have `wall_time = null` (not directly captured)
- Have `timestamp_ms` (milliseconds since process start) and `process_start_time`
- Real datetime must be computed as: `pd.to_datetime(process_start_time + timestamp_ms/1000, unit='s')`

#### `wall_time`
- **Type**: Float (nullable)
- **Description**: Unix timestamp when measurement was taken
- **Units**: Seconds since epoch (1970-01-01)
- **Source**: `date +%s.%N` (memory monitoring script)
- **Availability**: Only populated for memory samples (`source = "memory"`), null for GC events
- **Usage**: `pd.to_datetime(wall_time, unit='s')` → real datetime

#### `timestamp_ms`
- **Type**: Integer
- **Description**: Time elapsed since process start when the GC event occurred
- **Units**: Milliseconds
- **Source**: V8 GC trace output
- **Availability**: Populated for GC events (`source = "gc"`)
- **Usage**: Combine with `process_start_time` to get real datetime

#### `process_start_time`
- **Type**: Float
- **Description**: Unix timestamp when Node.js process started
- **Units**: Seconds since epoch
- **Source**: Recorded at benchmark start
- **Purpose**: Baseline for converting `timestamp_ms` to real datetime
- **Usage**: `pd.to_datetime(process_start_time + timestamp_ms/1000, unit='s')` → real datetime

#### `process_time_ms`
- **Description**: Process-relative time (derived from wall_time)
- **Units**: Milliseconds
- **Calculation**: `(wall_time - process_start_time) * 1000`
- **Availability**: Only for memory samples where `wall_time` is populated

#### Computing Real Datetime (Python Example)

```python
import pandas as pd

# For memory samples (source = "memory"):
# wall_time is directly available
memory_df['datetime'] = pd.to_datetime(memory_df['wall_time'], unit='s')

# For GC events (source = "gc"):
# wall_time is null, compute from process_start_time + timestamp_ms
gc_df['datetime'] = pd.to_datetime(
    gc_df['process_start_time'] + gc_df['timestamp_ms'] / 1000,
    unit='s'
)
```

This allows both CPU metrics (from memory monitoring) and GC metrics to be plotted on the same real-time axis for temporal correlation analysis.

### Test Configuration

#### `app_name`
- **Type**: String
- **Description**: Name of JavaScript application being benchmarked
- **Examples**: "acorn", "babel", "typescript"
- **Source**: Extracted from file path

#### `old_space_mib`
- **Type**: Integer
- **Description**: V8 old space size limit
- **Units**: MiB (mebibytes)
- **Flag**: `--max-old-space-size`
- **Range**: 32-2048 MiB in test matrix

#### `semi_space_mib`
- **Type**: Integer
- **Description**: V8 semi-space (new space / 2) size limit
- **Units**: MiB (mebibytes)
- **Flag**: `--max-semi-space-size`
- **Range**: 2-128 MiB in test matrix
- **Note**: Total new space = semi_space_mib * 2

#### `source_file`
- **Type**: String
- **Description**: Original log filename
- **Format**: "old{SIZE}_semi{SIZE}"
- **Example**: "old1280_semi64"

### Failure Tracking

#### `failed`
- **Type**: Boolean
- **Description**: Whether the benchmark run failed
- **Values**: `true` / `false`

#### `failure_type`
- **Type**: String (nullable)
- **Description**: Category of failure
- **Values**:
  - `OOM` - Out of memory
  - `CRASH` - Process crash
  - `NODE_ERROR` - Node.js error
  - `UNKNOWN_ERROR` - Unclassified error
  - `null` - No failure

#### `failure_reason`
- **Type**: String (nullable)
- **Description**: Detailed failure message
- **Examples**: "JavaScript heap out of memory", "Process aborted with core dump"

#### `oom_detected`
- **Type**: Boolean
- **Description**: Whether out-of-memory error was detected
- **Values**: `true` / `false`

#### `crash_detected`
- **Type**: Boolean
- **Description**: Whether process crash was detected
- **Values**: `true` / `false`

---

## Data Interpretation Guidelines

### Memory Pressure Indicators

High memory pressure can be identified by:
- High `promotion_ratio` (> 80%)
- Increasing `old_space_used_kb`
- Frequent mark-compact GCs (`gc_type = "mark-compact"`)
- Low `mem_available_kib` / `mem_total_kib` ratio
- Non-zero `node_swap_kib`

### GC Performance Issues

Poor GC performance manifests as:
- Long `pause_ms` (> 100ms for minor, > 1000ms for major)
- High GC frequency (short `mutator_ms`)
- Low `scavenge_throughput`
- High `incremental_steps_count` without completion

### Application Performance

Correlate these metrics:
- **Pause times** vs `*_runs_per_sec` (inverse relationship expected)
- **Memory allocation rate** (`allocated` / `mutator_ms`) vs performance
- **Promotion rate** vs major GC frequency
- **Heap configuration** (`old_space_mib`, `semi_space_mib`) vs `geometric_mean_runs_per_sec`

### Optimal Configurations

Look for:
- Minimal pause times
- Low promotion ratio (< 50%)
- Efficient memory usage (low `holes_size_after`)
- High benchmark throughput
- Stable heap size (minimal growth over time)

---

## Data Schema Summary

- **Total Columns**: ~210
- **GC Event Columns**: ~95 (timings + memory)
- **Verbose Heap Columns**: ~35
- **System/Process Memory Columns**: ~40
- **Performance Metrics**: ~10
- **Metadata Columns**: ~10
- **Failure Tracking**: ~5

**Record Types**:
- GC events: `source = "gc"`
- Memory samples: `source = "memory"` (1 Hz)

**Time Resolution**: Millisecond precision for GC events, 1-second granularity for memory samples

**Units Summary**:
- Timestamps: milliseconds
- GC metrics: milliseconds (time), bytes (memory)
- Verbose metrics: KB
- System metrics: KiB
- Configuration: MiB

---

## Version History

- **v1.3**: Basic NVP parsing with system memory
- **v1.4**: Enhanced memory metrics with RSS breakdown
- **v1.5**: Added `--trace-gc-verbose` support with per-space heap metrics
- **v1.6**: Node.js 20 LTS (V8 11.3) with enhanced memory monitoring
- **v1.7**: Node.js 22 LTS (V8 12.4) with cgroup v2 CPU stats and utilization metrics

## References

- [V8 GC Documentation](https://v8.dev/blog/trash-talk)
- [Node.js Memory Management](https://nodejs.org/api/cli.html#cli_max_old_space_size_size_in_megabytes)
- [Linux /proc Documentation](https://www.kernel.org/doc/Documentation/filesystems/proc.txt)