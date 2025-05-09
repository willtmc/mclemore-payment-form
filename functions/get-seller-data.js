// Netlify Function to retrieve seller data
const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Fetches seller data from the McLemore Auction admin system
 * @param {string} auctionCode - The auction code
 * @param {string} sellerId - The seller ID
 * @param {string} username - Admin username
 * @param {string} password - Admin password
 * @returns {Promise<Object>} - The seller data
 */
exports.handler = async function(event, context) {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  // Parse the request body
  let requestBody;
  try {
    requestBody = JSON.parse(event.body);
  } catch (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid request body' })
    };
  }

  // Extract parameters from request
  const { auctionCode, sellerId, username, password } = requestBody;

  // Validate required parameters
  if (!auctionCode || !sellerId) {
    console.error('Missing required parameters', { auctionCode, sellerId });
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing required parameters: auctionCode and sellerId' })
    };
  }
  
  // Log received credentials (without the actual values)
  console.log('Received credentials:', {
    usernameLength: username ? username.length : 0,
    passwordLength: password ? password.length : 0,
    hasUsername: !!username,
    hasPassword: !!password
  });
  
  // Validate credentials
  if (!username || !password) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Admin credentials are required' })
    };
  }

  try {
    // Get seller data
    const sellerData = await getSellerData(auctionCode, sellerId, username, password);

    return {
      statusCode: 200,
      body: JSON.stringify(sellerData)
    };
  } catch (error) {
    console.error('Error fetching seller data:', error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to fetch seller data',
        message: error.message || 'Internal Server Error'
      })
    };
  }
};

/**
 * Gets seller data from the McLemore Auction admin system
 * @param {string} auctionCode - The auction code
 * @param {string} sellerId - The seller ID (seller ID)
 * @param {string} username - Admin username
 * @param {string} password - Admin password
 * @returns {Promise<Object>} - The seller data
 */
