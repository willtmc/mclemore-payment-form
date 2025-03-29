const { handler } = require('./functions/get-consignor-data');
const readline = require('readline');

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Prompt for credentials and auction/consignor information
async function promptForCredentials() {
  return new Promise((resolve) => {
    rl.question('Enter username: ', (username) => {
      rl.question('Enter password: ', (password) => {
        rl.question('Enter auction code: ', (auctionCode) => {
          rl.question('Enter consignor ID: ', (consignorId) => {
            resolve({
              username,
              password,
              auctionCode,
              consignorId
            });
            rl.close();
          });
        });
      });
    });
  });
}

// Call the function and log the result
async function testFunction() {
  try {
    console.log('Testing get-consignor-data function...');
    console.log('Please enter your credentials and auction information:');
    
    const credentials = await promptForCredentials();
    
    // Mock event object similar to what Netlify would provide
    const event = {
      httpMethod: 'POST',
      body: JSON.stringify(credentials)
    };

    // Mock context object
    const context = {};
    
    console.log('\nCalling function with provided credentials...');
    const result = await handler(event, context);
    console.log('Status code:', result.statusCode);
    console.log('Response body:', result.body);
    
    if (result.statusCode === 200) {
      const data = JSON.parse(result.body);
      console.log('\nExtracted consignor data:');
      console.log('Name:', data.name);
      console.log('Email:', data.email);
      console.log('Auction Title:', data.auctionTitle);
      console.log('Statement Date:', data.statementDate);
      console.log('Total Due:', data.totalDue);
    }
  } catch (error) {
    console.error('Error running function:', error);
  }
}

// Run the test
testFunction();
