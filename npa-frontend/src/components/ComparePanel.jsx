import React, { useEffect, useMemo, useState } from "react";
import CustomLineChart from "./charts/CustomLineChart";
import { apiFetch } from "../api/apiClient";

const toNumberOrNull = (v) => {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const formatNumber = (n, digits = 1) => {
  if (n === null || n === undefined || !Number.isFinite(n)) return "-";
  return n.toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
};

const outerJoinGraphData = (list1, list2) => {
  const allTimes = new Set([
    ...list1.map((i) => i.time_s),
    ...list2.map((i) => i.time_s),
  ]);

  // 2. Convert to maps for easy lookup
  const map1 = new Map(list1.map((i) => [i.time_s, i.value]));
  const map2 = new Map(list2.map((i) => [i.time_s, i.value]));

  // 3. Build the final array
  const result = Array.from(allTimes)
    .map((time) => ({
      time_s: time,
      value1: map1.get(time) ?? null, // Default to null if missing
      value2: map2.get(time) ?? null,
    }))
    .sort((a, b) => a.time_s - b.time_s); // Optional: sort by time

  console.log("List1:", list1);
  console.log("List2:", list2);
  console.log("Outer join result:", result);
  return result;
};

const ComparePanel = ({
  appName,
  runs,
  leftRun,
  rightRun,
  onLeftChange,
  onRightChange,
  timeFilters,
}) => {

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [leftCpuRaw, setLeftCpuRaw] = useState([]);
  const [rightCpuRaw, setRightCpuRaw] = useState([]);
  const [leftMemRaw, setLeftMemRaw] = useState([]);
  const [rightMemRaw, setRightMemRaw] = useState([]);

  const [leftSummary, setLeftSummary] = useState({
    avgCpu: null,
    peakHeap: null,
    gcP95: null,
  });
  const [rightSummary, setRightSummary] = useState({
    avgCpu: null,
    peakHeap: null,
    gcP95: null,
  });

  const [combine_toggled, setCombineToggled] = useState(false);

  const buildParams = (runId) => {
    const params = new URLSearchParams();
    params.append("app_name", appName);
    params.append("run_id", String(runId));
    params.append("limit", "2000");

    const s = toNumberOrNull(timeFilters.start_ts);
    const e = toNumberOrNull(timeFilters.end_ts);
    if (s !== null) params.append("start_ts", String(s));
    if (e !== null) params.append("end_ts", String(e));

    return params.toString();
  };

  const fetchRunData = async (runId, signal) => {
    if (!runId) {
      return {
        cpu: [],
        mem: [],
        summary: { avgCpu: null, peakHeap: null, gcP95: null },
      };
    }

    const params = buildParams(runId);

    try {
      // 1. Fetch Metrics - Updated to handle paginated response { items: [], ... }
      const [cpuRes, memRes] = await Promise.all([
        apiFetch(`/metrics/cpu-usage?${params}`, signal),
        apiFetch(`/metrics/memory-usage?${params}`, signal),
      ]);

      /** ADJUSTMENT: Extract items from paginated response **/
      const cpuArr = cpuRes && Array.isArray(cpuRes.items) ? cpuRes.items : [];
      const memArr = memRes && Array.isArray(memRes.items) ? memRes.items : [];

      // 2. GC stats for this run
      let gcP95 = null;
      try {
        let startTs = toNumberOrNull(timeFilters.start_ts);
        let endTs = toNumberOrNull(timeFilters.end_ts);

        // Auto-detect time range from CPU data if not provided
        if ((startTs === null || endTs === null) && cpuArr.length) {
          const tsValues = cpuArr
            .map((d) => d.timestamp_ms)
            .filter((v) => Number.isFinite(v));
          if (tsValues.length) {
            startTs = startTs ?? Math.min(...tsValues);
            endTs = endTs ?? Math.max(...tsValues);
          }
        }

        if (startTs !== null && endTs !== null) {
          const gcParams = new URLSearchParams();
          gcParams.append("app_name", appName);
          gcParams.append("run_id", String(runId));
          gcParams.append("start_ts", String(startTs));
          gcParams.append("end_ts", String(endTs));
          gcParams.append("only_healthy", "true");

          const gcStats = await apiFetch(
            `/metrics/gc-stats?${gcParams.toString()}`,
            signal
          );
          
          // Note: If GC stats also becomes paginated, wrap this in .items check
          if (gcStats && gcStats.pause_ms && gcStats.pause_ms.p95 !== undefined) {
            gcP95 = gcStats.pause_ms.p95;
          }
        }
      } catch (e) {
        console.warn("Failed to load GC stats for run", runId, e);
      }

      // 3. Calculate Summary Metrics
      const avgCpu =
        cpuArr.length > 0
          ? cpuArr.reduce((sum, d) => sum + (d.cpu_percent || 0), 0) / cpuArr.length
          : null;

      const peakHeap =
        memArr.length > 0
          ? Math.max(
              ...memArr
                .map((d) => d.heap_used_mb)
                .filter((v) => v !== null && v !== undefined && Number.isFinite(Number(v)))
            )
          : null;

      return {
        cpu: cpuArr,
        mem: memArr,
        summary: { avgCpu, peakHeap, gcP95 },
      };
    } catch (err) {
      throw err;
    }
  };

  // Fetch both runs whenever selection/time filters change
  useEffect(() => {
    if (!appName || !leftRun || !rightRun) return;

    const controller = new AbortController();
    const { signal } = controller;

    const run = async () => {
      try {
        setLoading(true);
        setError(null);

        const [left, right] = await Promise.all([
          fetchRunData(leftRun, signal),
          fetchRunData(rightRun, signal),
        ]);

        setLeftCpuRaw(left.cpu);
        setLeftMemRaw(left.mem);
        setLeftSummary(left.summary);

        setRightCpuRaw(right.cpu);
        setRightMemRaw(right.mem);
        setRightSummary(right.summary);
      } catch (e) {
        if (e.name === "AbortError") return;
        console.error(e);
        setError(e.message || "Failed to load comparison data");
      } finally {
        setLoading(false);
      }
    };

    run();
    return () => controller.abort();
  }, [
    appName,
    leftRun,
    rightRun,
    timeFilters.start_ts,
    timeFilters.end_ts,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ]);

  const { leftCpuSeries, rightCpuSeries, leftMemSeries, rightMemSeries } =
    useMemo(() => {
      const buildRelSeries = (arr, valueKey) => {
        if (!arr || !arr.length) return [];
        const tsValues = arr
          .map((d) => d.timestamp_ms)
          .filter((v) => Number.isFinite(v));
        if (!tsValues.length) return [];
        const minTs = Math.min(...tsValues);

        return arr
          .map((d) => {
            const ts = d.timestamp_ms;
            if (!Number.isFinite(ts)) return null;
            const relMs = ts - minTs;
            const rawVal = d[valueKey];
            const numVal = Number(rawVal);
            return {
              time_s: relMs / 1000,
              value: Number.isFinite(numVal) ? numVal : null,
            };
          })
          .filter(Boolean);
      };

      const leftCpu = buildRelSeries(leftCpuRaw, "cpu_percent");
      const rightCpu = buildRelSeries(rightCpuRaw, "cpu_percent");
      const leftMem = buildRelSeries(leftMemRaw, "heap_used_mb");
      const rightMem = buildRelSeries(rightMemRaw, "heap_used_mb");

      return {
        leftCpuSeries: leftCpu,
        rightCpuSeries: rightCpu,
        leftMemSeries: leftMem,
        rightMemSeries: rightMem,
      };
    }, [leftCpuRaw, rightCpuRaw, leftMemRaw, rightMemRaw]);

  const runsAsString = runs.map((r) => String(r));

  return (
    <div className="card" style={{ padding: "1.5rem", minWidth: 0 }}>
      {/* Selectors + summary */}
      <div className="flex flex-wrap items-start justify-between mb-6 gap-4">
        <div className="flex flex-col gap-2">
          <span
            className="text-xs uppercase tracking-wide"
            style={{ color: "var(--muted)" }}
          >
            Left run
          </span>
          <select
            className="input text-sm"
            value={leftRun}
            onChange={(e) => onLeftChange(e.target.value)}
          >
            {runsAsString.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <span
            className="text-xs uppercase tracking-wide"
            style={{ color: "var(--muted)" }}
          >
            Right run
          </span>
          <select
            className="input text-sm"
            value={rightRun}
            onChange={(e) => onRightChange(e.target.value)}
          >
            {runsAsString.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </div>

        <label className="inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={combine_toggled}
            onChange={() => setCombineToggled(!combine_toggled)}
          />
          <div
            className="
        relative w-11 h-6 bg-gray-200 
        peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 
        rounded-full peer 
        peer-checked:after:translate-x-full 
        peer-checked:after:border-white 
        after:content-[''] 
        after:absolute after:top-[2px] after:left-[2px] 
        after:bg-white after:border-gray-300 after:border after:rounded-full 
        after:h-5 after:w-5 
        after:transition-all 
        peer-checked:bg-accent"
          ></div>

          <span className="ml-3 text-sm font-medium var(--muted)">
            {combine_toggled ? "Combined" : "Split"}
          </span>
        </label>

        <div className="flex flex-wrap gap-4 ml-auto">
          <div
            className="px-4 py-2 rounded-lg border"
            style={{ borderColor: "var(--border)" }}
          >
            <div
              className="text-xs uppercase tracking-wide mb-1"
              style={{ color: "var(--muted)" }}
            >
              Avg CPU
            </div>
            <div className="text-sm" style={{ color: "var(--text)" }}>
              {formatNumber(leftSummary.avgCpu)}% →{" "}
              {formatNumber(rightSummary.avgCpu)}%
            </div>
          </div>
          <div
            className="px-4 py-2 rounded-lg border"
            style={{ borderColor: "var(--border)" }}
          >
            <div
              className="text-xs uppercase tracking-wide mb-1"
              style={{ color: "var(--muted)" }}
            >
              95p GC Pause
            </div>
            <div className="text-sm" style={{ color: "var(--text)" }}>
              {formatNumber(leftSummary.gcP95)} ms →{" "}
              {formatNumber(rightSummary.gcP95)} ms
            </div>
          </div>
          <div
            className="px-4 py-2 rounded-lg border"
            style={{ borderColor: "var(--border)" }}
          >
            <div
              className="text-xs uppercase tracking-wide mb-1"
              style={{ color: "var(--muted)" }}
            >
              Peak heap_used
            </div>
            <div className="text-sm" style={{ color: "var(--text)" }}>
              {formatNumber(leftSummary.peakHeap)} MB →{" "}
              {formatNumber(rightSummary.peakHeap)} MB
            </div>
          </div>
        </div>
      </div>

      {loading && (
        <div className="text-sm mb-4" style={{ color: "var(--muted)" }}>
          Loading metrics…
        </div>
      )}
      {error && (
        <div
          className="mb-4 text-sm rounded-lg px-3 py-2"
          style={{ background: "#2f1515", color: "#fecaca" }}
        >
          {error}
        </div>
      )}

      {/* CPU charts  */}
      <div className="mb-8" style={{ minWidth: 0 }}>
        <h3
          className="text-md font-semibold mb-2"
          style={{ color: "var(--text)" }}
        >
          CPU Utilization
        </h3>
        <p className="text-xs mb-3" style={{ color: "var(--muted)" }}>
          CPU percent over time (aligned by seconds since run start).
        </p>

        {combine_toggled ? (
          <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
            {/* Combined CPU chart */}
            <CustomLineChart
              data={outerJoinGraphData(leftCpuSeries, rightCpuSeries)}
              xKey="time_s"
              xAxisLabel={`Time since run start – run ${leftRun} and ${rightRun}`}
              yAxisLabels={{ left: "CPU %" }}
              yAxes={[
                {
                  key: "value1",
                  name: `CPU % (run ${leftRun})`,
                  color: "#60a5fa",
                  yAxisId: "left",
                },
                {
                  key: "value2",
                  name: `CPU % (run ${rightRun})`,
                  color: "#f97316",
                  yAxisId: "right",
                },
              ]}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left run CPU */}
            <div style={{ width: "100%", height: 320 }}>
              <CustomLineChart
                data={leftCpuSeries}
                xKey="time_s"
                xAxisLabel={`Time since run start – run ${leftRun}`}
                yAxisLabels={{ left: "CPU %" }}
                yAxes={[
                  {
                    key: "value",
                    name: `CPU % (run ${leftRun})`,
                    color: "#60a5fa",
                    yAxisId: "left",
                  },
                ]}
              />
            </div>
            {/* Right run CPU */}
            <div style={{ width: "100%", height: 320 }}>
              <CustomLineChart
                data={rightCpuSeries}
                xKey="time_s"
                xAxisLabel={`Time since run start – run ${rightRun}`}
                yAxisLabels={{ left: "CPU %" }}
                yAxes={[
                  {
                    key: "value",
                    name: `CPU % (run ${rightRun})`,
                    color: "#f97316",
                    yAxisId: "left",
                  },
                ]}
              />
            </div>
          </div>
        )}
      </div>

      {/* Memory charts */}
      <div style={{ minWidth: 0 }}>
        <h3
          className="text-md font-semibold mb-2"
          style={{ color: "var(--text)" }}
        >
          Memory (heap_used)
        </h3>
        <p className="text-xs mb-3" style={{ color: "var(--muted)" }}>
          Heap used in MB over time (aligned by seconds since run start).
        </p>

        {combine_toggled ? (
          <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
            {/* Left run Memory */}
            <div style={{ width: "100%", height: 320 }}>
              <CustomLineChart
                data={outerJoinGraphData(leftMemSeries, rightMemSeries)}
                xKey="time_s"
                xAxisLabel={`Time since run start – run ${leftRun} and ${rightRun}`}
                yAxisLabels={{ left: "Heap used (MB)" }}
                yAxes={[
                  {
                    key: "value1",
                    name: `heap_used (run ${leftRun})`,
                    color: "#6366f1",
                    yAxisId: "left",
                  },
                  {
                    key: "value2",
                    name: `heap_used (run ${rightRun})`,
                    color: "#f97316",
                    yAxisId: "right",
                  },
                ]}
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left run Memory */}
            <div style={{ width: "100%", height: 320 }}>
              <CustomLineChart
                data={leftMemSeries}
                xKey="time_s"
                xAxisLabel={`Time since run start – run ${leftRun}`}
                yAxisLabels={{ left: "Heap used (MB)" }}
                yAxes={[
                  {
                    key: "value",
                    name: `heap_used (run ${leftRun})`,
                    color: "#6366f1",
                    yAxisId: "left",
                  },
                ]}
              />
            </div>

            {/* Right run Memory */}
            <div style={{ width: "100%", height: 320 }}>
              <CustomLineChart
                data={rightMemSeries}
                xKey="time_s"
                xAxisLabel={`Time since run start – run ${rightRun}`}
                yAxisLabels={{ left: "Heap used (MB)" }}
                yAxes={[
                  {
                    key: "value",
                    name: `heap_used (run ${rightRun})`,
                    color: "#f97316",
                    yAxisId: "left",
                  },
                ]}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ComparePanel;
