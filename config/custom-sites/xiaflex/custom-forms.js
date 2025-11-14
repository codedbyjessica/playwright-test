/**
 * Form Testing Configuration for Xiaflex
 * 
 * Domain-specific form configurations for xiaflex.com
 * 
 * @author AI Assistant
 * @version 1.0
 */

const FORM_CONFIGS = {
  // Xiaflex Get Updates Form
  xiaflex_patient_get_updates: {
    // Page and form identification
    page: '/patient/resources/updates/',  // URL path to match this form config
    formSelector: 'form',
    submitButtonSelector: 'button[type="submit"].btn-primary',
    
    // Form fields configuration
    fields: {
      // Text field: First Name
      firstName: {
        type: 'text',
        selector: '#firstName',
        testValues: {
          valid: 'Chester',
          invalid: '' // Empty for required field
        },
      },
      
      // Text field: Last Name
      lastName: {
        type: 'text',
        selector: '#lastName',
        testValues: {
          valid: 'Tester',
          invalid: '' // Empty for required field
        },
      },
      
      // Email field
      emailAddress: {
        type: 'email',
        selector: '#emailAddress',
        testValues: {
          valid: 'chester.tester@test.com',
          invalid: 'invalid-email'
        },
      },
      
      // Radio button: I am (select one)
      iAm: {
        type: 'radio',
        selector: 'input[name="iAm"]',
        options: [
          "diagnosed with Peyronie's disease or seeking treatment info",
          "Currently being treated with XIAFLEX or am about to start treatment",
          "a partner of someone who may be living with Peyronie's disease"
        ],
        testValues: {
          valid: "Currently being treated with XIAFLEX or am about to start treatment",
          invalid: null // Will test empty selection
        },
      },
      
      // Conditional radio button: I am sub (only shows when iAm is "Currently being treated with XIAFLEX or am about to start treatment")
      iAmSub: {
        type: 'radio',
        selector: 'input[name="iAmSub"]',
        options: [
          "I am currently receiving treatment with XIAFLEX",
          "I am about to start treatment with XIAFLEX"
        ],
        testValues: {
          valid: "I am currently receiving treatment with XIAFLEX",
          invalid: null // Will test empty selection
        },
        conditional: {
          dependsOn: 'iAm',
          showWhen: "Currently being treated with XIAFLEX or am about to start treatment"
        }
      },
      
      // Checkbox group: Treatments (may select more than one)
      treatments: {
        type: 'checkbox',
        selector: 'input[name="treatments"]',
        options: [
          'Topical Creams',
          'Supplements',
          'Traction Devices',
          'Stretching Exercises',
          'Penile Implants',
          'XIAFLEX',
          'None',
          'Not Sure',
          'Other'
        ],
        testValues: {
          valid: ['Topical Creams', 'Stretching Exercises'], // At least one selection
          invalid: [] // Empty selection
        },
      },
      
      // Checkbox: Over 18 confirmation (required)
      over18: {
        type: 'checkbox',
        selector: '#over18',
        testValues: {
          valid:[ "Yes"],
          invalid: false // Required to be checked
        },
      }
    },
    
    // Note: All timing configurations are in config/main.js → CONFIG.FORM
    // Form code is automatically derived from the object key (xiaflex_patient_get_updates)
  },

  // Xiaflex HCP Request a Rep Form
  xiaflex_hcp_request_rep: {
    // Page and form identification
    page: '/hcp/resources-support/request-a-rep/',
    formSelector: 'form',
    submitButtonSelector: 'button.btn-primary',
    
    // Form fields configuration
    fields: {
      // Text field: First Name (required)
      firstName: {
        type: 'text',
        selector: '#firstName',
        testValues: {
          valid: 'Chester',
          invalid: '' // Empty for required field
        },
      },
      
      // Text field: Last Name (required)
      lastName: {
        type: 'text',
        selector: '#lastName',
        testValues: {
          valid: 'Tester',
          invalid: '' // Empty for required field
        },
      },
      
      // Select: Specialty (required) - Custom select component
      // specialty: {
      //   type: 'select',
      //   selector: '#specialty',
      //   testValues: {
      //     valid: 'Urologist',
      //     invalid: '' // Empty selection
      //   },
      // },
      
      // Text field: Practice Name (required)
      practiceName: {
        type: 'text',
        selector: '#practiceName',
        testValues: {
          valid: 'Test Medical Practice',
          invalid: '' // Empty for required field
        },
      },
      
      // Text field: Address 1 (required)
      address1: {
        type: 'text',
        selector: '#address1',
        testValues: {
          valid: '123 Medical Center Drive',
          invalid: '' // Empty for required field
        },
      },
      
      // Text field: Address 2 (optional)
      address2: {
        type: 'text',
        selector: '#address2',
        testValues: {
          valid: 'Suite 100'
        },
      },
      
      // Text field: City (required)
      city: {
        type: 'text',
        selector: '#city',
        testValues: {
          valid: 'New York',
          invalid: '' // Empty for required field
        },
      },
      
      // Select: State (required) - Custom select component
      // state: {
      //   type: 'select',
      //   selector: '#state',
      //   testValues: {
      //     valid: 'NY',
      //     invalid: '' // Empty selection
      //   },
      // },
      
      // Text field: ZIP Code (required)
      zipCode: {
        type: 'text',
        selector: '#zipCode',
        testValues: {
          valid: '10001',
          invalid: '' // Empty for required field
        },
      },
      
      // Email field (required)
      emailAddress: {
        type: 'email',
        selector: '#emailAddress',
        testValues: {
          valid: 'chester.tester@test.com',
          invalid: 'invalid-email'
        },
      },
      
      // Text field: Phone Number (optional)
      phoneNumber: {
        type: 'tel',
        selector: '#phoneNumber',
        testValues: {
          valid: '2125551234'
        },
      },
      
      // Checkbox: Have SSP Contact
      haveSSPContact: {
        type: 'checkbox',
        selector: '#haveSSPContact',
        testValues: {
          valid: true,
          invalid: false
        },
      },
      
      // Checkbox group: Interested in SSP (may select more than one)
      interestedInSSP: {
        type: 'checkbox',
        selector: 'input[name="interestedInSSP"]',
        options: [
          'Training and education about the REMS program',
          'Guidance from the XIAFLEX Prescribing Information',
          'Acquiring XIAFLEX and reimbursement',
          'Educational resources for both patients and office staff members'
        ],
        testValues: {
          valid: ['Training and education about the REMS program'],
          invalid: []
        },
      },
      
      // Checkbox: Have FRM Contact
      haveFRMContact: {
        type: 'checkbox',
        selector: '#haveFRMContact',
        testValues: {
          valid: true,
          invalid: false
        },
      },
      
      // Checkbox group: Interested in FRM (may select more than one)
      interestedInFRM: {
        type: 'checkbox',
        selector: 'input[name="interestedInFRM"]',
        options: [
          'Coverage and logistical questions',
          'Coding suggestions',
          'Product access options',
          'Patient access options',
          'Reimbursement questions'
        ],
        testValues: {
          valid: ['Coverage and logistical questions'],
          invalid: []
        },
      },
      
      // Checkbox: Receive Updates
      receiveUpdates: {
        type: 'checkbox',
        selector: '#receiveUpdates',
        testValues: {
          valid: true,
          invalid: false
        },
      }
    },
    
    // Note: All timing configurations are in config/main.js → CONFIG.FORM
    // Form code is automatically derived from the object key (xiaflex_hcp_request_rep)
  }
};

module.exports = FORM_CONFIGS;

