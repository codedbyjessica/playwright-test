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
 *   node gtm-tracker.js https://www.example.com --form-tests --form-config=neffy_consumer_signup
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
const FormTester = require('./utils/form-tester');
const CONFIG = require('./config');
const FORM_CONFIGS = require('./custom-config');


class GTMTracker {
  constructor(options = {}) {
    this.options = {
      url: options.url || 'https://example.com',
      headless: options.headless !== false,
      timeout: options.timeout || 30000,
      clickPause: options.clickPause || CONFIG.CLICK_EVENT_DELAY,
      ...options
    };
    
    this.excludeSelectors = options.excludeSelectors || CONFIG.EXCLUDE_SELECTORS_FROM_CLICK.concat(CONFIG.EXIT_MODAL_SELECTORS);
    this.networkEvents = [];
    this.scrollEvents = [];
    this.clickEvents = [];
    this.formTestResults = null; // Store form testing results
    this.matchedNetworkEventKeys = new Set(); // Track which network events have been matched to clicks
    this.browser = null;
    this.page = null;
    this.reportGenerator = new ReportGenerator();
    
    // Form testing configuration - now enabled by default
    this.formConfig = options.formConfig || this.detectDefaultFormConfig();
    this.runFormTests = options.runFormTests !== false; // Default to true unless explicitly disabled
  }

