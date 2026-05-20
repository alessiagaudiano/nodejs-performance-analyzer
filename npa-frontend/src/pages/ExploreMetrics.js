import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSelection } from '../state/SelectionContext';

import CustomLineChart from '../components/charts/CustomLineChart';
import CustomStackedAreaChart from '../components/charts/CustomStackedAreaChart';
import CustomStackedBarChart from '../components/charts/CustomStackedBarChart';
import Button from '../components/Button';

import useMetricsData from '../hooks/useMetricsData';

const emptyFilter = { start_ts: '', end_ts: '' };

const ExploreMetrics = () => {
  const navigate = useNavigate();
  const { appId, runId } = useParams();
  const dashboardRef = useRef(null);

  const { selectedConfig, setSelectedApp, setSelectedRun } = useSelection();

  /* ------------------ Init ------------------ */
  useEffect(() => {
    if (!appId) {
      navigate('/apps');
      return;
    }
    setSelectedApp(appId);
    if (runId) setSelectedRun(runId);
  }, [appId, runId, navigate, setSelectedApp, setSelectedRun]);

  /* ------------------ Stable params builder ------------------ */
  const buildCommonParams = useCallback(
    (extra = {}) => {
      const params = new URLSearchParams();
      params.append('app_name', appId);
      params.append('limit', '100');
      params.append('page', extra.page || '1');

      // API expects failed, crash_detected, oom_detected boolean flags
      params.append('failed', String(selectedConfig?.failed === true ? true : false));
      params.append('crash_detected', String(selectedConfig?.crashDetected === true ? true : false));
      params.append('oom_detected', String(selectedConfig?.oomDetected === true ? true : false));

      if (selectedConfig?.heapCapacity)
        params.append('heap_bin_mb', selectedConfig.heapCapacity);
      if (selectedConfig?.cpuActiveMin)
        params.append('cpu_active_min', selectedConfig.cpuActiveMin);
      if (selectedConfig?.selectedRun)
        params.append('run_id', selectedConfig.selectedRun);

      // Add start_ts and end_ts from filters
      if (extra.start_ts) {
        params.append('start_ts', extra.start_ts);
      }
      if (extra.end_ts) {
        params.append('end_ts', extra.end_ts);
      }

      // Add any other extra params (excluding start_ts, end_ts, and page which we already handled)
      Object.entries(extra).forEach(([k, v]) => {
        if (v && k !== 'page' && k !== 'start_ts' && k !== 'end_ts') {
          params.append(k, v);
        }
      });

      return params.toString();
    },
    [appId, selectedConfig]
  );

  /* ------------------ Filters - SEPARATE FILTERS FOR EACH CHART ------------------ */
  const [timeSeriesFilters, setTimeSeriesFilters] = useState(emptyFilter);
  const [cpuFilters, setCpuFilters] = useState(emptyFilter);
  const [cpuBreakdownFilters, setCpuBreakdownFilters] = useState(emptyFilter);
  const [memoryFilters, setMemoryFilters] = useState(emptyFilter);
  const [heapFilters, setHeapFilters] = useState(emptyFilter);
  const [gcFilters, setGcFilters] = useState(emptyFilter);

  /* ------------------ Data hooks ------------------ */
  const { data: timeSeriesResponse, loading: timeSeriesLoading } = useMetricsData({
    endpoint: '/metrics/time-series',
    appId,
    paramsBuilder: buildCommonParams,
    filters: timeSeriesFilters,
  });

  const { data: cpuResponse, loading: cpuLoading } = useMetricsData({
    endpoint: '/metrics/cpu-usage',
    appId,
    paramsBuilder: buildCommonParams,
    filters: cpuFilters,
  });

  const { data: cpuBreakdownResponse, loading: cpuBreakdownLoading } = useMetricsData({
    endpoint: '/metrics/cpu-usage',
    appId,
    paramsBuilder: buildCommonParams,
    filters: cpuBreakdownFilters,
  });

  const { data: memoryResponse, loading: memoryLoading } = useMetricsData({
    endpoint: '/metrics/memory-usage',
    appId,
    paramsBuilder: buildCommonParams,
    filters: memoryFilters,
  });

  const { data: heapResponse, loading: heapLoading } = useMetricsData({
    endpoint: '/metrics/heap-spaces',
    appId,
    paramsBuilder: buildCommonParams,
    filters: heapFilters,
  });

  const { data: gcResponse, loading: gcLoading } = useMetricsData({
    endpoint: '/metrics/gc-pauses',
    appId,
    paramsBuilder: buildCommonParams,
    filters: gcFilters,
  });

  // Extract items from paginated responses with safer fallback
  const timeSeries = Array.isArray(timeSeriesResponse?.items) ? timeSeriesResponse.items : [];
  const cpu = Array.isArray(cpuResponse?.items) ? cpuResponse.items : [];
  const cpuBreakdown = Array.isArray(cpuBreakdownResponse?.items) ? cpuBreakdownResponse.items : [];
  const memory = Array.isArray(memoryResponse?.items) ? memoryResponse.items : [];
  const heap = Array.isArray(heapResponse?.items) ? heapResponse.items : [];
  const gc = Array.isArray(gcResponse?.items) ? gcResponse.items : [];

  // Better GC type detection
  const chartData = useMemo(() => {
    console.log('GC Data for chart:', gc);
    
    return gc.map(item => {
      const type = item.gc_type?.toLowerCase() || '';
      
      console.log('GC Type:', type, 'Pause:', item.pause_ms);
      
      // More comprehensive type detection
      const isMinor = type.includes('s') || 
                     type.includes('minor') || 
                     type.includes('scavenge') ||
                     type === 's';
                     
      const isMajor = type.includes('mc') || 
                     type.includes('major') || 
                     type.includes('mark-compact') ||
                     type.includes('mark') ||
                     type === 'mc';
      
      return {
        ...item,
        minor_pause: isMinor ? item.pause_ms : 0,
        major_pause: isMajor ? item.pause_ms : 0,
        displayTime: item.timestamp_ms,
        gc_type_debug: type
      };
    });
  }, [gc]);

  const isAnyLoading =
    timeSeriesLoading ||
    cpuLoading ||
    cpuBreakdownLoading ||
    memoryLoading ||
    heapLoading ||
    gcLoading;

  const cpuBreakdownData = useMemo(() => cpuBreakdown.map(item => ({
    timestamp_ms: item.timestamp_ms,
    system: +(item.cpu_system / 1_000).toFixed(2), 
    iowait: +(item.cpu_iowait / 1_000).toFixed(2),
  })), [cpuBreakdown]);

  /* ------------------ UI ------------------ */
  return (
    <div className="p-6 min-h-screen" style={{ backgroundColor: 'var(--background)' }}>
      <div className="container max-w-7xl mx-auto" ref={dashboardRef}>

        {/* Header */}
        <div className="relative flex items-center justify-center mb-8">
          <Button
            variant="back"
            size="md"
            className="absolute left-0"
            onClick={() => navigate(`/apps/${appId}/run/${runId}/issues`)}
          >
            ← Back
          </Button>

          <div className="text-center">
            <h1 className="text-3xl font-semibold">Performance Metrics</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
              Interactive performance analysis for{' '}
              <span style={{ color: 'var(--accent)' }}>{appId}</span>
            </p>
          </div>
        </div>

        {isAnyLoading && (
          <div className="mb-4 px-4 py-2 rounded"
               style={{ backgroundColor: 'rgba(59,130,246,.1)', color: 'var(--accent)' }}>
            🔄 Updating data…
          </div>
        )}

        <div className="grid grid-cols-1 gap-6">

          <MetricCard
            title="CPU Usage"
            subtitle="Overall CPU utilization"
            filters={cpuFilters}
            onFilterChange={setCpuFilters}
          >
            <CustomLineChart
              data={cpu}
              xKey="timestamp_ms"
              xAxisLabel="Timestamp (ms)"
              yAxisLabels={{ left: 'CPU %' }}
              yAxes={[
                { key: 'cpu_percent', name: 'CPU Usage', color: '#ef4444' },
              ]}
              itemsPerPage={20}
            />
          </MetricCard>

          <MetricCard 
            title="CPU Time Breakdown" 
            subtitle="System vs. I/O Wait"
            filters={cpuBreakdownFilters}
            onFilterChange={setCpuBreakdownFilters}
          >
            <CustomStackedAreaChart
              data={cpuBreakdownData}
              xKey="timestamp_ms"
              xAxisLabel="Timestamp (ms)"
              yAxisLabel="CPU Time (ms)"
              yAreas={[
                { key: 'system', name: 'System', color: '#10b981' },
                { key: 'iowait', name: 'I/O Wait', color: '#f59e0b' },
              ]}
              itemsPerPage={20}
            />
          </MetricCard>

          <MetricCard
            title="Memory Usage"
            subtitle="Heap & RSS"
            filters={memoryFilters}
            onFilterChange={setMemoryFilters}
          >
            <CustomLineChart
              data={memory}
              xKey="timestamp_ms"
              xAxisLabel="Timestamp (ms)"
              yAxisLabels={{ left: 'Memory (MB)' }}
              yAxes={[
                { key: 'heap_used_mb', name: 'Heap Used', color: '#60a5fa' },
                { key: 'heap_total_mb', name: 'Heap Total', color: '#34d399' },
                { key: 'rss_mb', name: 'RSS', color: '#fbbf24' },
              ]}
              itemsPerPage={20}
            />
          </MetricCard>

          <MetricCard
            title="Heap Space Distribution"
            subtitle="New / Old / Code / Large Objects"
            filters={heapFilters}
            onFilterChange={setHeapFilters}
          >
            <CustomStackedAreaChart
              data={heap}
              xKey="timestamp_ms"
              xAxisLabel="Timestamp (ms)"
              yAxisLabel="Memory (MB)"
              yAreas={[
                { key: 'new_space_mb', name: 'New', color: '#60a5fa' },
                { key: 'old_space_mb', name: 'Old', color: '#34d399' },
                { key: 'code_space_mb', name: 'Code', color: '#fbbf24' },
                { key: 'large_object_space_mb', name: 'Large', color: '#f87171' },
              ]}
              itemsPerPage={20}
            />
          </MetricCard>

          <MetricCard
            title="Garbage Collection Pauses"
            subtitle="Red: Major (MC) | Yellow: Minor (Scavenge)"
            filters={gcFilters}
            onFilterChange={setGcFilters}
          >
            <CustomStackedBarChart
              data={chartData}
              xKey="displayTime"
              yAxisLabel="Pause Time (ms)"
              xAxisLabel="Timestamp"
              yBars={[
                { key: 'minor_pause', name: 'Minor GC (Scavenge)', color: '#fbbf24' },
                { key: 'major_pause', name: 'Major GC (Mark-Compact)', color: '#ef4444' },
              ]}
              itemsPerPage={15}
            />
          </MetricCard>

        </div>
      </div>
    </div>
  );
};

