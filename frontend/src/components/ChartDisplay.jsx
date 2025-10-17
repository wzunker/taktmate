import React, { useState } from 'react';
import {
  BarChart,
  LineChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Bar,
  Line,
  ResponsiveContainer,
  Scatter,
  ScatterChart
} from 'recharts';

/**
 * ChartDisplay Component
 * 
 * Renders charts with Takt brand styling.
 * Supports bar charts and xy line plots.
 */

// Takt brand color palette for charts
const TAKT_COLORS = {
  primary: '#E16809',      // Takt Orange
  secondary: '#3E553C',    // Takt Green
  skyBlue: '#4B95D1',      // Sky Blue
  solarOrange: '#FFA51F',  // Solar Orange
  amberOrange: '#CC7A00',  // Amber Orange
  ironGrey: '#322E2D',     // Iron Grey (text)
  gridGrey: '#E5E5E5'      // Grid lines
};

// Custom Tooltip Component with Takt styling
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-button shadow-md p-3 font-poppins text-sm">
        <p className="font-semibold text-text-primary mb-1">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} style={{ color: entry.color }}>
            {entry.name}: <span className="font-medium">{entry.value}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const ChartDisplay = ({ chartData }) => {
  // State for XY plot line toggle (must be at top level)
  const [showLine, setShowLine] = useState(false); // Default: no line, just points
  
  // Validate chartData
  if (!chartData || !chartData.type || !chartData.data || chartData.data.length === 0) {
    return (
      <div className="bg-background-cream rounded-card p-6 mb-4 shadow-sm">
        <p className="text-text-secondary text-sm">Invalid chart data</p>
      </div>
    );
  }

  const { type, title, data, xLabel, yLabel } = chartData;
  
  // Determine chart height based on data size
  const chartHeight = data.length > 10 ? 400 : 300;

  // Render Bar Chart
  if (type === 'bar') {
    return (
      <div className="bg-background-cream rounded-card p-6 mb-4 shadow-sm">
        <h3 className="text-xl font-semibold text-text-primary mb-4">{title}</h3>
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart 
            data={data}
            margin={{ top: 5, right: 30, left: 5, bottom: 20 }}
          >
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke={TAKT_COLORS.gridGrey} 
            />
            <XAxis 
              dataKey="name" 
              stroke={TAKT_COLORS.ironGrey}
              angle={-45}
              textAnchor="end"
              height={80}
              style={{ 
                fontFamily: 'Poppins', 
                fontSize: 11,
                fontWeight: 500 
              }}
              label={{ 
                value: xLabel, 
                position: 'insideBottom', 
                offset: -10,
                style: { fill: TAKT_COLORS.ironGrey, fontWeight: 600 }
              }}
            />
            <YAxis 
              stroke={TAKT_COLORS.ironGrey}
              width={80}
              style={{ 
                fontFamily: 'Poppins', 
                fontSize: 12,
                fontWeight: 500 
              }}
              label={{ 
                value: yLabel, 
                angle: -90, 
                position: 'insideLeft',
                offset: 10,
                style: { fill: TAKT_COLORS.ironGrey, fontWeight: 600, textAnchor: 'middle' }
              }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar 
              dataKey="value" 
              fill={TAKT_COLORS.primary}
              opacity={0.9}
              onMouseEnter={(data, index) => {
                // Hover effect handled by recharts
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // Render XY Scatter/Line Chart
  if (type === 'xy') {
    return (
      <div className="bg-background-cream rounded-card p-6 mb-4 shadow-sm">
        {/* Header with title and toggle button */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-text-primary">{title}</h3>
          <button
            onClick={() => setShowLine(!showLine)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-button text-sm font-medium transition-colors border"
            style={{
              backgroundColor: showLine ? TAKT_COLORS.primary : 'white',
              color: showLine ? 'white' : TAKT_COLORS.primary,
              borderColor: TAKT_COLORS.primary
            }}
          >
            <span>{showLine ? '●' : '━●'}</span>
            <span>{showLine ? 'Hide Line' : 'Show Line'}</span>
          </button>
        </div>
        
        <ResponsiveContainer width="100%" height={chartHeight}>
          <LineChart 
            data={data}
            margin={{ top: 5, right: 30, left: 5, bottom: 20 }}
          >
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke={TAKT_COLORS.gridGrey} 
            />
            <XAxis 
              dataKey="x" 
              type="number"
              stroke={TAKT_COLORS.ironGrey}
              height={60}
              style={{ 
                fontFamily: 'Poppins', 
                fontSize: 12,
                fontWeight: 500 
              }}
              label={{ 
                value: xLabel, 
                position: 'insideBottom', 
                offset: -10,
                style: { fill: TAKT_COLORS.ironGrey, fontWeight: 600 }
              }}
            />
            <YAxis 
              dataKey="y"
              type="number"
              stroke={TAKT_COLORS.ironGrey}
              width={80}
              style={{ 
                fontFamily: 'Poppins', 
                fontSize: 12,
                fontWeight: 500 
              }}
              label={{ 
                value: yLabel, 
                angle: -90, 
                position: 'insideLeft',
                offset: 10,
                style: { fill: TAKT_COLORS.ironGrey, fontWeight: 600, textAnchor: 'middle' }
              }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line 
              type="monotone" 
              dataKey="y" 
              stroke={showLine ? TAKT_COLORS.primary : 'transparent'}
              strokeWidth={2}
              dot={{ fill: TAKT_COLORS.primary, r: 5, strokeWidth: 0 }}
              activeDot={{ r: 7 }}
              isAnimationActive={true}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // Unsupported chart type
  return (
    <div className="bg-background-cream rounded-card p-6 mb-4 shadow-sm">
      <p className="text-text-secondary text-sm">Unsupported chart type: {type}</p>
    </div>
  );
};

export default ChartDisplay;

