import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const CorrelationGraph = ({ data }) => {
  const chartData = data
    .filter(item => item.pearson !== null)
    .map(item => ({
      name: `${item.x} vs ${item.y}`,
      correlation: item.pearson,
      x: item.x,
      y: item.y
    }))
    .sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));

  const getBarColor = (value) => {
    if (value > 0.5) return '#10b981'; // Strong positive - green
    if (value > 0) return '#34d399'; // Weak positive - light green
    if (value > -0.5) return '#f87171'; // Weak negative - light red
    return '#ef4444'; // Strong negative - red
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div style={{
          backgroundColor: '#1f2937',
          border: '1px solid #374151',
          padding: '12px',
          borderRadius: '6px'
        }}>
          <p style={{ color: '#f3f4f6', fontSize: '13px', marginBottom: '4px' }}>
            <strong>{data.x}</strong> vs <strong>{data.y}</strong>
          </p>
          <p style={{ color: '#9ca3af', fontSize: '12px' }}>
            Pearson: <span style={{ color: getBarColor(data.correlation), fontWeight: 'bold' }}>
              {data.correlation.toFixed(4)}
            </span>
          </p>
        </div>
      );
    }
    return null;
  };

  if (chartData.length === 0) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: '40px',
        color: '#6b7280'
      }}>
        No valid correlation data available to display.
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '400px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart 
          data={chartData}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis 
            type="number" 
            domain={[-1, 1]}
            tick={{ fill: '#9ca3af', fontSize: 12 }}
          />
          <YAxis 
            type="category" 
            dataKey="name" 
            width={250}
            tick={{ fill: '#9ca3af', fontSize: 11 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="correlation" radius={[0, 4, 4, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getBarColor(entry.correlation)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default CorrelationGraph;