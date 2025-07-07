# Playwright GTM Tracker

A Playwright-based tool that automatically clicks all buttons and interactive elements on a website while tracking Google Tag Manager (GTM) network responses.

## Features

- 🔍 **Comprehensive Element Detection**: Finds and clicks buttons, links, form elements, and other interactive elements
- 📊 **GTM Response Tracking**: Captures and logs all GTM-related network requests and responses
- 📋 **Detailed Reporting**: Generates comprehensive reports with timestamps and element associations
- ⚙️ **Configurable Options**: Customize behavior with various command-line options
- 🔄 **Navigation Handling**: Automatically handles page navigation and returns to original page
- 📁 **JSON Reports**: Saves detailed reports to JSON files for further analysis

## Installation

1. Install dependencies:
```bash
npm install
```

2. Install Playwright browsers:
```bash
npm run install-browsers
```

## Usage

### Basic Usage

```bash
# Run the basic tracker
npm start https://example.com

# Run the advanced tracker
node advanced-gtm-tracker.js https://example.com
```

### Advanced Usage Options

```bash
# Run in headless mode
node advanced-gtm-tracker.js https://example.com --headless

# Customize timing
node advanced-gtm-tracker.js https://example.com --slow-mo=500 --wait=3000

# Exclude certain element types
node advanced-gtm-tracker.js https://example.com --no-links --no-forms

# Set custom timeout
node advanced-gtm-tracker.js https://example.com --timeout=60000
```

### Command Line Options

- `--headless`: Run browser in headless mode
- `--slow-mo=<ms>`: Slow down actions by specified milliseconds (default: 1000)
- `--wait=<ms>`: Wait time after each click (default: 2000)
- `--timeout=<ms>`: Page load timeout (default: 30000)
- `--no-links`: Exclude links from clicking
- `--no-forms`: Exclude form elements from clicking

## What Gets Tracked

The tool tracks network requests and responses related to:

- `googletagmanager.com`
- `google-analytics.com`
- `googleadservices.com`
- `doubleclick.net`
- `googlesyndication.com`
- Any URL containing "gtm", "google-analytics", or "gtag"

## Output

### Console Output
The tool provides real-time console output showing:
- 🚀 GTM requests being made
- 📊 GTM responses received
- 🖱️ Elements being clicked
- 📋 Summary report

### Reports Generated
The tool generates multiple types of reports:

1. **JSON Report** (`gtm-report.json` or `advanced-gtm-report.json`): Machine-readable format with all data
2. **HTML Report** (`gtm-report.html`): Beautiful, interactive web report for easy analysis

### HTML Report Features
The HTML report includes:
- 📊 **Statistics Dashboard**: Summary cards with key metrics
- 🎯 **GA4 Events Section**: Detailed breakdown of Google Analytics 4 events with parameters
- 📊 **GTM Responses**: All captured GTM network responses
- 🖱️ **Clicked Elements**: Visual list of all elements that were clicked
- 🌐 **Pages Visited**: Navigation history during the test
- ⚙️ **Test Configuration**: Settings used for the test
- 🔍 **Interactive Elements**: Expandable sections for detailed parameter viewing

### Report Structure

```json
{
  "summary": {
    "totalGTMResponses": 5,
    "totalElementsClicked": 12,
    "pagesVisited": ["https://example.com", "https://example.com/page2"],
    "timestamp": "2024-01-01T12:00:00.000Z",
    "options": { ... }
  },
  "gtmResponses": [
    {
      "url": "https://www.googletagmanager.com/gtm.js",
      "status": 200,
      "headers": { ... },
      "body": "...",
      "timestamp": "2024-01-01T12:00:00.000Z",
      "elementClicked": "Submit Button",
      "requestMethod": "GET",
      "contentType": "application/javascript"
    }
  ],
  "clickedElements": ["Submit Button", "Login Link", ...]
}
```

## Examples

### Track GTM on an e-commerce site
```bash
node advanced-gtm-tracker.js https://shop.example.com --slow-mo=2000
```

### Quick test in headless mode
```bash
node advanced-gtm-tracker.js https://example.com --headless --wait=1000
```

### Focus only on buttons (exclude links and forms)
```bash
node advanced-gtm-tracker.js https://example.com --no-links --no-forms
```

## Troubleshooting

### Common Issues

1. **No GTM responses captured**: The website might not use GTM or the patterns might not match
2. **Elements not found**: The page might use custom selectors or dynamic content
3. **Navigation errors**: Some sites prevent going back or have complex navigation

### Debug Mode

To see more detailed output, you can modify the scripts to add more logging or run with `--slow-mo=2000` to see what's happening in real-time.

## Customization

You can customize the GTM patterns by modifying the `gtmPatterns` array in the script:

```javascript
gtmPatterns: [
  'googletagmanager.com',
  'google-analytics.com',
  'your-custom-pattern.com'
]
```

## License

MIT License - feel free to use and modify as needed.