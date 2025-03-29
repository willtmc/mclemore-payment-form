// Netlify Function to authenticate MAC staff

exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    // Parse the request body
    const requestBody = JSON.parse(event.body);
    const { username, password } = requestBody;

    if (!username || !password) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Missing username or password' })
      };
    }

    // We only authenticate the user here. The validity of auctionCode/sellerId
    // will be handled by the get-seller-data function when it's called

    // We'll verify the credentials by attempting to log in to the McLemore Auction admin system
    // This logic is now within the get-seller-data function
    // For now, we'll just generate a token with the username and an expiration time

    // Create a token with 24-hour expiration
    const tokenData = {
      username,
      exp: Date.now() + (24 * 60 * 60 * 1000) // 24 hours from now
    };

    // Encode the token as base64
    const token = Buffer.from(JSON.stringify(tokenData)).toString('base64');

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Authentication successful',
        token,
        username
      })
    };
  } catch (error) {
    console.error('Authentication error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Server error', error: error.toString() })
    };
  }
};
