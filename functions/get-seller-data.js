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
    
    // Validate credentials
    if (!username || !password) {
      throw new Error('Admin credentials are required');
    }
    
    // Create a session to maintain cookies
    const session = axios.create({
      withCredentials: true,
      maxRedirects: 5
    });
    
    // Step 1: Get the login page first
    console.log('Getting login page...');
    const loginPageResponse = await session.get('https://www.mclemoreauction.com/admin/login');
    console.log('Login page status:', loginPageResponse.status);
    
    // Step 2: Submit login form
    console.log('Submitting login form...');
    const loginResponse = await session.post('https://www.mclemoreauction.com/admin/login', 
      {
        username: username,
        password: password,
        submit: 'Login'
      },
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Referer': 'https://www.mclemoreauction.com/admin/login'
        }
      }
    );
    
    console.log('Login response status:', loginResponse.status);
    console.log('Login response headers:', JSON.stringify(loginResponse.headers, null, 2));
    console.log('Login response data (start):', loginResponse.data ? loginResponse.data.substring(0, 500) : 'No data');
    
    // Check if login was successful by looking for error messages or redirects
    if (loginResponse.data && loginResponse.data.includes('Invalid username or password')) {
      throw new Error('Invalid admin credentials');
    }
    
    // Step 3: Fetch the statement
    const statementUrl = `https://www.mclemoreauction.com/admin/statements/printreport/auction/${auctionCode}/sellerid/${sellerId}`;
    console.log('Fetching statement URL:', statementUrl);
    
    const statementResponse = await session.get(statementUrl);
    console.log('Statement response status:', statementResponse.status);
    
    if (statementResponse.status !== 200) {
      throw new Error(`Failed to fetch statement: ${statementResponse.status}`);
    }
    
    return statementResponse.data;
  } catch (error) {
    console.error('Error fetching statement HTML:', error);
    throw error;
  }
}
