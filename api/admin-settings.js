// /api/admin-settings — Pixel ID + CAPI token (protegido; token nunca volta)
import { getMetaPublic, getMetaSecrets, saveMetaSettings } from '../lib/db.js';

function auth(req) {
  const pw = req.headers['x-admin-password'] || req.query.pw || req.body?.pw;
  return pw === (process.env.ADMIN_PASSWORD || 'jesus123');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-password');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!auth(req)) return res.status(401).json({ error: 'Não autorizado' });
  if (req.method === 'GET') {
    const pub = await getMetaPublic();
    const sec = await getMetaSecrets();
    return res.json({ metaPixelId: pub.metaPixelId, hasCapiToken: !!sec.token });
  }
  if (req.method === 'POST') {
    return res.json(await saveMetaSettings({ pixelId: req.body?.pixelId, token: req.body?.token }));
  }
  return res.status(405).end();
}
