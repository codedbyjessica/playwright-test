/**
 * Network Handler Utilities
 * 
 * This module contains functions for handling network events,
 * waiting for network responses, and analyzing network activity.
 * 
 * @author AI Assistant
 * @version 1.0
 */

const CONFIG = require('../config/main');

class NetworkHandler {
  // Helper function to create event key for deduplication
  static createEventKey(networkEvent) {
    return `${networkEvent.timestamp}-${networkEvent.url}`;
  }

  // Helper function to mark events as matched
  static markEventsAsMatched(events, matchedNetworkEventKeys) {
    events.forEach(event => {
      const eventKey = this.createEventKey(event);
      matchedNetworkEventKeys.add(eventKey);
    });
  }

  // Helper function to count GA4 vs other events
  static categorizeEvents(events) {
    const ga4Events = events.filter(event => 
      CONFIG.GLOBAL.ga4Urls.some(ga4Url => event.url.includes(ga4Url))
    );
    const otherEvents = events.length - ga4Events.length;
    return { ga4Events, otherEvents };
  }

  // Helper function to log event details
  static logEventDetails(events, startTime, actionType, actionInfo, clickEvents) {
    const EventParser = require('./event-parser');
    events.forEach((event, eventIdx) => {
      if (event.type === 'request') {
        const extractedEvents = EventParser.extractEventsFromNetworkData(event, clickEvents);
        const timeAfterAction = event.timestamp - startTime;
        
        if (extractedEvents.length > 0) {
          extractedEvents.forEach(evt => {
            const icon = actionType === 'click' ? '🔵' : '📊';
            const actionText = actionType === 'click' ? 'click' : `${actionInfo.percentage}% scroll`;
            console.log(`    ${icon} GA4 Event: ${evt.eventName} - ${evt.eventAction} - ${evt.eventLabel} (${timeAfterAction}ms after ${actionText})`);
          });
        } else if (CONFIG.GLOBAL.ga4Urls.some(ga4Url => event.url.includes(ga4Url))) {
          const icon = actionType === 'click' ? '🔵' : '📊';
          const actionText = actionType === 'click' ? 'click' : `${actionInfo.percentage}% scroll`;
          console.log(`    ${icon} GA4 Request: ${event.url} (${timeAfterAction}ms after ${actionText})`);
        } else {
          const actionText = actionType === 'click' ? 'click' : `${actionInfo.percentage}% scroll`;
          console.log(`    📡 Other Request: ${event.method} ${event.url} (${timeAfterAction}ms after ${actionText})`);
        }
      }
    });
  }

  // Helper function to wait for network events after a click
  static async waitForClickNetworkEvents(page, clickStartTime, elementInfo, networkEvents, matchedNetworkEventKeys, clickEvents) {
    console.log(`⏳ Waiting ${CONFIG.CLICK.eventDelay/1000}s for network events after clicking "${elementInfo.textContent}"...`);
    
    // Wait the full event delay time
    await page.waitForTimeout(CONFIG.CLICK.eventDelay);
    
    // Find all network events that occurred within the time window
    const newNetworkEvents = networkEvents.filter(networkEvent => {
      const timeAfterClick = networkEvent.timestamp - clickStartTime;
      const eventKey = this.createEventKey(networkEvent);
      
      // Only include events that:
      // 1. Occurred after the click (positive timeAfterClick)
      // 2. Are within our time window
      // 3. Haven't been matched to any previous click
      return timeAfterClick >= CONFIG.GLOBAL.minEventDelay && 
             timeAfterClick <= CONFIG.CLICK.eventDelay &&
             !matchedNetworkEventKeys.has(eventKey);
    });
    
    // Mark these events as matched
    this.markEventsAsMatched(newNetworkEvents, matchedNetworkEventKeys);
    
    // Log details of found network events
    if (newNetworkEvents.length > 0) {
      console.log(`📡 Found ${newNetworkEvents.length} network events within ${CONFIG.GLOBAL.minEventDelay/1000}-${CONFIG.CLICK.eventDelay/1000}s window after clicking "${elementInfo.textContent}"`);
      
      const { ga4Events, otherEvents } = this.categorizeEvents(newNetworkEvents);
      console.log(`  🔵 GA4 events: ${ga4Events.length}`);
      console.log(`  📡 Other events: ${otherEvents}`);
      
      this.logEventDetails(newNetworkEvents, clickStartTime, 'click', elementInfo, clickEvents);
    } else {
      console.log(`📡 No new network events found within ${CONFIG.GLOBAL.minEventDelay/1000}-${CONFIG.CLICK.eventDelay/1000}s window after clicking "${elementInfo.textContent}"`);
    }
    
    return newNetworkEvents;
  }

