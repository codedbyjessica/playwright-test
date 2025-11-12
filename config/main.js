/**
 * Configuration Constants for GA4 Event Tracker
 * 
 * This file contains all configuration settings organized by feature.
 * 
 * @author AI Assistant
 * @version 2.0
 */

const CONFIG = {
  // ============================================================================
  // TEST CONTROL - Which test categories to run
  // ============================================================================

  RUN_GA_CATEGORIES: {
    click: false,
    scroll: false,
    page_view: false,
    exit_modal: false,
    forms: true                   // Enable form testing
  },

  // Form Test Scenarios - which tests to run
  FORM_TEST_SCENARIOS: {
    individualFields: true,      // Test each field individually with blur events
    validSubmission: true,        // Submit form with valid data
    emptySubmission: true,        // Submit empty form to check validation
    invalidSubmission: true       // Submit form with invalid data
  },

  REPORT_GENERATION: {
    html: true,
    csv: true,
    json: false,
  },

  ARD_REPORT_GENERATION: {
    html: true,
    csv: false,
    json: false,
  },


  // ============================================================================
  // GLOBAL CONFIGURATION
  // ============================================================================
  GLOBAL: {
    // Browser settings
    viewport: { width: 1280, height: 720 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    
    // Timing
    browserTimeout: 30000,      // Timeout for browser operations
    pageLoadTimeout: 5000,      // Timeout for page load operations
    networkWait: 2000,          // Wait time for network events
    minEventDelay: 0,           // Minimum delay before considering an event as triggered by action
    
    // Display & Reporting
    urlPreviewLength: 80,
    maxPayloadHeight: 200,
    statCardMinWidth: 200,
    screenshotContextPadding: 100,  // Pixels of context around element in screenshots
    
    // Network filtering
    ga4Urls: ['https://www.google-analytics.com/g/collect', 'https://analytics.google.com/g/collect'],
    
    // Event parameter mapping (camelCase keys to various possible parameter names)
    eventParams: {
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
    }
  },

  // ============================================================================
  // CLICK TESTING CONFIGURATION
  // ============================================================================
  CLICK: {
    // Timing
    eventDelay: 8000,           // Interval between click actions (for better event capture)
    timeout: 5000,              // Timeout for click operations
    waitAfterClick: 100,        // Wait time after clicking before polling
    
    // Selectors
    selector: [
      'a',
      'button',
      // 'input[type="submit"]',
      'input[type="button"]',
      '[role="button"]',
      '[onclick]',
      '.btn',
      '.button'
    ],
    
    // Event filtering (case insensitive) - matches against event name (en parameter)
    excludeKeywords: [
      'timer', 
      'user_engagement',
      'pageview',         // Matches "pageview"
      'page_view',        // Matches "page_view" 
      'page view',        // Matches "Page View" (with space)
      'scroll',           // Matches "scroll", "Scroll Depth", "scroll_depth"
      'scroll depth',
      'scroll_depth',
      'form_start',       // Matches form start events
      'form_field',       // Matches "form_field_completion"
      'form_submission',  // Matches form submission events
      'form_error',       // Matches form error events
    ]
  },

  // ============================================================================
  // SCROLL TESTING CONFIGURATION
  // ============================================================================
  SCROLL: {
    // Timing
    eventDelay: 5000,           // Delay between scroll action and event capture
    timeout: 1000,              // Timeout for scroll operations
    
    // Scroll behavior
    thresholds: [10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 100],  // Percentage thresholds to test
    bufferPx: 20,               // Extra pixels to scroll past threshold to ensure event triggers
    
    // Event filtering
    eventKeywords: ['scroll', 'scroll_depth', 'scroll_percentage']
  },

  // ============================================================================
  // FORM TESTING CONFIGURATION
  // ============================================================================
  FORM: {
    // Timing
    fieldFillDelay: 8000,       // Delay between filling fields (for GA4 events)
    blurDelay: 1000,            // Delay after blur event
    submitDelay: 5000,          // Delay before submit
    errorCheckDelay: 3000,      // Delay to check for errors after submit
    successCheckDelay: 4000,     // Delay to check for success after submit
    eventDelay: 8000,           // Delay to wait for GA4 events after submit
    timeout: 2000,              // Timeout for form operations
  },

  // ============================================================================
  // EXIT MODAL CONFIGURATION
  // ============================================================================
  EXIT_MODAL: {
    selectors: [
      '[data-gtm-destination="Exit Modal"]',
      '.exit-link'
    ]
  },

  // ============================================================================
  // ONETRUST (COOKIE CONSENT) CONFIGURATION
  // ============================================================================
  ONETRUST: {
    acceptButtonSelector: '#onetrust-accept-btn-handler',
    
    // Elements to exclude from click testing
    selector: [
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
      '#ot-pc-desc button'
    ]
  },


};

module.exports = CONFIG;
