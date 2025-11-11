# GTM Comprehensive Tracker

This project provides a unified tool to automatically test Google Analytics 4 (GA4) event tracking on websites with comprehensive coverage of clicks, scrolls, forms, and more.

## Overview

**One Command. Complete Testing.** The GTM Tracker provides comprehensive GA4 testing in a single unified tool:

- **Click Tracking** - Automatically tests all interactive elements
- **Scroll Depth Testing** - Tests scroll tracking at multiple thresholds  
- **Form Testing** - Comprehensive form validation and submission testing
- **Network Analysis** - Captures and analyzes all GA4 network events
- **Unified Reporting** - Single HTML report with all test results

## Main Components

1. **GTM Tracker** (`gtm-tracker.js`) - Unified testing tool for clicks, scrolls, forms, and GA4 analysis
2. **ARD Comparison Tool** (`ard-compare.js`) - Standalone tool to compare test results against ARD requirements
3. **Form Testing Engine** (`utils/form-tester.js`) - Comprehensive form testing with validation scenarios
4. **Custom Form Configurations** (`custom-config.js`) - Configurable form testing scenarios

## Prerequisites

- Node.js (v14 or higher)
- Playwright browser automation framework

## Installation

1. Install dependencies:
```bash
npm install playwright
```

2. Install Playwright browsers:
```bash
npx playwright install chromium
```

## Usage

### Browser Runner (Manual Testing)

For manual testing and development, use the browser runner to open a Playwright browser with helpful debugging tools:

```bash
# Open browser for manual testing
node browser-runner.js https://www.example.com

# Run in headless mode (closes after 30 seconds)
node browser-runner.js https://www.example.com --headless

# Custom viewport size
node browser-runner.js https://www.example.com --viewport-width=1920 --viewport-height=1080
```

**Features:**
- Opens browser with realistic user agent and settings
- Automatically logs GA4 network requests to console
- Provides browser console functions for scroll testing:
  - `scrollToPercentage(25)` - Scroll to 25% of page height
  - `getScrollPercentage()` - Get current scroll position
  - `testScrollThresholds()` - Show available scroll thresholds
- Handles cookie consent banners automatically
- Keeps browser open for manual inspection (non-headless mode)

## Usage

### ARD Comparison Tool

Compare your test results against an Analytics Requirements Document (ARD) to verify implementation:

```bash
# Run tests first
node gtm-tracker.js https://www.example.com

# Compare results against ARD
node ard-compare.js --networkresults=./ga4-events-example.com.csv --ard=./path/to/ard.csv

# Custom output name
node ard-compare.js --networkresults=./results.csv --ard=./ard.csv --output=my-comparison
```

**What it does:**
- ✅ **Matching Events** - Events properly implemented per ARD
- ❌ **Missing Events** - Required by ARD but not found in test
- ➕ **Extra Events** - Found in test but not in ARD
- ⚠️ **Parameter Mismatches** - Event found but parameters differ
- 📊 **Coverage Score** - Percentage of ARD requirements met

**Generates:**
- `ard-compare-{name}.html` - Visual comparison report with color-coded sections
- `ard-compare-{name}.csv` - Tabular comparison data for analysis
- `ard-compare-{name}.json` - Machine-readable results for automation

**Configuration:**
Enable/disable report types in `config/main.js`:
```javascript
ARD_REPORT_GENERATION: {
  html: true,
  csv: true,
  json: true,
}
```

### Complete GTM Testing (One Command Does Everything)

The GTM Tracker automatically runs **ALL** testing capabilities by default:

```bash
# Complete testing: pageviews, scrolls, clicks, AND forms (if configured)
node gtm-tracker.js https://www.example.com

# Run in headless mode (no browser window)
node gtm-tracker.js https://www.example.com --headless

# Use specific form configuration
node gtm-tracker.js https://your-form-page.com --form-config=neffy_consumer_signup

# Disable form testing if needed
node gtm-tracker.js https://www.example.com --no-forms
```

### What Gets Tested Automatically (Default Behavior)

**🎯 Always Runs:**
- **Pageview Events** - Initial page load tracking
- **Scroll Depth Testing** - Tests at 10%, 20%, 25%, 30%, 40%, 50%, 60%, 70%, 75%, 80%, 90%, 100%
- **Click Testing** - All interactive elements (links, buttons, inputs, etc.)
- **Form Testing** - Comprehensive form validation and submission testing (if forms configured)
- **Network Event Capture** - All GA4 requests with timing analysis
- **Cookie Consent Handling** - OneTrust and Pantheon banners

**📝 Form Testing (Runs Automatically if Forms Configured):**
1. **Individual Field Testing** - Fill each field and blur to test field-level validation
2. **Valid Submission** - Complete form with valid data and submit
3. **Empty Submission** - Submit empty form to trigger required field errors  
4. **Invalid Data Submission** - Submit with invalid data to test validation rules

