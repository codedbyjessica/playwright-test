/**
 * Event Parser Utilities
 * 
 * This module contains functions for parsing and extracting GA4 event data
 * from network requests (POST data and URLs).
 * 
 * @author AI Assistant
 * @version 1.0
 */

const CONFIG = require('../config/main');

class EventParser {
  // Helper function to get first matching parameter value
  static getParamFirstMatch(params, paramKeys) {
    for (const key of paramKeys) {
      const value = params.get(key);
      if (value !== null && value !== undefined) return { value, paramName: key };
    }
    return { value: '', paramName: null };
  }

  // Helper function to extract event parameters from POST data
  static extractEventParams(postData) {
    const result = {};
    
    if (postData) {
      try {
        const postParams = new URLSearchParams(postData);
        // Dynamically extract all configured parameters
        Object.entries(CONFIG.GLOBAL.eventParams).forEach(([key, paramKeys]) => {
          const { value, paramName } = EventParser.getParamFirstMatch(postParams, paramKeys);
          result[key] = value;
          result[`_rawParam_${key}`] = paramName; // Store which parameter was actually used
        });
      } catch (e) {
        console.log('⚠️  Error parsing POST data:', e.message);
      }
    }
    
    return result;
  }

  // Helper function to extract event parameters from URL or POST data
  static extractEventParamsFromData(data, source = 'POST') {
    const params = new URLSearchParams(data);
    const result = {};
    
    // Dynamically extract all configured parameters
    Object.entries(CONFIG.GLOBAL.eventParams).forEach(([key, paramKeys]) => {
      const { value, paramName } = EventParser.getParamFirstMatch(params, paramKeys);
      result[key] = value;
      result[`_rawParam_${key}`] = paramName; // Store which parameter was actually used
    });
    
    return result;
  }

  // Helper function to parse events from data
  static parseEventsFromData(data, eventTimestamp, source = 'POST', networkUrl = '', postData = '', clickEvents, findRelatedTriggersFn, generateTriggerActionFn) {
    const events = [];
    
    try {
      // First, split by spaces to get potential event segments
      let eventSegments = data.split(' ').filter(segment => segment.trim());
      
      // If we have multiple segments and they all contain 'en=', treat them as separate events
      if (eventSegments.length > 1 && eventSegments.every(segment => segment.includes('en='))) {
        // Each segment is a separate event
        eventSegments.forEach((segment, segmentIndex) => {
          const params = EventParser.extractEventParamsFromData(segment, source);
          const { relatedScroll, relatedClick } = findRelatedTriggersFn(eventTimestamp, params.eventName, networkUrl, postData, clickEvents);
          const triggerAction = generateTriggerActionFn(relatedScroll, relatedClick);
          
          // Check if any parameter has a value
          const hasAnyValue = Object.values(params).some(value => value && value.trim() !== '');
          
          if (hasAnyValue) {
            events.push({
              line: segmentIndex + 1,
              ...params,
              triggerAction,
              rawData: segment,
              source,
              scrollPercentage: relatedScroll ? relatedScroll.percentage : null,
              clickElement: relatedClick ? relatedClick.element : null
            });
          }
        });
      } else {
        // Handle single event or complex multi-event payload
        let eventLines = eventSegments;
        
        // If we have one line with multiple 'en=' occurrences, split it properly
        if (eventLines.length === 1 && (eventLines[0].match(/en=/g) || []).length > 1) {
          const line = eventLines[0];
          const enMatches = [...line.matchAll(/en=/g)];
          eventLines = [];
          
          for (let i = 0; i < enMatches.length; i++) {
            const startIndex = enMatches[i].index;
            const endIndex = i < enMatches.length - 1 ? enMatches[i + 1].index : line.length;
            const eventData = line.substring(startIndex, endIndex).trim();
            if (eventData) {
              eventLines.push(eventData);
            }
          }
        }
        
        eventLines.forEach((line, lineIndex) => {
          const params = EventParser.extractEventParamsFromData(line, source);
          const { relatedScroll, relatedClick } = findRelatedTriggersFn(eventTimestamp, params.eventName, networkUrl, postData, clickEvents);
          const triggerAction = generateTriggerActionFn(relatedScroll, relatedClick);
          
          // Check if any parameter has a value
          const hasAnyValue = Object.values(params).some(value => value && value.trim() !== '');
          
          if (hasAnyValue) {
            events.push({
              line: lineIndex + 1,
              ...params,
              triggerAction,
              rawData: line,
              source,
              scrollPercentage: relatedScroll ? relatedScroll.percentage : null,
              clickElement: relatedClick ? relatedClick.element : null
            });
          }
        });
      }
    } catch (e) {
      console.log('⚠️  Error parsing data:', e.message);
    }
    
    return events;
  }

  // Helper function to extract events from network data (POST or URL)
  static extractEventsFromNetworkData(networkEvent, parseEventsFromDataFn) {
    let extractedEvents = [];
    
    if (networkEvent.postData) {
      extractedEvents = parseEventsFromDataFn(networkEvent.postData, networkEvent.timestamp, 'POST', networkEvent.url, networkEvent.postData);
    }
    
    if (extractedEvents.length === 0 && CONFIG.GLOBAL.ga4Urls.some(ga4Url => networkEvent.url.includes(ga4Url))) {
      extractedEvents = parseEventsFromDataFn(networkEvent.url, networkEvent.timestamp, 'URL', networkEvent.url, networkEvent.postData || '');
    }
    
    return extractedEvents;
  }
}

module.exports = EventParser;