/* ------------------ Card Wrapper ------------------ */
const MetricCard = ({
  title,
  subtitle,
  children,
  filters,
  onFilterChange,
}) => {
  const [localStart, setLocalStart] = useState(filters?.start_ts || '');
  const [localEnd, setLocalEnd] = useState(filters?.end_ts || '');

  const handleApply = () => {
    console.log('Applying filters:', { start_ts: localStart, end_ts: localEnd });
    onFilterChange({
      start_ts: localStart,
      end_ts: localEnd
    });
  };

  const handleReset = () => {
    setLocalStart('');
    setLocalEnd('');
    onFilterChange({ start_ts: '', end_ts: '' });
  };

  return (
    <div className="card p-6">
      <div className="flex justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>{subtitle}</p>
        </div>

        {filters && (
          <div className="flex gap-2 items-center">
            <input
              type="number"
              placeholder="Start (ms)"
              value={localStart}
              onChange={e => setLocalStart(e.target.value)}
              className="input text-xs w-32"
            />
            <input
              type="number"
              placeholder="End (ms)"
              value={localEnd}
              onChange={e => setLocalEnd(e.target.value)}
              className="input text-xs w-32"
            />
            <Button 
              onClick={handleApply}
              variant="confirm"
              size="sm"
            >
              Apply
            </Button>
            <Button 
              onClick={handleReset}
              variant="secondary"
              size="sm"
            >
              Reset
            </Button>
          </div>
        )}
      </div>

      <div>{children}</div>
    </div>
  );
};

export default ExploreMetrics;