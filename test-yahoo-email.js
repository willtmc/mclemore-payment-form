// Test script for sending email to Yahoo address
require('dotenv').config();
const nodemailer = require('nodemailer');

async function testYahooEmail() {
  console.log('Testing Yahoo email sending...');
  
  // Use your Gmail account
  const username = process.env.EMAIL_USER;
  const password = process.env.EMAIL_PASS;
  
  // Send to Yahoo email
  const yahooEmail = 'willtmc@yahoo.com';
  
  console.log(`Using Gmail SMTP with account: ${username}`);
  console.log(`Sending test email to Yahoo: ${yahooEmail}`);
  
  try {
    // Create transporter with explicit Gmail configuration
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: username,
        pass: password
      },
      debug: true
    });

    // Verify connection
    console.log('Verifying SMTP connection...');
    await transporter.verify();
    console.log('SMTP connection successful!');

    // Send test email with modified From field
    const info = await transporter.sendMail({
      from: `"McLemore Auction Payment" <${username}>`,
      to: yahooEmail,
      replyTo: username,
      subject: 'Test Email to Yahoo from McLemore Payment Form',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #5D1916;">Yahoo Email Test</h2>
          <p>This is a test email to your Yahoo address from the McLemore Payment Form application.</p>
          <p>If you received this email, we can confirm that the email sending functionality works correctly when sending to Yahoo email addresses.</p>
          <p>Time sent: ${new Date().toLocaleString()}</p>
        </div>
      `
    });

    console.log('Email sent successfully!');
    console.log('Message ID:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending email:');
    console.error(error);
    return false;
  }
}

// Run the test
testYahooEmail()
  .then(success => {
    if (success) {
      console.log('Yahoo email test completed successfully!');
      process.exit(0);
    } else {
      console.log('Yahoo email test failed!');
      process.exit(1);
    }
  })
  .catch(err => {
    console.error('Unexpected error during test:', err);
    process.exit(1);
  });
