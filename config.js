/**
 * Configuration Constants for GA4 Click Event Tracker
 * 
 * This file contains all configuration settings for the GA4 Click Event Tracker.
 * Centralizing configuration makes it easier to maintain and modify settings.
 * 
 * @author AI Assistant
 * @version 1.0
 */

const CONFIG = {
  // Timing configuration - restored to slower, more reliable settings
  CLICK_EVENT_DELAY: 3000,        // Interval between actions (slower for better event capture)
  CLICK_TIMEOUT: 5000,      // Timeout for click operations
  SCROLL_TIMEOUT: 1000,     // Timeout for scroll operations
  SCROLL_EVENT_DELAY: 5000, // Delay between scroll action and event capture (slower for reliability)
  PAGE_LOAD_TIMEOUT: 5000,  // Timeout for page load operations (slower for reliability)
  WAIT_AFTER_CLICK: 100,    // Wait time after clicking before polling
  NETWORK_WAIT: 2000,        // Wait time for network events (increased for better capture)
  MIN_EVENT_DELAY: 0,       // Minimum delay before considering an event as triggered by a click

  SCROLL_THRESHOLDS: [10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 100], // Full set for comprehensive testing
  SCROLL_BUFFER_PX: 20, // Extra pixels to scroll past threshold to ensure event triggers
  
  // Screenshot configuration
  SCREENSHOT_CONTEXT_PADDING: 100, // Pixels of context around element in screenshots
  
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

  EXIT_MODAL_SELECTORS: [
    '[data-gtm-destination="Exit Modal"]',
    '.exit-link',
  ],
  
  // Elements to exclude from clicking
  EXCLUDE_SELECTORS_FROM_CLICK: [
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
    "outbound": ['ep.outbound', 'ep.Outbound', 'outbound', 'Outbound'],
    "fullURL": ['ep.full_url', 'ep.Full_URL', 'full_url', 'Full_URL', "dl"]
  },

  RUN_GA_CATEGORIES: {
    click: false,
    scroll: false,
    page_view: false,
    exit_modal: false,
    // form testing is now controlled by command line args, not this config
  }

};

module.exports = CONFIG;
