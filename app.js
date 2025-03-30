document.addEventListener('DOMContentLoaded', () => {
    // Ensure CONFIG is loaded
    if (typeof APP_CONFIG === 'undefined') {
        console.error("CRITICAL: APP_CONFIG not loaded from config.js");
        alert("Application configuration is missing. Please refresh or contact support.");
        return;
    }

    const C = APP_CONFIG; // Alias for brevity

    // --- DOM Element References ---
    const loginForm = document.getElementById(C.ELEMENT_IDS.LOGIN_FORM);
    const loginError = document.getElementById(C.ELEMENT_IDS.LOGIN_ERROR);
    // Login error message element was missing in config, assuming 'login-error-message' inside 'login-error' div
    const loginErrorMessage = loginError ? loginError.querySelector('p') : document.getElementById('login-error-message');
    const usernameInput = document.getElementById(C.ELEMENT_IDS.USERNAME_INPUT);
    const passwordInput = document.getElementById(C.ELEMENT_IDS.PASSWORD_INPUT);
    const loginButton = document.getElementById(C.ELEMENT_IDS.LOGIN_BUTTON);

    const staffFormStep = document.getElementById(C.ELEMENT_IDS.STAFF_FORM_STEP);
    const logoutButton = document.getElementById(C.ELEMENT_IDS.LOGOUT_BUTTON);
    const auctionCodeInput = document.getElementById(C.ELEMENT_IDS.AUCTION_CODE_INPUT);
    const sellerIdInput = document.getElementById(C.ELEMENT_IDS.SELLER_ID_INPUT);
    const sellerEmailInput = document.getElementById('sellerEmail'); // Added this ID, ensure it exists in HTML
    const generateLinkForm = document.getElementById('staff-generate-form'); // Added this ID, ensure it exists for the form in step-1
    const generateLinkButton = document.getElementById(C.ELEMENT_IDS.RETRIEVE_STATEMENT_BUTTON); // Button within step-1 form
    // Added message element ID, ensure it exists in HTML for step-1
    const generateLinkMessage = document.getElementById('generate-link-message');

    const paymentFormStep = document.getElementById(C.ELEMENT_IDS.PAYMENT_FORM_STEP);
    const paymentForm = document.getElementById(C.ELEMENT_IDS.PAYMENT_FORM);
    const sellerNameDisplay = document.getElementById(C.ELEMENT_IDS.SELLER_NAME_DISPLAY);
    const auctionTitleDisplay = document.getElementById(C.ELEMENT_IDS.AUCTION_TITLE_DISPLAY);
    const statementDateDisplay = document.getElementById(C.ELEMENT_IDS.STATEMENT_DATE_DISPLAY); // Get statement date element
    const totalDueDisplay = document.getElementById(C.ELEMENT_IDS.TOTAL_DUE_DISPLAY);
    // Added message element ID, ensure it exists in HTML for step-2
    const paymentFormMessage = document.getElementById('payment-form-message');

    const optionCheckRadio = document.getElementById(C.ELEMENT_IDS.OPTION_CHECK_RADIO);
    const checkUploadSection = document.getElementById(C.ELEMENT_IDS.CHECK_UPLOAD_SECTION);
    const checkImageInput = document.getElementById(C.ELEMENT_IDS.CHECK_IMAGE_INPUT);
    const optionManualRadio = document.getElementById(C.ELEMENT_IDS.OPTION_MANUAL_RADIO);
    const manualEntrySection = document.getElementById(C.ELEMENT_IDS.MANUAL_ENTRY_SECTION);
    const entityNameInput = document.getElementById(C.ELEMENT_IDS.ENTITY_NAME_INPUT);
    const routingNumberInput = document.getElementById(C.ELEMENT_IDS.ROUTING_NUMBER_INPUT);
    const accountNumberInput = document.getElementById(C.ELEMENT_IDS.ACCOUNT_NUMBER_INPUT);
    const accountTypeSelect = document.getElementById(C.ELEMENT_IDS.ACCOUNT_TYPE_SELECT);
    const termsAgreementCheckbox = document.getElementById(C.ELEMENT_IDS.TERMS_AGREEMENT_CHECKBOX);
    const paymentSubmitButton = paymentForm ? paymentForm.querySelector('button[type="submit"]') : null; // Get submit button

    // API Path for get-payment-details (assuming standard Netlify path)
    // TODO: Add this to config.js formally
    const GET_PAYMENT_DETAILS_PATH = '/.netlify/functions/get-payment-details';


    // --- Helper Functions ---
    function showElement(element) {
        // Use block display by default, but could customize if needed (e.g., for inline elements)
        if (element) element.style.display = 'block';
    }

    function hideElement(element) {
        if (element) element.style.display = 'none';
    }

    // Updated displayMessage to handle different message containers
    function displayMessage(containerElement, messageElement, message, isError = false) {
        if (messageElement) {
            messageElement.textContent = message;
            // Use distinct classes for error/success text styling
            messageElement.className = isError ? 'error-text' : 'success-text';
            showElement(messageElement); // Ensure the text element itself is visible
        }
         // Also show the container div and apply styling
        if (containerElement) {
            // Apply classes to the container for background/border styling
            containerElement.className = isError ? 'message-container error' : 'message-container success';
            showElement(containerElement);
        } else if (messageElement && !containerElement) {
             // If only message element provided, ensure it's visible
             showElement(messageElement);
        }
    }

    function hideMessage(containerElement, messageElement) {
        if (messageElement) {
             messageElement.textContent = '';
             // Optionally hide the specific message p/span if it has its own display style controlled
             // hideElement(messageElement);
        }
        // Hide the main container div if provided
        if (containerElement) {
            hideElement(containerElement);
            containerElement.className = 'message-container'; // Reset container class
        } else if (messageElement && !containerElement) {
            // If only message element provided, maybe hide it directly
            hideElement(messageElement);
        }
    }

    async function callApi(endpointKey, method = 'GET', data = null) {
        // Get path from config using the key
        const path = C.API_PATHS[endpointKey];
        if (!path) {
            console.error(`API path for key '${endpointKey}' not found in config.`);
            throw new Error(`Configuration error: API path for '${endpointKey}' is missing.`);
        }

        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            },
        };
        if (data) {
            options.body = JSON.stringify(data);
        }

        console.log(`Calling API: ${method} ${path}`);

        try {
            const response = await fetch(path, options); // Use path directly from config
            const responseData = await response.json();
            if (!response.ok) {
                console.error(`API Error Response (${path}):`, responseData);
                const errorMessage = responseData?.message || responseData?.error || `HTTP error! status: ${response.status}`;
                throw new Error(errorMessage);
            }
            console.log(`API Success Response (${path}):`, responseData);
            return responseData;
        } catch (error) {
            // Catch both network errors and errors thrown from !response.ok
            console.error(`API call failed (${path}):`, error);
            // Pass the already extracted/constructed error message
            throw new Error(error.message || "Network error or failed API call.");
        }
    }

    function updatePaymentOptionView() {
         if (!optionCheckRadio || !optionManualRadio) return;

         const checkSelected = optionCheckRadio.checked;
         const manualSelected = optionManualRadio.checked;

         // Toggle visibility
         checkSelected ? showElement(checkUploadSection) : hideElement(checkUploadSection);
         manualSelected ? showElement(manualEntrySection) : hideElement(manualEntrySection);

         // Update required attributes based on selection
         if(checkImageInput) checkImageInput.required = checkSelected;
         if(entityNameInput) entityNameInput.required = manualSelected;
         if(routingNumberInput) routingNumberInput.required = manualSelected;
         if(accountNumberInput) accountNumberInput.required = manualSelected;
         if(accountTypeSelect) accountTypeSelect.required = manualSelected;
     }

    // --- Event Handlers ---
    function handleLoginSubmit(event) {
        event.preventDefault();
        hideMessage(loginError, loginErrorMessage);
        if (!usernameInput || !passwordInput || !loginButton) return;

        const username = usernameInput.value;
        const password = passwordInput.value;

        if (!username || !password) {
            // Use the specific message element for login form
            displayMessage(loginError, loginErrorMessage, "Username and password are required.", true);
            return;
        }

        loginButton.disabled = true;
        loginButton.textContent = 'Logging In...';

        callApi('AUTHENTICATE', 'POST', { username, password })
            .then(data => {
                if (data.staffAuthToken) {
                    console.log("Login successful, storing staff auth token (JWT)");
                    sessionStorage.setItem(C.STORAGE_KEYS.AUTH_TOKEN, data.staffAuthToken);
                    if(passwordInput) passwordInput.value = '';
                    initApp();
                } else {
                     throw new Error("Authentication failed: No session token returned.");
                }
            })
            .catch(error => {
                console.error("Login failed:", error);
                displayMessage(loginError, loginErrorMessage, `Login Failed: ${error.message}`, true);
            })
            .finally(() => {
                 if(loginButton) {
                    loginButton.disabled = false;
                    loginButton.textContent = 'Login';
                 }
            });
    }

    function handleLogout() {
        console.log("Logging out");
        sessionStorage.removeItem(C.STORAGE_KEYS.AUTH_TOKEN);
        // Clear sensitive fields if needed
        if(usernameInput) usernameInput.value = '';
        if(passwordInput) passwordInput.value = '';
        if(auctionCodeInput) auctionCodeInput.value = '';
        if(sellerIdInput) sellerIdInput.value = '';
        if(sellerEmailInput) sellerEmailInput.value = '';
        initApp(); // Re-initialize view to show login form
    }

    function handleGenerateLinkSubmit(event) {
        event.preventDefault();
        hideMessage(null, generateLinkMessage);
        if (!generateLinkButton || !generateLinkMessage || !auctionCodeInput || !sellerIdInput) {
            return;
        }

        const staffAuthToken = sessionStorage.getItem(C.STORAGE_KEYS.AUTH_TOKEN);
        if (!staffAuthToken) {
            displayMessage(null, generateLinkMessage, "Your session has expired. Please log out and log back in.", true);
            handleLogout();
            return;
        }

        const auctionCode = auctionCodeInput.value.trim();
        const sellerId = sellerIdInput.value.trim();

        if (!auctionCode || !sellerId) {
             displayMessage(null, generateLinkMessage, "Auction Code and Seller ID are required.", true);
             return;
        }

        generateLinkButton.disabled = true;
        generateLinkButton.textContent = 'Generating...';

        const requestData = {
            staffAuthToken,
            auctionCode,
            sellerId
        };

        callApi('SEND_PAYMENT_LINK', 'POST', requestData)
            .then(data => {
                displayMessage(null, generateLinkMessage, data.message || "Link generated and sent successfully!", false);
                // Clear form after successful send
                if(auctionCodeInput) auctionCodeInput.value = '';
                if(sellerIdInput) sellerIdInput.value = '';
            })
            .catch(error => {
                 // Check if error indicates JWT issue
                 if (error.message.includes("session token")) { 
                     displayMessage(null, generateLinkMessage, "Session expired or invalid. Please log in again.", true);
                     handleLogout(); // Force logout
                 } else {
                     displayMessage(null, generateLinkMessage, `Error: ${error.message}`, true);
                 }
            })
            .finally(() => {
                 if(generateLinkButton) {
                    generateLinkButton.disabled = false;
                    // Reset text based on its original purpose
                    generateLinkButton.textContent = 'Generate Payment Form'; // Or 'Retrieve Statement' based on actual button text
                 }
            });
    }

    function handlePaymentFormSubmit(event) {
         // Use the specific message element for the payment form
        hideMessage(null, paymentFormMessage);
        if (!paymentSubmitButton || !paymentFormMessage) return;

        // Assume validation logic...
        let isValid = true;
        let validationMessage = "";

        const isCheckUpload = optionCheckRadio && optionCheckRadio.checked;
        const isManualEntry = optionManualRadio && optionManualRadio.checked;

        if (!isCheckUpload && !isManualEntry) {
            isValid = false;
            validationMessage = "Please select a payment method (Upload Check or Manual Entry).";
        } else if (isCheckUpload && checkImageInput && (!checkImageInput.files || checkImageInput.files.length === 0)) {
             isValid = false;
             validationMessage = "Please select a voided check image file to upload.";
        } else if (isManualEntry) {
            if (!entityNameInput?.value || !routingNumberInput?.value || !accountNumberInput?.value || !accountTypeSelect?.value) {
                 isValid = false;
                 validationMessage = "Please fill in all required banking details for manual entry.";
            } else if (!/^\d{9}$/.test(routingNumberInput.value)) { // Basic routing number format check (9 digits)
                 isValid = false;
                 validationMessage = "Routing number must be exactly 9 digits.";
            }
             // Could add account number format checks too
        }

        // Check terms agreement only if other validation passed so far
        if (isValid && (!termsAgreementCheckbox || !termsAgreementCheckbox.checked)) {
            isValid = false;
            validationMessage = "You must agree to the terms and conditions.";
        }

        // If any validation failed, prevent submission and show message
        if (!isValid) {
            event.preventDefault(); // Stop Netlify submission
            displayMessage(null, paymentFormMessage, validationMessage, true);
            return;
        }

        // If validation passed, disable button and allow Netlify to handle submission
        console.log("Client-side validation passed. Allowing Netlify form submission.");
        paymentSubmitButton.disabled = true;
        paymentSubmitButton.textContent = 'Submitting...';
        // Netlify will take over now
    }


    // --- Initialization Logic ---
    function initApp() {
        console.log("Initializing App View...");
        const urlParams = new URLSearchParams(window.location.search);
        const sellerToken = urlParams.get(C.URL_PARAMS.TOKEN);
        const staffAuthToken = sessionStorage.getItem(C.STORAGE_KEYS.AUTH_TOKEN);

        // --- Reset View State ---
        hideElement(loginForm);
        hideElement(staffFormStep);
        hideElement(paymentFormStep);
        // Hide all message areas
        hideMessage(loginError, loginErrorMessage);
        hideMessage(null, generateLinkMessage); // Assumes generateLinkMessage is direct child or standalone
        hideMessage(null, paymentFormMessage);  // Assumes paymentFormMessage is direct child or standalone
        // Reset button states
        if(loginButton) { loginButton.disabled = false; loginButton.textContent = 'Login'; }
        if(generateLinkButton) { generateLinkButton.disabled = false; generateLinkButton.textContent = 'Generate Payment Form'; } // Adjust text as needed
        if(paymentSubmitButton) { paymentSubmitButton.disabled = false; paymentSubmitButton.textContent = 'Submit Payment Information'; }
        // Ensure payment options are hidden initially if they aren't inside paymentFormStep container
        hideElement(checkUploadSection);
        hideElement(manualEntrySection);


        // --- Determine View based on State ---
        if (sellerToken) {
            // --- Seller View ---
            console.log("Seller data token (JWT) found:", sellerToken);
            showElement(paymentFormStep);
             // Use the specific message element for the payment form area
            displayMessage(null, paymentFormMessage, "Loading payment details...", false);

            // Use the defined constant for the path
            fetch(`${GET_PAYMENT_DETAILS_PATH}?token=${sellerToken}`)
                 .then(response => {
                     // Check if response is ok, if not, parse error JSON
                     if (!response.ok) {
                         // Clones the response to allow reading body twice (once for json, once potentially for text fallback)
                         return response.clone().json().catch(() => response.text())
                             .then(errBody => {
                                 const errorMessage = errBody?.message || (typeof errBody === 'string' ? errBody : `HTTP error! Status: ${response.status}`);
                                 throw new Error(errorMessage);
                             });
                     }
                     return response.json(); // Parse JSON body if response is ok
                 })
                .then(data => {
                    hideMessage(null, paymentFormMessage); // Hide loading message
                    console.log("Seller data received:", data);

                    // Format the amount due
                    const formattedAmount = data.amountDue ? 
                        `$${data.amountDue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 
                        'N/A';

                    // Populate display fields
                    if(sellerNameDisplay) sellerNameDisplay.textContent = data.sellerName || 'N/A';
                    if(auctionTitleDisplay) auctionTitleDisplay.textContent = data.auctionDetails || 'N/A';
                    if(statementDateDisplay) statementDateDisplay.textContent = data.statementDate || 'N/A';
                    if(totalDueDisplay) totalDueDisplay.textContent = formattedAmount; // Use formatted amount

                    // Populate hidden fields required for Netlify form submission
                    function setHiddenValue(name, value) {
                         const input = paymentForm ? paymentForm.querySelector(`input[type="hidden"][name="${name}"]`) : null;
                         if (input) input.value = value || '';
                         else console.warn(`Hidden input for "${name}" not found in paymentForm.`);
                    }
                    setHiddenValue('sellerName', data.sellerName);
                    setHiddenValue('auctionDetails', data.auctionDetails);
                    setHiddenValue('amountDue', data.amountDue?.toFixed(2));
                    // Add any other hidden fields as needed

                    // Set up the payment option radio buttons and sections
                    updatePaymentOptionView(); // Initial view based on default radio state
                })
                .catch(error => {
                    console.error("Failed to get payment details:", error);
                    displayMessage(null, paymentFormMessage, `Error loading payment details: ${error.message}. This link may be invalid or expired.`, true);
                    // Hide the form sections if data loading fails
                    const optionsContainer = paymentForm ? paymentForm.querySelector('.payment-options-container') : null; // Ensure this container exists
                    if(optionsContainer) hideElement(optionsContainer);
                    if(paymentSubmitButton) hideElement(paymentSubmitButton); // Hide submit button too
                });

        } else if (staffAuthToken) {
            // --- Staff Logged-In View ---
            console.log("Staff auth token (JWT) found.");
            showElement(staffFormStep);
             // Optionally clear generate form fields on showing this step?
             // if(auctionCodeInput) auctionCodeInput.value = ''; etc.
        } else {
            // --- Staff Logged-Out View ---
            console.log("No seller token or staff auth token. Showing login.");
            showElement(loginForm);
        }
    }

    // --- Attach Event Listeners ---
    if (loginForm) {
        loginForm.addEventListener('submit', handleLoginSubmit);
    }
    if (logoutButton) {
        logoutButton.addEventListener('click', handleLogout);
    }
    if (generateLinkForm) { 
        generateLinkForm.addEventListener('submit', handleGenerateLinkSubmit);
    } else {
        console.error('Could not attach listener because generateLinkForm was not found!');
    }
    if (paymentForm) {
         paymentForm.addEventListener('submit', handlePaymentFormSubmit);
         // Listen to changes on radio buttons to update the UI
         if (optionCheckRadio) optionCheckRadio.addEventListener('change', updatePaymentOptionView);
         if (optionManualRadio) optionManualRadio.addEventListener('change', updatePaymentOptionView);
    }

    // --- Run Initialization ---
    initApp();
});