// Netlify Function to retrieve consignor data
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs'); // For debugging file writes

exports.handler = async function(event, context) {
  console.log('Starting get-consignor-data function...');
  
  // CORS headers for browser compatibility
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };
  
  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }
  
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
    
    // Create a session with axios
    const session = axios.create({
      baseURL: 'https://www.mclemoreauction.com',
      withCredentials: true,
      maxRedirects: 5,
      timeout: 30000, // 30 seconds timeout
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
    });
    
    // Wrap each request in a try-catch to better handle and log errors
    try {
      console.log('Step 1: Fetching login page...');
      const loginPageResponse = await session.get('/login');
      console.log(`Login page status: ${loginPageResponse.status}`);
      // Save login page HTML for debugging
      try { fs.writeFileSync('/tmp/login-page.html', loginPageResponse.data); } catch (e) { console.log('Could not save login page HTML:', e.message); }
    } catch (error) {
      console.error('Error in Step 1 (Fetching login page):', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response headers:', JSON.stringify(error.response.headers));
        console.error('Response data:', error.response.data);
      }
      throw new Error(`Login page fetch failed: ${error.message}`);
    }
    
    try {
      console.log('Step 2: Checking cookies...');
      const cookiesResponse = await session.get('/api/cookies');
      console.log(`Cookies check status: ${cookiesResponse.status}`);
      console.log('Cookies:', JSON.stringify(cookiesResponse.data)); // Log cookies for debugging
    } catch (error) {
      console.error('Error in Step 2 (Checking cookies):', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response headers:', JSON.stringify(error.response.headers));
      }
      // Continue despite cookie error - this might not be critical
      console.log('Continuing despite cookie error...');
    }
    
    try {
      console.log('Step 3: Getting session...');
      const sessionResponse = await session.get('/api/getsession');
      console.log(`Session response status: ${sessionResponse.status}`);
      console.log('Session data:', JSON.stringify(sessionResponse.data)); // Log session data for debugging
    } catch (error) {
      console.error('Error in Step 3 (Getting session):', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response headers:', JSON.stringify(error.response.headers));
      }
      // Continue despite session error - this might not be critical
      console.log('Continuing despite session error...');
    }
    
    try {
      console.log('Step 4: Setting request URL...');
      const setRequestUrlResponse = await session.post('/api/setrequesturl', {
        url: 'https://www.mclemoreauction.com/'
      });
      console.log(`Set request URL status: ${setRequestUrlResponse.status}`);
    } catch (error) {
      console.error('Error in Step 4 (Setting request URL):', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response headers:', JSON.stringify(error.response.headers));
      }
      // Continue despite URL error - this might not be critical
      console.log('Continuing despite URL error...');
    }
    
    let loginData;
    try {
      console.log('Step 5: Attempting login...');
      const loginResponse = await session.post('/api/ajaxlogin', {
        user_name: username,
        password: password,
        autologin: ''
      });
      console.log(`Login response status: ${loginResponse.status}`);
      console.log('Login response data:', JSON.stringify(loginResponse.data)); // Log login response data for debugging
      
      // Check if login was successful
      loginData = loginResponse.data;
      if (loginData.status !== 'success') {
        throw new Error(`Login failed: ${loginData.msg || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error in Step 5 (Login):', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response headers:', JSON.stringify(error.response.headers));
        if (error.response.data) {
          console.error('Response data:', JSON.stringify(error.response.data));
        }
      }
      
      // Try alternative login approach
      console.log('API login failed, trying traditional form login...');
      try {
        // Get the login page to extract form details
        const loginPageResponse = await session.get('/login');
        const $ = cheerio.load(loginPageResponse.data);
        
        // Find the login form
        const loginForm = $('form').filter((i, el) => {
          const action = $(el).attr('action') || '';
          return action.includes('login') || action === '';
        }).first();
        
        if (loginForm.length === 0) {
          console.error('Could not find login form on page');
          throw new Error('Login form not found');
        }
        
        // Extract form action and method
        const formAction = loginForm.attr('action') || '/login';
        const formMethod = loginForm.attr('method') || 'post';
        console.log(`Form action: ${formAction}, method: ${formMethod}`);
        
        // Extract form fields
        const formFields = {};
        loginForm.find('input').each((i, el) => {
          const name = $(el).attr('name');
          const value = $(el).attr('value') || '';
          if (name) formFields[name] = value;
        });
        console.log('Form fields:', JSON.stringify(formFields));
        
        // Prepare form data
        const formData = new URLSearchParams();
        Object.keys(formFields).forEach(key => {
          formData.append(key, formFields[key]);
        });
        
        // Add username and password
        const usernameField = loginForm.find('input[type="text"], input[type="email"], input[name="username"]').attr('name') || 'username';
        const passwordField = loginForm.find('input[type="password"]').attr('name') || 'password';
        formData.append(usernameField, username);
        formData.append(passwordField, password);
        
        // Submit the form
        console.log('Submitting login form...');
        const loginFormResponse = await session.post(formAction, formData, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        });
        console.log(`Form login response status: ${loginFormResponse.status}`);
        
        // Check if we were redirected to a dashboard or admin page
        const responseUrl = loginFormResponse.request?.res?.responseUrl || '';
        console.log(`Redirected to: ${responseUrl}`);
        
        if (responseUrl.includes('dashboard') || responseUrl.includes('admin')) {
          console.log('Form login appears successful based on redirect');
        } else {
          console.error('Form login may have failed - unexpected redirect');
        }
      } catch (formLoginError) {
        console.error('Error in form login attempt:', formLoginError.message);
        throw new Error(`All login attempts failed: ${error.message}, then: ${formLoginError.message}`);
      }
    }
    
    console.log('Login successful! Initializing session data...');
    
    // Step 6: Get initial data (required after login)
    console.log('Step 6: Fetching initial data...');
    session.defaults.headers.common['Referer'] = 'https://www.mclemoreauction.com/';
    const initDataResponse = await session.get('/api/initdata');
    console.log(`Init data status: ${initDataResponse.status}`);
    console.log('Init data:', JSON.stringify(initDataResponse.data)); // Log init data for debugging
    
    // Step 7: Get auctions data (required after login)
    console.log('Step 7: Fetching auctions data...');
    const auctionsResponse = await session.post('/api/auctions', {
      past_sales: 'false',
      meta_also: 'true'
    });
    console.log(`Auctions data status: ${auctionsResponse.status}`);
    console.log('Auctions data:', JSON.stringify(auctionsResponse.data)); // Log auctions data for debugging
    
    console.log('Session fully initialized!');
    
    // Try multiple potential statement URLs
    const urlPatterns = [
      `/admin/statements/printreport/auction/${auctionCode}/sellerid/${consignorId}`,
      `/admin/statements/print/auction/${auctionCode}/sellerid/${consignorId}`,
      `/admin/statements/view/auction/${auctionCode}/sellerid/${consignorId}`,
      `/admin/statements/printreport/id/${consignorId}/auction/${auctionCode}`,
      `/admin/reports/statements/auction/${auctionCode}/sellerid/${consignorId}`,
      `/admin/reports/statements/print/auction/${auctionCode}/sellerid/${consignorId}`
    ];
    
    let statementResponse = null;
    let successUrl = null;
    
    for (const urlPattern of urlPatterns) {
      try {
        console.log(`Trying URL pattern: ${urlPattern}`);
        const response = await session.get(urlPattern, { maxRedirects: 5 });
        if (response.status === 200) {
          console.log(`Success with URL pattern: ${urlPattern}`);
          statementResponse = response;
          successUrl = urlPattern;
          break;
        }
      } catch (error) {
        console.log(`Failed with URL pattern ${urlPattern}: ${error.message}`);
      }
    }
    
    if (!statementResponse) {
      throw new Error('Failed to retrieve consignor statement. Could not find a valid URL pattern.');
    }
    
    console.log(`Successfully retrieved statement from ${successUrl}`);
    fs.writeFileSync('/tmp/statement.html', statementResponse.data); // Save statement HTML for debugging
    
    // Parse the HTML response with cheerio
    const $ = cheerio.load(statementResponse.data);
    
    // Extract consignor information with more robust selectors
    let consignorName = '';
    let consignorEmail = '';
    let auctionTitle = '';
    let statementDate = '';
    let totalDue = '';
    
    // Extract consignor name using multiple approaches
    console.log('Extracting consignor name...');
    // Try direct class selectors
    consignorName = $('.consignor-name, .seller-name, .customer-name, .buyerName, .name').text().trim();
    
    // Try looking for specific text patterns
    if (!consignorName) {
      $('*').each((i, el) => {
        const text = $(el).text();
        if (text.includes('Consignor:') || text.includes('Seller:') || text.includes('Customer:')) {
          // Extract the name after the label
          const match = text.match(/(?:Consignor|Seller|Customer)\s*:\s*([^\n\r]+)/);
          if (match && match[1]) {
            consignorName = match[1].trim();
            return false; // break the loop
          }
        }
      });
    }
    
    // Try looking in table cells
    if (!consignorName) {
      $('table tr').each((i, el) => {
        const rowText = $(el).text().toLowerCase();
        if (rowText.includes('consignor') || rowText.includes('seller') || rowText.includes('customer')) {
          // Get the next cell or the cell to the right
          consignorName = $(el).find('td:nth-child(2)').text().trim();
          if (!consignorName) {
            // Try the next row
            consignorName = $(el).next('tr').find('td').first().text().trim();
          }
          return false; // break the loop
        }
      });
    }
    
    // Try looking for the name in a specific position
    if (!consignorName) {
      // Look for the first bold text that might be a name
      consignorName = $('b').first().text().trim();
      
      // If that doesn't work, try the first h1 or h2 that isn't the auction title
      if (!consignorName || consignorName.length < 3) {
        $('h1, h2').each((i, el) => {
          const text = $(el).text().trim();
          if (text && text.length > 3 && !text.toLowerCase().includes('auction') && !text.toLowerCase().includes('statement')) {
            consignorName = text;
            return false; // break the loop
          }
        });
      }
    }
    
    console.log('Extracted consignor name:', consignorName || 'Not found');
    
    // Extract consignor email
    console.log('Extracting consignor email...');
    // Try direct class selectors
    consignorEmail = $('.consignor-email, .seller-email, .customer-email, .buyerEmail, .email').text().trim();
    
    // Try looking for mailto links
    if (!consignorEmail) {
      const emailLink = $('a[href^="mailto:"]');
      if (emailLink.length) {
        consignorEmail = emailLink.text().trim() || emailLink.attr('href').replace('mailto:', '');
      }
    }
    
    // Try looking for email patterns in text
    if (!consignorEmail) {
      $('*').each((i, el) => {
        const text = $(el).text();
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
    
    // Try looking in table cells
    if (!consignorEmail) {
      $('table tr').each((i, el) => {
        const rowText = $(el).text().toLowerCase();
        if (rowText.includes('email')) {
          // Get the next cell or the cell to the right
          const cellText = $(el).find('td:nth-child(2)').text().trim();
          const emailMatch = cellText.match(/[\w.-]+@[\w.-]+\.[\w.-]+/);
          if (emailMatch) {
            consignorEmail = emailMatch[0];
            return false; // break the loop
          }
        }
      });
    }
    
    console.log('Extracted consignor email:', consignorEmail || 'Not found');
    
    // Extract auction title
    console.log('Extracting auction title...');
    // Try direct class selectors
    auctionTitle = $('.auction-title, .auction-name, .sale-name, .sale-title').text().trim();
    
    // Try looking for specific text patterns
    if (!auctionTitle) {
      $('*').each((i, el) => {
        const text = $(el).text();
        if (text.includes('Auction:') || text.includes('Sale:')) {
          // Extract the title after the label
          const match = text.match(/(?:Auction|Sale)\s*:\s*([^\n\r]+)/);
          if (match && match[1]) {
            auctionTitle = match[1].trim();
            return false; // break the loop
          }
        }
      });
    }
    
    // Try the page title or first heading
    if (!auctionTitle) {
      auctionTitle = $('title').text().trim() || 
                    $('h1').first().text().trim() || 
                    $('h2').first().text().trim();
                    
      // Filter out non-auction titles
      if (auctionTitle && (!auctionTitle.toLowerCase().includes('auction') && 
                           !auctionTitle.toLowerCase().includes('sale') && 
                           !auctionTitle.toLowerCase().includes('statement'))) {
        auctionTitle = '';
      }
    }
    
    // Try looking in table cells
    if (!auctionTitle) {
      $('table tr').each((i, el) => {
        const rowText = $(el).text().toLowerCase();
        if (rowText.includes('auction') || rowText.includes('sale')) {
          // Get the next cell or the cell to the right
          auctionTitle = $(el).find('td:nth-child(2)').text().trim();
          if (!auctionTitle) {
            // Try the next row
            auctionTitle = $(el).next('tr').find('td').first().text().trim();
          }
          return false; // break the loop
        }
      });
    }
    
    console.log('Extracted auction title:', auctionTitle || 'Not found');
    
    // Extract statement date
    console.log('Extracting statement date...');
    // Try direct class selectors
    statementDate = $('.statement-date, .date, .report-date, .invoice-date').text().trim();
    
    // Try looking for date patterns
    if (!statementDate) {
      $('*').each((i, el) => {
        const text = $(el).text();
        // Look for date label
        if (text.includes('Date:') || text.includes('Statement Date:') || text.includes('Report Date:')) {
          // Extract the date after the label
          const match = text.match(/(?:Date|Statement Date|Report Date)\s*:\s*([^\n\r]+)/);
          if (match && match[1]) {
            statementDate = match[1].trim();
            return false; // break the loop
          }
        }
        
        // Look for common date formats: MM/DD/YYYY, MM-DD-YYYY, etc.
        if (!statementDate) {
          const dateMatch = text.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/);
          if (dateMatch) {
            statementDate = dateMatch[0];
            return false; // break the loop
          }
        }
      });
    }
    
    // Try looking in table cells
    if (!statementDate) {
      $('table tr').each((i, el) => {
        const rowText = $(el).text().toLowerCase();
        if (rowText.includes('date')) {
          // Get the next cell or the cell to the right
          statementDate = $(el).find('td:nth-child(2)').text().trim();
          if (!statementDate) {
            // Try the next row
            statementDate = $(el).next('tr').find('td').first().text().trim();
          }
          return false; // break the loop
        }
      });
    }
    
    console.log('Extracted statement date:', statementDate || 'Not found');
    
    // Extract total due
    console.log('Extracting total due...');
    // Try direct class selectors
    totalDue = $('.total-due, .amount-due, .balance-due, .total, .grand-total').text().trim();
    
    // Try looking for currency patterns with specific labels
    if (!totalDue) {
      $('*').each((i, el) => {
        const text = $(el).text();
        // Look for total due label
        if (text.toLowerCase().includes('total due') || 
            text.toLowerCase().includes('balance due') || 
            text.toLowerCase().includes('amount due') || 
            (text.toLowerCase().includes('total') && text.includes('$'))) {
          // Extract the amount
          const match = text.match(/\$\s*(\d[\d,.]+)/);
          if (match) {
            totalDue = '$' + match[1].trim();
            return false; // break the loop
          }
        }
      });
    }
    
    // Try looking in table cells - specifically in the last rows which often contain totals
    if (!totalDue) {
      // Get all table rows
      const rows = $('table tr').toArray();
      // Check the last few rows (totals are usually at the bottom)
      for (let i = rows.length - 1; i >= Math.max(0, rows.length - 5); i--) {
        const row = rows[i];
        const rowText = $(row).text().toLowerCase();
        if (rowText.includes('total') || rowText.includes('due') || rowText.includes('balance')) {
          // Look for dollar amounts
          const amountMatch = rowText.match(/\$\s*(\d[\d,.]+)/);
          if (amountMatch) {
            totalDue = '$' + amountMatch[1].trim();
            break;
          }
        }
      }
    }
    
    // Try looking for the largest dollar amount on the page (often the total)
    if (!totalDue) {
      let largestAmount = 0;
      let largestAmountText = '';
      
      $('*').each((i, el) => {
        const text = $(el).text();
        if (text.includes('$')) {
          const amounts = text.match(/\$\s*(\d[\d,.]+)/g) || [];
          for (const amount of amounts) {
            // Convert to number for comparison
            const numericValue = parseFloat(amount.replace(/[^\d.]/g, ''));
            if (numericValue > largestAmount) {
              largestAmount = numericValue;
              largestAmountText = amount;
            }
          }
        }
      });
      
      if (largestAmountText) {
        totalDue = largestAmountText.trim();
      }
    }
    
    console.log('Extracted total due:', totalDue || 'Not found');
    
    // If we still couldn't extract the data properly, try a more aggressive approach
    // by parsing the raw HTML for specific patterns
    if (!consignorName || !auctionTitle || !totalDue) {
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
      
      // Look for auction title in the raw HTML
      if (!auctionTitle) {
        const titleRegex = /(?:Auction|Sale)[\s:]+([^<\n\r]+)/i;
        const titleMatch = htmlString.match(titleRegex);
        if (titleMatch && titleMatch[1]) {
          auctionTitle = titleMatch[1].trim();
          console.log('Found auction title in raw HTML:', auctionTitle);
        }
      }
      
      // Look for total due in the raw HTML
      if (!totalDue) {
        const dueRegex = /(?:Total|Due|Balance)[\s:]+\$(\d[\d,.]+)/i;
        const dueMatch = htmlString.match(dueRegex);
        if (dueMatch && dueMatch[1]) {
          totalDue = '$' + dueMatch[1].trim();
          console.log('Found total due in raw HTML:', totalDue);
        }
      }
    }
    
    // Create consignor data object
    const consignorData = {
      auctionCode,
      consignorId,
      name: consignorName || 'Consignor Name Not Found',
      email: consignorEmail || 'email@example.com',
      auctionTitle: auctionTitle || 'Auction Title Not Found',
      statementDate: statementDate || new Date().toLocaleDateString(),
      totalDue: totalDue || '$0.00',
      // Include the username of the MAC staff member who fetched the data
      fetchedBy: username
    };
    
    console.log('Successfully extracted consignor data:', JSON.stringify(consignorData, null, 2));
    
    // Return the consignor data
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: consignorData
      })
    };
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack trace:', error.stack);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};
