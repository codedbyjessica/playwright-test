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
 * Note: Form code is automatically derived from the object key (e.g., 'everyday_cf_search')
 * 
 * @author AI Assistant
 * @version 1.0
 */

const FORM_CONFIGS = {
  // Everyday CF Search Form
  everyday_cf_search: {
    // Page and form identification
    page: '/',  // URL path (or substring) to match this form config to the correct page
    formSelector: '#views-exposed-form-acquia-search-page',
    submitButtonSelector: '.form-submit',
    
    // Form fields configuration
    fields: {
      // Text field: Search input
      search: {
        type: 'text',
        selector: '#edit-search',
        testValues: {
          valid: 'test search query',
          invalid: '' // Empty search query
        },
      },
    },
    
    // Note: All timing configurations are in config/main.js → CONFIG.FORM
    // Form code is automatically derived from the object key (everyday_cf_search)
  },
};

module.exports = FORM_CONFIGS;
  