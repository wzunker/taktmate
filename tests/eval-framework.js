/**
 * TaktMate CSV Chat Evaluation Framework
 * 
 * Automated evaluation system for LLM responses to CSV data queries.
 * Handles normalization, fuzzy matching, and semantic comparison.
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const levenshtein = require('fast-levenshtein');
const natural = require('natural');

class EvalResult {
  constructor(question, modelAnswer, expected, passed, similarityScore, errorMessage = null, bonusScore = 0, bonusReason = null) {
    this.question = question;
    this.modelAnswer = modelAnswer;
    this.expected = expected;
    this.passed = passed;
    this.similarityScore = similarityScore;
    this.bonusScore = bonusScore;           // NEW: 0.5 if bonus criteria met AND primary passed
    this.totalScore = similarityScore + bonusScore; // NEW: Can exceed 1.0
    this.bonusReason = bonusReason;         // NEW: Why bonus was awarded
    this.errorMessage = errorMessage;
    this.timestamp = new Date().toISOString();
  }
}

class ResponseNormalizer {
  constructor() {
    this.dateFormats = [
      /\d{4}-\d{2}-\d{2}/,  // YYYY-MM-DD
      /\d{2}\/\d{2}\/\d{4}/, // MM/DD/YYYY
      /\d{1,2}\s+\w+\s+\d{4}/ // D Month YYYY
    ];
  }

  normalizeNumber(val) {
    if (typeof val === 'number') return val;
    
    const str = String(val).trim();
    // Remove currency symbols, commas
    const cleaned = str.replace(/[$,€£¥]/g, '');
    
    // Extract first number found
    const match = cleaned.match(/-?\d+\.?\d*/);
    if (match) {
      const num = parseFloat(match[0]);
      return isNaN(num) ? null : num;
    }
    
    return null;
  }

  normalizeString(val) {
    if (typeof val !== 'string') val = String(val);
    
    return val
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[.,;:!?"']/g, '');
  }

  normalizeList(text) {
    if (Array.isArray(text)) {
      return text.map(item => this.normalizeString(item)).sort();
    }

    const str = String(text);
    const items = str.split(/[,\n;|]/)
      .map(item => item.trim())
      .filter(item => item.length > 0)
      .map(item => {
        // Remove bullet points, numbers at start
        return item.replace(/^[\d\-\*\+•]\s*/, '');
      })
      .map(item => this.normalizeString(item))
      .filter(item => item.length > 0);

    return [...new Set(items)].sort();
  }

  extractCsvRows(text) {
    const lines = text.trim().split('\n');
    const rows = [];

    for (const line of lines) {
      if (line.includes(',') && !line.endsWith(':')) {
        const values = line.split(',').map(val => val.trim());
        if (values.length >= 2) {
          rows.push(values);
        }
      }
    }

    return rows;
  }

  extractDate(text) {
    const str = String(text);
    
    for (const format of this.dateFormats) {
      const match = str.match(format);
      if (match) {
        const date = new Date(match[0]);
        return isNaN(date.getTime()) ? null : date;
      }
    }
    
    return null;
  }
}

class CSVChatEvaluator {
  constructor(backendUrl = 'http://localhost:3001') {
    this.backendUrl = backendUrl;
    this.normalizer = new ResponseNormalizer();
    this.similarityThreshold = 0.85;
    this.timeout = 30000;
  }

  async uploadCsv(csvPath) {
    try {
      const formData = new FormData();
      formData.append('csvFile', fs.createReadStream(csvPath));

      const response = await axios.post(`${this.backendUrl}/upload`, formData, {
        headers: formData.getHeaders(),
        timeout: this.timeout
      });

      return response.data.fileId;
    } catch (error) {
      throw new Error(`Failed to upload CSV: ${error.message}`);
    }
  }

  async queryModel(fileId, question) {
    try {
      const response = await axios.post(`${this.backendUrl}/chat`, {
        fileId,
        message: question
      }, {
        timeout: this.timeout
      });

      return response.data.reply || '';
    } catch (error) {
      throw new Error(`Failed to query model: ${error.message}`);
    }
  }

