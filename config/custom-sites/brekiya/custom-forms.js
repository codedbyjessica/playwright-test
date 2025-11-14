/**
 * Form Testing Configuration for Brekiya
 * 
 * Domain-specific form configurations for brekiya.com
 * 
 * @author AI Assistant
 * @version 1.0
 */

const FORM_CONFIGS = {
  // Brekiya Autoinjector Story Form
  // this form is an iframe. nvm!!
  brekiya_story_form: {
    // Page and form identification
    page: '/#sign-up-popup',  // URL hash to match this form config
    formSelector: 'form',
    submitButtonSelector: 'input[type="submit"].hs-button',
    
    // Form fields configuration
    fields: {
      // Text field: First Name
      firstname: {
        type: 'text',
        selector: '#firstname-599748e5-a22a-42cd-8b40-d160d29b3ee2',
        testValues: {
          valid: 'John',
          invalid: '' // Empty for required field
        },
      },
      
      // Text field: Last Name
      lastname: {
        type: 'text',
        selector: '#lastname-599748e5-a22a-42cd-8b40-d160d29b3ee2',
        testValues: {
          valid: 'Doe',
          invalid: ''
        },
      },
      
      // Email field
      email: {
        type: 'email',
        selector: '#email-599748e5-a22a-42cd-8b40-d160d29b3ee2',
        testValues: {
          valid: 'john.doe@example.com',
          invalid: 'invalid-email'
        },
      },
      
      // Phone field
      phone: {
        type: 'tel',
        selector: '#phone-599748e5-a22a-42cd-8b40-d160d29b3ee2',
        testValues: {
          valid: '2123421342',
          invalid: '123' // Too short
        },
      },
      
      // Text field: Street Address (optional)
      address: {
        type: 'text',
        selector: '#address-599748e5-a22a-42cd-8b40-d160d29b3ee2',
        testValues: {
          valid: '123 Main Street'
        },
      },
      
      // Text field: City
      city: {
        type: 'text',
        selector: '#city-599748e5-a22a-42cd-8b40-d160d29b3ee2',
        testValues: {
          valid: 'New York',
          invalid: ''
        },
      },
      
      // Dropdown: State/Region
      state: {
        type: 'select',
        selector: '#state-599748e5-a22a-42cd-8b40-d160d29b3ee2',
        testValues: {
          valid: 'New York',
          invalid: '' // Empty selection
        },
      },
      
      // Text field: Postal Code
      zip: {
        type: 'text',
        selector: '#zip-599748e5-a22a-42cd-8b40-d160d29b3ee2',
        testValues: {
          valid: '10001',
          invalid: 'ABCDE' // Non-numeric
        },
      },
      
      // Dropdown: Best method to contact
      i_prefer_a_an: {
        type: 'select',
        selector: '#i_prefer_a_an-599748e5-a22a-42cd-8b40-d160d29b3ee2',
        testValues: {
          valid: 'Email',
          invalid: '' // Empty selection
        },
      },
      
      // Checkbox: Marketing opt-in consent
      marketo_opt_in: {
        type: 'checkbox',
        selector: '#marketo_opt_in-599748e5-a22a-42cd-8b40-d160d29b3ee2',
        testValues: {
          valid: true,
          invalid: false // Required to be checked
        },
      }
    },
    
    // Note: All timing configurations are in config/main.js → CONFIG.FORM
    // Form code is automatically derived from the object key (brekiya_story_form)
  }
};

module.exports = FORM_CONFIGS;

