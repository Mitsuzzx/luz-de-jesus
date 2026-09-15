// GET /api/status?id=XXX — consulta pagamento Sharpify (+ CAPI no approve)
import { updateStatus, getDonation, getMetaSecrets } from '../lib/db.js';
import { sendPurchaseCAPI } from '../lib/meta.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const id = req.query.id;
  if (!id) return res.status(400).json({ error: 'id required' });
  if (String(id).startsWith('demo_')) return res.json({ status: 'PENDING', demo: true });
  const { SHARPIFY_CLIENT_ID = '', SHARPIFY_CLIENT_SECRET = '', SHARPIFY_BASE = 'https://sharpify-pay.com' } = process.env;
  try {
    const r = await fetch(`${SHARPIFY_BASE}/api/v1/gateway/payment/get-payment?paymentLinkId=${encodeURIComponent(id)}`, {
      headers: { 'x-sharpify-client-id': SHARPIFY_CLIENT_ID, 'x-sharpify-client-secret': SHARPIFY_CLIENT_SECRET }
    });
    const json = await r.json();
    const st = json.data?.status || 'PENDING';
    const prev = await getDonation(id);
    await updateStatus(id, st);
    if (st === 'APPROVED' && prev && prev.status !== 'APPROVED') {
      const meta = await getMetaSecrets();
      sendPurchaseCAPI({
        pixelId: meta.pixelId, token: meta.token,
        eventId: prev.eventId || id, value: prev.amount,
        fbp: prev.fbp, fbc: prev.fbc,
        userAgent: req.headers['user-agent'], email: prev.email
      });
    }
    return res.json({ status: st, data: json.data });
  } catch {
    return res.status(500).json({ status: 'UNKNOWN' });
  }
}
