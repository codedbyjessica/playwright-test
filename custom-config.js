/**
 * Custom Form Testing Configuration
 * 
 * This file contains form configurations for automated testing scenarios.
 * Each form config defines the fields, validation rules, and test data
 * for comprehensive form testing including:
 * 1. Individual field filling and blurring
 * 2. Correct form submission
 * 3. Empty form submission (error testing)
 * 4. Incorrect data submission (validation testing)
 * 
 * @author AI Assistant
 * @version 1.0
 */

const FORM_CONFIGS = {
  // Neffy Consumer Signup Form Configuration
  neffy_consumer_signup: {
    // Form identification
    formSelector: 'form',
    submitButtonSelector: '#sign-up-form-submit',
    
    // Form fields configuration
    fields: {
      // Radio button: I am a
      i_am: {
        type: 'radio',
        selector: 'input[name="i_am"]',
        options: ['Patient', 'Caregiver'],
        testValues: {
          valid: 'Patient',
          invalid: null, // Will test empty selection
          alternative: 'Caregiver'
        },
        required: true
      },
      
      // Conditional weight field (only shows for Caregiver)
      weight: {
        type: 'checkbox',
        selector: 'input[name="weight"]',
        options: ['33 lbs to less than 66 lbs', 'Greater than 66 lbs or more'],
        testValues: {
          valid: ['33 lbs to less than 66 lbs'],
          invalid: [], // Empty array for required field
          alternative: ['Greater than 66 lbs or more']
        },
        required: true,
        conditional: {
          dependsOn: 'i_am',
          showWhen: 'Caregiver'
        }
      },
      
      // Radio button: Prescription status
      prescription: {
        type: 'radio',
        selector: 'input[name="prescription"]',
        options: [
          'I don\'t have an epinephrine prescription',
          'I have an epinephrine needle-injector prescription',
          'I have a neffy prescription'
        ],
        testValues: {
          valid: 'I don\'t have an epinephrine prescription',
          invalid: null,
          alternative: 'I have a neffy prescription'
        },
        required: true
      },
      
      // Checkbox: Subscription options
      subscription: {
        type: 'checkbox',
        selector: 'input[name="subscription"]',
        options: [
          'Get news and updates about neffy',
          'Join neffyconnect for savings, support, and resources',
          'Set up expiration reminders for neffy devices'
        ],
        testValues: {
          valid: ['Get news and updates about neffy'],
          invalid: [], // Empty selection
          alternative: ['Join neffyconnect for savings, support, and resources']
        },
        required: true
      },
      
      // Conditional device expiration fields (only show when reminder is checked)
      device_1_expiration_year: {
        type: 'select',
        selector: '#device_1_expiration_year',
        testValues: {
          valid: '2025',
          invalid: '',
          alternative: '2026'
        },
        required: false,
        conditional: {
          dependsOn: 'subscription',
          showWhen: 'Set up expiration reminders for neffy devices'
        }
      },
      
      device_1_expiration_month: {
        type: 'select',
        selector: '#device_1_expiration_month',
        testValues: {
          valid: '6',
          invalid: '',
          alternative: '12'
        },
        required: false,
        conditional: {
          dependsOn: 'subscription',
          showWhen: 'Set up expiration reminders for neffy devices'
        }
      },
      
      // Text fields: Personal information
      first_name: {
        type: 'text',
        selector: '#first_name',
        testValues: {
          valid: 'John',
          invalid: '', // Empty for required field
          alternative: 'Jane',
          tooLong: 'A'.repeat(51) // Exceeds maxLength="50"
        },
        required: true
      },
      
      last_name: {
        type: 'text',
        selector: '#last_name',
        testValues: {
          valid: 'Doe',
          invalid: '',
          alternative: 'Smith',
          tooLong: 'B'.repeat(51)
        },
        required: true
      },
      
      email: {
        type: 'email',
        selector: '#email',
        testValues: {
          valid: 'john.doe@example.com',
          invalid: 'invalid-email',
          alternative: 'jane.smith@test.com',
          empty: ''
        },
        required: true
      },
      
      phone: {
        type: 'tel',
        selector: '#phone',
        testValues: {
          valid: '2123421342',
          invalid: '123', // Too short
          alternative: '2123421342',
          empty: ''
        },
        required: true
      },
      
      zip: {
        type: 'text',
        selector: '#zip',
        testValues: {
          valid: '12345',
          invalid: 'ABCDE', // Non-numeric
          alternative: '54321',
          empty: '',
          tooLong: '123456' // Exceeds maxLength="5"
        },
        required: true
      },
      
      // Checkbox: Consent
      consent: {
        type: 'checkbox',
        selector: '#consent',
        testValues: {
          valid: true,
          invalid: false // Required to be checked
        },
        required: true
      }
    },
    
    // Test scenarios configuration
    testScenarios: {
      // Scenario 1: Individual field testing
      individualFields: {
        enabled: true,
        description: 'Fill each field individually and blur to test field-level validation'
      },
      
      // Scenario 2: Valid form submission
      validSubmission: {
        enabled: true,
        description: 'Fill form with valid data and submit successfully',
        waitForSuccess: true,
        successIndicators: [
          '.confirmation-hero-image', // Success page element
          'text=Confirmation' // Success text
        ]
      },
      
      // Scenario 3: Empty form submission
      emptySubmission: {
        enabled: true,
        description: 'Submit empty form to trigger required field errors',
        expectedErrors: [
          '#error-i_am',
          '#error-prescription', 
          '#error-subscription',
          '#error-first_name',
          '#error-last_name',
          '#error-email',
          '#error-phone',
          '#error-zip',
          '#error-consent'
        ]
      },
      
      // Scenario 4: Invalid data submission
      invalidSubmission: {
        enabled: true,
        description: 'Submit form with invalid data to test validation',
        expectedErrors: [
          '#error-email', // Invalid email format
          '#error-phone', // Invalid phone format
          '#error-zip'    // Invalid zip format
        ]
      }
    },
    
    // GTM tracking configuration
    tracking: {
      formCode: 'form_neffy_consumer_signup',
      expectedEvents: [
        'form_start',
        'form_field_completion',
        'form_submission',
        'form_error'
      ],
      trackFieldCompletion: true,
      trackFieldErrors: true
    },
    
    // Timing configuration
    timing: {
      fieldFillDelay: 8000,   // 8 second delay between filling fields (for GA4 events)
      blurDelay: 1000,        // 1 second delay after blur event
      submitDelay: 2000,      // 2 second delay before submit
      errorCheckDelay: 3000,  // 3 second delay to check for errors after submit
      successCheckDelay: 4000 // 4 second delay to check for success after submit
    }
  }
};

module.exports = FORM_CONFIGS;

