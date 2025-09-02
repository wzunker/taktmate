# TaktMate MVP Testing Framework

A comprehensive testing framework to evaluate the generalization capabilities of the TaktMate MVP system across multiple domains.

## Overview

This framework tests the TaktMate MVP's ability to:
- Handle diverse CSV datasets from different domains
- Correctly identify structured vs semantic queries
- Return accurate results with proper scoring
- Highlight relevant columns appropriately
- Work beyond tide chart data patterns

## Test Structure

### Datasets (5 domains)
- **Employee Payroll**: HR data with salaries, performance ratings, departments
- **Astronomy Events**: Celestial events with magnitudes, durations, visibility
- **Sports Statistics**: Player performance data with points, assists, rebounds
- **Product Inventory**: E-commerce inventory with prices, stock, categories
- **Transportation Schedules**: Public transit with routes, fares, schedules

### QA Pairs (40+ total)
Each dataset includes 6-8 questions testing:
- **Structured queries**: min/max, comparisons (>, <, >=, <=, =), exact matches
- **Semantic queries**: Natural language understanding, context interpretation

## Usage

### Prerequisites
1. Ensure TaktMate MVP backend is running on `http://localhost:3001`
2. Ensure you have Node.js installed

### Running Tests
```bash
# From the tests directory
npm install
npm test

# Or run directly
node test_runner.js
```

### Test Process
1. **Upload**: Each CSV is uploaded to the backend
2. **Query**: Each question is sent to the search endpoint
3. **Compare**: Results are compared against expected rows
4. **Score**: Partial credit scoring based on correct matches
5. **Analyze**: Failed tests are analyzed for improvement suggestions

## Scoring System

- **Full Credit (1.0)**: All expected rows returned, no extra incorrect rows
- **Partial Credit (0.0-1.0)**: Some expected rows returned, score = (correct rows) ÷ (expected rows)
- **Zero Credit (0.0)**: No expected rows returned

## Output Files

### `scorecard.json`
Comprehensive results with detailed statistics:
```json
{
  "summary": {
    "total_tests": 40,
    "perfect_scores": 32,
    "average_score": 0.875,
    "method_accuracy": 0.90
  },
  "results": [...] 
}
```

### `scorecard.csv`
Summary results in CSV format for analysis:
```csv
dataset,question,expected_count,returned_count,correct_count,score,query_type_expected,retrieval_method_used,method_match
employee_payroll,"Who has the highest salary?",1,1,1,1.000,structured,structured,yes
```

### `error_analysis.txt`
Detailed analysis of failed tests with improvement suggestions:
```
Test 1: employee_payroll - "Find employees with salary > 100000"
Score: 0.500 | Expected: 2 | Returned: 1 | Correct: 1
Query Type: structured | Method Used: structured

Potential Issues:
  - Value extraction may have failed for comparison operators
  
Suggested Improvements:
  - Review numeric value parsing logic
  - Check pattern matching for comparison operators
```

## Key Testing Scenarios

### 1. Structured Query Detection
- Tests if min/max, comparisons, and exact matches are properly identified
- Verifies the hybrid retrieval system works correctly

### 2. Column Relevance Scoring  
- Tests if the system can find relevant columns in unfamiliar datasets
- Validates dynamic column detection beyond tide chart patterns

### 3. Value Extraction
- Tests numeric value parsing from natural language queries
- Validates comparison operators (>, <, >=, <=, =)

### 4. Semantic Fallback
- Tests semantic search when structured queries fail
- Validates natural language understanding

### 5. Table Formatting
- Verifies new table output format works correctly
- Tests column highlighting functionality

### 6. Generalization
- Confirms system works beyond tide chart domain
- Tests with completely different column names and data types

## Expected Performance

### Target Benchmarks
- **Overall Score**: >85% average
- **Structured Queries**: >90% accuracy  
- **Semantic Queries**: >80% accuracy
- **Method Detection**: >85% correct classification

### Common Failure Patterns
1. **Pattern Matching**: Structured queries not recognized
2. **Column Detection**: Wrong columns selected for queries
3. **Value Extraction**: Numeric values not parsed correctly
4. **Semantic Matching**: Poor relevance for domain-specific terms

## Adding New Tests

### New Dataset
1. Create CSV in `datasets/` directory
2. Create corresponding QA file in `qa_pairs/` directory
3. Follow naming convention: `dataset_name.csv` and `dataset_name_qa.json`

### QA Pair Format
```json
{
  "question": "What is the highest salary?",
  "expected_rows": [
    {"employee_id": "E001", "name": "John Doe", "salary": "100000", ...}
  ],
  "relevant_columns": ["name", "salary"],
  "query_type": "structured"
}
```

## Troubleshooting

### Backend Not Running
```
❌ Backend is not running. Please start the backend server first.
```
**Solution**: Start the TaktMate MVP backend: `cd ../backend && npm run dev`

### Upload Failures
```
❌ Failed to upload dataset.csv: Request failed with status code 413
```
**Solution**: Check file size limits or CSV format

### Search Timeouts
**Solution**: Increase axios timeout or check Azure OpenAI API limits

### Method Mismatch
Many tests showing wrong retrieval method suggests pattern detection issues.
**Solution**: Review `STRUCTURED_PATTERNS` in `backend/search.js`
