// POST   /api/integration        {token, site}  -> register a connector
// DELETE /api/integration?token= -> delete connector and its pending leads (stops all leads)
const kv = require('./_kv');

module.exports = async (req, res) => {
  kv.cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!kv.configured()) return res.status(503).json({ error: 'storage not configured' });
  try {
    if (req.method === 'POST') {
      const b = kv.body(req);
      if (!kv.validToken(b.token)) return res.status(400).json({ error: 'bad token' });
      await kv.cmd('SET', 'int:' + b.token, String(b.site || '').slice(0, 300));
      return res.status(200).json({ ok: true });
    }
    if (req.method === 'DELETE') {
      const t = (req.query && req.query.token) || '';
      if (!kv.validToken(t)) return res.status(400).json({ error: 'bad token' });
      await kv.cmd('DEL', 'int:' + t);
      await kv.cmd('DEL', 'leads:' + t);
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: 'server error' });
  }
};
