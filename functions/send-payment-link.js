// Netlify Function to send payment form link via email
const nodemailer = require('nodemailer');
const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar, Cookie } = require('tough-cookie'); // Import Cookie
const cheerio = require('cheerio');
const crypto = require('crypto');
const jwt = require('jsonwebtoken'); // Import JWT
const querystring = require('querystring');

// Import BASE_URL from authenticate.js
// const { BASE_URL } = require('./authenticate'); // Need to ensure authenticate.js exports BASE_URL
// Assuming BASE_URL might be needed, let's define it here if not properly exported/imported
const BASE_URL = process.env.BASE_URL || "https://www.mclemoreauction.com"; 

// Get JWT secret from environment variables
const JWT_SECRET = process.env.JWT_SECRET;

// Helper function to fetch and parse seller data
// Now accepts a reconstructed CookieJar instead of staffSessionId
async function fetchAndParseSellerData(jar, auctionCode, sellerId) { 
  console.log(`Fetching seller data for auction ${auctionCode}, seller ${sellerId}`);

  const reportUrl = `${BASE_URL}/admin/statements/printreport/auction/${auctionCode}/sellerid/${sellerId}`;
  console.log(`Target report URL: ${reportUrl}`);

  // Create an axios instance configured to use the provided cookies
  const client = wrapper(axios.create({ jar, withCredentials: true }));

  try {
    const response = await client.get(reportUrl, {
      headers: {
          // Add necessary headers if required, mimicking browser behavior
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Referer': `${BASE_URL}/admin/` // Adjust if needed
          // Add other headers from browser inspection if necessary
      },
      validateStatus: function (status) {
          return status >= 200 && status < 300;
      },
    });

    // Load HTML into cheerio
    const $ = cheerio.load(response.data);

    // Extract data using selectors based on provided HTML structure
    let sellerName = '';
    const sellerInfoTdHtml = $('table#report-heading tr:nth-child(3) td:first-child').html();
    if (sellerInfoTdHtml) {
        const parts = sellerInfoTdHtml.split(/<br\s*\/?>/i); 
        if (parts.length > 1) {
             sellerName = parts[1].replace(/<\/?[^>]+(>|$)/g, "").trim();
        }
    }
    
    const auctionTitle = $('td#report-title').text().trim();
    
    const amountDueText = $('table.report-content:last-of-type td[style*="border-bottom: 1px solid #000"][style*="border-top: 1px solid #000"]').text().trim();
    
    const sellerEmail = $('table#report-heading tr:nth-child(3) td:last-child a[href^="mailto:"]').text().trim();

    const amountDue = parseFloat(amountDueText.replace(/[^\d.-]/g, ''));

    // Final validation check
    if (!sellerName || !auctionTitle || isNaN(amountDue) || !sellerEmail) {
      console.warn("Validation Failed: Could not extract all required data points.");
      console.warn(`Values - Name: '${sellerName}', Title: '${auctionTitle}', Amount Text: '${amountDueText}', Parsed Amount: ${amountDue}, Email: '${sellerEmail}'`);
      throw new Error("Failed to parse required data from the seller report page.");
    }

    const extractedData = {
      sellerName: sellerName,
      auctionDetails: auctionTitle,
      amountDue: amountDue,
      sellerEmail: sellerEmail, // Include extracted email
      // Add other fields as needed
    };

    return extractedData;

  } catch (error) {
      console.error('Error fetching or parsing seller report for auction', auctionCode, 'seller', sellerId);
      if (error.response) {
          console.error('Status:', error.response.status);
          console.error('Headers:', error.response.headers);
          // Avoid logging potentially large HTML data in production logs
          // console.error('Data:', error.response.data);
          throw new Error(`Failed to fetch seller report page: ${error.response.status}`);
      } else if (error.request) {
          console.error('Request Error:', error.request);
          throw new Error('No response received from seller report endpoint.');
      } else {
          console.error('Error:', error.message);
          // Rethrow specific parsing errors or general errors
          throw error; // Rethrow the original error (could be parsing error or session error)
      }
  }
}

