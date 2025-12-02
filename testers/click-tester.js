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

const fs = require('fs').promises;
const path = require('path');
const CONFIG = require('../config/main');
const ElementHandler = require('../utils/element-handler');
const NetworkHandler = require('../utils/network-handler');
const CustomActionsExecutor = require('../utils/custom-actions');
const { log } = require('../utils/logger');

class ClickTester {
  constructor(page, networkEvents, matchedNetworkEventKeys, clickEvents = [], afterRefreshAction = null) {
    this.page = page;
    this.networkEvents = networkEvents;
    this.matchedNetworkEventKeys = matchedNetworkEventKeys;
    this.clickEvents = clickEvents; // Reference to shared clickEvents array
    this.afterRefreshAction = afterRefreshAction;
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
          this.clickEvents
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
   * Generate cache filename from URL
   * @param {string} url - URL to generate cache filename for
   * @returns {string} Cache file path
   */
  getCacheFilePath(url) {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.replace(/\./g, '_');
      // Clean pathname: remove leading slash, replace slashes with underscores, remove special chars
      let pathname = urlObj.pathname.replace(/^\//, '').replace(/\//g, '_').replace(/[^a-zA-Z0-9_]/g, '') || 'root';
      // Limit pathname length to avoid filesystem issues
      if (pathname.length > 100) {
        pathname = pathname.substring(0, 100);
      }
      const filename = `clickable-elements_${hostname}_${pathname}.json`;
      const cacheDir = path.join(__dirname, '..', 'cache');
      return path.join(cacheDir, filename);
    } catch (error) {
      // Fallback if URL parsing fails
      const sanitized = url.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 100);
      const filename = `clickable-elements_${sanitized}.json`;
      const cacheDir = path.join(__dirname, '..', 'cache');
      return path.join(cacheDir, filename);
    }
  }

  /**
   * Extract element info from all elements
   * @param {Array} elements - Array of Playwright element handles
   * @returns {Promise<Array>} Array of element info objects
   */
  async extractElementsInfo(elements) {
    const elementsData = [];
    for (const element of elements) {
      try {
        const elementInfo = await ElementHandler.getElementInfo(element);
        elementsData.push(elementInfo);
      } catch (error) {
        log(`⚠️  Could not extract info for element: ${error.message}`);
      }
    }
    return elementsData;
  }

  /**
   * Save clickable elements to JSON cache
   * @param {string} url - URL of the page
   * @param {Array} elements - Array of Playwright element handles
   * @returns {Promise<void>}
   */
  async saveClickableElementsToCache(url, elements) {
    try {
      const cachePath = this.getCacheFilePath(url);
      const cacheDir = path.dirname(cachePath);
      
      // Ensure cache directory exists
      await fs.mkdir(cacheDir, { recursive: true });
      
      // Extract element info for each element
      const elementsData = await this.extractElementsInfo(elements);
      
      const cacheData = {
        url: url,
        timestamp: new Date().toISOString(),
        elementCount: elementsData.length,
        elements: elementsData
      };
      
      await fs.writeFile(cachePath, JSON.stringify(cacheData, null, 2));
      log(`💾 Saved ${elementsData.length} clickable elements to cache: ${path.basename(cachePath)}`);
    } catch (error) {
      log(`⚠️  Could not save clickable elements to cache: ${error.message}`);
    }
  }

  /**
   * Load clickable elements from JSON cache
   * @param {string} url - URL of the page
   * @returns {Promise<Object|null>} Cache data or null if not found
   */
  async loadClickableElementsFromCache(url) {
    try {
      const cachePath = this.getCacheFilePath(url);
      const cacheContent = await fs.readFile(cachePath, 'utf-8');
      const cacheData = JSON.parse(cacheContent);
      
      // Verify URL matches (in case of redirects or similar URLs)
      if (cacheData.url !== url) {
        log(`⚠️  Cache URL mismatch: cached ${cacheData.url} vs current ${url}`);
      }
      
      log(`📂 Loaded ${cacheData.elementCount} clickable elements from cache: ${path.basename(cachePath)}`);
      return cacheData;
    } catch (error) {
      if (error.code === 'ENOENT') {
        // Cache file doesn't exist, which is fine
        return null;
      }
      log(`⚠️  Could not load clickable elements from cache: ${error.message}`);
      return null;
    }
  }

