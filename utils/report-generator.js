/**
 * Report Generator Utility
 * 
 * This utility handles all report generation functionality for the GA4 Click Event Tracker.
 * It generates HTML, CSV, and JSON reports from network and click event data.
 * 
 * @author AI Assistant
 * @version 1.0
 */

const path = require('path');
const fs = require('fs');
const CONFIG = require('../config/main');

class ReportGenerator {
  constructor() {
    // Configuration is now imported directly from config.js
  }

  // Helper function to generate parameter HTML from event data
  generateParameterHTML(event) {
    const params = Object.entries(CONFIG.GLOBAL.eventParams).map(([paramKey, possibleParamNames]) => {
      const value = event[paramKey];
      if (value !== undefined && value !== null && value !== '') {
        const displayName = paramKey.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        
        // Get the raw parameter name that was actually used
        const rawParamName = event[`_rawParam_${paramKey}`] || possibleParamNames[0];
        
        return `<div><strong>${displayName}:</strong> ${value} <span style="color: #888; font-size: 0.85em; font-family: monospace;">(${rawParamName})</span></div>`;
      }
      return '';
    }).join('');
    
    // Add raw data source section
    let rawDataHtml = '';
    if (event.source) {
      rawDataHtml = `
        <div style="margin-top: 10px; padding: 8px; background: #f5f5f5; border-radius: 4px; border-left: 3px solid #9e9e9e;">
          <div style="font-weight: bold; color: #666; margin-bottom: 4px;">📋 Raw Data Source (${event.source}):</div>
          <div style="font-family: monospace; font-size: 0.75em; color: #555; word-break: break-all; max-height: 150px; overflow-y: auto;">
            ${event.rawData || 'No raw data available'}
          </div>
        </div>
      `;
    }
    
    return params + rawDataHtml;
  }

  // Helper function to generate element info HTML
  generateElementInfoHTML(element) {
    const parts = [element.selector];
    if (element.id) parts.push(`(ID: ${element.id})`);
    if (element.className) parts.push(`(Classes: ${element.className})`);
    if (Object.keys(element.ariaAttributes || {}).length > 0) {
      parts.push(`(ARIA: ${Object.keys(element.ariaAttributes).join(', ')})`);
    }
    if (element.textContent) parts.push(`(Text: "${element.textContent}")`);
    
    return `<span style="background: #e3f2fd; color: #1976d2; padding: 4px 8px; border-radius: 4px; font-size: 0.7em; margin-right: 8px; font-family: monospace;">${parts.join(' ')}</span>`;
  }

  // Helper function to generate click details HTML
  generateClickDetailsHTML(click, showOrder = false, orderIndex = 0) {
    const ariaAttributesHTML = Object.keys(click.element.ariaAttributes || {}).length > 0 ? `
      <div class="click-info-section">
        <span class="click-info-label">ARIA Attributes:</span>
        <div class="click-info-value" style="max-height: 150px; overflow-y: auto;">
          ${Object.entries(click.element.ariaAttributes).map(([key, value]) => 
            `<div style="margin-bottom: 4px;"><strong>${key}:</strong> ${value}</div>`
          ).join('')}
        </div>
      </div>
    ` : '';

    // Generate screenshot HTML if available
    const screenshotHTML = click.screenshot ? `
      <div class="click-info-section">
        <span class="click-info-label">Element Screenshot:</span>
        <div class="click-info-value" style="margin-top: 8px;">
          <div class="screenshot-container" style="border: 2px solid #e0e0e0; border-radius: 8px; padding: 8px; background: #f9f9f9; display: inline-block; max-width: 100%;">
            <img src="data:image/png;base64,${click.screenshot.toString('base64')}" 
                 alt="Screenshot of clicked element" 
                 style="max-width: 300px; max-height: 200px; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); display: block; cursor: pointer;"
                 onclick="this.style.maxWidth = this.style.maxWidth === '300px' ? '100%' : '300px'; this.style.maxHeight = this.style.maxHeight === '200px' ? 'none' : '200px';">
             <div style="text-align: center; margin-top: 6px; font-size: 0.8em; color: #666;">
               📸 Element with Context (click to expand)
             </div>
          </div>
        </div>
      </div>
    ` : '';

    return `
      <div class="click-basic-info">
        ${showOrder ? `<div class="click-info-section"><span class="click-info-label">Click Order:</span><span class="click-info-value">${orderIndex + 1}</span></div>` : ''}
        ${screenshotHTML}
        <div class="click-info-section">
          <span class="click-info-label">Element:</span>
          <span class="click-info-value">${click.element.tagName}</span>
        </div>
        ${click.element.textContent ? `<div class="click-info-section"><span class="click-info-label">Text:</span><span class="click-info-value">"${click.element.textContent}"</span></div>` : ''}
        ${click.element.href ? `<div class="click-info-section"><span class="click-info-label">Href:</span><span class="click-info-value">${click.element.href}</span></div>` : ''}
        ${click.element.id ? `<div class="click-info-section"><span class="click-info-label">ID:</span><span class="click-info-value">${click.element.id}</span></div>` : ''}
        ${click.element.className ? `<div class="click-info-section"><span class="click-info-label">Classes:</span><span class="click-info-value">${click.element.className}</span></div>` : ''}
        ${ariaAttributesHTML}
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
          <span class="click-info-value">${click.success ? 'Successful' : 'Failed'}</span>
        </div>
      </div>
    `;
  }

