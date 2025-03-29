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
      console.log('Starting to fetch real consignor data for auction:', auctionCode, 'consignor:', consignorId);
      
      // First, authenticate with the admin system
      const loginUrl = 'https://www.mclemoreauction.com/admin/login';
      const adminUsername = process.env.ADMIN_USERNAME;
      const adminPassword = process.env.ADMIN_PASSWORD;
      
      console.log('Checking admin credentials...');
      if (!adminUsername || !adminPassword) {
        console.error('Admin credentials not configured');
        throw new Error('Admin credentials not configured');
      }
      
      console.log('Admin credentials found, proceeding with authentication');
      
      // Create a cookie jar for session management
      const cookieJar = {};
      
      // Step 1: Get the login page to extract any CSRF token if needed
      console.log('Fetching login page...');
      const loginPageResponse = await axios.get(loginUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36'
        }
      });
      console.log('Login page fetched successfully');
      
      let csrfToken = '';
      
      // Extract CSRF token if present
      const $ = cheerio.load(loginPageResponse.data);
      
      // Look for common CSRF token input fields
      csrfToken = $('input[name="csrf_token"]').val() || 
                 $('input[name="_token"]').val() || 
                 $('meta[name="csrf-token"]').attr('content') || '';
      
      console.log('CSRF token found:', csrfToken ? 'Yes' : 'No');
      
      // Store cookies from the login page response
      if (loginPageResponse.headers['set-cookie']) {
        console.log('Storing cookies from login page');
        loginPageResponse.headers['set-cookie'].forEach(cookie => {
          const cookieParts = cookie.split(';')[0].split('=');
          cookieJar[cookieParts[0]] = cookieParts[1];
        });
      }
      
      // Step 2: Submit login credentials
      console.log('Submitting login credentials...');
      
      // Find the login form and its fields
      const loginForm = $('form').filter((i, el) => {
        const action = $(el).attr('action') || '';
        return action.includes('login') || action === '';
      }).first();
      
      const usernameField = loginForm.find('input[type="text"], input[type="email"], input[name="username"]').attr('name') || 'username';
      const passwordField = loginForm.find('input[type="password"]').attr('name') || 'password';
      const csrfField = loginForm.find('input[name="csrf_token"], input[name="_token"]').attr('name') || 'csrf_token';
      
      console.log(`Form fields identified - username: ${usernameField}, password: ${passwordField}, csrf: ${csrfField}`);
      
      const loginFormData = new URLSearchParams();
      loginFormData.append(usernameField, adminUsername);
      loginFormData.append(passwordField, adminPassword);
      if (csrfToken && csrfField) {
        loginFormData.append(csrfField, csrfToken);
      }
      
      const loginResponse = await axios.post(loginUrl, loginFormData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': Object.entries(cookieJar).map(([key, value]) => `${key}=${value}`).join('; '),
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36',
          'Referer': loginUrl
        },
        maxRedirects: 0,
        validateStatus: status => status >= 200 && status < 400
      });
      
      console.log('Login response status:', loginResponse.status);
      
      // Update cookie jar with any new cookies
      if (loginResponse.headers['set-cookie']) {
        console.log('Storing cookies from login response');
        loginResponse.headers['set-cookie'].forEach(cookie => {
          const cookieParts = cookie.split(';')[0].split('=');
          cookieJar[cookieParts[0]] = cookieParts[1];
        });
      }
      
      // Step 3: Fetch the consignor statement data
      const statementUrl = `https://www.mclemoreauction.com/admin/statements/printreport/auction/${auctionCode}/sellerid/${consignorId}`;
      console.log('Fetching statement data from:', statementUrl);
      
      const statementResponse = await axios.get(statementUrl, {
        headers: {
          'Cookie': Object.entries(cookieJar).map(([key, value]) => `${key}=${value}`).join('; '),
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36',
          'Referer': 'https://www.mclemoreauction.com/admin/statements'
        }
      });
      
      console.log('Statement data fetched successfully');
      
      // Parse the HTML to extract consignor data
      const $statement = cheerio.load(statementResponse.data);
      console.log('HTML loaded for parsing');
      
      // Save HTML for debugging
      const htmlContent = statementResponse.data;
      console.log('HTML content length:', htmlContent.length);
      
      // Extract consignor information with more robust selectors
      let consignorName = '';
      let consignorEmail = '';
      let auctionTitle = '';
      let statementDate = '';
      let totalDue = '';
      
      // Try different selectors for consignor name
      consignorName = $statement('.consignor-name').text().trim();
      if (!consignorName) {
        // Look for elements containing "Consignor" text
        $statement('*').each((i, el) => {
          const text = $statement(el).text();
          if (text.includes('Consignor:') || text.includes('Seller:')) {
            consignorName = text.replace(/Consignor:|Seller:/i, '').trim();
            return false; // break the loop
          }
        });
      }
      console.log('Extracted consignor name:', consignorName || 'Not found');
      
      // Try different selectors for consignor email
      consignorEmail = $statement('.consignor-email').text().trim();
      if (!consignorEmail) {
        // Look for elements containing @ symbol
        $statement('*').each((i, el) => {
          const text = $statement(el).text();
          if (text.includes('@') && text.includes('.')) {
            // Extract email using regex
            const emailMatch = text.match(/[\w.-]+@[\w.-]+\.[\w.-]+/);
            if (emailMatch) {
              consignorEmail = emailMatch[0];
              return false; // break the loop
            }
          }
        });
      }
      console.log('Extracted consignor email:', consignorEmail || 'Not found');
      
      // Try different selectors for auction title
      auctionTitle = $statement('.auction-title, .auction-name').text().trim();
      if (!auctionTitle) {
        // Usually the first h1 or h2 is the auction title
        auctionTitle = $statement('h1').first().text().trim() || 
                      $statement('h2').first().text().trim() ||
                      $statement('title').text().trim();
      }
      console.log('Extracted auction title:', auctionTitle || 'Not found');
      
      // Try different selectors for statement date
      statementDate = $statement('.statement-date, .date').text().trim();
      if (!statementDate) {
        // Look for date patterns
        $statement('*').each((i, el) => {
          const text = $statement(el).text();
          const dateMatch = text.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/);
          if (dateMatch) {
            statementDate = dateMatch[0];
            return false; // break the loop
          }
        });
      }
      console.log('Extracted statement date:', statementDate || 'Not found');
      
      // Try different selectors for total due
      totalDue = $statement('.total-due, .amount-due, .balance-due').text().trim();
      if (!totalDue) {
        // Look for currency patterns
        $statement('*').each((i, el) => {
          const text = $statement(el).text();
          if (text.includes('$') && /\$[\d,.]+/.test(text)) {
            const amountMatch = text.match(/\$[\d,.]+/);
            if (amountMatch) {
              totalDue = amountMatch[0];
              return false; // break the loop
            }
          }
        });
      }
      console.log('Extracted total due:', totalDue || 'Not found');
      
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
      
      console.log('Returning consignor data:', consignorData);
      return {
        statusCode: 200,
        body: JSON.stringify(consignorData)
      };
      
    } catch (fetchError) {
      console.error('Error fetching consignor data:', fetchError.message);
      if (fetchError.response) {
        console.error('Response status:', fetchError.response.status);
        console.error('Response headers:', JSON.stringify(fetchError.response.headers));
      }
      
      // For development/testing, fall back to mock data if real data fetch fails
      console.log('Falling back to mock data');
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
    console.error('Server error:', error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Server error', error: error.toString() })
    };
  }
};
