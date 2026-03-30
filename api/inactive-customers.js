const https = require('https');
const TOKEN = 'f651a69a2df9596088c524208de21d91d09457b9fc3e75bade2903390713f703';

function apiReq(path) {
    return new Promise((resolve, reject) => {
        https.request({ hostname: 'backoffice.nawris.algoriza.com', path: '/external-api' + path, headers: { 'Accept': 'application/json', 'X-API-TOKEN': TOKEN } }, res => {
            let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(e); } });
        }).on('error', reject).end();
    });
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    if (req.method === 'OPTIONS') return res.status(200).end();
    try {
        const days = parseInt(req.query.days) || 10;
        let all = [], cursor = null, more = true;
        while (more) {
            const p = cursor ? `/customers/inactive?days=${days}&cursor=${cursor}` : `/customers/inactive?days=${days}`;
            const d = await apiReq(p);
            if (d.data) all = all.concat(d.data);
            cursor = d.meta && d.meta.next_cursor ? d.meta.next_cursor : null;
            more = !!cursor;
        }
        res.json({ success: true, data: all, total: all.length });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

module.exports.handler = async (event) => {
    const h = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: h, body: '' };
    try {
        const days = parseInt((event.queryStringParameters || {}).days) || 10;
        let all = [], cursor = null, more = true;
        while (more) {
            const p = cursor ? `/customers/inactive?days=${days}&cursor=${cursor}` : `/customers/inactive?days=${days}`;
            const d = await apiReq(p);
            if (d.data) all = all.concat(d.data);
            cursor = d.meta && d.meta.next_cursor ? d.meta.next_cursor : null;
            more = !!cursor;
        }
        return { statusCode: 200, headers: h, body: JSON.stringify({ success: true, data: all, total: all.length }) };
    } catch (e) { return { statusCode: 500, headers: h, body: JSON.stringify({ error: e.message }) }; }
};
