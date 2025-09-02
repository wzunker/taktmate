#!/usr/bin/env node

/**
 * TaktMate Evaluation Runner
 * 
 * Command-line interface for running automated evaluations
 */

const { program } = require('commander');
const chalk = require('chalk');
const Table = require('cli-table3');
const fs = require('fs');
const path = require('path');
const { CSVChatEvaluator } = require('./eval-framework');

class EvalRunner {
  constructor() {
    this.evaluator = new CSVChatEvaluator();
    this.resultsDir = path.join(__dirname, 'results');
    
    // Ensure results directory exists
    if (!fs.existsSync(this.resultsDir)) {
      fs.mkdirSync(this.resultsDir, { recursive: true });
    }
  }

  /**
   * Clear Node.js module cache for QA files to ensure fresh data on each run
   */
  clearQAFileCache(datasetName) {
    const qaPath = path.resolve(__dirname, 'qa_pairs', `${datasetName}_qa.json`);
    
    // Delete from require cache if it exists
    if (require.cache[qaPath]) {
      delete require.cache[qaPath];
      console.log(chalk.gray(`🔄 Cleared cache for ${datasetName}_qa.json`));
    }
    
    // Also clear any related cached modules in the qa_pairs directory
    Object.keys(require.cache).forEach(cachedPath => {
      if (cachedPath.includes('qa_pairs') && cachedPath.includes(`${datasetName}_qa.json`)) {
        delete require.cache[cachedPath];
      }
    });
  }

  async runSingleEvaluation(datasetName) {
    // Clear Node.js module cache for QA files to ensure fresh data
    this.clearQAFileCache(datasetName);
    
    const csvPath = path.join(__dirname, 'datasets', `${datasetName}.csv`);
    const qaPath = path.join(__dirname, 'qa_pairs', `${datasetName}_qa.json`);
    
    if (!fs.existsSync(csvPath)) {
      throw new Error(`CSV file not found: ${csvPath}`);
    }
    
    if (!fs.existsSync(qaPath)) {
      throw new Error(`QA file not found: ${qaPath}`);
    }

    console.log(chalk.blue.bold(`\n🧪 EVALUATING: ${datasetName.toUpperCase()}`));
    console.log(chalk.gray('═'.repeat(50)));

    const results = await this.evaluator.runEvaluation(csvPath, qaPath);
    
    // Save detailed results
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const resultsFile = path.join(this.resultsDir, `${datasetName}_${timestamp}.json`);
    
    // Convert EvalResult objects to plain objects for JSON serialization
    const serializable = {
      ...results,
      results: results.results.map(r => ({
        question: r.question,
        modelAnswer: r.modelAnswer,
        expected: r.expected,
        passed: r.passed,
        similarityScore: r.similarityScore,
        bonusScore: r.bonusScore || 0,
        totalScore: r.totalScore || r.similarityScore,
        bonusReason: r.bonusReason,
        errorMessage: r.errorMessage,
        timestamp: r.timestamp
      }))
    };
    
    fs.writeFileSync(resultsFile, JSON.stringify(serializable, null, 2));
    console.log(chalk.green(`\n💾 Results saved to: ${resultsFile}`));

    // Load QA data for bonus option checking
    const qaFile = path.join(__dirname, 'qa_pairs', `${datasetName}_qa.json`);
    let qaData = null;
    try {
      qaData = JSON.parse(fs.readFileSync(qaFile, 'utf8'));
    } catch (error) {
      console.log(chalk.yellow('⚠️  Could not load QA data for bonus checking'));
    }
    
    this.displayDetailedResults(results, qaData);
    
    return results;
  }

  async runAllEvaluations() {
    const datasetsDir = path.join(__dirname, 'datasets');
    const datasets = fs.readdirSync(datasetsDir)
      .filter(file => file.endsWith('.csv'))
      .map(file => file.replace('.csv', ''));

    console.log(chalk.blue.bold('\n🚀 RUNNING ALL EVALUATIONS'));
    console.log(chalk.gray(`Found ${datasets.length} datasets: ${datasets.join(', ')}`));

    const allResults = [];

    for (const dataset of datasets) {
      try {
        const results = await this.runSingleEvaluation(dataset);
        allResults.push({ dataset, results });
      } catch (error) {
        console.log(chalk.red(`❌ Failed to evaluate ${dataset}: ${error.message}`));
        allResults.push({ 
          dataset, 
          results: { 
            totalTests: 0, 
            passedTests: 0, 
            accuracy: 0, 
            error: error.message 
          } 
        });
      }
    }

    this.displaySummaryTable(allResults);
    return allResults;
  }

