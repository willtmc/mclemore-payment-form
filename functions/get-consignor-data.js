// Netlify Function to retrieve consignor data
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs'); // For debugging file writes
const path = require('path');

// Base URL for the McLemore Auction admin system
const BASE_URL = 'https://www.mclemoreauction.com';

// Configure axios defaults
const axiosInstance = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  maxRedirects: 5,
  timeout: 30000, // Increase timeout for production environment
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
  }
});

// Helper function to save debug HTML in development only
const saveDebugHTML = (filename, content) => {
  // Only save debug files in development environment
  if (process.env.NODE_ENV !== 'production') {
    try {
      const tempDir = process.env.NETLIFY ? '/tmp' : '/tmp';
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      const filePath = path.join(tempDir, filename);
      fs.writeFileSync(filePath, content);
      console.log(`Saved ${filename} HTML to ${filePath}`);
    } catch (error) {
      console.error(`Error saving debug HTML: ${error.message}`);
    }
  }
};

/**
 * Netlify function to fetch consignor data from McLemore Auction
 * This function authenticates with the McLemore Auction admin system and retrieves
 * consignor statement data for a specific auction and consignor ID.
 */
async function getConsignorData(event, context) {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  console.log('Starting get-consignor-data function...');

  try {
    // Parse request body
    const data = JSON.parse(event.body);
    const { username, password, auctionCode, consignorId } = data;
    
    // Validate required parameters
    if (!username || !password || !auctionCode || !consignorId) {
      throw new Error('Missing required parameters. Please provide username, password, auctionCode, and consignorId.');
    }
    
    console.log(`Attempting to fetch data for auction ${auctionCode}, consignor ${consignorId}`);
    console.log(`Debug info - Username: ${username}, Password: [REDACTED]`);
    
    // Create a cookie jar to store cookies between requests
    const cookieJar = {};
    
    // Intercept responses to capture cookies
    axiosInstance.interceptors.response.use(response => {
      const cookies = response.headers['set-cookie'];
      if (cookies) {
        cookies.forEach(cookie => {
          const [cookieMain] = cookie.split(';');
          const [cookieName, cookieValue] = cookieMain.split('=');
          cookieJar[cookieName] = cookieValue;
        });
        
        // Update cookies for future requests
        const cookieString = Object.entries(cookieJar)
          .map(([name, value]) => `${name}=${value}`)
          .join('; ');
        
        axiosInstance.defaults.headers.common['Cookie'] = cookieString;
        console.log('Updated cookies:', cookieString);
      }
      return response;
    });
    
    // Follow the exact same login steps as in invoice_scraper.py
    
    // Step 1: Get login page first
    console.log('Step 1: Fetching login page...');
    const loginPageUrl = `${BASE_URL}/login`;
    const loginPageResponse = await axiosInstance.get(loginPageUrl);
    console.log(`Login page status: ${loginPageResponse.status}`);
    
    // Save login page HTML for debugging
    saveDebugHTML('login-page.html', loginPageResponse.data);
    
    // Step 2: Check cookies
    console.log('Step 2: Checking cookies...');
    const cookiesResponse = await axiosInstance.get(`${BASE_URL}/api/cookies`);
    console.log(`Cookies check status: ${cookiesResponse.status}`);
    console.log('Cookies:', JSON.stringify(cookiesResponse.data));
    
    // Step 3: Get session
    console.log('Step 3: Getting session...');
    const sessionUrl = `${BASE_URL}/api/getsession`;
    const sessionResponse = await axiosInstance.get(sessionUrl);
    console.log(`Session response status: ${sessionResponse.status}`);
    console.log('Session data:', JSON.stringify(sessionResponse.data));
    
    // Step 4: Set request URL
    console.log('Step 4: Setting request URL...');
    const setRequestUrlData = {
      url: BASE_URL + '/'
    };
    const setRequestUrlResponse = await axiosInstance.post(
      `${BASE_URL}/api/setrequesturl`,
      setRequestUrlData
    );
    console.log(`Set request URL status: ${setRequestUrlResponse.status}`);
    
    // Step 5: Perform login
    console.log('Step 5: Attempting login...');
    const loginUrl = `${BASE_URL}/api/ajaxlogin`;
    const loginData = {
      user_name: username,
      password: password,
      autologin: ''
    };
    
    // Make the login request with allow_redirects=False like in Python
    const loginResponse = await axiosInstance.post(loginUrl, loginData, {
      maxRedirects: 0,
      validateStatus: status => status >= 200 && status < 400
    });
    console.log(`Login response status: ${loginResponse.status}`);
    console.log('Login response data:', JSON.stringify(loginResponse.data));
    
    // Check if login was successful
    const responseData = loginResponse.data;
    
    // Check for success in either the response status or cookies like in Python
    if (responseData.status !== 'success' && !loginResponse.headers['set-cookie']?.some(c => c.includes('sessiontoken'))) {
      throw new Error(`Login failed: ${responseData.msg || 'Unknown error'}`);
    }
    
    console.log('Login successful! Initializing session data...');
    
    // Step 6: Get initial data (required after login)
    console.log('Step 6: Fetching initial data...');
    axiosInstance.defaults.headers.common['Referer'] = BASE_URL + '/';
    const initDataResponse = await axiosInstance.get(`${BASE_URL}/api/initdata`);
    console.log(`Init data status: ${initDataResponse.status}`);
    console.log('Init data:', JSON.stringify(initDataResponse.data));
    
    // Step 7: Get auctions data (required after login)
    console.log('Step 7: Fetching auctions data...');
    const auctionsData = {
      past_sales: 'false',
      meta_also: 'true'
    };
    const auctionsResponse = await axiosInstance.post(
      `${BASE_URL}/api/auctions`,
      auctionsData
    );
    console.log(`Auctions data status: ${auctionsResponse.status}`);
    console.log('Auctions data:', JSON.stringify(auctionsResponse.data));
    
    console.log('Session fully initialized!');
    
    // Now try to fetch the consignor statement
    console.log('Attempting to fetch consignor statement...');
    
    // Try multiple potential statement URLs, starting with the most likely ones
    const urlPatterns = [
      `/admin/statements/printreport/auction/${auctionCode}/sellerid/${consignorId}`,
      `/statements/printreport/auction/${auctionCode}/sellerid/${consignorId}`,
      `/admin/statements/view/auction/${auctionCode}/sellerid/${consignorId}`,
      `/statements/view/auction/${auctionCode}/sellerid/${consignorId}`,
      `/admin/statements/printreport/${auctionCode}/${consignorId}`,
      `/statements/printreport/${auctionCode}/${consignorId}`,
      `/admin/statements/view/${auctionCode}/${consignorId}`,
      `/statements/view/${auctionCode}/${consignorId}`
    ];
    
    let statementResponse = null;
    let successUrl = null;
    
    for (const urlPattern of urlPatterns) {
      try {
        console.log(`Trying URL pattern: ${urlPattern}`);
        const response = await axiosInstance.get(BASE_URL + urlPattern, { 
          maxRedirects: 5,
          headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Referer': `${BASE_URL}/admin/dashboard`
          }
        });
        
        if (response.status === 200) {
          // Check if the response contains statement-related content
          const html = response.data;
          if (html.includes('Statement') || html.includes('Consignor') || 
              html.includes('Seller') || html.includes('Total Due')) {
            console.log(`Success with URL pattern: ${urlPattern}`);
            statementResponse = response;
            successUrl = urlPattern;
            break;
          } else {
            console.log(`Got 200 response from ${urlPattern} but content doesn't appear to be a statement`);
          }
        }
      } catch (error) {
        console.log(`Failed with URL pattern ${urlPattern}: ${error.message}`);
      }
    }
    
    if (!statementResponse) {
      throw new Error('Failed to retrieve consignor statement. Could not find a valid URL pattern.');
    }
    
    console.log(`Successfully retrieved statement from ${successUrl}`);
    
    // Save statement HTML for debugging
    saveDebugHTML('statement.html', statementResponse.data);
    
    // Parse the HTML response with cheerio
    const $ = cheerio.load(statementResponse.data);
    
    // Extract consignor information with more robust selectors
    // Based on the approach in analyze_page.py
    let consignorName = '';
    let consignorEmail = '';
    let auctionTitle = '';
    let statementDate = '';
    let totalDue = '';
    
    // Extract consignor name using multiple approaches
    console.log('Extracting consignor name...');
    
    // Try direct class selectors
    const nameSelectors = [
      '.consignor-name', '.seller-name', '.customer-name', '.buyerName', '.name',
      'h1, h2, h3, h4, h5',
      'strong:contains("Consignor:")', 'strong:contains("Seller:")',
      'div:contains("Consignor:")', 'div:contains("Seller:")',
      'td:contains("Consignor:")', 'td:contains("Seller:")',
      'p:contains("Consignor:")', 'p:contains("Seller:")',
      'span:contains("Consignor:")', 'span:contains("Seller:")',
      'b:contains("Consignor:")', 'b:contains("Seller:")',
      'tr:contains("Consignor")', 'tr:contains("Seller")',
      'div.header', 'div.statement-header', 'div.consignor-info', 'div.seller-info'
    ];
    
    for (const selector of nameSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        const text = element.text().trim();
        if (text) {
          // Extract name from text that might contain labels
          const nameMatch = text.match(/(?:Consignor|Seller|Number)s?:?\s*([^\n\r]+)/);
          let extractedName = nameMatch ? nameMatch[1].trim() : text;
          
          // Clean up the name - try to extract just the company/person name
          if (extractedName.includes('McLemore Auction Company')) {
            // Extract the company name
            const companyMatch = extractedName.match(/(McLemore Auction Company[^\d]*)/);
            if (companyMatch) extractedName = companyMatch[1].trim();
          } else if (extractedName.includes('Number:')) {
            // Extract name from format "Number: XX Name"
            const numberNameMatch = extractedName.match(/Number:\s*\d+\s*(.+?)(?:House Bidder|Phone|\d{3}-\d{3}-\d{4}|$)/);
            if (numberNameMatch) extractedName = numberNameMatch[1].trim();
          }
          
          // Remove phone numbers and addresses
          extractedName = extractedName
            .replace(/\(\d{3}\)\s*\d{3}-\d{4}/, '')
            .replace(/\d{3}-\d{3}-\d{4}/, '')
            .replace(/\d+\s+[A-Za-z\s]+(?:Ave|St|Rd|Blvd|Drive|Dr|Lane|Ln|Court|Ct|Circle|Cir|Highway|Hwy|Parkway|Pkwy)\b[^,]*,[^,]*,[^,]*/, '')
            .replace(/House Bidder/i, '')
            .replace(/\s{2,}/g, ' ')
            .trim();
            
          consignorName = extractedName;
          console.log(`Found consignor name using selector ${selector}: ${consignorName}`);
          break;
        }
      }
    }
    
    // Extract consignor email
    console.log('Extracting consignor email...');
    
    // Try direct class selectors and email patterns
    const emailSelectors = [
      '.consignor-email', '.seller-email', '.customer-email', '.buyerEmail', '.email',
      'a[href^="mailto:"]',
      'span:contains("@")', 'div:contains("@")', 'td:contains("@")', 'p:contains("@")',
      'div.contact-info', 'div.email'
    ];
    
    for (const selector of emailSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        let text;
        
        // Special handling for mailto links
        if (selector === 'a[href^="mailto:"]') {
          const href = element.attr('href');
          text = href ? href.replace('mailto:', '') : element.text().trim();
        } else {
          text = element.text().trim();
        }
        
        // Extract email using regex
        const emailMatch = text.match(/[\w.-]+@[\w.-]+\.[a-zA-Z]{2,}/);
        if (emailMatch) {
          consignorEmail = emailMatch[0];
          console.log(`Found consignor email using selector ${selector}: ${consignorEmail}`);
          break;
        }
      }
    }
    
    // Extract auction title
    console.log('Extracting auction title...');
    
    // Try direct class selectors
    const auctionSelectors = [
      '.auction-title', '.auction-name', '.sale-name', '.sale-title',
      'h1:contains("Auction")', 'h2:contains("Auction")', 'h3:contains("Auction")',
      'div:contains("Auction")', 'strong:contains("Auction")', 'b:contains("Auction")',
      'span:contains("Auction")', 'p:contains("Auction")', 'td:contains("Auction")',
      'div.header:contains("Auction")', 'div.statement-header:contains("Auction")'
    ];
    
    for (const selector of auctionSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        const text = element.text().trim();
        if (text) {
          // Extract auction title from text that might contain labels
          const auctionMatch = text.match(/Auction:?\s*([^\n\r]+)/);
          let extractedTitle = auctionMatch ? auctionMatch[1].trim() : text;
          
          // Clean up the title - remove addresses and phone numbers
          extractedTitle = extractedTitle
            .replace(/\d+\s+[A-Za-z\s]+(?:Ave|St|Rd|Blvd|Drive|Dr|Lane|Ln|Court|Ct|Circle|Cir|Highway|Hwy|Parkway|Pkwy)\b[^,]*,[^,]*,[^,]*/, '')
            .replace(/\(\d{3}\)\s*\d{3}-\d{4}/, '')
            .replace(/\d{3}-\d{3}-\d{4}/, '')
            .replace(/FAX/, '')
            .replace(/mclemoreauction\.com/, '')
            .trim();
          
          // If we have auction code, use it in the title
          if (!extractedTitle.includes(auctionCode)) {
            extractedTitle = `Auction #${auctionCode}${extractedTitle ? ': ' + extractedTitle : ''}`;
          }
          
          auctionTitle = extractedTitle;
          console.log(`Found auction title using selector ${selector}: ${auctionTitle}`);
          break;
        }
      }
    }
    
    // Extract statement date
    console.log('Extracting statement date...');
    
    // Try direct class selectors
    const dateSelectors = [
      '.statement-date', '.date', '.report-date', '.invoice-date',
      'span:contains("Date")', 'div:contains("Date")', 'td:contains("Date")', 'p:contains("Date")',
      'strong:contains("Date")', 'b:contains("Date")'
    ];
    
    for (const selector of dateSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        const text = element.text().trim();
        if (text) {
          // Extract date from text that might contain labels
          const dateMatch = text.match(/(?:Date|Statement Date|Report Date):?\s*([^\n\r@]+)/);
          let extractedDate = dateMatch ? dateMatch[1].trim() : text;
          
          // Clean up the date - remove email and other text
          if (extractedDate.includes('Email:')) {
            extractedDate = extractedDate.split('Email:')[0].trim();
          }
          
          // Make sure it looks like a date
          const dateFormatMatch = extractedDate.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/);
          if (dateFormatMatch) {
            extractedDate = dateFormatMatch[1];
          }
          
          statementDate = extractedDate;
          console.log(`Found statement date using selector ${selector}: ${statementDate}`);
          break;
        }
      }
    }
    
    // Extract total due
    console.log('Extracting total due...');
    
    // Try direct class selectors
    const totalSelectors = [
      '.total-due', '.amount-due', '.balance-due', '.total', '.grand-total',
      'td:contains("Total Due")', 'td:contains("Balance Due")', 'td:contains("Amount Due")',
      'div:contains("Total Due")', 'div:contains("Balance Due")', 'div:contains("Amount Due")',
      'span:contains("Total Due")', 'span:contains("Balance Due")', 'span:contains("Amount Due")',
      'p:contains("Total Due")', 'p:contains("Balance Due")', 'p:contains("Amount Due")',
      'strong:contains("Total Due")', 'strong:contains("Balance Due")', 'strong:contains("Amount Due")',
      'b:contains("Total Due")', 'b:contains("Balance Due")', 'b:contains("Amount Due")'
    ];
    
    for (const selector of totalSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        const text = element.text().trim();
        if (text) {
          // Extract amount from text that might contain labels and currency symbols
          const amountMatch = text.match(/(?:Total Due|Balance Due|Amount Due|Total Amount Due):?\s*[$]?([\d,.]+)/);
          let extractedAmount = amountMatch ? amountMatch[1].trim() : text;
          
          // If we couldn't extract a number, try to find a sibling element with the amount
          if (!/^\d[\d,.]*$/.test(extractedAmount)) {
            // Try to find a sibling element with a dollar amount
            const siblings = element.siblings();
            siblings.each((i, sibling) => {
              const siblingText = $(sibling).text().trim();
              const siblingMatch = siblingText.match(/[$]?([\d,.]+)/);
              if (siblingMatch && /^\d[\d,.]*$/.test(siblingMatch[1])) {
                extractedAmount = siblingMatch[1];
                return false; // break the each loop
              }
            });
          }
          
          // If we still don't have a number, try the parent row
          if (!/^\d[\d,.]*$/.test(extractedAmount)) {
            const parentRow = element.closest('tr');
            if (parentRow.length > 0) {
              const rowText = parentRow.text().trim();
              const rowMatch = rowText.match(/[$]?([\d,.]+)/);
              if (rowMatch && /^\d[\d,.]*$/.test(rowMatch[1])) {
                extractedAmount = rowMatch[1];
              }
            }
          }
          
          // If we have a number, use it
          if (/^\d[\d,.]*$/.test(extractedAmount)) {
            totalDue = extractedAmount;
            console.log(`Found total due using selector ${selector}: ${totalDue}`);
            break;
          }
        }
      }
    }
    
    // If we still couldn't extract the data properly, try a more aggressive approach
    // by parsing the raw HTML for specific patterns
    if (!consignorName || !consignorEmail || !auctionTitle || !statementDate || !totalDue) {
      console.log('Using aggressive HTML parsing approach');
      const htmlString = statementResponse.data;
      
      // Look for consignor name in the raw HTML
      if (!consignorName) {
        const nameRegex = /(?:Consignor|Seller|Customer)[\s:]+([^<\n\r]+)/i;
        const nameMatch = htmlString.match(nameRegex);
        if (nameMatch && nameMatch[1]) {
          consignorName = nameMatch[1].trim();
          console.log('Found consignor name in raw HTML:', consignorName);
        }
      }
      
      // Look for consignor email in the raw HTML
      if (!consignorEmail) {
        const emailRegex = /([\w.-]+@[\w.-]+\.[a-zA-Z]{2,})/g;
        const emailMatches = htmlString.match(emailRegex);
        if (emailMatches && emailMatches.length > 0) {
          consignorEmail = emailMatches[0];
          console.log('Found consignor email in raw HTML:', consignorEmail);
        }
      }
      
      // Look for auction title in the raw HTML
      if (!auctionTitle) {
        const titleRegex = /(?:Auction|Sale)[\s:]+([^<\n\r]+)/i;
        const titleMatch = htmlString.match(titleRegex);
        if (titleMatch && titleMatch[1]) {
          auctionTitle = titleMatch[1].trim();
          console.log('Found auction title in raw HTML:', auctionTitle);
        }
      }
      
      // Look for statement date in the raw HTML
      if (!statementDate) {
        const dateRegex = /(?:Date|Statement Date|Report Date)[\s:]+([^<\n\r@]+)/i;
        const dateMatch = htmlString.match(dateRegex);
        if (dateMatch && dateMatch[1]) {
          statementDate = dateMatch[1].trim();
          console.log('Found statement date in raw HTML:', statementDate);
        }
      }
      
      // Look for total due in the raw HTML
      if (!totalDue) {
        // Try to find a dollar amount near "Total Due" or similar phrases
        const dueRegex = /(?:Total|Due|Balance|Amount)[\s:]+\$?(\d[\d,.]+)/i;
        const dueMatch = htmlString.match(dueRegex);
        if (dueMatch && dueMatch[1]) {
          totalDue = dueMatch[1].trim();
          console.log('Found total due in raw HTML:', totalDue);
        } else {
          // Try to find any dollar amount in a table cell
          const dollarRegex = /<td[^>]*>\s*\$?(\d[\d,.]+)\s*<\/td>/i;
          const dollarMatch = htmlString.match(dollarRegex);
          if (dollarMatch && dollarMatch[1]) {
            totalDue = dollarMatch[1].trim();
            console.log('Found dollar amount in table cell:', totalDue);
          }
        }
      }
    }
    
    // Final cleanup of the extracted data
    if (consignorName) {
      // Remove any remaining numbers, phone numbers, or addresses
      consignorName = consignorName
        .replace(/Number:\s*\d+/, '')
        .replace(/\d{3}-\d{3}-\d{4}/, '')
        .replace(/Phone\s+\(\d{3}\)\s+\d{3}-\d{4}/, '')
        .replace(/\d+\s+[A-Za-z\s]+(?:Ave|St|Rd|Blvd|Drive|Dr|Lane|Ln|Court|Ct|Circle|Cir)\b[^,]*,[^,]*,[^,]*/, '')
        .replace(/House Bidder/i, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
      
      // If it's still too long, try to extract just the name part
      if (consignorName.length > 50) {
        const nameParts = consignorName.split(/\s{2,}|\t/);
        if (nameParts.length > 1) {
          // Take the first substantial part that looks like a name
          for (const part of nameParts) {
            if (part.length > 3 && !/^\d+$/.test(part)) {
              consignorName = part.trim();
              break;
            }
          }
        }
      }
    }
    
    if (auctionTitle) {
      // Make sure auction title is clean and includes the auction code
      auctionTitle = auctionTitle
        .replace(/Company470 Woodycrest AveNashville, TN 37210/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
        
      if (!auctionTitle.includes(auctionCode)) {
        auctionTitle = `Auction #${auctionCode}${auctionTitle ? ': ' + auctionTitle : ''}`;
      }
    }
    
    // Create consignor data object with fallbacks if data couldn't be extracted
    const consignorData = {
      name: consignorName || 'Unknown',
      email: consignorEmail || '',
      auctionTitle: auctionTitle || `Auction #${auctionCode}`,
      statementDate: statementDate || new Date().toLocaleDateString(),
      totalDue: totalDue || '0.00'
    };
    
    console.log('Successfully extracted consignor data:', JSON.stringify(consignorData));
    
    // Return the consignor data
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*', // Allow cross-origin requests
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: JSON.stringify(consignorData)
    };
    
  } catch (error) {
    console.error('Error fetching consignor data:', error);
    
    // Return a structured error response
    return {
      statusCode: error.statusCode || 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: JSON.stringify({
        error: true,
        message: error.message || 'An error occurred while fetching consignor data',
        details: process.env.NODE_ENV !== 'production' ? error.stack : undefined
      })
    };
  }
};

// Handle OPTIONS requests for CORS preflight
exports.handler = async (event, context) => {
  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }
  
  // Handle POST request
  if (event.httpMethod === 'POST') {
    return await getConsignorData(event, context);
  }
  
  // Return method not allowed for other request types
  return {
    statusCode: 405,
    body: JSON.stringify({ error: true, message: 'Method not allowed' })
  };
};
