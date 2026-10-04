// POST /api/lead  (called by the connector script on the website when a form is submitted)
const kv = require('./_kv');

module.exports = async (req, res) => {
  kv.cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  if (!kv.configured()) return res.status(503).json({ error: 'storage not configured' });
  try {
    const b = kv.body(req);
    if (!kv.validToken(b.token)) return res.status(403).json({ error: 'invalid connector' });
    const site = await kv.cmd('GET', 'int:' + b.token);
    if (site === null || site === undefined) return res.status(403).json({ error: 'connector deleted' });
    const f = b.fields && typeof b.fields === 'object' ? b.fields : {};
    const lead = {
      name: String(b.name || f.name || '').slice(0, 120),
      phone: String(b.phone || f.phone || f.mobile || '').slice(0, 40),
      email: String(b.email || f.email || '').slice(0, 120),
      message: String(b.message || '').slice(0, 500),
      page: String(b.site || '').slice(0, 300),
      at: new Date().toISOString(),
    };
    if (!lead.name && !lead.phone && !lead.email) return res.status(200).json({ ok: true, skipped: true });
    await kv.cmd('RPUSH', 'leads:' + b.token, JSON.stringify(lead));
    await kv.cmd('LTRIM', 'leads:' + b.token, '-500', '-1');
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'server error' });
  }
};
