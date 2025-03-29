// Netlify Function for MAC staff authentication
exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    // Parse the request body
    const { username, password } = JSON.parse(event.body);

    // In a production environment, you would validate against a database
    // For now, we'll use a simple validation for demonstration
    const validCredentials = [
      { username: 'macstaff', password: 'auction2025', role: 'staff' },
      { username: 'macadmin', password: 'secure2025', role: 'admin' }
    ];

    // Find matching credentials
    const user = validCredentials.find(
      (cred) => cred.username === username && cred.password === password
    );

    if (user) {
      // Generate a simple JWT-like token (in production, use a proper JWT library)
      const token = Buffer.from(
        JSON.stringify({
          username: user.username,
          role: user.role,
          exp: Date.now() + 3600000 // 1 hour expiration
        })
      ).toString('base64');

      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'Authentication successful',
          token,
          user: {
            username: user.username,
            role: user.role
          }
        })
      };
    } else {
      return {
        statusCode: 401,
        body: JSON.stringify({ message: 'Invalid credentials' })
      };
    }
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Server error', error: error.toString() })
    };
  }
};
