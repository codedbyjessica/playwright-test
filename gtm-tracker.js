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
const ElementHandler = require('./utils/element-handler');
const NetworkHandler = require('./utils/network-handler');
const ClickTester = require('./testers/click-tester');
const ScrollTester = require('./testers/scroll-tester');
const FormTester = require('./testers/form-tester');
const CONFIG = require('./config/main');
const FORM_CONFIGS = require('./config/custom-forms');


class GTMTracker {
  constructor(options = {}) {
    this.options = {
      url: options.url || 'https://example.com',
      headless: options.headless !== false,
      timeout: options.timeout || CONFIG.GLOBAL.browserTimeout,
      clickPause: options.clickPause || CONFIG.CLICK.eventDelay,
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
    
    // Form testing configuration - controlled by CONFIG.RUN_GA_CATEGORIES.forms
    this.formConfig = options.formConfig || this.detectDefaultFormConfig();
    this.runFormTests = CONFIG.RUN_GA_CATEGORIES.forms;
  }

  /**
   * Detect form configuration by matching page URL
   */
  detectFormConfigByPage(pageUrl) {
    for (const [configName, config] of Object.entries(FORM_CONFIGS)) {
      if (config.page && pageUrl.includes(config.page)) {
        console.log(`📋 Matched form config "${configName}" for page: ${config.page}`);
        return config;
      }
    }
    return null;
  }

  /**
   * Detect default form configuration (use first available config if no page match)
   */
  detectDefaultFormConfig() {
    const availableConfigs = Object.keys(FORM_CONFIGS);
    if (availableConfigs.length > 0) {
      const defaultConfig = availableConfigs[0];
      console.log(`📋 Using fallback form config: ${defaultConfig}`);
      return FORM_CONFIGS[defaultConfig];
    }
    return null;
  }

  // Helper methods for creating functions that need this.clickEvents
  createExtractEventsFromNetworkData() {
    return (networkEvent) => {
      const parseEventsFromData = (data, eventTimestamp, source = 'POST', networkUrl = '', postData = '') => {
        return EventParser.parseEventsFromData(
          data, 
          eventTimestamp, 
          source, 
          networkUrl, 
          postData, 
          this.clickEvents,
          EventClassifier.findRelatedTriggers,
          EventClassifier.generateTriggerAction
        );
      };
      
      return EventParser.extractEventsFromNetworkData(networkEvent, parseEventsFromData);
    };
  }

  createFilterEventsByType() {
    return (events, type) => {
      return EventClassifier.filterEventsByType(events, type, this.clickEvents);
    };
  }

  async waitForNetworkEvents(clickStartTime, elementInfo) {
    return NetworkHandler.waitForNetworkEvents(
      this.page, 
      clickStartTime, 
      elementInfo, 
      this.networkEvents, 
      this.matchedNetworkEventKeys, 
      this.createExtractEventsFromNetworkData()
    );
  }


  async init() {
    console.log('Browser launched');
    this.browser = await chromium.launch({ 
      headless: this.options.headless,
      timeout: CONFIG.GLOBAL.browserTimeout, // Timeout for browser launch
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--no-first-run',
        '--disable-default-apps',
        '--disable-extensions',
        '--disable-plugins',
        '--disable-images',
        '--disable-javascript-harmony-shipping',
        '--disable-background-networking',
        '--disable-sync',
        '--metrics-recording-only',
        '--no-default-browser-check',
        '--no-experiments',
        '--no-pings',
        '--no-service-autorun'
      ]
    });
    
    console.log('Creating browser context...');
    // Create an incognito context with a realistic user agent
    const context = await this.browser.newContext({
      viewport: CONFIG.GLOBAL.viewport,
      userAgent: CONFIG.GLOBAL.userAgent
    });
    
    console.log('Creating new page...');
    this.page = await context.newPage();

    // Clear cookies before navigation
    await context.clearCookies();

    // Set up network event interception
    this.page.on('request', request => {
      const url = request.url();
      // Only record GA4 collect requests
      if (CONFIG.GLOBAL.ga4Urls.some(ga4Url => url.includes(ga4Url))) {
        const timestamp = new Date().getTime();
        
        // Extract parameters from both POST data and URL query parameters
        const postParams = EventParser.extractEventParams(request.postData());
        const urlParams = EventParser.extractEventParamsFromData(url.split('?')[1] || '', 'URL');
        
        // Merge parameters, with URL parameters taking precedence for event name
        const extractedParams = { ...postParams, ...urlParams };
        
        console.log(`📡 Recording network request: ${request.url()} at ${new Date(timestamp).toLocaleTimeString()}`);
        console.log(`📡 Event name extracted: ${extractedParams.eventName || 'unknown'}`);
        
        this.networkEvents.push({
          type: 'request',
          timestamp,
          url: request.url(),
          method: request.method(),
          headers: request.headers(),
          postData: request.postData(),
          ...extractedParams
        });
          console.log(`🔍 ARRAY DEBUG: Network events array now has ${this.networkEvents.length} events`);
      }
    });

  }