exports.handler = async (event) => {
    if (!JWT_SECRET) {
        console.error("FATAL: JWT_SECRET environment variable is not set.");
        return { statusCode: 500, body: JSON.stringify({ message: 'Server configuration error.' }) };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ message: 'Method Not Allowed' }) };
    }

    let requestData;
    try {
        const body = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf-8') : event.body;
        requestData = JSON.parse(body);
        // Expect staffAuthToken (JWT) instead of staffSessionId
        if (!requestData.staffAuthToken || !requestData.auctionCode || !requestData.sellerId) {
            throw new Error('Missing required fields: staffAuthToken, auctionCode, sellerId.');
        }
    } catch (error) {
        console.error("Error parsing request body:", error);
        return { statusCode: 400, body: JSON.stringify({ message: 'Invalid request body: ' + error.message }) };
    }

    // Get JWT from request
    const { staffAuthToken, auctionCode, sellerId } = requestData;
    let staffPayload;

    try {
        // Step 1: Verify the staff JWT and extract cookies
        try {
            staffPayload = jwt.verify(staffAuthToken, JWT_SECRET);
        } catch (err) {
            console.error("Invalid or expired staff auth token:", err.message);
            return { statusCode: 401, body: JSON.stringify({ message: 'Invalid or expired staff session token.' }) };
        }
        
        if (!staffPayload || !staffPayload.cookies || !Array.isArray(staffPayload.cookies)) {
             console.error("Invalid staff auth token payload.", staffPayload);
             throw new Error("Invalid session token structure.");
        }

        // Step 2: Reconstruct the CookieJar from the token payload
        const jar = new CookieJar();
        for (const cookieData of staffPayload.cookies) {
            const cookie = Cookie.fromJSON(JSON.stringify(cookieData)); 
            if (cookie) {
                 await jar.setCookie(cookie, BASE_URL);
            } else {
                 console.warn("Failed to parse cookie from JWT payload:", cookieData);
            }
        }
        
        // --- BEGIN Post-Login Initialization Steps ---
        const initClient = wrapper(axios.create({ jar, withCredentials: true })); // Use the reconstructed jar
        try {
            console.log("Performing post-login step: GET /api/initdata");
            await initClient.get(`${BASE_URL}/api/initdata`, {
                 headers: { // Mimic headers likely needed based on Python script context
                     'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15',
                     'Accept': 'application/json, text/plain, */*',
                     'Referer': `${BASE_URL}/` // Referer might be the base URL after login
                 },
                 validateStatus: function (status) { return status >= 200 && status < 400; }
            });
            console.log("GET /api/initdata successful.");

            console.log("Performing post-login step: POST /api/auctions");
            const auctionsData = { // Data payload from Python script
                'past_sales': 'false',
                'meta_also': 'true'
            };
            await initClient.post(`${BASE_URL}/api/auctions`, querystring.stringify(auctionsData), {
                 headers: {
                     'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15',
                     'Accept': 'application/json, text/plain, */*',
                     'Content-Type': 'application/x-www-form-urlencoded', 
                     'Referer': `${BASE_URL}/` // Referer might be the base URL
                 },
                  validateStatus: function (status) { return status >= 200 && status < 400; }
            });
             console.log("POST /api/auctions successful.");

        } catch (initError) {
             console.error("Error during post-login initialization steps:", initError.message);
             // If these steps fail, fetching the report will likely also fail.
             throw new Error(`Failed to initialize session for report access: ${initError.message}`);
        }
        // --- END Post-Login Initialization Steps ---

        // Step 3: Fetch and parse the seller data using the NOW FULLY INITIALIZED jar
        const sellerData = await fetchAndParseSellerData(jar, auctionCode, sellerId);

        // Step 4: Create a *new* JWT containing the seller data
        console.log("Creating seller data token...");
        const sellerPayload = { ...sellerData }; // Payload is the scraped data
        // Set a shorter expiry for the seller link token (e.g., 24 hours)
        const sellerDataToken = jwt.sign(sellerPayload, JWT_SECRET, { expiresIn: '24h' }); 
        
        // Step 5: Construct the seller payment form URL with the JWT
        const paymentFormUrl = `/index.html?token=${sellerDataToken}`; // Use JWT as token

        // Step 6: Send the email using the SCRAPED email address
        if (!sellerData.sellerEmail) {
            console.error("Validation Failed: Could not extract seller email.");
            return { statusCode: 500, body: JSON.stringify({ message: 'Failed to retrieve seller email.' }) };
        }
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
            console.error("Email credentials (EMAIL_USER, EMAIL_PASS) are not configured in environment variables.");
            throw new Error("Server configuration error: Email service not set up.");
        }

        let transporter = nodemailer.createTransport({
            service: process.env.EMAIL_SERVICE || 'gmail', // Use service from env or default to gmail
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS, 
            },
        });

        // Use EMAIL_FROM from env if available, otherwise construct default
        const fromAddress = process.env.EMAIL_FROM ? `"${process.env.EMAIL_FROM}" <${process.env.EMAIL_USER}>` : process.env.EMAIL_USER;

        let mailOptions = {
            from: fromAddress,
            to: sellerData.sellerEmail,
            subject: `Secure Payment Link for Auction ${sellerData.auctionDetails || auctionCode}`,
            text: `Hello ${sellerData.sellerName || 'Seller'}, \n\nPlease use the following secure link to submit your payment information for auction ${sellerData.auctionDetails || auctionCode}:\n\n${process.env.URL || 'http://localhost:8888'}${paymentFormUrl}\n\nAmount Due: $${sellerData.amountDue ? sellerData.amountDue.toFixed(2) : 'N/A'}\n\nThis link is valid for 24 hours. If you have any questions, please contact McLemore Auction Company.\n\nThank you.`,
            html: `<p>Hello ${sellerData.sellerName || 'Seller'},</p><p>Please use the following secure link to submit your payment information for auction <strong>${sellerData.auctionDetails || auctionCode}</strong>:</p><p><a href="${process.env.URL || 'http://localhost:8888'}${paymentFormUrl}">Click Here to Submit Payment Information</a></p><p>Amount Due: <strong>$${sellerData.amountDue ? sellerData.amountDue.toFixed(2) : 'N/A'}</strong></p><p>This link is valid for 24 hours. If you have any questions, please contact McLemore Auction Company.</p><p>Thank you.</p>`
        };

        console.log(`Sending payment link email with JWT token to: ${sellerData.sellerEmail}`);
        await transporter.sendMail(mailOptions);
        console.log("Email sent successfully.");

        // Step 7: Return success response
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: `Payment link generated successfully and sent to ${sellerData.sellerEmail}` })
        };

    } catch (error) {
        console.error("Error in send-payment-link function:", error);
        // Provide a user-friendly error message
        let errorMessage = "An unexpected error occurred.";
        if (error.message.includes("session token")) {
             errorMessage = error.message;
        } else if (error.message.includes("Failed to parse") || error.message.includes("Failed to retrieve/parse")) {
            errorMessage = "Could not retrieve/parse required seller details from the report page.";
        } else if (error.message.includes("Email service")) {
             errorMessage = "Could not send email due to server configuration issue.";
        } else if (error.code === 'EENVELOPE' || error.command === 'CONN') { // Nodemailer errors
             errorMessage = "Failed to send email. Please check email configuration or network.";
        }

        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: errorMessage, error: error.message }) // Include original error for debugging if needed
        };
    }
};
