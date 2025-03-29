# McLemore Auction Company Payment Form

## Overview

This application implements a secure two-user workflow for collecting payment information from consignors:

1. **MAC Staff Portal**: Allows McLemore Auction Company staff to enter auction code and consignor ID to generate a secure payment form link
2. **Consignor Payment Form**: Enables consignors to securely submit their banking information for ACH direct deposit

## Security Features

- **Two-Step Authentication**: Only users with valid auction code and consignor ID combinations can access payment forms
- **Secure URL Generation**: Creates unique URLs with tokens for consignors to access their payment forms
- **Protected Financial Data**: Sensitive information is only collected through authenticated links
- **Statement Data Integration**: Pre-populates forms with consignor statement data from the auction system

## Setup Instructions

1. **Logo**:
   - The form uses the McLemore logo from the `/images/mclemore-logo.png` file

2. **Form Configuration**:
   - Configured to work with Netlify Forms for secure form submissions
   - File upload enabled for check images
   - Client-side validation ensures either check image or account details are provided

## Features

- **Staff Portal**:
  - Simple interface for entering auction code and consignor ID
  - Generates secure payment form links that can be copied or emailed directly to consignors
  - Ability to generate multiple payment form links in succession

- **Consignor Form**:
  - Displays statement summary with consignor name, auction details, and amount due
  - Two payment information options:
    - Upload a voided check image
    - Manually enter bank account details
  - Clear visual guidance for finding routing and account numbers

- **User-Friendly Experience**:
  - Responsive design that works on mobile and desktop devices
  - McLemore brand colors and styling
  - Form validation to ensure required information is provided
  - Success page with confirmation message and next steps

## Testing Locally

Run the following command in the project directory:

```
python -m http.server 8000
```

Then visit http://localhost:8000 in your browser.

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

1. Create a server-side API endpoint that accepts auction code and consignor ID
2. Implement proper authentication and data retrieval from your database
3. Return the consignor statement data to populate the form
4. Add server-side validation for all submitted data
5. Set up secure email notifications for form submissions

## Troubleshooting

- **Form Submissions**: Check Netlify Forms dashboard to view and manage submissions
- **File Uploads**: Ensure file size limits are appropriate (Netlify default is 10MB)
- **URL Parameters**: If testing locally, ensure URL parameters are properly encoded
