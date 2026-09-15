// POST /api/admin-goal — atualiza meta (protegido)
import { setGoal } from '../lib/db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-password');
  if (req.method === 'OPTIONS') return res.status(200).end();
  const pw = req.headers['x-admin-password'] || req.body?.pw || req.query.pw;
  if (pw !== (process.env.ADMIN_PASSWORD || 'jesus123'))
    return res.status(401).json({ error: 'Não autorizado' });
  const { goal, baseRaised } = req.body || {};
  return res.json(await setGoal(goal, baseRaised));
}
