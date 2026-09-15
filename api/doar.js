// POST /api/doar — cria PIX Sharpify (Vercel serverless)
import { addDonation, MIN_DONATION } from '../lib/db.js';
import { newEventId } from '../lib/meta.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { SHARPIFY_CLIENT_ID = '', SHARPIFY_CLIENT_SECRET = '', WEBHOOK_URL = '' } = process.env;
  const SHARPIFY_BASE = (process.env.SHARPIFY_BASE || '').trim() || 'https://sharpify-pay.com';
  try {
    const { amount, causa = 'ambos', nome = '', email = '', visitorId = '', fbp = '', fbc = '' } = req.body || {};
    const utm = {
      utm_source: req.body?.utm_source || null, utm_medium: req.body?.utm_medium || null,
      utm_campaign: req.body?.utm_campaign || null, utm_content: req.body?.utm_content || null,
      utm_term: req.body?.utm_term || null
    };
    const value = Number(amount);
    if (!value || isNaN(value) || value < MIN_DONATION)
      return res.status(400).json({ error: `Mínimo R$ ${MIN_DONATION.toFixed(2)}` });

    if (!SHARPIFY_CLIENT_ID || !SHARPIFY_CLIENT_SECRET) {
      const id = 'demo_' + Date.now();
      const code = `PIX DEMO LuzDeJesus ${causa} ${value.toFixed(2)} ${id}`;
      const eventId = newEventId();
      const pay = { id, status: 'PENDING', demo: true, qrCode: `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(code)}`, code, paymentLink: null, amount: value, eventId };
      await addDonation({ id, amount: value, causa, nome: nome || 'Anônimo', email: email || '', status: 'PENDING', code, paymentLink: null, visitorId, fbp, fbc, eventId, ...utm });
      return res.json(pay);
    }

    const label = causa === 'animais' ? 'Animais - Patas Protegidas' : causa === 'necessitados' ? 'Necessitados - Prato Cheio' : 'Necessitados + Animais';
    const r = await fetch(`${SHARPIFY_BASE}/api/v1/gateway/payment/create-paymnet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-sharpify-client-id': SHARPIFY_CLIENT_ID, 'x-sharpify-client-secret': SHARPIFY_CLIENT_SECRET },
      body: JSON.stringify({
        name: `Doacao ${label} - ${nome || 'Anonimo'}`.slice(0, 80),
        description: `Doacao ${value} para ${label}. Email: ${email || 'n/i'}`,
        amount: Number(value.toFixed(2)),
        gatewayMethod: 'PIX',
        ...(WEBHOOK_URL ? { webhook: { callbackURL: WEBHOOK_URL } } : {})
      })
    });
    const json = await r.json();
    if (!r.ok) return res.status(502).json({ error: 'Falha ao gerar PIX', detail: json });
    const pl = json.data;
    const eventId = newEventId();
    const pay = { id: pl.id, status: pl.status, qrCode: pl.payment?.gateway?.data?.qrCode, code: pl.payment?.gateway?.data?.code, paymentLink: pl.payment?.gateway?.data?.paymentLink, amount: pl.payment?.amount ?? value, eventId };
    await addDonation({ id: pay.id, amount: value, causa, nome: nome || 'Anônimo', email: email || '', status: pay.status || 'PENDING', code: pay.code, paymentLink: pay.paymentLink, visitorId, fbp, fbc, eventId, ...utm });
    return res.json(pay);
  } catch (e) {
    console.error(e);
    return res.status(502).json({ error: 'Falha ao gerar PIX. Tente de novo 💛' });
  }
}