### Command Options

- `--headless`: Run browser in headless mode
- `--click-pause=N`: Time to wait after each action in milliseconds (default: 3000ms)
- `--form-config=NAME`: Specify form configuration to use (auto-detects first available if not specified)
- `--no-forms`: Disable form testing (forms are tested by default)

### List Available Configurations

```bash
# See all available form configurations and usage
node gtm-tracker.js
```

## Creating Custom Form Configurations

To test your own forms, create a configuration in `custom-config.js`:

```javascript
const FORM_CONFIGS = {
  your_form_name: {
    // Form identification
    formSelector: 'form#your-form',
    submitButtonSelector: '#submit-btn',
    
    // Define all form fields
    fields: {
      email: {
        type: 'email',
        selector: '#email',
        testValues: {
          valid: 'test@example.com',
          invalid: 'invalid-email',
          empty: ''
        },
        required: true
      },
      
      phone: {
        type: 'tel', 
        selector: '#phone',
        testValues: {
          valid: '5551234567',
          invalid: '123',
          empty: ''
        },
        required: true
      },
      
      // Radio buttons
      user_type: {
        type: 'radio',
        selector: 'input[name="user_type"]',
        options: ['individual', 'business'],
        testValues: {
          valid: 'individual',
          invalid: null
        },
        required: true
      },
      
      // Checkboxes
      interests: {
        type: 'checkbox',
        selector: 'input[name="interests"]',
        options: ['news', 'updates', 'promotions'],
        testValues: {
          valid: ['news', 'updates'],
          invalid: []
        },
        required: true
      },
      
      // Conditional fields (show/hide based on other fields)
      business_name: {
        type: 'text',
        selector: '#business-name',
        testValues: {
          valid: 'Acme Corp',
          invalid: ''
        },
        required: true,
        conditional: {
          dependsOn: 'user_type',
          showWhen: 'business'
        }
      }
    },
    
    // Test scenarios to run
    testScenarios: {
      individualFields: { enabled: true },
      validSubmission: { 
        enabled: true,
        successIndicators: ['.success-message', 'text=Thank you']
      },
      emptySubmission: { 
        enabled: true,
        expectedErrors: ['#error-email', '#error-phone']
      },
      invalidSubmission: { 
        enabled: true,
        expectedErrors: ['#error-email', '#error-phone']
      }
    },
    
    // Timing configuration
    timing: {
      fieldFillDelay: 500,
      blurDelay: 300,
      submitDelay: 1000,
      errorCheckDelay: 2000,
      successCheckDelay: 3000
    }
  }
};
```

### ARD Analysis (Legacy)

After running the GTM click tracker, analyze the results against your ARD:

```bash
node ard-analysis.js
```

The ARD analysis will:
- Load the ARD.csv file
- Parse the most recent GTM click tracker results
- Match network events by `event_category`
- Generate separate reports for matched and unmatched events

## ARD.csv Format

The ARD.csv file should contain the following columns:

| Column | Description |
|--------|-------------|
| Name | Human-readable name for the tracking requirement |
| event_category | The GA4 event category to match against |
| event_action | Expected event action format |
| event_label | Expected event label format |
| description | Description of what should be tracked |
| Note | Additional notes or implementation details |

Example ARD.csv:
```csv
Name,event_category,event_action,event_label,description,Note
Scroll depth,"Scroll Depth","Reached {Baseline|25%|50%|75%|100%}","$PageName","Implement scroll depth tracking for all pages","Note: Ensure that this event is tracked as a non-interaction event."
Header links,"Header","$Destination_URL OR $Modal_Type","$ClickText OR $LinkName","Track Header links as unique events","Track navigation and modal interactions in header"
```

## Generated Reports

### GTM Click Tracker Reports

The GTM click tracker generates several report files in the `test-results/` directory:

1. **HTML Report** (`network-events-{site}-{timestamp}.html`)
   - Comprehensive visual report with all network events
   - Categorized by event type (pageview, scroll, click, unmatched)
   - Detailed click analysis with success/failure status
   - Interactive accordion sections for URL details

2. **CSV Report** (`network-events-{site}-{timestamp}.csv`)
   - Simplified click events summary
   - Includes element details and GA4 event information
   - Suitable for further analysis in spreadsheet applications

3. **JSON Report** (`network-events-{site}-{timestamp}.json`)
   - Raw network event data for programmatic analysis
   - Used by the ARD analysis tool
   - Contains all extracted GA4 event parameters

### ARD Analysis Reports

The ARD analysis generates:

1. **HTML Report** (`ard-analysis-{timestamp}.html`)
   - Visual comparison of network events against ARD entries
   - Separate sections for matched and unmatched events
   - ARD entry details for each match
   - Summary statistics

2. **CSV Report** (`ard-analysis-{timestamp}.csv`)
   - Tabular data of all events with ARD match status
   - Suitable for further analysis or reporting

## Key Features

