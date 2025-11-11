/**
 * Event Classification Utilities
 * 
 * This module contains functions for classifying, filtering, and matching
 * GA4 events with user interactions (clicks, scrolls, etc.).
 * 
 * @author AI Assistant
 * @version 1.0
 */

const CONFIG = require('../config/main');

class EventClassifier {
  // Helper function to check if event is a scroll event
  static isScrollEvent(event) {
    const eventName = event.eventName?.toLowerCase() || '';
    const rawData = event.rawData?.toLowerCase() || '';
    
    return CONFIG.SCROLL.eventKeywords.some(keyword => 
      eventName.includes(keyword) || rawData.includes(keyword)
    );
  }

  // Helper function to check if event is a pageview
  static isPageviewEvent(event) {
    return event.eventName === 'page_view' || 
           event.eventName === 'pageview' ||
           event.eventName === 'page view' ||
           event.rawData?.toLowerCase().includes('page_view') ||
           event.rawData?.toLowerCase().includes('pageview') ||
           event.rawData?.toLowerCase().includes('page view');
  }

  // Helper function to check if event should be excluded from click matching
  static shouldExcludeFromClickMatch(networkUrl, postData = '') {
    // Extract event name from URL query string or POST data
    let eventName = '';
    
    try {
      // Try POST data first (more common for GA4)
      if (postData) {
        const postParams = new URLSearchParams(postData);
        eventName = (postParams.get('en') || '').toLowerCase();
      }
      
      // If not in POST data, try URL query string (for GET requests)
      if (!eventName && networkUrl.includes('?')) {
        const urlObj = new URL(networkUrl);
        eventName = (urlObj.searchParams.get('en') || '').toLowerCase();
      }
    } catch (e) {
      console.log(`⚠️ Error parsing event data: ${e.message}`);
      return false;
    }
    
    // Only check the event name parameter, not the entire URL
    if (!eventName) {
      return false; // No event name found, don't exclude
    }
    
    // Check if event name contains any exclude keyword
    return CONFIG.CLICK.excludeKeywords.some(keyword => {
      const lowerKeyword = keyword.toLowerCase();
      return eventName.includes(lowerKeyword);
    });
  }

  // Helper function to find related trigger events
  static findRelatedTriggers(eventTimestamp, eventName = '', networkUrl = '', postData = '', clickEvents) {
    // For click matching, we now use the direct matching approach
    // where each click event has its own matchedNetworkEvents array
    // NOTE: We do NOT filter here - all events are captured, filtering happens at report display time
    const relatedClick = clickEvents.find(click => {
      // Only match successful clicks (success === true)
      if (click.success !== true) {
        return false;
      }
      
      // Check if this network event is in the click's matchedNetworkEvents array
      const isMatched = click.matchedNetworkEvents && click.matchedNetworkEvents.some(networkEvent => {
        return networkEvent.timestamp === eventTimestamp && networkEvent.url === networkUrl;
      });
      
      if (isMatched) {
        console.log(`✅ Direct match: Click on ${click.element?.tagName} - "${click.element?.textContent}" triggered this network event`);
      }
      
      return isMatched;
    });
    
    return { relatedScroll: null, relatedClick };
  }

  // Helper function to generate trigger action string
  static generateTriggerAction(relatedScroll, relatedClick) {
    if (relatedClick) {
      return `click (${relatedClick.element.tagName}: "${relatedClick.element.textContent}" - ${relatedClick.element.selector})`;
    }
    return '';
  }

  // Helper function to filter events by type
  static filterEventsByType(events, type, clickEvents) {
    switch (type) {
      case 'scroll':
        return events.filter(evt => EventClassifier.isScrollEvent(evt));
      case 'click':
        return events.filter(evt => 
          evt.triggerAction?.includes('click') && 
          !EventClassifier.isPageviewEvent(evt) &&
          !EventClassifier.isScrollEvent(evt)
        );
      case 'pageview':
        return events.filter(evt => EventClassifier.isPageviewEvent(evt));
      case 'unmatched':
        // For unmatched events, we need to exclude events that were directly matched to clicks
        const directlyMatchedNetworkEvents = new Set();
        clickEvents.filter(click => click.success === true).forEach(click => {
          if (click.matchedNetworkEvents) {
            click.matchedNetworkEvents.forEach(networkEvent => {
              directlyMatchedNetworkEvents.add(`${networkEvent.timestamp}-${networkEvent.url}`);
            });
          }
        });
        
        return events.filter(evt => {
          const eventKey = `${evt.timestamp}-${evt.url}`;
          return !evt.triggerAction?.includes('click') && 
                 !EventClassifier.isPageviewEvent(evt) &&
                 !EventClassifier.isScrollEvent(evt) &&
                 !directlyMatchedNetworkEvents.has(eventKey);
        });
      default:
        return events;
    }
  }
}

module.exports = EventClassifier;
