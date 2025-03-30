# McLemore Auction Company Payment Form

## Overview

This application implements a secure two-user workflow for collecting payment information from sellers:

1. **MAC Staff Portal**: Allows McLemore Auction Company staff to enter auction code and Seller ID to generate a secure payment form link
2. **Seller Payment Form**: Enables sellers to securely submit their banking information for ACH direct deposit

## Security Features

- **Two-Step Authentication**: Only users with valid auction code and Seller ID combinations can access payment forms
- **Secure URL Generation**: Creates unique URLs with tokens for sellers to access their payment forms
- **Protected Financial Data**: Sensitive information is only collected through authenticated links
- **Statement Data Integration**: Pre-populates forms with seller statement data from the auction system

## Setup Instructions

1. **Logo**:
   - The form uses the McLemore logo from the `/images/mclemore-logo.png` file

2. **Form Configuration**:
   - Configured to work with Netlify Forms for secure form submissions
   - File upload enabled for check images
   - Client-side validation ensures either check image or account details are provided

## Features

- **Staff Portal**:
  - Simple interface for entering auction code and Seller ID
  - Generates secure payment form links that can be copied or emailed directly to sellers
  - Ability to generate multiple payment form links in succession

- **Seller Form**:
  - Displays statement summary with seller name, auction details, and amount due
  - Two payment information options:
    - Upload a voided check image
    - Manually enter bank account details
  - Clear visual guidance for finding routing and account numbers

- **User-Friendly Experience**:
  - Responsive design that works on mobile and desktop devices
  - McLemore brand colors and styling
  - Form validation to ensure required information is provided
  - Success page with confirmation message and next steps

## Current Status (As of [Date - e.g., Mar 30, 2025])

Development is currently paused after successfully implementing and testing the core staff workflow:

*   **Dependency Consolidation:** Completed (Phase 1).
*   **Staff Authentication:** Implemented function to log staff in via `mclemoreauction.com` credentials (simulating browser flow) and obtain session cookies (Phase 2).
*   **Data Scraping:** Implemented logic within the link generation function to scrape Seller Name, Auction Title, Amount Due, and **Seller Email** from the `/admin/statements/printreport/...` page using the staff session (Phase 2/3).
*   **Secure Link Generation & Sending:** Implemented function to generate a unique, single-use token, store scraped data associated with it (using temporary in-memory cache), and email the link (`/index.html?token=...`) to the scraped seller email address (Phase 3).
*   **Seller Data Retrieval:** Implemented function (`get-payment-details`) to retrieve cached seller data using the token from the URL and invalidate the token (Phase 4).
*   **Frontend Logic:** Implemented basic frontend structure (`index.html`, `config.js`, `app.js`) to handle view switching (Login vs. Staff Generate vs. Seller Form), staff login API calls, generate link API calls, and initial seller data fetching via token (Phase 5).

**Successfully Tested Locally (`netlify dev`):**

*   Staff login using valid `mclemoreauction.com` credentials.
*   Generation of payment links (correctly scraping required data, including email).
*   Email delivery of the secure link.

## Next Steps / Outstanding Items

1.  **Seller Form Testing (Resume Here):**
    *   Click the link sent to the seller's email.
    *   Verify seller data populates the form correctly.
    *   Test submitting the form via both "Upload Check" and "Manual Entry".
    *   Check Netlify Forms dashboard/logs for successful submission capture (including hidden data).
    *   Verify redirection to `/success.html` (ensure page exists).
2.  **Caching Implementation (CRITICAL):** Replace the current **in-memory** `staffSessionCache` and `sellerDataCache` in the Netlify functions with a production-ready, persistent solution (e.g., signed JWTs, FaunaDB, Upstash Redis).
3.  **Error Handling/Robustness:** Enhance error handling, particularly around the scraping logic, to gracefully handle potential changes in the target site's HTML structure.
4.  **Security Review:** Harden token generation/validation (e.g., implement expiry for `sellerAccessToken`, consider signed JWTs).
5.  **Tailwind CSS:** Address the CDN warning by setting up Tailwind CLI or PostCSS for production builds.
6.  **Production Deployment:** Configure Netlify environment variables and deploy.

## Testing Locally

Run `netlify dev` in the project directory.

## Deployment to Netlify

This application is designed to be deployed to Netlify for full functionality:

1. **Connect to GitHub**: Link your GitHub repository to Netlify
2. **Build Settings**: No build command needed, publish directory is the root folder
3. **Form Handling**: Netlify automatically detects and processes forms with the `data-netlify="true"` attribute
4. **File Uploads**: Netlify handles file uploads when using the `enctype="multipart/form-data"` attribute
5. **Environment Variables**: For production, you may need to set up environment variables for API endpoints

### Deployment Steps

1. Push your code to GitHub
2. Log in to Netlify and select "New site from Git"
3. Choose your repository and configure build settings
4. Deploy the site
5. Set up a custom domain if desired

## Production Implementation

For a full production implementation, you'll need to:

1. Create a server-side API endpoint that accepts auction code and Seller ID
2. Implement proper authentication and data retrieval from your database
3. Return the seller statement data to populate the form
4. Add server-side validation for all submitted data
5. Set up secure email notifications for form submissions

## Troubleshooting

- **Form Submissions**: Check Netlify Forms dashboard to view and manage submissions
- **File Uploads**: Ensure file size limits are appropriate (Netlify default is 10MB)
- **URL Parameters**: If testing locally, ensure URL parameters are properly encoded
