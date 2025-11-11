/**
 * ARD (Analytics Requirements Document) Comparator
 * 
 * Compares our test results against an ARD CSV file to identify:
 * - Missing events (in ARD but not found in test)
 * - Extra events (found in test but not in ARD)
 * - Matching events (properly implemented)
 * - Parameter mismatches (event found but parameters differ)
 * 
 * @author AI Assistant
 * @version 1.0
 */

const fs = require('fs');
const path = require('path');

class ARDComparator {
  constructor() {
    this.ardData = [];
    this.testData = [];
  }

  /**
   * Parse CSV file into array of objects
   */
  parseCSV(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n');
    
    if (lines.length === 0) {
      return [];
    }

    // Get headers from first line
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    
    // Parse data lines
    const data = [];
    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      if (values.length === headers.length) {
        const row = {};
        headers.forEach((header, idx) => {
          row[header] = values[idx];
        });
        data.push(row);
      }
    }
    
    return data;
  }

  /**
   * Parse a single CSV line handling quoted values with commas
   */
  parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    values.push(current.trim());
    return values;
  }

  /**
   * Load ARD CSV file
   */
  loadARD(ardPath) {
    console.log(`📋 Loading ARD from: ${ardPath}`);
    this.ardData = this.parseCSV(ardPath);
    console.log(`✅ Loaded ${this.ardData.length} ARD entries`);
    return this.ardData;
  }

  /**
   * Load our test CSV file
   */
  loadTestResults(testCSVPath) {
    console.log(`📊 Loading test results from: ${testCSVPath}`);
    this.testData = this.parseCSV(testCSVPath);
    console.log(`✅ Loaded ${this.testData.length} test events`);
    return this.testData;
  }

  /**
   * Normalize event name for comparison (case-insensitive, handle underscores/spaces)
   */
  normalizeEventName(name) {
    if (!name) return '';
    return name.toLowerCase().trim().replace(/[_\s]+/g, '_');
  }

  /**
   * Compare test results against ARD
   */
  compare() {
    const results = {
      matching: [],
      missing: [],
      extra: [],
      parameterMismatch: [],
      summary: {
        totalARDEvents: this.ardData.length,
        totalTestEvents: this.testData.length,
        matchingCount: 0,
        missingCount: 0,
        extraCount: 0,
        parameterMismatchCount: 0,
        coverage: 0
      }
    };

    // Create two maps of ARD events for quick lookup
    // Priority 1: Event name map
    const ardEventNameMap = new Map();
    // Priority 2: Event category map (fallback)
    const ardEventCategoryMap = new Map();
    
    this.ardData.forEach((ardEvent, ardIdx) => {
      // Map by Event Name (priority)
      const eventName = this.normalizeEventName(
        ardEvent['Event name'] || 
        ardEvent['Name'] || 
        ardEvent['Event Name'] || 
        ardEvent['event_name'] || 
        ardEvent.eventName
      );
      if (eventName) {
        if (!ardEventNameMap.has(eventName)) {
          ardEventNameMap.set(eventName, []);
        }
        ardEventNameMap.get(eventName).push({ ardEvent, ardIdx });
      }
      
      // Map by Event Category (fallback)
      const eventCategory = this.normalizeEventName(
        ardEvent['event_category'] || 
        ardEvent['Event Category'] ||
        ardEvent.eventCategory
      );
      if (eventCategory) {
        if (!ardEventCategoryMap.has(eventCategory)) {
          ardEventCategoryMap.set(eventCategory, []);
        }
        ardEventCategoryMap.get(eventCategory).push({ ardEvent, ardIdx });
      }
    });

    // Track which ARD events have been matched (by index)
    const matchedARDIndices = new Set();

    // Check each test event against ARD
    this.testData.forEach(testEvent => {
      // Extract test event identifiers
      const testEventName = this.normalizeEventName(
        testEvent['Event name'] ||  // New ARD-standard column (lowercase 'name')
        testEvent['Primary GA4 Event Name'] ||
        testEvent['Event Name'] || 
        testEvent['event_name'] || 
        testEvent.eventName
      );
      
      const testEventCategory = this.normalizeEventName(
        testEvent['Primary GA4 Event Category'] ||
        testEvent['Event Category'] ||
        testEvent['event_category'] ||
        testEvent.eventCategory
      );
      
      // Try matching by Event Name first (priority)
      let ardMatches = null;
      let matchKey = null;
      let matchType = null;
      
      if (testEventName) {
        ardMatches = ardEventNameMap.get(testEventName);
        if (ardMatches && ardMatches.length > 0) {
          matchKey = testEventName;
          matchType = 'event_name';
        }
      }
      
      // Fall back to Event Category if Event Name didn't match
      if (!ardMatches && testEventCategory) {
        ardMatches = ardEventCategoryMap.get(testEventCategory);
        if (ardMatches && ardMatches.length > 0) {
          matchKey = testEventCategory;
          matchType = 'event_category';
        }
      }
      
      // Skip if no identifier available
      if (!matchKey) return;
      
      if (ardMatches && ardMatches.length > 0) {
        // Found match - check if already matched
        const unmatchedARD = ardMatches.find(({ ardIdx }) => !matchedARDIndices.has(ardIdx));
        
        if (unmatchedARD) {
          matchedARDIndices.add(unmatchedARD.ardIdx);
          
          // Check if parameters match
          const parameterMatch = this.compareParameters(testEvent, unmatchedARD.ardEvent);
          
          if (parameterMatch.allMatch) {
            results.matching.push({
              eventName: matchKey,
              matchedBy: matchType,  // 'event_name' or 'event_category'
              testEvent,
              ardEvent: unmatchedARD.ardEvent,
              trigger: testEvent['Trigger Type'] || testEvent['Trigger Action'] || testEvent.trigger || 'Unknown'
            });
            results.summary.matchingCount++;
          } else {
            results.parameterMismatch.push({
              eventName: matchKey,
              matchedBy: matchType,
              testEvent,
              ardEvent: unmatchedARD.ardEvent,
              differences: parameterMatch.differences
            });
            results.summary.parameterMismatchCount++;
          }
        } else {
          // All ARD events of this type have been matched, this is an extra occurrence
          results.extra.push({
            eventName: matchKey,
            matchedBy: matchType,
            testEvent,
            reason: 'Additional occurrence beyond ARD specification'
          });
          results.summary.extraCount++;
        }
      } else {
        // Event not in ARD
        results.extra.push({
          eventName: testEventName || testEventCategory || 'Unknown',
          matchedBy: 'none',
          testEvent,
          reason: 'Not specified in ARD'
        });
        results.summary.extraCount++;
      }
    });

    // Check for missing ARD events
    this.ardData.forEach((ardEvent, ardIdx) => {
      if (!matchedARDIndices.has(ardIdx)) {
        const ardEventName = this.normalizeEventName(
          ardEvent['Event name'] ||
          ardEvent['Name'] ||
          ardEvent['Event Name'] || 
          ardEvent['event_name'] || 
          ardEvent.eventName
        );
        
        const ardEventCategory = this.normalizeEventName(
          ardEvent['event_category'] || 
          ardEvent['Event Category'] ||
          ardEvent.eventCategory
        );
        
        results.missing.push({
          eventName: ardEventName || ardEventCategory || 'Unknown',
          ardEvent,
          expectedTrigger: ardEvent['Trigger'] || ardEvent.trigger || 'Unknown'
        });
        results.summary.missingCount++;
      }
    });

    // Calculate coverage
    results.summary.coverage = results.summary.totalARDEvents > 0
      ? Math.round((results.summary.matchingCount / results.summary.totalARDEvents) * 100)
      : 0;

    return results;
  }

  /**
   * Compare parameters between test event and ARD event
   */
  compareParameters(testEvent, ardEvent) {
    const result = {
      allMatch: true,
      differences: []
    };

    // Common parameter fields to check (support multiple column name formats)
    const paramFields = [
      { 
        test: ['Primary GA4 Event Category', 'Event Category', 'event_category'], 
        ard: ['event_category', 'Event Category'] 
      },
      { 
        test: ['Primary GA4 Event Action', 'Event Action', 'event_action'], 
        ard: ['event_action', 'Event Action'] 
      },
      { 
        test: ['Primary GA4 Event Label', 'Event Label', 'event_label'], 
        ard: ['event_label', 'Event Label'] 
      },
      { 
        test: ['Link URL', 'link_url'], 
        ard: ['Link URL', 'link_url'] 
      },
      { 
        test: ['File Name', 'file_name'], 
        ard: ['File Name', 'file_name'] 
      }
    ];

    paramFields.forEach(({ test, ard }) => {
      // Find first matching column name from test event
      let testValue = '';
      let testColumnName = '';
      for (const col of test) {
        if (testEvent[col]) {
          testValue = (testEvent[col] || '').toLowerCase().trim();
          testColumnName = col;
          break;
        }
      }
      
      // Find first matching column name from ARD event
      let ardValue = '';
      for (const col of ard) {
        if (ardEvent[col]) {
          ardValue = (ardEvent[col] || '').toLowerCase().trim();
          break;
        }
      }
      
      // Only check if ARD specifies a value
      if (ardValue && testValue !== ardValue) {
        result.allMatch = false;
        result.differences.push({
          parameter: testColumnName || test[0],
          expected: ardValue,
          actual: testValue
        });
      }
    });

    return result;
  }

  /**
   * Generate comparison report HTML
   */
  generateHTMLReport(comparisonResults, siteUrl, testResultsPath = '', ardPath = '') {
    const siteName = new URL(siteUrl).hostname.replace(/^www\./, '');
    const timestamp = new Date().toLocaleString();
    const path = require('path');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ARD Comparison Report - ${siteName}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background: #f5f7fa; padding: 20px; }
        .container { max-width: 1400px; margin: 0 auto; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; margin-bottom: 30px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header h1 { font-size: 2em; margin-bottom: 10px; }
        .header p { opacity: 0.9; font-size: 1.1em; }
        .header .file-info { margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.3); }
        .header .file-info .label { font-size: 0.85em; opacity: 0.8; margin-bottom: 3px; }
        .header .file-info .value { font-family: monospace; font-size: 0.9em; word-break: break-all; }
        
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .summary-card { background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-align: center; }
        .summary-card .number { font-size: 2.5em; font-weight: bold; margin-bottom: 10px; }
        .summary-card .label { color: #666; font-size: 0.9em; text-transform: uppercase; letter-spacing: 1px; }
        .summary-card.matching .number { color: #4caf50; }
        .summary-card.missing .number { color: #f44336; }
        .summary-card.extra .number { color: #ff9800; }
        .summary-card.mismatch .number { color: #9c27b0; }
        .summary-card.coverage .number { color: #2196f3; }
        
        .section { background: white; padding: 30px; border-radius: 10px; margin-bottom: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .section h2 { margin-bottom: 20px; padding-bottom: 10px; border-bottom: 3px solid #667eea; font-size: 1.5em; cursor: pointer; user-select: none; }
        .section h2:hover { color: #667eea; }
        .section h2 .icon { margin-right: 10px; }
        .section h2 .count { float: right; background: #667eea; color: white; padding: 4px 12px; border-radius: 20px; font-size: 0.7em; }
        
        .event-item { background: #f8f9fa; border-left: 4px solid #667eea; padding: 15px; margin-bottom: 15px; border-radius: 5px; }
        .event-item.missing { border-left-color: #f44336; background: #ffebee; }
        .event-item.extra { border-left-color: #ff9800; background: #fff3e0; }
        .event-item.mismatch { border-left-color: #9c27b0; background: #f3e5f5; }
        
        .event-name { font-weight: bold; font-size: 1.1em; color: #333; margin-bottom: 10px; }
        .event-details { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 10px; margin-top: 10px; font-size: 0.9em; }
        .event-detail { padding: 8px; background: white; border-radius: 4px; }
        .event-detail strong { color: #666; display: block; margin-bottom: 4px; }
        
        .diff-table { width: 100%; margin-top: 10px; border-collapse: collapse; }
        .diff-table th { background: #f0f0f0; padding: 10px; text-align: left; font-weight: 600; }
        .diff-table td { padding: 10px; border-bottom: 1px solid #e0e0e0; }
        .diff-table tr:last-child td { border-bottom: none; }
        
        .accordion-icon { display: inline-block; transition: transform 0.3s; }
        .accordion-content { display: none; }
        .accordion-content.active { display: block; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 ARD Comparison Report</h1>
            <p>Site: ${siteUrl}</p>
            <p>Generated: ${timestamp}</p>
            ${testResultsPath || ardPath ? `
            <div class="file-info">
                ${testResultsPath ? `
                <div>
                    <div class="label">📊 Test Results File:</div>
                    <div class="value">${path.basename(testResultsPath)}</div>
                </div>
                ` : ''}
                ${ardPath ? `
                <div style="margin-top: 8px;">
                    <div class="label">📋 ARD Document:</div>
                    <div class="value">${path.basename(ardPath)}</div>
                </div>
                ` : ''}
            </div>
            ` : ''}
        </div>

        <div class="summary">
            <div class="summary-card coverage">
                <div class="number">${comparisonResults.summary.coverage}%</div>
                <div class="label">Coverage</div>
            </div>
            <div class="summary-card matching">
                <div class="number">${comparisonResults.summary.matchingCount}</div>
                <div class="label">Matching</div>
            </div>
            <div class="summary-card missing">
                <div class="number">${comparisonResults.summary.missingCount}</div>
                <div class="label">Missing</div>
            </div>
            <div class="summary-card extra">
                <div class="number">${comparisonResults.summary.extraCount}</div>
                <div class="label">Extra</div>
            </div>
            <div class="summary-card mismatch">
                <div class="number">${comparisonResults.summary.parameterMismatchCount}</div>
                <div class="label">Mismatches</div>
            </div>
        </div>

        ${this.generateMissingEventsSection(comparisonResults.missing)}
        ${this.generateParameterMismatchSection(comparisonResults.parameterMismatch)}
        ${this.generateExtraEventsSection(comparisonResults.extra)}
        ${this.generateMatchingEventsSection(comparisonResults.matching)}
    </div>

    <script>
        function toggleSection(header) {
            const content = header.nextElementSibling;
            const icon = header.querySelector('.accordion-icon');
            
            if (content.classList.contains('active')) {
                content.classList.remove('active');
                icon.textContent = '▶';
            } else {
                content.classList.add('active');
                icon.textContent = '▼';
            }
        }
    </script>
</body>
</html>`;
  }

  generateMissingEventsSection(missingEvents) {
    if (missingEvents.length === 0) {
      return '';
    }

    const eventsHTML = missingEvents.map(event => `
      <div class="event-item missing">
        <div class="event-name">❌ ${event.eventName}</div>
        <div class="event-details">
          <div class="event-detail">
            <strong>Expected Trigger:</strong>
            ${event.expectedTrigger}
          </div>
          <div class="event-detail">
            <strong>ARD Specification:</strong>
            ${JSON.stringify(event.ardEvent, null, 2).substring(0, 200)}...
          </div>
        </div>
      </div>
    `).join('');

    return `
      <div class="section">
        <h2 onclick="toggleSection(this)">
          <span class="accordion-icon">▼</span>
          <span class="icon">❌</span> Missing Events
          <span class="count">${missingEvents.length}</span>
        </h2>
        <div class="accordion-content active">
          ${eventsHTML}
        </div>
      </div>
    `;
  }

  generateParameterMismatchSection(mismatchEvents) {
    if (mismatchEvents.length === 0) {
      return '';
    }

    const eventsHTML = mismatchEvents.map(event => {
      const matchedByLabel = event.matchedBy === 'event_category' 
        ? '<span style="color: #ff9800; font-size: 0.85em;"> (matched by category)</span>' 
        : '';
      
      return `
      <div class="event-item mismatch">
        <div class="event-name">⚠️ ${event.eventName}${matchedByLabel}</div>
        <table class="diff-table">
          <thead>
            <tr>
              <th>Parameter</th>
              <th>Expected (ARD)</th>
              <th>Actual (Test)</th>
            </tr>
          </thead>
          <tbody>
            ${event.differences.map(diff => `
              <tr>
                <td><strong>${diff.parameter}</strong></td>
                <td>${diff.expected || '<em>not specified</em>'}</td>
                <td>${diff.actual || '<em>not found</em>'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
    }).join('');

    return `
      <div class="section">
        <h2 onclick="toggleSection(this)">
          <span class="accordion-icon">▼</span>
          <span class="icon">⚠️</span> Parameter Mismatches
          <span class="count">${mismatchEvents.length}</span>
        </h2>
        <div class="accordion-content active">
          ${eventsHTML}
        </div>
      </div>
    `;
  }

  generateExtraEventsSection(extraEvents) {
    if (extraEvents.length === 0) {
      return '';
    }

    const eventsHTML = extraEvents.map(event => `
      <div class="event-item extra">
        <div class="event-name">➕ ${event.eventName}</div>
        <div class="event-details">
          <div class="event-detail">
            <strong>Reason:</strong>
            ${event.reason}
          </div>
          <div class="event-detail">
            <strong>Trigger:</strong>
            ${event.testEvent['Trigger Action'] || event.testEvent.trigger || 'Unknown'}
          </div>
        </div>
      </div>
    `).join('');

    return `
      <div class="section">
        <h2 onclick="toggleSection(this)">
          <span class="accordion-icon">▶</span>
          <span class="icon">➕</span> Extra Events
          <span class="count">${extraEvents.length}</span>
        </h2>
        <div class="accordion-content">
          ${eventsHTML}
        </div>
      </div>
    `;
  }

  generateMatchingEventsSection(matchingEvents) {
    if (matchingEvents.length === 0) {
      return '';
    }

    const eventsHTML = matchingEvents.map(event => {
      const matchedByLabel = event.matchedBy === 'event_category' 
        ? '<span style="color: #ff9800; font-size: 0.85em;"> (matched by category)</span>' 
        : '';
      
      return `
      <div class="event-item">
        <div class="event-name">✅ ${event.eventName}${matchedByLabel}</div>
        <div class="event-details">
          <div class="event-detail">
            <strong>Trigger:</strong>
            ${event.trigger}
          </div>
        </div>
      </div>
    `;
    }).join('');

    return `
      <div class="section">
        <h2 onclick="toggleSection(this)">
          <span class="accordion-icon">▶</span>
          <span class="icon">✅</span> Matching Events
          <span class="count">${matchingEvents.length}</span>
        </h2>
        <div class="accordion-content">
          ${eventsHTML}
        </div>
      </div>
    `;
  }

  /**
   * Generate CSV report
   */
  generateCSVReport(comparisonResults) {
    const rows = [
      ['Status', 'Event Name', 'Expected Trigger', 'Actual Trigger', 'Issues'].join(',')
    ];

    // Missing events
    comparisonResults.missing.forEach(event => {
      rows.push([
        'MISSING',
        event.eventName,
        event.expectedTrigger,
        'N/A',
        'Event not found in test'
      ].map(v => `"${v}"`).join(','));
    });

    // Parameter mismatches
    comparisonResults.parameterMismatch.forEach(event => {
      const issues = event.differences.map(d => 
        `${d.parameter}: expected "${d.expected}", got "${d.actual}"`
      ).join('; ');
      
      rows.push([
        'MISMATCH',
        event.eventName,
        event.ardEvent.Trigger || 'Unknown',
        event.testEvent['Trigger Action'] || 'Unknown',
        issues
      ].map(v => `"${v}"`).join(','));
    });

    // Extra events
    comparisonResults.extra.forEach(event => {
      rows.push([
        'EXTRA',
        event.eventName,
        'N/A',
        event.testEvent['Trigger Action'] || 'Unknown',
        event.reason
      ].map(v => `"${v}"`).join(','));
    });

    // Matching events
    comparisonResults.matching.forEach(event => {
      rows.push([
        'MATCH',
        event.eventName,
        event.ardEvent.Trigger || 'Unknown',
        event.trigger,
        'Fully matching'
      ].map(v => `"${v}"`).join(','));
    });

    return rows.join('\n');
  }

  /**
   * Generate JSON report
   */
  generateJSONReport(comparisonResults) {
    return JSON.stringify(comparisonResults, null, 2);
  }
}

module.exports = ARDComparator;

