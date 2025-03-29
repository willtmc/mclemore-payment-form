// Netlify Function to retrieve consignor data
exports.handler = async (event, context) => {
  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
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

    // Get auction code and consignor ID from query parameters
    const auctionCode = event.queryStringParameters.auctionCode;
    const consignorId = event.queryStringParameters.consignorId;

    if (!auctionCode || !consignorId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Missing required parameters' })
      };
    }

    // In a production environment, you would query a database
    // For now, we'll use a simple database simulation
    const consignorDatabase = [
      {
        auctionCode: '3005',
        consignorId: '273',
        name: 'Mark Johnson',
        email: 'mark.johnson@example.com',
        auctionTitle: 'Commercial Retail Fixtures, Drop-in Ceiling Tiles & Equipment Liquidation - Columbia, TN',
        statementDate: '03/29/2025',
        totalDue: '$819.62'
      },
      {
        auctionCode: '3006',
        consignorId: '145',
        name: 'Sarah Williams',
        email: 'sarah.williams@example.com',
        auctionTitle: 'Estate Liquidation - Franklin, TN',
        statementDate: '03/27/2025',
        totalDue: '$1,245.78'
      },
      {
        auctionCode: '3007',
        consignorId: '392',
        name: 'Robert Davis',
        email: 'robert.davis@example.com',
        auctionTitle: 'Commercial Kitchen Equipment - Nashville, TN',
        statementDate: '03/25/2025',
        totalDue: '$2,567.30'
      }
    ];

    // Find matching consignor data
    const consignorData = consignorDatabase.find(
      (consignor) => consignor.auctionCode === auctionCode && consignor.consignorId === consignorId
    );

    if (consignorData) {
      return {
        statusCode: 200,
        body: JSON.stringify(consignorData)
      };
    } else {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'Consignor not found' })
      };
    }
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Server error', error: error.toString() })
    };
  }
};