  /**
   * Detect default form configuration (use first available config)
   */
  detectDefaultFormConfig() {
    const availableConfigs = Object.keys(FORM_CONFIGS);
    if (availableConfigs.length > 0) {
      const defaultConfig = availableConfigs[0];
      console.log(`📋 Auto-detected form config: ${defaultConfig}`);
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

  async waitForScrollNetworkEvents(scrollStartTime, scrollInfo) {
    return NetworkHandler.waitForScrollNetworkEvents(
      this.page, 
      scrollStartTime, 
      scrollInfo, 
      this.networkEvents, 
      this.matchedNetworkEventKeys, 
      this.createExtractEventsFromNetworkData()
    );
  }

  async init() {
    console.log('Browser launched');
    this.browser = await chromium.launch({ 
      headless: this.options.headless,
      timeout: 30000, // 30 second timeout for browser launch
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
      viewport: CONFIG.VIEWPORT,
      userAgent: CONFIG.USER_AGENT
    });
    
    console.log('Creating new page...');
    this.page = await context.newPage();

    // Clear cookies before navigation
    await context.clearCookies();

    // Set up network event interception
    this.page.on('request', request => {
      const url = request.url();
      // Only record GA4 collect requests
      if (CONFIG.NETWORK_FILTERS.GA4_URL.some(ga4Url => url.includes(ga4Url))) {
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
      
      const acceptBtn = await this.page.$(CONFIG.SELECTORS.ONETRUST);
      if (acceptBtn) {
        await acceptBtn.click();
        console.log('✅ Clicked OneTrust I Agree button');
        await this.page.waitForTimeout(CONFIG.NETWORK_WAIT);
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
    console.log('🖱️ Starting click events...');
    
    try {
      // Get all clickable elements with more comprehensive selectors
      const clickableElements = await this.page.$$(CONFIG.SELECTORS.CLICKABLE);
      
      console.log(`Found ${clickableElements.length} clickable elements`);
      
      
      for (let i = 0; i < clickableElements.length; i++) {
        try {
          const element = clickableElements[i];

          // Get element info before clicking
          const elementInfo = await ElementHandler.getElementInfo(element);
          
          // Check if element should be avoided using exclude selectors
          let shouldSkip = false;
          for (const selector of this.excludeSelectors) {
            const matches = await element.evaluate((el, sel) => {
              // Use CSS selector matching to check if element matches the selector
              try {
                // Check if this element matches the selector
                return el.matches(sel);
              } catch (e) {
                // If selector is invalid, return false
                return false;
              }
            }, selector);
            
            if (matches) {
              console.log(`🚫 Skipping element: ${elementInfo.tagName} - "${elementInfo.textContent}" (matches: ${selector})`);
              shouldSkip = true;
              break;
            }
          }
          
          if (shouldSkip) {
            continue;
          }
          
          console.log(`🖱️ Clicking element ${i + 1}/${clickableElements.length}: ${elementInfo.tagName} - "${elementInfo.textContent}"`);
          
          // Record the current network event count and timestamp before clicking
          const networkEventsBeforeClick = this.networkEvents.length;
          const clickStartTime = new Date().getTime();
          
          // Record click event BEFORE clicking
          const clickTimestamp = new Date().getTime();
          this.clickEvents.push({
            timestamp: clickTimestamp,
            element: elementInfo,
            action: 'click',
            success: true,
            error: null,
            networkEventsBefore: networkEventsBeforeClick,
            networkEventsAfter: null,
            matchedNetworkEvents: []
          });
          
          // Do regular click for all elements (more reliable)
          console.log(`Clicking element ${i + 1}/${clickableElements.length}: ${elementInfo.tagName} "${elementInfo.textContent}"`);
          
          // For links, ensure they open in new tab/window
          if (elementInfo.tagName === 'a' && elementInfo.href) {
            await ElementHandler.handleLinkClick(element, elementInfo, this.page);
          } else {
            // For non-link elements, do regular click
            await element.click({ timeout: CONFIG.CLICK_TIMEOUT });
          }
          
          // Capture screenshot of the clicked element with context
          let screenshotBuffer = null;
          try {
            // Wait a moment for any visual changes to settle
            await this.page.waitForTimeout(100);
            
            // Get element bounding box to calculate expanded area
            const boundingBox = await element.boundingBox();
            if (boundingBox) {
              const padding = CONFIG.SCREENSHOT_CONTEXT_PADDING;
              const clip = {
                x: Math.max(0, boundingBox.x - padding),
                y: Math.max(0, boundingBox.y - padding),
                width: Math.min(boundingBox.width + (padding * 2), await this.page.evaluate(() => window.innerWidth)),
                height: Math.min(boundingBox.height + (padding * 2), await this.page.evaluate(() => window.innerHeight))
              };
              
              screenshotBuffer = await this.page.screenshot({ 
                type: 'png',
                timeout: 4000,
                clip: clip
              });
              console.log(`📸 Captured contextual screenshot for ${elementInfo.tagName} element (${clip.width}x${clip.height}px with ${padding}px padding)`);
            } else {
              // Fallback to element screenshot if bounding box fails
              screenshotBuffer = await element.screenshot({ 
                type: 'png',
                timeout: 4000
              });
              console.log(`📸 Captured fallback screenshot for ${elementInfo.tagName} element`);
            }
          } catch (screenshotError) {
            console.log(`⚠️ Could not capture screenshot: ${screenshotError.message}`);
          }
          
          // Wait for network events within the time window
          const newNetworkEvents = await this.waitForNetworkEvents(clickStartTime, elementInfo);
          
          // Update the click event with network event info and screenshot
          const currentClickEvent = this.clickEvents[this.clickEvents.length - 1];
          currentClickEvent.networkEventsAfter = this.networkEvents.length;
          currentClickEvent.matchedNetworkEvents = newNetworkEvents;
          currentClickEvent.screenshot = screenshotBuffer;
          
        } catch (clickError) {
          await ElementHandler.recordFailedClick(clickableElements[i], clickError, i, this.clickEvents, this.networkEvents, this.page);
          
          // Continue with next element instead of crashing
          continue;
        }
      }
      
      console.log(`✅ Click events completed. Recorded ${this.clickEvents.length} clicks`);
      
    } catch (error) {
      console.log('⚠️ Error during click events:', error.message);
      // Don't re-throw - let the main run() method handle it
    }
  }

  async scrollPage() {
    console.log('📜 Starting page scroll with network event tracking...');
    
    // Get page height
    const pageHeight = await this.page.evaluate(() => document.body.scrollHeight);
    console.log(`📏 Page height: ${pageHeight}px`);
    
    // dedupe and sort scroll thresholds
    const scrollThresholds = CONFIG.SCROLL_THRESHOLDS.filter((threshold, index, self) => self.indexOf(threshold) === index).sort((a, b) => a - b);
    
    // Calculate scroll positions for each threshold (already sorted)
    // Add buffer pixels to ensure we pass the threshold that triggers scroll events
    const scrollPositions = scrollThresholds.map(threshold => ({
      percentage: threshold,
      scrollY: Math.round((threshold / 100) * pageHeight) + CONFIG.SCROLL_BUFFER_PX
    }));
    
    // Record network events before scrolling starts
    const networkEventsBeforeScroll = this.networkEvents.length;
    
    for (const position of scrollPositions) {
      // Record scroll event BEFORE scrolling
      const scrollStartTimestamp = new Date().getTime();
      
      const exactThresholdPx = Math.round((position.percentage / 100) * pageHeight);
      console.log(`📜 Scrolling to ${position.scrollY}px (${position.percentage}% + ${CONFIG.SCROLL_BUFFER_PX}px buffer, threshold at ${exactThresholdPx}px)`);
      
      // Perform the scroll
      await this.page.evaluate((y) => {
        window.scrollTo(0, y);
      }, position.scrollY);
      
      // Wait 5 seconds for potential delayed events before capturing
      console.log(`⏳ Waiting ${CONFIG.SCROLL_EVENT_DELAY/1000}s for delayed events after ${position.percentage}% scroll...`);
      await this.page.waitForTimeout(CONFIG.SCROLL_EVENT_DELAY);
      
      // Wait for any additional network events triggered by this scroll
      const newNetworkEvents = await this.waitForScrollNetworkEvents(scrollStartTimestamp, {
        percentage: position.percentage,
        scrollY: position.scrollY,
        action: 'scroll'
      });
      
      // Record scroll event with network event matching
      this.scrollEvents.push({
        timestamp: scrollStartTimestamp,
        scrollY: position.scrollY,
        percentage: position.percentage,
        action: 'scroll',
        networkEventsBefore: networkEventsBeforeScroll,
        networkEventsAfter: this.networkEvents.length,
        matchedNetworkEvents: newNetworkEvents,
        isThreshold: true // All positions are now defined thresholds
      });
    }
    
    // End of scroll sequence - no need to scroll back to top to avoid triggering additional events
    
    // Log summary statistics
    console.log('✅ Sophisticated page scroll completed');
    console.log(`📊 Recorded ${this.scrollEvents.length} scroll actions`);
    
    const scrollsWithNetworkEvents = this.scrollEvents.filter(scroll => 
      scroll.matchedNetworkEvents && scroll.matchedNetworkEvents.length > 0
    );
    const thresholdScrolls = this.scrollEvents.filter(scroll => scroll.isThreshold);
    
    console.log(`📊 Scroll actions that triggered network events: ${scrollsWithNetworkEvents.length}`);
    console.log(`📊 Key scroll thresholds tested: ${thresholdScrolls.length}`);
    
    // Log which scroll percentages triggered events
    scrollsWithNetworkEvents.forEach(scroll => {
      if (scroll.matchedNetworkEvents.length > 0) {
        console.log(`  📊 ${scroll.percentage}% scroll triggered ${scroll.matchedNetworkEvents.length} network event(s)`);
      }
    });
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
        this.log('💡 The configured form may not be present on this page');
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
        if (CONFIG.NETWORK_FILTERS.GA4_URL.some(ga4Url => url.includes(ga4Url))) {
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
      const formTester = new FormTester(this.page, formNetworkEvents, this.formConfig);
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
        if (CONFIG.NETWORK_FILTERS.GA4_URL.some(ga4Url => url.includes(ga4Url))) {
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
      console.log(`🔧 [${executionId}] Config delays - CLICK: ${CONFIG.CLICK_EVENT_DELAY}ms, SCROLL: ${CONFIG.SCROLL_EVENT_DELAY}ms, NETWORK_WAIT: ${CONFIG.NETWORK_WAIT}ms`);
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
      
      console.log(`⏳ Waiting ${CONFIG.PAGE_LOAD_TIMEOUT}ms for page to stabilize...`);
      await this.page.waitForTimeout(CONFIG.PAGE_LOAD_TIMEOUT);

      // Dismiss Pantheon
      await this.dismissPantheon();
      
      // Handle OneTrust
      await this.handleOneTrust();
      
      // Scroll the page
      if (CONFIG.RUN_GA_CATEGORIES.scroll) {
        console.log('Starting scroll analysis');
        await this.scrollPage();
        // Wait longer between scroll and click to ensure all scroll events are captured
        console.log(`⏳ Waiting ${CONFIG.CLICK_EVENT_DELAY/1000} seconds between scroll and click actions...`);
        await this.page.waitForTimeout(CONFIG.CLICK_EVENT_DELAY);
      }


      if (CONFIG.RUN_GA_CATEGORIES.click) {
          console.log('Starting click analysis');
          await this.clickElements();
      }


      // Wait for all click-related network events to settle before form testing
      console.log('⏳ Waiting for click events to settle before form testing...');
      await this.page.waitForTimeout(CONFIG.NETWORK_WAIT * 2); // Extra wait time
      
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
      await this.reportGenerator.generateHTMLReport(
        this.options,
        this.networkEvents,
        this.clickEvents,
        this.scrollEvents,
        this.createExtractEventsFromNetworkData(),
        this.createFilterEventsByType(),
        this.formTestResults
      );
      console.log(`✅ Reports generated in ${Date.now() - reportStart}ms`);
      
      const totalTime = Date.now() - startTime;
      console.log(`🎉 Test completed successfully in ${totalTime}ms (${(totalTime/1000).toFixed(1)}s)`);
      
    } catch (error) {
      console.error('❌ Error running tracker:', error);
      
      // Always try to generate a report even if there's an error
      try {
        console.log('\n📋 Generating report despite error...');
        await this.reportGenerator.generateHTMLReport(
          this.options,
          this.networkEvents,
          this.clickEvents,
          this.scrollEvents,
          this.createExtractEventsFromNetworkData(),
          this.createFilterEventsByType(),
          this.formTestResults
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
let clickPause = CONFIG.CLICK_EVENT_DELAY; // default
const clickPauseArg = args.find(arg => arg.startsWith('--click-pause='));
if (clickPauseArg) {
  const pauseValue = parseInt(clickPauseArg.split('=')[1]);
  if (!isNaN(pauseValue) && pauseValue > 0) {
    clickPause = pauseValue;
  }
}

// Parse form testing options - now enabled by default
const disableFormTests = args.includes('--no-forms');
const runFormTests = !disableFormTests; // Default to true unless explicitly disabled

let formConfigName = null;
const formConfigArg = args.find(arg => arg.startsWith('--form-config='));
if (formConfigArg) {
  formConfigName = formConfigArg.split('=')[1];
}

// Get form configuration - use specified config or auto-detect
let formConfig = null;
if (runFormTests) {
  if (formConfigName && FORM_CONFIGS[formConfigName]) {
    formConfig = FORM_CONFIGS[formConfigName];
    console.log(`📋 Using specified form config: ${formConfigName}`);
  } else if (Object.keys(FORM_CONFIGS).length > 0) {
    // Auto-detect first available config
    const defaultConfigName = Object.keys(FORM_CONFIGS)[0];
    formConfig = FORM_CONFIGS[defaultConfigName];
    console.log(`📋 Auto-using form config: ${defaultConfigName}`);
  } else {
    console.log('⚠️  No form configurations available');
    console.log('💡 Add form configs to custom-config.js to enable form testing');
  }
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
  console.log('  node gtm-tracker.js https://www.example.com --no-forms');
  console.log('');
  console.log('Options:');
  console.log('  --headless                Run in headless mode');
  console.log(`  --click-pause=N           Pause after each action in milliseconds (default: ${CONFIG.CLICK_EVENT_DELAY})`);
  console.log('  --form-config=NAME        Specify form configuration to use (auto-detects if not specified)');
  console.log('  --no-forms                Disable form testing (forms are tested by default)');
  console.log('');
  console.log('🧪 Default Testing (Runs Automatically):');
  console.log('  📄 Pageview tracking');
  console.log('  📊 Scroll depth testing at 12 thresholds');
  console.log('  🖱️  Click tracking on all interactive elements');
  console.log('  📝 Form testing (if forms configured)');
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
  runFormTests, 
  formConfig 
});
tracker.run();