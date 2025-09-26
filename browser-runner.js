/**
 * Playwright Browser Runner
 * 
 * This script opens a Playwright browser for manual testing and development.
 * Useful for debugging scroll behavior, inspecting network events, and 
 * testing GA4 implementations manually.
 * 
 * Usage:
 *   node browser-runner.js <url> [--headless] [--viewport-width=1280] [--viewport-height=720]
 * 
 * Examples:
 *   node browser-runner.js https://www.example.com
 *   node browser-runner.js https://www.example.com --headless
 *   node browser-runner.js https://www.example.com --viewport-width=1920 --viewport-height=1080
 * 
 * Features:
 * - Opens browser with realistic user agent
 * - Logs network requests to GA4 endpoints
 * - Provides console commands for manual testing
 * - Keeps browser open for manual inspection
 * 
 * @author AI Assistant
 * @version 1.0
 */

const { chromium } = require('playwright');
const CONFIG = require('./config');

class BrowserRunner {
  constructor(options = {}) {
    this.options = {
      url: options.url || 'https://example.com',
      headless: options.headless !== undefined ? options.headless : false,
      viewport: {
        width: options.viewportWidth || CONFIG.VIEWPORT.width,
        height: options.viewportHeight || CONFIG.VIEWPORT.height
      },
      timeout: options.timeout || 30000,
      ...options
    };
    
    this.browser = null;
    this.page = null;
    this.networkEvents = [];
  }

  async init() {
    console.log('🚀 Starting Playwright browser...');
    
    this.browser = await chromium.launch({ 
      headless: this.options.headless,
      devtools: !this.options.headless // Open devtools in non-headless mode
    });
    
    // Create context with realistic settings
    const context = await this.browser.newContext({
      viewport: this.options.viewport,
      userAgent: CONFIG.USER_AGENT
    });
    
    this.page = await context.newPage();

    // Clear cookies before navigation
    await context.clearCookies();

    // Set up network event logging
    this.setupNetworkLogging();
    
    console.log(`✅ Browser initialized with viewport: ${this.options.viewport.width}x${this.options.viewport.height}`);
  }

  setupNetworkLogging() {
    console.log('📡 Setting up network event logging...');
    
    this.page.on('request', request => {
      const url = request.url();
      
      // Log all GA4 requests
      if (CONFIG.NETWORK_FILTERS.GA4_URL.some(ga4Url => url.includes(ga4Url))) {
        const timestamp = new Date().getTime();
        const timeString = new Date(timestamp).toLocaleTimeString();
        
        console.log(`📊 GA4 Request at ${timeString}: ${url}`);
        
        // Store for potential analysis
        this.networkEvents.push({
          type: 'request',
          timestamp,
          url: request.url(),
          method: request.method(),
          headers: request.headers(),
          postData: request.postData()
        });
      }
    });

    this.page.on('response', response => {
      const url = response.url();
      
      // Log GA4 responses
      if (CONFIG.NETWORK_FILTERS.GA4_URL.some(ga4Url => url.includes(ga4Url))) {
        const timestamp = new Date().getTime();
        const timeString = new Date(timestamp).toLocaleTimeString();
        
        console.log(`📈 GA4 Response at ${timeString}: ${response.status()} ${url}`);
      }
    });
  }

  async navigateToUrl() {
    console.log(`🌐 Navigating to: ${this.options.url}`);
    
    try {
      await this.page.goto(this.options.url, { 
        waitUntil: 'domcontentloaded',
        timeout: this.options.timeout 
      });
      
      console.log(`⏳ Waiting ${CONFIG.PAGE_LOAD_TIMEOUT/1000}s for page to load...`);
      await this.page.waitForTimeout(CONFIG.PAGE_LOAD_TIMEOUT);
      
      // Get page info
      const title = await this.page.title();
      const pageHeight = await this.page.evaluate(() => document.body.scrollHeight);
      
      console.log(`📄 Page loaded: "${title}"`);
      console.log(`📏 Page height: ${pageHeight}px`);
      
    } catch (error) {
      console.error('❌ Error loading page:', error.message);
      throw error;
    }
  }

  async handleCookieConsent() {
    try {
      console.log('🍪 Checking for cookie consent...');
      
      // Handle OneTrust
      const oneTrustBtn = await this.page.$(CONFIG.SELECTORS.ONETRUST);
      if (oneTrustBtn) {
        await oneTrustBtn.click();
        console.log('✅ Clicked OneTrust consent button');
        await this.page.waitForTimeout(CONFIG.NETWORK_WAIT);
      }
      
      // Handle Pantheon
      const pantheonBtn = await this.page.$(".pds-button");
      if (pantheonBtn) {
        await pantheonBtn.click();
        console.log('✅ Clicked Pantheon dismiss button');
        await this.page.waitForTimeout(CONFIG.NETWORK_WAIT);
      }
      
      if (!oneTrustBtn && !pantheonBtn) {
        console.log('ℹ️  No cookie consent banners found');
      }
      
    } catch (error) {
      console.log('⚠️  Error handling cookie consent:', error.message);
    }
  }

