// Netlify Function to retrieve seller details using a one-time token

// Import the shared seller data cache
const { sellerDataCache } = require('./send-payment-link');

exports.handler = async (event) => {
    // Only allow GET requests
    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, body: JSON.stringify({ message: 'Method Not Allowed' }) };
    }

    // Get the token from query parameters
    const token = event.queryStringParameters?.token;

    if (!token) {
        console.log("Request received without token.");
        return { statusCode: 400, body: JSON.stringify({ message: 'Missing required token parameter.' }) };
    }

    console.log(`Attempting to retrieve data for token: ${token}`);

    // Look up the token in the cache
    const sellerData = sellerDataCache[token];

    if (sellerData) {
        console.log("Token found. Returning seller data.");
        // IMPORTANT: Invalidate the token immediately after retrieval
        delete sellerDataCache[token];
        console.log(`Token ${token} invalidated.`);

        // Optionally add logic here to check retrievedAt for expiry if needed
        // const maxAge = 24 * 60 * 60 * 1000; // 24 hours
        // if (Date.now() - sellerData.retrievedAt > maxAge) {
        //     console.log(`Token ${token} has expired.`);
        //     return { statusCode: 410, body: JSON.stringify({ message: 'This payment link has expired.' }) };
        // }

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            // Return only the necessary data for the form
            body: JSON.stringify({
                 sellerName: sellerData.sellerName,
                 auctionDetails: sellerData.auctionDetails,
                 amountDue: sellerData.amountDue,
                 // Add any other fields that were stored and needed by the frontend
            })
        };
    } else {
        console.log(`Token ${token} not found in cache or already used.`);
        // Use 404 Not Found, as 410 Gone implies it *was* there but expired/removed deliberately by policy
        return {
            statusCode: 404,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'Invalid or expired payment link token.' })
        };
    }
}; 