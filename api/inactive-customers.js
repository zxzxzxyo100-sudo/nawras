const https = require('https');
const TOKEN = 'f651a69a2df9596088c524208de21d91d09457b9fc3e75bade2903390713f703';

function apiReq(path) {
    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: 'backoffice.nawris.algoriza.com',
            path: '/external-api' + path,
            method: 'GET',
            headers: { 'Accept': 'application/json', 'X-API-TOKEN': TOKEN }
        }, res => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(e); } });
        });
        req.on('error', reject);
        req.end();
    });
}

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const days = parseInt(req.query && req.query.days || 10);
        let all = [], cursor = null, more = true;
        while (more) {
            const p = cursor
                ? '/customers/inactive?days=' + days + '&cursor=' + cursor
                : '/customers/inactive?days=' + days;
            const d = await apiReq(p);
            if (d.data) all = all.concat(d.data);
            cursor = d.meta && d.meta.next_cursor ? d.meta.next_cursor : null;
            more = !!cursor;
        }
        return res.status(200).json({ success: true, data: all, total: all.length });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};
