// GET /api/traffic?days=30 — estatísticas estilo UTMify (protegido)
import { trafficStats } from '../lib/db.js';

export default async function handler(req, res) {
  const pw = req.headers['x-admin-password'] || req.query.pw;
  if (pw !== (process.env.ADMIN_PASSWORD || 'jesus123'))
    return res.status(401).json({ error: 'Não autorizado' });
  const days = Math.min(365, Math.max(1, Number(req.query.days) || 30));
  return res.json(await trafficStats(days));
}
