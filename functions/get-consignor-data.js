// Netlify Function to retrieve consignor data
const axios = require('axios');
const cheerio = require('cheerio');

exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    // Parse the request body
    const requestBody = JSON.parse(event.body);
    const { auctionCode, consignorId, username, password } = requestBody;

    if (!auctionCode || !consignorId || !username || !password) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Missing required parameters' })
      };
    }

    console.log(`Fetching data for auction: ${auctionCode}, consignor: ${consignorId} with user: ${username}`);

    // Fetch real data from McLemore Auction admin system
    try {
      // First, authenticate with the admin system
      // NOTE: Updated to use the correct login URL
      const loginUrl = 'https://www.mclemoreauction.com/login/';
      const apiLoginUrl = 'https://www.mclemoreauction.com/api/login';
      
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
      
      // Try API-based login first (most modern approach)
      try {
        const loginResponse = await axios.post(apiLoginUrl, {
          username: username,
          password: password
        }, {
          headers: {
            'Content-Type': 'application/json',
            'Cookie': Object.entries(cookieJar).map(([key, value]) => `${key}=${value}`).join('; '),
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36',
            'Referer': loginUrl
          }
        });
        
        console.log('API Login response status:', loginResponse.status);
        
        // Update cookie jar with any new cookies
        if (loginResponse.headers['set-cookie']) {
          console.log('Storing cookies from API login response');
          loginResponse.headers['set-cookie'].forEach(cookie => {
            const cookieParts = cookie.split(';')[0].split('=');
            cookieJar[cookieParts[0]] = cookieParts[1];
          });
        }
      } catch (apiLoginError) {
        console.log('API login failed, trying traditional form login');
        
        // Extract CSRF token if present
        const $ = cheerio.load(loginPageResponse.data);
        const csrfToken = $('input[name="csrf_token"]').val() || 
                        $('input[name="_token"]').val() || 
                        $('meta[name="csrf-token"]').attr('content') || '';
        
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
        loginFormData.append(usernameField, username);
        loginFormData.append(passwordField, password);
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
        
        console.log('Form Login response status:', loginResponse.status);
        
        // Update cookie jar with any new cookies
        if (loginResponse.headers['set-cookie']) {
          console.log('Storing cookies from form login response');
          loginResponse.headers['set-cookie'].forEach(cookie => {
            const cookieParts = cookie.split(';')[0].split('=');
            cookieJar[cookieParts[0]] = cookieParts[1];
          });
        }
      }
      
      // Step 3: Try multiple potential statement URLs
      const statementUrls = [
        `https://www.mclemoreauction.com/admin/statements/printreport/auction/${auctionCode}/sellerid/${consignorId}`,
        `https://www.mclemoreauction.com/statements/printreport/auction/${auctionCode}/sellerid/${consignorId}`,
        `https://www.mclemoreauction.com/api/statements/auction/${auctionCode}/seller/${consignorId}`,
        `https://www.mclemoreauction.com/admin/statements/auction/${auctionCode}/seller/${consignorId}`
      ];
      
      let statementResponse = null;
      let successUrl = '';
      
      // Try each URL until one works
      for (const url of statementUrls) {
        try {
          console.log('Trying to fetch statement data from:', url);
          statementResponse = await axios.get(url, {
            headers: {
              'Cookie': Object.entries(cookieJar).map(([key, value]) => `${key}=${value}`).join('; '),
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36',
              'Referer': 'https://www.mclemoreauction.com/statements'
            }
          });
          
          console.log('Statement data fetched successfully from:', url);
          successUrl = url;
          break;
        } catch (urlError) {
          console.log(`Failed to fetch from ${url}:`, urlError.message);
        }
      }
      
      if (!statementResponse) {
        throw new Error('Failed to fetch statement data from any of the attempted URLs');
      }
      
      // Parse the HTML to extract consignor data
      const $statement = cheerio.load(statementResponse.data);
      console.log('HTML loaded for parsing');
      
      // Save HTML for debugging
      const htmlContent = statementResponse.data;
      console.log('HTML content length:', htmlContent.length);
      console.log('Successful URL:', successUrl);
      
      // Extract consignor information with more robust selectors
      let consignorName = '';
      let consignorEmail = '';
      let auctionTitle = '';
      let statementDate = '';
      let totalDue = '';
      
      // Try different selectors for consignor name
      consignorName = $statement('.consignor-name, .seller-name').text().trim();
      if (!consignorName) {
        // Look for elements containing "Consignor" or "Seller" text
        $statement('*').each((i, el) => {
          const text = $statement(el).text();
          if (text.includes('Consignor:') || text.includes('Seller:')) {
            consignorName = text.replace(/Consignor:|Seller:/i, '').trim();
            return false; // break the loop
          }
        });
        
        // If still not found, try looking for table cells or divs that might contain the name
        if (!consignorName) {
          // Look for tables with seller information
          $statement('table tr').each((i, el) => {
            const rowText = $statement(el).text();
            if (rowText.toLowerCase().includes('seller') || rowText.toLowerCase().includes('consignor')) {
              // Get the next cell or the cell to the right
              consignorName = $statement(el).find('td:nth-child(2)').text().trim();
              if (!consignorName) {
                // Try the next row
                consignorName = $statement(el).next('tr').find('td').first().text().trim();
              }
              return false; // break the loop
            }
          });
        }
      }
      console.log('Extracted consignor name:', consignorName || 'Not found');
      
      // Try different selectors for consignor email
      consignorEmail = $statement('.consignor-email, .seller-email').text().trim();
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
        
        // If still not found, try looking for table cells or divs that might contain the email
        if (!consignorEmail) {
          // Look for tables with email information
          $statement('table tr').each((i, el) => {
            const rowText = $statement(el).text();
            if (rowText.toLowerCase().includes('email')) {
              // Get the next cell or the cell to the right
              const cellText = $statement(el).find('td:nth-child(2)').text().trim();
              const emailMatch = cellText.match(/[\w.-]+@[\w.-]+\.[\w.-]+/);
              if (emailMatch) {
                consignorEmail = emailMatch[0];
                return false; // break the loop
              }
            }
          });
        }
      }
      console.log('Extracted consignor email:', consignorEmail || 'Not found');
      
      // Try different selectors for auction title
      auctionTitle = $statement('.auction-title, .auction-name, .sale-name, .sale-title').text().trim();
      if (!auctionTitle) {
        // Usually the first h1 or h2 is the auction title
        auctionTitle = $statement('h1').first().text().trim() || 
                      $statement('h2').first().text().trim() ||
                      $statement('title').text().trim();
                      
        // If still not found, try looking for table cells or divs that might contain the auction title
        if (!auctionTitle || auctionTitle.length < 5) {
          // Look for tables with auction information
          $statement('table tr').each((i, el) => {
            const rowText = $statement(el).text();
            if (rowText.toLowerCase().includes('auction') || rowText.toLowerCase().includes('sale')) {
              // Get the next cell or the cell to the right
              auctionTitle = $statement(el).find('td:nth-child(2)').text().trim();
              if (!auctionTitle || auctionTitle.length < 5) {
                // Try the next row
                auctionTitle = $statement(el).next('tr').find('td').first().text().trim();
              }
              return false; // break the loop
            }
          });
        }
      }
      console.log('Extracted auction title:', auctionTitle || 'Not found');
      
      // Try different selectors for statement date
      statementDate = $statement('.statement-date, .date, .report-date').text().trim();
      if (!statementDate) {
        // Look for date patterns
        $statement('*').each((i, el) => {
          const text = $statement(el).text();
          // Look for common date formats: MM/DD/YYYY, MM-DD-YYYY, etc.
          const dateMatch = text.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/);
          if (dateMatch) {
            statementDate = dateMatch[0];
            return false; // break the loop
          }
        });
        
        // If still not found, try looking for table cells or divs that might contain the date
        if (!statementDate) {
          // Look for tables with date information
          $statement('table tr').each((i, el) => {
            const rowText = $statement(el).text();
            if (rowText.toLowerCase().includes('date')) {
              // Get the next cell or the cell to the right
              statementDate = $statement(el).find('td:nth-child(2)').text().trim();
              if (!statementDate) {
                // Try the next row
                statementDate = $statement(el).next('tr').find('td').first().text().trim();
              }
              return false; // break the loop
            }
          });
        }
      }
      console.log('Extracted statement date:', statementDate || 'Not found');
      
      // Try different selectors for total due
      totalDue = $statement('.total-due, .amount-due, .balance-due, .total').text().trim();
      if (!totalDue) {
        // Look for currency patterns
        $statement('*').each((i, el) => {
          const text = $statement(el).text();
          if (text.includes('$') && /\$[\d,.]+/.test(text)) {
            // Look for phrases like "Total Due", "Amount Due", "Balance", etc.
            if (text.toLowerCase().includes('total') || 
                text.toLowerCase().includes('due') || 
                text.toLowerCase().includes('balance') || 
                text.toLowerCase().includes('amount')) {
              const amountMatch = text.match(/\$[\d,.]+/);
              if (amountMatch) {
                totalDue = amountMatch[0];
                return false; // break the loop
              }
            }
          }
        });
        
        // If still not found, try looking for table cells or divs that might contain the total due
        if (!totalDue) {
          // Look for tables with total information
          $statement('table tr').each((i, el) => {
            const rowText = $statement(el).text().toLowerCase();
            if ((rowText.includes('total') || rowText.includes('due') || rowText.includes('balance')) && 
                rowText.includes('$')) {
              // Get the cell with the dollar amount
              const amountMatch = rowText.match(/\$[\d,.]+/);
              if (amountMatch) {
                totalDue = amountMatch[0];
                return false; // break the loop
              }
            }
          });
        }
      }
      console.log('Extracted total due:', totalDue || 'Not found');
      
      // If we couldn't extract the data properly, try a more aggressive approach
      // by parsing the raw HTML for specific patterns
      if (!consignorName || !auctionTitle || !totalDue) {
        console.log('Using aggressive HTML parsing approach');
        const htmlString = statementResponse.data;
        
        // Look for consignor name in the raw HTML
        if (!consignorName) {
          const nameRegex = /(?:Consignor|Seller)[\s:]+([^<\n\r]+)/i;
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
      
      // Return error information
      return {
        statusCode: 500,
        body: JSON.stringify({ 
          message: 'Error fetching consignor data', 
          error: fetchError.message,
          status: fetchError.response ? fetchError.response.status : null
        })
      };
    }
  } catch (error) {
    console.error('Server error:', error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Server error', error: error.toString() })
    };
  }
};
