const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

class NetworkTracker {
  constructor(options = {}) {
    this.options = {
      url: options.url || 'https://example.com',
      headless: options.headless !== false,
      timeout: options.timeout || 30000,
      ...options
    };
    
    this.networkEvents = [];
    this.scrollEvents = [];
    this.browser = null;
    this.page = null;
  }

  async init() {
    this.browser = await chromium.launch({ 
      headless: this.options.headless
    });
    
    // Create an incognito context
    const context = await this.browser.newContext({
      viewport: { width: 1280, height: 720 }
    });
    
    this.page = await context.newPage();
    
    // Set up network event interception
    this.page.on('request', request => {
      const url = request.url();
      // Only record GA4 collect requests
      if (url.includes('https://www.google-analytics.com/g/collect')) {
        const timestamp = new Date().getTime();
        
        // Extract parameters from request payload (POST data)
        let eventName = '';
        let eventAction = '';
        let eventLocation = '';
        
        const postData = request.postData();
        if (postData) {
          try {
            const postParams = new URLSearchParams(postData);
            eventName = postParams.get('en') || '';
            eventAction = postParams.get('event_action') || '';
            eventLocation = postParams.get('event_location') || '';
          } catch (e) {
            console.log('⚠️  Error parsing POST data:', e.message);
          }
        }
        
        this.networkEvents.push({
          type: 'request',
          timestamp,
          url: request.url(),
          method: request.method(),
          headers: request.headers(),
          postData: request.postData(),
          eventName: eventName,
          eventAction: eventAction,
          eventLocation: eventLocation
        });
      }
    });

    this.page.on('response', async response => {
      const url = response.url();
      // Only record GA4 collect responses
      if (url.includes('https://www.google-analytics.com/g/collect')) {
        const timestamp = new Date().getTime();
        const request = response.request();
        
        // Extract parameters from request payload (POST data)
        let eventName = '';
        let eventAction = '';
        let eventLocation = '';
        
        const postData = request.postData();
        if (postData) {
          try {
            const postParams = new URLSearchParams(postData);
            eventName = postParams.get('en') || '';
            eventAction = postParams.get('event_action') || '';
            eventLocation = postParams.get('event_location') || '';
          } catch (e) {
            console.log('⚠️  Error parsing POST data:', e.message);
          }
        }
        
        let body = '';
        try {
          body = await response.text();
        } catch (e) {
          body = '[Unable to read response body]';
        }
        
        this.networkEvents.push({
          type: 'response',
          timestamp,
          url: response.url(),
          status: response.status(),
          method: request.method(),
          headers: response.headers(),
          body: body,
          requestUrl: request.url(),
          eventName: eventName,
          eventAction: eventAction,
          eventLocation: eventLocation
        });
      }
    });
  }