  /**
   * Try to find element by text content using XPath
   * @param {Object} cachedElement - Cached element info
   * @returns {Promise<ElementHandle|null>} Found element or null
   */
  async findElementByTextContent(cachedElement) {
    if (!cachedElement.textContent || !cachedElement.tagName) {
      return null;
    }
    
    try {
      const textSnippet = cachedElement.textContent.substring(0, 50);
      const xpath = `//${cachedElement.tagName}[contains(text(), "${textSnippet}")]`;
      const textElements = await this.page.locator(`xpath=${xpath}`).all();
      return textElements.length > 0 ? textElements[0] : null;
    } catch {
      return null;
    }
  }

  /**
   * Try to find element by ID
   * @param {Object} cachedElement - Cached element info
   * @returns {Promise<ElementHandle|null>} Found element or null
   */
  async findElementById(cachedElement) {
    if (!cachedElement.id) {
      return null;
    }
    
    try {
      const idElements = await this.page.$$(`#${cachedElement.id}`);
      return idElements.length > 0 ? idElements[0] : null;
    } catch {
      return null;
    }
  }

  /**
   * Match element from multiple candidates by text content
   * @param {Array} elements - Array of candidate elements
   * @param {string} expectedText - Expected text content
   * @returns {Promise<ElementHandle|null>} Matched element or null
   */
  async matchElementByText(elements, expectedText) {
    if (!expectedText) {
      return elements[0] || null;
    }
    
    for (const element of elements) {
      try {
        const textContent = await element.textContent();
        if (textContent && textContent.trim() === expectedText.trim()) {
          return element;
        }
      } catch {
        continue;
      }
    }
    
    return elements[0] || null;
  }

  /**
   * Find a single element from cache using multiple strategies
   * @param {Object} cachedElement - Cached element info
   * @returns {Promise<ElementHandle|null>} Found element or null
   */
  async findSingleElementFromCache(cachedElement) {
    try {
      // Strategy 1: Try selector first (most reliable)
      const elements = await this.page.$$(cachedElement.selector);
      
      if (elements.length === 0) {
        // Strategy 2: Try by text content
        const textElement = await this.findElementByTextContent(cachedElement);
        if (textElement) return textElement;
        
        // Strategy 3: Try by ID
        const idElement = await this.findElementById(cachedElement);
        if (idElement) return idElement;
        
        log(`⚠️  Could not find element with selector: ${cachedElement.selector}`);
        return null;
      }
      
      // If multiple matches, try to match by text content
      if (elements.length > 1 && cachedElement.textContent) {
        return await this.matchElementByText(elements, cachedElement.textContent);
      }
      
      return elements[0];
    } catch (error) {
      log(`⚠️  Error finding element from cache: ${error.message}`);
      return null;
    }
  }

  /**
   * Find elements on page using cached selectors
   * @param {Array} cachedElements - Array of cached element info with selectors
   * @returns {Promise<Array>} Array of Playwright element handles
   */
  async findElementsFromCache(cachedElements) {
    const foundElements = [];
    
    for (const cachedElement of cachedElements) {
      const element = await this.findSingleElementFromCache(cachedElement);
      if (element) {
        foundElements.push(element);
      }
    }
    
    return foundElements;
  }

