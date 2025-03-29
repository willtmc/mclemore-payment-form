// Test script for sending email to Seller ID address
require('dotenv').config();
const nodemailer = require('nodemailer');

async function testSellerIdEmail() {
  console.log('Testing seller email sending...');
  
  // Use your Gmail account
  const username = process.env.EMAIL_USER;
  const password = process.env.EMAIL_PASS;
  
  // Send to a test seller email (using a Seller ID format)
  const sellerEmail = '1153@mclemoreauction.com'; // Assuming Seller ID is used for email
  
  console.log(`Using Gmail SMTP with account: ${username}`);
  console.log(`Sending test email to seller: ${sellerEmail}`);
  
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
      to: sellerEmail,
      replyTo: username,
      subject: 'Test Email to Seller from McLemore Payment Form',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #5D1916;">Seller Email Test</h2>
          <p>This is a test email to a seller address from the McLemore Payment Form application.</p>
          <p>If you received this email, we can confirm that the email sending functionality works correctly when sending to seller email addresses based on Seller ID.</p>
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
testSellerIdEmail()
  .then(() => {
    console.log('Seller email test completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Seller email test failed!', error);
    process.exit(1);
  });
