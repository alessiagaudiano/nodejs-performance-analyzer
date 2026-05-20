import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import CorrelationGraph from '../components/CorrelationGraph';
import { apiFetch } from '../api/apiClient';

const Correlations = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const [apps, setApps] = useState([]);
  const [selectedApp, setSelectedApp] = useState("");
  const [configs, setConfigs] = useState(null);
  const [correlationData, setCorrelationData] = useState([]);

  const [loadingApps, setLoadingApps] = useState(true);
  const [loadingConfigs, setLoadingConfigs] = useState(false);
  const [loadingCorrelations, setLoadingCorrelations] = useState(false);
  const [error, setError] = useState(null);

  const [timeFilters, setTimeFilters] = useState({
    start_ts: "",
    end_ts: "",
  });

  const [queryParams, setQueryParams] = useState({
    failed: false,
    crash_detected: false,
    oom_detected: false,
    cpu_active_min: "",
    heap_bin_mb: "",
    runs_metric: "",
    run_id: "",
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

  // 3) Init time range when configs arrive
  useEffect(() => {
    if (!configs) return;

    const tr = configs.time_range || {};
    setTimeFilters({
      start_ts:
        tr.start_ts !== undefined && tr.start_ts !== null
          ? String(tr.start_ts)
          : "",
      end_ts:
        tr.end_ts !== undefined && tr.end_ts !== null ? String(tr.end_ts) : "",
    });
  }, [configs]);

  // 4) Fetch correlations when app and time filters are ready
  useEffect(() => {
    if (!selectedApp || !timeFilters.start_ts || !timeFilters.end_ts) return;

    const fetchCorrelations = async () => {
      try {
        setLoadingCorrelations(true);
        setError(null);

        const params = new URLSearchParams();
        params.append("app_name", selectedApp);
        params.append("start_ts", timeFilters.start_ts);
        params.append("end_ts", timeFilters.end_ts);
        params.append("failed", queryParams.failed);
        params.append("crash_detected", queryParams.crash_detected);
        params.append("oom_detected", queryParams.oom_detected);
        
        if (queryParams.cpu_active_min) {
          params.append("cpu_active_min", queryParams.cpu_active_min);
        }
        if (queryParams.heap_bin_mb) {
          params.append("heap_bin_mb", queryParams.heap_bin_mb);
        }
        if (queryParams.runs_metric) {
          params.append("runs_metric", queryParams.runs_metric);
        }
        if (queryParams.run_id) {
          params.append("run_id", queryParams.run_id);
        }

        const data = await apiFetch(`/metrics/correlations?${params.toString()}`);
        setCorrelationData(data || []);
      } catch (e) {
        console.error(e);
        setError(e.message || "Failed to fetch correlation data");
      } finally {
        setLoadingCorrelations(false);
      }
    };

    fetchCorrelations();
  }, [selectedApp, timeFilters.start_ts, timeFilters.end_ts, queryParams]);

  const handleAppChange = (value) => {
    setSelectedApp(value);
    const next = new URLSearchParams(searchParams);
    next.set("app", value);
    setSearchParams(next, { replace: true });
  };

  const handleQueryParamChange = (key, value) => {
    setQueryParams((prev) => ({ ...prev, [key]: value }));
  };

  const handleTimeFilterChange = (key, value) => {
    setTimeFilters((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="p-6 min-h-screen">
      <div className="container">
        <h1 className="text-2xl font-medium mb-3" style={{ color: 'var(--text)' }}>
          Metric Correlations
        </h1>

        {/* App Selection */}
        <div className="flex gap-3 items-center mb-3">
          <label style={{ color: 'var(--muted)' }}>App</label>
          <select
            value={selectedApp}
            onChange={(e) => handleAppChange(e.target.value)}
            className="select"
            aria-label="Select app"
            disabled={loadingApps}
          >
            {apps.map((app) => (
              <option key={app.app_name} value={app.app_name}>
                {app.app_name}
              </option>
            ))}
          </select>
        </div>

        {/* Query Parameters */}
        {selectedApp && (
          <div className="card mb-3">
            <h2 className="text-lg font-medium mb-3" style={{ color: 'var(--text)' }}>
              Query Parameters
            </h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              {/* Time Filters */}
              <div>
                <label style={{ display: 'block', color: 'var(--muted)', fontSize: '13px', marginBottom: '6px' }}>
                  Start TS <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={timeFilters.start_ts}
                  onChange={(e) => handleTimeFilterChange('start_ts', e.target.value)}
                  placeholder="1"
                  className="select"
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--muted)', fontSize: '13px', marginBottom: '6px' }}>
                  End TS <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={timeFilters.end_ts}
                  onChange={(e) => handleTimeFilterChange('end_ts', e.target.value)}
                  placeholder="1000000000000000"
                  className="select"
                  style={{ width: '100%' }}
                />
              </div>

              {/* Optional Parameters */}
              <div>
                <label style={{ display: 'block', color: 'var(--muted)', fontSize: '13px', marginBottom: '6px' }}>
                  CPU Active Min
                </label>
                <input
                  type="text"
                  value={queryParams.cpu_active_min}
                  onChange={(e) => handleQueryParamChange('cpu_active_min', e.target.value)}
                  placeholder="Optional"
                  className="select"
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--muted)', fontSize: '13px', marginBottom: '6px' }}>
                  Heap Bin MB
                </label>
                <input
                  type="text"
                  value={queryParams.heap_bin_mb}
                  onChange={(e) => handleQueryParamChange('heap_bin_mb', e.target.value)}
                  placeholder="Optional"
                  className="select"
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--muted)', fontSize: '13px', marginBottom: '6px' }}>
                  Runs Metric
                </label>
                <input
                  type="text"
                  value={queryParams.runs_metric}
                  onChange={(e) => handleQueryParamChange('runs_metric', e.target.value)}
                  placeholder="Optional"
                  className="select"
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--muted)', fontSize: '13px', marginBottom: '6px' }}>
                  Run ID
                </label>
                <input
                  type="text"
                  value={queryParams.run_id}
                  onChange={(e) => handleQueryParamChange('run_id', e.target.value)}
                  placeholder="Optional"
                  className="select"
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--muted)', fontSize: '13px', marginBottom: '6px' }}>
                  Failed
                </label>
                <select
                  value={queryParams.failed}
                  onChange={(e) => handleQueryParamChange('failed', e.target.value === 'true')}
                  className="select"
                  style={{ width: '100%' }}
                >
                  <option value="false">False</option>
                  <option value="true">True</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', color: 'var(--muted)', fontSize: '13px', marginBottom: '6px' }}>
                  OOM Detected
                </label>
                <select
                  value={queryParams.oom_detected}
                  onChange={(e) => handleQueryParamChange('oom_detected', e.target.value === 'true')}
                  className="select"
                  style={{ width: '100%' }}
                >
                  <option value="false">False</option>
                  <option value="true">True</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', color: 'var(--muted)', fontSize: '13px', marginBottom: '6px' }}>
                  Crash Detected
                </label>
                <select
                  value={queryParams.crash_detected}
                  onChange={(e) => handleQueryParamChange('crash_detected', e.target.value === 'true')}
                  className="select"
                  style={{ width: '100%' }}
                >
                  <option value="false">False</option>
                  <option value="true">True</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Parameters Display */}
        {selectedApp && timeFilters.start_ts && timeFilters.end_ts && (
          <div className="card mb-3">
            <h3 className="text-sm font-medium mb-2" style={{ color: 'var(--muted)' }}>
              Current Query
            </h3>
            <div className="flex gap-6 flex-wrap" style={{ padding: '12px 0' }}>
              <div>
                <span style={{ color: 'var(--muted)', fontSize: '13px' }}>App: </span>
                <span style={{ color: 'var(--text)', fontSize: '14px', fontWeight: '500' }}>
                  {selectedApp}
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--muted)', fontSize: '13px' }}>Start: </span>
                <span style={{ color: 'var(--text)', fontSize: '14px', fontWeight: '500' }}>
                  {timeFilters.start_ts}
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--muted)', fontSize: '13px' }}>End: </span>
                <span style={{ color: 'var(--text)', fontSize: '14px', fontWeight: '500' }}>
                  {timeFilters.end_ts}
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--muted)', fontSize: '13px' }}>Failed: </span>
                <span style={{ color: 'var(--text)', fontSize: '14px', fontWeight: '500' }}>
                  {queryParams.failed ? 'true' : 'false'}
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--muted)', fontSize: '13px' }}>OOM Detected: </span>
                <span style={{ color: 'var(--text)', fontSize: '14px', fontWeight: '500' }}>
                  {queryParams.oom_detected ? 'true' : 'false'}
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--muted)', fontSize: '13px' }}>Crash Detected: </span>
                <span style={{ color: 'var(--text)', fontSize: '14px', fontWeight: '500' }}>
                  {queryParams.crash_detected ? 'true' : 'false'}
                </span>
              </div>
              {queryParams.cpu_active_min && (
                <div>
                  <span style={{ color: 'var(--muted)', fontSize: '13px' }}>CPU Active Min: </span>
                  <span style={{ color: 'var(--text)', fontSize: '14px', fontWeight: '500' }}>
                    {queryParams.cpu_active_min}
                  </span>
                </div>
              )}
              {queryParams.heap_bin_mb && (
                <div>
                  <span style={{ color: 'var(--muted)', fontSize: '13px' }}>Heap Bin MB: </span>
                  <span style={{ color: 'var(--text)', fontSize: '14px', fontWeight: '500' }}>
                    {queryParams.heap_bin_mb}
                  </span>
                </div>
              )}
              {queryParams.runs_metric && (
                <div>
                  <span style={{ color: 'var(--muted)', fontSize: '13px' }}>Runs Metric: </span>
                  <span style={{ color: 'var(--text)', fontSize: '14px', fontWeight: '500' }}>
                    {queryParams.runs_metric}
                  </span>
                </div>
              )}
              {queryParams.run_id && (
                <div>
                  <span style={{ color: 'var(--muted)', fontSize: '13px' }}>Run ID: </span>
                  <span style={{ color: 'var(--text)', fontSize: '14px', fontWeight: '500' }}>
                    {queryParams.run_id}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Loading State */}
        {(loadingApps || loadingConfigs || loadingCorrelations) && (
          <div className="card">
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
              {loadingApps
                ? "Loading applications..."
                : loadingConfigs
                ? "Loading configurations..."
                : "Loading correlation data..."}
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !loadingApps && !loadingConfigs && !loadingCorrelations && (
          <div className="card mb-3" style={{ 
            backgroundColor: 'var(--error-bg, #7f1d1d)', 
            borderColor: 'var(--error-border, #991b1b)' 
          }}>
            <div style={{ padding: '12px', color: 'var(--error-text, #fca5a5)' }}>
              {error}
            </div>
          </div>
        )}

        {/* Correlation Graph */}
        {!loadingApps && !loadingConfigs && !loadingCorrelations && !error && selectedApp && (
          <div className="card">
            <CorrelationGraph data={correlationData} />
            
            {/* Correlation Table */}
            {correlationData.length > 0 && (
              <div style={{ marginTop: '24px', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th style={{ 
                        padding: '12px', 
                        textAlign: 'left', 
                        color: 'var(--muted)', 
                        fontSize: '13px', 
                        fontWeight: '500' 
                      }}>
                        X Variable
                      </th>
                      <th style={{ 
                        padding: '12px', 
                        textAlign: 'left', 
                        color: 'var(--muted)', 
                        fontSize: '13px', 
                        fontWeight: '500' 
                      }}>
                        Y Variable
                      </th>
                      <th style={{ 
                        padding: '12px', 
                        textAlign: 'right', 
                        color: 'var(--muted)', 
                        fontSize: '13px', 
                        fontWeight: '500' 
                      }}>
                        Pearson Correlation
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {correlationData.map((item, index) => (
                      <tr key={index} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ 
                          padding: '12px', 
                          color: 'var(--text)', 
                          fontSize: '14px' 
                        }}>
                          {item.x}
                        </td>
                        <td style={{ 
                          padding: '12px', 
                          color: 'var(--text)', 
                          fontSize: '14px' 
                        }}>
                          {item.y}
                        </td>
                        <td style={{ 
                          padding: '12px', 
                          textAlign: 'right', 
                          color: item.pearson === null ? 'var(--muted)' : 'var(--text)',
                          fontSize: '14px',
                          fontWeight: '500'
                        }}>
                          {item.pearson === null ? 'null' : item.pearson.toFixed(4)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Correlations;