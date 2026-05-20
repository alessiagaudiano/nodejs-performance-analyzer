import React, { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

/**
 * Reusable CustomLineChart Component
 *
 * Props:
 * - data: array of objects [{ xKey: value, yKey1: value, yKey2: value, ... }]
 * - xKey: string (property used for the X-axis)
 * - yAxes: array of objects like:
 *    [{ key: 'cpu', name: 'CPU (%)', color: '#3b82f6', yAxisId: 'left' },
 *     { key: 'memory', name: 'Memory (MB)', color: '#10b981', yAxisId: 'right' }]
 * - xAxisLabel: string
 * - yAxisLabels: object like { left: 'CPU (%)', right: 'Memory (MB)' }
 * - itemsPerPage: number (optional, default 10)
 */

const CustomLineChart = ({ data, xKey, yAxes, xAxisLabel, yAxisLabels, itemsPerPage = 10 }) => {
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

  // Check if we need right Y-axis
  const hasRightAxis = yAxes.some(axis => axis.yAxisId === 'right');

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

  // Helper to get nested value from object (e.g., "runs_per_sec.geometric_mean_runs_per_sec")
  const getNestedValue = (obj, path) => {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  };

  return (
    <div className="custom-line-chart">
      <ResponsiveContainer width="100%" height={360}>
        <LineChart 
          data={paginatedData} 
          margin={{ top: 20, right: hasRightAxis ? 60 : 30, left: 20, bottom: 60 }}
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

          {/* Left Y Axis */}
          <YAxis
            yAxisId="left"
            stroke="var(--muted)"
            tick={{ fill: 'var(--muted)', fontSize: 12 }}
            label={{ 
              value: yAxisLabels?.left, 
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

          {/* Right Y Axis (conditional) */}
          {hasRightAxis && (
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke="var(--muted)"
              tick={{ fill: 'var(--muted)', fontSize: 12 }}
              label={{ 
                value: yAxisLabels?.right, 
                angle: 90, 
                position: 'insideRight',
                style: { 
                  fill: 'var(--text)', 
                  fontWeight: '500',
                  fontSize: 13,
                  textAnchor: 'middle'
                }
              }}
              width={60}
            />
          )}

          <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--border)', strokeWidth: 1 }} />
          
          <Legend 
            wrapperStyle={{
              paddingTop: '20px',
              fontSize: '13px'
            }}
            iconType="line"
            iconSize={16}
          />

          {yAxes.map((axis) => (
            <Line
              key={axis.key}
              yAxisId={axis.yAxisId || 'left'}
              type="monotone"
              dataKey={axis.key}
              name={axis.name}
              stroke={axis.color}
              strokeWidth={2.5}
              dot={{ r: 3, strokeWidth: 2 }}
              activeDot={{ r: 5, strokeWidth: 0 }}
              connectNulls
            />
          ))}
        </LineChart>
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
            Page {currentPage} of {totalPages} ({data.length} total points)
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

export default CustomLineChart;