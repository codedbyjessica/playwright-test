/**
 * Google Analytics 4 (GA4) Comprehensive Tracker
 * 
 * This script provides comprehensive testing for Google Analytics 4 implementations including:
 * - Click tracking on all interactive elements
 * - Scroll depth tracking at various thresholds
 * - Form testing with validation scenarios
 * - Network event capture and analysis
 * - Detailed HTML reporting with visual insights
 * 
 * Key Features:
 * - Automatically clicks all clickable elements (links, buttons, etc.)
 * - Tests scroll depth tracking at multiple percentage thresholds
 * - Comprehensive form testing (field validation, submissions, error handling)
 * - Tracks network requests to GA4 endpoints with timing analysis
 * - Generates detailed HTML reports with categorized results
 * - Handles cookie consent banners (OneTrust, Pantheon)
 * - Isolated testing environments to prevent cross-contamination
 * - Supports custom form configurations for different forms
 * 
 * Usage:
 *   node gtm-tracker.js <url> [options]
 * 
 * Examples:
 *   node gtm-tracker.js https://www.example.com --headless
 *   node gtm-tracker.js https://www.example.com --form-config=neffy_consumer_signup
 * 
 * Configuration:
 *   Test categories controlled in config/main.js → RUN_GA_CATEGORIES
 *   Form testing enabled/disabled via CONFIG.RUN_GA_CATEGORIES.forms
 * 
 * @author AI Assistant
 * @version 3.0
 */

const { chromium } = require('playwright');
const ReportGenerator = require('./utils/report-generator');
const EventParser = require('./utils/event-parser');
const EventClassifier = require('./utils/event-classifier');
const ClickTester = require('./testers/click-tester');
const ScrollTester = require('./testers/scroll-tester');
const FormTester = require('./testers/form-tester');
const CONFIG = require('./config/main');
const { log } = require('./utils/logger');
const CustomActionsExecutor = require('./utils/custom-actions');
const DomainConfigLoader = require('./utils/domain-config-loader');
const ConsentHandler = require('./utils/consent-handler');


class GTMTracker {
  constructor(options = {}) {
    this.options = {
      url: options.url || 'https://example.com',
      headless: options.headless !== false,
      timeout: options.timeout || CONFIG.GLOBAL.browserTimeout,
      ...options
    };
    
    this.networkEvents = [];
    this.scrollEvents = [];
    this.clickEvents = [];
    this.formTestResults = null; // Store form testing results
    this.matchedNetworkEventKeys = new Set(); // Track which network events have been matched to clicks
    this.browser = null;
    this.page = null;
    this.reportGenerator = new ReportGenerator();
    
    // Load form configs dynamically based on domain
    this.FORM_CONFIGS = DomainConfigLoader.loadFormConfigsForDomain(this.options.url);
    
    // Load custom functions for the domain (e.g., preFormActions)
    this.customFunctions = DomainConfigLoader.loadCustomFunctionsForDomain(this.options.url);
    
    // Form testing configuration - controlled by CONFIG.RUN_GA_CATEGORIES.forms
    const defaultFormConfig = DomainConfigLoader.detectDefaultFormConfig(this.FORM_CONFIGS);
    
    if (options.formConfig) {
      // If formConfig is provided directly, find its name from FORM_CONFIGS
      this.formConfig = options.formConfig;
      this.formConfigName = Object.keys(this.FORM_CONFIGS || {}).find(
        key => this.FORM_CONFIGS[key] === options.formConfig
      ) || null;
    } else {
      // Use default config
      this.formConfig = defaultFormConfig ? defaultFormConfig.config : null;
      this.formConfigName = defaultFormConfig ? defaultFormConfig.name : null;
    }
    
    this.runFormTests = CONFIG.RUN_GA_CATEGORIES.forms;
  }



