// Test script for direct email sending
require('dotenv').config();
const nodemailer = require('nodemailer');

async function testDirectEmail() {
  console.log('Testing direct email sending...');
  
  // Use your Gmail account
  const username = process.env.EMAIL_USER;
  const password = process.env.EMAIL_PASS;
  
  // Send to your own email for testing
  const recipient = username;
  
  console.log(`Using Gmail SMTP with account: ${username}`);
  console.log(`Sending test email to: ${recipient}`);
  
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

    // Send test email
    const info = await transporter.sendMail({
      from: `"McLemore Test" <${username}>`,
      to: recipient,
      subject: 'Direct Email Test from McLemore Payment Form',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #5D1916;">Direct Email Test</h2>
          <p>This is a direct test email from the McLemore Payment Form application.</p>
          <p>If you received this email, we can confirm that the email sending functionality works correctly when sending directly to your email.</p>
          <p>Time sent: ${new Date().toLocaleString()}</p>
          <p>Next, we'll need to investigate why emails aren't being delivered to seller email addresses.</p>
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
testDirectEmail()
  .then(success => {
    if (success) {
      console.log('Direct email test completed successfully!');
      process.exit(0);
    } else {
      console.log('Direct email test failed!');
      process.exit(1);
    }
  })
  .catch(err => {
    console.error('Unexpected error during test:', err);
    process.exit(1);
  });
