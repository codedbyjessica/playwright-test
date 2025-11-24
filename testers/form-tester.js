/**
 * Form Testing Utility
 * 
 * This utility provides comprehensive form testing capabilities including:
 * 1. Individual field testing with blur events
 * 2. Valid form submission testing
 * 3. Empty form submission error testing
 * 4. Invalid data submission validation testing
 * 
 * Integrates with the existing GTM click tracker system for network event monitoring.
 * 
 * @author AI Assistant
 * @version 1.0
 */

const CONFIG = require('../config/main');
const NetworkHandler = require('../utils/network-handler');
const CustomActionsExecutor = require('../utils/custom-actions');
const { log } = require('../utils/logger');

class FormTester {
  constructor(page, networkEvents, formConfig, clickEvents = [], afterRefreshAction = null) {
    this.page = page;
    this.networkEvents = networkEvents;
    this.config = formConfig;
    this.clickEvents = clickEvents;
    this.afterRefreshAction = afterRefreshAction;
    this.testResults = [];
    this.fieldTestResults = [];
  }
  


  /**
   * Fill a form field based on its type and configuration
   */
  async fillField(fieldName, fieldConfig, value, shouldBlur = true) {
    try {
      const actionStartTime = Date.now();
      log(`🎯 Starting field action for "${fieldName}" at ${new Date(actionStartTime).toLocaleTimeString()}`);
      
      // Focus the field first for all input types
      await this.page.focus(fieldConfig.selector);
      await this.page.waitForTimeout(200); // Small delay after focus
      
      switch (fieldConfig.type) {
        case 'text':
        case 'email':
        case 'tel':
          // Clear the field first, then fill
          await this.page.fill(fieldConfig.selector, '');
          await this.page.fill(fieldConfig.selector, value || '');
          break;
          
        case 'radio':
          if (value) {
            await this.page.check(`${fieldConfig.selector}[value="${value}"]`);
          }
          break;
          
        case 'checkbox':
          if (fieldName === 'consent') {
            // Single checkbox
            if (value) {
              await this.page.check(fieldConfig.selector);
            }
            // Don't uncheck - just leave unchecked if value is false
          } else {
            // Multiple checkboxes (like subscription, weight)
            if (Array.isArray(value)) {
              // Just check selected options (don't uncheck first)
              for (const selectedValue of value) {
                await this.page.check(`${fieldConfig.selector}[value="${selectedValue}"]`);
              }
            }
          }
          break;
          
        case 'select':
          await this.page.selectOption(fieldConfig.selector, value || '');
          break;
      }
      
      // Blur the field if requested
      if (shouldBlur) {
        log(`🔄 Blurring field "${fieldName}"`);
        // Blur by clicking on the body or pressing Tab to unfocus
        try {
          await this.page.keyboard.press('Tab'); // This will blur the current field
        } catch (error) {
          // Fallback: click on body to blur
          await this.page.click('body');
        }
        await this.page.waitForTimeout(CONFIG.FORM.blurDelay);
      }
      
      // Wait 8 seconds for GA4 events to fire
      log(`⏳ Waiting ${CONFIG.FORM.eventDelay} seconds for GA4 events after "${fieldName}" interaction...`);
      await this.page.waitForTimeout(CONFIG.FORM.eventDelay);
      
      const actionEndTime = Date.now();
      log(`🏁 Field action for "${fieldName}" completed at ${new Date(actionEndTime).toLocaleTimeString()}`);
      
      // Find events that occurred during this action window (action start to action end + buffer)
      const matchedEvents = this.networkEvents.filter(event => 
        event.timestamp >= actionStartTime && event.timestamp <= actionEndTime + 1000 // 1s buffer
      );
      
      log(`Filled field "${fieldName}" with value: ${JSON.stringify(value)}`);
      log(`   Captured ${matchedEvents.length} events for this field action`);
      
      return {
        success: true,
        field: fieldName,
        value: value,
        networkEvents: matchedEvents
      };
      
    } catch (error) {
      log(`Error filling field "${fieldName}": ${error.message}`, 'error');
      return {
        success: false,
        field: fieldName,
        value: value,
        error: error.message
      };
    }
  }