  async init() {
    this.browser = await chromium.launch({ 
      headless: this.options.headless
    });
    
    const context = await this.browser.newContext({
      viewport: CONFIG.GLOBAL.viewport,
      userAgent: CONFIG.GLOBAL.userAgent,
      extraHTTPHeaders: CONFIG.GLOBAL.extraHTTPHeaders
    });
    
    this.page = await context.newPage();
    await context.clearCookies();

    // Set up network event interception
    this.page.on('request', request => {
      const url = request.url();
      if (CONFIG.GLOBAL.ga4Urls.some(ga4Url => url.includes(ga4Url))) {
        const timestamp = new Date().getTime();
        const postParams = EventParser.extractEventParams(request.postData());
        const urlParams = EventParser.extractEventParamsFromData(url.split('?')[1] || '', 'URL');
        const extractedParams = { ...postParams, ...urlParams };
        
        console.log(`📡 ${extractedParams.eventName || 'unknown'} - ${new Date(timestamp).toLocaleTimeString()}`);
        
        this.networkEvents.push({
          type: 'request',
          timestamp,
          url: request.url(),
          method: request.method(),
          headers: request.headers(),
          postData: request.postData(),
          ...extractedParams
        });
      }
    });
  }



  /**
   * Run form testing scenarios in isolation
   */
  async runFormTesting() {
    if (!this.runFormTests) {
      log('Form testing is disabled');
      // Initialize empty results for reporting
      this.formTestResults = {
        fieldTests: [],
        submissionTests: [],
        summary: {
          totalFieldTests: 0,
          totalSubmissionTests: 0,
          totalNetworkEvents: 0
        }
      };
      return;
    }

    if (!this.formConfig) {
      log('⏭️  Form testing skipped - no form configuration available');
      log('💡 Add form configs to custom-config.js to enable form testing');
      // Initialize empty results for reporting
      this.formTestResults = {
        fieldTests: [],
        submissionTests: [],
        summary: {
          totalFieldTests: 0,
          totalSubmissionTests: 0,
          totalNetworkEvents: 0
        }
      };
      return;
    }

    log('🧪 Starting form testing scenarios...');
    
    try {
      // Execute custom pre-form actions if they exist
      if (this.customFunctions && this.customFunctions.preFormActions) {
        log('🔧 Executing custom pre-form actions...');
        await CustomActionsExecutor.execute(this.page, this.customFunctions.preFormActions);
        log('✅ Custom pre-form actions completed');
      }
      
      // Try to match form config by page URL first
      const currentUrl = this.page.url();
      const pageMatchedConfig = DomainConfigLoader.detectFormConfigByPage(this.FORM_CONFIGS, currentUrl);
      
      if (pageMatchedConfig) {
        this.formConfig = pageMatchedConfig.config;
        this.formConfigName = pageMatchedConfig.name;
        log(`✅ Using page-matched form config "${this.formConfigName}" for URL: ${currentUrl}`);
      } else if (this.formConfig) {
        log(`⚠️  No page match found, using provided/default config`);
      }
      
      // Create a separate network events array for form testing to avoid mixing with click events
      const formNetworkEvents = [];
      const formNetworkEventKeys = new Set();
      
      // Store current network event count to track form-specific events
      log(`📊 Network events before form testing: ${this.networkEvents.length}`);
      
      // Use existing page state - no need to refresh since we already handled OneTrust/Pantheon
      log('🎯 Using existing page state for form testing (no refresh needed)...');
      
      // Check if the form exists on the page
      const formExists = await this.page.$(this.formConfig.formSelector);
      if (!formExists) {
        log(`⏭️  Form testing skipped - form not found on page (selector: ${this.formConfig.formSelector})`);
        log(`💡 Current URL: ${currentUrl}`);
        // Initialize empty results for reporting
        this.formTestResults = {
          fieldTests: [],
          submissionTests: [],
          summary: {
            totalFieldTests: 0,
            totalSubmissionTests: 0,
            totalNetworkEvents: 0
          }
        };
        return;
      }
      
      log(`✅ Form found on page: ${this.formConfig.formSelector}`);
      
      // Set up form-specific network event tracking
      const formNetworkHandler = (request) => {
        const url = request.url();
        if (CONFIG.GLOBAL.ga4Urls.some(ga4Url => url.includes(ga4Url))) {
          const timestamp = new Date().getTime();
          
          // Extract parameters from both POST data and URL query parameters
          const postParams = EventParser.extractEventParams(request.postData());
          const urlParams = EventParser.extractEventParamsFromData(url.split('?')[1] || '', 'URL');
          
          // Merge parameters, with URL parameters taking precedence for event name
          const extractedParams = { ...postParams, ...urlParams };
          
          
          formNetworkEvents.push({
            type: 'request',
            timestamp,
            url: request.url(),
            method: request.method(),
            headers: request.headers(),
            postData: request.postData(),
            ...extractedParams
          });
          
          // Also add to main array for overall reporting
          this.networkEvents.push({
            type: 'request',
            timestamp,
            url: request.url(),
            method: request.method(),
            headers: request.headers(),
            postData: request.postData(),
            source: 'form_testing',
            ...extractedParams
          });
        }
      };
      
      // Remove existing listener and add form-specific one
      this.page.removeAllListeners('request');
      this.page.on('request', formNetworkHandler);
      
      // Create form tester with isolated network events
      const formTester = new FormTester(
        this.page, 
        formNetworkEvents, 
        this.formConfig,
        this.clickEvents,
        this.customFunctions?.afterRefreshAction || null
      );
      await formTester.runAllTests();
      
      // Store results for reporting
      this.formTestResults = formTester.getResults();
      // Add formConfig and formConfigName to results for reporting
      this.formTestResults.formConfig = this.formConfig;
      this.formTestResults.formConfigName = this.formConfigName;
      
      log(`✅ Form testing completed. Form-specific network events: ${formNetworkEvents.length}`);
      log(`📊 Results: ${JSON.stringify(this.formTestResults.summary)}`);
      
      // Restore original network event listener for any remaining operations
      this.page.removeAllListeners('request');
      this.page.on('request', request => {
        const url = request.url();
        if (CONFIG.GLOBAL.ga4Urls.some(ga4Url => url.includes(ga4Url))) {
          const timestamp = new Date().getTime();
          
          // Extract parameters from both POST data and URL query parameters
          const postParams = EventParser.extractEventParams(request.postData());
          const urlParams = EventParser.extractEventParamsFromData(url.split('?')[1] || '', 'URL');
          
          // Merge parameters, with URL parameters taking precedence for event name
          const extractedParams = { ...postParams, ...urlParams };
          
          
          this.networkEvents.push({
            type: 'request',
            timestamp,
            url: request.url(),
            method: request.method(),
            headers: request.headers(),
            postData: request.postData(),
            ...extractedParams
          });
        }
      });
      
    } catch (error) {
      log(`❌ Error during form testing: ${error.message}`, 'error');
      // Don't throw - continue with other tests
    }
  }


