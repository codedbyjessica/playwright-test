# GTM Click Tracker & ARD Analysis

This project provides tools to automatically test Google Analytics 4 (GA4) event tracking on websites and analyze the results against an Analytics Requirements Document (ARD).

## Overview

The project consists of two main components:

1. **GTM Click Tracker** (`gtm-click-tracker.js`) - Automatically clicks all clickable elements on a webpage and captures GA4 network events
2. **ARD Analysis** (`ard-analysis.js`) - Analyzes the captured network events against ARD.csv entries to identify matches and gaps

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

### Step 1: Run GTM Click Tracker

The GTM click tracker will automatically:
- Navigate to the specified URL
- Handle cookie consent banners (OneTrust)
- Click all clickable elements
- Capture GA4 network events
- Generate comprehensive reports

```bash
# Basic usage
node gtm-click-tracker.js https://www.example.com

# Run in headless mode (no browser window)
node gtm-click-tracker.js https://www.example.com --headless

# Customize click pause duration (default: 8000ms)
node gtm-click-tracker.js https://www.example.com --click-pause=5000
```

**Options:**
- `--headless`: Run browser in headless mode
- `--click-pause=<milliseconds>`: Time to wait after each click (default: 8000ms)

### Step 2: Run ARD Analysis

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
node gtm-click-tracker.js https://www.example.com
```

## Example Workflow

1. **Prepare ARD**: Ensure your ARD.csv file is in the project directory
2. **Run Click Tracker**: `node gtm-click-tracker.js https://your-site.com --headless`
3. **Review Results**: Check the generated HTML report for initial findings
4. **Run ARD Analysis**: `node ard-analysis.js`
5. **Analyze Gaps**: Review the ARD analysis report to identify missing tracking
6. **Update Implementation**: Address any gaps found in the analysis

## File Structure

```
playwright-test/
├── gtm-click-tracker.js    # Main click tracking tool
├── ard-analysis.js         # ARD analysis tool
├── ARD.csv                 # Analytics Requirements Document
├── package.json            # Node.js dependencies
├── README.md              # This file
└── test-results/          # Generated reports (created automatically)
    ├── network-events-*.html
    ├── network-events-*.csv
    ├── network-events-*.json
    ├── ard-analysis-*.html
    └── ard-analysis-*.csv
```

## Contributing

To extend the functionality:

1. **Add new event parameters**: Update the `EVENT_PARAMS` configuration
2. **Modify click behavior**: Adjust the `EXCLUDE_SELECTORS_FROM_CLICK` array
3. **Enhance reporting**: Modify the HTML/CSS in the report generation methods
4. **Add new ARD fields**: Update the CSV parsing and matching logic

## License

This project is provided as-is for testing and analysis purposes.