  async dismissPantheon() {
    const dismissBtn = await this.page.$(".pds-button");
    if (dismissBtn) {
      await dismissBtn.click();
      console.log('✅ Clicked Pantheon dismiss button');
      await this.page.waitForTimeout(CONFIG.NETWORK_WAIT);
    }
  }

  async handleOneTrust() {
    try {
      console.log('🍪 Looking for OneTrust cookie consent...');
      
      const acceptBtn = await this.page.$(CONFIG.ONETRUST.acceptButtonSelector);
      if (acceptBtn) {
        await acceptBtn.click();
        console.log('✅ Clicked OneTrust I Agree button');
        await this.page.waitForTimeout(CONFIG.GLOBAL.networkWait);
        return true;
      }
      
      console.log('ℹ️  No OneTrust cookie consent banner found');
      return false;
    } catch (error) {
      console.log('⚠️  Error handling cookie consent:', error.message);
      return false;
    }
  }

  async clickElements() {
    const clickTester = new ClickTester(
      this.page,
      this.networkEvents,
      this.matchedNetworkEventKeys,
      this.createExtractEventsFromNetworkData()
    );
    
    await clickTester.runClickTests();
    
    // Get results and store them
    const results = clickTester.getResults();
    this.clickEvents = results.clickEvents;
  }

  async scrollPage() {
    const scrollTester = new ScrollTester(
      this.page,
      this.networkEvents,
      this.matchedNetworkEventKeys,
      this.createExtractEventsFromNetworkData()
    );
    
    await scrollTester.runScrollTests();
    
    // Get results and store them
    const results = scrollTester.getResults();
    this.scrollEvents = results.scrollEvents;
  }