  evaluateAnswer(question, modelAnswer, expected, queryType = null) {
    const answerType = expected.answer_type || 'string';
    const expectedValues = expected.valid_values || [];

    try {
      // Check if this is an ordered query that requires positional matching
      const isOrderedQuery = this._isOrderedQuery(queryType);
      
      // Get primary evaluation result
      let result;
      switch (answerType) {
        case 'number':
          result = this._evaluateNumber(question, modelAnswer, expectedValues);
          break;
        case 'list_of_strings':
          if (isOrderedQuery) {
            result = this._evaluateOrderedStringList(question, modelAnswer, expectedValues);
          } else {
            result = this._evaluateStringList(question, modelAnswer, expectedValues, expected.invalid_values);
          }
          break;
        case 'list_of_objects':
          result = this._evaluateObjectList(question, modelAnswer, expectedValues);
          break;
        case 'string':
        case 'strings':
        default:
          result = this._evaluateString(question, modelAnswer, expectedValues);
      }
      
      // CRITICAL: Only check bonus if primary answer is correct
      if (result.passed && expected.bonus) {
        const bonusResult = this._evaluateBonus(question, modelAnswer, expected.bonus);
        if (bonusResult.passed) {
          return new EvalResult(
            result.question,
            result.modelAnswer, 
            result.expected,
            result.passed,
            result.similarityScore,
            result.errorMessage,
            0.5, // Bonus points only awarded when primary is correct
            bonusResult.reason
          );
        }
      }
      
      return result; // Return original result (no bonus if primary failed or bonus not met)
    } catch (error) {
      return new EvalResult(
        question,
        modelAnswer,
        expected,
        false,
        0.0,
        error.message
      );
    }
  }

  _evaluateNumber(question, modelAnswer, expectedValues) {
    // Extract all numbers, but be smart about filtering out irrelevant ones
    const allNumbers = this._extractRelevantNumbers(question, modelAnswer);
    
    if (allNumbers.length === 0) {
      return new EvalResult(
        question,
        modelAnswer,
        { valid_values: expectedValues },
        false,
        0.0,
        'Could not extract any relevant numbers from response'
      );
    }

    // Check if any detected number matches any expected value
    for (const modelNum of allNumbers) {
      for (const expectedVal of expectedValues) {
        const expectedNum = this.normalizer.normalizeNumber(expectedVal);
        if (expectedNum !== null && Math.abs(modelNum - expectedNum) < 1e-6) {
          return new EvalResult(
            question,
            modelAnswer,
            { valid_values: expectedValues },
            true,
            1.0
          );
        }
      }
    }

    // If no exact match found, provide helpful debug info
    return new EvalResult(
      question,
      modelAnswer,
      { valid_values: expectedValues },
      false,
      0.0,
      `Found relevant numbers: [${allNumbers.join(', ')}], expected one of: [${expectedValues.join(', ')}]`
    );
  }

