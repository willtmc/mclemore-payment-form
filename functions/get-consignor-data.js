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
    
    // Create a session with axios that properly handles cookies
    const session = axios.create({
      baseURL: 'https://www.mclemoreauction.com',
      withCredentials: true,
      maxRedirects: 5,
      timeout: 30000, // 30 seconds timeout
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });
    
    // Create a cookie jar to store cookies between requests
    const cookieJar = {};
    
    // Intercept responses to capture cookies
    session.interceptors.response.use(response => {
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
        
        session.defaults.headers.common['Cookie'] = cookieString;
        console.log('Updated cookies:', cookieString);
      }
      return response;
    });
    
    try {
      console.log('Step 1: Fetching login page directly...');
      const loginPageResponse = await session.get('/admin/login', {
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Content-Type': 'text/html'
        }
      });
      console.log(`Login page status: ${loginPageResponse.status}`);
      
      // Save login page HTML for debugging
      try { 
        fs.writeFileSync('/tmp/login-page.html', loginPageResponse.data); 
        console.log('Saved login page HTML to /tmp/login-page.html');
      } catch (e) { 
        console.log('Could not save login page HTML:', e.message); 
      }
      
      // Parse the login page to find the form
      const $ = cheerio.load(loginPageResponse.data);
      
      // Find all forms on the page
      const forms = $('form');
      console.log(`Found ${forms.length} forms on the page`);
      
      // Log form details for debugging
      forms.each((i, form) => {
        console.log(`Form ${i} action: ${$(form).attr('action')}, method: ${$(form).attr('method')}`);
        
        // Log input fields
        $(form).find('input').each((j, input) => {
          console.log(`  Input ${j}: name=${$(input).attr('name')}, type=${$(input).attr('type')}, id=${$(input).attr('id')}`);
        });
      });
      
      // Try to find the login form
      let loginForm = forms.filter((i, el) => {
        const action = $(el).attr('action') || '';
        return action.includes('login') || action === '';
      }).first();
      
      // If no form with login in the action, look for forms with password fields
      if (loginForm.length === 0) {
        loginForm = forms.filter((i, el) => {
          return $(el).find('input[type="password"]').length > 0;
        }).first();
      }
      
      if (loginForm.length === 0) {
        console.error('Could not find login form on page');
        throw new Error('Login form not found');
      }
      
      // Extract form action and method
      const formAction = loginForm.attr('action') || '/admin/login';
      const formMethod = loginForm.attr('method') || 'post';
      console.log(`Using form action: ${formAction}, method: ${formMethod}`);
      
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
      
      console.log(`Using username field: ${usernameField}, password field: ${passwordField}`);
      console.log('Form data:', formData.toString());
      
      // Submit the form
      console.log(`Submitting login form to ${formAction}...`);
      const loginFormResponse = await session.post(formAction, formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Referer': 'https://www.mclemoreauction.com/admin/login'
        },
        maxRedirects: 5,
        validateStatus: status => status < 400 // Accept any successful status
      });
      
      console.log(`Form login response status: ${loginFormResponse.status}`);
      
      // Save the response HTML for debugging
      try { 
        fs.writeFileSync('/tmp/login-response.html', loginFormResponse.data); 
        console.log('Saved login response HTML to /tmp/login-response.html');
      } catch (e) { 
        console.log('Could not save login response HTML:', e.message); 
      }
      
      // Check if we were redirected to a dashboard or admin page
      const responseUrl = loginFormResponse.request?.res?.responseUrl || '';
      console.log(`Redirected to: ${responseUrl}`);
      
      // Check if login was successful by looking for login form or error messages in the response
      const $response = cheerio.load(loginFormResponse.data);
      const loginFormAfter = $response('form').filter((i, el) => {
        const action = $response(el).attr('action') || '';
        return action.includes('login') || action === '';
      });
      
      const errorMessages = $response('.error, .alert, .alert-danger').text();
      
      if (loginFormAfter.length > 0 || errorMessages.includes('Invalid')) {
        console.error('Login failed - still on login page or error message found');
        console.error('Error messages found:', errorMessages);
        throw new Error(`Login failed: ${errorMessages || 'Unknown error'}`);
      }
      
      console.log('Login appears successful!');
      
      // Now try to fetch the consignor data
      console.log('Attempting to fetch consignor data...');
      
      // Try different URL patterns for the statement
      const urlPatterns = [
        `/admin/statements/printreport/auction/${auctionCode}/sellerid/${consignorId}`,
        `/admin/statements/printreport/${auctionCode}/${consignorId}`,
        `/admin/statements/view/auction/${auctionCode}/sellerid/${consignorId}`,
        `/admin/statements/view/${auctionCode}/${consignorId}`
      ];
      
      let statementData = null;
      let statementHtml = '';
      
      for (const urlPattern of urlPatterns) {
        try {
          console.log(`Trying URL pattern: ${urlPattern}`);
          const statementResponse = await session.get(urlPattern, {
            headers: {
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Referer': 'https://www.mclemoreauction.com/admin/dashboard'
            }
          });
          
          console.log(`Statement response status: ${statementResponse.status}`);
          statementHtml = statementResponse.data;
          
          // Save statement HTML for debugging
          try { 
            fs.writeFileSync('/tmp/statement-page.html', statementHtml); 
            console.log(`Saved statement HTML from ${urlPattern} to /tmp/statement-page.html`);
          } catch (e) { 
            console.log('Could not save statement HTML:', e.message); 
          }
          
          // Check if we got a valid statement page
          if (statementHtml.includes('Statement') || statementHtml.includes('Consignor') || statementHtml.includes('Total Due')) {
            console.log(`Found valid statement data at ${urlPattern}`);
            statementData = statementHtml;
            break;
          }
        } catch (error) {
          console.error(`Error fetching statement from ${urlPattern}:`, error.message);
        }
      }
      
      if (!statementData) {
        throw new Error('Could not retrieve statement data from any URL pattern');
      }
      
      // Parse the statement data using cheerio
      console.log('Parsing statement data...');
      const $statement = cheerio.load(statementData);
      
      // Extract consignor information using various selectors
      let consignorName = '';
      let consignorEmail = '';
      let auctionTitle = '';
      let statementDate = '';
      let totalDue = '';
      
      // Try different selectors for consignor name
      const nameSelectors = [
        '.consignor-name',
        '.seller-name',
        'h1, h2, h3, h4, h5',
        'strong:contains("Consignor:")',
        'strong:contains("Seller:")',
        'div:contains("Consignor:")',
        'div:contains("Seller:")',
        'td:contains("Consignor:")',
        'td:contains("Seller:")',
        'p:contains("Consignor:")',
        'p:contains("Seller:")',
        'span:contains("Consignor:")',
        'span:contains("Seller:")',
        'b:contains("Consignor:")',
        'b:contains("Seller:")',
        'tr:contains("Consignor")',
        'tr:contains("Seller")',
        'div.header',
        'div.statement-header',
        'div.consignor-info',
        'div.seller-info'
      ];
      
      for (const selector of nameSelectors) {
        const element = $statement(selector);
        if (element.length > 0) {
          const text = element.text().trim();
          if (text) {
            // Extract name from text that might contain labels
            const nameMatch = text.match(/(?:Consignor|Seller)s?:?\s*([^\n\r]+)/);
            consignorName = nameMatch ? nameMatch[1].trim() : text;
            console.log(`Found consignor name using selector ${selector}: ${consignorName}`);
            break;
          }
        }
      }
      
      // Try different selectors for consignor email
      const emailSelectors = [
        '.consignor-email',
        '.seller-email',
        'a[href^="mailto:"]',
        'span:contains("@")',
        'div:contains("@")',
        'td:contains("@")',
        'p:contains("@")',
        'div.contact-info',
        'div.email'
      ];
      
      for (const selector of emailSelectors) {
        const element = $statement(selector);
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
      
      // Try different selectors for auction title
      const auctionSelectors = [
        '.auction-title',
        '.auction-name',
        'h1:contains("Auction")',
        'h2:contains("Auction")',
        'h3:contains("Auction")',
        'div:contains("Auction")',
        'strong:contains("Auction")',
        'b:contains("Auction")',
        'span:contains("Auction")',
        'p:contains("Auction")',
        'td:contains("Auction")',
        'div.header:contains("Auction")',
        'div.statement-header:contains("Auction")'
      ];
      
      for (const selector of auctionSelectors) {
        const element = $statement(selector);
        if (element.length > 0) {
          const text = element.text().trim();
          if (text) {
            // Extract auction title from text that might contain labels
            const auctionMatch = text.match(/Auction:?\s*([^\n\r]+)/);
            auctionTitle = auctionMatch ? auctionMatch[1].trim() : text;
            console.log(`Found auction title using selector ${selector}: ${auctionTitle}`);
            break;
          }
        }
      }
      
      // Try different selectors for statement date
      const dateSelectors = [
        '.statement-date',
        '.date',
        'span:contains("Date")',
        'div:contains("Date")',
        'td:contains("Date")',
        'p:contains("Date")',
        'strong:contains("Date")',
        'b:contains("Date")'
      ];
      
      for (const selector of dateSelectors) {
        const element = $statement(selector);
        if (element.length > 0) {
          const text = element.text().trim();
          if (text) {
            // Extract date from text that might contain labels
            const dateMatch = text.match(/Date:?\s*([^\n\r]+)/);
            statementDate = dateMatch ? dateMatch[1].trim() : text;
            console.log(`Found statement date using selector ${selector}: ${statementDate}`);
            break;
          }
        }
      }
      
      // Try different selectors for total due
      const totalSelectors = [
        '.total-due',
        '.total',
        'td:contains("Total Due")',
        'td:contains("Balance Due")',
        'td:contains("Amount Due")',
        'div:contains("Total Due")',
        'div:contains("Balance Due")',
        'div:contains("Amount Due")',
        'span:contains("Total Due")',
        'span:contains("Balance Due")',
        'span:contains("Amount Due")',
        'p:contains("Total Due")',
        'p:contains("Balance Due")',
        'p:contains("Amount Due")',
        'strong:contains("Total Due")',
        'strong:contains("Balance Due")',
        'strong:contains("Amount Due")',
        'b:contains("Total Due")',
        'b:contains("Balance Due")',
        'b:contains("Amount Due")'
      ];
      
      for (const selector of totalSelectors) {
        const element = $statement(selector);
        if (element.length > 0) {
          const text = element.text().trim();
          if (text) {
            // Extract amount from text that might contain labels and currency symbols
            const amountMatch = text.match(/(?:Total Due|Balance Due|Amount Due):?\s*[$]?([\d,.]+)/);
            totalDue = amountMatch ? amountMatch[1].trim() : text;
            console.log(`Found total due using selector ${selector}: ${totalDue}`);
            break;
          }
        }
      }
      
      // If we couldn't find specific fields, try to extract them from the entire document
      if (!consignorName || !consignorEmail || !auctionTitle || !statementDate || !totalDue) {
        console.log('Some fields missing, trying to extract from entire document...');
        const fullText = $statement('body').text();
        
        // Extract email if not found
        if (!consignorEmail) {
          const emailMatch = fullText.match(/[\w.-]+@[\w.-]+\.[a-zA-Z]{2,}/);
          if (emailMatch) {
            consignorEmail = emailMatch[0];
            console.log(`Found consignor email in full text: ${consignorEmail}`);
          }
        }
        
        // Extract total due if not found
        if (!totalDue) {
          const totalMatch = fullText.match(/(?:Total Due|Balance Due|Amount Due):?\s*[$]?([\d,.]+)/);
          if (totalMatch) {
            totalDue = totalMatch[1].trim();
            console.log(`Found total due in full text: ${totalDue}`);
          }
        }
      }
      
      // Format the data for the response
      const consignorData = {
        name: consignorName || `Consignor ${consignorId}`,
        email: consignorEmail || '',
        auctionTitle: auctionTitle || `Auction ${auctionCode}`,
        statementDate: statementDate || new Date().toLocaleDateString(),
        totalDue: totalDue || '0.00'
      };
      
      console.log('Successfully extracted consignor data:', JSON.stringify(consignorData));
      
      return {
        statusCode: 200,
        body: JSON.stringify(consignorData)
      };
      
    } catch (error) {
      console.error('Error in form login or data extraction:', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response headers:', JSON.stringify(error.response.headers));
      }
      throw error;
    }
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
