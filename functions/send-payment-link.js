// Netlify Function to send payment form link via email
const nodemailer = require('nodemailer');

exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    // Verify authentication token
    const authHeader = event.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { statusCode: 401, body: JSON.stringify({ message: 'Unauthorized' }) };
    }

    const token = authHeader.split(' ')[1];
    let tokenData;
    
    try {
      tokenData = JSON.parse(Buffer.from(token, 'base64').toString());
      
      // Check if token is expired
      if (tokenData.exp < Date.now()) {
        return { statusCode: 401, body: JSON.stringify({ message: 'Token expired' }) };
      }
    } catch (e) {
      return { statusCode: 401, body: JSON.stringify({ message: 'Invalid token' }) };
    }

    // Parse the request body
    const { consignorName, consignorEmail, paymentFormUrl, auctionTitle } = JSON.parse(event.body);

    if (!consignorName || !consignorEmail || !paymentFormUrl) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Missing required parameters' })
      };
    }

    // Send the email using nodemailer
    try {
      const emailSent = await sendEmail(consignorName, consignorEmail, paymentFormUrl, auctionTitle);
      
      if (emailSent) {
        return {
          statusCode: 200,
          body: JSON.stringify({ 
            message: 'Payment link sent successfully',
            recipient: consignorEmail 
          })
        };
      } else {
        console.error('Email sending failed');
        return {
          statusCode: 500,
          body: JSON.stringify({ message: 'Failed to send email' })
        };
      }
    } catch (emailError) {
      console.error('Email error:', emailError);
      return {
        statusCode: 500,
        body: JSON.stringify({ message: 'Failed to send email', error: emailError.toString() })
      };
    }
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Server error', error: error.toString() })
    };
  }
};

// This function sends an email using nodemailer
async function sendEmail(consignorName, consignorEmail, paymentFormUrl, auctionTitle) {
  console.log(`Sending email to ${consignorEmail}`);
  
  // Log the parameters for debugging
  console.log('Email parameters:', {
    consignorName,
    consignorEmail,
    paymentFormUrl,
    auctionTitle
  });
  
  // Create a test account if we don't have real credentials
  // In production, use environment variables for credentials
  let testAccount;
  let transporter;
  
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log('Using Ethereal test account for email');
    testAccount = await nodemailer.createTestAccount();
    
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });
  } else {
    console.log('Using configured email account');
    // Use the configured email service
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_SERVER || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USERNAME || process.env.EMAIL_USER,
        pass: process.env.SMTP_APP_PASSWORD || process.env.EMAIL_PASS
      }
    });
  }

  const mailOptions = {
    from: process.env.EMAIL_FROM || process.env.REPORT_EMAIL || 'McLemore Auction <noreply@mclemoreauction.com>',
    to: consignorEmail,
    subject: 'McLemore Auction Payment Form',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <img src="https://mclemore-payment-form.netlify.app/images/mclemore-logo.png" alt="McLemore Auction Company" style="max-width: 200px; margin-bottom: 20px;">
        <h2 style="color: #5D1916;">Payment Information Request</h2>
        <p>Dear ${consignorName},</p>
        <p>Thank you for consigning with McLemore Auction Company. To process your payment for auction proceeds, please use the secure link below to submit your banking information for ACH direct deposit.</p>
        <p><a href="${paymentFormUrl}" style="display: inline-block; background-color: #5D1916; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">Submit Payment Information</a></p>
        <p>If the button above doesn't work, you can copy and paste this link into your browser:</p>
        <p style="word-break: break-all;">${paymentFormUrl}</p>
        <p>For security reasons, this link will expire in 7 days.</p>
        <p>If you have any questions, please contact our support team at <a href="mailto:support@mclemoreauction.com">support@mclemoreauction.com</a>.</p>
        <p>Thank you,<br>McLemore Auction Company</p>
      </div>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.messageId);
    
    // If using Ethereal, provide the test URL
    if (testAccount) {
      console.log('Preview URL:', nodemailer.getTestMessageUrl(info));
    }
    
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}