  /**
   * Check if field shows error state
   */
  async checkFieldError(fieldName) {
    try {
      const errorSelector = `#error-${fieldName}`;
      const errorElement = await this.page.$(errorSelector);
      const hasError = errorElement !== null;
      
      if (hasError) {
        const errorText = await errorElement.textContent();
        return { hasError: true, errorText: errorText.trim() };
      }
      
      return { hasError: false, errorText: null };
    } catch (error) {
      return { hasError: false, errorText: null, error: error.message };
    }
  }

  /**
   * Test individual fields - fill each field and blur to test validation
   */
  async testIndividualFields() {
    if (!CONFIG.FORM_TEST_SCENARIOS.individualFields) {
      log('Individual field testing is disabled');
      return;
    }
    
    if (!this.config.fields || Object.keys(this.config.fields).length === 0) {
      log('⏭️  Individual field testing skipped - no fields configured');
      return;
    }
    
    const totalFields = Object.keys(this.config.fields).length;
    log(`📝 Starting individual field testing... Found ${totalFields} form fields configured`);
    
    let fieldsProcessed = 0;
    let fieldsSkipped = 0;
    let fieldsTested = 0;
    let fieldsWithErrors = 0;
    
    for (const [fieldName, fieldConfig] of Object.entries(this.config.fields)) {
      fieldsProcessed++;
      
      // Skip conditional fields that aren't currently visible
      if (fieldConfig.conditional) {
        const isVisible = await this.isConditionalFieldVisible(fieldConfig);
        if (!isVisible) {
          fieldsSkipped++;
          log(`⏭️  Skipping conditional field "${fieldName}" - not currently visible (${fieldsProcessed}/${totalFields})`);
          continue;
        }
      }
      
      fieldsTested++;
      log(`🧪 Testing field "${fieldName}" (${fieldsTested}/${totalFields - fieldsSkipped})`);
      
      // Test with valid value
      const validResult = await this.fillField(fieldName, fieldConfig, fieldConfig.testValues.valid);
      await this.page.waitForTimeout(CONFIG.FORM.fieldFillDelay);
      
      // Check for errors after valid input
      const errorCheck = await this.checkFieldError(fieldName);
      if (errorCheck.hasError) {
        fieldsWithErrors++;
        log(`⚠️  Field "${fieldName}" shows error: ${errorCheck.errorText}`);
      }
      
      this.fieldTestResults.push({
        field: fieldName,
        testType: 'valid_input',
        result: validResult,
        errorState: errorCheck,
        timestamp: Date.now()
      });

    }
    
    log(`✅ Individual field testing completed:`);
    log(`   📊 Total fields configured: ${totalFields}`);
    log(`   ⏭️  Fields skipped (conditional): ${fieldsSkipped}`);
    log(`   🧪 Fields tested: ${fieldsTested}`);
    log(`   ⚠️  Fields with errors: ${fieldsWithErrors}`);
    log(`   📝 Total interactions recorded: ${this.fieldTestResults.length}`);
  }

  /**
   * Check if a conditional field should be visible
   */
  async isConditionalFieldVisible(fieldConfig) {
    if (!fieldConfig.conditional) return true;
    
    const { dependsOn, showWhen } = fieldConfig.conditional;
    const dependentField = this.config.fields[dependsOn];
    
    try {
      if (dependentField.type === 'radio') {
        const checkedRadio = await this.page.$(`${dependentField.selector}:checked`);
        if (checkedRadio) {
          const value = await checkedRadio.getAttribute('value');
          return value === showWhen;
        }
      } else if (dependentField.type === 'checkbox') {
        const checkedBox = await this.page.$(`${dependentField.selector}[value="${showWhen}"]:checked`);
        return checkedBox !== null;
      }
    } catch (error) {
      log(`Error checking conditional field visibility: ${error.message}`, 'error');
    }
    
    return false;
  }