  displayDetailedResults(results, qaData = null) {
    console.log(chalk.yellow.bold('\n📋 DETAILED RESULTS'));
    
    const table = new Table({
      head: [
        chalk.white.bold('Question'),
        chalk.white.bold('Status'),
        chalk.white.bold('Base'),
        chalk.white.bold('Bonus'),
        chalk.white.bold('Total'),
        chalk.white.bold('Notes')
      ],
      colWidths: [45, 8, 8, 8, 8, 35],
      wordWrap: true
    });

    for (const result of results.results) {
      const status = result.passed ? 
        chalk.green.bold('PASS') : 
        chalk.red.bold('FAIL');
      
      const baseScore = result.similarityScore.toFixed(3);
      const baseScoreColored = result.passed ? 
        chalk.green(baseScore) : 
        chalk.red(baseScore);
      
      // Check if bonus is available for this question
      let hasBonusOption = false;
      if (qaData) {
        // Find the matching QA pair to check if bonus exists
        const qaPair = qaData.find(qa => qa.question === result.question);
        hasBonusOption = qaPair && qaPair.expected && qaPair.expected.bonus;
      } else {
        // Fallback: check if there's any bonus-related data in the result
        hasBonusOption = (result.bonusScore && result.bonusScore > 0) || result.bonusReason;
      }
      
      let bonusScoreColored;
      if (!hasBonusOption) {
        bonusScoreColored = chalk.gray('N/A');
      } else {
        const bonusScore = (result.bonusScore || 0).toFixed(3);
        bonusScoreColored = (result.bonusScore || 0) > 0 ? 
          chalk.yellow.bold(bonusScore) : 
          chalk.gray(bonusScore);
      }
      
      const totalScore = (result.totalScore || result.similarityScore).toFixed(3);
      const totalScoreColored = (result.totalScore || result.similarityScore) > 1.0 ?
        chalk.magenta.bold(totalScore) :
        result.passed ? chalk.green(totalScore) : chalk.red(totalScore);
      
      let notes = result.errorMessage || (result.passed ? 'Correct' : 'Incorrect/Incomplete');
      
      // Add bonus reason to notes if present
      if (result.bonusReason) {
        notes = `${notes} | 🎁 ${result.bonusReason}`;
      }

      table.push([
        result.question,
        status,
        baseScoreColored,
        bonusScoreColored,
        totalScoreColored,
        notes
      ]);
    }

    console.log(table.toString());
  }

  displaySummaryTable(allResults) {
    console.log(chalk.blue.bold('\n📊 EVALUATION SUMMARY'));
    
    const table = new Table({
      head: [
        chalk.white.bold('Dataset'),
        chalk.white.bold('Tests'),
        chalk.white.bold('Passed'),
        chalk.white.bold('Failed'),
        chalk.white.bold('Accuracy'),
        chalk.white.bold('Bonus Score')
      ],
      colWidths: [25, 8, 8, 8, 10, 15]
    });

    for (const { dataset, results } of allResults) {
      if (results.error) {
        table.push([
          dataset,
          chalk.gray('N/A'),
          chalk.gray('N/A'),
          chalk.gray('N/A'),
          chalk.red('ERROR'),
          chalk.gray('N/A')
        ]);
      } else {
        const accuracy = `${(results.accuracy * 100).toFixed(1)}%`;
        const accuracyColored = results.accuracy >= 0.8 ? 
          chalk.green(accuracy) : 
          results.accuracy >= 0.6 ? 
            chalk.yellow(accuracy) : 
            chalk.red(accuracy);

        // Calculate bonus ratio: actual bonus score / possible bonus score
        const actualBonusScore = results.totalBonusScore || 0;
        const possibleBonusScore = results.possibleBonusScore || 0;
        
        let bonusRatio;
        if (possibleBonusScore > 0) {
          bonusRatio = actualBonusScore > 0 ? 
            chalk.yellow.bold(`${actualBonusScore.toFixed(1)}/${possibleBonusScore.toFixed(1)}`) : 
            chalk.gray(`0/${possibleBonusScore.toFixed(1)}`);
        } else {
          bonusRatio = chalk.gray('0/0');
        }

        table.push([
          dataset,
          results.totalTests,
          chalk.green(results.passedTests),
          results.failedTests > 0 ? chalk.red(results.failedTests) : '0',
          accuracyColored,
          bonusRatio
        ]);
      }
    }

    console.log(table.toString());
  }

  async checkBackendHealth() {
    try {
      const axios = require('axios');
      const response = await axios.get(`${this.evaluator.backendUrl}/health`, {
        timeout: 5000
      });
      return response.status === 200;
    } catch (error) {
      console.log(chalk.red('❌ Backend health check failed:'));
      console.log(chalk.red(`   ${error.message}`));
      console.log(chalk.yellow('\n💡 Make sure your backend is running:'));
      console.log(chalk.gray('   cd backend && npm run dev'));
      return false;
    }
  }
}

// CLI setup
program
  .name('eval-runner')
  .description('TaktMate CSV Chat Evaluation Runner')
  .version('1.0.0');

program
  .option('-d, --dataset <name>', 'run evaluation for specific dataset')
  .option('-a, --all', 'run evaluation for all datasets')
  .option('--no-health-check', 'skip backend health check')
  .action(async (options) => {
    const runner = new EvalRunner();

    // Health check
    if (options.healthCheck !== false) {
      console.log(chalk.blue('🔍 Checking backend health...'));
      const healthy = await runner.checkBackendHealth();
      if (!healthy) {
        process.exit(1);
      }
      console.log(chalk.green('✅ Backend is healthy'));
    }

    try {
      if (options.all) {
        await runner.runAllEvaluations();
      } else if (options.dataset) {
        await runner.runSingleEvaluation(options.dataset);
      } else {
        // Default to astronomy_events
        await runner.runSingleEvaluation('astronomy_events');
      }
    } catch (error) {
      console.log(chalk.red.bold('\n💥 Evaluation failed:'));
      console.log(chalk.red(error.message));
      process.exit(1);
    }
  });

// Handle no arguments
if (process.argv.length === 2) {
  program.help();
}

program.parse();
