import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const SelectionContext = createContext(null);

export const SelectionProvider = ({ children }) => {
  const [selectedApp, setSelectedApp] = useState(() => sessionStorage.getItem('selectedApp') || null);
  const [selectedConfig, setSelectedConfig] = useState(() => sessionStorage.getItem('selectedConfig') || null);
  const [selectedRun, setSelectedRun] = useState(() => sessionStorage.getItem('selectedRun') || null);
  const [timeWindow, setTimeWindow] = useState(() => {
    const from = sessionStorage.getItem('tw_from');
    const to = sessionStorage.getItem('tw_to');
    return from && to ? { from: Number(from), to: Number(to) } : null;
  });
  const [activeMetrics, setActiveMetrics] = useState(() => {
    const raw = sessionStorage.getItem('activeMetrics');
    return raw ? raw.split(',') : ['cpu', 'heap_used', 'heap_total', 'rss'];
  });
  const [chartType, setChartType] = useState(() => sessionStorage.getItem('chartType') || 'line');
  const [downsample, setDownsample] = useState(() => sessionStorage.getItem('downsample') || 'auto');
  const [compare, setCompare] = useState({ leftRun: null, rightRun: null });

  useEffect(() => { if (selectedApp) sessionStorage.setItem('selectedApp', selectedApp); }, [selectedApp]);
  useEffect(() => { if (selectedConfig) sessionStorage.setItem('selectedConfig', selectedConfig); }, [selectedConfig]);
  useEffect(() => { if (selectedRun) sessionStorage.setItem('selectedRun', selectedRun); }, [selectedRun]);
  useEffect(() => {
    if (timeWindow) {
      sessionStorage.setItem('tw_from', String(timeWindow.from));
      sessionStorage.setItem('tw_to', String(timeWindow.to));
    }
  }, [timeWindow]);
  useEffect(() => { sessionStorage.setItem('activeMetrics', activeMetrics.join(',')); }, [activeMetrics]);
  useEffect(() => { sessionStorage.setItem('chartType', chartType); }, [chartType]);
  useEffect(() => { sessionStorage.setItem('downsample', downsample); }, [downsample]);

  // Reflect basic query params for from/to/metrics
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    const url = new URL(window.location.href);
    if (timeWindow?.from) url.searchParams.set('from', String(timeWindow.from));
    if (timeWindow?.to) url.searchParams.set('to', String(timeWindow.to));
    if (activeMetrics?.length) url.searchParams.set('metrics', activeMetrics.join(','));
    const next = url.pathname + (url.searchParams.toString() ? `?${url.searchParams.toString()}` : '') + url.hash;
    if (next !== location.pathname + location.search + location.hash) {
      navigate(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeWindow, activeMetrics]);

  const value = useMemo(() => ({
    selectedApp, setSelectedApp,
    selectedConfig, setSelectedConfig,
    selectedRun, setSelectedRun,
    timeWindow, setTimeWindow,
    activeMetrics, setActiveMetrics,
    chartType, setChartType,
    downsample, setDownsample,
    compare, setCompare,
  }), [selectedApp, selectedConfig, selectedRun, timeWindow, activeMetrics, chartType, downsample, compare]);

  return (
    <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>
  );
};

export const useSelection = () => {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error('useSelection must be used within SelectionProvider');
  return ctx;
};

// Simple client-side downsampling (keep every Nth point if large)
export const downsampleSeries = (points, maxPoints = 3000) => {
  if (!Array.isArray(points) || points.length <= maxPoints) return points;
  const stride = Math.ceil(points.length / maxPoints);
  const out = [];
  for (let i = 0; i < points.length; i += stride) out.push(points[i]);
  return out;
};

