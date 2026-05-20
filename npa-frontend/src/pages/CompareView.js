import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import ComparePanel from "../components/ComparePanel";
import { apiFetch } from "../api/apiClient";

const CompareView = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const [apps, setApps] = useState([]);
  const [selectedApp, setSelectedApp] = useState("");
  const [configs, setConfigs] = useState(null);

  const [loadingApps, setLoadingApps] = useState(true);
  const [loadingConfigs, setLoadingConfigs] = useState(false);
  const [error, setError] = useState(null);

  const [leftRun, setLeftRun] = useState("");
  const [rightRun, setRightRun] = useState("");
  const [timeFilters, setTimeFilters] = useState({
    start_ts: "",
    end_ts: "",
  });

  // 1) Load applications
  useEffect(() => {
    const fetchApps = async () => {
      try {
        setLoadingApps(true);
        setError(null);

        // Backend: GET /api/apps/
        const data = await apiFetch("/apps");
        
        /** * ADJUSTMENT START 
         * The response now has a shape: { page, per_page, items: [...] }
         */
        const appsList = data && Array.isArray(data.items) ? data.items : [];
        /** ADJUSTMENT END **/

        setApps(appsList);

        // Extract app names from the objects
        const appNames = appsList.map(app => app.app_name);

        const urlApp = searchParams.get("app") || "";
        const initialApp =
          urlApp && appNames.includes(urlApp) ? urlApp : appNames[0] || "";

        setSelectedApp(initialApp);

        if (initialApp) {
          const next = new URLSearchParams(searchParams);
          next.set("app", initialApp);
          setSearchParams(next, { replace: true });
        }
      } catch (e) {
        console.error(e);
        setError(e.message || "Failed to load apps");
      } finally {
        setLoadingApps(false);
      }
    };

    fetchApps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2) Load configs for selected app
  useEffect(() => {
    if (!selectedApp) return;

    const fetchConfigs = async () => {
      try {
        setLoadingConfigs(true);
        setError(null);

        const params = new URLSearchParams();
        params.append("app_name", selectedApp);

        // Backend: GET /api/apps/configs
        const data = await apiFetch(`/apps/configs?${params.toString()}`);
        setConfigs(data);
      } catch (e) {
        console.error(e);
        setError(e.message || "Failed to load configs");
      } finally {
        setLoadingConfigs(false);
      }
    };

    fetchConfigs();
  }, [selectedApp]);

  // 3) Init runs + time range when configs arrive
  useEffect(() => {
    if (!configs) return;

    const runs = configs.runs || [];
    const runsAsString = runs.map((r) => String(r));

    const urlLeft = searchParams.get("leftRun");
    const urlRight = searchParams.get("rightRun");

    const left =
      urlLeft && runsAsString.includes(urlLeft)
        ? urlLeft
        : runsAsString[0] || "";
    const right =
      urlRight && runsAsString.includes(urlRight)
        ? urlRight
        : runsAsString[1] || left;

    setLeftRun(left);
    setRightRun(right);

    const tr = configs.time_range || {};
    setTimeFilters({
      start_ts:
        tr.start_ts !== undefined && tr.start_ts !== null
          ? String(tr.start_ts)
          : "",
      end_ts:
        tr.end_ts !== undefined && tr.end_ts !== null ? String(tr.end_ts) : "",
    });

    const next = new URLSearchParams(searchParams);
    if (left) next.set("leftRun", left);
    if (right) next.set("rightRun", right);
    if (selectedApp) next.set("app", selectedApp);
    setSearchParams(next, { replace: true });
  }, [configs, searchParams, selectedApp, setSearchParams]);

  const handleTimeFilterChange = (key, value) => {
    setTimeFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleAppChange = (value) => {
    setSelectedApp(value);
    const next = new URLSearchParams(searchParams);
    next.set("app", value);
    next.delete("leftRun");
    next.delete("rightRun");
    setSearchParams(next, { replace: true });
  };

  const handleLeftRunChange = (value) => {
    setLeftRun(value);
    const next = new URLSearchParams(searchParams);
    next.set("leftRun", value);
    setSearchParams(next, { replace: true });
  };

  const handleRightRunChange = (value) => {
    setRightRun(value);
    const next = new URLSearchParams(searchParams);
    next.set("rightRun", value);
    setSearchParams(next, { replace: true });
  };

  const runs = configs?.runs || [];

  return (
    <div className="p-6 min-h-screen">
      <div className="container max-w-7xl mx-auto">
        <h1
          className="text-2xl font-medium mb-2"
          style={{ color: "var(--text)" }}
        >
          Compare Configurations
        </h1>
        <p className="text-sm mb-4" style={{ color: "var(--muted)" }}>
          Choose an application and two runs. Metrics are aligned by time since
          run start.
        </p>

        {/* App + time-range controls */}
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <div>
            <span
              className="block text-xs uppercase tracking-wide mb-1"
              style={{ color: "var(--muted)" }}
            >
              Application
            </span>
            <select
              className="input text-sm"
              value={selectedApp}
              onChange={(e) => handleAppChange(e.target.value)}
              disabled={loadingApps || !apps.length}
            >
              {apps.map((app) => (
                <option key={app.app_name} value={app.app_name}>
                  {app.app_name}
                </option>
              ))}
            </select>
          </div>

          {configs?.time_range && (
            <div className="flex flex-wrap items-center gap-3 ml-auto">
              <span
                className="text-xs uppercase tracking-wide"
                style={{ color: "var(--muted)" }}
              >
                Time range (timestamp_ms)
              </span>
              <input
                type="number"
                placeholder="Start"
                value={timeFilters.start_ts}
                onChange={(e) =>
                  handleTimeFilterChange("start_ts", e.target.value)
                }
                className="input text-xs"
                style={{ width: "140px", padding: "0.35rem 0.6rem" }}
              />
              <input
                type="number"
                placeholder="End"
                value={timeFilters.end_ts}
                onChange={(e) =>
                  handleTimeFilterChange("end_ts", e.target.value)
                }
                className="input text-xs"
                style={{ width: "140px", padding: "0.35rem 0.6rem" }}
              />
            </div>
          )}
        </div>

        {error && (
          <div
            className="mb-4 text-sm rounded-lg px-3 py-2"
            style={{ background: "#2f1515", color: "#fecaca" }}
          >
            {error}
          </div>
        )}

        {loadingConfigs && (
          <div className="text-sm" style={{ color: "var(--muted)" }}>
            Loading configuration…
          </div>
        )}

        {!loadingConfigs && selectedApp && runs.length > 0 && (
          <ComparePanel
            appName={selectedApp}
            runs={runs}
            leftRun={leftRun}
            rightRun={rightRun}
            onLeftChange={handleLeftRunChange}
            onRightChange={handleRightRunChange}
            timeFilters={timeFilters}
          />
        )}

        {!loadingConfigs && selectedApp && runs.length === 0 && (
          <div className="text-sm" style={{ color: "var(--muted)" }}>
            No runs found for this application.
          </div>
        )}
      </div>
    </div>
  );
};

export default CompareView;