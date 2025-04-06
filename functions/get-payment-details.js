// Netlify Function to retrieve seller details using a JWT token
const jwt = require('jsonwebtoken'); // Import JWT

// REMOVED: Import of shared seller data cache
// const { sellerDataCache } = require('./send-payment-link');

// Get JWT secret from environment variables
const JWT_SECRET = process.env.JWT_SECRET;

exports.handler = async (event) => {
    if (!JWT_SECRET) {
        console.error("FATAL: JWT_SECRET environment variable is not set.");
        return { statusCode: 500, body: JSON.stringify({ message: 'Server configuration error.' }) };
    }

    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, body: JSON.stringify({ message: 'Method Not Allowed' }) };
    }

    // Get the JWT token from query parameters
    const token = event.queryStringParameters?.token;

    if (!token) {
        console.log("Request received without token.");
        return { statusCode: 400, body: JSON.stringify({ message: 'Missing required token parameter.' }) };
    }

    console.log(`Attempting to verify seller data token.`);

    try {
        // Verify the JWT
        const decodedPayload = jwt.verify(token, JWT_SECRET);
        
        // The payload *is* the seller data we stored
        const sellerData = decodedPayload;
        
        // Optional: Could add extra validation on payload structure if needed
        if (!sellerData || !sellerData.sellerName || !sellerData.sellerEmail) {
             console.error("Invalid JWT payload structure:", sellerData);
             throw new Error("Token payload is invalid.");
        }

        console.log("Seller data token verified successfully. Returning data.");

        // REMOVED: Deleting from cache
        // delete sellerDataCache[token];

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            // Return the necessary data from the verified token payload
            body: JSON.stringify({
                 sellerName: sellerData.sellerName,
                 auctionDetails: sellerData.auctionDetails,
                 statementDate: sellerData.statementDate // Return statement date
            })
        };
    } catch (err) {
        // Handle JWT verification errors (expired, invalid signature, etc.)
        console.error("Invalid or expired seller data token:", err.message);
        // Return 401 Unauthorized or 410 Gone depending on error type? For simplicity, use 401.
        return {
            statusCode: 401,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'Invalid or expired payment link token.' })
        };
    }
}; 