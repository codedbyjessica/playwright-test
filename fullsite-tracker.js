/**
 * Full Site GTM Tracker
 * 
 * This script crawls a website's sitemap.xml and runs GTM tracking tests on each URL.
 * It aggregates results across all pages and generates comprehensive reports.
 * 
 * Features:
 * - Automatically discovers URLs from sitemap.xml
 * - Runs gtm-tracker.js for each URL
 * - Generates per-page and aggregated reports
 * - Supports filtering by URL patterns
 * - Handles errors gracefully and continues with remaining URLs
 * 
 * Usage:
 *   node fullsite-tracker.js <base-url> [options]
 * 
 * Examples:
 *   node fullsite-tracker.js https://www.example.com --headless
 *   node fullsite-tracker.js https://www.example.com --limit=10
 *   node fullsite-tracker.js https://www.example.com --filter="/products/"
 * 
 * Options:
 *   --headless              Run in headless mode
 *   --limit=N               Test only first N URLs from sitemap
 *   --filter=PATTERN        Only test URLs containing this pattern
 *   --exclude=PATTERN       Skip URLs containing this pattern
 *   --form-config=NAME      Specify form configuration to use
 * 
 * @author AI Assistant
 * @version 1.0
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');
const CONFIG = require('./config/main');

class FullSiteTracker {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl;
    this.options = {
      headless: options.headless !== false,
      limit: options.limit || null,
      filter: options.filter || null,
      exclude: options.exclude || null,
      formConfig: options.formConfig || null,
      ...options
    };
    
    this.urls = [];
    this.results = {
      total: 0,
      successful: 0,
      failed: 0,
      urls: []
    };
    this.startTime = Date.now();
  }

  /**
   * Fetch and parse sitemap.xml using Playwright with stealth mode
   */
  async fetchSitemap() {
    console.log(`\n🗺️  Fetching sitemap from: ${this.baseUrl}/sitemap.xml`);
    
    try {
      const { chromium } = require('playwright');
      const browser = await chromium.launch({ 
        headless: true,
        timeout: CONFIG.GLOBAL.browserTimeout,
        args: CONFIG.GLOBAL.chromiumArgs
      });
      const context = await browser.newContext({
        userAgent: CONFIG.GLOBAL.userAgent,
        viewport: CONFIG.GLOBAL.viewport,
        extraHTTPHeaders: CONFIG.GLOBAL.extraHTTPHeaders
      });
      const page = await context.newPage();
      
      // Remove webdriver flag
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined
        });
      });
      
      const sitemapUrl = `${this.baseUrl}/sitemap.xml`;
      
      console.log(`   Trying: ${sitemapUrl}`);
      const response = await page.goto(sitemapUrl, { 
        waitUntil: 'domcontentloaded',
        timeout: 30000 
      });
      
      if (!response.ok()) {
        await browser.close();
        throw new Error(`Sitemap returned status ${response.status()}`);
      }
      
      const sitemapContent = await page.content();
      console.log(`   ✅ Found sitemap at: ${sitemapUrl}`);
      
      await browser.close();
      
      // Parse URLs from sitemap
      const urlMatches = sitemapContent.match(/<loc>(.*?)<\/loc>/g) || [];
      this.urls = urlMatches
        .map(match => match.replace(/<\/?loc>/g, '').trim())
        .filter(url => {
          // Global excludes - always skip these
          const globalExcludes = ['/file', '/files/', '/pdf', '/pdfs/', '/pdfs'];
          if (globalExcludes.some(pattern => url.includes(pattern))) {
            return false;
          }
          
          // Apply filter if specified
          if (this.options.filter && !url.includes(this.options.filter)) {
            return false;
          }
          
          // Apply exclude if specified
          if (this.options.exclude && url.includes(this.options.exclude)) {
            return false;
          }
          
          return true;
        });
      
      // Apply limit if specified
      if (this.options.limit) {
        this.urls = this.urls.slice(0, this.options.limit);
      }
      
      console.log(`\n✅ Found ${this.urls.length} URLs to test`);
      
      return this.urls;
      
    } catch (error) {
      console.error('❌ Error fetching sitemap:', error.message);
      throw error;
    }
  }

  /**
   * Fetch sub-sitemaps if sitemap index is detected
   */
  async fetchSubSitemaps() {
    // This is a simplified implementation
    // In production, you'd want to recursively fetch all sub-sitemaps
    console.log('   Note: Sub-sitemap fetching not yet implemented');
    console.log('   Using URLs from index file');
  }

  /**
   * Run GTM tracker for a single URL
   */
  async testUrl(url, index) {
    const urlNumber = index + 1;
    const totalUrls = this.urls.length;
    
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🔍 Testing URL ${urlNumber}/${totalUrls}`);
    console.log(`📄 ${url}`);
    console.log(`${'='.repeat(80)}`);
    
    const testStart = Date.now();
    
    try {
      // Build command
      let command = `node gtm-tracker.js "${url}"`;
      
      if (this.options.headless) {
        command += ' --headless';
      }
      
      if (this.options.formConfig) {
        command += ` --form-config=${this.options.formConfig}`;
      }
      
      // Run the tracker
      console.log(`🚀 Running: ${command}`);
      execSync(command, { 
        stdio: 'inherit',
        encoding: 'utf-8',
        timeout: 300000 // 5 minutes max per page
      });
      
      const testDuration = Date.now() - testStart;
      
      this.results.successful++;
      this.results.urls.push({
        url,
        status: 'success',
        duration: testDuration,
        timestamp: new Date().toISOString()
      });
      
      console.log(`\n✅ URL ${urlNumber}/${totalUrls} completed in ${(testDuration/1000).toFixed(1)}s`);
      
    } catch (error) {
      const testDuration = Date.now() - testStart;
      
      this.results.failed++;
      this.results.urls.push({
        url,
        status: 'failed',
        error: error.message,
        duration: testDuration,
        timestamp: new Date().toISOString()
      });
      
      console.error(`\n❌ URL ${urlNumber}/${totalUrls} failed after ${(testDuration/1000).toFixed(1)}s`);
      console.error(`   Error: ${error.message}`);
      console.log('   Continuing with next URL...');
    }
  }

  /**
   * Run tests on all URLs
   */
  async runAllTests() {
    console.log(`\n🚀 Starting full site testing...`);
    console.log(`⚙️  Configuration:`);
    console.log(`   Base URL: ${this.baseUrl}`);
    console.log(`   Headless: ${this.options.headless}`);
    console.log(`   URLs to test: ${this.urls.length}`);
    if (this.options.filter) console.log(`   Filter: ${this.options.filter}`);
    if (this.options.exclude) console.log(`   Exclude: ${this.options.exclude}`);
    if (this.options.limit) console.log(`   Limit: ${this.options.limit}`);
    
    this.results.total = this.urls.length;
    
    // Test each URL sequentially
    for (let i = 0; i < this.urls.length; i++) {
      await this.testUrl(this.urls[i], i);
      
      // Small delay between tests to avoid overwhelming the server
      if (i < this.urls.length - 1) {
        console.log(`\n⏳ Waiting 2 seconds before next URL...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  /**
   * Generate summary report
   */
  async generateSummaryReport() {
    const totalDuration = Date.now() - this.startTime;
    
    console.log(`\n\n${'='.repeat(80)}`);
    console.log('📊 FULL SITE TESTING SUMMARY');
    console.log(`${'='.repeat(80)}`);
    console.log(`\n🌐 Base URL: ${this.baseUrl}`);
    console.log(`⏱️  Total Duration: ${(totalDuration/1000).toFixed(1)}s (${(totalDuration/60000).toFixed(1)} minutes)`);
    console.log(`\n📈 Results:`);
    console.log(`   Total URLs: ${this.results.total}`);
    console.log(`   ✅ Successful: ${this.results.successful}`);
    console.log(`   ❌ Failed: ${this.results.failed}`);
    console.log(`   Success Rate: ${((this.results.successful / this.results.total) * 100).toFixed(1)}%`);
    
    if (this.results.failed > 0) {
      console.log(`\n❌ Failed URLs:`);
      this.results.urls
        .filter(result => result.status === 'failed')
        .forEach((result, idx) => {
          console.log(`   ${idx + 1}. ${result.url}`);
          console.log(`      Error: ${result.error}`);
        });
    }
    
    // Calculate average duration
    const avgDuration = this.results.urls.reduce((sum, r) => sum + r.duration, 0) / this.results.urls.length;
    console.log(`\n⏱️  Average test duration: ${(avgDuration/1000).toFixed(1)}s per URL`);
    
    // Save summary to JSON
    const summaryPath = path.join(
      __dirname, 
      'test-results', 
      `fullsite-summary-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
    );
    
    try {
      await fs.mkdir(path.join(__dirname, 'test-results'), { recursive: true });
      await fs.writeFile(
        summaryPath,
        JSON.stringify({
          baseUrl: this.baseUrl,
          startTime: new Date(this.startTime).toISOString(),
          endTime: new Date().toISOString(),
          totalDuration,
          results: this.results,
          options: this.options
        }, null, 2)
      );
      
      console.log(`\n💾 Summary saved to: ${summaryPath}`);
    } catch (error) {
      console.error(`\n⚠️  Could not save summary: ${error.message}`);
    }
    
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🎉 Full site testing completed!`);
    console.log(`${'='.repeat(80)}\n`);
  }

  /**
   * Run the full site tracker
   */
  async run() {
    try {
      // Fetch sitemap and get URLs
      await this.fetchSitemap();
      
      if (this.urls.length === 0) {
        console.log('\n⚠️  No URLs found to test. Exiting...');
        return;
      }
      
      // Run tests on all URLs
      await this.runAllTests();
      
      // Generate summary report
      await this.generateSummaryReport();
      
    } catch (error) {
      console.error('\n❌ Fatal error:', error);
      process.exit(1);
    }
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const baseUrl = args[0];

// Parse options
const options = {
  headless: args.includes('--headless'),
  limit: null,
  filter: null,
  exclude: null,
  formConfig: null
};

// Parse limit
const limitArg = args.find(arg => arg.startsWith('--limit='));
if (limitArg) {
  options.limit = parseInt(limitArg.split('=')[1]);
}

// Parse filter
const filterArg = args.find(arg => arg.startsWith('--filter='));
if (filterArg) {
  options.filter = filterArg.split('=')[1];
}

// Parse exclude
const excludeArg = args.find(arg => arg.startsWith('--exclude='));
if (excludeArg) {
  options.exclude = excludeArg.split('=')[1];
}

// Parse form config
const formConfigArg = args.find(arg => arg.startsWith('--form-config='));
if (formConfigArg) {
  options.formConfig = formConfigArg.split('=')[1];
}

// Show usage if no URL provided
if (!baseUrl) {
  console.log(`
Usage: node fullsite-tracker.js <base-url> [options]

🌐 Full Site GTM Tracker - Test all pages from sitemap.xml

Examples:
  node fullsite-tracker.js https://www.example.com --headless
  node fullsite-tracker.js https://www.example.com --limit=10
  node fullsite-tracker.js https://www.example.com --filter="/products/"
  node fullsite-tracker.js https://www.example.com --exclude="/blog/"

Options:
  --headless              Run in headless mode
  --limit=N               Test only first N URLs from sitemap
  --filter=PATTERN        Only test URLs containing this pattern
  --exclude=PATTERN       Skip URLs containing this pattern
  --form-config=NAME      Specify form configuration to use

Features:
  📍 Automatically discovers URLs from sitemap.xml
  🔄 Runs gtm-tracker.js for each URL
  📊 Generates per-page and aggregated reports
  🎯 Supports URL filtering and limits
  ⚡ Handles errors gracefully

Notes:
  - Each URL is tested sequentially to avoid overwhelming the server
  - Individual reports are saved in test-results/ directory
  - A summary JSON file is generated at the end
  - Failed URLs are logged but don't stop the entire process
`);
  process.exit(1);
}

// Run the full site tracker
const tracker = new FullSiteTracker({ baseUrl, ...options });
tracker.run();

