/**
 * Network Handler Utilities
 * 
 * This module contains functions for handling network events,
 * waiting for network responses, and analyzing network activity.
 * 
 * @author AI Assistant
 * @version 1.0
 */

const CONFIG = require('../config');

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
      CONFIG.NETWORK_FILTERS.GA4_URL.some(ga4Url => event.url.includes(ga4Url))
    );
    const otherEvents = events.length - ga4Events.length;
    return { ga4Events, otherEvents };
  }

  // Helper function to log event details
  static logEventDetails(events, startTime, actionType, actionInfo, extractEventsFromNetworkDataFn) {
    events.forEach((event, eventIdx) => {
      if (event.type === 'request') {
        const extractedEvents = extractEventsFromNetworkDataFn(event);
        const timeAfterAction = event.timestamp - startTime;
        
        if (extractedEvents.length > 0) {
          extractedEvents.forEach(evt => {
            const icon = actionType === 'click' ? '🔵' : '📊';
            const actionText = actionType === 'click' ? 'click' : `${actionInfo.percentage}% scroll`;
            console.log(`    ${icon} GA4 Event: ${evt.eventName} - ${evt.eventAction} - ${evt.eventLabel} (${timeAfterAction}ms after ${actionText})`);
          });
        } else if (CONFIG.NETWORK_FILTERS.GA4_URL.some(ga4Url => event.url.includes(ga4Url))) {
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
  static async waitForNetworkEvents(page, clickStartTime, elementInfo, networkEvents, matchedNetworkEventKeys, extractEventsFromNetworkDataFn) {
    console.log(`⏳ Waiting ${CONFIG.CLICK_EVENT_DELAY/1000}s for network events after clicking "${elementInfo.textContent}"...`);
    
    // Wait the full event delay time
    await page.waitForTimeout(CONFIG.CLICK_EVENT_DELAY);
    
    // Find all network events that occurred within the time window
    const newNetworkEvents = networkEvents.filter(networkEvent => {
      const timeAfterClick = networkEvent.timestamp - clickStartTime;
      const eventKey = this.createEventKey(networkEvent);
      
      // Only include events that:
      // 1. Occurred after the click (positive timeAfterClick)
      // 2. Are within our time window
      // 3. Haven't been matched to any previous click
      return timeAfterClick >= CONFIG.MIN_EVENT_DELAY && 
             timeAfterClick <= CONFIG.CLICK_EVENT_DELAY &&
             !matchedNetworkEventKeys.has(eventKey);
    });
    
    // Mark these events as matched
    this.markEventsAsMatched(newNetworkEvents, matchedNetworkEventKeys);
    
    // Log details of found network events
    if (newNetworkEvents.length > 0) {
      console.log(`📡 Found ${newNetworkEvents.length} network events within ${CONFIG.MIN_EVENT_DELAY/1000}-${CONFIG.CLICK_EVENT_DELAY/1000}s window after clicking "${elementInfo.textContent}"`);
      
      const { ga4Events, otherEvents } = this.categorizeEvents(newNetworkEvents);
      console.log(`  🔵 GA4 events: ${ga4Events.length}`);
      console.log(`  📡 Other events: ${otherEvents}`);
      
      this.logEventDetails(newNetworkEvents, clickStartTime, 'click', elementInfo, extractEventsFromNetworkDataFn);
    } else {
      console.log(`📡 No new network events found within ${CONFIG.MIN_EVENT_DELAY/1000}-${CONFIG.CLICK_EVENT_DELAY/1000}s window after clicking "${elementInfo.textContent}"`);
    }
    
    return newNetworkEvents;
  }

  // Helper function to wait for network events after a scroll action
  static async waitForScrollNetworkEvents(page, scrollStartTime, scrollInfo, networkEvents, matchedNetworkEventKeys, extractEventsFromNetworkDataFn) {
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
      const totalScrollWindow = CONFIG.SCROLL_EVENT_DELAY; // Add extra buffer
      const isWithinTimeWindow = timeAfterScroll >= CONFIG.MIN_EVENT_DELAY && 
                                timeAfterScroll <= totalScrollWindow;
      const isNotMatched = !matchedNetworkEventKeys.has(eventKey);
      const isScrollRelated = this.isScrollRelatedEvent(networkEvent, extractEventsFromNetworkDataFn);
    
      
      return isWithinTimeWindow && isNotMatched && (isScrollRelated || CONFIG.NETWORK_FILTERS.GA4_URL.some(ga4Url => networkEvent.url.includes(ga4Url)));
    });
    
    // Mark these events as matched
    this.markEventsAsMatched(newNetworkEvents, matchedNetworkEventKeys);
    
    const totalWindow = (CONFIG.SCROLL_EVENT_DELAY) / 1000;
    // Log details of found network events
    if (newNetworkEvents.length > 0) {
      console.log(`📊 Found ${newNetworkEvents.length} network events within ${totalWindow}s window after scrolling to ${scrollInfo.percentage}%`);
      
      const { ga4Events, otherEvents } = this.categorizeEvents(newNetworkEvents);
      console.log(`  📊 GA4 events: ${ga4Events.length}`);
      console.log(`  📡 Other events: ${otherEvents}`);
      
      this.logEventDetails(newNetworkEvents, scrollStartTime, 'scroll', scrollInfo, extractEventsFromNetworkDataFn);
    } else {
      console.log(`📊 No scroll-related network events found within ${totalWindow}s window after scrolling to ${scrollInfo.percentage}%`);
    }
    
    return newNetworkEvents;
  }

  // Helper function to determine if a network event is likely scroll-related
  static isScrollRelatedEvent(networkEvent, extractEventsFromNetworkDataFn) {
    // Check if it's a GA4 event
    const isGA4 = CONFIG.NETWORK_FILTERS.GA4_URL.some(ga4Url => networkEvent.url.includes(ga4Url));
    if (!isGA4) return false;
    
    // Extract events and check for scroll-related keywords
    const extractedEvents = extractEventsFromNetworkDataFn(networkEvent);
    
    for (const event of extractedEvents) {
      // Check event name, action, and label for scroll-related keywords
      const eventText = `${event.eventName || ''} ${event.eventAction || ''} ${event.eventLabel || ''}`.toLowerCase();
      
      const hasScrollKeywords = CONFIG.NETWORK_FILTERS.SCROLL_EVENT_KEYWORDS.some(keyword => 
        eventText.includes(keyword.toLowerCase())
      );
      
      if (hasScrollKeywords) {
        return true;
      }
    }
    
    // If no extracted events, check the raw post data for scroll keywords
    if (extractedEvents.length === 0 && networkEvent.postData) {
      const postDataLower = networkEvent.postData.toLowerCase();
      return CONFIG.NETWORK_FILTERS.SCROLL_EVENT_KEYWORDS.some(keyword => 
        postDataLower.includes(keyword.toLowerCase())
      );
    }
    
    return false;
  }
}

module.exports = NetworkHandler;
