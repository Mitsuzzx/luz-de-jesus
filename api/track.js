// POST /api/track — registra visita com UTMs (Vercel serverless)
import { trackVisit } from '../lib/db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const b = req.body || {};
    await trackVisit({
      visitorId: b.visitorId, path: b.path,
      utm_source: b.utm_source, utm_medium: b.utm_medium, utm_campaign: b.utm_campaign,
      utm_content: b.utm_content, utm_term: b.utm_term,
      referrer: b.referrer, userAgent: req.headers['user-agent'] || ''
    });
    return res.json({ ok: true });
  } catch {
    return res.json({ ok: false });
  }
}