  /**
   * Fill form with valid data and submit
   */
  async testValidSubmission() {
    if (!CONFIG.FORM_TEST_SCENARIOS.validSubmission) {
      log('Valid submission testing is disabled');
      return;
    }
    
    log('🚀 Starting valid form submission test...');
    
    // Fill fields if configured
    if (this.config.fields && Object.keys(this.config.fields).length > 0) {
      const fieldsToFill = Object.entries(this.config.fields).filter(([_, config]) => config.testValues?.valid !== undefined);
      log(`📝 Filling ${fieldsToFill.length} fields with valid data...`);
      
      // Fill all fields with valid data (fast, no delays)
      let fieldsFilled = 0;
      for (const [fieldName, fieldConfig] of fieldsToFill) {
        // Check if conditional field should be filled
        if (fieldConfig.conditional) {
          const isVisible = await this.isConditionalFieldVisible(fieldConfig);
          if (!isVisible) continue;
        }
        
        await this.fastFillField(fieldName, fieldConfig, fieldConfig.testValues.valid);
        fieldsFilled++;
        log(`   ✅ Filled field "${fieldName}" (${fieldsFilled}/${fieldsToFill.length})`);
      }
    } else {
      log('ℹ️  No fields configured - submitting form without pre-filling');
    }
    
    await this.page.waitForTimeout(CONFIG.FORM.submitDelay);

    // Submit the form immediately and capture the submit timestamp
    log('🚀 Submitting form with valid data...');
    console.log("submit button selector", this.config.submitButtonSelector);
    
    // Capture timestamp RIGHT BEFORE clicking submit
    const submitTime = Date.now();
    await this.page.click(this.config.submitButtonSelector);
    
    // Wait for network events immediately after submission (during the 20s wait period)
    log('⏳ Waiting for GA4 events after form submission...');
    const networkEvents = await NetworkHandler.waitForFormNetworkEvents({
      page: this.page,
      startTime: submitTime,
      networkEvents: this.networkEvents,
      clickEvents: this.clickEvents,
      timeout: CONFIG.FORM.eventDelay,
      actionInfo: {
        action: 'form_submit',
        type: 'valid_submission'
      }
    });
    
    log('✅ Form submitted successfully');
    log(`📡 Captured ${networkEvents.length} events for valid submission`);
    
    this.testResults.push({
      testType: 'valid_submission',
      success: true,
      networkEvents: networkEvents,
      timestamp: submitTime
    });
    
    log(`✅ Valid submission test completed`);
  }

  /**
   * Submit empty form to test required field validation
   */
  async testEmptySubmission() {
    if (!CONFIG.FORM_TEST_SCENARIOS.emptySubmission) {
      log('Empty submission testing is disabled');
      return;
    }
    
    log('🧪 Starting empty form submission test...');
    
    // Form is already fresh/empty from page refresh, no need to clear
    log('📝 Form is already empty (fresh page)');
    
    // Submit empty form immediately and capture the submit timestamp
    log('🚀 Submitting empty form to trigger validation errors...');
    
    // Capture timestamp RIGHT BEFORE clicking submit
    const submitTime = Date.now();
    await this.page.click(this.config.submitButtonSelector);
    log('✅ Empty form submitted');
    
    // Wait for network events (only those AFTER submit)
    log('⏳ Waiting for GA4 events after empty form submission...');
    const networkEvents = await NetworkHandler.waitForFormNetworkEvents({
      page: this.page,
      startTime: submitTime,
      networkEvents: this.networkEvents,
      clickEvents: this.clickEvents,
      timeout: CONFIG.FORM.eventDelay,
      actionInfo: {
        action: 'form_submit',
        type: 'empty_submission'
      }
    });
    
    log(`📡 Captured ${networkEvents.length} events for empty submission`);
    
    this.testResults.push({
      testType: 'empty_submission',
      success: true,
      networkEvents: networkEvents,
      timestamp: submitTime
    });
    
    log(`✅ Empty submission test completed`);
  }

