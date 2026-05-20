import React, { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';

/**
 * Reusable CustomBarChart Component
 *
 * Props:
 * - data: array of objects [{ xKey: value, yKey1: value, yKey2: value, ... }]
 * - xKey: string (property used for the X-axis)
 * - bars: array of objects like:
 *    [{ key: 'requests', name: 'Requests', color: '#3b82f6' },
 *     { key: 'errors', name: 'Errors', color: '#ef4444' }]
 * - xAxisLabel: string
 * - yAxisLabel: string
 * - itemsPerPage: number (optional, default 10)
 */

const CustomBarChart = ({ data, xKey, bars, xAxisLabel, yAxisLabel, itemsPerPage = 10 }) => {
  const [currentPage, setCurrentPage] = useState(1);

  if (!data || data.length === 0) {
    return (
      <div 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          height: '360px',
          color: 'var(--muted)' 
        }}
      >
        No data available
      </div>
    );
  }

  // Pagination logic
  const totalPages = Math.ceil(data.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = data.slice(startIndex, endIndex);

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1);
    }
  };

  // Custom tooltip with better styling
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div 
          style={{
            backgroundColor: 'var(--background)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '12px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
          }}
        >
          <p style={{ 
            margin: '0 0 8px 0', 
            fontWeight: '600',
            color: 'var(--text)',
            fontSize: '13px'
          }}>
            {`${xAxisLabel || 'Value'}: ${label}`}
          </p>
          {payload.map((entry, index) => (
            <p 
              key={index} 
              style={{ 
                margin: '4px 0',
                color: entry.color,
                fontSize: '12px'
              }}
            >
              {`${entry.name}: ${typeof entry.value === 'number' ? entry.value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : entry.value}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="custom-bar-chart">
      <ResponsiveContainer width="100%" height={360}>
        <BarChart 
          data={paginatedData} 
          margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
        >
          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke="var(--border)" 
            opacity={0.3}
          />

          <XAxis
            dataKey={xKey}
            stroke="var(--muted)"
            tick={{ fill: 'var(--muted)', fontSize: 12 }}
            label={{ 
              value: xAxisLabel, 
              position: 'insideBottom',
              offset: -10,
              style: { 
                fill: 'var(--text)', 
                fontWeight: '500',
                fontSize: 13
              }
            }}
            height={60}
          />

          <YAxis
            stroke="var(--muted)"
            tick={{ fill: 'var(--muted)', fontSize: 12 }}
            label={{ 
              value: yAxisLabel, 
              angle: -90, 
              position: 'insideLeft',
              style: { 
                fill: 'var(--text)', 
                fontWeight: '500',
                fontSize: 13,
                textAnchor: 'middle'
              }
            }}
            width={60}
          />

          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--border)', opacity: 0.2 }} />
          
          <Legend 
            wrapperStyle={{
              paddingTop: '20px',
              fontSize: '13px'
            }}
            iconType="rect"
            iconSize={12}
          />

          {bars.map((bar) => (
            <Bar
              key={bar.key}
              dataKey={bar.key}
              name={bar.name}
              fill={bar.color}
              radius={[4, 4, 0, 0]}
              maxBarSize={60}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>

      {/* Pagination Controls */}
      {data.length > itemsPerPage && (
        <div className="flex justify-center items-center gap-4 mt-6">
          <button
            onClick={handlePreviousPage}
            disabled={currentPage === 1}
            className="px-4 py-2 rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: currentPage === 1 ? 'var(--muted)' : 'var(--primary)',
              color: 'var(--background)'
            }}
          >
            Previous
          </button>
          
          <span className="text-sm" style={{ color: 'var(--text)' }}>
            Page {currentPage} of {totalPages} ({data.length} total items)
          </span>
          
          <button
            onClick={handleNextPage}
            disabled={currentPage === totalPages}
            className="px-4 py-2 rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: currentPage === totalPages ? 'var(--muted)' : 'var(--primary)',
              color: 'var(--background)'
            }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default CustomBarChart;