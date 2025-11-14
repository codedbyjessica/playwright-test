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
const CustomActionsExecutor = require('../utils/custom-actions');
const { log } = require('../utils/logger');

class ClickTester {
  constructor(page, networkEvents, matchedNetworkEventKeys, extractEventsFromNetworkDataFn, afterRefreshAction = null) {
    this.page = page;
    this.networkEvents = networkEvents;
    this.matchedNetworkEventKeys = matchedNetworkEventKeys;
    this.extractEventsFromNetworkDataFn = extractEventsFromNetworkDataFn;
    this.afterRefreshAction = afterRefreshAction;
    this.clickEvents = [];
    this.excludeSelectors = CONFIG.ONETRUST.selector;
  }

  /**
   * Check if element should be excluded based on selectors
   */
  async shouldExcludeElement(element) {
    for (const selector of this.excludeSelectors) {
      const matches = await element.evaluate((el, sel) => {
        try {
          return el.matches(sel);
        } catch (e) {
          return false;
        }
      }, selector);
      
      if (matches) {
        return true;
      }
    }
    return false;
  }

  /**
   * Scroll element into view with fallback
   */
  async scrollElementIntoView(element) {
    try {
      await element.scrollIntoViewIfNeeded({ timeout: CONFIG.CLICK.timeout });
      await element.waitForElementState('stable', { timeout: CONFIG.CLICK.timeout });
    } catch (scrollError) {
      // If scroll fails, try to scroll with offset to account for sticky headers
      await element.evaluate(el => {
        el.scrollIntoView({ block: 'center', inline: 'center' });
      });
      await this.page.waitForTimeout(500);
    }
  }

  /**
   * Click element with fallback to JavaScript click
   */
  async clickElement(element, elementInfo, elementIndex) {
    try {
      // For links, ensure they open in new tab/window
      if (elementInfo.tagName === 'a' && elementInfo.href) {
        await ElementHandler.handleLinkClick(element, elementInfo, this.page);
      } else {
        // For non-link elements, do regular click
        await element.click({ timeout: CONFIG.CLICK.timeout });
      }
    } catch (clickError) {
      // If regular click fails due to viewport issues, try JavaScript click
      if (clickError.message.includes('outside of the viewport') || clickError.message.includes('intercept')) {
        log(`⚠️ Regular click failed, attempting JavaScript click for element ${elementIndex + 1}...`);
        await element.evaluate(el => el.click());
      } else {
        throw clickError;
      }
    }
  }