  /**
   * Run form testing scenarios in isolation
   */
  async runFormTesting() {
    if (!this.runFormTests) {
      this.log('Form testing is disabled');
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
      this.log('⏭️  Form testing skipped - no form configuration available');
      this.log('💡 Add form configs to custom-config.js to enable form testing');
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

    this.log('🧪 Starting form testing scenarios...');
    
    try {
      // Try to match form config by page URL first
      const currentUrl = this.page.url();
      const pageMatchedConfig = this.detectFormConfigByPage(currentUrl);
      
      if (pageMatchedConfig) {
        this.formConfig = pageMatchedConfig;
        this.log(`✅ Using page-matched form config for URL: ${currentUrl}`);
      } else if (this.formConfig) {
        this.log(`⚠️  No page match found, using provided/default config`);
      }
      
      // Create a separate network events array for form testing to avoid mixing with click events
      const formNetworkEvents = [];
      const formNetworkEventKeys = new Set();
      
      // Store current network event count to track form-specific events
      const networkEventsBeforeForm = this.networkEvents.length;
      this.log(`📊 Network events before form testing: ${networkEventsBeforeForm}`);
      
      // Use existing page state - no need to refresh since we already handled OneTrust/Pantheon
      this.log('🎯 Using existing page state for form testing (no refresh needed)...');
      
      // Check if the form exists on the page
      const formExists = await this.page.$(this.formConfig.formSelector);
      if (!formExists) {
        this.log(`⏭️  Form testing skipped - form not found on page (selector: ${this.formConfig.formSelector})`);
        this.log(`💡 Current URL: ${currentUrl}`);
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
      
      this.log(`✅ Form found on page: ${this.formConfig.formSelector}`);
      
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
          
          console.log(`📡 [FORM] Recording network request: ${request.url()} at ${new Date(timestamp).toLocaleTimeString()}`);
          console.log(`📡 [FORM] Event name extracted: ${extractedParams.eventName || 'unknown'}`);
          
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
        this.createExtractEventsFromNetworkData()
      );
      await formTester.runAllTests();
      
      // Store results for reporting
      this.formTestResults = formTester.getResults();
      
      const formNetworkEventsCount = formNetworkEvents.length;
      this.log(`✅ Form testing completed. Form-specific network events: ${formNetworkEventsCount}`);
      this.log(`📊 Results: ${JSON.stringify(this.formTestResults.summary)}`);
      
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
          
          console.log(`📡 Recording network request: ${request.url()} at ${new Date(timestamp).toLocaleTimeString()}`);
          console.log(`📡 Event name extracted: ${extractedParams.eventName || 'unknown'}`);
          
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
      this.log(`❌ Error during form testing: ${error.message}`, 'error');
      // Don't throw - continue with other tests
    }
  }

  /**
   * Helper method for logging with consistent format
   */
  log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  async run() {
    const startTime = Date.now();
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    try {
      console.log(`🚀 [${executionId}] SCRIPT STARTED - PID: ${process.pid}`);
      console.log(`🌐 [${executionId}] Opening incognito window for: ${this.options.url}`);
      console.log(`🔧 [${executionId}] Execution mode: ${this.options.headless ? 'headless' : 'headed'}`);
      console.log(`🔧 [${executionId}] Config delays - CLICK: ${CONFIG.CLICK.eventDelay}ms, SCROLL: ${CONFIG.SCROLL.eventDelay}ms, NETWORK_WAIT: ${CONFIG.GLOBAL.networkWait}ms`);
      const initStart = Date.now();
      await this.init();
      console.log(`✅ Browser initialized in ${Date.now() - initStart}ms`);
      
      // Navigate to URL
      console.log(`Navigating to: ${this.options.url}`);
      const navStart = Date.now();
      await this.page.goto(this.options.url, { 
        waitUntil: 'domcontentloaded',
        timeout: this.options.timeout 
      });
      console.log(`Page loaded in ${Date.now() - navStart}ms`);
      
      console.log(`⏳ Waiting ${CONFIG.GLOBAL.pageLoadTimeout}ms for page to stabilize...`);
      await this.page.waitForTimeout(CONFIG.GLOBAL.pageLoadTimeout);

      // Dismiss Pantheon
      await this.dismissPantheon();
      
      // Handle OneTrust
      await this.handleOneTrust();
      
      // Scroll the page
      if (CONFIG.RUN_GA_CATEGORIES.scroll) {
        console.log('Starting scroll analysis');
        await this.scrollPage();
        // Wait longer between scroll and click to ensure all scroll events are captured
        console.log(`⏳ Waiting ${CONFIG.CLICK.eventDelay/1000} seconds between scroll and click actions...`);
        await this.page.waitForTimeout(CONFIG.CLICK.eventDelay);
      }


      if (CONFIG.RUN_GA_CATEGORIES.click) {
          console.log('Starting click analysis');
          await this.clickElements();
      }


      // Wait for all click-related network events to settle before form testing
      console.log('⏳ Waiting for click events to settle before form testing...');
      await this.page.waitForTimeout(CONFIG.GLOBAL.networkWait * 2); // Extra wait time
      
      console.log('\n📝 === STARTING FORM TESTING PHASE ===');
      if (this.formConfig) {
        console.log(`📋 Form config loaded: ${Object.keys(FORM_CONFIGS).find(key => FORM_CONFIGS[key] === this.formConfig) || 'Unknown'}`);
      }
      await this.runFormTesting();
      
      // Wait a bit more to capture any final network events
      await this.page.waitForTimeout(CONFIG.NETWORK_WAIT);
      
      // Log summary statistics
      console.log('\n📊 === COMPREHENSIVE TRACKING SUMMARY ===');
      console.log(`🔍 SUMMARY DEBUG: Network events array has ${this.networkEvents.length} events before summary`);
      console.log(`🔍 SUMMARY DEBUG: Event types:`, this.networkEvents.map(e => e.type));
      
      const successfulClicks = this.clickEvents.filter(click => click.success === true);
      const failedClicks = this.clickEvents.filter(click => click.success === false);
      const totalNetworkEvents = this.networkEvents.filter(e => e.type === 'request').length;
      
      console.log(`Total clicks recorded: ${this.clickEvents.length}`);
      console.log(`Successful clicks: ${successfulClicks.length}`);
      console.log(`Failed clicks: ${failedClicks.length}`);
      console.log(`Total scroll actions: ${this.scrollEvents.length}`);
      console.log(`Total GA4 network events: ${totalNetworkEvents}`);
      console.log(`Total network events: ${totalNetworkEvents}`);
      console.log(`📊 Total extracted events for ARD analysis: ${this.networkEvents.length}`);
      
      // Form testing summary
      if (this.formTestResults && this.formTestResults.summary) {
        console.log(`\n📋 === FORM TESTING SUMMARY ===`);
        console.log(`Total field tests: ${this.formTestResults.summary.totalFieldTests}`);
        console.log(`Total submission tests: ${this.formTestResults.summary.totalSubmissionTests}`);
        console.log(`Form testing network events: ${this.formTestResults.summary.totalNetworkEvents}`);
        
        // Field test breakdown
        if (this.formTestResults.fieldTests.length > 0) {
          const successfulFieldTests = this.formTestResults.fieldTests.filter(test => test.result.success).length;
          const failedFieldTests = this.formTestResults.fieldTests.filter(test => !test.result.success).length;
          const fieldTestsWithErrors = this.formTestResults.fieldTests.filter(test => test.errorState.hasError).length;
          const fieldTestsWithGA4 = this.formTestResults.fieldTests.filter(test => test.result.networkEvents && test.result.networkEvents.length > 0).length;
          
          console.log(`\n📊 === FIELD TESTING BREAKDOWN ===`);
          console.log(`Successful field interactions: ${successfulFieldTests}`);
          console.log(`Failed field interactions: ${failedFieldTests}`);
          console.log(`Fields that showed validation errors: ${fieldTestsWithErrors}`);
          console.log(`Field interactions that triggered GA4: ${fieldTestsWithGA4}`);
        }
        
        // Submission test breakdown
        if (this.formTestResults.submissionTests.length > 0) {
          console.log(`\n📊 === SUBMISSION TESTING BREAKDOWN ===`);
          this.formTestResults.submissionTests.forEach(test => {
            if (test.testType === 'valid_submission') {
              console.log(`  Valid submission: ${test.success ? 'SUCCESS' : 'FAILED'}`);
            } else if (test.testType === 'empty_submission') {
              const errorsFound = test.errorResults ? test.errorResults.filter(e => e.found).length : 0;
              const totalExpected = test.errorResults ? test.errorResults.length : 0;
              console.log(`  Empty submission: ${errorsFound}/${totalExpected} expected errors shown`);
            } else if (test.testType === 'invalid_submission') {
              const errorsFound = test.errorResults ? test.errorResults.filter(e => e.found).length : 0;
              const totalExpected = test.errorResults ? test.errorResults.length : 0;
              console.log(`  Invalid submission: ${errorsFound}/${totalExpected} validation errors shown`);
            }
            
            if (test.networkEvents && test.networkEvents.length > 0) {
              console.log(`    └─ Triggered ${test.networkEvents.length} GA4 event(s)`);
            }
          });
        }
      }
      
      // Debug: Show breakdown of event types
      const eventTypes = {};
      this.networkEvents.forEach(event => {
        const type = event.type || 'undefined';
        eventTypes[type] = (eventTypes[type] || 0) + 1;
      });
      console.log('📊 Event types breakdown:', eventTypes);
      
      // Count matched clicks using the new direct matching approach
      let matchedClicks = 0;
      successfulClicks.forEach(click => {
        if (click.matchedNetworkEvents && click.matchedNetworkEvents.length > 0) {
          matchedClicks++;
        }
      });
      
      // Count matched scroll events
      let matchedScrolls = 0;
      let scrollTriggeredEvents = 0;
      this.scrollEvents.forEach(scroll => {
        if (scroll.matchedNetworkEvents && scroll.matchedNetworkEvents.length > 0) {
          matchedScrolls++;
          scrollTriggeredEvents += scroll.matchedNetworkEvents.length;
        }
      });
      
      console.log(`\n📊 === CLICK EVENTS ===`);
      console.log(`Clicks that triggered GA4 events: ${matchedClicks}`);
      console.log(`Successful clicks with no GA4 events: ${successfulClicks.length - matchedClicks}`);
      
      console.log(`\n📊 === SCROLL EVENTS ===`);
      console.log(`Scroll actions that triggered GA4 events: ${matchedScrolls}`);
      console.log(`Total GA4 events triggered by scrolling: ${scrollTriggeredEvents}`);
      console.log(`Scroll actions with no GA4 events: ${this.scrollEvents.length - matchedScrolls}`);
      
      // Show which scroll percentages triggered events
      const scrollEventsByPercentage = {};
      this.scrollEvents.forEach(scroll => {
        if (scroll.matchedNetworkEvents && scroll.matchedNetworkEvents.length > 0) {
          if (!scrollEventsByPercentage[scroll.percentage]) {
            scrollEventsByPercentage[scroll.percentage] = 0;
          }
          scrollEventsByPercentage[scroll.percentage] += scroll.matchedNetworkEvents.length;
        }
      });
      
      if (Object.keys(scrollEventsByPercentage).length > 0) {
        console.log(`\n📊 === SCROLL PERCENTAGE BREAKDOWN ===`);
        Object.entries(scrollEventsByPercentage)
          .sort(([a], [b]) => parseInt(a) - parseInt(b))
          .forEach(([percentage, count]) => {
            console.log(`  ${percentage}% scroll: ${count} GA4 event(s)`);
          });
      }
      
      // Generate HTML report
      console.log('Generating report');
      console.log(`🔍 DEBUG: About to generate report with ${this.networkEvents.length} network events`);
      console.log(`🔍 DEBUG: Network events array:`, this.networkEvents.map(e => ({ type: e.type, url: e.url?.substring(0, 50) })));
      
      const reportStart = Date.now();
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      await this.reportGenerator.generateHTMLReport(
        this.options,
        this.networkEvents,
        this.clickEvents,
        this.scrollEvents,
        this.createExtractEventsFromNetworkData(),
        this.createFilterEventsByType(),
        this.formTestResults,
        {
          startTime,
          endTime,
          totalTime
        }
      );
      console.log(`✅ Reports generated in ${Date.now() - reportStart}ms`);
      
      console.log(`🎉 Test completed successfully in ${totalTime}ms (${(totalTime/1000).toFixed(1)}s)`);
      
    } catch (error) {
      console.error('❌ Error running tracker:', error);
      
      // Always try to generate a report even if there's an error
      try {
        console.log('\n📋 Generating report despite error...');
        const endTime = Date.now();
        const totalTime = endTime - startTime;
        
        await this.reportGenerator.generateHTMLReport(
          this.options,
          this.networkEvents,
          this.clickEvents,
          this.scrollEvents,
          this.createExtractEventsFromNetworkData(),
          this.createFilterEventsByType(),
          this.formTestResults,
          {
            startTime,
            endTime,
            totalTime
          }
        );
        console.log('✅ Report generated successfully despite error');
      } catch (reportError) {
        console.error('❌ Failed to generate report:', reportError);
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

// Parse click pause option
let clickPause = CONFIG.CLICK.eventDelay; // default
const clickPauseArg = args.find(arg => arg.startsWith('--click-pause='));
if (clickPauseArg) {
  const pauseValue = parseInt(clickPauseArg.split('=')[1]);
  if (!isNaN(pauseValue) && pauseValue > 0) {
    clickPause = pauseValue;
  }
}

// Parse form config option (optional - can specify which form config to use)
let formConfigName = null;
const formConfigArg = args.find(arg => arg.startsWith('--form-config='));
if (formConfigArg) {
  formConfigName = formConfigArg.split('=')[1];
}

// Get form configuration - use specified config or auto-detect
let formConfig = null;
if (formConfigName && FORM_CONFIGS[formConfigName]) {
  formConfig = FORM_CONFIGS[formConfigName];
  console.log(`📋 Using specified form config: ${formConfigName}`);
} else if (Object.keys(FORM_CONFIGS).length > 0) {
  // Auto-detect will happen in GTMTracker constructor based on page URL
  const defaultConfigName = Object.keys(FORM_CONFIGS)[0];
  formConfig = FORM_CONFIGS[defaultConfigName];
  console.log(`📋 Auto-using form config: ${defaultConfigName}`);
} else {
  console.log('⚠️  No form configurations available');
  console.log('💡 Add form configs to config/custom-forms.js to enable form testing');
}

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
  console.log(`  --click-pause=N           Pause after each action in milliseconds (default: ${CONFIG.CLICK.eventDelay})`);
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
  clickPause, 
  formConfig 
});

tracker.run();