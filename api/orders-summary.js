// Netlify/Vercel Serverless Function: /api/orders-summary.js

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
        // Get date range (default: last 30 days)
        const to = new Date().toISOString().split('T')[0];
        const from = new Date();
        from.setDate(from.getDate() - 30);
        const fromDate = from.toISOString().split('T')[0];

        // Fetch all pages
        let allData = [];
        let cursor = null;
        let hasMore = true;

        while (hasMore) {
            const url = cursor 
                ? `${API_BASE}/customers/orders-summary?from=${fromDate}&to=${to}&cursor=${cursor}`
                : `${API_BASE}/customers/orders-summary?from=${fromDate}&to=${to}`;

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
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
        console.error('Error fetching orders summary:', error);
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
