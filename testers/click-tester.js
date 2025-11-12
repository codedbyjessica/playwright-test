/**
 * Click Testing Utility
 * 
 * This utility handles comprehensive click testing including:
 * 1. Finding all clickable elements on the page
 * 2. Clicking elements and capturing network events
 * 3. Taking screenshots of clicked elements
 * 4. Recording success/failure states
 * 
 * @author AI Assistant
 * @version 1.0
 */

const CONFIG = require('../config/main');
const ElementHandler = require('../utils/element-handler');
const NetworkHandler = require('../utils/network-handler');
const { log } = require('../utils/logger');

class ClickTester {
  constructor(page, networkEvents, matchedNetworkEventKeys, extractEventsFromNetworkDataFn) {
    this.page = page;
    this.networkEvents = networkEvents;
    this.matchedNetworkEventKeys = matchedNetworkEventKeys;
    this.extractEventsFromNetworkDataFn = extractEventsFromNetworkDataFn;
    this.clickEvents = [];
    this.excludeSelectors = CONFIG.ONETRUST.selector;
  }

  /**
   * Main click testing method
   */
  async runClickTests() {
    log('🖱️ Starting click testing...');
    
    try {
      // Store the original URL to reload between clicks
      const originalUrl = this.page.url();
      
      // Get all clickable elements with more comprehensive selectors
      const clickableElements = await this.page.$$(CONFIG.CLICK.selector.join(', '));
      
      log(`Found ${clickableElements.length} clickable elements`);
      
      for (let i = 0; i < clickableElements.length; i++) {
        try {
          // Reload page before each click to ensure clean state
          if (i > 0) {
            await this.page.goto(originalUrl, { waitUntil: 'domcontentloaded', timeout: CONFIG.GLOBAL.browserTimeout });
            await this.page.waitForTimeout(CONFIG.GLOBAL.pageLoadTimeout);
            
            // Re-query all elements after reload
            const refreshedElements = await this.page.$$(CONFIG.CLICK.selector.join(', '));
            if (i >= refreshedElements.length) {
              continue;
            }
            clickableElements[i] = refreshedElements[i];
          }
          
          const element = clickableElements[i];

          // Get element info before clicking
          const elementInfo = await ElementHandler.getElementInfo(element);
          
          // Check if element should be avoided using exclude selectors
          let shouldSkip = false;
          for (const selector of this.excludeSelectors) {
            const matches = await element.evaluate((el, sel) => {
              try {
                return el.matches(sel);
              } catch (e) {
                return false;
              }
            }, selector);
            
            if (matches) {
              shouldSkip = true;
              break;
            }
          }
          
          if (shouldSkip) {
            continue;
          }
          
          // Record the current network event count and timestamp before clicking
          const networkEventsBeforeClick = this.networkEvents.length;
          const clickStartTime = new Date().getTime();
          
          // Scroll element into view before clicking
          await element.scrollIntoViewIfNeeded({ timeout: CONFIG.CLICK.timeout });
          
          // Wait for element to be stable and clickable
          await element.waitForElementState('stable', { timeout: CONFIG.CLICK.timeout });
          
          // For links, ensure they open in new tab/window
          if (elementInfo.tagName === 'a' && elementInfo.href) {
            await ElementHandler.handleLinkClick(element, elementInfo, this.page);
          } else {
            // For non-link elements, do regular click
            await element.click({ timeout: CONFIG.CLICK.timeout });
          }
          
          // Capture screenshot of the clicked element with context
          let screenshotBuffer = null;
          try {
            // Wait a moment for any visual changes to settle
            await this.page.waitForTimeout(100);
            
            // Get element bounding box to calculate expanded area
            const boundingBox = await element.boundingBox();
            if (boundingBox) {
              const padding = CONFIG.GLOBAL.screenshotContextPadding;
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
            } else {
              // Fallback to element screenshot if bounding box fails
              screenshotBuffer = await element.screenshot({ 
                type: 'png',
                timeout: 4000
              });
            }
          } catch (screenshotError) {
            // Screenshot failed, continue without it
          }
          
          // Wait for network events within the time window
          const newNetworkEvents = await NetworkHandler.waitForClickNetworkEvents(this.page, clickStartTime, elementInfo, this.networkEvents, this.matchedNetworkEventKeys, this.extractEventsFromNetworkDataFn);
          
          // Record successful click event with all data
          const clickTimestamp = clickStartTime;
          this.clickEvents.push({
            timestamp: clickTimestamp,
            element: elementInfo,
            action: 'click',
            success: true,
            error: null,
            networkEventsBefore: networkEventsBeforeClick,
            networkEventsAfter: this.networkEvents.length,
            matchedNetworkEvents: newNetworkEvents,
            screenshot: screenshotBuffer
          });
          
        } catch (clickError) {
          await ElementHandler.recordFailedClick(clickableElements[i], clickError, i, this.clickEvents, this.networkEvents, this.page);
          
          // Continue with next element instead of crashing
          continue;
        }
      }
      
      log('✅ Click testing completed', 'success');
      log(`📊 Successful clicks: ${this.clickEvents.filter(c => c.success === true).length}, Failed: ${this.clickEvents.filter(c => c.success === false).length}`);
      
    } catch (error) {
      log(`⚠️ Error during click testing: ${error.message}`, 'error');
      // Don't re-throw - let the main run() method handle it
    }
  }

  /**
   * Get click test results
   */
  getResults() {
    return {
      clickEvents: this.clickEvents,
      summary: {
        totalClicks: this.clickEvents.length,
        successfulClicks: this.clickEvents.filter(click => click.success === true).length,
        failedClicks: this.clickEvents.filter(click => click.success === false).length
      }
    };
  }
}

module.exports = ClickTester;