  async setupConsoleCommands() {
    // Expose helper functions to browser console
    await this.page.addInitScript(() => {
      // Add scroll helper functions to window
      window.scrollToPercentage = (percentage) => {
        const pageHeight = document.body.scrollHeight;
        const scrollY = Math.round((percentage / 100) * pageHeight) + 10; // Add buffer
        window.scrollTo(0, scrollY);
        console.log(`Scrolled to ${percentage}% (${scrollY}px)`);
      };

      window.getScrollPercentage = () => {
        const pageHeight = document.body.scrollHeight;
        const scrollY = window.pageYOffset || document.documentElement.scrollTop;
        const percentage = Math.round((scrollY / pageHeight) * 100);
        console.log(`Current scroll: ${percentage}% (${scrollY}px of ${pageHeight}px)`);
        return percentage;
      };

      window.testScrollThresholds = () => {
        const thresholds = [10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 100];
        console.log('Available scroll thresholds:', thresholds);
        console.log('Usage: scrollToPercentage(25) - scrolls to 25%');
        console.log('Usage: getScrollPercentage() - gets current scroll position');
      };

      // Auto-run on page load
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          console.log('🎯 Scroll testing functions available:');
          window.testScrollThresholds();
        });
      } else {
        console.log('🎯 Scroll testing functions available:');
        window.testScrollThresholds();
      }
    });
  }

  printInstructions() {
    console.log('\n🎯 === BROWSER TESTING INSTRUCTIONS ===');
    console.log('The browser is now open and ready for manual testing.');
    console.log('');
    console.log('📋 Available browser console commands:');
    console.log('  scrollToPercentage(25)     - Scroll to 25% of page height');
    console.log('  getScrollPercentage()      - Get current scroll position');
    console.log('  testScrollThresholds()     - Show available thresholds');
    console.log('');
    console.log('📊 Network Events:');
    console.log(`  Logged ${this.networkEvents.length} GA4 requests so far`);
    console.log('  GA4 requests are automatically logged to this console');
    console.log('');
    console.log('⌨️  Terminal Commands:');
    console.log('  Press Ctrl+C to close the browser and exit');
    console.log('');
  }

  async run() {
    try {
      await this.init();
      await this.setupConsoleCommands();
      await this.navigateToUrl();
      await this.handleCookieConsent();
      
      this.printInstructions();
      
      // Keep the browser open
      if (!this.options.headless) {
        console.log('🌐 Browser is open and ready for manual testing...');
        console.log('💡 Open browser DevTools console to use scroll testing functions');
        
        // Keep process alive
        await new Promise(() => {}); // Never resolves, keeps browser open
      } else {
        console.log('⚠️  Headless mode - browser will close after 30 seconds');
        await this.page.waitForTimeout(30000);
      }
      
    } catch (error) {
      console.error('❌ Error running browser:', error);
    } finally {
      if (this.browser) {
        await this.browser.close();
        console.log('🔒 Browser closed');
      }
    }
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const url = args[0];
const headless = args.includes('--headless');

// Parse viewport options
let viewportWidth = CONFIG.VIEWPORT.width;
let viewportHeight = CONFIG.VIEWPORT.height;

const widthArg = args.find(arg => arg.startsWith('--viewport-width='));
if (widthArg) {
  const width = parseInt(widthArg.split('=')[1]);
  if (!isNaN(width) && width > 0) {
    viewportWidth = width;
  }
}

const heightArg = args.find(arg => arg.startsWith('--viewport-height='));
if (heightArg) {
  const height = parseInt(heightArg.split('=')[1]);
  if (!isNaN(height) && height > 0) {
    viewportHeight = height;
  }
}

if (!url) {
  console.log('Usage: node browser-runner.js <url> [--headless] [--viewport-width=1280] [--viewport-height=720]');
  console.log('');
  console.log('Examples:');
  console.log('  node browser-runner.js https://www.example.com');
  console.log('  node browser-runner.js https://www.example.com --headless');
  console.log('  node browser-runner.js https://www.example.com --viewport-width=1920 --viewport-height=1080');
  console.log('');
  console.log('Options:');
  console.log('  --headless           Run in headless mode (closes after 30s)');
  console.log('  --viewport-width     Set browser width (default: 1280)');
  console.log('  --viewport-height    Set browser height (default: 720)');
  process.exit(1);
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down browser...');
  process.exit(0);
});

// Run the browser
const runner = new BrowserRunner({ 
  url, 
  headless, 
  viewportWidth, 
  viewportHeight 
});
runner.run();
