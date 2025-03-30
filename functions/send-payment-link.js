// Netlify Function to send payment form link via email
const nodemailer = require('nodemailer');
const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
// Note: CookieJar itself is not needed here, just the cache
const cheerio = require('cheerio');
const crypto = require('crypto');

// Import the cache and BASE_URL from authenticate.js
const { staffSessionCache, BASE_URL } = require('./authenticate');

// Simple in-memory cache for storing seller data keyed by a temporary access token
// WARNING: Similar to staffSessionCache, this is not suitable for production.
const sellerDataCache = {};

// Helper function to fetch and parse seller data
async function fetchAndParseSellerData(staffSessionId, auctionCode, sellerId) {
  console.log(`Fetching seller data for auction ${auctionCode}, seller ${sellerId}`);

  // 1. Retrieve the authenticated staff member's cookie jar from the cache
  const jar = staffSessionCache[staffSessionId];
  if (!jar) {
    console.error("Invalid or expired staff session ID:", staffSessionId);
    throw new Error("Invalid or expired staff session. Please log in again.");
  }

  // 2. Construct the target URL
  const reportUrl = `${BASE_URL}/admin/statements/printreport/auction/${auctionCode}/sellerid/${sellerId}`;
  console.log(`Target report URL: ${reportUrl}`);

  // 3. Create an axios instance configured to use the staff member's cookies
  const client = wrapper(axios.create({ jar, withCredentials: true }));

  try {
    // 4. Make the GET request
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

    console.log(`Successfully fetched report page, status: ${response.status}`);

    // 5. Load HTML into cheerio
    const $ = cheerio.load(response.data);

    // Extract data using selectors based on provided HTML structure
    let sellerName = '';
    // Get HTML content of the first TD in the third row
    const sellerInfoTdHtml = $('table#report-heading tr:nth-child(3) td:first-child').html();
    if (sellerInfoTdHtml) {
        // Split the HTML string by <br variations
        const parts = sellerInfoTdHtml.split(/<br\s*\/?>/i); 
        if (parts.length > 1) {
             // Take the second part, remove any trailing tags/chars, and trim
             sellerName = parts[1].replace(/<\/?[^>]+(>|$)/g, "").trim();
        }
    }
    
    const auctionTitle = $('td#report-title').text().trim();
    
    // Find the TD containing the amount due using its specific style attribute
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
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ message: 'Method Not Allowed' }) };
    }

    let requestData;
    try {
        const body = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf-8') : event.body;
        requestData = JSON.parse(body);
        if (!requestData.staffSessionId || !requestData.auctionCode || !requestData.sellerId) {
            throw new Error('Missing required fields: staffSessionId, auctionCode, sellerId.');
        }
    } catch (error) {
        console.error("Error parsing request body:", error);
        return { statusCode: 400, body: JSON.stringify({ message: 'Invalid request body: ' + error.message }) };
    }

    const { staffSessionId, auctionCode, sellerId } = requestData;

    try {
        // Step 1: Fetch and parse the seller data using the helper function
        const sellerData = await fetchAndParseSellerData(staffSessionId, auctionCode, sellerId);

        // Step 2: Generate a unique seller access token
        const sellerAccessToken = crypto.randomBytes(20).toString('hex'); // Longer token

        // Step 3: Store the fetched seller data in the seller cache
        sellerDataCache[sellerAccessToken] = {
            ...sellerData, // Spread the extracted data
            retrievedAt: Date.now()
        };
        console.log(`Seller data cached with token: ${sellerAccessToken}`);

        // Simple cache cleanup (improve for production)
        if (Object.keys(sellerDataCache).length > 500) { // Limit cache size
           // Find and delete the oldest entry (basic strategy)
           let oldestToken = null;
           let oldestTime = Date.now();
           for (const token in sellerDataCache) {
               if (sellerDataCache[token].retrievedAt < oldestTime) {
                   oldestTime = sellerDataCache[token].retrievedAt;
                   oldestToken = token;
               }
           }
           if (oldestToken) {
               delete sellerDataCache[oldestToken];
               console.log("Cleaned up oldest seller data cache entry.");
           }
        }

        // Step 4: Construct the seller payment form URL
        // Use a relative path. Netlify dev and production will handle the base URL.
        const paymentFormUrl = `/index.html?token=${sellerAccessToken}`;

        // Step 5: Send the email using Nodemailer
        // Ensure EMAIL_USER and EMAIL_PASS are set as environment variables
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
            to: sellerData.sellerEmail, // USE SCRAPED EMAIL HERE
            subject: `Secure Payment Link for Auction ${sellerData.auctionDetails || auctionCode}`, // Use scraped title if available
            text: `Hello ${sellerData.sellerName || 'Seller'}, \n\nPlease use the following secure link to submit your payment information for auction ${sellerData.auctionDetails || auctionCode}:\n\n${process.env.URL || 'http://localhost:8888'}${paymentFormUrl}\n\nAmount Due: $${sellerData.amountDue ? sellerData.amountDue.toFixed(2) : 'N/A'}\n\nThis link is valid for 24 hours. If you have any questions, please contact McLemore Auction Company.\n\nThank you.`,
            html: `<p>Hello ${sellerData.sellerName || 'Seller'},</p><p>Please use the following secure link to submit your payment information for auction <strong>${sellerData.auctionDetails || auctionCode}</strong>:</p><p><a href="${process.env.URL || 'http://localhost:8888'}${paymentFormUrl}">Click Here to Submit Payment Information</a></p><p>Amount Due: <strong>$${sellerData.amountDue ? sellerData.amountDue.toFixed(2) : 'N/A'}</strong></p><p>This link is valid for 24 hours. If you have any questions, please contact McLemore Auction Company.</p><p>Thank you.</p>`
        };

        console.log(`Sending payment link email to scraped address: ${sellerData.sellerEmail}`);
        await transporter.sendMail(mailOptions);
        console.log("Email sent successfully.");

        // Step 6: Return success response to the staff portal
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: `Payment link generated successfully and sent to ${sellerData.sellerEmail}` })
        };

    } catch (error) {
        console.error("Error in send-payment-link function:", error);
        // Provide a user-friendly error message
        let errorMessage = "An unexpected error occurred.";
        if (error.message.includes("staff session")) {
             errorMessage = error.message; // Pass session errors directly
        } else if (error.message.includes("Failed to parse") || error.message.includes("Failed to fetch")) {
            errorMessage = "Could not retrieve seller details. Please verify the auction code and seller ID, or check the website status.";
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

// Export the cache for use in get-payment-details
module.exports.sellerDataCache = sellerDataCache;