  _evaluateString(question, modelAnswer, expectedValues) {
    const modelNormalized = this.normalizer.normalizeString(modelAnswer);
    let bestScore = 0.0;
    let foundExactMatch = false;

    for (const expectedVal of expectedValues) {
      const expectedNormalized = this.normalizer.normalizeString(String(expectedVal));
      
      // 1. Exact match
      if (modelNormalized === expectedNormalized) {
        return new EvalResult(
          question,
          modelAnswer,
          { valid_values: expectedValues },
          true,
          1.0
        );
      }

      // 2. Substring containment (NEW: for descriptive answers)
      if (modelNormalized.includes(expectedNormalized) || expectedNormalized.includes(modelNormalized)) {
        foundExactMatch = true;
        bestScore = Math.max(bestScore, 1.0);
        continue;
      }

      // 3. Extract numbers and compare (NEW: for numeric values in text)
      if (this._isNumericValue(expectedVal)) {
        const modelNumbers = this._extractNumbers(modelAnswer);
        const expectedNumber = this.normalizer.normalizeNumber(expectedVal);
        
        for (const modelNum of modelNumbers) {
          if (Math.abs(modelNum - expectedNumber) < 1e-6) {
            foundExactMatch = true;
            bestScore = Math.max(bestScore, 1.0);
            break;
          }
        }
        if (foundExactMatch) continue;
      }

      // 4. Fuzzy matching using Levenshtein distance
      const distance = levenshtein.get(modelNormalized, expectedNormalized);
      const maxLen = Math.max(modelNormalized.length, expectedNormalized.length);
      const similarity = maxLen > 0 ? 1 - (distance / maxLen) : 1.0;
      
      // 5. Also try Jaro-Winkler similarity
      const jaroWinkler = natural.JaroWinklerDistance(modelNormalized, expectedNormalized);
      
      const combinedScore = Math.max(similarity, jaroWinkler);
      bestScore = Math.max(bestScore, combinedScore);
    }

    // If we found exact substring matches or number matches, return perfect score
    if (foundExactMatch) {
      return new EvalResult(
        question,
        modelAnswer,
        { valid_values: expectedValues },
        true,
        1.0
      );
    }

    const passed = bestScore >= this.similarityThreshold;

    return new EvalResult(
      question,
      modelAnswer,
      { valid_values: expectedValues },
      passed,
      bestScore
    );
  }

  _evaluateOrderedStringList(question, modelAnswer, expectedValues) {
    const modelList = this._extractOrderedList(modelAnswer);
    const expectedList = expectedValues.map(val => this.normalizer.normalizeString(String(val)));
    
    let correctPositions = 0;
    
    // Compare items positionally
    for (let i = 0; i < expectedList.length; i++) {
      if (i < modelList.length) {
        const similarity = natural.JaroWinklerDistance(modelList[i], expectedList[i]);
        if (similarity >= this.similarityThreshold) {
          correctPositions++;
        }
      }
    }
    
    // Score based on correct positions out of expected length
    const score = expectedList.length > 0 ? correctPositions / expectedList.length : 1.0;
    const passed = score >= 1.0;
    
    let errorMessage = null;
    if (correctPositions < expectedList.length) {
      errorMessage = `Correct order for ${correctPositions}/${expectedList.length} items`;
      if (modelList.length !== expectedList.length) {
        errorMessage += ` (got ${modelList.length} items, expected ${expectedList.length})`;
      }
    }
    
    return new EvalResult(
      question,
      modelAnswer,
      { valid_values: expectedValues },
      passed,
      score,
      errorMessage
    );
  }

