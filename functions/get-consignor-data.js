// Netlify Function to retrieve consignor data
const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Fetches consignor data from the McLemore Auction admin system
 * @param {string} auctionCode - The auction code
 * @param {string} consignorId - The consignor ID
 * @returns {Promise<Object>} - The consignor data
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

  // Extract auction code and consignor ID from request
  const { auctionCode, consignorId } = requestBody;

  // Validate required parameters
  if (!auctionCode || !consignorId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing required parameters: auctionCode and consignorId' })
    };
  }

  try {
    // Get consignor data
    const consignorData = await getConsignorData(auctionCode, consignorId);

    return {
      statusCode: 200,
      body: JSON.stringify(consignorData)
    };
  } catch (error) {
    console.error('Error fetching consignor data:', error);

    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Failed to fetch consignor data', 
        message: error.message 
      })
    };
  }
};

/**
 * Gets consignor data from the McLemore Auction admin system
 * @param {string} auctionCode - The auction code
 * @param {string} consignorId - The consignor ID
 * @returns {Promise<Object>} - The consignor data
 */
async function getConsignorData(auctionCode, consignorId) {
  try {
    console.log('Fetching consignor data for auction:', auctionCode, 'consignor:', consignorId);
    
    // Fetch the statement HTML
    const statementHtml = await fetchStatementHtml(auctionCode, consignorId);
    
    // Load the HTML into cheerio for parsing
    const $ = cheerio.load(statementHtml);
    
    // Initialize variables to store extracted data
    let consignorName = '';
    let consignorEmail = '';
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
    
    // Extract consignor name using the specific format from the example
    console.log('Extracting consignor name...');
    
    // Pattern: "Seller Number: XX Name"
    const sellerPattern = /Seller\s+Number:\s*(\d+)\s+([^\n\r]+?)(?=\s+\d+|\s+Phone|\s+McLemore|$)/i;
    const sellerMatch = fullText.match(sellerPattern);
    
    if (sellerMatch && sellerMatch[2]) {
      consignorName = sellerMatch[2].trim();
      console.log('Found consignor name from seller pattern:', consignorName);
    } else {
      // Fallback to a simpler pattern if the specific one doesn't match
      const simpleNamePattern = /(?:Seller|Consignor)\s*(?:Number|#)?\s*:\s*(?:\d+\s+)?([^\n\r]+?)(?=\s+\d+|\s+Phone|\s+McLemore|$)/i;
      const simpleNameMatch = fullText.match(simpleNamePattern);
      
      if (simpleNameMatch && simpleNameMatch[1]) {
        consignorName = simpleNameMatch[1].trim();
        console.log('Found consignor name from simple pattern:', consignorName);
      } else {
        // If still not found, use a very generic approach
        consignorName = `Consignor ${consignorId}`;
        console.log('Using generic consignor name:', consignorName);
      }
    }
    
    // Extract consignor email
    console.log('Extracting consignor email...');
    
    // Pattern: "Email: email@example.com"
    const emailPattern = /Email\s*:\s*([\w.-]+@[\w.-]+\.[a-zA-Z]{2,})/i;
    const emailMatch = fullText.match(emailPattern);
    
    if (emailMatch && emailMatch[1]) {
      consignorEmail = emailMatch[1].trim();
      console.log('Found consignor email from pattern:', consignorEmail);
    } else {
      // Try to find any email address in the text
      const anyEmailPattern = /[\w.-]+@[\w.-]+\.[a-zA-Z]{2,}/g;
      const anyEmails = fullText.match(anyEmailPattern);
      
      if (anyEmails && anyEmails.length > 0) {
        // Use the first email found
        consignorEmail = anyEmails[0];
        console.log('Found email in text:', consignorEmail);
      } else {
        // If no email found, construct one from consignor ID
        consignorEmail = `${consignorId}@mclemoreauction.com`;
        console.log('Using constructed email:', consignorEmail);
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
    
    // Create the consignor data object
    const consignorData = {
      name: consignorName || `Consignor ${consignorId}`,
      email: consignorEmail || '',
      auctionTitle: auctionTitle || `Auction #${auctionCode}`,
      statementDate: statementDate || new Date().toLocaleDateString(),
      totalDue: totalDue || '0.00'
    };
    
    console.log('Successfully extracted consignor data:', JSON.stringify(consignorData));
    return consignorData;
  } catch (error) {
    console.error('Error in getConsignorData:', error);
    throw error;
  }
}

/**
 * Fetches the statement HTML from the McLemore Auction admin system
 * @param {string} auctionCode - The auction code
 * @param {string} consignorId - The consignor ID (seller ID)
 * @returns {Promise<string>} - The statement HTML
 */
async function fetchStatementHtml(auctionCode, consignorId) {
  try {
    console.log('Fetching statement HTML for auction:', auctionCode, 'seller ID:', consignorId);
    
    // Get credentials from environment variables
    const username = process.env.ADMIN_USERNAME;
    const password = process.env.ADMIN_PASSWORD;
    
    if (!username || !password) {
      throw new Error('Admin credentials not found in environment variables');
    }
    
    // Create a session to maintain cookies
    const session = axios.create({
      withCredentials: true,
      maxRedirects: 5
    });
    
    // Step 1: Login to the admin system
    console.log('Logging in to admin system...');
    const loginResponse = await session.post('https://www.mclemoreauction.com/admin/login', 
      `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`, 
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    console.log('Login response status:', loginResponse.status);
    
    // Step 2: Fetch the statement
    // Using the correct URL format with sellerid parameter
    const statementUrl = `https://www.mclemoreauction.com/admin/statements/printreport/auction/${auctionCode}/sellerid/${consignorId}`;
    console.log('Fetching statement from:', statementUrl);
    
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
