/**
 * Google Analytics 4 (GA4) Click Event Tracker
 * 
 * This script automates clicking on all clickable elements on a webpage and tracks
 * which clicks trigger Google Analytics 4 events. It generates a comprehensive HTML
 * report showing which elements triggered GA4 events and which didn't.
 * 
 * Key Features:
 * - Automatically clicks all clickable elements (links, buttons, etc.)
 * - Tracks network requests to GA4 endpoints
 * - Matches network events to specific clicks using timing analysis
 * - Generates detailed HTML reports with two-column layout
 * - Handles cookie consent banners (OneTrust)
 * - Opens links in new tabs to prevent navigation
 * - Deduplicates network events to prevent false matches
 * 
 * Usage:
 *   node gtm-click-tracker.js <url> [--headless] [--click-pause=8000]
 * 
 * Example:
 *   node gtm-click-tracker.js https://www.example.com --headless
 * 
 * @author AI Assistant
 * @version 2.0
 */

const { chromium } = require('playwright');
const ReportGenerator = require('./utils/report-generator');
const EventParser = require('./utils/event-parser');
const EventClassifier = require('./utils/event-classifier');
const ElementHandler = require('./utils/element-handler');
const NetworkHandler = require('./utils/network-handler');
const CONFIG = require('./config');


class NetworkTracker {
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
    this.matchedNetworkEventKeys = new Set(); // Track which network events have been matched to clicks
    this.browser = null;
    this.page = null;
    this.reportGenerator = new ReportGenerator();
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
    this.browser = await chromium.launch({ 
      headless: this.options.headless
    });
    
    // Create an incognito context with a realistic user agent
    const context = await this.browser.newContext({
      viewport: CONFIG.VIEWPORT,
      userAgent: CONFIG.USER_AGENT
    });
    
    this.page = await context.newPage();

    // Clear cookies before navigation
    await context.clearCookies();

    // Set up network event interception
    this.page.on('request', request => {
      const url = request.url();
      // Only record GA4 collect requests
      if (CONFIG.NETWORK_FILTERS.GA4_URL.some(ga4Url => url.includes(ga4Url))) {
        const timestamp = new Date().getTime();
        const extractedParams = EventParser.extractEventParams(request.postData());
        
          console.log(`📡 Recording network request: ${request.url()} at ${new Date(timestamp).toLocaleTimeString()}`);
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
      
      console.log(`🖱️ Found ${clickableElements.length} clickable elements`);
      
      
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
          console.log(`📝 Clicking ${elementInfo.tagName} element: "${elementInfo.textContent}"`);
          
          // For links, ensure they open in new tab/window
          if (elementInfo.tagName === 'a' && elementInfo.href) {
            await ElementHandler.handleLinkClick(element, elementInfo, this.page);
          } else {
            // For non-link elements, do regular click
            await element.click({ timeout: CONFIG.CLICK_TIMEOUT });
          }
          
          // Capture screenshot of the clicked element
          let screenshotBuffer = null;
          try {
            // Wait a moment for any visual changes to settle
            await this.page.waitForTimeout(100);
            screenshotBuffer = await element.screenshot({ 
              type: 'png',
              timeout: 2000 // Short timeout to avoid hanging
            });
            console.log(`📸 Captured screenshot for ${elementInfo.tagName} element`);
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
          await ElementHandler.recordFailedClick(clickableElements[i], clickError, i, this.clickEvents, this.networkEvents);
          
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

  async run() {
    try {
      console.log(`🌐 Opening incognito window for: ${this.options.url}`);
      await this.init();
      
      // Navigate to URL
      await this.page.goto(this.options.url, { 
        waitUntil: 'domcontentloaded',
        timeout: this.options.timeout 
      });
      
      console.log(`⏳ Waiting ${CONFIG.PAGE_LOAD_TIMEOUT}ms for page to load...`);
      await this.page.waitForTimeout(CONFIG.PAGE_LOAD_TIMEOUT);

      // Dismiss Pantheon
      await this.dismissPantheon();
      
      // Handle OneTrust
      await this.handleOneTrust();
      
      // Scroll the page
      await this.scrollPage();

      // Wait longer between scroll and click to ensure all scroll events are captured
      console.log(`⏳ Waiting ${CONFIG.CLICK_EVENT_DELAY/1000} seconds between scroll and click actions...`);
      await this.page.waitForTimeout(CONFIG.CLICK_EVENT_DELAY);

      await this.clickElements();
      
      // Wait a bit more to capture any final network events
      await this.page.waitForTimeout(CONFIG.NETWORK_WAIT);
      
      // Log summary statistics
      console.log('\n📊 === COMPREHENSIVE TRACKING SUMMARY ===');
      const successfulClicks = this.clickEvents.filter(click => click.success === true);
      const failedClicks = this.clickEvents.filter(click => click.success === false);
      const totalNetworkEvents = this.networkEvents.filter(e => e.type === 'request').length;
      
      console.log(`Total clicks recorded: ${this.clickEvents.length}`);
      console.log(`Successful clicks: ${successfulClicks.length}`);
      console.log(`Failed clicks: ${failedClicks.length}`);
      console.log(`Total scroll actions: ${this.scrollEvents.length}`);
      console.log(`Total GA4 network events: ${totalNetworkEvents}`);
      
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
      await this.reportGenerator.generateHTMLReport(
        this.options,
        this.networkEvents,
        this.clickEvents,
        this.scrollEvents,
        this.createExtractEventsFromNetworkData(),
        this.createFilterEventsByType()
      );
      
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
          this.createFilterEventsByType()
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
const args = process.argv.slice(2);
const url = args[0];
const headless = args.includes('--headless');

// Parse click pause option
let clickPause = CONFIG.CLICK_EVENT_DELAY; // default
const clickPauseArg = args.find(arg => arg.startsWith('--click-pause='));
if (clickPauseArg) {
  const pauseValue = parseInt(clickPauseArg.split('=')[1]);
  if (!isNaN(pauseValue) && pauseValue > 0) {
    clickPause = pauseValue;
  }
}

if (!url) {
  console.log(`Usage: node gtm-click-tracker.js <url> [--headless] [--click-pause=${CONFIG.CLICK_EVENT_DELAY}]`);
  console.log('Example: node gtm-click-tracker.js https://www.example.com --headless');
  console.log(`Example: node gtm-click-tracker.js https://www.example.com --click-pause=${CONFIG.CLICK_EVENT_DELAY}`);
  console.log('');
  console.log('Options:');
  console.log('  --headless     Run in headless mode');
  console.log(`  --click-pause  Pause after each click in milliseconds (default: ${CONFIG.CLICK_EVENT_DELAY})`);
  process.exit(1);
}

// Run the tracker
const tracker = new NetworkTracker({ url, headless, clickPause });
tracker.run();