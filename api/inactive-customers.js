// Netlify/Vercel Serverless Function: /api/inactive-customers.js

const API_TOKEN = process.env.NAWRAS_API_TOKEN;
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

        // Fetch all pages
        let allData = [];
        let cursor = null;
        let hasMore = true;

        while (hasMore) {
            const url = cursor 
                ? `${API_BASE}/customers/inactive?days=${days}&cursor=${cursor}`
                : `${API_BASE}/customers/inactive?days=${days}`;

            const response = await fetch(url, {
                headers: {
                    'Accept': 'application/json',
                    'X-API-TOKEN': API_TOKEN
                }
            });

            if (!response.ok) {
                throw new Error(`API returned ${response.status}`);
            }

            const data = await response.json();
            
            if (data.data && Array.isArray(data.data)) {
                allData = allData.concat(data.data);
            }

            // Check if there's a next page
            if (data.meta && data.meta.next_cursor) {
                cursor = data.meta.next_cursor;
            } else {
                hasMore = false;
            }
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                data: allData,
                total: allData.length
            })
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