  async run() {
    const startTime = Date.now();
    try {
      console.log(`🚀 Starting GA4 tracking for: ${this.options.url}`);
      
      await this.init();
      await this.page.goto(this.options.url, { 
        waitUntil: 'domcontentloaded',
        timeout: this.options.timeout 
      });
      await this.page.waitForTimeout(CONFIG.GLOBAL.pageLoadTimeout);

      // Handle cookie consent banners
      await ConsentHandler.handleAll(this.page);

      if (this.customFunctions && this.customFunctions.preTestActions) {
        log('🔧 Executing custom pre-test actions...');
        await CustomActionsExecutor.execute(this.page, this.customFunctions.preTestActions);
        log('✅ Custom pre-test actions completed');
      }
      
      // Scroll testing
      if (CONFIG.RUN_GA_CATEGORIES.scroll) {
        const scrollTester = new ScrollTester(
          this.page,
          this.networkEvents,
          this.matchedNetworkEventKeys,
          this.clickEvents
        );
        await scrollTester.runScrollTests();
        const scrollResults = scrollTester.getResults();
        this.scrollEvents = scrollResults.scrollEvents;
        await this.page.waitForTimeout(CONFIG.SCROLL.eventDelay);
      }

      // Click testing
      if (CONFIG.RUN_GA_CATEGORIES.click) {
        const clickTester = new ClickTester(
          this.page,
          this.networkEvents,
          this.matchedNetworkEventKeys,
          this.clickEvents,
          this.customFunctions?.afterRefreshAction || null
        );
        await clickTester.runClickTests();
        const clickResults = clickTester.getResults();
        this.clickEvents = clickResults.clickEvents;
      }

      // Form testing
      await this.page.waitForTimeout(CONFIG.GLOBAL.networkWait * 2);
      await this.runFormTesting();
      
      // Wait a bit more to capture any final network events
      await this.page.waitForTimeout(CONFIG.GLOBAL.pageLoadTimeout);
      
      // Summary
      console.log('\n📊 === SUMMARY ===');
      const successfulClicks = this.clickEvents.filter(click => click.success === true);
      const totalNetworkEvents = this.networkEvents.filter(e => e.type === 'request').length;
      
      console.log(`Clicks: ${successfulClicks.length}/${this.clickEvents.length} successful`);
      console.log(`Scrolls: ${this.scrollEvents.length}`);
      console.log(`GA4 Events: ${totalNetworkEvents}`);
      
      // Form summary
      if (this.formTestResults && this.formTestResults.summary) {
        console.log(`Forms: ${this.formTestResults.summary.totalSubmissionTests} tests, ${this.formTestResults.summary.totalNetworkEvents} events`);
      }
      
      // Generate reports
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      await this.reportGenerator.generateHTMLReport(
        this.options,
        this.networkEvents,
        this.clickEvents,
        this.scrollEvents,
        this.clickEvents,
        this.formTestResults,
        {
          startTime,
          endTime,
          totalTime
        }
      );
      
      console.log(`✅ Completed in ${(totalTime/1000).toFixed(1)}s`);
      
    } catch (error) {
      console.error('❌ Error:', error.message);
      
      // Generate report despite error
      try {
        const endTime = Date.now();
        const totalTime = endTime - startTime;
        await this.reportGenerator.generateHTMLReport(
          this.options,
          this.networkEvents,
          this.clickEvents,
          this.scrollEvents,
          this.clickEvents,
          this.formTestResults,
          { startTime, endTime, totalTime }
        );
      } catch (reportError) {
        console.error('❌ Report generation failed:', reportError.message);
      }
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }



}

// Parse command line arguments
console.log('🎬 SCRIPT ENTRY POINT - Args:', process.argv);
const args = process.argv.slice(2);
const url = args[0];
const headless = args.includes('--headless');
console.log('🎯 PARSED ARGS - URL:', url, 'Headless:', headless);


// Parse form config option (optional - can specify which form config to use)
// Note: Form config loading is now domain-based and handled in GTMTracker constructor
let formConfigName = null;
const formConfigArg = args.find(arg => arg.startsWith('--form-config='));
if (formConfigArg) {
  formConfigName = formConfigArg.split('=')[1];
  console.log(`📋 Form config name specified: ${formConfigName}`);
}

// Form configuration will be automatically loaded based on domain in GTMTracker constructor
let formConfig = null;

if (!url) {
  console.log(`Usage: node gtm-tracker.js <url> [options]`);
  console.log('');
  console.log('🎯 GTM Comprehensive Tracker - Complete GA4 testing in one command');
  console.log('');
  console.log('Examples:');
  console.log('  node gtm-tracker.js https://www.example.com');
  console.log('  node gtm-tracker.js https://www.example.com --headless');
  console.log('  node gtm-tracker.js https://www.example.com --form-config=neffy_consumer_signup');
  console.log('');
  console.log('Options:');
  console.log('  --headless                Run in headless mode');
  console.log('  --form-config=NAME        Specify form configuration to use (auto-detects by URL if not specified)');
  console.log('');
  console.log('💡 Tip: Use ard-compare.js to compare results against ARD requirements:');
  console.log('   node ard-compare.js --networkresults=./ga4-events-example.com.csv --ard=./ard.csv');
  console.log('');
  console.log('🧪 Testing (Controlled in config/main.js → RUN_GA_CATEGORIES):');
  console.log(`  📄 Pageview tracking: ${CONFIG.RUN_GA_CATEGORIES.page_view ? '✅' : '❌'}`);
  console.log(`  📊 Scroll depth testing: ${CONFIG.RUN_GA_CATEGORIES.scroll ? '✅' : '❌'}`);
  console.log(`  🖱️  Click tracking: ${CONFIG.RUN_GA_CATEGORIES.click ? '✅' : '❌'}`);
  console.log(`  📝 Form testing: ${CONFIG.RUN_GA_CATEGORIES.forms ? '✅' : '❌'}`);
  console.log(`  🚪 Exit modal: ${CONFIG.RUN_GA_CATEGORIES.exit_modal ? '✅' : '❌'}`);
  console.log('  🌐 Complete GA4 network event analysis');
  console.log('  📋 Unified HTML report with all results');
  console.log('');
  console.log('Available form configs:', Object.keys(FORM_CONFIGS).join(', ') || 'None configured');
  process.exit(1);
}

// Run the tracker
const tracker = new GTMTracker({ 
  url, 
  headless, 
  formConfig 
});

tracker.run();