  _evaluateStringList(question, modelAnswer, expectedValues, invalidValues = []) {
    const modelList = this.normalizer.normalizeList(modelAnswer);
    const expectedList = expectedValues.map(val => this.normalizer.normalizeString(String(val)));
    const invalidList = invalidValues.map(val => this.normalizer.normalizeString(String(val)));

    let foundItems = 0;
    let invalidItems = 0;
    const foundExpectedItems = new Set(); // Track which expected items we found
    const usedModelItems = new Set(); // Track which model items have been matched
    const foundInvalidItems = new Set(); // Track which invalid items we found
    

    
    // First pass: Find matches with expected items
    for (const expectedItem of expectedList) {
      let itemFound = false;
      let bestMatch = null;
      let bestSimilarity = 0;
      
      // Find the best unused model item for this expected item
      for (const modelItem of modelList) {
        if (usedModelItems.has(modelItem)) continue; // Skip already used items
        
        const similarity = natural.JaroWinklerDistance(modelItem, expectedItem);
        if (similarity >= this.similarityThreshold && similarity > bestSimilarity) {
          bestMatch = modelItem;
          bestSimilarity = similarity;
        }
      }
      
      if (bestMatch && !foundExpectedItems.has(expectedItem)) {
        foundItems++;
        foundExpectedItems.add(expectedItem);
        usedModelItems.add(bestMatch); // Mark this model item as used
        itemFound = true;
      }
    }

    // Second pass: Check remaining model items against invalid values
    if (invalidList.length > 0) {
      for (const modelItem of modelList) {
        if (usedModelItems.has(modelItem)) continue; // Skip already matched items
        
        for (const invalidItem of invalidList) {
          const similarity = natural.JaroWinklerDistance(modelItem, invalidItem);
          if (similarity >= this.similarityThreshold && !foundInvalidItems.has(invalidItem)) {
            invalidItems++;
            foundInvalidItems.add(invalidItem);
            usedModelItems.add(modelItem); // Mark this model item as used
            break; // Move to next model item
          }
        }
      }
    }

    // Calculate score with penalty for invalid items
    const baseScore = expectedList.length > 0 ? foundItems / expectedList.length : 1.0;
    const penalty = invalidList.length > 0 ? invalidItems / expectedList.length : 0;
    const score = Math.max(0, baseScore - penalty);
    
    // Pass only if we found all items and no invalid items (100% accuracy for lists)
    const passed = score >= 1.0;

    // Build error message
    let errorMessage = null;
    if (foundItems < expectedList.length || invalidItems > 0) {
      const parts = [];
      if (foundItems < expectedList.length) {
        parts.push(`Found ${foundItems}/${expectedList.length} expected items`);
      }
      if (invalidItems > 0) {
        parts.push(`${invalidItems} invalid item(s) included`);
      }
      errorMessage = parts.join(', ');
    }

    return new EvalResult(
      question,
      modelAnswer,
      { valid_values: expectedValues, invalid_values: invalidValues },
      passed,
      score,
      errorMessage
    );
  }

  _evaluateObjectList(question, modelAnswer, expectedValues) {
    const csvRows = this.normalizer.extractCsvRows(modelAnswer);
    
    if (csvRows.length === 0) {
      // Fall back to name matching
      const names = expectedValues.map(obj => obj.event_name || String(obj));
      return this._evaluateStringList(question, modelAnswer, names, []);
    }

    const foundObjects = csvRows.length;
    const expectedObjects = expectedValues.length;
    
    // Award proportional credit: each correct object gets 1/total points
    const score = expectedObjects > 0 ? Math.min(1.0, foundObjects / expectedObjects) : 1.0;
    
    // Pass only if we found all expected objects (100% accuracy for object lists)
    const passed = score >= 1.0;

    return new EvalResult(
      question,
      modelAnswer,
      { valid_values: expectedValues },
      passed,
      score,
      foundObjects < expectedObjects ? 
        `Found ${foundObjects}/${expectedObjects} expected objects` : 
        null
    );
  }