### GTM Click Tracker Features

- **Automatic Element Detection**: Finds all clickable elements (links, buttons, inputs, etc.)
- **Smart Click Handling**: Opens links in new tabs to prevent navigation
- **Cookie Consent Handling**: Automatically handles OneTrust cookie banners
- **Network Event Capture**: Intercepts and parses GA4 collect requests
- **Event Matching**: Associates network events with specific clicks using timing analysis
- **Comprehensive Reporting**: Multiple report formats for different use cases

### ARD Analysis Features

- **Event Category Matching**: Matches network events to ARD entries by `event_category`
- **Gap Analysis**: Identifies events not covered by the ARD
- **Compliance Reporting**: Shows which ARD requirements are being met
- **Multiple Output Formats**: HTML and CSV reports for different audiences

## Configuration

### GTM Click Tracker Configuration

Key configuration options in `gtm-click-tracker.js`:

```javascript
const CONFIG = {
  EVENT_DELAY: 8000,           // Time to wait after each click
  POLL_INTERVAL: 1000,         // Interval between polling for network events
  CLICK_TIMEOUT: 5000,         // Timeout for click operations
  VIEWPORT: { width: 1280, height: 720 },
  
  // Elements to exclude from clicking
  EXCLUDE_SELECTORS_FROM_CLICK: [
    '[data-gtm-destination="Exit Modal"]',
    '.exit-link',
    '#onetrust-accept-btn-handler',
    // ... more selectors
  ],
  
  // GA4 URL patterns to capture
  NETWORK_FILTERS: {
    GA4_URL: ['https://www.google-analytics.com/g/collect', 'https://analytics.google.com/g/collect'],
  }
};
```

### Event Parameter Mapping

The tracker extracts various GA4 event parameters:

```javascript
EVENT_PARAMS: {
  'eventName': ['en'],
  'eventCategory': ['ep.event_category', 'ep.Event_Category', 'event_category', 'Event_Category'],
  'eventAction': ['ep.event_action', 'ep.Event_Action', 'event_action', 'Event_Action'],
  'eventLabel': ['ep.event_label', 'ep.Event_Label', 'event_label', 'Event_Label'],
  // ... more parameters
}
```

## Troubleshooting

### Common Issues

1. **No network events captured**
   - Ensure the website has GA4 tracking implemented
   - Check that the GA4 collect URLs are being intercepted
   - Verify the site is not blocking automated browsers

2. **Clicks not working**
   - Some elements may be hidden or require specific conditions
   - Check the exclude selectors configuration
   - Review the failed clicks section in the HTML report

3. **ARD analysis shows no matches**
   - Verify the ARD.csv format is correct
   - Check that event categories in the ARD match those in the network events
   - Ensure the GTM click tracker was run successfully

### Debug Mode

For troubleshooting, you can run the GTM click tracker in non-headless mode to see what's happening:

```bash
node gtm-tracker.js https://www.example.com
```

## Example Workflow

### Standard Website Testing
1. **Run Complete Testing**: `node gtm-tracker.js https://your-site.com --headless`
2. **Review Results**: Check the generated HTML report for comprehensive findings
3. **Analyze Coverage**: Review click, scroll, and pageview tracking results

### Form-Enabled Website Testing  
1. **Configure Form**: Add your form configuration to `custom-config.js`
2. **Run Complete Testing**: `node gtm-tracker.js https://your-form-site.com --form-tests --form-config=your_form_name`
3. **Review Results**: Check both interaction testing and isolated form testing results
4. **Validate Tracking**: Ensure all form interactions trigger appropriate GA4 events

## File Structure

```
playwright-test/
├── gtm-tracker.js         # 🎯 Main unified testing tool (clicks, scrolls, forms, GA4)
├── browser-runner.js      # Manual testing browser
├── custom-config.js       # Form testing configurations
├── config.js             # Main configuration settings
├── utils/                # Utility modules
│   ├── form-tester.js    # Form testing logic
│   ├── report-generator.js # Report generation
│   ├── event-parser.js   # Network event parsing
│   ├── event-classifier.js # Event classification
│   ├── element-handler.js # Element interaction handling
│   └── network-handler.js # Network event handling
├── package.json          # Node.js dependencies
├── README.md            # This file
└── test-results/        # Generated reports (created automatically)
    ├── network-events-*.html  # Comprehensive test reports
    ├── network-events-*.csv   # Click/scroll data export
    └── network-events-*.json  # Raw data for analysis
```

## Contributing

To extend the functionality:

1. **Add new event parameters**: Update the `EVENT_PARAMS` configuration
2. **Modify click behavior**: Adjust the `EXCLUDE_SELECTORS_FROM_CLICK` array
3. **Enhance reporting**: Modify the HTML/CSS in the report generation methods
4. **Add new ARD fields**: Update the CSV parsing and matching logic

## License

This project is provided as-is for testing and analysis purposes.