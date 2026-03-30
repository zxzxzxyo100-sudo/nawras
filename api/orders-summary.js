const https = require('https');

const API_TOKEN = 'f651a69a2df9596088c524208de21d91d09457b9fc3e75bade2903390713f703';
const API_BASE = 'backoffice.nawris.algoriza.com';

function httpsGet(path) {
    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: API_BASE,
            path: '/external-api' + path,
            method: 'GET',
            headers: { 'Accept': 'application/json', 'X-API-TOKEN': API_TOKEN }
        }, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { reject(e); } });
        });
        req.on('error', reject);
        req.end();
    });
}

exports.handler = async (event) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

    try {
        const to = new Date().toISOString().split('T')[0];
        const from = new Date(); from.setDate(from.getDate() - 30);
        const fromDate = from.toISOString().split('T')[0];

        let allData = [], cursor = null, hasMore = true;
        while (hasMore) {
            const path = cursor
                ? `/customers/orders-summary?from=${fromDate}&to=${to}&cursor=${cursor}`
                : `/customers/orders-summary?from=${fromDate}&to=${to}`;
            const data = await httpsGet(path);
            if (data.data && Array.isArray(data.data)) allData = allData.concat(data.data);
            cursor = data.meta && data.meta.next_cursor ? data.meta.next_cursor : null;
            hasMore = !!cursor;
        }
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: allData, total: allData.length }) };
    } catch (error) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