  async handleOneTrust() {
    try {
      console.log('🍪 Looking for OneTrust cookie consent...');
      
      // Try the specific selector that worked first
      try {
        const oneTrustExists = await this.page.evaluate(() => {
          const button = document.querySelector("#onetrust-accept-btn-handler");
          if (button) {
            console.log('✅ Found OneTrust accept button, clicking...');
            button.click();
            return true;
          }
          return false;
        });
        
        if (oneTrustExists) {
          console.log('✅ Clicked OneTrust accept button using document.querySelector');
          await this.page.waitForTimeout(2000);
          return true;
        }
      } catch (e) {
        console.log('⚠️  Error with direct querySelector approach:', e.message);
      }
      
      // Fallback to other OneTrust accept button selectors
      const oneTrustSelectors = [
        '#onetrust-accept-btn-handler',
        '#onetrust-banner-sdk #onetrust-accept-btn-handler',
        '.onetrust-banner-options-container #onetrust-accept-btn-handler',
        '[id*="onetrust-accept"]',
        '[class*="onetrust-accept"]',
        'button[aria-label*="Accept"]',
        'button[aria-label*="accept"]',
        'button:has-text("Accept")',
        'button:has-text("Accept All")',
        'button:has-text("Accept Cookies")',
        'button:has-text("I Accept")',
        'button:has-text("OK")',
        'button:has-text("Got it")',
        'button:has-text("Continue")',
        '.cookie-accept',
        '.cookie-accept-all',
        '.accept-cookies',
        '.accept-all-cookies'
      ];

      for (const selector of oneTrustSelectors) {
        try {
          const acceptButton = await this.page.$(selector);
          if (acceptButton) {
            console.log(`✅ Found OneTrust accept button with selector: ${selector}`);
            await acceptButton.click();
            console.log('✅ Clicked OneTrust accept button');
            
            // Wait for the banner to disappear
            await this.page.waitForTimeout(2000);
            
            // Check if banner is gone
            const bannerStillVisible = await this.page.$(selector);
            if (!bannerStillVisible) {
              console.log('✅ OneTrust banner dismissed successfully');
              return true;
            } else {
              console.log('⚠️  Banner still visible, trying force click');
              await acceptButton.click({ force: true });
              await this.page.waitForTimeout(2000);
            }
            break;
          }
        } catch (e) {
          // Continue to next selector
        }
      }

      // Also try to find any cookie-related buttons by text content
      try {
        const allButtons = await this.page.$$('button');
        for (const button of allButtons) {
          const buttonText = await button.textContent();
          if (buttonText && (
            buttonText.toLowerCase().includes('accept') ||
            buttonText.toLowerCase().includes('got it') ||
            buttonText.toLowerCase().includes('continue') ||
            buttonText.toLowerCase().includes('ok') ||
            buttonText.toLowerCase().includes('allow')
          )) {
            console.log(`✅ Found cookie accept button with text: "${buttonText}"`);
            await button.click();
            console.log('✅ Clicked cookie accept button');
            await this.page.waitForTimeout(2000);
            return true;
          }
        }
      } catch (e) {
        console.log('⚠️  Error searching for cookie buttons by text:', e.message);
      }

      console.log('ℹ️  No OneTrust or cookie consent banner found');
      return false;
    } catch (error) {
      console.log('⚠️  Error handling OneTrust:', error.message);
      return false;
    }
  }

