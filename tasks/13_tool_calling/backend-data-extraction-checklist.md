# 🔄 Backend Data Extraction Implementation

## Phase 1: Move Data Extraction from Model to Backend

### 1.1 Create Data Loading Helper
- [x] Create `/backend/toolkit/dataLoader.js`
  - [x] Export `loadFileData(userId, filename)` function
  - [x] Use existing `getBlobContent()` from `/backend/services/storage.js`
  - [x] Parse CSV using existing `parseCsv()` from `/backend/processCsv.js`
  - [x] Parse XLSX using existing `parseXlsx()` from `/backend/processXlsx.js`
  - [x] Return parsed data as array of objects
  - [x] Export `extractColumn(data, fieldName)` to get specific column values
  - [x] Add error handling for missing files/fields

### 1.2 Add File Caching
- [x] In `/backend/toolkit/dataLoader.js`:
  - [x] Create `Map()` cache at module level
  - [x] Cache key format: `${userId}_${filename}`
  - [x] Check cache before loading file
  - [x] Store parsed data in cache after loading
  - [x] Add cache invalidation (optional: TTL or size limit)

### 1.3 Update `filter_numeric` Tool
- [x] In `/backend/toolkit/filterNumeric.js`:
  - [x] Change parameters from `data` to `userId` and `filename`
  - [x] Add `userId` parameter (string, required)
  - [x] Add `filename` parameter (string, required)
  - [x] Keep `field`, `operator`, `value`, `value2` parameters
  - [x] Update description to say: "Reference file by name, don't pass data arrays"
  - [x] In `execute()`: Call `loadFileData(userId, filename)` to get data
  - [x] Filter the loaded data as before
  - [x] Return same result structure (filteredData, matchCount, etc.)

### 1.4 Update `create_plot` Tool
- [x] In `/backend/toolkit/createPlot.js`:
  - [x] Change parameters from `data` to `userId`, `filename`, `xField`, `yField`
  - [x] For bar charts: `xField` (category names), `yField` (values)
  - [x] For xy plots: `xField` (x values), `yField` (y values)
  - [x] Update description to say: "Reference file and columns, don't pass data"
  - [x] In `execute()`: Call `loadFileData(userId, filename)`
  - [x] Extract specified columns using `extractColumn()`
  - [x] Build chart data from extracted columns
  - [x] Return same result structure

### 1.5 Update `compute_avg_count_sum_min_max_median` Tool
- [x] In `/backend/toolkit/computeAvgCountSumMinMaxMedian.js`:
  - [x] Add optional `userId` and `filename` parameters
  - [x] Add optional `field` parameter (column name)
  - [x] Keep `numbers` array as fallback for direct calculations
  - [x] Update description: "Can accept file reference OR numbers array"
  - [x] In `execute()`: If userId/filename provided, load data and extract field
  - [x] Otherwise use provided numbers array
  - [x] Return same result structure

### 1.6 Update Chat Endpoint to Pass User Context
- [x] In `/backend/index.js` chat endpoint:
  - [x] When loading tools, pass current `user.id` to tool execution context
  - [x] Modify tool execution to inject `userId` parameter automatically
  - [x] Update `executeTool()` in `/backend/toolkit/index.js`:
    - [x] Accept `userId` as second parameter
    - [x] Merge `userId` into tool args before executing
  - [x] Ensure user isolation (tools only access user's own files)

### 1.7 Update System Prompt
- [x] In `/backend/prompts/normalPrompt.js`:
  - [x] Remove instructions to "extract data from document"
  - [x] Add: "Reference files by filename and specify field/column names"
  - [x] Update filter example: `{filename: "employee_payroll.csv", field: "salary", operator: ">=", value: 70000}`
  - [x] Update plot example: `{filename: "employee_payroll.csv", xField: "name", yField: "salary"}`
  - [x] Add: "Do NOT extract or pass data arrays - the backend handles data loading"
  - [x] Update tool chaining instructions to use file references

### 1.8 Test Data Loading
- [ ] Test with small file (10 rows)
- [ ] Test with medium file (1,000 rows)
- [ ] Test with large file (10,000+ rows)
- [ ] Verify cache hit/miss behavior
- [ ] Test error handling (missing file, invalid column)
- [ ] Test with all file types (CSV, XLSX, TXT, PDF, DOCX)

### 1.9 Test Tool Functionality
- [ ] Test filter: "Show employees with salary > 70000"
- [ ] Test plot: "Plot employee salaries as bar chart"
- [ ] Test stats: "What's the average salary?"
- [ ] Test chaining: "Filter salary > 70K then plot performance vs salary"
- [ ] Verify no token limit issues with large files
- [ ] Verify correct user isolation (users only see their files)