  /**
   * Capture screenshot of clicked element with context
   */
  async captureElementScreenshot(element) {
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
        
        return await this.page.screenshot({ 
          type: 'png',
          timeout: 4000,
          clip: clip
        });
      } else {
        // Fallback to element screenshot if bounding box fails
        return await element.screenshot({ 
          type: 'png',
          timeout: 4000
        });
      }
    } catch (screenshotError) {
      // Screenshot failed, return null
      return null;
    }
  }

  /**
   * Find new dropdown items that appeared after clicking nav element
   * Only finds items that are children of the clicked element's parent <li>
   */
  async findNewDropdownItems(clickableElements, clickedElement) {
    // Get the parent <li> container of the clicked element
    const parentLi = await clickedElement.evaluateHandle(el => {
      return el.closest('li');
    });
    
    if (!parentLi) {
      return [];
    }
    
    // Find all clickable elements within this parent <li>
    const newClickables = await parentLi.$$(CONFIG.CLICK.selector.join(','));
    const dropdownItems = [];
    
    for (const newElement of newClickables) {
      const isVisible = await newElement.isVisible();
      if (!isVisible) continue;
      
      // Skip the clicked element itself
      const isSameAsClicked = await newElement.evaluate((el, clickedEl) => {
        return el === clickedEl;
      }, clickedElement);
      
      if (isSameAsClicked) continue;
      
      // Get info for comparison
      const newElementInfo = await ElementHandler.getElementInfo(newElement);
      
      // Check if this element is new (not in original list)
      let isNew = true;
      for (let j = 0; j < clickableElements.length; j++) {
        try {
          const isSameElement = await clickableElements[j].evaluate((el, selector) => {
            try {
              return el.matches(selector);
            } catch {
              return false;
            }
          }, newElementInfo.selector);
          
          if (isSameElement) {
            isNew = false;
            break;
          }
        } catch {
          continue;
        }
      }
      
      if (isNew) {
        dropdownItems.push(newElement);
      }
    }
    
    return dropdownItems;
  }

  /**
   * Test dropdown items immediately while visible
   */
  async testDropdownItems(dropdownItems) {
    log(`   📋 Found ${dropdownItems.length} new dropdown items - testing them now while visible`);
    
    for (let d = 0; d < dropdownItems.length; d++) {
      try {
        const dropdownElement = dropdownItems[d];
        const dropdownInfo = await ElementHandler.getElementInfo(dropdownElement);
        
        // Skip if should be excluded
        if (await this.shouldExcludeElement(dropdownElement)) {
          continue;
        }
        
        log(`   🔽 Testing dropdown item ${d + 1}/${dropdownItems.length}: ${dropdownInfo.textContent || dropdownInfo.selector}`);
        
        const dropdownClickStart = new Date().getTime();
        
        // Try to click the dropdown item
        await this.scrollElementIntoView(dropdownElement);
        await this.clickElement(dropdownElement, dropdownInfo, d);
        
        // Wait for network events
        const dropdownNetworkEvents = await NetworkHandler.waitForClickNetworkEvents(
          this.page, 
          dropdownClickStart, 
          dropdownInfo, 
          this.networkEvents, 
          this.matchedNetworkEventKeys, 
          this.extractEventsFromNetworkDataFn
        );
        
        // Record dropdown click
        this.clickEvents.push({
          timestamp: dropdownClickStart,
          element: dropdownInfo,
          action: 'click',
          success: true,
          error: null,
          networkEventsBefore: this.networkEvents.length - dropdownNetworkEvents.length,
          networkEventsAfter: this.networkEvents.length,
          matchedNetworkEvents: dropdownNetworkEvents,
          screenshot: null,
          isDropdownItem: true
        });
        
      } catch (dropdownError) {
        log(`   ⚠️  Failed to test dropdown item: ${dropdownError.message}`);
        // Continue with other dropdown items
      }
    }
    
    log(`   ✅ Completed testing ${dropdownItems.length} dropdown items`);
  }

  /**
   * Refresh page and execute pre-test actions
   * @param {string} url - URL to navigate to
   * @returns {Promise<Array>} Refreshed clickable elements
   */
  async refreshPage(url) {
    await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: CONFIG.GLOBAL.browserTimeout });
    await this.page.waitForTimeout(CONFIG.GLOBAL.pageLoadTimeout);
    
    // Execute pre-test actions after reload (e.g., close popups)
    if (this.afterRefreshAction) {
      await CustomActionsExecutor.execute(this.page, this.afterRefreshAction);
    }
    
    // Re-query all elements after reload
    return await this.page.$$(CONFIG.CLICK.selector.join(', '));
  }

  /**
   * Main click testing method
   */
  async runClickTests() {
    log('🖱️ Starting click testing...');
    
    try {
      // Store the original URL to reload between clicks
      const originalUrl = this.page.url();
      
      // Get all clickable elements
      const clickableElements = await this.page.$$(CONFIG.CLICK.selector.join(', '));
      log(`Found ${clickableElements.length} clickable elements`);
      
      for (let i = 0; i < clickableElements.length; i++) {
        try {
          // Reload page before each click to ensure clean state
          if (i > 0) {
            const refreshedElements = await this.refreshPage(originalUrl);
            if (i >= refreshedElements.length) {
              continue;
            }
            clickableElements[i] = refreshedElements[i];
          }
          
          const element = clickableElements[i];
          const elementInfo = await ElementHandler.getElementInfo(element);
          
          // Skip excluded elements
          if (await this.shouldExcludeElement(element)) {
            continue;
          }
          
          // Record state before clicking
          const networkEventsBeforeClick = this.networkEvents.length;
          const clickStartTime = new Date().getTime();
          
          // Scroll and click element
          await this.scrollElementIntoView(element);
          await this.clickElement(element, elementInfo, i);
          
          // Capture screenshot
          const screenshotBuffer = await this.captureElementScreenshot(element);
          
          // Wait for network events
          const newNetworkEvents = await NetworkHandler.waitForClickNetworkEvents(
            this.page, 
            clickStartTime, 
            elementInfo, 
            this.networkEvents, 
            this.matchedNetworkEventKeys, 
            this.extractEventsFromNetworkDataFn
          );
          
          // Record successful click
          this.clickEvents.push({
            timestamp: clickStartTime,
            element: elementInfo,
            action: 'click',
            success: true,
            error: null,
            networkEventsBefore: networkEventsBeforeClick,
            networkEventsAfter: this.networkEvents.length,
            matchedNetworkEvents: newNetworkEvents,
            screenshot: screenshotBuffer
          });
          
          // Check for dropdown items if this is a nav/header element
          const isNavOrHeader = await element.evaluate(el => {
            const parent = el.closest('header, nav, [role="navigation"]');
            return parent !== null;
          });
          
          if (isNavOrHeader) {
            await this.page.waitForTimeout(500); // Wait for dropdown animation
            
            // Force all hidden dropdown items to be visible using JavaScript
            await element.evaluate(clickedEl => {
              const parentLi = clickedEl.closest('li');
              if (parentLi) {
                // Find all hidden dropdown containers and force them to display
                const hiddenContainers = parentLi.querySelectorAll('[style*="display: none"], [style*="display:none"]');
                hiddenContainers.forEach(container => {
                  container.style.display = 'block';
                  container.style.visibility = 'visible';
                  container.style.opacity = '1';
                });
                
                // Also look for elements with hidden classes or attributes
                const allDescendants = parentLi.querySelectorAll('*');
                allDescendants.forEach(el => {
                  const computed = window.getComputedStyle(el);
                  if (computed.display === 'none' || computed.visibility === 'hidden') {
                    el.style.display = 'block';
                    el.style.visibility = 'visible';
                    el.style.opacity = '1';
                  }
                });
              }
            });
            
            // Wait a bit for the forced display to take effect
            await this.page.waitForTimeout(300);
            
            const dropdownItems = await this.findNewDropdownItems(clickableElements, element);
            
            if (dropdownItems.length > 0) {
              await this.testDropdownItems(dropdownItems);
            }
          }
          
        } catch (clickError) {
          await ElementHandler.recordFailedClick(clickableElements[i], clickError, i, this.clickEvents, this.networkEvents, this.page);
          continue;
        }
      }
      
      log('✅ Click testing completed', 'success');
      log(`📊 Successful clicks: ${this.clickEvents.filter(c => c.success === true).length}, Failed: ${this.clickEvents.filter(c => c.success === false).length}`);
      
    } catch (error) {
      log(`⚠️ Error during click testing: ${error.message}`, 'error');
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
