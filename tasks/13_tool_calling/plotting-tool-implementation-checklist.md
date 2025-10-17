# 📊 Plotting Tool Implementation Checklist

## Phase 1: Backend - Create Plotting Tool

### 1.1 Create Plot Tool
- [ ] Create `/backend/toolkit/createPlot.js`
  - [ ] Export tool with name `create_plot`
  - [ ] Description: "Create a chart/plot from data. Supports bar charts and xy plots."
  - [ ] Parameters:
    - `type`: "bar" or "xy"
    - `title`: Chart title
    - `data`: Array of objects with labels and values
    - `xLabel`: X-axis label (optional)
    - `yLabel`: Y-axis label (optional)
  - [ ] Execute function returns chart configuration object

### 1.2 Test Tool
- [ ] Restart backend and verify tool loads
- [ ] Check console shows "create_plot" in loaded tools list

---

## Phase 2: Frontend - Render Charts

### 2.1 Install Chart Library
- [ ] Run `npm install recharts` in `/frontend/`
- [ ] Recharts is React-friendly and supports bar/line charts

### 2.2 Create Chart Component
- [ ] Create `/frontend/src/components/ChartDisplay.jsx`
  - [ ] Import `BarChart`, `LineChart`, `XAxis`, `YAxis`, `CartesianGrid`, `Tooltip`, `Legend`, `Bar`, `Line`, `ResponsiveContainer` from recharts
  - [ ] Accept `chartData` prop (from tool response)
  - [ ] Render bar chart when `type === "bar"`
  - [ ] Render line chart when `type === "xy"`
  - [ ] Apply Takt brand styling:
    - Container: `bg-background-cream` with `rounded-card` (8px) border radius
    - Chart bars: Primary `fill` color `#E16809` (Takt Orange)
    - Chart lines: Primary `stroke` color `#E16809` (Takt Orange), `strokeWidth={2}`
    - Multi-series color palette: [`#E16809`, `#3E553C`, `#4B95D1`, `#FFA51F`, `#CC7A00`] (Takt Orange, Green, Sky Blue, Solar Orange, Amber)
    - Grid: `stroke="#E5E5E5"` (subtle), `strokeDasharray="3 3"` (dashed)
    - Axis labels: `fill="#322E2D"` (Iron Grey), `fontFamily="Poppins"`, `fontSize={12}`, `fontWeight={500}`
    - Tooltip: Custom component with `bg-white`, `border border-gray-200`, `rounded-button`, `shadow-md`, `font-poppins`, `text-sm`
    - Title: `text-xl font-semibold text-text-primary mb-4` (Iron Grey, Poppins)
    - Container padding: `p-6`
    - Chart height: `300px` (default) or `400px` for larger datasets
    - Hover states: Bars/points slightly lighter on hover (`opacity-80`)

### 2.3 Update ChatBox to Render Charts
- [ ] In `/frontend/src/components/ChatBox.jsx`:
  - [ ] Import `ChartDisplay` component
  - [ ] Detect if message contains chart data (check for `chartData` property)
  - [ ] Render `<ChartDisplay>` before the text response
  - [ ] Wrap chart in container with `mb-4` spacing
  - [ ] Add subtle shadow: `shadow-sm` for depth
  - [ ] Add fallback if chart data is invalid

### 2.4 Update Backend Response
- [ ] In `/backend/index.js` chat endpoint:
  - [ ] After tool execution, check if tool name is `create_plot`
  - [ ] If yes, attach `chartData` to response object (not just in reply text)
  - [ ] Format: `response.chartData = toolResult`

### 2.5 Test End-to-End
- [ ] Ask: "Plot the salary of each employee as a bar chart"
- [ ] Ask: "Plot employee performance vs salary"
- [ ] Verify charts render correctly
- [ ] Check debug info shows tool was called

---

## ✅ Success Criteria

- [ ] GPT-5-mini can call `create_plot` tool
- [ ] Backend returns structured chart data
- [ ] Frontend renders interactive bar charts
- [ ] Frontend renders interactive xy plots
- [ ] Charts display with proper labels and titles
- [ ] Tool works with CSV/XLSX data files

