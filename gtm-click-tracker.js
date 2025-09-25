/**
 * Google Analytics 4 (GA4) Click Event Tracker
 * 
 * This script automates clicking on all clickable elements on a webpage and tracks
 * which clicks trigger Google Analytics 4 events. It generates a comprehensive HTML
 * report showing which elements triggered GA4 events and which didn't.
 * 
 * Key Features:
 * - Automatically clicks all clickable elements (links, buttons, etc.)
 * - Tracks network requests to GA4 endpoints
 * - Matches network events to specific clicks using timing analysis
 * - Generates detailed HTML reports with two-column layout
 * - Handles cookie consent banners (OneTrust)
 * - Opens links in new tabs to prevent navigation
 * - Deduplicates network events to prevent false matches
 * 
 * Usage:
 *   node gtm-click-tracker.js <url> [--headless] [--click-pause=8000]
 * 
 * Example:
 *   node gtm-click-tracker.js https://www.example.com --headless
 * 
 * @author AI Assistant
 * @version 2.0
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// Configuration constants
const CONFIG = {
  // Timing configuration
  EVENT_DELAY: 8000,        // Interval between actions
  CLICK_TIMEOUT: 5000,  
  SCROLL_TIMEOUT: 1000,       // Timeout for click operations
  PAGE_LOAD_TIMEOUT: 10000,    // Timeout for page load operations
  WAIT_AFTER_CLICK: 100,       // Wait time after clicking before polling
  NETWORK_WAIT: 1000,          // Wait time for network events
  MIN_EVENT_DELAY: 0,         // Minimum delay before considering an event as triggered by a click
  
  // Browser configuration
  VIEWPORT: { width: 1280, height: 720 },
  USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  
  // Display configuration
  URL_PREVIEW_LENGTH: 80,
  MAX_PAYLOAD_HEIGHT: 200,
  STAT_CARD_MIN_WIDTH: 200,
  
  // Selectors
  SELECTORS: {
    CLICKABLE: 'a, button, input[type="submit"], input[type="button"], [role="button"], [onclick], .btn, .button',
    ONETRUST: '#onetrust-accept-btn-handler',
  },
  
  // Elements to exclude from clicking
  EXCLUDE_SELECTORS_FROM_CLICK: [
    '[data-gtm-destination="Exit Modal"]',
    '.exit-link',
    '#ot-sdk-btn',
    '.ot-link-btn',
    '#onetrust-accept-btn-handler',
    '#onetrust-reject-all-handler',
    '.onetrust-close-btn-handler',
    '.onetrust-accept-btn-handler',
    '.ot-floating-button__open',
    '.ot-floating-button__close',
    '.ot-fltr-btns button',
    '.ot-pc-footer-logo a',
    '#ot-pc-content button',
    '#ot-pc-content a',
    '#ot-pc-desc a',
    '#ot-pc-desc button',
  ],
  
  // Network filtering
  NETWORK_FILTERS: {
    GA4_URL: ['https://www.google-analytics.com/g/collect', 'https://analytics.google.com/g/collect'],
    EXCLUDE_KEYWORDS_FROM_CLICK: ['timer', 'pageview', 'page_view', 'scroll'],
    SCROLL_EVENT_KEYWORDS: ['scroll', 'scroll_depth', 'scroll_percentage']
  },
  
  // Event parameter mapping (camelCase keys to various possible parameter names)
  EVENT_PARAMS: {
    'eventName': ['en'],
    'eventCategory': ['ep.event_category', 'ep.Event_Category', 'event_category', 'Event_Category'],
    'eventAction': ['ep.event_action', 'ep.Event_Action', 'event_action', 'Event_Action'],
    'eventLocation': ['ep.event_location', 'ep.Event_Location', 'event_location', 'Event_Location'],
    'eventLabel': ['ep.event_label', 'ep.Event_Label', 'event_label', 'Event_Label'],
    "linkClasses": ['ep.link_classes', 'ep.Link_Classes', 'link_classes', 'Link_Classes'],
    "linkURL": ['ep.link_url', 'ep.Link_URL', 'link_url', 'Link_URL'],
    "linkDomain": ['ep.link_domain', 'ep.Link_Domain', 'link_domain', 'Link_Domain'],
    "outbound": ['ep.outbound', 'ep.Outbound', 'outbound', 'Outbound']
  }
};

class NetworkTracker {
  constructor(options = {}) {
    this.options = {
      url: options.url || 'https://example.com',
      headless: options.headless !== false,
      timeout: options.timeout || 30000,
      clickPause: options.clickPause || CONFIG.EVENT_DELAY,
      ...options
    };
    
    this.excludeSelectors = options.excludeSelectors || CONFIG.EXCLUDE_SELECTORS_FROM_CLICK;
    this.networkEvents = [];
    this.scrollEvents = [];
    this.clickEvents = [];
    this.matchedNetworkEventKeys = new Set(); // Track which network events have been matched to clicks
    this.browser = null;
    this.page = null;
  }

  // Helper function to extract event parameters from POST data
  extractEventParams(postData) {
    const result = {};
    
    if (postData) {
      try {
        const postParams = new URLSearchParams(postData);
        // Dynamically extract all configured parameters
        Object.entries(CONFIG.EVENT_PARAMS).forEach(([key, paramKeys]) => {
          result[key] = this.getParamFirstMatch(postParams, paramKeys);
        });
      } catch (e) {
        console.log('⚠️  Error parsing POST data:', e.message);
      }
    }
    
    return result;
  }

  // Helper function to check if event is a scroll event
  isScrollEvent(event) {
    const eventName = event.eventName?.toLowerCase() || '';
    const rawData = event.rawData?.toLowerCase() || '';
    
    return CONFIG.NETWORK_FILTERS.SCROLL_EVENT_KEYWORDS.some(keyword => 
      eventName.includes(keyword) || rawData.includes(keyword)
    );
  }

  // Helper function to check if event is a pageview
  isPageviewEvent(event) {
    return event.eventName === 'page_view' || 
           event.eventName === 'pageview' ||
           event.eventName === 'page view' ||
           event.rawData?.toLowerCase().includes('page_view') ||
           event.rawData?.toLowerCase().includes('pageview') ||
           event.rawData?.toLowerCase().includes('page view');
  }

  // Helper function to check if event should be excluded from click matching
  shouldExcludeFromClickMatch(networkUrl, postData = '') {
    // Check if event name includes "scroll"
    if (postData) {
      try {
        const postParams = new URLSearchParams(postData);
        const eventName = postParams.get('en') || '';
        if (eventName.toLowerCase().includes('scroll')) {
          return true;
        }
      } catch (e) {
        // If parsing fails, fall back to URL check
      }
    }
    
    // Fall back to URL keyword check
    return CONFIG.NETWORK_FILTERS.EXCLUDE_KEYWORDS_FROM_CLICK.some(keyword => 
      networkUrl.toLowerCase().includes(keyword)
    );
  }

  // Helper function to find related trigger events
  findRelatedTriggers(eventTimestamp, eventName = '', networkUrl = '', postData = '') {
    // For click matching, we now use the direct matching approach
    // where each click event has its own matchedNetworkEvents array
    const relatedClick = (!this.shouldExcludeFromClickMatch(networkUrl, postData)) ? this.clickEvents.find(click => {
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
    }) : null;
    
    return { relatedScroll: null, relatedClick };
  }

  // Helper function to generate trigger action string
  generateTriggerAction(relatedScroll, relatedClick) {
    if (relatedClick) {
      return `click (${relatedClick.element.tagName}: "${relatedClick.element.textContent}" - ${relatedClick.element.selector})`;
    }
    return '';
  }

  // Helper function to get first matching parameter value
  getParamFirstMatch(params, paramKeys) {
    for (const key of paramKeys) {
      const value = params.get(key);
      if (value !== null && value !== undefined) return value;
    }
    return '';
  }

  // Helper function to extract event parameters from URL or POST data
  extractEventParamsFromData(data, source = 'POST') {
    const params = new URLSearchParams(data);
    const result = {};
  
    
    // Dynamically extract all configured parameters
    Object.entries(CONFIG.EVENT_PARAMS).forEach(([key, paramKeys]) => {
      result[key] = this.getParamFirstMatch(params, paramKeys);
    });
    
    return result;
  }

  // Helper function to parse events from data
  parseEventsFromData(data, eventTimestamp, source = 'POST', networkUrl = '', postData = '') {
    const events = [];
    
    try {
      // First, split by spaces to get potential event segments
      let eventSegments = data.split(' ').filter(segment => segment.trim());
      
      // If we have multiple segments and they all contain 'en=', treat them as separate events
      if (eventSegments.length > 1 && eventSegments.every(segment => segment.includes('en='))) {
        // Each segment is a separate event
        eventSegments.forEach((segment, segmentIndex) => {
          const params = this.extractEventParamsFromData(segment, source);
          const { relatedScroll, relatedClick } = this.findRelatedTriggers(eventTimestamp, params.eventName, networkUrl, postData);
          const triggerAction = this.generateTriggerAction(relatedScroll, relatedClick);
          
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
          const params = this.extractEventParamsFromData(line, source);
          const { relatedScroll, relatedClick } = this.findRelatedTriggers(eventTimestamp, params.eventName, networkUrl, postData);
          const triggerAction = this.generateTriggerAction(relatedScroll, relatedClick);
          
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

  // Helper function to filter events by type
  filterEventsByType(events, type) {
    switch (type) {
      case 'scroll':
        return events.filter(evt => this.isScrollEvent(evt));
      case 'click':
        return events.filter(evt => 
          evt.triggerAction?.includes('click') && 
          !this.isPageviewEvent(evt) &&
          !this.isScrollEvent(evt)
        );
      case 'pageview':
        return events.filter(evt => this.isPageviewEvent(evt));
      case 'unmatched':
        // For unmatched events, we need to exclude events that were directly matched to clicks
        const directlyMatchedNetworkEvents = new Set();
        this.clickEvents.filter(click => click.success === true).forEach(click => {
          if (click.matchedNetworkEvents) {
            click.matchedNetworkEvents.forEach(networkEvent => {
              directlyMatchedNetworkEvents.add(`${networkEvent.timestamp}-${networkEvent.url}`);
            });
          }
        });
        
        return events.filter(evt => {
          const eventKey = `${evt.timestamp}-${evt.url}`;
          return !evt.triggerAction?.includes('click') && 
                 !this.isPageviewEvent(evt) &&
                 !this.isScrollEvent(evt) &&
                 !directlyMatchedNetworkEvents.has(eventKey);
        });
      default:
        return events;
    }
  }

  // Helper function to generate event HTML
  generateEventHTML(event, extractedEvents, isScrollSection = false) {
    if (extractedEvents.length === 0) return '';
    
    const firstEvent = extractedEvents[0];
    
    const triggerBadge = firstEvent.triggerAction?.includes('click')
      ? `<span style="background: #4caf50; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.8em; margin-right: 8px;">click</span>`
      : '';
    
    const elementInfo = firstEvent.clickElement 
      ? `<span style="background: #e3f2fd; color: #1976d2; padding: 4px 8px; border-radius: 4px; font-size: 0.7em; margin-right: 8px; font-family: monospace;">${firstEvent.clickElement.selector}${firstEvent.clickElement.id ? ` (ID: ${firstEvent.clickElement.id})` : ''}${firstEvent.clickElement.className ? ` (Classes: ${firstEvent.clickElement.className})` : ''}${firstEvent.clickElement.textContent ? ` (Text: "${firstEvent.clickElement.textContent}")` : ''}</span>`
      : '';
    
    const eventDetails = extractedEvents.map(evt => {
      // Dynamically generate parameter HTML based on CONFIG.EVENT_PARAMS
      const parameterHtml = Object.entries(CONFIG.EVENT_PARAMS).map(([paramKey, paramNames]) => {
        const value = evt[paramKey];
        if (value !== undefined && value !== null && value !== '') {
          const displayName = paramKey.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
          return `<div><strong>${displayName}:</strong> ${value}</div>`;
        }
        return '';
      }).join('');
      
      return `
        <div style="margin: 10px 0; padding: 10px; background: #f0f8ff; border-radius: 5px; border-left: 3px solid #2196f3;">
          <strong>Event ${evt.line} (${evt.source || 'POST'}):</strong><br>
          ${parameterHtml}
          ${evt.triggerAction ? `<div><strong>trigger_action:</strong> ${evt.triggerAction}</div>` : ''}
        </div>
      `;
    }).join('');
    
    return `
      <div class="event-item request-item" data-url="${event.url}" data-type="${event.type}" data-method="${event.method || ''}">
        <div class="event-header">
          <span class="event-type request-type">REQUEST</span>
          ${triggerBadge}
          ${firstEvent.eventName ? `<span class="event-name">${firstEvent.eventName}</span>` : ''}
          ${elementInfo}
          <span class="event-time">${new Date(event.timestamp).toLocaleTimeString()}</span>
        </div>
        <div class="url">
          <div class="accordion-header" onclick="toggleAccordion(this)">
            <span class="accordion-icon">▶</span>
            <span class="url-preview">${event.url.length > CONFIG.URL_PREVIEW_LENGTH ? event.url.substring(0, CONFIG.URL_PREVIEW_LENGTH) + '...' : event.url}</span>
          </div>
          <div class="accordion-content" style="display: none;">
            <div class="full-url">${event.url}</div>
          </div>
        </div>
        ${event.postData ? `
          <div class="payload">
            <div class="payload-title">Request Payload:</div>
            ${event.postData}
          </div>
        ` : ''}
        <div class="details">
          ${event.method ? `<span class="method">${event.method}</span>` : ''}
          ${event.status ? `<span class="status">${event.status}</span>` : ''}
          ${extractedEvents.length > 0 ? `
            <br><strong>Extracted Events (${extractedEvents.length}):</strong>
            ${eventDetails}
          ` : ''}
          ${!event.postData && CONFIG.NETWORK_FILTERS.GA4_URL.some(ga4Url => event.url.includes(ga4Url)) && extractedEvents.length === 0 ? `
            <br><strong>URL Parameters:</strong> ${event.url}
          ` : ''}
          ${event.requestUrl && event.requestUrl !== event.url ? `<br>Request URL: ${event.requestUrl}` : ''}
        </div>
      </div>
    `;
  }

  // Helper function to generate events section HTML with direct click matching
  generateEventsSectionHTMLWithDirectMatching(eventType, title, icon) {
    if (eventType === 'click') {
      // For click events, we need to find network events that were directly matched to clicks
      const clickTriggeredEvents = [];
      
      this.clickEvents.filter(click => click.success === true).forEach(click => {
        if (click.matchedNetworkEvents && click.matchedNetworkEvents.length > 0) {
          click.matchedNetworkEvents.forEach(networkEvent => {
            if (networkEvent.type === 'request') {
              let extractedEvents = [];
              if (networkEvent.postData) {
                extractedEvents = this.parseEventsFromData(networkEvent.postData, networkEvent.timestamp, 'POST', networkEvent.url, networkEvent.postData);
              }
              if (extractedEvents.length === 0 && networkEvent.url.includes(CONFIG.NETWORK_FILTERS.GA4_URL)) {
                extractedEvents = this.parseEventsFromData(networkEvent.url, networkEvent.timestamp, 'URL', networkEvent.url, networkEvent.postData || '');
              }
              
              // Filter out pageview events
              const nonPageviewEvents = extractedEvents.filter(evt => !this.isPageviewEvent(evt));
              
              if (nonPageviewEvents.length > 0) {
                clickTriggeredEvents.push({
                  networkEvent,
                  extractedEvents: nonPageviewEvents,
                  clickElement: click.element
                });
              }
            }
          });
        }
      });
      
      return `
        <div class="subsection">
          <h3>${icon} ${title}</h3>
          <div id="${eventType}EventsContainer">
            ${clickTriggeredEvents.map((item, idx) => {
              const event = item.networkEvent;
              const extractedEvents = item.extractedEvents;
              const clickElement = item.clickElement;
              
              const triggerBadge = `<span style="background: #4caf50; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.8em; margin-right: 8px;">click</span>`;
              
              const elementInfo = `<span style="background: #e3f2fd; color: #1976d2; padding: 4px 8px; border-radius: 4px; font-size: 0.7em; margin-right: 8px; font-family: monospace;">${clickElement.selector}${clickElement.id ? ` (ID: ${clickElement.id})` : ''}${clickElement.className ? ` (Classes: ${clickElement.className})` : ''}${clickElement.textContent ? ` (Text: "${clickElement.textContent}")` : ''}</span>`;
              
              const eventDetails = extractedEvents.map(evt => {
                // Dynamically generate parameter HTML based on CONFIG.EVENT_PARAMS
                const parameterHtml = Object.entries(CONFIG.EVENT_PARAMS).map(([paramKey, paramNames]) => {
                  const value = evt[paramKey];
                  if (value !== undefined && value !== null && value !== '') {
                    const displayName = paramKey.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                    return `<div><strong>${displayName}:</strong> ${value}</div>`;
                  }
                  return '';
                }).join('');
                
                return `
                  <div style="margin: 10px 0; padding: 10px; background: #f0f8ff; border-radius: 5px; border-left: 3px solid #2196f3;">
                    <strong>Event ${evt.line} (${evt.source || 'POST'}):</strong><br>
                    ${parameterHtml}
                    <div><strong>triggered_by:</strong> click on ${clickElement.tagName} - "${clickElement.textContent}"</div>
                  </div>
                `;
              }).join('');
              
              return `
                <div class="event-item request-item" data-url="${event.url}" data-type="${event.type}" data-method="${event.method || ''}">
                  <div class="event-header">
                    <span class="event-type request-type">REQUEST</span>
                    ${triggerBadge}
                    ${extractedEvents[0]?.eventName ? `<span class="event-name">${extractedEvents[0].eventName}</span>` : ''}
                    ${elementInfo}
                    <span class="event-time">${new Date(event.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <div class="url">
                    <div class="accordion-header" onclick="toggleAccordion(this)">
                      <span class="accordion-icon">▶</span>
                      <span class="url-preview">${event.url.length > CONFIG.URL_PREVIEW_LENGTH ? event.url.substring(0, CONFIG.URL_PREVIEW_LENGTH) + '...' : event.url}</span>
                    </div>
                    <div class="accordion-content" style="display: none;">
                      <div class="full-url">${event.url}</div>
                    </div>
                  </div>
                  ${event.postData ? `
                    <div class="payload">
                      <div class="payload-title">Request Payload:</div>
                      ${event.postData}
                    </div>
                  ` : ''}
                  <div class="details">
                    ${event.method ? `<span class="method">${event.method}</span>` : ''}
                    ${event.status ? `<span class="status">${event.status}</span>` : ''}
                    ${extractedEvents.length > 0 ? `
                      <br><strong>Extracted Events (${extractedEvents.length}):</strong>
                      ${eventDetails}
                    ` : ''}
                    ${!event.postData && CONFIG.NETWORK_FILTERS.GA4_URL.some(ga4Url => event.url.includes(ga4Url)) && extractedEvents.length === 0 ? `
                      <br><strong>URL Parameters:</strong> ${event.url}
                    ` : ''}
                    ${event.requestUrl && event.requestUrl !== event.url ? `<br>Request URL: ${event.requestUrl}` : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    } else {
      // For other event types, use the original method
      return this.generateEventsSectionHTML(eventType, title, icon);
    }
  }

  // Helper function to generate events section HTML
  generateEventsSectionHTML(eventType, title, icon) {
    return `
      <div class="subsection">
        <h3>${icon} ${title}</h3>
        <div id="${eventType}EventsContainer">
          ${this.networkEvents.filter(event => event.type === 'request').map((event, idx) => {
            let extractedEvents = [];
            
            if (event.postData) {
              extractedEvents = this.parseEventsFromData(event.postData, event.timestamp, 'POST', event.url, event.postData);
            }
            
            if (extractedEvents.length === 0 && CONFIG.NETWORK_FILTERS.GA4_URL.some(ga4Url => event.url.includes(ga4Url))) {
              extractedEvents = this.parseEventsFromData(event.url, event.timestamp, 'URL', event.url, event.postData || '');
            }
            
            const filteredEvents = this.filterEventsByType(extractedEvents, eventType);
            return filteredEvents.length > 0 ? this.generateEventHTML(event, filteredEvents, eventType) : '';
          }).join('')}
        </div>
      </div>
    `;
  }

  // Helper function to get element info
  async getElementInfo(element) {
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
  async handleLinkClick(element, elementInfo) {
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
    await this.page.waitForTimeout(CONFIG.WAIT_AFTER_CLICK);
    
    // Check if a new page was opened by looking at all pages
    const pages = this.page.context().pages();
    const newPage = pages.find(page => page !== this.page);
    
    if (newPage) {
      console.log(`📄 New tab opened, closing it and returning to original page`);
      await newPage.close();
    }
    
    // Ensure we're back on the original page
    await this.page.bringToFront();
  }

  // Helper function to wait for network events after a click
  async waitForNetworkEvents(clickStartTime, elementInfo) {
    console.log(`⏳ Waiting ${CONFIG.EVENT_DELAY/1000}s for network events after clicking "${elementInfo.textContent}"...`);
    
    // Wait the full event delay time
    await this.page.waitForTimeout(CONFIG.EVENT_DELAY);
    
    // Find all network events that occurred within the time window
    const newNetworkEvents = this.networkEvents.filter(networkEvent => {
      const timeAfterClick = networkEvent.timestamp - clickStartTime;
      const eventKey = `${networkEvent.timestamp}-${networkEvent.url}`;
      
      // Only include events that:
      // 1. Occurred after the click (positive timeAfterClick)
      // 2. Are within our time window
      // 3. Haven't been matched to any previous click
      return timeAfterClick >= CONFIG.MIN_EVENT_DELAY && 
             timeAfterClick <= CONFIG.EVENT_DELAY &&
             !this.matchedNetworkEventKeys.has(eventKey);
    });
    
    // Mark these events as matched to prevent them from being matched to future clicks
    newNetworkEvents.forEach(event => {
      const eventKey = `${event.timestamp}-${event.url}`;
      this.matchedNetworkEventKeys.add(eventKey);
    });
    
    // Log details of found network events
    if (newNetworkEvents.length > 0) {
      console.log(`📡 Found ${newNetworkEvents.length} network events within ${CONFIG.MIN_EVENT_DELAY/1000}-${CONFIG.EVENT_DELAY/1000}s window after clicking "${elementInfo.textContent}"`);
      
      // Count GA4 vs other events
      const ga4Events = newNetworkEvents.filter(event => 
        CONFIG.NETWORK_FILTERS.GA4_URL.some(ga4Url => event.url.includes(ga4Url))
      );
      const otherEvents = newNetworkEvents.length - ga4Events.length;
      
      console.log(`  🔵 GA4 events: ${ga4Events.length}`);
      console.log(`  📡 Other events: ${otherEvents.length}`);
      
      newNetworkEvents.forEach((event, eventIdx) => {
        if (event.type === 'request') {
          let extractedEvents = [];
          if (event.postData) {
            extractedEvents = this.parseEventsFromData(event.postData, event.timestamp, 'POST', event.url, event.postData);
          }
          if (extractedEvents.length === 0 && CONFIG.NETWORK_FILTERS.GA4_URL.some(ga4Url => event.url.includes(ga4Url))) {
            extractedEvents = this.parseEventsFromData(event.url, event.timestamp, 'URL', event.url, event.postData || '');
          }
          
          if (extractedEvents.length > 0) {
            extractedEvents.forEach(evt => {
              const timeAfterClick = event.timestamp - clickStartTime;
              console.log(`    🔵 GA4 Event: ${evt.eventName} - ${evt.eventAction} - ${evt.eventLabel} (${timeAfterClick}ms after click)`);
            });
          } else if (CONFIG.NETWORK_FILTERS.GA4_URL.some(ga4Url => event.url.includes(ga4Url))) {
            const timeAfterClick = event.timestamp - clickStartTime;
            console.log(`    🔵 GA4 Request: ${event.url} (${timeAfterClick}ms after click)`);
          } else {
            const timeAfterClick = event.timestamp - clickStartTime;
            console.log(`    📡 Other Request: ${event.method} ${event.url} (${timeAfterClick}ms after click)`);
          }
        }
      });
    } else {
      console.log(`📡 No new network events found within ${CONFIG.MIN_EVENT_DELAY/1000}-${CONFIG.EVENT_DELAY/1000}s window after clicking "${elementInfo.textContent}"`);
    }
    
    return newNetworkEvents;
  }

  // Helper function to record failed click
  async recordFailedClick(element, clickError, i) {
    console.log(`⚠️ Failed to click element ${i + 1}: ${clickError.message}`);
    
    try {
      const elementInfo = await this.getElementInfo(element);
      
      const clickTimestamp = new Date().getTime();
      this.clickEvents.push({
        timestamp: clickTimestamp,
        element: elementInfo,
        action: 'click',
        success: false,
        error: clickError.message,
        networkEventsBefore: this.networkEvents.length,
        networkEventsAfter: this.networkEvents.length,
        matchedNetworkEvents: []
      });
    } catch (evaluateError) {
      // If we can't even evaluate the element, record a basic failed click
      const clickTimestamp = new Date().getTime();
      this.clickEvents.push({
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
        networkEventsBefore: this.networkEvents.length,
        networkEventsAfter: this.networkEvents.length,
        matchedNetworkEvents: []
      });
    }
  }

  async init() {
    this.browser = await chromium.launch({ 
      headless: this.options.headless
    });
    
    // Create an incognito context with a realistic user agent
    const context = await this.browser.newContext({
      viewport: CONFIG.VIEWPORT,
      userAgent: CONFIG.USER_AGENT
    });
    
    this.page = await context.newPage();

    // Clear cookies before navigation
    await context.clearCookies();

    // Set up network event interception
    this.page.on('request', request => {
      const url = request.url();
      // Only record GA4 collect requests
      if (CONFIG.NETWORK_FILTERS.GA4_URL.some(ga4Url => url.includes(ga4Url))) {
        const timestamp = new Date().getTime();
        const extractedParams = this.extractEventParams(request.postData());
        
        // Check if we've already recorded this exact request
        // We need to be more careful about duplicates to avoid missing multiple events in the same request
        // const isDuplicate = this.networkEvents.some(event => 
        //   event.url === request.url() && 
        //   event.postData === request.postData() &&
        //   Math.abs(event.timestamp - timestamp) < 100 // Within 100ms (more precise)
        // );
        
        // if (!isDuplicate) {
          console.log(`📡 Recording network request: ${request.url()} at ${new Date(timestamp).toLocaleTimeString()}`);
          this.networkEvents.push({
            type: 'request',
            timestamp,
            url: request.url(),
            method: request.method(),
            headers: request.headers(),
            postData: request.postData(),
            ...extractedParams
          });
        // } else {
        //   console.log(`⚠️ Skipping duplicate network request: ${request.url()}`);
        // }
      }
    });

    // Remove response event recording since we only need requests
    // this.page.on('response', async response => { ... });
  }

  async dismissPantheon() {
    const dismissBtn = await this.page.$(".pds-button");
    if (dismissBtn) {
      await dismissBtn.click();
      console.log('✅ Clicked Pantheon dismiss button');
      await this.page.waitForTimeout(CONFIG.NETWORK_WAIT);
    }
  }

  async handleOneTrust() {
    try {
      console.log('🍪 Looking for OneTrust cookie consent...');
      
      const acceptBtn = await this.page.$(CONFIG.SELECTORS.ONETRUST);
      if (acceptBtn) {
        await acceptBtn.click();
        console.log('✅ Clicked OneTrust I Agree button');
        await this.page.waitForTimeout(CONFIG.NETWORK_WAIT);
        return true;
      }
      
      console.log('ℹ️  No OneTrust cookie consent banner found');
      return false;
    } catch (error) {
      console.log('⚠️  Error handling cookie consent:', error.message);
      return false;
    }
  }

  async clickElements() {
    console.log('🖱️ Starting click events...');
    
    try {
      // Get all clickable elements with more comprehensive selectors
      const clickableElements = await this.page.$$(CONFIG.SELECTORS.CLICKABLE);
      
      console.log(`🖱️ Found ${clickableElements.length} clickable elements`);
      
      // Track network events before we start clicking
      const initialNetworkCount = this.networkEvents.length;
      
      for (let i = 0; i < clickableElements.length; i++) {
        try {
          const element = clickableElements[i];

          // Get element info before clicking
          const elementInfo = await this.getElementInfo(element);
          
          // Check if element should be avoided using exclude selectors
          let shouldSkip = false;
          for (const selector of this.excludeSelectors) {
            const matches = await element.evaluate((el, sel) => {
              // Use CSS selector matching to check if element matches the selector
              try {
                // Check if this element matches the selector
                return el.matches(sel);
              } catch (e) {
                // If selector is invalid, return false
                return false;
              }
            }, selector);
            
            if (matches) {
              console.log(`🚫 Skipping element: ${elementInfo.tagName} - "${elementInfo.textContent}" (matches: ${selector})`);
              shouldSkip = true;
              break;
            }
          }
          
          if (shouldSkip) {
            continue;
          }
          
          console.log(`🖱️ Clicking element ${i + 1}/${clickableElements.length}: ${elementInfo.tagName} - "${elementInfo.textContent}"`);
          
          // Record the current network event count and timestamp before clicking
          const networkEventsBeforeClick = this.networkEvents.length;
          const clickStartTime = new Date().getTime();
          
          // Record click event BEFORE clicking
          const clickTimestamp = new Date().getTime();
          this.clickEvents.push({
            timestamp: clickTimestamp,
            element: elementInfo,
            action: 'click',
            success: true,
            error: null,
            networkEventsBefore: networkEventsBeforeClick,
            networkEventsAfter: null,
            matchedNetworkEvents: []
          });
          
          // Do regular click for all elements (more reliable)
          console.log(`📝 Clicking ${elementInfo.tagName} element: "${elementInfo.textContent}"`);
          
          // For links, ensure they open in new tab/window
          if (elementInfo.tagName === 'a' && elementInfo.href) {
            await this.handleLinkClick(element, elementInfo);
          } else {
            // For non-link elements, do regular click
            await element.click({ timeout: CONFIG.CLICK_TIMEOUT });
          }
          
          // Wait for network events within the time window
          const newNetworkEvents = await this.waitForNetworkEvents(clickStartTime, elementInfo);
          
          // Update the click event with network event info
          const currentClickEvent = this.clickEvents[this.clickEvents.length - 1];
          currentClickEvent.networkEventsAfter = this.networkEvents.length;
          currentClickEvent.matchedNetworkEvents = newNetworkEvents;
          
        } catch (clickError) {
          await this.recordFailedClick(clickableElements[i], clickError, i);
          
          // Continue with next element instead of crashing
          continue;
        }
      }
      
      console.log(`✅ Click events completed. Recorded ${this.clickEvents.length} clicks`);
      
    } catch (error) {
      console.log('⚠️ Error during click events:', error.message);
      // Don't re-throw - let the main run() method handle it
    }
  }

  async scrollPage() {
    console.log('📜 Starting page scroll...');
    
    // Get page height
    const pageHeight = await this.page.evaluate(() => document.body.scrollHeight);
    console.log(`📏 Page height: ${pageHeight}px`);
    
    // Scroll down in increments
    const viewportHeight = CONFIG.VIEWPORT.height;
    const scrollIncrement = viewportHeight / 2; // Scroll half viewport at a time
    
    for (let scrollY = 0; scrollY < pageHeight; scrollY += scrollIncrement) {
      // Record scroll event BEFORE scrolling
      const scrollStartTimestamp = new Date().getTime();
      const scrollPercentage = Math.round((scrollY / pageHeight) * 100);
      
      this.scrollEvents.push({
        timestamp: scrollStartTimestamp,
        scrollY: scrollY,
        percentage: scrollPercentage,
        action: 'scroll'
      });
      
      console.log(`📜 Scrolling to ${scrollY}px (${scrollPercentage}%)`);
      
      // Perform the scroll
      await this.page.evaluate((y) => {
        window.scrollTo(0, y);
      }, scrollY);
      
      // Wait a bit between scrolls to capture any lazy-loaded content
      await this.page.waitForTimeout(CONFIG.SCROLL_TIMEOUT);
    }
    
    // Scroll back to top
    const topScrollTimestamp = new Date().getTime();
    this.scrollEvents.push({
      timestamp: topScrollTimestamp,
      scrollY: 0,
      percentage: 0,
      action: 'scroll'
    });
    
    await this.page.evaluate(() => {
      window.scrollTo(0, 0);
    });
    
    console.log('✅ Page scroll completed');
    console.log(`📊 Recorded ${this.scrollEvents.length} scroll actions`);
  }

  async run() {
    try {
      console.log(`🌐 Opening incognito window for: ${this.options.url}`);
      await this.init();
      
      // Navigate to URL
      await this.page.goto(this.options.url, { 
        waitUntil: 'domcontentloaded',
        timeout: this.options.timeout 
      });
      
      console.log(`⏳ Waiting ${CONFIG.PAGE_LOAD_TIMEOUT}ms for page to load...`);
      await this.page.waitForTimeout(CONFIG.PAGE_LOAD_TIMEOUT);

      // Dismiss Pantheon
      await this.dismissPantheon();
      
      // Handle OneTrust
      await this.handleOneTrust();
      
      // Scroll the page
      // await this.scrollPage();

      // Wait longer between scroll and click to ensure all scroll events are captured
      console.log(`⏳ Waiting ${CONFIG.EVENT_DELAY/1000} seconds between scroll and click actions...`);
      await this.page.waitForTimeout(CONFIG.EVENT_DELAY);

      await this.clickElements();
      
      // Wait a bit more to capture any final network events
      await this.page.waitForTimeout(CONFIG.NETWORK_WAIT);
      
      // Log summary statistics
      console.log('\n📊 === CLICK MATCHING SUMMARY ===');
      const successfulClicks = this.clickEvents.filter(click => click.success === true);
      const failedClicks = this.clickEvents.filter(click => click.success === false);
      const totalNetworkEvents = this.networkEvents.filter(e => e.type === 'request').length;
      
      console.log(`Total clicks recorded: ${this.clickEvents.length}`);
      console.log(`Successful clicks: ${successfulClicks.length}`);
      console.log(`Failed clicks: ${failedClicks.length}`);
      console.log(`Total GA4 network events: ${totalNetworkEvents}`);
      
      // Count matched clicks using the new direct matching approach
      let matchedClicks = 0;
      successfulClicks.forEach(click => {
        if (click.matchedNetworkEvents && click.matchedNetworkEvents.length > 0) {
          matchedClicks++;
        }
      });
      
      console.log(`Clicks that triggered GA4 events: ${matchedClicks}`);
      console.log(`Successful clicks with no GA4 events: ${successfulClicks.length - matchedClicks}`);
      
      // Generate HTML report
      await this.generateHTMLReport();
      
    } catch (error) {
      console.error('❌ Error running tracker:', error);
      
      // Always try to generate a report even if there's an error
      try {
        console.log('\n📋 Generating report despite error...');
        await this.generateHTMLReport();
        console.log('✅ Report generated successfully despite error');
      } catch (reportError) {
        console.error('❌ Failed to generate report:', reportError);
      }
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }

  async generateCSVReport(testResultsDir, reportFilename) {
    console.log('\n📊 === GENERATING CSV REPORT ===');
    
    const csvRows = [];
    
    // Add CSV header - simplified columns
    csvRows.push([
      'Click Order',
      'Element Type',
      'Element Text',
      'Element Href',
      'Element Selector',
      'Click Time',
      'Status',
      'GA4 Event Count',
      'Primary GA4 Event Name',
      'Primary GA4 Event Category',
      'Primary GA4 Event Action',
      'Primary GA4 Event Label',
      'Time After Click (ms)',
      'Network URL'
    ]);
    
    // Add click events data
    this.clickEvents
      .filter(click => click.success === true)
      .sort((a, b) => a.timestamp - b.timestamp)
      .forEach((click, idx) => {
        const hasMatchingEvent = click.matchedNetworkEvents && click.matchedNetworkEvents.length > 0;
        
        // Get primary GA4 event data (first event)
        let primaryEventName = '';
        let primaryEventCategory = '';
        let primaryEventAction = '';
        let primaryEventLabel = '';
        let timeAfterClick = '';
        let networkURL = '';
        
        if (hasMatchingEvent && click.matchedNetworkEvents.length > 0) {
          const firstNetworkEvent = click.matchedNetworkEvents[0];
          let extractedEvents = [];
          
          if (firstNetworkEvent.postData) {
            extractedEvents = this.parseEventsFromData(firstNetworkEvent.postData, firstNetworkEvent.timestamp, 'POST', firstNetworkEvent.url, firstNetworkEvent.postData);
          }
          if (extractedEvents.length === 0 && CONFIG.NETWORK_FILTERS.GA4_URL.some(ga4Url => firstNetworkEvent.url.includes(ga4Url))) {
            extractedEvents = this.parseEventsFromData(firstNetworkEvent.url, firstNetworkEvent.timestamp, 'URL', firstNetworkEvent.url, firstNetworkEvent.postData || '');
          }
          
          if (extractedEvents.length > 0) {
            const firstEvent = extractedEvents[0];
            primaryEventName = firstEvent.eventName || '';
            primaryEventCategory = firstEvent.eventCategory || '';
            primaryEventAction = firstEvent.eventAction || '';
            primaryEventLabel = firstEvent.eventLabel || '';
            timeAfterClick = firstNetworkEvent.timestamp - click.timestamp;
            networkURL = firstNetworkEvent.url;
          }
        }
        
        // Clean and escape CSV values
        const cleanValue = (value) => {
          if (value === null || value === undefined) return '';
          const stringValue = String(value).trim();
          if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n') || stringValue.includes('\r')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        };
        
        csvRows.push([
          idx + 1, // Click Order
          cleanValue(click.element.tagName || ''), // Element Type
          cleanValue(click.element.textContent || ''), // Element Text
          cleanValue(click.element.href || ''), // Element Href
          cleanValue(click.element.selector || ''), // Element Selector
          new Date(click.timestamp).toLocaleTimeString(), // Click Time
          hasMatchingEvent ? 'TRIGGERED GA4' : 'NO GA4', // Status
          hasMatchingEvent ? click.matchedNetworkEvents.length : 0, // GA4 Event Count
          cleanValue(primaryEventName), // Primary GA4 Event Name
          cleanValue(primaryEventCategory), // Primary GA4 Event Category
          cleanValue(primaryEventAction), // Primary GA4 Event Action
          cleanValue(primaryEventLabel), // Primary GA4 Event Label
          timeAfterClick, // Time After Click (ms)
          cleanValue(networkURL) // Network URL
        ]);
      });
    
    // Write CSV file
    const csvContent = csvRows.map(row => row.join(',')).join('\n');
    const csvPath = path.join(testResultsDir, `${reportFilename}.csv`);
    fs.writeFileSync(csvPath, csvContent);
    console.log(`📊 CSV report saved to ${csvPath}`);
  }

  async generateJSONReport(testResultsDir, reportFilename) {
    console.log('\n📊 === GENERATING JSON REPORT FOR ARD ANALYSIS ===');
    
    // Extract all network events with their parsed event data
    const networkEventsForAnalysis = [];
    
    this.networkEvents.filter(event => event.type === 'request').forEach((event, idx) => {
      let extractedEvents = [];
      
      if (event.postData) {
        extractedEvents = this.parseEventsFromData(event.postData, event.timestamp, 'POST', event.url, event.postData);
      }
      
      if (extractedEvents.length === 0 && CONFIG.NETWORK_FILTERS.GA4_URL.some(ga4Url => event.url.includes(ga4Url))) {
        extractedEvents = this.parseEventsFromData(event.url, event.timestamp, 'URL', event.url, event.postData || '');
      }
      
      if (extractedEvents.length > 0) {
        extractedEvents.forEach(extractedEvent => {
          networkEventsForAnalysis.push({
            networkEventIndex: idx,
            timestamp: event.timestamp,
            url: event.url,
            method: event.method,
            postData: event.postData,
            eventName: extractedEvent.eventName,
            eventCategory: extractedEvent.eventCategory,
            eventAction: extractedEvent.eventAction,
            eventLabel: extractedEvent.eventLabel,
            eventLocation: extractedEvent.eventLocation,
            linkClasses: extractedEvent.linkClasses,
            linkURL: extractedEvent.linkURL,
            linkDomain: extractedEvent.linkDomain,
            outbound: extractedEvent.outbound,
            source: extractedEvent.source,
            rawData: extractedEvent.rawData,
            line: extractedEvent.line
          });
        });
      }
    });
    
    // Create the JSON report data
    const jsonReport = {
      metadata: {
        url: this.options.url,
        timestamp: new Date().toISOString(),
        totalNetworkEvents: this.networkEvents.length,
        totalExtractedEvents: networkEventsForAnalysis.length,
        totalClicks: this.clickEvents.length,
        successfulClicks: this.clickEvents.filter(click => click.success === true).length,
        failedClicks: this.clickEvents.filter(click => click.success === false).length
      },
      networkEvents: networkEventsForAnalysis,
      clickEvents: this.clickEvents.map(click => ({
        timestamp: click.timestamp,
        element: click.element,
        success: click.success,
        error: click.error,
        matchedNetworkEvents: click.matchedNetworkEvents ? click.matchedNetworkEvents.length : 0
      }))
    };
    
    // Write JSON file
    const jsonPath = path.join(testResultsDir, `${reportFilename}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(jsonReport, null, 2));
    console.log(`📊 JSON report saved to ${jsonPath}`);
    console.log(`📊 Total extracted events for ARD analysis: ${networkEventsForAnalysis.length}`);
  }

  async generateHTMLReport() {
    console.log('\n📋 === NETWORK EVENTS REPORT ===');
    
    // Filter and categorize events
    const requests = this.networkEvents.filter(e => e.type === 'request');
    // const responses = this.networkEvents.filter(e => e.type === 'response'); // No longer recording responses
    
    console.log(`Total network events: ${this.networkEvents.length}`);
    console.log(`Requests: ${requests.length}`);
    // console.log(`Responses: ${responses.length}`); // No longer recording responses
    
    // Generate filename
    const siteUrl = new URL(this.options.url).hostname.replace(/\./g, '-');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const reportFilename = `network-events-${siteUrl}-${timestamp}`;
    
    // Create test-results folder
    const testResultsDir = 'test-results';
    if (!fs.existsSync(testResultsDir)) {
      fs.mkdirSync(testResultsDir, { recursive: true });
    }
    
    // Generate CSV report
    await this.generateCSVReport(testResultsDir, reportFilename);

    // Generate JSON report for ARD analysis
    await this.generateJSONReport(testResultsDir, reportFilename);

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Auto GA Checker Report - ${this.options.url}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            background: #f8f9fa;
            padding: 20px;
        }
        .container { max-width: 1400px; margin: 0 auto; }
        .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white; 
            padding: 30px; 
            border-radius: 10px; 
            margin-bottom: 30px;
            text-align: center;
        }
        .header h1 { font-size: 2.5em; margin-bottom: 10px; }
        .header p { font-size: 1.1em; opacity: 0.9; }
        .stats { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(${CONFIG.STAT_CARD_MIN_WIDTH}px, 1fr)); 
            gap: 20px; 
            margin-bottom: 30px; 
        }
        .stat-card { 
            background: white; 
            padding: 20px; 
            border-radius: 10px; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            text-align: center;
        }
        .stat-number { 
            font-size: 2.5em; 
            font-weight: bold; 
            color: #667eea; 
            margin-bottom: 5px; 
        }
        .stat-label { 
            color: #666; 
            font-size: 0.9em; 
            text-transform: uppercase; 
            letter-spacing: 1px; 
        }
        .section { 
            background: white; 
            padding: 25px; 
            border-radius: 10px; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            margin-bottom: 25px; 
        }
        .section h2 { 
            color: #333; 
            margin-bottom: 20px; 
            font-size: 1.5em; 
            border-bottom: 2px solid #667eea; 
            padding-bottom: 10px; 
        }
        .event-item { 
            background: #f8f9fa; 
            padding: 15px; 
            border-radius: 8px; 
            margin-bottom: 15px; 
            border-left: 4px solid #667eea; 
        }
        .request-item { border-left-color: #2196f3; }
        .event-header { 
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            margin-bottom: 10px; 
        }
        .event-type { 
            background: #667eea; 
            color: white; 
            padding: 4px 12px; 
            border-radius: 20px; 
            font-size: 0.8em; 
            font-weight: bold; 
        }
        .request-type { background: #2196f3; }
        .event-name {
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.9em;
            font-weight: bold;
            margin-right: 8px;
        }
        .event-action {
            background: linear-gradient(135deg, #10b981, #059669);
            color: white;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.9em;
            font-weight: bold;
            margin-right: 8px;
        }
        .event-location {
            background: linear-gradient(135deg, #f59e0b, #d97706);
            color: white;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.9em;
            font-weight: bold;
            margin-right: 8px;
        }
        .event-time { 
            color: #666; 
            font-size: 0.9em; 
        }
        .url { 
            font-family: monospace; 
            background: #f1f3f4; 
            padding: 8px; 
            border-radius: 4px; 
            margin: 10px 0; 
            word-break: break-all; 
        }
        .method { 
            background: #e3f2fd; 
            color: #1976d2; 
            padding: 2px 8px; 
            border-radius: 4px; 
            font-size: 0.8em; 
            font-weight: bold; 
        }
        .status { 
            background: #e8f5e8; 
            color: #2e7d32; 
            padding: 2px 8px; 
            border-radius: 4px; 
            font-size: 0.8em; 
            font-weight: bold; 
        }
        .details { 
            margin-top: 10px; 
            font-size: 0.9em; 
            color: #666; 
        }
        .payload {
            background: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 4px;
            padding: 10px;
            margin-top: 10px;
            font-family: monospace;
            font-size: 0.8em;
            white-space: pre-wrap;
            word-break: break-all;
            max-height: ${CONFIG.MAX_PAYLOAD_HEIGHT}px;
            overflow-y: auto;
        }
        .payload-title {
            font-weight: bold;
            color: #495057;
            margin-bottom: 5px;
        }
        .accordion-header {
            cursor: pointer;
            padding: 10px 15px;
            background-color: #f0f0f0;
            border-radius: 5px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-weight: bold;
            color: #333;
        }
        .accordion-icon {
            transition: transform 0.3s ease;
        }
        .accordion-header.active .accordion-icon {
            transform: rotate(90deg);
        }
        .full-url {
            padding: 10px;
            background-color: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 4px;
            font-size: 0.9em;
            color: #555;
            margin-top: 5px;
            font-family: monospace;
            word-break: break-all;
        }
        .subsection {
            margin-bottom: 30px;
        }
        .subsection h3 {
            color: #333;
            margin-bottom: 15px;
            font-size: 1.3em;
            border-bottom: 2px solid #667eea;
            padding-bottom: 8px;
        }
        .unmatched-click {
            background-color: #fff3cd;
            border-left: 4px solid #ffc107;
        }
        .click-details-container {
            display: flex;
            gap: 20px;
            margin-top: 15px;
        }
        .click-basic-info {
            flex: 1;
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            border: 1px solid #e9ecef;
        }
        .click-detailed-info {
            flex: 1;
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            border: 1px solid #e9ecef;
        }
        .click-info-section {
            margin-bottom: 10px;
        }
        .click-info-section:last-child {
            margin-bottom: 0;
        }
        .click-info-label {
            font-weight: bold;
            color: #495057;
            margin-bottom: 5px;
        }
        .click-info-value {
            color: #333;
            font-family: monospace;
            background: white;
            padding: 4px 8px;
            border-radius: 4px;
            border: 1px solid #dee2e6;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🌐 Auto GA Checker Report</h1>
            <h2><a href="${this.options.url}" target="_blank" style="color: #fff; text-decoration: underline;">${this.options.url}</a></h2>
        </div>
        
        <div class="stats">
            <div class="stat-card">
                <div class="stat-number">${requests.length}</div>
                <div class="stat-label">Total Requests</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${new Set(requests.map(e => e.url)).size}</div>
                <div class="stat-label">Unique URLs</div>
            </div>
        </div>

        <div class="section">
            
            ${this.generateEventsSectionHTML('pageview', 'Pageview Events', '📄')}
            ${this.generateEventsSectionHTML('scroll', 'Scroll-Triggered Events', '📜')}
            
            <!-- All Successful Click Events Section -->
            <div class="subsection">
                <h3>✅ All Successful Click Events (${this.clickEvents.filter(click => click.success === true).length})</h3>
                <div id="successfulClicksContainer">
                    ${this.clickEvents
                        .filter(click => click.success === true)
                        .sort((a, b) => a.timestamp - b.timestamp)
                        .map((click, idx) => {
                            // Check if this click triggered any GA4 events using the new direct matching
                            let hasMatchingEvent = false;
                            let matchingEventDetails = '';
                            
                            if (click.matchedNetworkEvents && click.matchedNetworkEvents.length > 0) {
                                hasMatchingEvent = true;
                                
                                click.matchedNetworkEvents.forEach((networkEvent, eventIdx) => {
                                    let extractedEvents = [];
                                    if (networkEvent.postData) {
                                        extractedEvents = this.parseEventsFromData(networkEvent.postData, networkEvent.timestamp, 'POST', networkEvent.url, networkEvent.postData);
                                    }
                                    if (extractedEvents.length === 0 && CONFIG.NETWORK_FILTERS.GA4_URL.some(ga4Url => networkEvent.url.includes(ga4Url))) {
                                        extractedEvents = this.parseEventsFromData(networkEvent.url, networkEvent.timestamp, 'URL', networkEvent.url, networkEvent.postData || '');
                                    }
                                    
                                    extractedEvents.forEach((evt, extractedEventIdx) => {
                                        // Dynamically generate parameter HTML based on CONFIG.EVENT_PARAMS
                                        const parameterHtml = Object.entries(CONFIG.EVENT_PARAMS).map(([paramKey, paramNames]) => {
                                            const value = evt[paramKey];
                                            if (value !== undefined && value !== null && value !== '') {
                                                const displayName = paramKey.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                                                return `<div><strong>${displayName}:</strong> ${value}</div>`;
                                            }
                                            return '';
                                        }).join('');
                                        
                                        matchingEventDetails += `
                                            <div style="margin-top: 10px; padding: 10px; background: #e8f5e8; border-radius: 5px; border-left: 3px solid #4caf50;">
                                                <strong>✅ GA4 Event ${eventIdx + 1}.${extractedEventIdx + 1} (Direct Match):</strong><br>
                                                ${parameterHtml}
                                                <div><strong>Network Event Time:</strong> ${new Date(networkEvent.timestamp).toLocaleTimeString()}</div>
                                                <div><strong>Time After Click:</strong> ${networkEvent.timestamp - click.timestamp}ms</div>
                                                <div class="url" style="margin-top: 8px;">
                                                    <div class="accordion-header" onclick="toggleAccordion(this)" style="cursor: pointer; padding: 8px 12px; background-color: #f0f0f0; border-radius: 4px; display: flex; align-items: center; justify-content: space-between; font-weight: bold; color: #333; font-size: 0.9em;">
                                                        <span class="accordion-icon">▶</span>
                                                        <span class="url-preview">${networkEvent.url.length > CONFIG.URL_PREVIEW_LENGTH ? networkEvent.url.substring(0, CONFIG.URL_PREVIEW_LENGTH) + '...' : networkEvent.url}</span>
                                                    </div>
                                                    <div class="accordion-content" style="display: none;">
                                                        <div class="full-url" style="padding: 8px; background-color: #f8f9fa; border: 1px solid #e9ecef; border-radius: 4px; font-size: 0.8em; color: #555; margin-top: 4px; font-family: monospace; word-break: break-all;">${networkEvent.url}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        `;
                                    });
                                });
                            }
                            
                            const statusBadge = hasMatchingEvent 
                                ? `<span class="event-type" style="background: #4caf50; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.8em;">TRIGGERED GA4</span>`
                                : `<span class="event-type" style="background: #ffc107; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.8em;">NO GA4</span>`;
                            
                            const statusMessage = hasMatchingEvent 
                                ? `<div style="margin-top: 10px; padding: 10px; background: #e8f5e8; border-radius: 5px; border-left: 3px solid #4caf50;">
                                     <strong>✅ This click successfully triggered ${click.matchedNetworkEvents ? click.matchedNetworkEvents.length : 0} Google Analytics event(s)</strong>
                                   </div>`
                                : `<div style="margin-top: 10px; padding: 10px; background: #fff3cd; border-radius: 5px; border-left: 3px solid #ffc107;">
                                     <strong>⚠️ This click did not trigger any Google Analytics events</strong>
                                   </div>`;
                            
                            return `
                                <div class="event-item" style="background: ${hasMatchingEvent ? '#f1f8e9' : '#fff3cd'}; border-left: 4px solid ${hasMatchingEvent ? '#4caf50' : '#ffc107'};">
                                    <div class="event-header">
                                        <span style="background: #2196f3; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.8em; margin-right: 8px;">#${idx + 1}</span>
                                        ${statusBadge}
                                        <span style="background: #4caf50; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.8em;">click</span>
                                        <span style="background: #e3f2fd; color: #1976d2; padding: 4px 8px; border-radius: 4px; font-size: 0.7em; margin-right: 8px; font-family: monospace;">${click.element.selector}${click.element.id ? ` (ID: ${click.element.id})` : ''}${click.element.className ? ` (Classes: ${click.element.className})` : ''}${Object.keys(click.element.ariaAttributes || {}).length > 0 ? ` (ARIA: ${Object.keys(click.element.ariaAttributes).join(', ')})` : ''}${click.element.textContent ? ` (Text: "${click.element.textContent}")` : ''}</span>
                                        <span class="event-time">${new Date(click.timestamp).toLocaleTimeString()}</span>
                                    </div>
                                    <div class="click-details-container">
                                        <div class="click-basic-info">
                                            <div class="click-info-section">
                                                <span class="click-info-label">Element:</span>
                                                <span class="click-info-value">${click.element.tagName}</span>
                                            </div>
                                            ${click.element.textContent ? `<div class="click-info-section"><span class="click-info-label">Text:</span><span class="click-info-value">"${click.element.textContent}"</span></div>` : ''}
                                            ${click.element.href ? `<div class="click-info-section"><span class="click-info-label">Href:</span><span class="click-info-value">${click.element.href}</span></div>` : ''}
                                            ${click.element.id ? `<div class="click-info-section"><span class="click-info-label">ID:</span><span class="click-info-value">${click.element.id}</span></div>` : ''}
                                            ${click.element.className ? `<div class="click-info-section"><span class="click-info-label">Classes:</span><span class="click-info-value">${click.element.className}</span></div>` : ''}
                                            ${Object.keys(click.element.ariaAttributes || {}).length > 0 ? `
                                                <div class="click-info-section">
                                                    <span class="click-info-label">ARIA Attributes:</span>
                                                    <div class="click-info-value" style="max-height: 150px; overflow-y: auto;">
                                                        ${Object.entries(click.element.ariaAttributes).map(([key, value]) => 
                                                            `<div style="margin-bottom: 4px;"><strong>${key}:</strong> ${value}</div>`
                                                        ).join('')}
                                                    </div>
                                                </div>
                                            ` : ''}
                                            ${click.element.parentSelector ? `<div class="click-info-section"><span class="click-info-label">Parent Selector:</span><span class="click-info-value">${click.element.parentSelector}</span></div>` : ''}
                                            <div class="click-info-section">
                                                <span class="click-info-label">Selector:</span>
                                                <span class="click-info-value">${click.element.selector}</span>
                                            </div>
                                            <div class="click-info-section">
                                                <span class="click-info-label">Click Time:</span>
                                                <span class="click-info-value">${new Date(click.timestamp).toLocaleTimeString()}</span>
                                            </div>
                                            <div class="click-info-section">
                                                <span class="click-info-label">Status:</span>
                                                <span class="click-info-value">${hasMatchingEvent ? 'Successful (triggered GA4 events)' : 'Successful (no GA4 events)'}</span>
                                            </div>
                                            ${statusMessage}
                                        </div>
                                        <div class="click-detailed-info">
                                            ${matchingEventDetails}
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                </div>
            </div>

            ${this.generateEventsSectionHTML('unmatched', 'Unmatched Network Events', '❓')}
            
            <!-- Unmatched Click Events Section -->
            <div class="subsection">
                <h3>❌ Failed Click Events</h3>
                <div id="unmatchedClicksContainer">
                    ${this.clickEvents
                        .filter(click => click.success === false)
                        .filter(failedClick => {
                            // Check if there's an identical successful click for this element
                            const hasIdenticalSuccessful = this.clickEvents.some(successfulClick => 
                                successfulClick.success === true &&
                                successfulClick.element.selector === failedClick.element.selector &&
                                successfulClick.element.textContent === failedClick.element.textContent &&
                                successfulClick.element.parentSelector === failedClick.element.parentSelector
                            );
                            return !hasIdenticalSuccessful;
                        })
                        .map((click, idx) => {
                            const statusBadge = `<span class="event-type" style="background: #ef5350; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.8em;">FAILED</span>`;
                            
                            const statusMessage = `<div style="margin-top: 10px; padding: 10px; background: #ffebee; border-radius: 5px; border-left: 3px solid #ef5350;">
                                 <strong>⚠️ Click Failed:</strong> ${click.error}<br>
                                 This element could not be clicked successfully.
                               </div>`;
                            
                            return `
                                <div class="event-item unmatched-click" style="background: #ffebee; border-left: 4px solid #ef5350;">
                                    <div class="event-header">
                                        ${statusBadge}
                                        <span style="background: #4caf50; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.8em; margin-right: 8px;">click</span>
                                        <span style="background: #e3f2fd; color: #1976d2; padding: 4px 8px; border-radius: 4px; font-size: 0.7em; margin-right: 8px; font-family: monospace;">${click.element.selector}${click.element.id ? ` (ID: ${click.element.id})` : ''}${click.element.className ? ` (Classes: ${click.element.className})` : ''}${click.element.textContent ? ` (Text: "${click.element.textContent}")` : ''}</span>
                                        <span class="event-time">${new Date(click.timestamp).toLocaleTimeString()}</span>
                                    </div>
                                    <div class="click-details-container">
                                        <div class="click-basic-info">
                                            <div class="click-info-section">
                                                <span class="click-info-label">Click Order:</span>
                                                <span class="click-info-value">${idx + 1}</span>
                                            </div>
                                            <div class="click-info-section">
                                                <span class="click-info-label">Element:</span>
                                                <span class="click-info-value">${click.element.tagName}</span>
                                            </div>
                                            ${click.element.textContent ? `<div class="click-info-section"><span class="click-info-label">Text:</span><span class="click-info-value">"${click.element.textContent}"</span></div>` : ''}
                                            ${click.element.href ? `<div class="click-info-section"><span class="click-info-label">Href:</span><span class="click-info-value">${click.element.href}</span></div>` : ''}
                                            ${click.element.id ? `<div class="click-info-section"><span class="click-info-label">ID:</span><span class="click-info-value">${click.element.id}</span></div>` : ''}
                                            ${click.element.className ? `<div class="click-info-section"><span class="click-info-label">Classes:</span><span class="click-info-value">${click.element.className}</span></div>` : ''}
                                            ${Object.keys(click.element.ariaAttributes || {}).length > 0 ? `
                                                <div class="click-info-section">
                                                    <span class="click-info-label">ARIA Attributes:</span>
                                                    <div class="click-info-value" style="max-height: 150px; overflow-y: auto;">
                                                        ${Object.entries(click.element.ariaAttributes).map(([key, value]) => 
                                                            `<div style="margin-bottom: 4px;"><strong>${key}:</strong> ${value}</div>`
                                                        ).join('')}
                                                    </div>
                                                </div>
                                            ` : ''}
                                            ${click.element.parentSelector ? `<div class="click-info-section"><span class="click-info-label">Parent Selector:</span><span class="click-info-value">${click.element.parentSelector}</span></div>` : ''}
                                            <div class="click-info-section">
                                                <span class="click-info-label">Selector:</span>
                                                <span class="click-info-value">${click.element.selector}</span>
                                            </div>
                                            <div class="click-info-section">
                                                <span class="click-info-label">Click Time:</span>
                                                <span class="click-info-value">${new Date(click.timestamp).toLocaleTimeString()}</span>
                                            </div>
                                            <div class="click-info-section">
                                                <span class="click-info-label">Status:</span>
                                                <span class="click-info-value">Failed</span>
                                            </div>
                                            ${statusMessage}
                                        </div>
                                        <div class="click-detailed-info">
                                            ${''}
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                </div>
            </div>
        </div>
    </div>

    <script>
        function toggleAccordion(header) {
            const content = header.nextElementSibling;
            if (content) {
                content.style.display = content.style.display === 'block' ? 'none' : 'block';
                header.classList.toggle('active');
                header.querySelector('.accordion-icon').textContent = content.style.display === 'block' ? '▼' : '▶';
            }
        }

        function filterEvents() {
            const urlFilter = document.getElementById('urlFilter').value.toLowerCase();
            const typeFilter = document.getElementById('typeFilter').value;
            const methodFilter = document.getElementById('methodFilter').value;
            
            const events = document.querySelectorAll('.event-item');
            
            events.forEach(event => {
                const url = event.dataset.url.toLowerCase();
                const type = event.dataset.type;
                const method = event.dataset.method;
                
                const urlMatch = !urlFilter || url.includes(urlFilter);
                const typeMatch = !typeFilter || type === typeFilter;
                const methodMatch = !methodFilter || method === methodFilter;
                
                if (urlMatch && typeMatch && methodMatch) {
                    event.style.display = 'block';
                } else {
                    event.style.display = 'none';
                }
            });
        }
        
        function clearFilters() {
            document.getElementById('urlFilter').value = '';
            document.getElementById('typeFilter').value = '';
            document.getElementById('methodFilter').value = '';
            
            const events = document.querySelectorAll('.event-item');
            events.forEach(event => {
                event.style.display = 'block';
            });
        }
    </script>
</body>
</html>`;

    const htmlPath = path.join(testResultsDir, `${reportFilename}.html`);
    fs.writeFileSync(htmlPath, html);
    console.log(`\n🌐 HTML report saved to ${htmlPath}`);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const url = args[0];
const headless = args.includes('--headless');

// Parse click pause option
let clickPause = CONFIG.EVENT_DELAY; // default
const clickPauseArg = args.find(arg => arg.startsWith('--click-pause='));
if (clickPauseArg) {
  const pauseValue = parseInt(clickPauseArg.split('=')[1]);
  if (!isNaN(pauseValue) && pauseValue > 0) {
    clickPause = pauseValue;
  }
}

if (!url) {
  console.log(`Usage: node gtm-click-tracker.js <url> [--headless] [--click-pause=${CONFIG.EVENT_DELAY}]`);
  console.log('Example: node gtm-click-tracker.js https://www.example.com --headless');
  console.log(`Example: node gtm-click-tracker.js https://www.example.com --click-pause=${CONFIG.EVENT_DELAY}`);
  console.log('');
  console.log('Options:');
  console.log('  --headless     Run in headless mode');
  console.log(`  --click-pause  Pause after each click in milliseconds (default: ${CONFIG.EVENT_DELAY})`);
  process.exit(1);
}

// Run the tracker
const tracker = new NetworkTracker({ url, headless, clickPause });
tracker.run();