  async scrollPage() {
    console.log('📜 Starting page scroll...');
    
    // Get page height
    const pageHeight = await this.page.evaluate(() => document.body.scrollHeight);
    console.log(`📏 Page height: ${pageHeight}px`);
    
    // Scroll down in increments
    const viewportHeight = 720;
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
      await this.page.waitForTimeout(500);
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
        waitUntil: 'networkidle',
        timeout: this.options.timeout 
      });
      
      console.log('⏳ Waiting 5000ms for page to load...');
      await this.page.waitForTimeout(5000);
      
      // Handle OneTrust
      await this.handleOneTrust();
      
      // Scroll the page
      await this.scrollPage();
      
      // Wait a bit more to capture any final network events
      await this.page.waitForTimeout(2000);
      
      // Generate HTML report
      await this.generateHTMLReport();
      
    } catch (error) {
      console.error('❌ Error running tracker:', error);
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }

  async generateHTMLReport() {
    console.log('\n📋 === NETWORK EVENTS REPORT ===');
    
    // Filter and categorize events
    const requests = this.networkEvents.filter(e => e.type === 'request');
    const responses = this.networkEvents.filter(e => e.type === 'response');
    
    console.log(`Total network events: ${this.networkEvents.length}`);
    console.log(`Requests: ${requests.length}`);
    console.log(`Responses: ${responses.length}`);
    
    // Generate filename
    const siteUrl = new URL(this.options.url).hostname.replace(/\./g, '-');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const reportFilename = `network-events-${siteUrl}-${timestamp}`;
    
    // Create test-results folder
    const testResultsDir = 'test-results';
    if (!fs.existsSync(testResultsDir)) {
      fs.mkdirSync(testResultsDir, { recursive: true });
    }
    
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Network Events Report - ${this.options.url}</title>
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
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); 
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
        .response-item { border-left-color: #4caf50; }
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
        .response-type { background: #4caf50; }
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
            max-height: 200px;
            overflow-y: auto;
        }
        .payload-title {
            font-weight: bold;
            color: #495057;
            margin-bottom: 5px;
        }
        .filter-controls {
            background: white;
            padding: 20px;
            border-radius: 10px;
            margin-bottom: 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .filter-controls input, .filter-controls select {
            padding: 8px 12px;
            border: 1px solid #ddd;
            border-radius: 4px;
            margin-right: 10px;
            font-size: 14px;
        }
        .filter-controls button {
            background: #667eea;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
        }
        .filter-controls button:hover {
            background: #5a6fd8;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🌐 Network Events Report</h1>
            <p>Complete network activity captured during page load and scroll</p>
        </div>
        
        <div class="stats">
            <div class="stat-card">
                <div class="stat-number">${this.networkEvents.length}</div>
                <div class="stat-label">Total Events</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${requests.length}</div>
                <div class="stat-label">Requests</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${responses.length}</div>
                <div class="stat-label">Responses</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${new Set(this.networkEvents.map(e => e.url)).size}</div>
                <div class="stat-label">Unique URLs</div>
            </div>
        </div>

        <div class="filter-controls">
            <input type="text" id="urlFilter" placeholder="Filter by URL..." style="width: 300px;">
            <select id="typeFilter">
                <option value="">All Types</option>
                <option value="request">Requests Only</option>
                <option value="response">Responses Only</option>
            </select>
            <select id="methodFilter">
                <option value="">All Methods</option>
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
            </select>
            <button onclick="filterEvents()">Filter</button>
            <button onclick="clearFilters()">Clear</button>
        </div>

        <div class="section">
            <h2>📡 All Network Events</h2>
            <div id="eventsContainer">
                ${this.networkEvents.map((event, idx) => {
                    const isRequest = event.type === 'request';
                    const itemClass = isRequest ? 'request-item' : 'response-item';
                    const typeLabel = isRequest ? 'REQUEST' : 'RESPONSE';
                    const typeClass = isRequest ? 'request-type' : 'response-type';
                    
                    // Extract parameters from POST data for display
                    let extractedEvents = [];
                    
                    if (event.postData) {
                        try {
                            // First try to split by spaces
                            let eventLines = event.postData.split(' ').filter(line => line.trim());
                            
                            // If we only get one line but it contains multiple events, try to split by 'en='
                            if (eventLines.length === 1 && eventLines[0].includes('en=')) {
                                const data = eventLines[0];
                                // Split by 'en=' to find each event start
                                const parts = data.split('en=');
                                eventLines = [];
                                
                                // Skip the first part (before first 'en=') and process each event
                                for (let i = 1; i < parts.length; i++) {
                                    let eventData = 'en=' + parts[i];
                                    // If this isn't the last part, we need to find where this event ends
                                    if (i < parts.length - 1) {
                                        // Find the next 'en=' to determine where this event ends
                                        const nextEventStart = parts[i + 1];
                                        // Find the last space before the next event
                                        const lastSpaceIndex = eventData.lastIndexOf(' ');
                                        if (lastSpaceIndex > 0) {
                                            eventData = eventData.substring(0, lastSpaceIndex);
                                        }
                                    }
                                    eventLines.push(eventData);
                                }
                            }
                            
                            eventLines.forEach((line, lineIndex) => {
                                const postParams = new URLSearchParams(line);
                                const eventName = postParams.get('en') || '';
                                const eventAction = postParams.get('ep.event_action') || '';
                                const eventLocation = postParams.get('ep.event_location') || '';
                                
                                // Check if this event was triggered by scrolling
                                let triggerAction = '';
                                const eventTimestamp = event.timestamp;
                                
                                // Find the closest scroll action that happened before this event
                                const relatedScroll = this.scrollEvents.find(scroll => {
                                    // Event should happen within 3 seconds after a scroll action
                                    const timeDiff = eventTimestamp - scroll.timestamp;
                                    return timeDiff >= 0 && timeDiff < 3000;
                                });
                                
                                if (relatedScroll) {
                                    triggerAction = `scroll (${relatedScroll.percentage}%)`;
                                }
                                
                                if (eventName || eventAction || eventLocation) {
                                    extractedEvents.push({
                                        line: lineIndex + 1,
                                        eventName,
                                        eventAction,
                                        eventLocation,
                                        triggerAction,
                                        rawData: line,
                                        scrollPercentage: relatedScroll ? relatedScroll.percentage : null
                                    });
                                }
                            });
                        } catch (e) {
                            console.log('⚠️  Error parsing POST data:', e.message);
                        }
                    }
                    
                    // If no POST data or no extracted events, try to extract from URL
                    if (extractedEvents.length === 0 && event.url.includes('google-analytics.com/g/collect')) {
                        try {
                            const url = new URL(event.url);
                            const eventName = url.searchParams.get('en') || '';
                            const eventAction = url.searchParams.get('ep.event_action') || '';
                            const eventLocation = url.searchParams.get('ep.event_location') || '';
                            
                            // Check if this event was triggered by scrolling
                            let triggerAction = '';
                            const eventTimestamp = event.timestamp;
                            
                            // Find the closest scroll action that happened before this event
                            const relatedScroll = this.scrollEvents.find(scroll => {
                                // Event should happen within 3 seconds after a scroll action
                                const timeDiff = eventTimestamp - scroll.timestamp;
                                return timeDiff >= 0 && timeDiff < 3000;
                            });
                            
                            if (relatedScroll) {
                                triggerAction = `scroll (${relatedScroll.percentage}%)`;
                            }

                            
                            if (eventName || eventAction || eventLocation) {
                                extractedEvents.push({
                                    line: 1,
                                    eventName,
                                    eventAction,
                                    eventLocation,
                                    triggerAction,
                                    rawData: event.url,
                                    source: 'URL',
                                    scrollPercentage: relatedScroll ? relatedScroll.percentage : null
                                });
                            }
                        } catch (e) {
                            console.log('⚠️  Error parsing URL parameters:', e.message);
                        }
                    }

                    // Get the first extracted event for the header display
                    const firstEvent = extractedEvents.length > 0 ? extractedEvents[0] : null;
                    
                    return `
                        <div class="event-item ${itemClass}" data-url="${event.url}" data-type="${event.type}" data-method="${event.method || ''}">
                            <div class="event-header">
                                <span class="event-type ${typeClass}">${typeLabel}</span>
                                ${firstEvent && firstEvent.triggerAction && firstEvent.triggerAction.includes('scroll') ? `<span style="background: #ff6b35; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.8em; margin-right: 8px;">scroll</span>` : ''}
                                ${firstEvent && firstEvent.eventName ? `<span class="event-name">${firstEvent.eventName}</span>` : ''}
                                <span class="event-time">${new Date(event.timestamp).toLocaleTimeString()}</span>
                            </div>
                            <div class="url">${event.url}</div>
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
                                    ${extractedEvents.map(evt => `
                                        <div style="margin: 10px 0; padding: 10px; background: #f0f8ff; border-radius: 5px; border-left: 3px solid #2196f3;">
                                            <strong>Event ${evt.line} (${evt.source || 'POST'}):</strong><br>
                                            ${evt.eventName ? `<div><strong>en:</strong> ${evt.eventName}</div>` : ''}
                                            ${evt.eventAction ? `<div><strong>event_action:</strong> ${evt.eventAction}</div>` : ''}
                                            ${evt.eventLocation ? `<div><strong>event_location:</strong> ${evt.eventLocation}</div>` : ''}
                                            ${evt.triggerAction ? `<div><strong>trigger_action:</strong> ${evt.triggerAction}</div>` : ''}
                                        </div>
                                    `).join('')}
                                ` : ''}
                                ${!event.postData && event.url.includes('google-analytics.com/g/collect') && extractedEvents.length === 0 ? `
                                    <br><strong>URL Parameters:</strong> ${event.url}
                                ` : ''}
                                ${event.requestUrl && event.requestUrl !== event.url ? `<br>Request URL: ${event.requestUrl}` : ''}
                            </div>
                            ${event.body && event.body !== '[Unable to read response body]' ? `
                                <div class="payload">
                                    <div class="payload-title">Response Body:</div>
                                    ${event.body}
                                </div>
                            ` : ''}
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    </div>

    <script>
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

if (!url) {
  console.log('Usage: node gtm-click-tracker.js <url> [--headless]');
  console.log('Example: node gtm-click-tracker.js https://www.example.com --headless');
  process.exit(1);
}

// Run the tracker
const tracker = new NetworkTracker({ url, headless });
tracker.run();