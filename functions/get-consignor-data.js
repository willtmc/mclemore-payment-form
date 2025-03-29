// Netlify Function to retrieve consignor data
const axios = require('axios');
const cheerio = require('cheerio');

exports.handler = async (event, context) => {
  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    // Verify authentication token
    const authHeader = event.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { statusCode: 401, body: JSON.stringify({ message: 'Unauthorized' }) };
    }

    const token = authHeader.split(' ')[1];
    let tokenData;
    
    try {
      tokenData = JSON.parse(Buffer.from(token, 'base64').toString());
      
      // Check if token is expired
      if (tokenData.exp < Date.now()) {
        return { statusCode: 401, body: JSON.stringify({ message: 'Token expired' }) };
      }
    } catch (e) {
      return { statusCode: 401, body: JSON.stringify({ message: 'Invalid token' }) };
    }

    // Get auction code and consignor ID from query parameters
    const auctionCode = event.queryStringParameters.auctionCode;
    const consignorId = event.queryStringParameters.consignorId;

    if (!auctionCode || !consignorId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Missing required parameters' })
      };
    }

    // Fetch real data from McLemore Auction admin system
    try {
      // First, authenticate with the admin system
      const loginUrl = 'https://www.mclemoreauction.com/admin/login';
      const adminUsername = process.env.ADMIN_USERNAME;
      const adminPassword = process.env.ADMIN_PASSWORD;
      
      if (!adminUsername || !adminPassword) {
        throw new Error('Admin credentials not configured');
      }
      
      // Create a cookie jar for session management
      const cookieJar = {};
      
      // Step 1: Get the login page to extract any CSRF token if needed
      const loginPageResponse = await axios.get(loginUrl);
      let csrfToken = '';
      
      // Extract CSRF token if present (adjust selector based on actual page structure)
      const $ = cheerio.load(loginPageResponse.data);
      csrfToken = $('input[name="csrf_token"]').val() || '';
      
      // Store cookies from the login page response
      if (loginPageResponse.headers['set-cookie']) {
        loginPageResponse.headers['set-cookie'].forEach(cookie => {
          const cookieParts = cookie.split(';')[0].split('=');
          cookieJar[cookieParts[0]] = cookieParts[1];
        });
      }
      
      // Step 2: Submit login credentials
      const loginFormData = new URLSearchParams();
      loginFormData.append('username', adminUsername);
      loginFormData.append('password', adminPassword);
      if (csrfToken) {
        loginFormData.append('csrf_token', csrfToken);
      }
      
      const loginResponse = await axios.post(loginUrl, loginFormData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': Object.entries(cookieJar).map(([key, value]) => `${key}=${value}`).join('; ')
        },
        maxRedirects: 0,
        validateStatus: status => status >= 200 && status < 400
      });
      
      // Update cookie jar with any new cookies
      if (loginResponse.headers['set-cookie']) {
        loginResponse.headers['set-cookie'].forEach(cookie => {
          const cookieParts = cookie.split(';')[0].split('=');
          cookieJar[cookieParts[0]] = cookieParts[1];
        });
      }
      
      // Step 3: Fetch the consignor statement data
      const statementUrl = `https://www.mclemoreauction.com/admin/statements/printreport/auction/${auctionCode}/sellerid/${consignorId}`;
      
      const statementResponse = await axios.get(statementUrl, {
        headers: {
          'Cookie': Object.entries(cookieJar).map(([key, value]) => `${key}=${value}`).join('; ')
        }
      });
      
      // Parse the HTML to extract consignor data
      const $statement = cheerio.load(statementResponse.data);
      
      // Extract consignor information (adjust selectors based on actual HTML structure)
      const consignorName = $statement('.consignor-name').text().trim() || 
                           $statement('h1, h2, h3').filter((i, el) => $statement(el).text().includes('Consignor')).first().text().trim();
      
      const consignorEmail = $statement('.consignor-email').text().trim() || 
                            $statement('td, p').filter((i, el) => $statement(el).text().includes('@')).first().text().trim();
      
      const auctionTitle = $statement('.auction-title').text().trim() || 
                          $statement('h1, h2').first().text().trim();
      
      const statementDate = $statement('.statement-date').text().trim() || 
                           new Date().toLocaleDateString();
      
      const totalDue = $statement('.total-due, .amount-due').text().trim() || 
                      $statement('td, p').filter((i, el) => $statement(el).text().includes('$')).first().text().trim();
      
      // Create consignor data object
      const consignorData = {
        auctionCode,
        consignorId,
        name: consignorName || 'Consignor Name Not Found',
        email: consignorEmail || 'email@example.com',
        auctionTitle: auctionTitle || 'Auction Title Not Found',
        statementDate: statementDate || new Date().toLocaleDateString(),
        totalDue: totalDue || '$0.00'
      };
      
      return {
        statusCode: 200,
        body: JSON.stringify(consignorData)
      };
      
    } catch (fetchError) {
      console.error('Error fetching consignor data:', fetchError);
      
      // For development/testing, fall back to mock data if real data fetch fails
      // In production, you would want to return an error instead
      const consignorDatabase = [
        {
          auctionCode: '2995',
          consignorId: '18',
          name: 'John Smith',
          email: 'john.smith@example.com',
          auctionTitle: 'Commercial Retail Fixtures, Drop-in Ceiling Tiles & Equipment Liquidation - Columbia, TN',
          statementDate: '03/29/2025',
          totalDue: '$819.62'
        },
        {
          auctionCode: '3006',
          consignorId: '145',
          name: 'Sarah Williams',
          email: 'sarah.williams@example.com',
          auctionTitle: 'Estate Liquidation - Franklin, TN',
          statementDate: '03/27/2025',
          totalDue: '$1,245.78'
        }
      ];

      // Find matching consignor data from mock database
      const mockConsignorData = consignorDatabase.find(
        (consignor) => consignor.auctionCode === auctionCode && consignor.consignorId === consignorId
      );

      if (mockConsignorData) {
        return {
          statusCode: 200,
          body: JSON.stringify(mockConsignorData)
        };
      } else {
        return {
          statusCode: 404,
          body: JSON.stringify({ 
            message: 'Consignor not found and real data fetch failed', 
            error: fetchError.message 
          })
        };
      }
    }
  } catch (error) {
    console.error('Server error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Server error', error: error.toString() })
    };
  }
};
