import React from 'react';

const MetricMultiSelect = ({ metrics, selected, onChange }) => {
  const toggle = (key) => {
    const set = new Set(selected);
    if (set.has(key)) set.delete(key); else set.add(key);
    onChange(Array.from(set));
  };
  return (
    <div className="flex gap-3 flex-wrap" aria-label="Metric selector">
      {metrics.map(m => (
        <label key={m.key} className="flex items-center gap-1 text-sm cursor-pointer" style={{ color: 'var(--text)' }}>
          <input type="checkbox" checked={selected.includes(m.key)} onChange={() => toggle(m.key)} aria-label={`Toggle ${m.label}`} />
          <span style={{ color: 'var(--muted)' }}>{m.label}</span>
        </label>
      ))}
    </div>
  );
};

export default MetricMultiSelect;

