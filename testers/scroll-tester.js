/**
 * Scroll Testing Utility
 * 
 * This utility handles comprehensive scroll testing including:
 * 1. Scrolling to various percentage thresholds
 * 2. Capturing network events triggered by scroll actions
 * 3. Recording scroll positions and timing
 * 
 * @author AI Assistant
 * @version 1.0
 */

const CONFIG = require('../config/main');
const NetworkHandler = require('../utils/network-handler');

class ScrollTester {
  constructor(page, networkEvents, matchedNetworkEventKeys, extractEventsFromNetworkDataFn) {
    this.page = page;
    this.networkEvents = networkEvents;
    this.matchedNetworkEventKeys = matchedNetworkEventKeys;
    this.extractEventsFromNetworkDataFn = extractEventsFromNetworkDataFn;
    this.scrollEvents = [];
  }

  /**
   * Wait for network events after a scroll action
   */
  async waitForScrollNetworkEvents(scrollStartTime, scrollInfo) {
    return NetworkHandler.waitForScrollNetworkEvents(
      this.page, 
      scrollStartTime, 
      scrollInfo, 
      this.networkEvents, 
      this.matchedNetworkEventKeys, 
      this.extractEventsFromNetworkDataFn
    );
  }

  /**
   * Main scroll testing method
   */
  async runScrollTests() {
    console.log('📜 Starting page scroll with network event tracking...');
    
    // Get page height
    const pageHeight = await this.page.evaluate(() => document.body.scrollHeight);
    console.log(`📏 Page height: ${pageHeight}px`);
    
    // dedupe and sort scroll thresholds
    const scrollThresholds = CONFIG.SCROLL.thresholds.filter((threshold, index, self) => self.indexOf(threshold) === index).sort((a, b) => a - b);
    
    // Calculate scroll positions for each threshold (already sorted)
    // Add buffer pixels to ensure we pass the threshold that triggers scroll events
    const scrollPositions = scrollThresholds.map(threshold => ({
      percentage: threshold,
      scrollY: Math.round((threshold / 100) * pageHeight) + CONFIG.SCROLL.bufferPx
    }));
    
    // Record network events before scrolling starts
    const networkEventsBeforeScroll = this.networkEvents.length;
    
    for (const position of scrollPositions) {
      // Record scroll event BEFORE scrolling
      const scrollStartTimestamp = new Date().getTime();
      
      const exactThresholdPx = Math.round((position.percentage / 100) * pageHeight);
      console.log(`📜 Scrolling to ${position.scrollY}px (${position.percentage}% + ${CONFIG.SCROLL.bufferPx}px buffer, threshold at ${exactThresholdPx}px)`);
      
      // Perform the scroll
      await this.page.evaluate((y) => {
        window.scrollTo(0, y);
      }, position.scrollY);
      
      // Wait 5 seconds for potential delayed events before capturing
      console.log(`⏳ Waiting ${CONFIG.SCROLL.eventDelay/1000}s for delayed events after ${position.percentage}% scroll...`);
      await this.page.waitForTimeout(CONFIG.SCROLL.eventDelay);
      
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
   * Get scroll test results
   */
  getResults() {
    return {
      scrollEvents: this.scrollEvents,
      summary: {
        totalScrolls: this.scrollEvents.length,
        scrollsWithEvents: this.scrollEvents.filter(scroll => 
          scroll.matchedNetworkEvents && scroll.matchedNetworkEvents.length > 0
        ).length,
        thresholdScrolls: this.scrollEvents.filter(scroll => scroll.isThreshold).length
      }
    };
  }
}

module.exports = ScrollTester;