  async runEvaluation(csvPath, qaPairsPath) {
    console.log(`🚀 Starting evaluation...`);
    console.log(`📁 CSV: ${csvPath}`);
    console.log(`❓ QA Pairs: ${qaPairsPath}`);
    
    // Clear require cache for QA file to ensure fresh data
    const resolvedQAPath = require('path').resolve(qaPairsPath);
    if (require.cache[resolvedQAPath]) {
      delete require.cache[resolvedQAPath];
    }
    
    // Upload CSV
    const fileId = await this.uploadCsv(csvPath);
    console.log(`✅ CSV uploaded with ID: ${fileId}`);

    // Load QA pairs (will be fresh due to cache clearing above)
    const qaPairs = JSON.parse(require('fs').readFileSync(qaPairsPath, 'utf8'));
    console.log(`📋 Loaded ${qaPairs.length} test cases`);

    const results = [];
    const startTime = Date.now();

    for (let i = 0; i < qaPairs.length; i++) {
      const qaPair = qaPairs[i];
      const { question, expected } = qaPair;
      
      console.log(`\n${'═'.repeat(80)}`);
      console.log(`🔍 [${i + 1}/${qaPairs.length}] ${question}`);
      console.log(`📝 Query Type: ${qaPair.query_type || 'unknown'}`);
      
      // Display expected answer
      console.log(`🎯 Expected (${expected.answer_type}):`);
      if (Array.isArray(expected.valid_values)) {
        if (expected.valid_values.length <= 5) {
          expected.valid_values.forEach((val, idx) => {
            if (typeof val === 'object') {
              console.log(`   ${idx + 1}. ${JSON.stringify(val, null, 2).replace(/\n/g, '\n      ')}`);
            } else {
              console.log(`   ${idx + 1}. "${val}"`);
            }
          });
        } else {
          console.log(`   [${expected.valid_values.length} items]: ${expected.valid_values.slice(0, 3).map(v => `"${v}"`).join(', ')}...`);
        }
      } else {
        console.log(`   "${expected.valid_values}"`);
      }
      
      // Display invalid values if present
      if (expected.invalid_values && expected.invalid_values.length > 0) {
        console.log(`🚫 Invalid (will be penalized):`);
        if (expected.invalid_values.length <= 5) {
          expected.invalid_values.forEach((val, idx) => {
            console.log(`   ${idx + 1}. "${val}"`);
          });
        } else {
          console.log(`   [${expected.invalid_values.length} items]: ${expected.invalid_values.slice(0, 3).map(v => `"${v}"`).join(', ')}...`);
        }
      }
      
      // NEW: Display bonus criteria if present
      if (expected.bonus) {
        console.log(`🎁 Bonus (${expected.bonus.answer_type}):`);
        if (Array.isArray(expected.bonus.valid_values)) {
          expected.bonus.valid_values.slice(0, 3).forEach((val, idx) => {
            console.log(`   ${idx + 1}. "${val}"`);
          });
          if (expected.bonus.valid_values.length > 3) {
            console.log(`   ... and ${expected.bonus.valid_values.length - 3} more`);
          }
        } else {
          console.log(`   "${expected.bonus.valid_values}"`);
        }
      }
      
      try {
        // Query the model
        const modelAnswer = await this.queryModel(fileId, question);
        
        // Display full response without truncation
        console.log(`\n💬 Model Response:`);
        console.log(`${'-'.repeat(40)}`);
        console.log(modelAnswer);
        console.log(`${'-'.repeat(40)}`);
        
        // Evaluate the answer
        const result = this.evaluateAnswer(question, modelAnswer, expected, qaPair.query_type);
        results.push(result);
        
        const status = result.passed ? '✅ PASS' : '❌ FAIL';
        const scoreBar = this.createScoreBar(result.totalScore); // Use total score for display
        console.log(`\n${status} Score: ${result.similarityScore.toFixed(3)} ${scoreBar}`);
        
        // NEW: Display bonus information
        if (result.bonusScore > 0) {
          console.log(`🎁 Bonus: +${result.bonusScore.toFixed(3)} (Total: ${result.totalScore.toFixed(3)})`);
          console.log(`   ✨ ${result.bonusReason}`);
        }
        
        if (result.errorMessage) {
          if (result.errorMessage.includes('invalid item(s) included')) {
            console.log(`⚠️  Penalty Applied: ${result.errorMessage}`);
          } else {
            console.log(`⚠️  Error: ${result.errorMessage}`);
          }
        }
        
        // Show comparison for failed tests
        if (!result.passed && result.similarityScore > 0) {
          console.log(`🔍 Analysis: Partial match detected but below threshold (${this.similarityThreshold})`);
        }
        
      } catch (error) {
        console.log(`💥 Error: ${error.message}`);
        results.push(new EvalResult(
          question,
          '',
          expected,
          false,
          0.0,
          error.message
        ));
      }
    }

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;

    // Calculate summary statistics (using total scores)
    const totalTests = results.length;
    const passedTests = results.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;
    const accuracy = totalTests > 0 ? passedTests / totalTests : 0;
    const avgScore = totalTests > 0 ? 
      results.reduce((sum, r) => sum + r.similarityScore, 0) / totalTests : 0;
    const avgTotalScore = totalTests > 0 ?
      results.reduce((sum, r) => sum + r.totalScore, 0) / totalTests : 0;
    const avgBonusScore = totalTests > 0 ?
      results.reduce((sum, r) => sum + r.bonusScore, 0) / totalTests : 0;
    const bonusTests = results.filter(r => r.bonusScore > 0).length;
    
    // Calculate possible bonus score by counting questions with bonus sections
    const possibleBonusScore = qaPairs.filter(qa => qa.expected && qa.expected.bonus).length * 0.5;
    const totalBonusScore = results.reduce((sum, r) => sum + r.bonusScore, 0);

    const summary = {
      totalTests,
      passedTests,
      failedTests,
      accuracy,
      averageSimilarityScore: avgScore,
      averageTotalScore: avgTotalScore,
      averageBonusScore: avgBonusScore,
      bonusTests,
      possibleBonusScore,
      totalBonusScore,
      duration,
      results,
      timestamp: new Date().toISOString()
    };

    console.log(`\n${'═'.repeat(80)}`);
    console.log(`📊 EVALUATION SUMMARY`);
    console.log(`${'═'.repeat(80)}`);
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests} ✅`);
    console.log(`Failed: ${failedTests} ❌`);
    console.log(`Accuracy: ${(accuracy * 100).toFixed(1)}%`);
    console.log(`Avg Base Score: ${avgScore.toFixed(3)}`);
    console.log(`Avg Bonus Score: ${avgBonusScore.toFixed(3)}`);
    console.log(`Avg Total Score: ${avgTotalScore.toFixed(3)}`);
    console.log(`Bonus Awards: ${bonusTests}/${totalTests}`);
    console.log(`Duration: ${duration.toFixed(1)}s`);

    return summary;
  }

  // Helper method to create visual score bar
  createScoreBar(score) {
    const width = 20;
    const filled = Math.min(width, Math.max(0, Math.round(score * width))); // Clamp to valid range
    const empty = Math.max(0, width - filled);
    
    let bar = '[';
    bar += '█'.repeat(filled);
    bar += '░'.repeat(empty);
    bar += ']';
    
    // Handle bonus scores > 1.0 with special indicator
    if (score > 1.0) {
      return `🌟 ${bar} (${score.toFixed(3)})`;
    } else if (score >= 0.85) {
      return `🟢 ${bar}`;
    } else if (score >= 0.6) {
      return `🟡 ${bar}`;
    } else {
      return `🔴 ${bar}`;
    }
  }

  // Bonus evaluation methods (NEW)
  _evaluateBonus(question, modelAnswer, bonusExpected) {
    const bonusType = bonusExpected.answer_type || 'string';
    const bonusValues = bonusExpected.valid_values || [];
    
    // Reuse existing evaluation logic for bonus criteria
    switch (bonusType) {
      case 'number':
        return this._evaluateBonusNumber(modelAnswer, bonusValues);
      case 'list_of_strings':
        return this._evaluateBonusStringList(modelAnswer, bonusValues);
      case 'string':
      case 'strings':
      default:
        return this._evaluateBonusString(modelAnswer, bonusValues);
    }
  }

  _evaluateBonusString(modelAnswer, bonusValues) {
    const modelNormalized = this.normalizer.normalizeString(modelAnswer);
    
    for (const bonusVal of bonusValues) {
      const bonusNormalized = this.normalizer.normalizeString(String(bonusVal));
      
      // Check for substring containment
      if (modelNormalized.includes(bonusNormalized)) {
        return { passed: true, reason: `Found "${bonusVal}" in response` };
      }
      
      // Check for numeric values in text
      if (this._isNumericValue(bonusVal)) {
        const modelNumbers = this._extractNumbers(modelAnswer);
        const expectedNumber = this.normalizer.normalizeNumber(bonusVal);
        
        for (const modelNum of modelNumbers) {
          if (Math.abs(modelNum - expectedNumber) < 1e-6) {
            return { passed: true, reason: `Found number "${bonusVal}" in response` };
          }
        }
      }
    }
    
    return { passed: false, reason: `Bonus criteria not met` };
  }

  _evaluateBonusNumber(modelAnswer, bonusValues) {
    const allNumbers = this._extractRelevantNumbers('', modelAnswer);
    
    for (const bonusVal of bonusValues) {
      const expectedNum = this.normalizer.normalizeNumber(bonusVal);
      if (expectedNum !== null) {
        for (const modelNum of allNumbers) {
          if (Math.abs(modelNum - expectedNum) < 1e-6) {
            return { passed: true, reason: `Found bonus number "${bonusVal}"` };
          }
        }
      }
    }
    
    return { passed: false, reason: `Bonus number criteria not met` };
  }

  _evaluateBonusStringList(modelAnswer, bonusValues) {
    const modelList = this.normalizer.normalizeList(modelAnswer);
    
    for (const bonusVal of bonusValues) {
      const bonusNormalized = this.normalizer.normalizeString(String(bonusVal));
      
      for (const modelItem of modelList) {
        const similarity = natural.JaroWinklerDistance(modelItem, bonusNormalized);
        if (similarity >= this.similarityThreshold) {
          return { passed: true, reason: `Found "${bonusVal}" in response list` };
        }
      }
    }
    
    return { passed: false, reason: `Bonus list criteria not met` };
  }

  // Helper methods (NEW)
  _isOrderedQuery(queryType) {
    if (!queryType) return false;
    
    const orderedQueryTypes = [
      'greater_equal', 'greater', 'less_equal', 'less',
      'before_date', 'after_date', 'between_dates',
      'latest_n', 'earliest_n', 'sort_asc', 'sort_desc'
    ];
    
    return orderedQueryTypes.includes(queryType);
  }

  _isNumericValue(value) {
    return this.normalizer.normalizeNumber(value) !== null;
  }

  _extractNumbers(text) {
    const numbers = [];
    
    // Handle comma-separated numbers like "2,810" by first replacing them
    // Only replace commas in number contexts (digit,digit patterns)
    const processedText = text.replace(/\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b/g, (match) => {
      return match.replace(/,/g, '');
    });
    
    // Extract numbers from processed text
    const numberRegex = /-?\d+\.?\d*/g;
    let match;
    
    while ((match = numberRegex.exec(processedText)) !== null) {
      const num = parseFloat(match[0]);
      if (!isNaN(num)) {
        numbers.push(num);
      }
    }
    
    return numbers;
  }

  _extractOrderedList(text) {
    // Similar to normalizeList but preserves order
    if (Array.isArray(text)) {
      return text.map(item => this.normalizer.normalizeString(item));
    }

    const str = String(text);
    
    // Check if this looks like CSV data (multiple commas per line)
    const lines = str.split('\n').filter(line => line.trim().length > 0);
    const isCsvLike = lines.some(line => (line.match(/,/g) || []).length >= 3);
    
    if (isCsvLike) {
      // For CSV-like responses, extract the second column (usually names)
      return lines
        .map(line => {
          const columns = line.split(',').map(col => col.trim());
          // Return the second column if it exists and looks like a name
          if (columns.length >= 2) {
            const secondCol = columns[1];
            // Check if it's likely a name (contains letters, not just numbers)
            // Also skip common header words
            if (/[a-zA-Z]/.test(secondCol) && 
                !/^\d+$/.test(secondCol) &&
                !['player_name', 'event_name', 'name', 'title'].includes(secondCol.toLowerCase())) {
              return this.normalizer.normalizeString(secondCol);
            }
          }
          return null;
        })
        .filter(item => item !== null);
    } else {
      // For non-CSV responses, use the original logic
      const items = str.split(/[,\n;|]/)
        .map(item => item.trim())
        .filter(item => item.length > 0)
        .map(item => {
          // Remove bullet points, numbers at start
          return item.replace(/^[\d\-\*\+•]\s*/, '');
        })
        .map(item => this.normalizer.normalizeString(item))
        .filter(item => item.length > 0);

      // Remove duplicates while preserving order
      const seen = new Set();
      return items.filter(item => {
        if (seen.has(item)) return false;
        seen.add(item);
        return true;
      });
    }
  }

  _extractRelevantNumbers(question, text) {
    const allNumbers = this._extractNumbers(text);
    const lowerQuestion = question.toLowerCase();
    const lowerText = text.toLowerCase();
    
    // Filter out numbers that are clearly part of dates
    const filteredNumbers = allNumbers.filter(num => !this._isPartOfDate(num, text));
    
    // For day-related questions, prioritize smaller reasonable numbers
    if (lowerQuestion.includes('day') || lowerQuestion.includes('days')) {
      // Look for numbers that are explicitly mentioned with "days"
      const dayNumbers = this._extractNumbersWithContext(text, ['days?', 'day']);
      if (dayNumbers.length > 0) {
        return dayNumbers;
      }
      
      // Otherwise, filter to reasonable day ranges and exclude obvious non-day numbers
      return filteredNumbers.filter(num => {
        return num >= 0 && num <= 1000 && // Reasonable day range
               num < 1900; // Exclude years
      });
    }
    
    // For count questions, prioritize smaller integers
    if (lowerQuestion.includes('how many') || lowerQuestion.includes('count')) {
      return filteredNumbers.filter(num => {
        return Number.isInteger(num) && 
               num >= 0 && 
               num <= 1000 &&
               num < 1900; // Exclude years
      });
    }
    
    // For other questions, return filtered numbers (excluding date components)
    return filteredNumbers;
  }

  _isPartOfDate(number, text) {
    // Check if this number appears in a date context
    const numberStr = number.toString();
    
    // Look for date patterns around this number
    const datePatterns = [
      new RegExp(`\\b${numberStr}[-/]\\d{1,2}[-/]\\d{2,4}\\b`), // number-MM-YYYY or number/MM/YYYY
      new RegExp(`\\b\\d{2,4}[-/]${numberStr}[-/]\\d{1,4}\\b`), // YYYY-number-DD or MM/number/YYYY  
      new RegExp(`\\b\\d{2,4}[-/]\\d{1,2}[-/]${numberStr}\\b`), // YYYY-MM-number or MM/DD/number
      new RegExp(`\\b${numberStr}\\s+(january|february|march|april|may|june|july|august|september|october|november|december)\\s+\\d{4}`, 'i'), // number Month YYYY
      new RegExp(`\\b(january|february|march|april|may|june|july|august|september|october|november|december)\\s+${numberStr}\\s*,?\\s*\\d{4}`, 'i') // Month number, YYYY
    ];
    
    // Also check if it's a 4-digit year
    if (number >= 1900 && number <= 2100 && Number.isInteger(number)) {
      return true;
    }
    
    // Check if number appears in any date pattern
    return datePatterns.some(pattern => pattern.test(text));
  }

  _extractNumbersWithContext(text, contextWords) {
    const numbers = [];
    
    for (const contextWord of contextWords) {
      // Look for "X days" or "X day" patterns
      const pattern = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${contextWord}\\b`, 'gi');
      let match;
      
      while ((match = pattern.exec(text)) !== null) {
        const num = parseFloat(match[1]);
        if (!isNaN(num)) {
          numbers.push(num);
        }
      }
      
      // Also look for "days: X" or "day count: X" patterns
      const reversePattern = new RegExp(`${contextWord}[:\\s]+(\\d+(?:\\.\\d+)?)`, 'gi');
      let reverseMatch;
      
      while ((reverseMatch = reversePattern.exec(text)) !== null) {
        const num = parseFloat(reverseMatch[1]);
        if (!isNaN(num)) {
          numbers.push(num);
        }
      }
    }
    
    return [...new Set(numbers)]; // Remove duplicates
  }
}

module.exports = {
  CSVChatEvaluator,
  EvalResult,
  ResponseNormalizer
};