  /**
   * Refresh page and execute pre-test actions
   * @param {string} url - URL to navigate to
   * @returns {Promise<void>}
   */
  async refreshPage(url) {
    await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: CONFIG.GLOBAL.browserTimeout });
    await this.page.waitForTimeout(CONFIG.GLOBAL.pageLoadTimeout);
    
    // Execute pre-test actions after reload (e.g., close popups)
    if (this.afterRefreshAction) {
      await CustomActionsExecutor.execute(this.page, this.afterRefreshAction);
    }
  }

  /**
   * Re-find elements after page refresh
   * @param {Object|null} cacheData - Cached element data or null
   * @returns {Promise<Array>} Array of refreshed element handles
   */
  async refreshElements(cacheData) {
    if (cacheData && cacheData.elements) {
      // Use cached selectors to find elements
      return await this.findElementsFromCache(cacheData.elements);
    } else {
      // Fallback to querying all elements
      return await this.page.$$(CONFIG.CLICK.selector.join(', '));
    }
  }

  /**
   * Calculate estimated time for click testing
   * @param {number} elementCount - Number of clickable elements
   * @returns {Object} Time estimation data
   */
  calculateEstimatedTime(elementCount) {
    const firstClickTime = CONFIG.CLICK.eventDelay;
    const subsequentClickTime = CONFIG.GLOBAL.pageLoadTimeout + CONFIG.CLICK.eventDelay;
    const estimatedTimeMs = firstClickTime + (elementCount - 1) * subsequentClickTime;
    const estimatedSeconds = (estimatedTimeMs / 1000).toFixed(1);
    const estimatedMinutes = (estimatedTimeMs / 60000).toFixed(1);
    
    return {
      totalMs: estimatedTimeMs,
      seconds: estimatedSeconds,
      minutes: estimatedMinutes,
      perClick: subsequentClickTime
    };
  }

  /**
   * Log estimated time for click testing
   * @param {number} elementCount - Number of clickable elements
   */
  logEstimatedTime(elementCount) {
    const timeEstimate = this.calculateEstimatedTime(elementCount);
    const timeDisplay = timeEstimate.totalMs < 60000 
      ? `${timeEstimate.seconds} s` 
      : `${timeEstimate.minutes} min`;
    
    log(`⏱️  Estimated time: ~${timeDisplay} (${elementCount} elements × ~${(timeEstimate.perClick / 1000).toFixed(1)}s per click)`);
  }

  /**
   * Initialize clickable elements (load from cache or query page)
   * @param {string} url - URL of the page
   * @returns {Promise<Object>} Object with elements array and cache data
   */
  async initializeClickableElements(url) {
    let clickableElements = [];
    let cacheData = await this.loadClickableElementsFromCache(url);
    
    if (cacheData && cacheData.elements) {
      // Use cached elements - find them on the page using selectors
      log(`📂 Using cached clickable elements (${cacheData.elementCount} elements)`);
      clickableElements = await this.findElementsFromCache(cacheData.elements);
      log(`✅ Found ${clickableElements.length} elements from cache on page`);
      
      // If we found fewer elements than cached, log a warning
      if (clickableElements.length < cacheData.elementCount) {
        log(`⚠️  Found ${clickableElements.length} elements but cache has ${cacheData.elementCount} - some elements may have changed`);
      }
    } else {
      // No cache found, query page and save to cache
      clickableElements = await this.page.$$(CONFIG.CLICK.selector.join(', '));
      log(`Found ${clickableElements.length} clickable elements`);
      
      // Save to cache for future use
      await this.saveClickableElementsToCache(url, clickableElements);
      // Reload cache data for refresh logic
      cacheData = await this.loadClickableElementsFromCache(url);
    }
    
    return { clickableElements, cacheData };
  }

  /**
   * Main click testing method
   */
  async runClickTests() {
    log('🖱️ Starting click testing...');
    
    try {
      // Store the original URL to reload between clicks
      const originalUrl = this.page.url();
      
      // Initialize clickable elements (from cache or query page)
      const { clickableElements, cacheData } = await this.initializeClickableElements(originalUrl);
      
      // Log estimated time
      this.logEstimatedTime(clickableElements.length);
      
      for (let i = 0; i < clickableElements.length; i++) {
        try {
          // Reload page before each click to ensure clean state
          if (i > 0) {
            await this.refreshPage(originalUrl);
            
            // Re-find elements after refresh
            const refreshedElements = await this.refreshElements(cacheData);
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
            this.clickEvents
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
