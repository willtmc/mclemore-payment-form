// Test script for email functionality
require('dotenv').config();
const nodemailer = require('nodemailer');

async function testEmail() {
  console.log('Testing email functionality...');
  
  // Log all environment variables for debugging
  console.log('Environment variables loaded:');
  console.log('EMAIL_USER:', process.env.EMAIL_USER);
  console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? '****' : 'Not set');
  console.log('EMAIL_FROM:', process.env.EMAIL_FROM);
  console.log('EMAIL_SERVICE:', process.env.EMAIL_SERVICE);
  
  // Gmail specific configuration
  const username = process.env.EMAIL_USER;
  const password = process.env.EMAIL_PASS;
  const recipient = process.env.EMAIL_USER; // Send to self for testing
  
  if (!username || !password) {
    console.error('ERROR: Email credentials not found in environment variables.');
    console.error('Make sure EMAIL_USER and EMAIL_PASS are set in your .env file.');
    return false;
  }

  try {
    console.log(`Using Gmail SMTP with account: ${username}`);
    
    // Create transporter with explicit Gmail configuration
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: username,
        pass: password
      },
      debug: true // Enable debug output
    });

    // Verify connection
    console.log('Verifying SMTP connection...');
    await transporter.verify();
    console.log('SMTP connection successful!');

    // Send test email
    console.log(`Sending test email to ${recipient}...`);
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || `Test <${username}>`,
      to: recipient,
      subject: 'Test Email from McLemore Payment Form',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #5D1916;">Email Test Successful</h2>
          <p>This is a test email from the McLemore Payment Form application.</p>
          <p>If you received this email, the email functionality is working correctly.</p>
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
testEmail()
  .then(success => {
    if (success) {
      console.log('Email test completed successfully!');
      process.exit(0);
    } else {
      console.log('Email test failed!');
      process.exit(1);
    }
  })
  .catch(err => {
    console.error('Unexpected error during test:', err);
    process.exit(1);
  });