  // Helper function to generate event HTML
  generateEventHTML(event, extractedEvents) {
    if (extractedEvents.length === 0) return '';
    
    const firstEvent = extractedEvents[0];
    const isPageview = firstEvent.eventName === 'page_view';
    
    const triggerBadge = firstEvent.triggerAction?.includes('click')
      ? `<span style="background: #4caf50; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.8em; margin-right: 8px;">click</span>`
      : '';
    
    const elementInfo = firstEvent.clickElement 
      ? this.generateElementInfoHTML(firstEvent.clickElement)
      : '';
    
    // Special handling for pageview events to show URL prominently
    const pageviewUrlBadge = isPageview && firstEvent.fullURL 
      ? `<span style="background: #e8f5e8; color: #2e7d32; padding: 4px 8px; border-radius: 4px; font-size: 0.8em; margin-right: 8px; font-family: monospace; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: inline-block;">${firstEvent.fullURL}</span>`
      : '';
    
    const eventDetails = extractedEvents.map(evt => {
      const parameterHtml = this.generateParameterHTML(evt);
      
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
          ${pageviewUrlBadge}
          ${elementInfo}
          <span class="event-time">${new Date(event.timestamp).toLocaleTimeString()}</span>
        </div>
        <div class="url">
          <div class="accordion-header" onclick="toggleAccordion(this)">
            <span class="accordion-icon">▶</span>
            <span class="url-preview">${event.url.length > CONFIG.GLOBAL.urlPreviewLength ? event.url.substring(0, CONFIG.GLOBAL.urlPreviewLength) + '...' : event.url}</span>
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
          ${!event.postData && CONFIG.GLOBAL.ga4Urls.some(ga4Url => event.url.includes(ga4Url)) && extractedEvents.length === 0 ? `
            <br><strong>URL Parameters:</strong> ${event.url}
          ` : ''}
          ${event.requestUrl && event.requestUrl !== event.url ? `<br>Request URL: ${event.requestUrl}` : ''}
        </div>
      </div>
    `;
  }

  // Helper function to generate events section HTML
  generateEventsSectionHTML(networkEvents, extractEventsFromNetworkData, filterEventsByType, eventType, title, icon) {
    // Filter out form testing events from main network analysis
    const nonFormNetworkEvents = networkEvents.filter(event => 
      event.type === 'request' && event.source !== 'form_testing'
    );
    
    // Special handling for pageview events
    if (eventType === 'pageview') {
      return this.generatePageviewEventsHTML(nonFormNetworkEvents, extractEventsFromNetworkData, filterEventsByType, title, icon);
    }
    
    // Check if this is the unmatched section (should be collapsed by default)
    const isCollapsed = eventType === 'unmatched';
    const displayStyle = isCollapsed ? 'display: none;' : '';
    const arrowIcon = isCollapsed ? '▶' : '▼';
    
    return `
      <div class="subsection">
        <h3 onclick="toggleAccordion(this)" style="cursor: pointer; user-select: none;">
          <span class="accordion-icon">${arrowIcon}</span> ${icon} ${title}
        </h3>
        <div class="accordion-content" style="${displayStyle}">
          <div id="${eventType}EventsContainer">
            ${nonFormNetworkEvents.map((event, idx) => {
              const extractedEvents = extractEventsFromNetworkData(event);
              const filteredEvents = filterEventsByType(extractedEvents, eventType);
              return filteredEvents.length > 0 ? this.generateEventHTML(event, filteredEvents) : '';
            }).join('')}
          </div>
        </div>
      </div>
    `;
  }

  // Specialized function for pageview events with prominent URL display
  generatePageviewEventsHTML(networkEvents, extractEventsFromNetworkData, filterEventsByType, title, icon) {
    const pageviewEvents = [];
    
    // networkEvents is already filtered to exclude form testing events
    networkEvents.forEach(event => {
      const extractedEvents = extractEventsFromNetworkData(event);
      const filteredEvents = filterEventsByType(extractedEvents, 'pageview');
      if (filteredEvents.length > 0) {
        pageviewEvents.push({ event, extractedEvents: filteredEvents });
      }
    });

    if (pageviewEvents.length === 0) {
      return `
        <div class="subsection">
          <h3>${icon} ${title}</h3>
          <div id="pageviewEventsContainer">
            <p>No pageview events found.</p>
          </div>
        </div>
      `;
    }

    const pageviewHtml = pageviewEvents.map(({ event, extractedEvents }, idx) => {
      const firstEvent = extractedEvents[0];
      const pageUrl = firstEvent.fullURL || 'URL not available';
      
      return `
        <div class="event-item pageview-item" style="background-color: #f8f9fa; border: 1px solid #dee2e6; border-radius: 8px; padding: 15px; margin-bottom: 15px;">
          <div class="pageview-header" style="display: flex; align-items: center; gap: 12px; margin-bottom: 10px; flex-wrap: wrap;">
            <span class="event-type" style="background: #28a745; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.8em;">PAGEVIEW</span>
            <span style="color: #666; font-size: 0.9em;">${new Date(event.timestamp).toLocaleTimeString()}</span>
          </div>
          
          <div class="pageview-url" style="margin-bottom: 10px;">
            <strong>Page URL:</strong> ${pageUrl}

          </div>
          
          ${extractedEvents.map(evt => {
            const parameterHtml = this.generateParameterHTML(evt);
            return `
              <div style="margin: 10px 0; padding: 10px; background: #f0f8ff; border-radius: 5px; border-left: 3px solid #2196f3;">
                <strong>Event ${evt.line} (${evt.source || 'POST'}):</strong><br>
                ${parameterHtml}
                ${evt.triggerAction ? `<div><strong>trigger_action:</strong> ${evt.triggerAction}</div>` : ''}
              </div>
            `;
          }).join('')}
          
          <div class="network-url" style="margin-top: 10px;">
            <div class="accordion-header" onclick="toggleAccordion(this)" style="cursor: pointer; padding: 8px 12px; background-color: #f0f0f0; border-radius: 4px; display: flex; align-items: center; justify-content: space-between; font-weight: bold; color: #333; font-size: 0.9em;">
              <span class="accordion-icon">▶</span>
              <span class="url-preview">Network Request URL</span>
            </div>
            <div class="accordion-content" style="display: none;">
              <div class="full-url" style="padding: 8px; background-color: #f8f9fa; border: 1px solid #e9ecef; border-radius: 4px; font-size: 0.8em; color: #555; margin-top: 4px; font-family: monospace; word-break: break-all;">${event.url}</div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="subsection">
        <h3 onclick="toggleAccordion(this)" style="cursor: pointer; user-select: none;">
          <span class="accordion-icon">▶</span> ${icon} ${title} (${pageviewEvents.length})
        </h3>
        <div class="accordion-content" style="display: none;">
          <div id="pageviewEventsContainer">
            ${pageviewHtml}
          </div>
        </div>
      </div>
    `;
  }

  // Helper function to generate scroll events HTML
  generateScrollEventsHTML(scrollEvents, extractEventsFromNetworkData) {
    const scrollsWithEvents = scrollEvents.filter(scroll => 
      scroll.matchedNetworkEvents && scroll.matchedNetworkEvents.length > 0
    );

    if (scrollsWithEvents.length === 0) {
      return '<p>No scroll actions triggered GA4 events.</p>';
    }

    return scrollsWithEvents
      .sort((a, b) => a.timestamp - b.timestamp)
      .map((scroll, idx) => {
        let eventDetailsHtml = '';
        
        scroll.matchedNetworkEvents.forEach((networkEvent, eventIdx) => {
          const extractedEvents = extractEventsFromNetworkData(networkEvent);
          
          if (extractedEvents.length > 0) {
            extractedEvents.forEach((evt, extractedEventIdx) => {
              const parameterHtml = this.generateParameterHTML(evt);
              
              eventDetailsHtml += `
                <div style="margin-top: 10px; padding: 10px; background: #e3f2fd; border-radius: 5px; border-left: 3px solid #2196f3;">
                  <strong>📊 GA4 Scroll Event ${eventIdx + 1}.${extractedEventIdx + 1}:</strong><br>
                  ${parameterHtml}
                  <div><strong>Time After Scroll:</strong> ${networkEvent.timestamp - scroll.timestamp}ms</div>
                  <div class="url" style="margin-top: 8px;">
                    <div class="accordion-header" onclick="toggleAccordion(this)" style="cursor: pointer; padding: 8px 12px; background-color: #f0f0f0; border-radius: 4px; display: flex; align-items: center; justify-content: space-between; font-weight: bold; color: #333; font-size: 0.9em;">
                      <span class="accordion-icon">▶</span>
                      <span class="url-preview">${networkEvent.url.length > CONFIG.GLOBAL.urlPreviewLength ? networkEvent.url.substring(0, CONFIG.GLOBAL.urlPreviewLength) + '...' : networkEvent.url}</span>
                    </div>
                    <div class="accordion-content" style="display: none;">
                      <div class="full-url" style="padding: 8px; background-color: #f8f9fa; border: 1px solid #e9ecef; border-radius: 4px; font-size: 0.8em; color: #555; margin-top: 4px; font-family: monospace; word-break: break-all;">${networkEvent.url}</div>
                    </div>
                  </div>
                </div>
              `;
            });
          } else {
            eventDetailsHtml += `
              <div style="margin-top: 10px; padding: 10px; background: #e3f2fd; border-radius: 5px; border-left: 3px solid #2196f3;">
                <strong>📊 GA4 Scroll Request ${eventIdx + 1}:</strong><br>
                <div><strong>Time After Scroll:</strong> ${networkEvent.timestamp - scroll.timestamp}ms</div>
                <div class="url" style="margin-top: 8px;">
                  <div class="accordion-header" onclick="toggleAccordion(this)" style="cursor: pointer; padding: 8px 12px; background-color: #f0f0f0; border-radius: 4px; display: flex; align-items: center; justify-content: space-between; font-weight: bold; color: #333; font-size: 0.9em;">
                    <span class="accordion-icon">▶</span>
                    <span class="url-preview">${networkEvent.url.length > CONFIG.GLOBAL.urlPreviewLength ? networkEvent.url.substring(0, CONFIG.GLOBAL.urlPreviewLength) + '...' : networkEvent.url}</span>
                  </div>
                  <div class="accordion-content" style="display: none;">
                    <div class="full-url" style="padding: 8px; background-color: #f8f9fa; border: 1px solid #e9ecef; border-radius: 4px; font-size: 0.8em; color: #555; margin-top: 4px; font-family: monospace; word-break: break-all;">${networkEvent.url}</div>
                  </div>
                </div>
              </div>
            `;
          }
        });

        const hasMatchingEvent = scroll.matchedNetworkEvents.length > 0;
        const statusBadge = hasMatchingEvent 
          ? `<span class="event-type" style="background: #4caf50; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.8em;">TRIGGERED GA4</span>`
          : `<span class="event-type" style="background: #ffc107; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.8em;">NO GA4</span>`;
        
        return `
          <div class="event-item" style="background: ${hasMatchingEvent ? '#f1f8e9' : '#fff3cd'}; border-left: 4px solid ${hasMatchingEvent ? '#4caf50' : '#ffc107'};">
            <div class="event-header">
              <span style="background: #2196f3; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.8em; margin-right: 8px;">#${idx + 1}</span>
              ${statusBadge}
              <span style="background: #4caf50; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.8em;">scroll</span>
              <span class="event-time">${new Date(scroll.timestamp).toLocaleTimeString()}</span>
            </div>
            <div class="click-details-container">
              <div class="click-basic-info">
                <div class="scroll-position-info" style="text-align: center; padding: 20px;">
                  <div style="font-size: 1.5em; font-weight: bold; color: #333; margin-bottom: 10px;">
                    ${scroll.percentage}%
                  </div>
                  <div style="font-size: 1.1em; color: #666;">
                    (${scroll.scrollY}px)
                  </div>
                </div>
              </div>
              <div class="click-detailed-info">
                ${eventDetailsHtml}
              </div>
            </div>
          </div>
        `;
      })
      .join('');
  }

  // Generate form testing HTML
  generateFormTestingHTML(formTestResults) {
    if (!formTestResults || (!formTestResults.fieldTests.length && !formTestResults.submissionTests.length)) {
      return '<p>No form testing results available.</p>';
    }

    const fieldTestsHTML = formTestResults.fieldTests.length > 0 ? `
      <div class="form-test-subsection">
        <h4>📝 Individual Field Tests (${formTestResults.fieldTests.length})</h4>
        ${formTestResults.fieldTests.map((test, idx) => {
          const statusBadge = test.result.success 
            ? `<span class="event-type" style="background: #4caf50; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.8em;">SUCCESS</span>`
            : `<span class="event-type" style="background: #ef5350; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.8em;">FAILED</span>`;

          const errorBadge = test.errorState.hasError
            ? `<span class="event-type" style="background: #ff9800; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.8em;">ERROR SHOWN</span>`
            : `<span class="event-type" style="background: #2196f3; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.8em;">NO ERROR</span>`;

          const networkEventsBadge = test.result.networkEvents && test.result.networkEvents.length > 0
            ? `<span class="event-type" style="background: #9c27b0; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.8em;">${test.result.networkEvents.length} GA4 EVENTS</span>`
            : '';

          return `
            <div class="event-item" style="background: ${test.result.success ? '#f1f8e9' : '#ffebee'}; border-left: 4px solid ${test.result.success ? '#4caf50' : '#ef5350'};">
              <div class="event-header">
                <span style="background: #2196f3; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.8em; margin-right: 8px;">#${idx + 1}</span>
                ${statusBadge}
                ${errorBadge}
                ${networkEventsBadge}
                <span style="background: #607d8b; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.8em;">${test.testType}</span>
                <span class="event-time">${new Date(test.timestamp).toLocaleTimeString()}</span>
              </div>
              <div class="click-details-container">
                <div class="click-basic-info">
                  <div class="click-info-section">
                    <span class="click-info-label">Field:</span>
                    <span class="click-info-value">${test.field}</span>
                  </div>
                  <div class="click-info-section">
                    <span class="click-info-label">Test Value:</span>
                    <span class="click-info-value">${JSON.stringify(test.result.value)}</span>
                  </div>
                  ${test.errorState.hasError ? `
                    <div class="click-info-section">
                      <span class="click-info-label">Error Message:</span>
                      <span class="click-info-value" style="color: #d32f2f;">${test.errorState.errorText}</span>
                    </div>
                  ` : ''}
                </div>
                <div class="click-detailed-info">
                  ${test.result.networkEvents && test.result.networkEvents.length > 0 ? 
                    test.result.networkEvents.map((evt, evtIdx) => {
                      const parameterHtml = this.generateParameterHTML(evt);
                      return `
                        <div style="margin-top: 10px; padding: 10px; background: #e8f5e8; border-radius: 5px; border-left: 3px solid #4caf50;">
                          <strong>📊 GA4 Event ${evtIdx + 1}:</strong><br>
                          <div><strong>Event Name:</strong> ${evt.eventName || 'unknown'}</div>
                          <div><strong>Time:</strong> ${new Date(evt.timestamp).toLocaleTimeString()}</div>
                          ${parameterHtml}
                          <div style="margin-top: 8px;">
                            <div class="accordion-header" onclick="toggleAccordion(this)" style="cursor: pointer; padding: 6px 8px; background-color: #f0f0f0; border-radius: 4px; display: flex; align-items: center; justify-content: space-between; font-size: 0.8em;">
                              <span class="accordion-icon">▶</span>
                              <span>Full URL</span>
                            </div>
                            <div class="accordion-content" style="display: none;">
                              <div style="padding: 6px; background-color: #f8f9fa; border: 1px solid #e9ecef; border-radius: 4px; font-size: 0.7em; color: #555; margin-top: 4px; font-family: monospace; word-break: break-all;">${evt.url}</div>
                            </div>
                          </div>
                        </div>
                      `;
                    }).join('') : 
                    '<div style="padding: 10px; color: #666;">No GA4 events triggered by this field interaction.</div>'
                  }
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    ` : '';

    const submissionTestsHTML = formTestResults.submissionTests.length > 0 ? `
      <div class="form-test-subsection">
        <h4>🚀 Form Submission Tests (${formTestResults.submissionTests.length})</h4>
        ${formTestResults.submissionTests.map((test, idx) => {
          let statusBadge = '';
          let statusColor = '';
          
          if (test.testType === 'valid_submission') {
            statusBadge = test.success 
              ? `<span class="event-type" style="background: #4caf50; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.8em;">SUCCESS</span>`
              : `<span class="event-type" style="background: #ef5350; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.8em;">FAILED</span>`;
            statusColor = test.success ? '#4caf50' : '#ef5350';
          } else {
            // Error testing scenarios
            const errorsFound = test.errorResults ? test.errorResults.filter(e => e.found).length : 0;
            const totalExpected = test.errorResults ? test.errorResults.length : 0;
            statusBadge = `<span class="event-type" style="background: #ff9800; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.8em;">${errorsFound}/${totalExpected} ERRORS</span>`;
            statusColor = errorsFound > 0 ? '#ff9800' : '#2196f3';
          }

          const networkEventsBadge = test.networkEvents && test.networkEvents.length > 0
            ? `<span class="event-type" style="background: #9c27b0; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.8em;">${test.networkEvents.length} GA4 EVENTS</span>`
            : '';

          return `
            <div class="event-item" style="background: #f8f9fa; border-left: 4px solid ${statusColor};">
              <div class="event-header">
                <span style="background: #2196f3; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.8em; margin-right: 8px;">#${idx + 1}</span>
                ${statusBadge}
                ${networkEventsBadge}
                <span style="background: #607d8b; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.8em;">${test.testType.replace('_', ' ').toUpperCase()}</span>
                <span class="event-time">${new Date(test.timestamp).toLocaleTimeString()}</span>
              </div>
              <div class="click-details-container">
                <div class="click-basic-info">
                  <div class="click-info-section">
                    <span class="click-info-label">Test Type:</span>
                    <span class="click-info-value">${test.testType.replace('_', ' ')}</span>
                  </div>
                  ${test.success !== undefined ? `
                    <div class="click-info-section">
                      <span class="click-info-label">Success:</span>
                      <span class="click-info-value" style="color: ${test.success ? '#4caf50' : '#ef5350'};">${test.success ? 'Yes' : 'No'}</span>
                    </div>
                  ` : ''}
                  ${test.errorResults ? `
                    <div class="click-info-section">
                      <span class="click-info-label">Validation Errors:</span>
                      <div class="click-info-value">
                        ${test.errorResults.map(error => `
                          <div style="margin: 4px 0; padding: 4px 8px; border-radius: 4px; background: ${error.found ? '#ffebee' : '#e8f5e8'}; color: ${error.found ? '#d32f2f' : '#2e7d32'};">
                            ${error.selector}: ${error.found ? '✓ Error shown' : '✗ No error'}
                            ${error.text ? ` - "${error.text}"` : ''}
                          </div>
                        `).join('')}
                      </div>
                    </div>
                  ` : ''}
                </div>
                <div class="click-detailed-info">
                  ${test.networkEvents && test.networkEvents.length > 0 ? 
                    test.networkEvents.map((evt, evtIdx) => {
                      const parameterHtml = this.generateParameterHTML(evt);
                      return `
                        <div style="margin-top: 10px; padding: 10px; background: #e8f5e8; border-radius: 5px; border-left: 3px solid #4caf50;">
                          <strong>📊 GA4 Event ${evtIdx + 1}:</strong><br>
                          <div><strong>Event Name:</strong> ${evt.eventName || 'unknown'}</div>
                          <div><strong>Time:</strong> ${new Date(evt.timestamp).toLocaleTimeString()}</div>
                          ${parameterHtml}
                          <div style="margin-top: 8px;">
                            <div class="accordion-header" onclick="toggleAccordion(this)" style="cursor: pointer; padding: 6px 8px; background-color: #f0f0f0; border-radius: 4px; display: flex; align-items: center; justify-content: space-between; font-size: 0.8em;">
                              <span class="accordion-icon">▶</span>
                              <span>Full URL</span>
                            </div>
                            <div class="accordion-content" style="display: none;">
                              <div style="padding: 6px; background-color: #f8f9fa; border: 1px solid #e9ecef; border-radius: 4px; font-size: 0.7em; color: #555; margin-top: 4px; font-family: monospace; word-break: break-all;">${evt.url}</div>
                            </div>
                          </div>
                        </div>
                      `;
                    }).join('') : 
                    '<div style="padding: 10px; color: #666;">No GA4 events triggered by this form submission.</div>'
                  }
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    ` : '';

    return `
      <div class="form-testing-section">
        ${fieldTestsHTML}
        ${submissionTestsHTML}
        
        <div class="form-test-subsection">
          <h4>📊 Form Testing Summary</h4>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-top: 15px;">
            <div style="background: white; padding: 15px; border-radius: 8px; border: 1px solid #e0e0e0; text-align: center;">
              <div style="font-size: 1.5em; font-weight: bold; color: #2196f3;">${formTestResults.summary.totalFieldTests}</div>
              <div style="color: #666; font-size: 0.9em;">Field Tests</div>
            </div>
            <div style="background: white; padding: 15px; border-radius: 8px; border: 1px solid #e0e0e0; text-align: center;">
              <div style="font-size: 1.5em; font-weight: bold; color: #4caf50;">${formTestResults.summary.totalSubmissionTests}</div>
              <div style="color: #666; font-size: 0.9em;">Submission Tests</div>
            </div>
            <div style="background: white; padding: 15px; border-radius: 8px; border: 1px solid #e0e0e0; text-align: center;">
              <div style="font-size: 1.5em; font-weight: bold; color: #9c27b0;">${formTestResults.summary.totalNetworkEvents}</div>
              <div style="color: #666; font-size: 0.9em;">GA4 Events</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Generate CSV report
  async generateCSVReport(testResultsDir, reportFilename, clickEvents, extractEventsFromNetworkData) {
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
    clickEvents
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
          const extractedEvents = extractEventsFromNetworkData(firstNetworkEvent);
          
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

  // Generate JSON report
  async generateJSONReport(testResultsDir, reportFilename, options, networkEvents, clickEvents, extractEventsFromNetworkData) {
    console.log('\n📊 === GENERATING JSON REPORT FOR ARD ANALYSIS ===');
    
    // Extract all network events with their parsed event data
    const networkEventsForAnalysis = [];
    
    networkEvents.filter(event => event.type === 'request').forEach((event, idx) => {
      const extractedEvents = extractEventsFromNetworkData(event);
      
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
        url: options.url,
        timestamp: new Date().toISOString(),
        totalNetworkEvents: networkEvents.length,
        totalExtractedEvents: networkEventsForAnalysis.length,
        totalClicks: clickEvents.length,
        successfulClicks: clickEvents.filter(click => click.success === true).length,
        failedClicks: clickEvents.filter(click => click.success === false).length
      },
      networkEvents: networkEventsForAnalysis,
      clickEvents: clickEvents.map(click => ({
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

  // Generate HTML report
  async generateHTMLReport(options, networkEvents, clickEvents, scrollEvents, extractEventsFromNetworkData, filterEventsByType, formTestResults = null) {
    console.log('\n📋 === NETWORK EVENTS REPORT ===');
    
    console.log(`🔍 REPORT DEBUG: Received ${networkEvents.length} network events`);
    console.log(`🔍 REPORT DEBUG: Event types in array:`, networkEvents.map(e => e.type));
    
    // Filter and categorize events (exclude form testing events from main analysis)
    const requests = networkEvents.filter(e => e.type === 'request' && e.source !== 'form_testing');
    const allRequests = networkEvents.filter(e => e.type === 'request');
    
    console.log(`Total network events: ${networkEvents.length}`);
    console.log(`Non-form requests: ${requests.length}`);
    console.log(`All requests (including form): ${allRequests.length}`);
    
    // Generate filename
    const siteUrl = new URL(options.url).hostname.replace(/\./g, '-');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const reportFilename = `network-events-${siteUrl}-${timestamp}`;
    
    // Create test-results folder
    const testResultsDir = 'test-results';
    if (!fs.existsSync(testResultsDir)) {
      fs.mkdirSync(testResultsDir, { recursive: true });
    }
    
    // Generate reports based on config
    const enabledReports = [];
    if (CONFIG.REPORT_GENERATION.html) enabledReports.push('HTML');
    if (CONFIG.REPORT_GENERATION.csv) enabledReports.push('CSV');
    if (CONFIG.REPORT_GENERATION.json) enabledReports.push('JSON');
    
    console.log(`\n📋 Generating ${enabledReports.join(', ')} report${enabledReports.length > 1 ? 's' : ''}...`);
    
    if (CONFIG.REPORT_GENERATION.csv) {
      await this.generateCSVReport(testResultsDir, reportFilename, clickEvents, extractEventsFromNetworkData);
    }

    if (CONFIG.REPORT_GENERATION.json) {
      await this.generateJSONReport(testResultsDir, reportFilename, options, networkEvents, clickEvents, extractEventsFromNetworkData);
    }

    if (CONFIG.REPORT_GENERATION.html) {
      const html = this.generateHTMLContent(options, requests, networkEvents, clickEvents, scrollEvents, extractEventsFromNetworkData, filterEventsByType, formTestResults);
      const htmlPath = path.join(testResultsDir, `${reportFilename}.html`);
      fs.writeFileSync(htmlPath, html);
      console.log(`\n🌐 HTML report saved to ${htmlPath}`);
    }
  }

  // Generate the main HTML content
  generateHTMLContent(options, requests, networkEvents, clickEvents, scrollEvents, extractEventsFromNetworkData, filterEventsByType, formTestResults = null) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GTM Comprehensive Tracker Report - ${options.url}</title>
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
            grid-template-columns: repeat(auto-fit, minmax(${CONFIG.GLOBAL.statCardMinWidth}px, 1fr)); 
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
            max-height: ${CONFIG.GLOBAL.maxPayloadHeight}px;
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
        .form-testing-section {
            margin-bottom: 30px;
        }
        .form-test-subsection {
            margin-bottom: 25px;
        }
        .form-test-subsection h4 {
            color: #333;
            margin-bottom: 15px;
            font-size: 1.2em;
            border-bottom: 1px solid #e0e0e0;
            padding-bottom: 8px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎯 GTM Comprehensive Tracker Report</h1>
            <h2><a href="${options.url}" target="_blank" style="color: #fff; text-decoration: underline;">${options.url}</a></h2>
            <p style="margin-top: 10px; opacity: 0.9;">Complete testing: Clicks, Scrolls, Forms & GA4 Analysis</p>
        </div>
        
        <div class="stats">
            <div class="stat-card">
                <div class="stat-number">${requests.length}</div>
                <div class="stat-label">Click/Scroll Requests</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${new Set(requests.map(e => e.url)).size}</div>
                <div class="stat-label">Unique URLs</div>
            </div>
            ${formTestResults && formTestResults.summary ? `
            <div class="stat-card">
                <div class="stat-number">${(formTestResults.summary.totalFieldTests || 0) + (formTestResults.summary.totalSubmissionTests || 0)}</div>
                <div class="stat-label">Form Tests</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${formTestResults.summary.totalNetworkEvents || 0}</div>
                <div class="stat-label">Form GA4 Events</div>
            </div>
            ` : ''}
        </div>


        <div class="section">
            <h2>🌐 Website Interaction Analysis</h2>
            
            ${this.generateEventsSectionHTML(networkEvents, extractEventsFromNetworkData, filterEventsByType, 'pageview', 'Pageview Events', '📄')}
            
            <!-- Scroll Actions with GA4 Events Section -->
            <div class="subsection">
                <h3>📊 Scroll Actions with GA4 Events (${scrollEvents ? scrollEvents.filter(scroll => scroll.matchedNetworkEvents && scroll.matchedNetworkEvents.length > 0).length : 0})</h3>
                <div id="scrollActionsContainer">
                    ${scrollEvents ? this.generateScrollEventsHTML(scrollEvents, extractEventsFromNetworkData) : '<p>No scroll events data available.</p>'}
                </div>
            </div>
            
            <!-- All Successful Click Events Section -->
            <div class="subsection">
                <h3>✅ All Successful Click Events (${clickEvents.filter(click => click.success === true).length})</h3>
                <p style="color: #666; margin-bottom: 15px; font-style: italic;">
                    Click events from automated element interaction testing (excludes form testing).
                </p>
                <div id="successfulClicksContainer">
                    ${clickEvents
                        .filter(click => click.success === true)
                        .sort((a, b) => a.timestamp - b.timestamp)
                        .map((click, idx) => {
                            // Check if this click triggered any GA4 events using the new direct matching
                            let hasMatchingEvent = false;
                            let matchingEventDetails = '';
                            
                            if (click.matchedNetworkEvents && click.matchedNetworkEvents.length > 0) {
                                click.matchedNetworkEvents.forEach((networkEvent, eventIdx) => {
                                    const extractedEvents = extractEventsFromNetworkData(networkEvent);
                                    
                                    extractedEvents.forEach((evt, extractedEventIdx) => {
                                        // Filter at the VERY last moment - skip excluded events
                                        const eventName = (evt.eventName || '').toLowerCase();
                                        const shouldExclude = CONFIG.CLICK.excludeKeywords.some(keyword => 
                                            eventName.includes(keyword.toLowerCase())
                                        );
                                        if (shouldExclude) {
                                            return; // Skip this event
                                        }
                                        
                                        hasMatchingEvent = true;
                                        const parameterHtml = this.generateParameterHTML(evt);
                                        
                                        matchingEventDetails += `
                                            <div style="margin-top: 10px; padding: 10px; background: #e8f5e8; border-radius: 5px; border-left: 3px solid #4caf50;">
                                                <strong>✅ GA4 Event ${eventIdx + 1}.${extractedEventIdx + 1} (Direct Match):</strong><br>
                                                ${parameterHtml}
                                                <div><strong>Time After Click:</strong> ${networkEvent.timestamp - click.timestamp}ms</div>
                                            </div>
                                        `;
                                    });
                                });
                            }
                            
                            const statusBadge = hasMatchingEvent 
                                ? `<span class="event-type" style="background: #4caf50; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.8em;">TRIGGERED GA4</span>`
                                : `<span class="event-type" style="background: #ffc107; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.8em;">NO GA4</span>`;
                            
                            
                            return `
                                <div class="event-item" style="background: ${hasMatchingEvent ? '#f1f8e9' : '#fff3cd'}; border-left: 4px solid ${hasMatchingEvent ? '#4caf50' : '#ffc107'};">
                                    <div class="event-header">
                                        <span style="background: #2196f3; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.8em; margin-right: 8px;">#${idx + 1}</span>
                                        ${statusBadge}
                                        <span style="background: #4caf50; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.8em;">click</span>
                                        ${this.generateElementInfoHTML(click.element)}
                                        <span class="event-time">${new Date(click.timestamp).toLocaleTimeString()}</span>
                                    </div>
                                    <div class="click-details-container">
                                        ${this.generateClickDetailsHTML(click)}
                                        <div class="click-detailed-info">
                                            ${matchingEventDetails}
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                </div>
            </div>


                    ${formTestResults && formTestResults.summary && (formTestResults.summary.totalFieldTests > 0 || formTestResults.summary.totalSubmissionTests > 0) ? `
            <div class="section">
                <h2>📝 Form Testing Results (Isolated)</h2>
                ${this.generateFormTestingHTML(formTestResults)}
            </div>
            ` : ''}

            ${this.generateEventsSectionHTML(networkEvents, extractEventsFromNetworkData, filterEventsByType, 'unmatched', 'Unmatched Network Events', '❓')}
            
            <!-- Unmatched Click Events Section -->
            <div class="subsection">
                <h3 onclick="toggleAccordion(this)" style="cursor: pointer; user-select: none;">
                    <span class="accordion-icon">▶</span> ❌ Failed Click Events
                </h3>
                <div class="accordion-content" style="display: none;">
                    <div id="unmatchedClicksContainer">
                    ${clickEvents
                        .filter(click => click.success === false)
                        .filter(failedClick => {
                            // Check if there's an identical successful click for this element
                            const hasIdenticalSuccessful = clickEvents.some(successfulClick => 
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
                                        ${this.generateElementInfoHTML(click.element)}
                                        <span class="event-time">${new Date(click.timestamp).toLocaleTimeString()}</span>
                                    </div>
                                    <div class="click-details-container">
                                        ${this.generateClickDetailsHTML(click, true, idx)}
                                        <div class="click-detailed-info">
                                            ${statusMessage}
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
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
  }
}

module.exports = ReportGenerator;
