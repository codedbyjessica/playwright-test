/**
 * Batch Site Tracker
 * 
 * This script runs full site testing on multiple websites from a JSON configuration file.
 * Perfect for overnight batch processing of multiple sites.
 * 
 * Features:
 * - Tests multiple websites sequentially
 * - Configurable per-site options (filters, limits, form configs)
 * - Comprehensive batch summary report
 * - Email notification support (optional)
 * - Resume from last failure
 * - Detailed logging
 * 
 * Usage:
 *   node batch-tracker.js <config-file.json> [options]
 * 
 * Examples:
 *   node batch-tracker.js sites.json --headless
 *   node batch-tracker.js sites.json --headless --resume
 * 
 * Options:
 *   --headless              Run in headless mode
 *   --resume                Resume from last incomplete run
 *   --notify=EMAIL          Send completion email (requires nodemailer setup)
 * 
 * Config File Format (sites.json):
 * {
 *   "sites": [
 *     {
 *       "name": "Example Site",
 *       "baseUrl": "https://www.example.com",
 *       "enabled": true,
 *       "options": {
 *         "limit": 50,
 *         "filter": null,
 *         "exclude": "/blog/",
 *         "formConfig": null
 *       }
 *     }
 *   ]
 * }
 * 
 * @author AI Assistant
 * @version 1.0
 */

const { execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class BatchTracker {
  constructor(configPath, options = {}) {
    this.configPath = configPath;
    this.options = {
      headless: options.headless !== false,
      resume: options.resume || false,
      notify: options.notify || null,
      ...options
    };
    
    this.sites = [];
    this.results = {
      total: 0,
      completed: 0,
      failed: 0,
      skipped: 0,
      sites: []
    };
    this.startTime = Date.now();
    this.stateFile = path.join(__dirname, 'test-results', '.batch-tracker-state.json');
  }

  /**
   * Load configuration from JSON file
   */
  async loadConfig() {
    console.log(`📋 Loading configuration from: ${this.configPath}`);
    
    try {
      const configContent = await fs.readFile(this.configPath, 'utf-8');
      const config = JSON.parse(configContent);
      
      if (!config.sites || !Array.isArray(config.sites)) {
        throw new Error('Config file must contain a "sites" array');
      }
      
      // Filter enabled sites
      this.sites = config.sites.filter(site => site.enabled !== false);
      this.results.total = this.sites.length;
      
      console.log(`✅ Loaded ${this.sites.length} enabled sites`);
      
      // Show sites list
      console.log(`\n📍 Sites to test:`);
      this.sites.forEach((site, idx) => {
        console.log(`   ${idx + 1}. ${site.name} - ${site.baseUrl}`);
        if (site.options?.limit) console.log(`      └─ Limit: ${site.options.limit} URLs`);
        if (site.options?.filter) console.log(`      └─ Filter: ${site.options.filter}`);
        if (site.options?.exclude) console.log(`      └─ Exclude: ${site.options.exclude}`);
      });
      
      return this.sites;
      
    } catch (error) {
      console.error('❌ Error loading config:', error.message);
      throw error;
    }
  }

  /**
   * Load previous state for resume functionality
   */
  async loadState() {
    if (!this.options.resume) {
      return null;
    }
    
    try {
      const stateContent = await fs.readFile(this.stateFile, 'utf-8');
      const state = JSON.parse(stateContent);
      console.log(`\n🔄 Resuming from previous run...`);
      console.log(`   Last run: ${new Date(state.lastRun).toLocaleString()}`);
      console.log(`   Completed: ${state.completedSites.length} sites`);
      return state;
    } catch (error) {
      console.log(`\nℹ️  No previous state found, starting fresh`);
      return null;
    }
  }

  /**
   * Save current state for resume functionality
   */
  async saveState(completedSites) {
    try {
      await fs.mkdir(path.join(__dirname, 'test-results'), { recursive: true });
      await fs.writeFile(
        this.stateFile,
        JSON.stringify({
          lastRun: new Date().toISOString(),
          completedSites,
          totalSites: this.sites.length
        }, null, 2)
      );
    } catch (error) {
      console.error(`⚠️  Could not save state: ${error.message}`);
    }
  }

  /**
   * Clear state file after successful completion
   */
  async clearState() {
    try {
      await fs.unlink(this.stateFile);
    } catch (error) {
      // File doesn't exist, ignore
    }
  }

  /**
   * Test a single site using fullsite-tracker.js
   */
  async testSite(site, index) {
    const siteNumber = index + 1;
    const totalSites = this.sites.length;
    
    console.log(`\n${'='.repeat(100)}`);
    console.log(`🌐 Testing Site ${siteNumber}/${totalSites}: ${site.name}`);
    console.log(`📄 ${site.baseUrl}`);
    console.log(`${'='.repeat(100)}`);
    
    const testStart = Date.now();
    
    try {
      // Build command
      let command = `node fullsite-tracker.js "${site.baseUrl}"`;
      
      if (this.options.headless) {
        command += ' --headless';
      }
      
      // Add site-specific options
      if (site.options?.limit) {
        command += ` --limit=${site.options.limit}`;
      }
      
      if (site.options?.filter) {
        command += ` --filter="${site.options.filter}"`;
      }
      
      if (site.options?.exclude) {
        command += ` --exclude="${site.options.exclude}"`;
      }
      
      if (site.options?.formConfig) {
        command += ` --form-config=${site.options.formConfig}`;
      }
      
      // Run the tracker
      console.log(`🚀 Running: ${command}\n`);
      execSync(command, { 
        stdio: 'inherit',
        encoding: 'utf-8',
        timeout: 7200000 // 2 hours max per site
      });
      
      const testDuration = Date.now() - testStart;
      
      this.results.completed++;
      this.results.sites.push({
        name: site.name,
        baseUrl: site.baseUrl,
        status: 'success',
        duration: testDuration,
        timestamp: new Date().toISOString()
      });
      
      console.log(`\n✅ Site ${siteNumber}/${totalSites} completed in ${(testDuration/1000).toFixed(1)}s (${(testDuration/60000).toFixed(1)} minutes)`);
      
      // Save state after each successful site
      await this.saveState(this.results.sites.filter(s => s.status === 'success').map(s => s.baseUrl));
      
    } catch (error) {
      const testDuration = Date.now() - testStart;
      
      this.results.failed++;
      this.results.sites.push({
        name: site.name,
        baseUrl: site.baseUrl,
        status: 'failed',
        error: error.message,
        duration: testDuration,
        timestamp: new Date().toISOString()
      });
      
      console.error(`\n❌ Site ${siteNumber}/${totalSites} failed after ${(testDuration/1000).toFixed(1)}s`);
      console.error(`   Error: ${error.message}`);
      console.log('   Continuing with next site...');
    }
  }

  /**
   * Generate batch summary report
   */
  async generateBatchSummary() {
    const totalDuration = Date.now() - this.startTime;
    
    console.log(`\n\n${'='.repeat(100)}`);
    console.log('📊 BATCH TESTING SUMMARY');
    console.log(`${'='.repeat(100)}`);
    console.log(`\n⏱️  Start Time: ${new Date(this.startTime).toLocaleString()}`);
    console.log(`⏱️  End Time: ${new Date().toLocaleString()}`);
    console.log(`⏱️  Total Duration: ${(totalDuration/1000).toFixed(1)}s (${(totalDuration/60000).toFixed(1)} minutes)`);
    console.log(`\n📈 Results:`);
    console.log(`   Total Sites: ${this.results.total}`);
    console.log(`   ✅ Completed: ${this.results.completed}`);
    console.log(`   ❌ Failed: ${this.results.failed}`);
    console.log(`   ⏭️  Skipped: ${this.results.skipped}`);
    console.log(`   Success Rate: ${((this.results.completed / this.results.total) * 100).toFixed(1)}%`);
    
    // Show completed sites
    if (this.results.completed > 0) {
      console.log(`\n✅ Completed Sites:`);
      this.results.sites
        .filter(result => result.status === 'success')
        .forEach((result, idx) => {
          console.log(`   ${idx + 1}. ${result.name} (${result.baseUrl})`);
          console.log(`      Duration: ${(result.duration/60000).toFixed(1)} minutes`);
        });
    }
    
    // Show failed sites
    if (this.results.failed > 0) {
      console.log(`\n❌ Failed Sites:`);
      this.results.sites
        .filter(result => result.status === 'failed')
        .forEach((result, idx) => {
          console.log(`   ${idx + 1}. ${result.name} (${result.baseUrl})`);
          console.log(`      Error: ${result.error}`);
        });
    }
    
    // Calculate average duration
    if (this.results.sites.length > 0) {
      const avgDuration = this.results.sites.reduce((sum, r) => sum + r.duration, 0) / this.results.sites.length;
      console.log(`\n⏱️  Average test duration: ${(avgDuration/60000).toFixed(1)} minutes per site`);
    }
    
    // Save summary to JSON
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const summaryPath = path.join(
      __dirname, 
      'test-results', 
      `batch-summary-${timestamp}.json`
    );
    
    try {
      await fs.mkdir(path.join(__dirname, 'test-results'), { recursive: true });
      await fs.writeFile(
        summaryPath,
        JSON.stringify({
          configFile: this.configPath,
          startTime: new Date(this.startTime).toISOString(),
          endTime: new Date().toISOString(),
          totalDuration,
          results: this.results,
          options: this.options
        }, null, 2)
      );
      
      console.log(`\n💾 Batch summary saved to: ${summaryPath}`);
    } catch (error) {
      console.error(`\n⚠️  Could not save summary: ${error.message}`);
    }
    
    // Send notification if configured
    if (this.options.notify) {
      await this.sendNotification();
    }
    
    console.log(`\n${'='.repeat(100)}`);
    console.log(`🎉 Batch testing completed!`);
    console.log(`${'='.repeat(100)}\n`);
  }

  /**
   * Send email notification (placeholder - requires nodemailer setup)
   */
  async sendNotification() {
    console.log(`\n📧 Notification would be sent to: ${this.options.notify}`);
    console.log(`   (Email sending requires nodemailer configuration)`);
    
    // TODO: Implement email notification using nodemailer
    // const nodemailer = require('nodemailer');
    // const transporter = nodemailer.createTransport({...});
    // await transporter.sendMail({...});
  }

  /**
   * Run the batch tracker
   */
  async run() {
    try {
      console.log(`\n${'='.repeat(100)}`);
      console.log('🚀 BATCH SITE TRACKER STARTED');
      console.log(`${'='.repeat(100)}`);
      console.log(`⏰ Start time: ${new Date().toLocaleString()}`);
      
      // Load configuration
      await this.loadConfig();
      
      if (this.sites.length === 0) {
        console.log('\n⚠️  No enabled sites found to test. Exiting...');
        return;
      }
      
      // Check for resume state
      const previousState = await this.loadState();
      let sitesToTest = this.sites;
      
      if (previousState && previousState.completedSites) {
        // Filter out already completed sites
        sitesToTest = this.sites.filter(site => 
          !previousState.completedSites.includes(site.baseUrl)
        );
        
        this.results.skipped = this.sites.length - sitesToTest.length;
        
        if (sitesToTest.length === 0) {
          console.log(`\n✅ All sites already completed in previous run!`);
          await this.clearState();
          return;
        }
        
        console.log(`\n🔄 Resuming: ${sitesToTest.length} sites remaining`);
      }
      
      // Test each site sequentially
      for (let i = 0; i < sitesToTest.length; i++) {
        const site = sitesToTest[i];
        const globalIndex = this.sites.indexOf(site);
        
        await this.testSite(site, globalIndex);
        
        // Delay between sites (except after last one)
        if (i < sitesToTest.length - 1) {
          console.log(`\n⏳ Waiting 5 seconds before next site...`);
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
      
      // Clear state file after successful completion
      await this.clearState();
      
      // Generate summary report
      await this.generateBatchSummary();
      
    } catch (error) {
      console.error('\n❌ Fatal error:', error);
      process.exit(1);
    }
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const configFile = args[0];

// Parse options
const options = {
  headless: args.includes('--headless'),
  resume: args.includes('--resume'),
  notify: null
};

// Parse notify email
const notifyArg = args.find(arg => arg.startsWith('--notify='));
if (notifyArg) {
  options.notify = notifyArg.split('=')[1];
}

// Show usage if no config file provided
if (!configFile) {
  console.log(`
Usage: node batch-tracker.js <config-file.json> [options]

🔄 Batch Site Tracker - Test multiple websites overnight

Examples:
  node batch-tracker.js sites.json --headless
  node batch-tracker.js sites.json --headless --resume
  node batch-tracker.js sites.json --headless --notify=admin@example.com

Options:
  --headless              Run in headless mode
  --resume                Resume from last incomplete run
  --notify=EMAIL          Send completion email (requires setup)

Config File Format (sites.json):
{
  "sites": [
    {
      "name": "Example Site",
      "baseUrl": "https://www.example.com",
      "enabled": true,
      "options": {
        "limit": 50,
        "filter": null,
        "exclude": "/blog/",
        "formConfig": "contact_form"
      }
    },
    {
      "name": "Another Site",
      "baseUrl": "https://www.another.com",
      "enabled": true,
      "options": {
        "limit": null,
        "filter": "/products/",
        "exclude": null,
        "formConfig": null
      }
    }
  ]
}

Features:
  🌐 Tests multiple websites sequentially
  📊 Generates comprehensive batch summary
  🔄 Resume from last failure with --resume
  💾 Saves progress after each site
  ⏰ Perfect for overnight batch processing
  📧 Optional email notification on completion

Notes:
  - Each site is tested sequentially (one at a time)
  - 5-second delay between sites
  - 2-hour timeout per site
  - Individual reports saved in test-results/ directory
  - State saved after each site for resume functionality
`);
  process.exit(1);
}

// Check if config file exists
const fs_sync = require('fs');
if (!fs_sync.existsSync(configFile)) {
  console.error(`\n❌ Config file not found: ${configFile}`);
  console.log(`\nCreate a JSON file with this format:`);
  console.log(`{
  "sites": [
    {
      "name": "Example Site",
      "baseUrl": "https://www.example.com",
      "enabled": true,
      "options": {
        "limit": 50,
        "filter": null,
        "exclude": "/blog/",
        "formConfig": null
      }
    }
  ]
}`);
  process.exit(1);
}

// Run the batch tracker
const tracker = new BatchTracker(configFile, options);
tracker.run();