async function getSellerData(auctionCode, sellerId, username, password) {
  try {
    console.log('Fetching seller data for auction:', auctionCode, 'seller ID:', sellerId);
    
    // Fetch the statement HTML
    const statementHtml = await fetchStatementHtml(auctionCode, sellerId, username, password);
    
    // Load the HTML into cheerio for parsing
    const $ = cheerio.load(statementHtml);
    
    // Initialize variables to store extracted data
    let sellerName = '';
    let sellerEmail = '';
    let auctionTitle = '';
    let statementDate = '';
    let totalDue = '';
    
    // Log the HTML for debugging
    console.log('Statement HTML length:', statementHtml.length);
    console.log('First 500 chars of statement HTML:', statementHtml.substring(0, 500));
    
    // Extract the full text content for pattern matching
    const fullText = $('body').text();
    console.log('Full text length:', fullText.length);
    console.log('Text sample:', fullText.substring(0, 500));
    
    // Extract seller name using the specific format from the example
    console.log('Extracting seller name...');
    
    // Pattern: Seller Number: 1234  Seller Name Here
    const sellerPattern = /Seller\s+Number:\s*(\d+)\s+([^\n\r]+?)(?=\s+\d+|\s+Phone|\s+McLemore|$)/i;
    const sellerMatch = fullText.match(sellerPattern);
    
    if (sellerMatch && sellerMatch[2]) {
      sellerName = sellerMatch[2].trim();
      console.log('Found seller name from seller pattern:', sellerName);
    } else {
      // Try simpler pattern: Seller : Name Here or Consignor#: 123 Name Here
      const simpleNamePattern = /(?:Seller|Consignor)\s*(?:Number|#)?\s*:\s*(?:\d+\s+)?([^\n\r]+?)(?=\s+\d+|\s+Phone|\s+McLemore|$)/i;
      const simpleNameMatch = fullText.match(simpleNamePattern);
      
      if (simpleNameMatch && simpleNameMatch[1]) {
        sellerName = simpleNameMatch[1].trim();
        console.log('Found seller name from simple pattern:', sellerName);
      } else {
        // Fallback to generic name if no specific pattern matches
        sellerName = `Seller ${sellerId}`;
        console.log('Using generic seller name:', sellerName);
      }
    }
    
    // Extract seller email
    console.log('Extracting seller email...');
    
    // Pattern: Email: email@example.com
    const emailPattern = /Email\s*:\s*([\w.-]+@[\w.-]+\.[a-zA-Z]{2,})/i;
    const emailMatch = fullText.match(emailPattern);
    
    if (emailMatch && emailMatch[1]) {
      sellerEmail = emailMatch[1].trim();
      console.log('Found seller email from pattern:', sellerEmail);
    } else {
      // Fallback: Look for any email address pattern in the text
      const anyEmailPattern = /[\w.-]+@[\w.-]+\.[a-zA-Z]{2,}/g;
      const anyEmails = fullText.match(anyEmailPattern);
      
      if (anyEmails && anyEmails.length > 0) {
        // Use the first email found
        sellerEmail = anyEmails[0];
        console.log('Found email in text:', sellerEmail);
      } else {
        // If no email found, construct one from seller ID
        sellerEmail = `${sellerId}@mclemoreauction.com`;
        console.log('Using constructed email:', sellerEmail);
      }
    }
    
    // Extract auction title
    console.log('Extracting auction title...');
    
    // Pattern: "Statement For: Title"
    const titlePattern = /Statement\s+For:\s*([^\n\r]+)/i;
    const titleMatch = fullText.match(titlePattern);
    
    if (titleMatch && titleMatch[1]) {
      auctionTitle = titleMatch[1].trim();
      console.log('Found auction title:', auctionTitle);
    } else {
      auctionTitle = `Auction #${auctionCode}`;
      console.log('Using generic auction title:', auctionTitle);
    }
    
    // Extract statement date
    console.log('Extracting statement date...');
    
    // Pattern: "Statement Date: Date"
    const datePattern = /Statement\s+Date:\s*([^\n\r]+)/i;
    const dateMatch = fullText.match(datePattern);
    
    if (dateMatch && dateMatch[1]) {
      statementDate = dateMatch[1].trim();
      console.log('Found statement date:', statementDate);
    } else {
      statementDate = new Date().toLocaleDateString();
      console.log('Using current date:', statementDate);
    }
    
    // Extract total amount due
    console.log('Extracting total amount due...');
    
    // Pattern: "Total Amount Due $Amount"
    const amountPattern = /Total\s+Amount\s+Due\s+\$([\d,.]+)/i;
    const amountMatch = fullText.match(amountPattern);
    
    if (amountMatch && amountMatch[1]) {
      totalDue = amountMatch[1].trim();
      console.log('Found total amount due:', totalDue);
    } else {
      // Try a simpler pattern
      const simpleAmountPattern = /(?:Total|Due|Amount)\s+\$([\d,.]+)/i;
      const simpleAmountMatch = fullText.match(simpleAmountPattern);
      
      if (simpleAmountMatch && simpleAmountMatch[1]) {
        totalDue = simpleAmountMatch[1].trim();
        console.log('Found amount from simple pattern:', totalDue);
      } else {
        totalDue = '0.00';
        console.log('Using default amount:', totalDue);
      }
    }
    
    // Create the seller data object
    const sellerData = {
      name: sellerName || `Seller ${sellerId}`,
      email: sellerEmail || '',
      auctionTitle: auctionTitle || `Auction #${auctionCode}`,
      statementDate: statementDate || new Date().toLocaleDateString(),
      totalDue: totalDue || '0.00'
    };
    
    console.log('Successfully extracted seller data:', JSON.stringify(sellerData));
    return sellerData;
  } catch (error) {
    console.error('Error in getSellerData:', error);
    throw new Error(`Failed to get seller data: ${error.message}`);
  }
}

/**
 * Fetches statement HTML using provided credentials
 * @param {string} auctionCode - The auction code
 * @param {string} sellerId - The seller ID (seller ID)
 * @param {string} username - Admin username
 * @param {string} password - Admin password
 * @returns {Promise<string>} - The statement HTML
 */
async function fetchStatementHtml(auctionCode, sellerId, username, password) {
  try {
    console.log('Fetching statement HTML for auction:', auctionCode, 'seller ID:', sellerId);
    
    // Log credentials being used (without the actual values)
    console.log('Using credentials:', {
      usernameLength: username ? username.length : 0,
      passwordLength: password ? password.length : 0,
      hasUsername: !!username,
      hasPassword: !!password
    });
    
    // Validate credentials
    if (!username || !password) {
      throw new Error('Admin credentials are required');
    }

    // Create a cookie jar for proper cookie management
    const { CookieJar } = require('tough-cookie');
    const { wrapper } = require('axios-cookiejar-support');
    const cookieJar = new CookieJar();
    
    // Create a session that will maintain cookies
    const session = wrapper(axios.create({
      jar: cookieJar,
      withCredentials: true,
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Origin': 'https://www.mclemoreauction.com',
        'Referer': 'https://www.mclemoreauction.com/login/',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin'
      }
    }));
    
    // Step 1: Get login page first
    console.log('Step 1: Fetching login page...');
    const loginPageUrl = 'https://www.mclemoreauction.com/login';
    const loginPageResponse = await session.get(loginPageUrl);
    console.log('Login page status:', loginPageResponse.status);
    
    // Step 2: Check cookies
    console.log('Step 2: Checking cookies...');
    const cookiesResponse = await session.get('https://www.mclemoreauction.com/api/cookies');
    console.log('Cookies response status:', cookiesResponse.status);
    
    // Step 3: Get session
    console.log('Step 3: Getting session...');
    const sessionResponse = await session.get('https://www.mclemoreauction.com/api/getsession');
    console.log('Session response status:', sessionResponse.status);
    
    // Step 4: Set request URL
    console.log('Step 4: Setting request URL...');
    const setUrlResponse = await session.post(
      'https://www.mclemoreauction.com/api/setrequesturl',
      'url=https://www.mclemoreauction.com/',
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    console.log('Set URL response status:', setUrlResponse.status);
    
    // Step 5: Login
    console.log('Step 5: Attempting login...');
    const loginData = new URLSearchParams();
    loginData.append('user_name', username);
    loginData.append('password', password);
    loginData.append('autologin', '');
    
    // Create a new session for login with proper headers
    const loginSession = wrapper(axios.create({
      jar: cookieJar,
      withCredentials: true,
      maxRedirects: 0,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest',
        'Origin': 'https://www.mclemoreauction.com',
        'Referer': 'https://www.mclemoreauction.com/login/',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Dest': 'empty'
      }
    }));
    
    const loginResponse = await loginSession.post(
      'https://www.mclemoreauction.com/api/ajaxlogin',
      loginData.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    console.log('Login response status:', loginResponse.status);
    
    // Check if login was successful
    const responseData = loginResponse.data;
    const hasSessionToken = loginResponse.headers['set-cookie']?.some(cookie => cookie.includes('sessiontoken'));
    
    if (responseData.status !== 'success' || !hasSessionToken) {
      throw new Error(`Login failed: ${responseData.msg || 'Unknown error'}`);
    }
    
    // Step 6: Get initial data
    console.log('Step 6: Getting initial data...');
    session.defaults.headers['Referer'] = 'https://www.mclemoreauction.com/';
    const initDataResponse = await session.get('https://www.mclemoreauction.com/api/initdata');
    console.log('Init data response status:', initDataResponse.status);
    
    // Step 7: Get auctions data
    console.log('Step 7: Getting auctions data...');
    const auctionsData = new URLSearchParams();
    auctionsData.append('past_sales', 'false');
    auctionsData.append('meta_also', 'true');
    
    const auctionsResponse = await session.post(
      'https://www.mclemoreauction.com/api/auctions',
      auctionsData.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    console.log('Auctions data status:', auctionsResponse.status);
    
    // Step 8: Get the statement
    console.log('Step 8: Getting statement...');
    const statementUrl = `https://www.mclemoreauction.com/admin/statements/printreport/auction/${auctionCode}/sellerid/${sellerId}`;
    console.log('Fetching statement URL:', statementUrl);
    
    const statementResponse = await session.get(statementUrl, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Referer': 'https://www.mclemoreauction.com/admin/',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    console.log('Statement response status:', statementResponse.status);
    
    if (statementResponse.status !== 200) {
      throw new Error(`Failed to fetch statement: ${statementResponse.status}`);
    }
    
    // Check if we got the actual statement data
    const responseHtml = statementResponse.data;
    if (responseHtml.includes('ng-app="rwd"')) {
      // We got the login page instead of the statement
      console.log('Received login page instead of statement. Checking for error messages...');
      
      // Try to extract any error messages from the response
      const $ = cheerio.load(responseHtml);
      const errorMessages = [];
      
      // Look for common error message containers
      $('.alert-danger, .alert-error, .error-message, .message-error').each((i, el) => {
        errorMessages.push($(el).text().trim());
      });
      
      // Look for error messages in the page content
      const pageText = $('body').text();
      const errorPatterns = [
        /error\s*:\s*([^\n]+)/i,
        /failed\s*:\s*([^\n]+)/i,
        /invalid\s*:\s*([^\n]+)/i
      ];
      
      errorPatterns.forEach(pattern => {
        const matches = pageText.match(pattern);
        if (matches && matches[1]) {
          errorMessages.push(matches[1].trim());
        }
      });
      
      if (errorMessages.length > 0) {
        throw new Error(`Login failed: ${errorMessages.join(', ')}`);
      } else {
        throw new Error('Received login page instead of statement data');
      }
    }
    
    return responseHtml;
  } catch (error) {
    console.error('Error fetching statement HTML:', error);
    throw error;
  }
}
