// /api/admin-spend — verba de anúncios (protegido)
import { addSpend, listSpend, deleteSpend } from '../lib/db.js';

function auth(req) {
  const pw = req.headers['x-admin-password'] || req.query.pw || req.body?.pw;
  return pw === (process.env.ADMIN_PASSWORD || 'jesus123');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-password');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!auth(req)) return res.status(401).json({ error: 'Não autorizado' });
  if (req.method === 'GET') return res.json({ spend: await listSpend() });
  if (req.method === 'POST') return res.json(await addSpend({ date: req.body?.date, campaign: req.body?.campaign, amount: req.body?.amount }));
  if (req.method === 'DELETE') {
    await deleteSpend(req.query.id);
    return res.json({ ok: true });
  }
  return res.status(405).end();
}
