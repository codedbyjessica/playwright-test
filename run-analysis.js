#!/usr/bin/env node

/**
 * Convenience script to run both GTM Click Tracker and ARD Analysis
 * 
 * Usage:
 *   node run-analysis.js <url> [options]
 * 
 * Example:
 *   node run-analysis.js https://www.example.com --headless
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class AnalysisRunner {
  constructor() {
    this.url = null;
    this.options = {
      headless: false,
      clickPause: 8000
    };
  }

  parseArguments() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
      this.showUsage();
      process.exit(1);
    }

    this.url = args[0];
    
    // Parse options
    args.slice(1).forEach(arg => {
      if (arg === '--headless') {
        this.options.headless = true;
      } else if (arg.startsWith('--click-pause=')) {
        const pauseValue = parseInt(arg.split('=')[1]);
        if (!isNaN(pauseValue) && pauseValue > 0) {
          this.options.clickPause = pauseValue;
        }
      }
    });
  }

  showUsage() {
    console.log('Usage: node run-analysis.js <url> [options]');
    console.log('');
    console.log('Options:');
    console.log('  --headless     Run browser in headless mode');
    console.log('  --click-pause  Pause after each click in milliseconds (default: 8000)');
    console.log('');
    console.log('Example:');
    console.log('  node run-analysis.js https://www.example.com --headless');
    console.log('  node run-analysis.js https://www.example.com --click-pause=5000');
  }

  async runCommand(command, args, description) {
    return new Promise((resolve, reject) => {
      console.log(`\n🚀 ${description}...`);
      console.log(`Command: ${command} ${args.join(' ')}`);
      
      const child = spawn(command, args, {
        stdio: 'inherit',
        shell: true
      });

      child.on('close', (code) => {
        if (code === 0) {
          console.log(`✅ ${description} completed successfully`);
          resolve();
        } else {
          console.error(`❌ ${description} failed with exit code ${code}`);
          reject(new Error(`Command failed with exit code ${code}`));
        }
      });

      child.on('error', (error) => {
        console.error(`❌ Error running ${description}:`, error.message);
        reject(error);
      });
    });
  }

  async runGTMClickTracker() {
    const args = [this.url];
    
    if (this.options.headless) {
      args.push('--headless');
    }
    
    if (this.options.clickPause !== 8000) {
      args.push(`--click-pause=${this.options.clickPause}`);
    }

    await this.runCommand('node', ['gtm-click-tracker.js', ...args], 'GTM Click Tracker');
  }

  async runARDAnalysis() {
    await this.runCommand('node', ['ard-analysis.js'], 'ARD Analysis');
  }

  async checkPrerequisites() {
    console.log('🔍 Checking prerequisites...');
    
    // Check if required files exist
    const requiredFiles = ['gtm-click-tracker.js', 'ard-analysis.js', 'ARD.csv'];
    const missingFiles = requiredFiles.filter(file => !fs.existsSync(file));
    
    if (missingFiles.length > 0) {
      console.error('❌ Missing required files:', missingFiles.join(', '));
      console.error('Please ensure all required files are present in the current directory.');
      process.exit(1);
    }

    // Check if test-results directory exists (will be created by GTM tracker)
    if (!fs.existsSync('test-results')) {
      console.log('📁 test-results directory will be created automatically');
    }

    console.log('✅ Prerequisites check passed');
  }

  async run() {
    try {
      console.log('🎯 GTM Click Tracker & ARD Analysis Runner');
      console.log('==========================================');
      
      this.parseArguments();
      await this.checkPrerequisites();
      
      console.log(`\n📋 Analysis Configuration:`);
      console.log(`   URL: ${this.url}`);
      console.log(`   Headless: ${this.options.headless}`);
      console.log(`   Click Pause: ${this.options.clickPause}ms`);
      
      // Step 1: Run GTM Click Tracker
      await this.runGTMClickTracker();
      
      // Step 2: Run ARD Analysis
      await this.runARDAnalysis();
      
      console.log('\n🎉 Analysis completed successfully!');
      console.log('\n📊 Generated Reports:');
      
      // List generated reports
      if (fs.existsSync('test-results')) {
        const files = fs.readdirSync('test-results');
        const htmlReports = files.filter(file => file.endsWith('.html'));
        const csvReports = files.filter(file => file.endsWith('.csv'));
        const jsonReports = files.filter(file => file.endsWith('.json'));
        
        if (htmlReports.length > 0) {
          console.log('   HTML Reports:');
          htmlReports.forEach(file => console.log(`     - test-results/${file}`));
        }
        
        if (csvReports.length > 0) {
          console.log('   CSV Reports:');
          csvReports.forEach(file => console.log(`     - test-results/${file}`));
        }
        
        if (jsonReports.length > 0) {
          console.log('   JSON Reports:');
          jsonReports.forEach(file => console.log(`     - test-results/${file}`));
        }
      }
      
      console.log('\n📖 Next Steps:');
      console.log('   1. Open the HTML reports in your browser to review results');
      console.log('   2. Check the ARD analysis for compliance gaps');
      console.log('   3. Address any missing tracking requirements');
      
    } catch (error) {
      console.error('\n❌ Analysis failed:', error.message);
      process.exit(1);
    }
  }
}

// Run the analysis
const runner = new AnalysisRunner();
runner.run(); 