  /**
   * Submit form with invalid data to test validation
   */
  async testInvalidSubmission() {
    if (!CONFIG.FORM_TEST_SCENARIOS.invalidSubmission) {
      log('Invalid submission testing is disabled');
      return;
    }
    
    log('🧪 Starting invalid data submission test...');
    
    // Fill form with invalid data if configured
    if (this.config.fields && Object.keys(this.config.fields).length > 0) {
      const invalidFields = Object.entries(this.config.fields).filter(([_, config]) => config.testValues?.invalid !== undefined);
      
      if (invalidFields.length > 0) {
        log(`📝 Filling ${invalidFields.length} fields with invalid data...`);
        
        let fieldsFilled = 0;
        for (const [fieldName, fieldConfig] of invalidFields) {
          await this.fastFillField(fieldName, fieldConfig, fieldConfig.testValues.invalid);
          fieldsFilled++;
          log(`   ❌ Filled field "${fieldName}" with invalid data (${fieldsFilled}/${invalidFields.length})`);
        }
      } else {
        log('⏭️  No fields with invalid test values configured - skipping invalid submission test');
        return;
      }
    } else {
      log('⏭️  No fields configured - skipping invalid submission test');
      return;
    }

    await this.page.waitForTimeout(CONFIG.FORM.submitDelay);
    
    // Submit the form immediately and capture the submit timestamp
    log('🚀 Submitting form with invalid data...');
    
    // Capture timestamp RIGHT BEFORE clicking submit
    const submitTime = Date.now();
    await this.page.click(this.config.submitButtonSelector);
    
    log('✅ Form submitted with invalid data');
    
    // Wait for network events (only those AFTER submit)
    log('⏳ Waiting for GA4 events after invalid form submission...');
    const networkEvents = await NetworkHandler.waitForFormNetworkEvents({
      page: this.page,
      startTime: submitTime,
      networkEvents: this.networkEvents,
      clickEvents: this.clickEvents,
      timeout: CONFIG.FORM.eventDelay,
      actionInfo: {
        action: 'form_submit',
        type: 'invalid_submission'
      }
    });
    
    log(`📡 Captured ${networkEvents.length} events for invalid submission`);
    
    this.testResults.push({
      testType: 'invalid_submission',
      success: true,
      networkEvents: networkEvents,
      timestamp: submitTime
    });
    
    log(`✅ Invalid submission test completed`);
  }

  /**
   * Clear all form fields
   */
  async clearAllFields() {
    for (const [fieldName, fieldConfig] of Object.entries(this.config.fields)) {
      try {
        switch (fieldConfig.type) {
          case 'text':
          case 'email':
          case 'tel':
            await this.page.fill(fieldConfig.selector, '');
            break;
            
          case 'radio':
            // Uncheck all radio buttons in the group
            for (const option of fieldConfig.options) {
              await this.page.uncheck(`${fieldConfig.selector}[value="${option}"]`);
            }
            break;
            
          case 'checkbox':
            if (fieldName === 'consent') {
              await this.page.uncheck(fieldConfig.selector);
            } else {
              for (const option of fieldConfig.options) {
                await this.page.uncheck(`${fieldConfig.selector}[value="${option}"]`);
              }
            }
            break;
            
          case 'select':
            await this.page.selectOption(fieldConfig.selector, '');
            break;
        }
      } catch (error) {
        // Continue with other fields if one fails
        log(`Warning: Could not clear field "${fieldName}": ${error.message}`);
      }
    }
  }

  /**
   * Run all enabled test scenarios
   */
  /**
   * Refresh page and prepare for new phase
   */
  async refreshForNewPhase(phaseName) {
    log(`🔄 Refreshing page for ${phaseName}...`);
    await this.page.reload({ waitUntil: 'domcontentloaded' });
    await this.page.waitForTimeout(2000); // Wait for page to stabilize
    
    // Execute pre-test actions after reload (e.g., close popups)
    if (this.afterRefreshAction) {
      await CustomActionsExecutor.execute(this.page, this.afterRefreshAction);
    }
    
    // Check if form still exists after refresh
    const formExists = await this.page.$(this.config.formSelector);
    if (!formExists) {
      throw new Error(`Form not found after refresh: ${this.config.formSelector}`);
    }
  }

