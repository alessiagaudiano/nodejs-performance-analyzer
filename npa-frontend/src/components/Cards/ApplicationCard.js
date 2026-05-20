import React from 'react';

const ApplicationCard = ({ appName, appData, onSelect }) => {
  if (!appData) return null;

  const {
    runs_count = 0,
    failed_count = 0,
    crash_detected_count = 0,
    oom_detected_count = 0,
    total_gc_events = 0,
    high_promotion_count = 0,
    long_gc_minor_pauses = 0,
    long_gc_major_pauses = 0
  } = appData;

  const successRate = runs_count > 0 
    ? ((runs_count - failed_count) / runs_count * 100).toFixed(1)
    : 0;

  const hasIssues = crash_detected_count > 0 || oom_detected_count > 0 || failed_count > 0;
  const gcIssues = long_gc_minor_pauses + long_gc_major_pauses;

  return (
    <div 
      onClick={onSelect}
      className="cursor-pointer rounded-lg border transition-all hover:shadow-md"
      style={{ 
        backgroundColor: 'var(--surface)',
        borderColor: 'var(--border)',
        borderWidth: '1px'
      }}
    >
      {/* Header */}
      <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <h3 className="font-semibold text-lg mb-2" style={{ color: 'var(--text)' }}>
          {appName}
        </h3>
        
        {/* Success Rate */}
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: 'var(--muted)' }}>Success Rate</span>
          <span 
            className="text-sm font-semibold"
            style={{
              color: successRate >= 80 ? '#10b981' : successRate >= 50 ? '#f59e0b' : '#ef4444'
            }}
          >
            {successRate}%
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="p-4 space-y-3">
        {/* Runs and Failures */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs mb-1" style={{ color: 'var(--muted)' }}>Total Runs</div>
            <div className="text-xl font-semibold" style={{ color: 'var(--text)' }}>
              {runs_count}
            </div>
          </div>
          
          <div>
            <div className="text-xs mb-1" style={{ color: 'var(--muted)' }}>Failed</div>
            <div className="text-xl font-semibold" style={{ color: failed_count > 0 ? '#ef4444' : 'var(--text)' }}>
              {failed_count}
            </div>
          </div>
        </div>

        {/* Issues */}
        {hasIssues && (
          <div 
            className="p-3 rounded"
            style={{ 
              backgroundColor: '#ef444408',
              borderLeft: '3px solid #ef4444'
            }}
          >
            <div className="text-xs font-medium mb-2" style={{ color: '#ef4444' }}>
              Issues Detected
            </div>
            <div className="space-y-1">
              {crash_detected_count > 0 && (
                <div className="text-xs flex justify-between" style={{ color: 'var(--text)' }}>
                  <span>Crashes</span>
                  <span className="font-medium">{crash_detected_count}</span>
                </div>
              )}
              {oom_detected_count > 0 && (
                <div className="text-xs flex justify-between" style={{ color: 'var(--text)' }}>
                  <span>Out of Memory</span>
                  <span className="font-medium">{oom_detected_count}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* GC Stats */}
        <div className="pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs" style={{ color: 'var(--muted)' }}>GC Events</span>
            <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>
              {total_gc_events.toLocaleString()}
            </span>
          </div>
          
          {gcIssues > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-xs" style={{ color: 'var(--muted)' }}>Long Pauses</span>
              <span className="text-xs font-medium" style={{ color: '#f59e0b' }}>
                {gcIssues}
              </span>
            </div>
          )}
          
          {high_promotion_count > 0 && (
            <div className="flex justify-between items-center mt-1">
              <span className="text-xs" style={{ color: 'var(--muted)' }}>Promotions</span>
              <span className="text-xs" style={{ color: 'var(--muted)' }}>
                {high_promotion_count.toLocaleString()}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ApplicationCard;