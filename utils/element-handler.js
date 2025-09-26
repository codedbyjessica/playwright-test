/**
 * Element Handler Utilities
 * 
 * This module contains functions for handling DOM elements,
 * extracting element information, and managing click interactions.
 * 
 * @author AI Assistant
 * @version 1.0
 */

const CONFIG = require('../config');

class ElementHandler {
  // Helper function to get element info
  static async getElementInfo(element) {
    return await element.evaluate(el => {
      // Generate a CSS selector for this element
      let selector = el.tagName.toLowerCase();
      if (el.id) {
        selector = `#${el.id}`;
      } else if (el.className) {
        const classes = el.className.split(' ').filter(c => c.trim()).join('.');
        if (classes) {
          selector = `${el.tagName.toLowerCase()}.${classes}`;
        }
      }

      // Generate a CSS selector for the parent element (if any)
      let parentSelector = null;
      if (el.parentElement) {
        let parent = el.parentElement;
        parentSelector = parent.tagName.toLowerCase();
        if (parent.id) {
          parentSelector = `#${parent.id}`;
        } else if (parent.className) {
          const parentClasses = parent.className.split(' ').filter(c => c.trim()).join('.');
          if (parentClasses) {
            parentSelector = `${parent.tagName.toLowerCase()}.${parentClasses}`;
          }
        }
      }
      
      // Collect all ARIA attributes
      const ariaAttributes = {};
      const allAttributes = el.attributes;
      for (let i = 0; i < allAttributes.length; i++) {
        const attr = allAttributes[i];
        if (attr.name.startsWith('aria-')) {
          ariaAttributes[attr.name] = attr.value;
        }
      }
      
      return {
        tagName: el.tagName.toLowerCase(),
        textContent: el.textContent?.trim() || '',
        href: el.href || '',
        className: el.className || '',
        id: el.id || '',
        selector: selector,
        parentSelector: parentSelector,
        ariaAttributes: ariaAttributes
      };
    });
  }

  // Helper function to handle link clicks
  static async handleLinkClick(element, elementInfo, page) {
    console.log(`🔗 Link detected, opening in new tab: ${elementInfo.href}`);
    console.log("elementInfo", elementInfo);
    
    // Use Ctrl+Click (or Cmd+Click on Mac) to open link in new tab without modifying the page
    const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
    
    await element.click({ 
      button: 'left', 
      modifiers: [modifier],
      timeout: CONFIG.CLICK_TIMEOUT 
    });
    
    // Wait a moment for the new tab to open
    await page.waitForTimeout(CONFIG.WAIT_AFTER_CLICK);
    
    // Check if a new page was opened by looking at all pages
    const pages = page.context().pages();
    const newPage = pages.find(p => p !== page);
    
    if (newPage) {
      console.log(`📄 New tab opened, closing it and returning to original page`);
      await newPage.close();
    }
    
    // Ensure we're back on the original page
    await page.bringToFront();
  }

  // Helper function to record failed click
  static async recordFailedClick(element, clickError, i, clickEvents, networkEvents) {
    console.log(`⚠️ Failed to click element ${i + 1}: ${clickError.message}`);
    
    try {
      const elementInfo = await ElementHandler.getElementInfo(element);
      
      const clickTimestamp = new Date().getTime();
      clickEvents.push({
        timestamp: clickTimestamp,
        element: elementInfo,
        action: 'click',
        success: false,
        error: clickError.message,
        networkEventsBefore: networkEvents.length,
        networkEventsAfter: networkEvents.length,
        matchedNetworkEvents: []
      });
    } catch (evaluateError) {
      // If we can't even evaluate the element, record a basic failed click
      const clickTimestamp = new Date().getTime();
      clickEvents.push({
        timestamp: clickTimestamp,
        element: {
          tagName: 'unknown',
          textContent: '',
          href: '',
          className: '',
          id: '',
          selector: 'unknown'
        },
        action: 'click',
        success: false,
        error: `Failed to evaluate element: ${evaluateError.message}`,
        networkEventsBefore: networkEvents.length,
        networkEventsAfter: networkEvents.length,
        matchedNetworkEvents: []
      });
    }
  }
}

module.exports = ElementHandler;