  /**
   * Fast fill field without delays (for phases 2-4)
   */
  async fastFillField(fieldName, fieldConfig, value) {
    try {
      // Check if field exists first (without timeout)
      const fieldExists = await this.page.$(fieldConfig.selector);
      if (!fieldExists) {
        log(`⏭️  Field "${fieldName}" not found, skipping...`);
        return { success: false, error: 'Field not found', skipped: true };
      }
      
      // Focus the field first with short timeout
      await this.page.focus(fieldConfig.selector, { timeout: CONFIG.FORM.timeout });
      
      switch (fieldConfig.type) {
        case 'text':
        case 'email':
        case 'tel':
          await this.page.fill(fieldConfig.selector, value || '');
          break;
          
        case 'radio':
          if (value) {
            await this.page.check(`${fieldConfig.selector}[value="${value}"]`);
          }
          break;
          
        case 'checkbox':
          if (fieldName === 'consent') {
            if (value) {
              await this.page.check(fieldConfig.selector);
            }
          } else {
            if (Array.isArray(value)) {
              for (const selectedValue of value) {
                await this.page.check(`${fieldConfig.selector}[value="${selectedValue}"]`);
              }
            }
          }
          break;
          
        case 'select':
          await this.page.selectOption(fieldConfig.selector, value || '');
          break;
      }
      
      return { success: true };
      
    } catch (error) {
      log(`❌ Error fast-filling field "${fieldName}": ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  }

  /**
   * Capture all network events that occur during testing for debug purposes
   */
  captureAllNetworkEventsForDebug(testType, startTime, endTime = null) {
    const actualEndTime = endTime || Date.now();
    
    // Get all events that occurred during this test window
    const eventsInWindow = this.networkEvents.filter(event => 
      event.timestamp >= startTime && event.timestamp <= actualEndTime
    );
    
    // Add all events to debug array (not just matched ones)
    eventsInWindow.forEach(event => {
      // Check if we already added this event
      const alreadyAdded = this.allCapturedEvents.find(e => 
        e.timestamp === event.timestamp && e.url === event.url
      );
      
      if (!alreadyAdded) {
        this.allCapturedEvents.push({
          source: `ALL_EVENTS_${testType}`,
          url: event.url,
          eventName: event.eventName || 'unknown',
          timestamp: event.timestamp,
          actionStart: startTime,
          actionEnd: actualEndTime
        });
      }
    });
    
    log(`🔍 DEBUG: Captured ${eventsInWindow.length} total events during ${testType} (${new Date(startTime).toLocaleTimeString()} - ${new Date(actualEndTime).toLocaleTimeString()})`);
  }

  async runAllTests() {
    log('🚀 Starting comprehensive form testing...');
    const overallStartTime = Date.now();
    
    try {
      // Test 1: Individual field testing (use current page state)
      log('\n📝 === PHASE 1: INDIVIDUAL FIELD TESTING ===');
      await this.testIndividualFields();
      
      // Test 2: Valid submission (fresh page)
      await this.refreshForNewPhase('PHASE 2: VALID FORM SUBMISSION');
      log('\n🚀 === PHASE 2: VALID FORM SUBMISSION ===');
      await this.testValidSubmission();
      
      // Test 3: Empty submission (fresh page)
      await this.refreshForNewPhase('PHASE 3: EMPTY FORM SUBMISSION');
      log('\n🧪 === PHASE 3: EMPTY FORM SUBMISSION ===');
      await this.testEmptySubmission();
      
      // Test 4: Invalid submission (fresh page)
      await this.refreshForNewPhase('PHASE 4: INVALID DATA SUBMISSION');
      log('\n🧪 === PHASE 4: INVALID DATA SUBMISSION ===');
      await this.testInvalidSubmission();
      
      const totalTime = Date.now() - overallStartTime;
      log(`\n🎉 All form tests completed in ${totalTime}ms`);
      
      // Generate summary
      this.generateTestSummary();
      
    } catch (error) {
      log(`❌ Error during form testing: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Generate and log test summary
   */
  generateTestSummary() {
    console.log('\n📊 === FORM TESTING SUMMARY ===');
    console.log(`Individual field tests: ${this.fieldTestResults.length}`);
    console.log(`Form submission tests: ${this.testResults.length}`);
    
    // Network events summary
    const totalNetworkEvents = this.testResults.reduce((sum, test) => 
      sum + (test.networkEvents ? test.networkEvents.length : 0), 0
    );
    console.log(`Total network events captured: ${totalNetworkEvents}`);
    
    // Test results breakdown
    this.testResults.forEach(test => {
      console.log(`\n📋 ${test.testType}:`);
      if (test.success !== undefined) {
        console.log(`  Success: ${test.success}`);
      }
      if (test.errorResults) {
        const errorsFound = test.errorResults.filter(e => e.found).length;
        console.log(`  Errors found: ${errorsFound}/${test.errorResults.length}`);
      }
      if (test.networkEvents) {
        console.log(`  Network events: ${test.networkEvents.length}`);
      }
    });
  }

  /**
   * Get test results for reporting
   */
  getResults() {
    return {
      fieldTests: this.fieldTestResults,
      submissionTests: this.testResults,
      summary: {
        totalFieldTests: this.fieldTestResults.length,
        totalSubmissionTests: this.testResults.length,
        totalNetworkEvents: this.testResults.reduce((sum, test) => 
          sum + (test.networkEvents ? test.networkEvents.length : 0), 0
        )
      }
    };
  }
}

module.exports = FormTester;
