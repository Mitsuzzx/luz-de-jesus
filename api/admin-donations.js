// GET /api/admin-donations?pw=XXX — lista doações + stats (protegido)
import { getStats, listDonations } from '../lib/db.js';

export default async function handler(req, res) {
  const pw = req.headers['x-admin-password'] || req.query.pw;
  if (pw !== (process.env.ADMIN_PASSWORD || 'jesus123'))
    return res.status(401).json({ error: 'Não autorizado' });
  return res.json({ stats: await getStats(), donations: await listDonations() });
}
