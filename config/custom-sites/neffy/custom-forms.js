/**
 * Form Testing Configuration
 * 
 * Optional configurations for specific forms. Forms are matched by URL path and selector.
 * If a form config is not provided, the tester will attempt to auto-detect forms on the page.
 * 
 * Required fields:
 * - page: URL path (or substring) to match the correct page (e.g., '/sign-up', '/contact')
 * - formSelector: CSS selector for the form
 * - submitButtonSelector: CSS selector for submit button
 * 
 * Optional but recommended:
 * - fields: Detailed field configuration for individual testing
 * - expectedErrors: Error selectors to validate error states
 * 
 * Note: Form code is automatically derived from the object key (e.g., 'neffy_consumer_signup')
 * 
 * @author AI Assistant
 * @version 1.0
 */

const FORM_CONFIGS = {
  // Example: Neffy Consumer Signup Form
  neffy_consumer_signup: {
    // Page and form identification
    page: '/sign-up',  // URL path (or substring) to match this form config to the correct page
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
          invalid: null // Will test empty selection
        },
      },
      
      // Conditional weight field (only shows for Caregiver)
      weight: {
        type: 'checkbox',
        selector: 'input[name="weight"]',
        options: ['33 lbs to less than 66 lbs', 'Greater than 66 lbs or more'],
        testValues: {
          valid: ['33 lbs to less than 66 lbs'],
          invalid: [] // Empty array for required field
        },
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
          valid: 'I have a neffy prescription',
          invalid: null
        },
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
          valid: ['Set up expiration reminders for neffy devices'],
          invalid: [] // Empty selection
        },
      },
      
      // Conditional device expiration fields (only show when reminder is checked)
      device_1_expiration_year: {
        type: 'select',
        selector: '#device_1_expiration_year',
        testValues: {
          valid: '2025',
          invalid: ''
        },
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
          invalid: ''
        },
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
          invalid: '' // Empty for required field
        },
      },
      
      last_name: {
        type: 'text',
        selector: '#last_name',
        testValues: {
          valid: 'Doe',
          invalid: ''
        },
      },
      
      email: {
        type: 'email',
        selector: '#email',
        testValues: {
          valid: 'john.doe@example.com',
          invalid: 'invalid-email'
        },
      },
      
      phone: {
        type: 'tel',
        selector: '#phone',
        testValues: {
          valid: '2123421342',
          invalid: '123' // Too short
        },
      },
      
      zip: {
        type: 'text',
        selector: '#zip',
        testValues: {
          valid: '12345',
          invalid: 'ABCDE' // Non-numeric
        },
      },
      
      // Checkbox: Consent
      consent: {
        type: 'checkbox',
        selector: '#consent',
        testValues: {
          valid: true,
          invalid: false // Required to be checked
        },
      }
    },
    
    // Note: All timing configurations are in config/main.js → CONFIG.FORM
    // Form code is automatically derived from the object key (neffy_consumer_signup)
  },

  // Example: Generic form (minimal config)
  // Uncomment and modify for additional forms on your site
  /*
  contact_form: {
    page: '/contact',  // URL path to match
    formSelector: '#contact-form',
    submitButtonSelector: 'button[type="submit"]',
    
    // Note: Form code is automatically derived from the object key (contact_form)
    
    // Optional: Add detailed field configs for individual field testing
    // fields: { ... }
  }
  */
};

module.exports = FORM_CONFIGS;
