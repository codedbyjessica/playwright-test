const fs = require('fs');
const path = require('path');

class ARDAnalyzer {
  constructor() {
    this.ardEntries = [];
    this.matchedEvents = [];
    this.unmatchedEvents = [];
  }

  // Load ARD.csv data
  loadARDData() {
    try {
      const ardContent = fs.readFileSync('ARD.csv', 'utf8');
      const lines = ardContent.split('\n').filter(line => line.trim());
      
      // Parse CSV (simple parsing for this use case)
      const headers = lines[0].split(',');
      
      for (let i = 1; i < lines.length; i++) {
        const values = this.parseCSVLine(lines[i]);
        if (values.length >= headers.length) {
          const entry = {};
          headers.forEach((header, index) => {
            entry[header.trim()] = values[index]?.trim() || '';
          });
          this.ardEntries.push(entry);
        }
      }
      
      console.log(`📋 Loaded ${this.ardEntries.length} ARD entries`);
      return true;
    } catch (error) {
      console.error('❌ Error loading ARD.csv:', error.message);
      return false;
    }
  }

  // Simple CSV line parser that handles quoted values
  parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    
    values.push(current);
    return values;
  }

  // Extract event parameters from network event data
  extractEventParams(postData) {
    const result = {};
    
    if (postData) {
      try {
        const postParams = new URLSearchParams(postData);
        
        // Extract common GA4 parameters
        result.eventName = postParams.get('en') || '';
        result.eventCategory = postParams.get('ep.event_category') || 
                              postParams.get('ep.Event_Category') || 
                              postParams.get('event_category') || 
                              postParams.get('Event_Category') || '';
        result.eventAction = postParams.get('ep.event_action') || 
                            postParams.get('ep.Event_Action') || 
                            postParams.get('event_action') || 
                            postParams.get('Event_Action') || '';
        result.eventLabel = postParams.get('ep.event_label') || 
                           postParams.get('ep.Event_Label') || 
                           postParams.get('event_label') || 
                           postParams.get('Event_Label') || '';
      } catch (e) {
        console.log('⚠️ Error parsing POST data:', e.message);
      }
    }
    
    return result;
  }

  // Parse events from network event data
  parseEventsFromData(data, eventTimestamp, source = 'POST', networkUrl = '') {
    const events = [];
    
    try {
      let eventLines = data.split(' ').filter(line => line.trim());
      
      // Handle multiple events in one line
      if (eventLines.length === 1 && eventLines[0].includes('en=')) {
        const parts = eventLines[0].split('en=');
        eventLines = [];
        
        for (let i = 1; i < parts.length; i++) {
          let eventData = 'en=' + parts[i];
          if (i < parts.length - 1) {
            const lastSpaceIndex = eventData.lastIndexOf(' ');
            if (lastSpaceIndex > 0) {
              eventData = eventData.substring(0, lastSpaceIndex);
            }
          }
          eventLines.push(eventData);
        }
      }
      
      eventLines.forEach((line, lineIndex) => {
        const params = this.extractEventParams(line);
        
        // Check if any parameter has a value
        const hasAnyValue = Object.values(params).some(value => value && value.trim() !== '');
        
        if (hasAnyValue) {
          events.push({
            line: lineIndex + 1,
            ...params,
            rawData: line,
            source,
            timestamp: eventTimestamp,
            url: networkUrl
          });
        }
      });
    } catch (e) {
      console.log('⚠️ Error parsing data:', e.message);
    }
    
    return events;
  }

  // Check if an event matches any ARD entry by event_category or event name
  findARDMatch(event) {
    const eventCategory = event.eventCategory?.toLowerCase().trim();
    const eventName = event.eventName?.toLowerCase().trim();
    
    // Find matching ARD entries
    const matches = this.ardEntries.filter(ardEntry => {
      const ardCategory = ardEntry.event_category?.toLowerCase().trim();
      
      // Match by event category if available
      if (ardCategory && eventCategory && eventCategory === ardCategory) {
        return true;
      }
      
      // Match by event name for built-in GA4 events
      if (eventName) {
        // Map common GA4 event names to ARD categories
        const eventNameMappings = {
          'file_download': 'Download',
          'scroll': 'Scroll Depth',
          'page_view': 'Page View',
          'click': 'CTA' // Generic click events might be CTAs
        };
        
        const mappedCategory = eventNameMappings[eventName];
        if (mappedCategory && mappedCategory.toLowerCase() === ardCategory) {
          return true;
        }
      }
      
      return false;
    });
    
    return matches.length > 0 ? matches : null;
  }

  // Analyze network events from GTM click tracker
  analyzeNetworkEvents() {
    // Look for test-results directory and find the most recent JSON report
    const testResultsDir = 'test-results';
    if (!fs.existsSync(testResultsDir)) {
      console.log('❌ No test-results directory found. Please run the GTM click tracker first.');
      return false;
    }

    // Find the most recent JSON report
    const files = fs.readdirSync(testResultsDir)
      .filter(file => file.endsWith('.json'))
      .sort()
      .reverse();

    if (files.length === 0) {
      console.log('❌ No JSON reports found in test-results directory.');
      console.log('   Please run the GTM click tracker first to generate network event data.');
      return false;
    }

    const latestReport = files[0];
    console.log(`📄 Analyzing latest JSON report: ${latestReport}`);

    try {
      const jsonPath = path.join(testResultsDir, latestReport);
      const jsonContent = fs.readFileSync(jsonPath, 'utf8');
      const reportData = JSON.parse(jsonContent);
      
      console.log(`📊 Found ${reportData.networkEvents.length} network events to analyze`);
      
      // Process each network event
      reportData.networkEvents.forEach(event => {
        const ardMatches = this.findARDMatch(event);
        
        if (ardMatches) {
          this.matchedEvents.push({
            ...event,
            ardMatches
          });
        } else {
          this.unmatchedEvents.push(event);
        }
      });
      
      console.log(`✅ Analysis complete: ${this.matchedEvents.length} matched, ${this.unmatchedEvents.length} unmatched`);
      return true;
      
    } catch (error) {
      console.error('❌ Error parsing JSON report:', error.message);
      return false;
    }
  }

  // Generate analysis report
  generateAnalysisReport() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const reportFilename = `ard-analysis-${timestamp}`;
    
    // Create test-results folder if it doesn't exist
    const testResultsDir = 'test-results';
    if (!fs.existsSync(testResultsDir)) {
      fs.mkdirSync(testResultsDir, { recursive: true });
    }

    // Generate HTML report
    const html = this.generateHTMLReport();
    const htmlPath = path.join(testResultsDir, `${reportFilename}.html`);
    fs.writeFileSync(htmlPath, html);
    
    // Generate CSV report
    const csvPath = path.join(testResultsDir, `${reportFilename}.csv`);
    this.generateCSVReport(csvPath);
    
    console.log(`📊 ARD Analysis report saved to ${htmlPath}`);
    console.log(`📊 ARD Analysis CSV saved to ${csvPath}`);
  }

  // Generate HTML report
  generateHTMLReport() {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ARD Analysis Report</title>
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
        .matched-event { border-left-color: #4caf50; }
        .unmatched-event { border-left-color: #ffc107; }
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
        .matched-badge { background: #4caf50; }
        .unmatched-badge { background: #ffc107; }
        .event-time { 
            color: #666; 
            font-size: 0.9em; 
        }
        .details { 
            margin-top: 10px; 
            font-size: 0.9em; 
            color: #666; 
        }
        .ard-match {
            background: #e8f5e8;
            border: 1px solid #4caf50;
            border-radius: 4px;
            padding: 10px;
            margin-top: 10px;
        }
        .ard-match h4 {
            color: #2e7d32;
            margin-bottom: 8px;
        }
        .ard-details {
            font-size: 0.9em;
            color: #333;
        }
        .no-match {
            background: #fff3cd;
            border: 1px solid #ffc107;
            border-radius: 4px;
            padding: 10px;
            margin-top: 10px;
        }
        .no-match h4 {
            color: #856404;
            margin-bottom: 8px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 ARD Analysis Report</h1>
            <p>Analysis of GTM Click Tracker Network Events against ARD.csv</p>
        </div>
        
        <div class="stats">
            <div class="stat-card">
                <div class="stat-number">${this.ardEntries.length}</div>
                <div class="stat-label">ARD Entries</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${this.matchedEvents.length}</div>
                <div class="stat-label">Matched Events</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${this.unmatchedEvents.length}</div>
                <div class="stat-label">Unmatched Events</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${this.matchedEvents.length + this.unmatchedEvents.length}</div>
                <div class="stat-label">Total Events</div>
            </div>
        </div>

        <div class="section">
            <h2>✅ Matched Events (${this.matchedEvents.length})</h2>
            ${this.matchedEvents.map(event => `
                <div class="event-item matched-event">
                    <div class="event-header">
                        <span class="event-type matched-badge">MATCHED</span>
                        <span class="event-time">${new Date(event.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div class="details">
                        <strong>Event Name:</strong> ${event.eventName || 'N/A'}<br>
                        <strong>Event Category:</strong> ${event.eventCategory || 'N/A'}<br>
                        <strong>Event Action:</strong> ${event.eventAction || 'N/A'}<br>
                        <strong>Event Label:</strong> ${event.eventLabel || 'N/A'}<br>
                        <strong>Source:</strong> ${event.source}<br>
                        <strong>URL:</strong> ${event.url}
                    </div>
                    ${event.ardMatches.map(match => `
                        <div class="ard-match">
                            <h4>✅ ARD Match: ${match.Name}</h4>
                            <div class="ard-details">
                                <strong>Category:</strong> ${match.event_category}<br>
                                <strong>Action:</strong> ${match.event_action}<br>
                                <strong>Label:</strong> ${match.event_label}<br>
                                <strong>Description:</strong> ${match.description}<br>
                                <strong>Note:</strong> ${match.Note}
                            </div>
                        </div>
                    `).join('')}
                </div>
            `).join('')}
        </div>

        <div class="section">
            <h2>🔍 Events by Source Analysis</h2>
            <p style="color: #666; margin-bottom: 20px;">This section shows how events are grouped by their source (which click/action triggered them) to help understand event relationships.</p>
            
            ${(() => {
                // Group matched events by their source (timestamp and URL to identify unique network requests)
                const eventGroups = {};
                this.matchedEvents.forEach(event => {
                    const sourceKey = `${event.timestamp}-${event.url}`;
                    if (!eventGroups[sourceKey]) {
                        eventGroups[sourceKey] = {
                            timestamp: event.timestamp,
                            url: event.url,
                            events: []
                        };
                    }
                    eventGroups[sourceKey].events.push(event);
                });
                
                const sortedGroups = Object.values(eventGroups).sort((a, b) => a.timestamp - b.timestamp);
                
                return sortedGroups.map((group, groupIdx) => `
                    <div style="background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 15px; margin-bottom: 15px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                            <strong style="color: #495057;">Source ${groupIdx + 1}</strong>
                            <span style="color: #666; font-size: 0.9em;">${new Date(group.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <div style="background: #e9ecef; padding: 8px; border-radius: 4px; margin-bottom: 10px; font-family: monospace; font-size: 0.8em; word-break: break-all;">
                            ${group.url}
                        </div>
                        <div style="display: grid; gap: 8px;">
                            ${group.events.map((event, eventIdx) => {
                                const ardMatchNames = event.ardMatches.map(match => match.Name).join(', ');
                                return `
                                    <div style="background: white; border: 1px solid #dee2e6; border-radius: 4px; padding: 10px;">
                                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                                            <strong>Event ${eventIdx + 1}</strong>
                                            <span style="background: #4caf50; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.8em;">ARD Match</span>
                                        </div>
                                        <div style="font-size: 0.9em; color: #666;">
                                            <strong>Name:</strong> ${event.eventName || 'N/A'} | 
                                            <strong>Category:</strong> ${event.eventCategory || 'N/A'} | 
                                            <strong>Action:</strong> ${event.eventAction || 'N/A'} | 
                                            <strong>Label:</strong> ${event.eventLabel || 'N/A'}
                                        </div>
                                        <div style="margin-top: 5px; font-size: 0.8em; color: #4caf50;">
                                            <strong>ARD Matches:</strong> ${ardMatchNames}
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                `).join('');
            })()}
        </div>

        <div class="section">
            <h2>❌ Unmatched Events (${this.unmatchedEvents.length})</h2>
            ${this.unmatchedEvents.map(event => `
                <div class="event-item unmatched-event">
                    <div class="event-header">
                        <span class="event-type unmatched-badge">UNMATCHED</span>
                        <span class="event-time">${new Date(event.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div class="details">
                        <strong>Event Name:</strong> ${event.eventName || 'N/A'}<br>
                        <strong>Event Category:</strong> ${event.eventCategory || 'N/A'}<br>
                        <strong>Event Action:</strong> ${event.eventAction || 'N/A'}<br>
                        <strong>Event Label:</strong> ${event.eventLabel || 'N/A'}<br>
                        <strong>Source:</strong> ${event.source}<br>
                        <strong>URL:</strong> ${event.url}
                    </div>
                    <div class="no-match">
                        <h4>⚠️ No ARD Match Found</h4>
                        <div class="ard-details">
                            This event category "${event.eventCategory || 'N/A'}" was not found in the ARD.csv file.
                            Consider adding this event category to the ARD if it should be tracked.
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>

        <div class="section">
            <h2>📋 ARD Entries Summary</h2>
            
            <!-- Summary Statistics -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px;">
                <div style="background: #e8f5e8; border: 1px solid #4caf50; border-radius: 8px; padding: 15px; text-align: center;">
                    <div style="font-size: 1.5em; font-weight: bold; color: #2e7d32;">
                        ${this.ardEntries.filter(entry => {
                            const matchingEvents = this.matchedEvents.filter(event => 
                                event.ardMatches.some(match => match.event_category === entry.event_category)
                            );
                            return matchingEvents.length > 0;
                        }).length}
                    </div>
                    <div style="color: #2e7d32; font-size: 0.9em;">ARD Entries Matched</div>
                </div>
                <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 15px; text-align: center;">
                    <div style="font-size: 1.5em; font-weight: bold; color: #856404;">
                        ${this.ardEntries.filter(entry => {
                            const matchingEvents = this.matchedEvents.filter(event => 
                                event.ardMatches.some(match => match.event_category === entry.event_category)
                            );
                            return matchingEvents.length === 0;
                        }).length}
                    </div>
                    <div style="color: #856404; font-size: 0.9em;">ARD Entries Unmatched</div>
                </div>
                <div style="background: #e3f2fd; border: 1px solid #2196f3; border-radius: 8px; padding: 15px; text-align: center;">
                    <div style="font-size: 1.5em; font-weight: bold; color: #1976d2;">
                        ${this.matchedEvents.length}
                    </div>
                    <div style="color: #1976d2; font-size: 0.9em;">Total Events Matched</div>
                </div>
                <div style="background: #fce4ec; border: 1px solid #e91e63; border-radius: 8px; padding: 15px; text-align: center;">
                    <div style="font-size: 1.5em; font-weight: bold; color: #c2185b;">
                        ${this.unmatchedEvents.length}
                    </div>
                    <div style="color: #c2185b; font-size: 0.9em;">Total Events Unmatched</div>
                </div>
            </div>
            
            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                    <thead>
                        <tr style="background: #f8f9fa;">
                            <th style="padding: 12px; text-align: left; border-bottom: 2px solid #dee2e6;">Status</th>
                            <th style="padding: 12px; text-align: left; border-bottom: 2px solid #dee2e6;">Name</th>
                            <th style="padding: 12px; text-align: left; border-bottom: 2px solid #dee2e6;">Event Category</th>
                            <th style="padding: 12px; text-align: left; border-bottom: 2px solid #dee2e6;">Event Action</th>
                            <th style="padding: 12px; text-align: left; border-bottom: 2px solid #dee2e6;">Event Label</th>
                            <th style="padding: 12px; text-align: left; border-bottom: 2px solid #dee2e6;">Description</th>
                            <th style="padding: 12px; text-align: left; border-bottom: 2px solid #dee2e6;">Match Count</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.ardEntries.map(entry => {
                            // Count how many events matched this ARD entry
                            const matchingEvents = this.matchedEvents.filter(event => 
                                event.ardMatches.some(match => match.event_category === entry.event_category)
                            );
                            const matchCount = matchingEvents.length;
                            const isMatched = matchCount > 0;
                            
                            // Get detailed event information for this ARD entry
                            const eventDetails = matchingEvents.map(event => ({
                                eventName: event.eventName,
                                eventAction: event.eventAction,
                                eventLabel: event.eventLabel,
                                timestamp: event.timestamp,
                                url: event.url
                            }));
                            
                            return `
                                <tr style="border-bottom: 1px solid #dee2e6; background-color: ${isMatched ? '#f8fff8' : '#fff8f8'};">
                                    <td style="padding: 12px; text-align: center;">
                                        ${isMatched 
                                            ? `<span style="color: #4caf50; font-size: 1.2em; font-weight: bold;">✅</span>` 
                                            : `<span style="color: #f44336; font-size: 1.2em; font-weight: bold;">❌</span>`
                                        }
                                    </td>
                                    <td style="padding: 12px;">${entry.Name}</td>
                                    <td style="padding: 12px;">${entry.event_category}</td>
                                    <td style="padding: 12px;">${entry.event_action}</td>
                                    <td style="padding: 12px;">${entry.event_label}</td>
                                    <td style="padding: 12px;">${entry.description}</td>
                                    <td style="padding: 12px; text-align: center;">
                                        ${isMatched 
                                            ? `<span style="background: #4caf50; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.8em; font-weight: bold;">${matchCount}</span>` 
                                            : `<span style="color: #999;">0</span>`
                                        }
                                    </td>
                                </tr>
                                ${isMatched ? `
                                    <tr style="background-color: #f0f8f0; border-bottom: 1px solid #dee2e6;">
                                        <td colspan="7" style="padding: 12px;">
                                            <div style="margin-left: 20px;">
                                                <strong>📊 Events Fired (${matchCount}):</strong>
                                                <div style="margin-top: 8px; display: grid; gap: 8px;">
                                                    ${eventDetails.map((detail, idx) => `
                                                        <div style="background: white; border: 1px solid #e0e0e0; border-radius: 4px; padding: 8px; font-size: 0.9em;">
                                                            <strong>Event ${idx + 1}:</strong> ${detail.eventName || 'N/A'} 
                                                            <span style="color: #666;">|</span> 
                                                            <strong>Action:</strong> ${detail.eventAction || 'N/A'}
                                                            <span style="color: #666;">|</span> 
                                                            <strong>Label:</strong> ${detail.eventLabel || 'N/A'}
                                                            <span style="color: #666;">|</span> 
                                                            <strong>Time:</strong> ${new Date(detail.timestamp).toLocaleTimeString()}
                                                        </div>
                                                    `).join('')}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ` : ''}
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</body>
</html>`;
  }

  // Generate CSV report
  generateCSVReport(csvPath) {
    const csvRows = [];
    
    // Add CSV header
    csvRows.push([
      'Event Name',
      'Event Category',
      'Event Action',
      'Event Label',
      'Source',
      'Timestamp',
      'URL',
      'ARD Match',
      'ARD Name',
      'ARD Description'
    ]);
    
    // Add matched events
    this.matchedEvents.forEach(event => {
      event.ardMatches.forEach(match => {
        csvRows.push([
          event.eventName || '',
          event.eventCategory || '',
          event.eventAction || '',
          event.eventLabel || '',
          event.source || '',
          new Date(event.timestamp).toISOString(),
          event.url || '',
          'YES',
          match.Name || '',
          match.description || ''
        ]);
      });
    });
    
    // Add unmatched events
    this.unmatchedEvents.forEach(event => {
      csvRows.push([
        event.eventName || '',
        event.eventCategory || '',
        event.eventAction || '',
        event.eventLabel || '',
        event.source || '',
        new Date(event.timestamp).toISOString(),
        event.url || '',
        'NO',
        '',
        ''
      ]);
    });
    
    // Write CSV file
    const csvContent = csvRows.map(row => 
      row.map(cell => {
        const cellStr = String(cell);
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
          return `"${cellStr.replace(/"/g, '""')}"`;
        }
        return cellStr;
      }).join(',')
    ).join('\n');
    
    fs.writeFileSync(csvPath, csvContent);
    console.log(`📊 CSV report saved to ${csvPath}`);
  }

  // Main analysis method
  async analyze() {
    console.log('🔍 Starting ARD Analysis...');
    
    // Load ARD data
    if (!this.loadARDData()) {
      return false;
    }
    
    // Analyze network events from GTM click tracker
    if (!this.analyzeNetworkEvents()) {
      console.log('⚠️ No network events found. Creating sample analysis for demonstration...');
      this.createSampleEvents();
    }
    
    // Generate reports
    this.generateAnalysisReport();
    
    return true;
  }

  // Create sample events for demonstration
  createSampleEvents() {
    // Sample matched events
    this.matchedEvents = [
      {
        eventName: 'click',
        eventCategory: 'Scroll Depth',
        eventAction: 'Reached 50%',
        eventLabel: 'Homepage',
        source: 'POST',
        timestamp: new Date().getTime(),
        url: 'https://www.google-analytics.com/g/collect',
        ardMatches: [this.ardEntries.find(entry => entry.event_category === 'Scroll Depth')]
      },
      {
        eventName: 'click',
        eventCategory: 'Header',
        eventAction: 'https://example.com/about',
        eventLabel: 'About Us',
        source: 'POST',
        timestamp: new Date().getTime() + 1000,
        url: 'https://www.google-analytics.com/g/collect',
        ardMatches: [this.ardEntries.find(entry => entry.event_category === 'Header')]
      }
    ];

    // Sample unmatched events
    this.unmatchedEvents = [
      {
        eventName: 'page_view',
        eventCategory: 'Custom Category',
        eventAction: 'Custom Action',
        eventLabel: 'Custom Label',
        source: 'POST',
        timestamp: new Date().getTime() + 2000,
        url: 'https://www.google-analytics.com/g/collect'
      }
    ];

    console.log(`📊 Created ${this.matchedEvents.length} sample matched events`);
    console.log(`📊 Created ${this.unmatchedEvents.length} sample unmatched events`);
  }
}

// Run the analysis
const analyzer = new ARDAnalyzer();
analyzer.analyze().then(success => {
  if (success) {
    console.log('✅ ARD Analysis completed successfully');
  } else {
    console.log('❌ ARD Analysis failed');
    process.exit(1);
  }
}); 