// Netlify/Vercel Serverless Function: /api/inactive-customers.js

const API_TOKEN = process.env.NAWRAS_API_TOKEN || 'f651a69a2df9596088c524208de21d91d09457b9fc3e75bade2903390713f703';
const API_BASE = 'https://backoffice.nawris.algoriza.com/external-api';

exports.handler = async (event, context) => {
    // Enable CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        // Get days parameter (default: 10 days)
        const days = parseInt(event.queryStringParameters?.days) || 10;

        const response = await fetch(
            `${API_BASE}/customers/inactive?days=${days}`,
            {
                headers: {
                    'Accept': 'application/json',
                    'X-API-TOKEN': API_TOKEN
                }
            }
        );

        if (!response.ok) {
            throw new Error(`API returned ${response.status}`);
        }

        const data = await response.json();
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(data)
        };

    } catch (error) {
        console.error('Error fetching inactive customers:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Failed to fetch data',
                message: error.message 
            })
        };
    }
};
