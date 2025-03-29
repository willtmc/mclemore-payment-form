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

    // In a production environment, configure with your actual email service
    // For now, we'll just simulate sending an email
    const emailSent = simulateSendEmail(consignorName, consignorEmail, paymentFormUrl, auctionTitle);

    if (emailSent) {
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          message: 'Payment link sent successfully',
          recipient: consignorEmail 
        })
      };
    } else {
      return {
        statusCode: 500,
        body: JSON.stringify({ message: 'Failed to send email' })
      };
    }
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Server error', error: error.toString() })
    };
  }
};

// This function simulates sending an email
// In production, replace with actual email sending logic
function simulateSendEmail(consignorName, consignorEmail, paymentFormUrl, auctionTitle) {
  console.log(`Simulating email send to ${consignorEmail}`);
  console.log(`Subject: McLemore Auction Payment Form`);
  console.log(`Body: Dear ${consignorName}, Please use this secure link to submit your payment information for your auction proceeds from ${auctionTitle}: ${paymentFormUrl}`);
  
  // In production, this would use nodemailer or another email service
  // Example nodemailer implementation (commented out):
  /*
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  const mailOptions = {
    from: 'mclemore@example.com',
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

  return new Promise((resolve, reject) => {
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('Error sending email:', error);
        resolve(false);
      } else {
        console.log('Email sent:', info.response);
        resolve(true);
      }
    });
  });
  */
  
  // For now, just return true to simulate successful sending
  return true;
}
