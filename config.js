// Configuration constants for the McLemore Payment Form

const CONFIG = {
  // Element IDs
  ELEMENT_IDS: {
    // Login Form
    LOGIN_FORM: 'login-form',
    LOGIN_ERROR: 'login-error',
    ERROR_MESSAGE: 'error-message',
    USERNAME_INPUT: 'username',
    PASSWORD_INPUT: 'password',
    LOGIN_BUTTON: 'login-button',

    // Step 1: Staff Form (Generate Link)
    STAFF_FORM_STEP: 'step-1',
    LOGOUT_BUTTON: 'logout-button',
    AUCTION_CODE_INPUT: 'auctionCode',
    SELLER_ID_INPUT: 'sellerId',
    RETRIEVE_STATEMENT_BUTTON: 'retrieveStatement', // Also used for Generate Payment Form button after reset

    // Step 2: Seller Payment Form
    PAYMENT_FORM_STEP: 'step-2',
    PAYMENT_FORM: 'paymentForm', // Form element itself
    FORM_AUCTION_CODE_HIDDEN: 'form-auctionCode',
    FORM_SELLER_ID_HIDDEN: 'form-sellerId',
    SELLER_NAME_DISPLAY: 'seller-name',
    AUCTION_TITLE_DISPLAY: 'auction-title',
    STATEMENT_DATE_DISPLAY: 'statement-date',
    TOTAL_DUE_DISPLAY: 'total-due',

    // Payment Options
    OPTION_CHECK_RADIO: 'option-check',
    CHECK_UPLOAD_SECTION: 'check-upload-section',
    CHECK_IMAGE_INPUT: 'checkImage',
    OPTION_MANUAL_RADIO: 'option-manual',
    MANUAL_ENTRY_SECTION: 'manual-entry-section',
    ENTITY_NAME_INPUT: 'entityName',
    ROUTING_NUMBER_INPUT: 'routingNumber',
    ACCOUNT_NUMBER_INPUT: 'accountNumber',
    ACCOUNT_TYPE_SELECT: 'accountType',
    
    // Authorization
    TERMS_AGREEMENT_CHECKBOX: 'termsAgreement'
  },

  // API Endpoints (relative paths)
  API_PATHS: {
    AUTHENTICATE: '/.netlify/functions/authenticate',
    GET_SELLER_DATA: '/.netlify/functions/get-seller-data',
    SEND_PAYMENT_LINK: '/.netlify/functions/send-payment-link'
  },

  // Local Storage Keys
  STORAGE_KEYS: {
    AUTH_TOKEN: 'authToken',
    CURRENT_USER: 'currentUser'
  },
  
  // Form Attributes
  FORM_ATTRS: {
    PAYMENT_FORM_NAME: 'paymentForm', // Value for the 'name' attribute and hidden input
    SUCCESS_PAGE_PATH: '/success.html' // Action attribute value
  },
  
  // URL Query Parameter Names
  URL_PARAMS: {
    AUCTION: 'auction',
    SELLER: 'seller',
    TOKEN: 'token'
  }
};

// Make CONFIG globally accessible (or could use modules if preferred)
window.APP_CONFIG = CONFIG; 