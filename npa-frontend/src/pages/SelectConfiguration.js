import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiFetch } from '../api/apiClient';
import { useSelection } from '../state/SelectionContext';
import Button from '../components/Button';

const SelectConfiguration = () => {
  const navigate = useNavigate();
  const { appId } = useParams();
  const { setSelectedApp, setSelectedConfig, setSelectedRun } = useSelection();
  const [configData, setConfigData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter states
  const [filters, setFilters] = useState({
    gcType: '',
    heapCapacity: '',
    crashDetected: null,
    failed: null,
    oomDetected: null,
    cpuActiveMin: '',
    cpuActiveMax: '',
    selectedRun: ''
  });

  const selectedApp = appId || sessionStorage.getItem('selectedApp');

  useEffect(() => {
    if (selectedApp) setSelectedApp(selectedApp);
  }, [selectedApp, setSelectedApp]);

  useEffect(() => {
    if (!selectedApp) {
      navigate('/apps');
      return;
    }

    const fetchConfigs = async () => {
      try {
        setLoading(true);
        const data = await apiFetch(`/apps/configs?app_name=${selectedApp}`);
        setConfigData(data);
        setError(null);
      } catch (err) {
        setError('Failed to load configurations');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchConfigs();
  }, [selectedApp, navigate]);

  if (!selectedApp) {
    return null;
  }

  const handleApplyFilters = () => {
    setSelectedConfig(filters);
    const runId = filters.selectedRun || configData?.runs?.[0] || 'default';
    setSelectedRun(runId);
    navigate(`/apps/${selectedApp}/run/${runId}/issues`);
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="p-6 min-h-screen">
        <div className="container">
          <div className="text-center py-12" style={{ color: 'var(--muted)' }}>
            Loading configurations...
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 min-h-screen">
        <div className="container">
          <div className="text-center py-12" style={{ color: 'var(--text)' }}>
            <p className="text-red-500 mb-4">{error}</p>
            <Button 
            onClick={() => navigate('/apps')} 
            className="btn btn-muted"
            variant='back'
            size='md'
            >
              Back to Apps
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 min-h-screen">
      <div className="container max-w-4xl mx-auto">
        <div className="relative flex items-center justify-center mb-8">
          {/* Left: Back Button */}
          <Button 
            onClick={() => navigate('/apps')} 
            variant='back' 
            size='md' 
            className='absolute left-0'
          >
            ← Back
          </Button>

          {/* Center: Title and Subtitle */}
          <div className='text-center'>
            <h1 className="text-2xl font-medium" style={{ color: 'var(--text)' }}>
              Configuration Filters
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
              Configure filters for {configData?.app_name}
            </p>
          </div>

          {/* Right: Action Buttons Container */}
          <div className="absolute right-0 flex gap-3">
            <Button
              onClick={() => setFilters({
                gcType: '',
                heapCapacity: '',
                crashDetected: null,
                failed: null,
                oomDetected: null,
                cpuActiveMin: '',
                cpuActiveMax: '',
                selectedRun: ''
              })}
              variant='secondary'
              size='md'
            >
              Reset Filters
            </Button>
            <Button
              onClick={handleApplyFilters}
              variant='confirm'
              size='md'
            >
              Continue
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          {/* GC Type */}
          <div data-testid="gc-selector-card" className="card">
            <label className="block mb-2">
              <span className="font-semibold" style={{ color: 'var(--text)' }}>
                Garbage Collection Type
              </span>
              <span className="text-sm ml-2" style={{ color: 'var(--muted)' }}>(Optional)</span>
            </label>
            <p className="text-sm mb-3" style={{ color: 'var(--muted)' }}>
              Choose the garbage collection algorithm. Serial (s) uses single-threaded collection with low overhead, while Multi-threaded (mc) uses parallel collection for better performance on large heaps.
            </p>
            <select
              data-testid="gc-selector-selector"
              value={filters.gcType}
              onChange={(e) => handleFilterChange('gcType', e.target.value)}
              className="w-full p-2 rounded border"
              style={{ 
                backgroundColor: 'var(--background)', 
                color: 'var(--text)',
                borderColor: 'var(--border)'
              }}
            >
              <option value="">All GC Types</option>
              {configData?.gc_types?.map(type => (
                <option key={type} value={type}>
                  {type === 's' ? 'Serial GC (s)' : type === 'mc' ? 'Multi-threaded GC (mc)' : type}
                </option>
              ))}
            </select>
          </div>

          {/* Heap Capacity */}
          <div data-testid="heap-capacity-card" className="card">
            <label className="block mb-2">
              <span className="font-semibold" style={{ color: 'var(--text)' }}>
                Heap Capacity (MB)
              </span>
              <span className="text-sm ml-2" style={{ color: 'var(--muted)' }}>(Optional)</span>
            </label>
            <p className="text-sm mb-3" style={{ color: 'var(--muted)' }}>
              Maximum memory allocated for the JVM heap. Higher values allow more objects in memory but consume more system resources.
            </p>
            <select
              data-testid="heap-capacity-select"
              value={filters.heapCapacity}
              onChange={(e) => handleFilterChange('heapCapacity', e.target.value)}
              className="w-full p-2 rounded border"
              style={{ 
                backgroundColor: 'var(--background)', 
                color: 'var(--text)',
                borderColor: 'var(--border)'
              }}
            >
              <option value="">All Heap Sizes</option>
              {configData?.heap_capacity_mb_bins?.map(size => (
                <option key={size} value={size}>
                  {size} MB
                </option>
              ))}
            </select>
          </div>

          {/* Run Status Filters */}
          <div className="card">
            <h3 className="font-semibold mb-3" style={{ color: 'var(--text)' }}>
              Run Status Filters <span className="text-sm font-normal" style={{ color: 'var(--muted)' }}>(Optional)</span>
            </h3>
            
            {/* Crash Detected */}
            <div className="mb-4">
              <label className="block mb-2">
                <span className="font-medium" style={{ color: 'var(--text)' }}>
                  Crash Detected
                </span>
              </label>
              <p className="text-sm mb-2" style={{ color: 'var(--muted)' }}>
                Filter runs where the application crashed unexpectedly during execution.
              </p>
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="crashDetected"
                    checked={filters.crashDetected === true}
                    onChange={() => handleFilterChange('crashDetected', true)}
                    className="mr-2"
                  />
                  <span style={{ color: 'var(--text)' }}>True</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="crashDetected"
                    checked={filters.crashDetected === false}
                    onChange={() => handleFilterChange('crashDetected', false)}
                    className="mr-2"
                  />
                  <span style={{ color: 'var(--text)' }}>False</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="crashDetected"
                    checked={filters.crashDetected === null}
                    onChange={() => handleFilterChange('crashDetected', null)}
                    className="mr-2"
                  />
                  <span style={{ color: 'var(--muted)' }}>Any</span>
                </label>
              </div>
            </div>

            {/* Failed */}
            <div className="mb-4">
              <label className="block mb-2">
                <span className="font-medium" style={{ color: 'var(--text)' }}>
                  Failed
                </span>
              </label>
              <p className="text-sm mb-2" style={{ color: 'var(--muted)' }}>
                Filter runs that failed to complete successfully due to errors or exceptions.
              </p>
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="failed"
                    checked={filters.failed === true}
                    onChange={() => handleFilterChange('failed', true)}
                    className="mr-2"
                  />
                  <span style={{ color: 'var(--text)' }}>True</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="failed"
                    checked={filters.failed === false}
                    onChange={() => handleFilterChange('failed', false)}
                    className="mr-2"
                  />
                  <span style={{ color: 'var(--text)' }}>False</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="failed"
                    checked={filters.failed === null}
                    onChange={() => handleFilterChange('failed', null)}
                    className="mr-2"
                  />
                  <span style={{ color: 'var(--muted)' }}>Any</span>
                </label>
              </div>
            </div>

            {/* OOM Detected */}
            <div className="mb-4">
              <label className="block mb-2">
                <span className="font-medium" style={{ color: 'var(--text)' }}>
                  Out of Memory (OOM) Detected
                </span>
              </label>
              <p className="text-sm mb-2" style={{ color: 'var(--muted)' }}>
                Filter runs where the application ran out of heap memory and threw OutOfMemoryError.
              </p>
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="oomDetected"
                    checked={filters.oomDetected === true}
                    onChange={() => handleFilterChange('oomDetected', true)}
                    className="mr-2"
                  />
                  <span style={{ color: 'var(--text)' }}>True</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="oomDetected"
                    checked={filters.oomDetected === false}
                    onChange={() => handleFilterChange('oomDetected', false)}
                    className="mr-2"
                  />
                  <span style={{ color: 'var(--text)' }}>False</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="oomDetected"
                    checked={filters.oomDetected === null}
                    onChange={() => handleFilterChange('oomDetected', null)}
                    className="mr-2"
                  />
                  <span style={{ color: 'var(--muted)' }}>Any</span>
                </label>
              </div>
            </div>
          </div>

          {/* CPU Active Range */}
          {configData?.cpu_active && (
            <div className="card">
              <label className="block mb-2">
                <span className="font-semibold" style={{ color: 'var(--text)' }}>
                  CPU Active Cycles Range
                </span>
                <span className="text-sm ml-2" style={{ color: 'var(--muted)' }}>(Optional)</span>
              </label>
              <p className="text-sm mb-3" style={{ color: 'var(--muted)' }}>
                Filter runs by CPU cycle usage. Set minimum and maximum values to narrow down performance characteristics. Available range: {configData.cpu_active.min.toLocaleString()} - {configData.cpu_active.max.toLocaleString()} cycles.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--muted)' }}>
                    Min CPU Cycles
                  </label>
                  <input
                    type="number"
                    value={filters.cpuActiveMin}
                    onChange={(e) => handleFilterChange('cpuActiveMin', e.target.value)}
                    placeholder={configData.cpu_active.min.toString()}
                    className="w-full p-2 rounded border"
                    style={{ 
                      backgroundColor: 'var(--background)', 
                      color: 'var(--text)',
                      borderColor: 'var(--border)'
                    }}
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--muted)' }}>
                    Max CPU Cycles
                  </label>
                  <input
                    type="number"
                    value={filters.cpuActiveMax}
                    onChange={(e) => handleFilterChange('cpuActiveMax', e.target.value)}
                    placeholder={configData.cpu_active.max.toString()}
                    className="w-full p-2 rounded border"
                    style={{ 
                      backgroundColor: 'var(--background)', 
                      color: 'var(--text)',
                      borderColor: 'var(--border)'
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Specific Run Selection */}
          <div className="card">
            <label className="block mb-2">
              <span className="font-semibold" style={{ color: 'var(--text)' }}>
                Select Specific Run
              </span>
              <span className="text-sm ml-2" style={{ color: 'var(--muted)' }}>(Optional)</span>
            </label>
            <p className="text-sm mb-3" style={{ color: 'var(--muted)' }}>
              Choose a specific run ID to analyze. Each run represents a unique execution instance with its own metrics and results.
            </p>
            <select
              value={filters.selectedRun}
              onChange={(e) => handleFilterChange('selectedRun', e.target.value)}
              className="w-full p-2 rounded border"
              style={{ 
                backgroundColor: 'var(--background)', 
                color: 'var(--text)',
                borderColor: 'var(--border)'
              }}
            >
              <option value="">All Runs</option>
              {configData?.runs?.map(runId => (
                <option key={runId} value={runId}>
                  Run ID: {runId}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SelectConfiguration;