import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiFetch } from '../api/apiClient';
import { useSelection } from '../state/SelectionContext';
import Button from '../components/Button';
import { INSIGHT_ADVICE } from '../components/Tooltips';

const IdentifyIssues = () => {
  const navigate = useNavigate();
  const { appId, runId } = useParams();
  const { selectedConfig, setSelectedApp, setSelectedRun } = useSelection();
  const [anomalyData, setAnomalyData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (appId) setSelectedApp(appId);
    if (runId) setSelectedRun(runId);
  }, [appId, runId, setSelectedApp, setSelectedRun]);

  useEffect(() => {
    const fetchAnomalies = async () => {
      if (!appId) {
        navigate('/apps');
        return;
      }
      try {
        setLoading(true);
        const params = new URLSearchParams();
        params.append('app_name', appId);
        console.log(selectedConfig);
        const onlyHealthy = 
          selectedConfig?.crashDetected === false && 
          selectedConfig?.failed === false && 
          selectedConfig?.oomDetected === false;
        params.append('only_healthy', onlyHealthy);
        
        if (selectedConfig?.heapCapacity) params.append('heap_bin_mb', selectedConfig.heapCapacity);
        if (selectedConfig?.cpuActiveMin) params.append('cpu_active_min', selectedConfig.cpuActiveMin);
        if (selectedConfig?.cpuActiveMax) params.append('cpu_active_max', selectedConfig.cpuActiveMax);
        if (selectedConfig?.selectedRun) params.append('run_id', selectedConfig.selectedRun);
        
        const data = await apiFetch(`/metrics/anomalies?${params.toString()}`);
        setAnomalyData(data);
        setError(null);
      } catch (err) {
        setError('Failed to load anomaly data');
      } finally {
        setLoading(false);
      }
    };
    fetchAnomalies();
  }, [appId, selectedConfig, navigate]);

  const getHealthStatus = () => {
    const criticality = anomalyData?.criticality?.toLowerCase();
    if (criticality === 'critical') return { status: 'Critical', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' };
    if (criticality === 'warning') return { status: 'Warning', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' };
    if (criticality === 'healthy') return { status: 'Healthy', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)' };
    return { status: 'Unknown', color: 'var(--muted)', bg: 'rgba(255, 255, 255, 0.05)' };
  };

  if (loading) return <div className="p-12 text-center" style={{ color: 'var(--muted)' }}>Analyzing performance data...</div>;

  const health = getHealthStatus();

  return (
    <div className="p-6 min-h-screen">
      <div className="container max-w-5xl mx-auto">
        
        {/* New Header: App Name as Title */}
        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold tracking-tight mb-1" style={{ color: 'var(--text)' }}>
              {appId}
            </h1>
            <p className="text-sm font-medium uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
              Performance Analysis Report
            </p>
          </div>
          
          {/* Criticality Badge */}
          <div 
            className="px-6 py-3 rounded-xl border flex flex-col items-center min-w-[160px]"
            style={{ 
              backgroundColor: health.bg, 
              borderColor: health.color,
              boxShadow: `0 4px 14px 0 ${health.bg}`
            }}
          >
            <span className="text-xs font-bold uppercase mb-1" style={{ color: health.color }}>System Status</span>
            <span className="text-xl font-black" style={{ color: health.color }}>{health.status}</span>
          </div>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'System Samples', value: anomalyData?.total_rows?.toLocaleString() },
            { label: 'High CPU Events', value: anomalyData?.high_cpu_count, color: anomalyData?.high_cpu_count > 0 ? '#ef4444' : 'var(--text)' },
            { label: 'Long GC Pauses', value: anomalyData?.long_gc_pauses_count, color: anomalyData?.long_gc_pauses_count > 0 ? '#ef4444' : 'var(--text)' },
            { label: 'High Promotions', value: anomalyData?.high_promotion_count, color: anomalyData?.high_promotion_count > 0 ? '#f59e0b' : 'var(--text)' }
          ].map((stat, i) => (
            <div key={i} className="card p-4 border rounded-lg bg-opacity-50" style={{ borderColor: 'var(--border)' }}>
              <div className="text-xs font-semibold uppercase mb-1" style={{ color: 'var(--muted)' }}>{stat.label}</div>
              <div className="text-2xl font-bold" style={{ color: stat.color || 'var(--text)' }}>{stat.value || '0'}</div>
            </div>
          ))}
        </div>

        {/* Detailed Findings - Refactored */}
        {anomalyData?.messages && anomalyData.messages.length > 0 && (
          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text)' }}>
              Diagnostic Insights
            </h3>
            <div className="grid gap-3">
              {anomalyData.messages.map((message, idx) => {
                const isUrgent = message.includes("High") || message.includes("increased");
                const key = Object.keys(INSIGHT_ADVICE).find(k => message.includes(k));
                const adviceText = INSIGHT_ADVICE[key];

                return (
                  <div 
                    key={idx} 
                    className="group rounded-lg border overflow-hidden"
                    style={{ 
                      borderColor: 'var(--border)', 
                      backgroundColor: 'rgba(255,255,255,0.01)'
                    }}
                  >
                    <div className="p-4 flex flex-col gap-2">
                      <div className="flex items-start justify-between">
                        <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{message}</p>
                      </div>
                      
                      {adviceText && (
                        <div className="mt-2 pt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                          <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
                            <span className="font-bold text-[10px] uppercase tracking-tighter mr-2" style={{ color: 'var(--text)' }}>Recommendation:</span>
                            {adviceText}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Memory & GC Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="card p-5 border rounded-xl" style={{ borderColor: 'var(--border)' }}>
                <h4 className="text-sm font-bold uppercase mb-4" style={{ color: 'var(--muted)' }}>Memory Stability</h4>
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <span className="text-sm" style={{ color: 'var(--text)' }}>Overhead Trend</span>
                        <span className="font-mono font-bold" style={{ color: anomalyData?.overhead_trend_positive ? '#f59e0b' : '#22c55e' }}>
                            {anomalyData?.overhead_slope_mb_per_min?.toFixed(2)} MB/min
                        </span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-sm" style={{ color: 'var(--text)' }}>Old Space Growth</span>
                        <span className="font-mono font-bold" style={{ color: anomalyData?.old_space_trend_positive ? '#f59e0b' : '#22c55e' }}>
                            {anomalyData?.old_space_delta_mb?.toFixed(2)} MB
                        </span>
                    </div>
                </div>
            </div>

            <div className="card p-5 border rounded-xl" style={{ borderColor: 'var(--border)' }}>
                <h4 className="text-sm font-bold uppercase mb-4" style={{ color: 'var(--muted)' }}>System Resource Health</h4>
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <span className="text-sm" style={{ color: 'var(--text)' }}>Low Memory Samples</span>
                        <span className="font-mono font-bold" style={{ color: anomalyData?.low_memory_samples > 0 ? '#ef4444' : 'var(--text)' }}>
                            {anomalyData?.low_memory_samples || 0}
                        </span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-sm" style={{ color: 'var(--text)' }}>Swap Events</span>
                        <span className="font-mono font-bold" style={{ color: anomalyData?.swap_usage_count > 0 ? '#ef4444' : 'var(--text)' }}>
                            {anomalyData?.swap_usage_count || 0}
                        </span>
                    </div>
                </div>
            </div>
        </div>

        {/* Actions */}
        <div className="flex justify-between items-center pt-8 border-t mt-12" style={{ borderColor: 'var(--border)' }}>
          <Button onClick={() => navigate(`/apps/${appId}/configs`)} variant='back' size='md'>
            Back to Config
          </Button>
          <Button onClick={() => navigate(`/apps/${appId}/run/${runId}/metrics`)} variant='confirm' size='md'>
            View Detailed Metrics
          </Button>
        </div>
      </div>
    </div>
  );
};

export default IdentifyIssues;