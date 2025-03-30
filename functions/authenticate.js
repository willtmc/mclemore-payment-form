// Netlify Function to authenticate MAC staff

const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');
const crypto = require('crypto');
const querystring = require('querystring'); // For application/x-www-form-urlencoded

// Simple in-memory cache for storing mclemoreauction.com session cookies associated with our app's staff session ID
// WARNING: This is not suitable for production due to the potentially stateless nature of serverless functions
// and lack of scaling support. Consider using a persistent store (e.g., Redis, FaunaDB)
// or returning signed session info (JWT) to the client for production use.
const staffSessionCache = {};

// Base URL and Login URL from Python script analysis
const BASE_URL = "https://www.mclemoreauction.com";
const LOGIN_URL = `${BASE_URL}/api/ajaxlogin`;

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ message: 'Method Not Allowed' }) };
    }

    let credentials;
    try {
        // Netlify Functions might decode base64 bodies automatically or not, handle both cases
        const body = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf-8') : event.body;
        credentials = JSON.parse(body);
        if (!credentials.username || !credentials.password) {
            throw new Error('Username and password are required.');
        }
    } catch (error) {
        console.error("Error parsing request body:", error);
        return { statusCode: 400, body: JSON.stringify({ message: 'Invalid request body: ' + error.message }) };
    }

    const { username, password } = credentials;

    // Create a specific cookie jar for this login attempt
    const jar = new CookieJar();
    // Wrap axios instance to automatically handle cookies
    const client = wrapper(axios.create({ jar, withCredentials: true }));

    // Mimic headers identified from the Python script
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        // 'Accept-Encoding': 'gzip, deflate, br', // Let axios handle this
        'Content-Type': 'application/x-www-form-urlencoded',
        'Origin': BASE_URL,
        'Referer': `${BASE_URL}/login/`, // Referer seems important based on script
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        // Add any other headers deemed necessary from browser inspection if login fails
    };

    // Login data structure from Python script
    const loginData = {
        'user_name': username,
        'password': password,
        'autologin': '' // Send empty string as observed
    };

    try {
        console.log(`Attempting login for user: ${username} to ${LOGIN_URL}`);
        
        // --- BEGIN Pre-Login Step ---
        const loginPageUrl = `${BASE_URL}/login/`;
        try {
            console.log(`Step 0: Fetching login page from ${loginPageUrl} to establish initial cookies.`);
            await client.get(loginPageUrl, {
                headers: { // Send minimal headers for the GET request
                     'User-Agent': headers['User-Agent'], 
                     'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                     'Accept-Language': headers['Accept-Language'] 
                },
                validateStatus: function (status) { return status >= 200 && status < 400; } 
            });
            console.log("Initial login page fetched.");

            // --- Added Step: GET /api/cookies ---
            const cookiesApiUrl = `${BASE_URL}/api/cookies`;
            console.log(`Step 1: Getting cookies API from ${cookiesApiUrl}`);
            await client.get(cookiesApiUrl, {
                 headers: { // Reuse relevant headers
                     'User-Agent': headers['User-Agent'],
                     'Accept': 'application/json, text/plain, */*', 
                     'Referer': loginPageUrl 
                 },
                 validateStatus: function (status) { return status >= 200 && status < 400; }
            });
             console.log("Cookies API fetched.");
             
            // --- Added Step: GET /api/getsession ---
            const getSessionApiUrl = `${BASE_URL}/api/getsession`;
            console.log(`Step 2: Getting session API from ${getSessionApiUrl}`);
            await client.get(getSessionApiUrl, {
                 headers: { // Reuse relevant headers
                     'User-Agent': headers['User-Agent'],
                     'Accept': 'application/json, text/plain, */*', 
                     'Referer': loginPageUrl 
                 },
                 validateStatus: function (status) { return status >= 200 && status < 400; }
            });
            console.log("Session API fetched.");
            
             // Optional: Log cookies after these steps (REMOVED)
             // const currentCookies = await jar.getCookies(BASE_URL);
             // console.log('Cookies before POST login:', currentCookies);

        } catch (preLoginError) {
             console.error(`Error during multi-step pre-login sequence:`, preLoginError.message);
             console.warn("Proceeding with login POST despite pre-login error.");
        }
        // --- END Pre-Login Step ---
        
        // REMOVED Request Header/Data Logging
        // console.log('Login Request Headers:', JSON.stringify(headers, null, 2)); 
        // console.log('Login Request Data:', querystring.stringify(loginData)); 

        // --- POST Login Attempt ---
        const response = await client.post(LOGIN_URL, querystring.stringify(loginData), {
             headers: headers, 
             validateStatus: function (status) {
                 // Return to validating only success codes after debugging
                 return status >= 200 && status < 300; 
             },
        });
        
        // REMOVED Response Header/Data Logging
        // console.log(`Login response status: ${response.status}`);
        // console.log('Login Response Headers:', JSON.stringify(response.headers, null, 2)); 
        // console.log('Login Response Data:', response.data); 

        // --- Check for successful login ---        
        let loginSuccess = false;
        const responseData = response.data;

        // Check if status code itself indicates success first (REMOVED redundant check, covered by validateStatus)
        // if (response.status >= 200 && response.status < 300) { 
            // Primary Check: JSON response body for status: 'success'
            if (responseData && typeof responseData === 'object' && responseData.status === 'success') {
                 console.log(`Login successful for ${username} based on JSON status.`);
                 loginSuccess = true;
            }
    
            // Secondary Check (Fallback): If JSON status wasn't definitive 'success', check cookies.
            if (!loginSuccess) {
                const cookies = await jar.getCookies(BASE_URL);
                const sessionCookie = cookies.find(cookie =>
                    // Look specifically for sessiontoken based on successful log
                    cookie.key?.toLowerCase() === 'sessiontoken' 
                );
                 if (sessionCookie) {
                     console.log(`Login potentially successful for ${username} based on presence of cookie: ${sessionCookie.key}`);
                     loginSuccess = true;
                 }
            }
        // } else { 
        //    // Status code indicates failure (REMOVED, handled by catch block now)
        //    console.warn(`Login request failed with status code: ${response.status}`);
        //    loginSuccess = false; 
        // }

        // --- Handle Login Result ---
        if (loginSuccess) {
            // Generate a unique session ID for our app's staff session
            const staffSessionId = crypto.randomBytes(16).toString('hex');

            // Store the cookie jar (containing the mclemore session cookies) in the cache
            staffSessionCache[staffSessionId] = jar;
            console.log(`Login successful for ${username}. Staff session ID created: ${staffSessionId}`);

            // Simple mechanism to clean up very old cache entries (improve for production)
            if (Object.keys(staffSessionCache).length > 100) { 
               const oldestKey = Object.keys(staffSessionCache)[0];
               delete staffSessionCache[oldestKey];
            }

            // Return the session ID to the client
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ staffSessionId: staffSessionId })
            };
       } else {
            // Login failed (This part should ideally not be reached if validateStatus catches non-2xx)
            let errorMessage = 'Login failed. Invalid username or password, or unexpected response from server.';
            if (responseData && typeof responseData === 'object' && responseData.msg) {
                errorMessage = `Login failed: ${responseData.msg}`;
            }
            console.error(`Login failed for user ${username}: ${errorMessage}`);
            return {
                statusCode: 401, 
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: errorMessage })
            };
       }

    } catch (error) {
        // Catch network errors or errors from non-2xx responses due to validateStatus
        console.error('Error during mclemore login request for user', username);
        let errorMessage = "An unexpected error occurred during login.";
        let statusCode = 500;

        if (error.response) {
            // The request was made and the server responded with a status code outside 2xx
            console.error('Status:', error.response.status);
            // console.error('Headers:', error.response.headers); // Maybe keep headers logged?
            console.error('Data:', error.response.data); // Log error response data
            statusCode = error.response.status || 500;
            // Try to get specific message from error response
            const errorData = error.response.data;
            if (errorData && typeof errorData === 'object' && errorData.msg) {
                errorMessage = `Login failed: ${errorData.msg}`;
                statusCode = 401; // Assume it's an auth error if msg is present
            } else {
                errorMessage = `Login endpoint returned error status: ${error.response.status}`;
            }
        } else if (error.request) {
            // The request was made but no response was received
            console.error('Request Error: No response received');
            errorMessage = 'No response received from login endpoint.';
            statusCode = 504; // Gateway Timeout
        } else {
            // Something happened in setting up the request that triggered an Error
            console.error('Request Setup Error:', error.message);
            errorMessage = `Error during login setup: ${error.message}`;
            statusCode = 500;
        }
         return {
             statusCode: statusCode,
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ message: errorMessage })
        };
    }
};

// Export the cache and base URL for use in other functions
module.exports.staffSessionCache = staffSessionCache;
module.exports.BASE_URL = BASE_URL;
