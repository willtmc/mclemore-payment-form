// Test script for statement parsing
require('dotenv').config();
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

async function testStatementParsing() {
  try {
    // Auction and Seller IDs to test
    const auctionCode = '11877';
    const sellerId = '3405';
    
    console.log(`Testing statement parsing for auction ${auctionCode}, seller ${sellerId}`);
    
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
    const statementUrl = `https://www.mclemoreauction.com/admin/statements/printreport/auction/${auctionCode}/sellerid/${sellerId}`;
    console.log('Fetching statement from:', statementUrl);
    
    const statementResponse = await session.get(statementUrl);
    console.log('Statement response status:', statementResponse.status);
    
    // Save the raw HTML for inspection
    fs.writeFileSync('statement-debug.html', statementResponse.data);
    console.log('Saved raw HTML to statement-debug.html');
    
    // Load the HTML into cheerio for parsing
    const $ = cheerio.load(statementResponse.data);
    
    // Extract and log the full body text for analysis
    const bodyText = $('body').text();
    fs.writeFileSync('statement-text.txt', bodyText);
    console.log('Saved body text to statement-text.txt');
    console.log('\nBody text sample:\n', bodyText.substring(0, 500));
    
    // Try to find seller information section
    console.log('\nLooking for seller information...');
    const sellerPattern = /Seller\s+Number:\s*(\d+)\s+([^\n]+)/i;
    const sellerMatch = bodyText.match(sellerPattern);
    
    if (sellerMatch) {
      console.log('Found seller information:');
      console.log('Seller Number:', sellerMatch[1]);
      console.log('Seller Name:', sellerMatch[2]);
    } else {
      console.log('No seller information found with pattern');
    }
    
    // Try to find email
    console.log('\nLooking for email...');
    const emailPattern = /Email:\s*([\w.-]+@[\w.-]+\.[a-zA-Z]{2,})/i;
    const emailMatch = bodyText.match(emailPattern);
    
    if (emailMatch) {
      console.log('Found email:', emailMatch[1]);
    } else {
      console.log('No email found with pattern');
      
      // Try to find any email address in the text
      const anyEmailPattern = /[\w.-]+@[\w.-]+\.[a-zA-Z]{2,}/g;
      const anyEmails = bodyText.match(anyEmailPattern);
      
      if (anyEmails && anyEmails.length > 0) {
        console.log('Found these email addresses in the text:');
        anyEmails.forEach(email => console.log('- ' + email));
      } else {
        console.log('No email addresses found in the text');
      }
    }
    
    // Try to find auction title
    console.log('\nLooking for auction title...');
    const titlePattern = /Statement\s+For:\s*([^\n]+)/i;
    const titleMatch = bodyText.match(titlePattern);
    
    if (titleMatch) {
      console.log('Found auction title:', titleMatch[1].trim());
    } else {
      console.log('No auction title found with pattern');
    }
    
    // Try to find statement date
    console.log('\nLooking for statement date...');
    const datePattern = /Statement\s+Date:\s*([^\n]+)/i;
    const dateMatch = bodyText.match(datePattern);
    
    if (dateMatch) {
      console.log('Found statement date:', dateMatch[1].trim());
    } else {
      console.log('No statement date found with pattern');
    }
    
    // Try to find total amount due
    console.log('\nLooking for total amount due...');
    const amountPattern = /Total\s+Amount\s+Due\s+\$([\d,.]+)/i;
    const amountMatch = bodyText.match(amountPattern);
    
    if (amountMatch) {
      console.log('Found total amount due:', amountMatch[1]);
    } else {
      console.log('No total amount due found with pattern');
    }
    
    return true;
  } catch (error) {
    console.error('Error testing statement parsing:');
    console.error(error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    return false;
  }
}

// Run the test
testStatementParsing()
  .then(success => {
    if (success) {
      console.log('\nStatement parsing test completed successfully!');
      process.exit(0);
    } else {
      console.log('\nStatement parsing test failed!');
      process.exit(1);
    }
  })
  .catch(err => {
    console.error('Unexpected error during test:', err);
    process.exit(1);
  });
