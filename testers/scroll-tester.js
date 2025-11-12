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
const { log } = require('../utils/logger');

class ScrollTester {
  constructor(page, networkEvents, matchedNetworkEventKeys, extractEventsFromNetworkDataFn) {
    this.page = page;
    this.networkEvents = networkEvents;
    this.matchedNetworkEventKeys = matchedNetworkEventKeys;
    this.extractEventsFromNetworkDataFn = extractEventsFromNetworkDataFn;
    this.scrollEvents = [];
  }

  /**
   * Main scroll testing method
   */
  async runScrollTests() {
    log('📜 Starting page scroll with network event tracking...');
    
    // Get page height
    const pageHeight = await this.page.evaluate(() => document.body.scrollHeight);
    
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
      
      // Perform the scroll
      await this.page.evaluate((y) => {
        window.scrollTo(0, y);
      }, position.scrollY);
      
      // Wait for potential delayed events before capturing
      await this.page.waitForTimeout(CONFIG.SCROLL.eventDelay);
      
      // Wait for any additional network events triggered by this scroll
      const newNetworkEvents = await NetworkHandler.waitForScrollNetworkEvents(
        this.page, 
        scrollStartTimestamp, 
        position, 
        this.networkEvents, 
        this.matchedNetworkEventKeys, 
        this.extractEventsFromNetworkDataFn
      );
      
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
    
    // Log summary
    log('✅ Scroll testing completed', 'success');
    log(`📊 Scroll actions that triggered GA4 events: ${this.scrollEvents.filter(s => s.matchedNetworkEvents?.length > 0).length}/${this.scrollEvents.length}`);
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
