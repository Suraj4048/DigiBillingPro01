// GET /api/leads?token=  (used by the CRM to collect pending leads; returned leads are removed)
const kv = require('./_kv');

module.exports = async (req, res) => {
  kv.cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });
  if (!kv.configured()) return res.status(503).json({ error: 'storage not configured' });
  try {
    const t = (req.query && req.query.token) || '';
    if (!kv.validToken(t)) return res.status(400).json({ error: 'bad token' });
    const site = await kv.cmd('GET', 'int:' + t);
    if (site === null || site === undefined) return res.status(404).json({ error: 'connector not found' });
    const raw = (await kv.cmd('LRANGE', 'leads:' + t, '0', '-1')) || [];
    if (raw.length) await kv.cmd('LTRIM', 'leads:' + t, String(raw.length), '-1');
    const leads = raw.map((x) => { try { return JSON.parse(x); } catch (e) { return null; } }).filter(Boolean);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ leads });
  } catch (e) {
    return res.status(500).json({ error: 'server error' });
  }
};
