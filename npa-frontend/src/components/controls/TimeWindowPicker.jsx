import React from 'react';

const TimeWindowPicker = ({ now, onPreset, onCustom }) => {
  const presets = [
    { key: '1m', label: 'Last 1m', ms: 60_000 },
    { key: '5m', label: 'Last 5m', ms: 300_000 },
    { key: '15m', label: 'Last 15m', ms: 900_000 },
    { key: 'all', label: 'All', ms: null },
  ];
  return (
    <div className="flex gap-2 items-center">
      {presets.map(p => (
        <button key={p.key} className="px-2 py-1 text-xs rounded-md" style={{ background: 'var(--surface)', color: 'var(--text)' }} onClick={() => onPreset(p)} aria-label={`Set time window ${p.label}`}>
          {p.label}
        </button>
      ))}
      <div className="flex items-center gap-1">
        <input type="datetime-local" onChange={(e) => onCustom('from', new Date(e.target.value).getTime())} className="px-2 py-1 text-xs rounded-md" style={{ background: 'var(--surface)', color: 'var(--text)' }} aria-label="From time" />
        <span style={{ color: 'var(--muted)' }}>→</span>
        <input type="datetime-local" onChange={(e) => onCustom('to', new Date(e.target.value).getTime())} className="px-2 py-1 text-xs rounded-md" style={{ background: 'var(--surface)', color: 'var(--text)' }} aria-label="To time" />
      </div>
    </div>
  );
};

export default TimeWindowPicker;