  // Helper function to wait for network events after a scroll action
  static async waitForScrollNetworkEvents(page, scrollStartTime, scrollInfo, networkEvents, matchedNetworkEventKeys, clickEvents) {
    console.log(`🔍 Checking for network events after scrolling to ${scrollInfo.percentage}%...`);
    
    // Find all network events that occurred within the time window after scroll
    const newNetworkEvents = networkEvents.filter(networkEvent => {
      const timeAfterScroll = networkEvent.timestamp - scrollStartTime;
      const eventKey = this.createEventKey(networkEvent);
      
      // Only include events that:
      // 1. Occurred after the scroll (positive timeAfterScroll)
      // 2. Are within our extended scroll time window (includes SCROLL_EVENT_DELAY + SCROLL_TIMEOUT)
      // 3. Haven't been matched to any previous action
      // 4. Are likely scroll-related (check for scroll keywords or GA4 events)
      const totalScrollWindow = CONFIG.SCROLL.eventDelay; // Add extra buffer
      const isWithinTimeWindow = timeAfterScroll >= CONFIG.GLOBAL.minEventDelay && 
                                timeAfterScroll <= totalScrollWindow;
      const isNotMatched = !matchedNetworkEventKeys.has(eventKey);
      const isScrollRelated = this.isScrollRelatedEvent(networkEvent, clickEvents);
    
      
      return isWithinTimeWindow && isNotMatched && (isScrollRelated || CONFIG.GLOBAL.ga4Urls.some(ga4Url => networkEvent.url.includes(ga4Url)));
    });
    
    // Mark these events as matched
    this.markEventsAsMatched(newNetworkEvents, matchedNetworkEventKeys);
    
    const totalWindow = (CONFIG.SCROLL.eventDelay) / 1000;
    // Log details of found network events
    if (newNetworkEvents.length > 0) {
      console.log(`📊 Found ${newNetworkEvents.length} network events within ${totalWindow}s window after scrolling to ${scrollInfo.percentage}%`);
      
      const { ga4Events, otherEvents } = this.categorizeEvents(newNetworkEvents);
      console.log(`  📊 GA4 events: ${ga4Events.length}`);
      console.log(`  📡 Other events: ${otherEvents}`);
      
      this.logEventDetails(newNetworkEvents, scrollStartTime, 'scroll', scrollInfo, clickEvents);
    } else {
      console.log(`📊 No scroll-related network events found within ${totalWindow}s window after scrolling to ${scrollInfo.percentage}%`);
    }
    
    return newNetworkEvents;
  }

  // Helper function to determine if a network event is likely scroll-related
  static isScrollRelatedEvent(networkEvent, clickEvents) {
    const EventParser = require('./event-parser');
    // Check if it's a GA4 event
    const isGA4 = CONFIG.GLOBAL.ga4Urls.some(ga4Url => networkEvent.url.includes(ga4Url));
    if (!isGA4) return false;
    
    // Extract events and check for scroll-related keywords
    const extractedEvents = EventParser.extractEventsFromNetworkData(networkEvent, clickEvents);
    
    for (const event of extractedEvents) {
      // Check event name, action, and label for scroll-related keywords
      const eventText = `${event.eventName || ''} ${event.eventAction || ''} ${event.eventLabel || ''}`.toLowerCase();
      
      const hasScrollKeywords = CONFIG.SCROLL.eventKeywords.some(keyword => 
        eventText.includes(keyword.toLowerCase())
      );
      
      if (hasScrollKeywords) {
        return true;
      }
    }
    
    // If no extracted events, check the raw post data for scroll keywords
    if (extractedEvents.length === 0 && networkEvent.postData) {
      const postDataLower = networkEvent.postData.toLowerCase();
      return CONFIG.SCROLL.eventKeywords.some(keyword => 
        postDataLower.includes(keyword.toLowerCase())
      );
    }
    
    return false;
  }

  /**
   * Wait for form network events and extract GA4 event data
   * This method waits for events and immediately extracts the GA4 data from network requests
   * @param {Object} options - Configuration options
   * @param {Page} options.page - Playwright page object
   * @param {number} options.startTime - Action start timestamp
   * @param {Array} options.networkEvents - Array of all network events
   * @param {Array} options.clickEvents - Array of click events for trigger matching
   * @param {number} options.timeout - How long to wait (default: CONFIG.FORM.eventDelay)
   * @param {Object} options.actionInfo - Info about the action for logging
   */
  static async waitForFormNetworkEvents(options) {
    const EventParser = require('./event-parser');
    const {
      page,
      startTime,
      networkEvents,
      clickEvents = [],
      timeout = CONFIG.FORM.eventDelay,
      actionInfo = {}
    } = options;
    
    const actionDescription = `${actionInfo.action}_${actionInfo.type}`;
    console.log(`🔍 Waiting ${timeout/1000}s for events after ${actionDescription}...`);
    
    // Wait the full timeout period
    await page.waitForTimeout(timeout);
    
    const endTime = Date.now();
    
    // Get ALL events that occurred between action start and now
    const eventsInWindow = networkEvents.filter(event => 
      event.timestamp >= startTime && event.timestamp <= endTime
    );
    
    console.log(`📡 Found ${eventsInWindow.length} total events in ${timeout/1000}s window`);
    
    // Extract event details using the same parser as click tester
    const processedEvents = [];
    
    eventsInWindow.forEach(event => {
      const extractedEvents = EventParser.extractEventsFromNetworkData(event, clickEvents);
      if (extractedEvents.length > 0) {
        extractedEvents.forEach(extractedEvent => {
          processedEvents.push({
            ...event,
            eventName: extractedEvent.eventName,
            eventAction: extractedEvent.eventAction,
            eventLabel: extractedEvent.eventLabel,
            extractedParams: extractedEvent
          });
        });
      } else {
        // Include raw event even if no extracted params
        processedEvents.push({
          ...event,
          eventName: 'unknown'
        });
      }
    });
    
    console.log(`📊 Processed ${processedEvents.length} events with extracted data`);
    processedEvents.forEach((event, idx) => {
      console.log(`   ${idx + 1}. ${new Date(event.timestamp).toLocaleTimeString()} - ${event.eventName || 'unknown'}`);
    });
    
    return processedEvents;
  }
}

module.exports = NetworkHandler;
