// Luz de Jesus — backend Express (local) + Sharpify Gateway + Supabase (opcional)
// Na Vercel as rotas vivem em /api/*.js — este arquivo é para rodar local com `npm start`.
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { getStats, addDonation, updateStatus, listDonations, setGoal, recentList, getDonation, trackVisit, trafficStats, getMetaPublic, getMetaSecrets, saveMetaSettings, addSpend, listSpend, deleteSpend, MIN_DONATION } from './lib/db.js';
import { newEventId, sendPurchaseCAPI } from './lib/meta.js';

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
// 🔒 Só arquivos PÚBLICOS são servidos. Backend (server.js, /api, /lib, .env)
// nunca é exposto — nem pelo Sources do F12, nem por URL direta.
const PUBLIC_FILES = ['index.html', 'style.css', 'script.js', 'script.min.js', 'admin.html', 'checkout.html', 'checkout.js', 'checkout.min.js'];
PUBLIC_FILES.forEach(f => app.get('/' + f, (req, res) => res.sendFile(path.join(__dirname, 'public', f))));
// Checkout dedicado estilo Kiwify: /doacao/30?causa=animais (página física; fallback p/ checkout)
app.get('/doacao/:valor', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'doacao', String(req.params.valor), 'index.html'), (err) => {
    if (err) res.sendFile(path.join(__dirname, 'public', 'checkout.html'));
  });
});

const {
  SHARPIFY_CLIENT_ID = '',
  SHARPIFY_CLIENT_SECRET = '',
  SHARPIFY_BASE_RAW = '',
  WEBHOOK_URL = '',
  ADMIN_PASSWORD = 'jesus123',
  META_PIXEL_ID = '',
  META_CAPI_TOKEN = '',
  PORT = 3000
} = process.env;
const SHARPIFY_BASE = (process.env.SHARPIFY_BASE || '').trim() || 'https://sharpify-pay.com';

const causaLabel = (c) => c === 'animais' ? 'Animais - Patas Protegidas'
  : c === 'necessitados' ? 'Necessitados - Prato Cheio' : 'Necessitados + Animais';
const fmtBRL = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

async function createSharpify({ value, causa, nome, email }) {
  if (!SHARPIFY_CLIENT_ID || !SHARPIFY_CLIENT_SECRET) {
    const id = 'demo_' + Date.now();
    const code = `PIX DEMO LuzDeJesus ${causa} ${value.toFixed(2)} ${id}`;
    return { id, status: 'PENDING', demo: true, qrCode: `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(code)}`, code, paymentLink: null, amount: value };
  }
  const payload = {
    name: `Doacao ${causaLabel(causa)} - ${nome || 'Anonimo'}`.slice(0, 80),
    description: `Doacao ${fmtBRL(value)} para ${causaLabel(causa)}. Email: ${email || 'n/i'}`,
    amount: Number(value.toFixed(2)),
    gatewayMethod: 'PIX',
    ...(WEBHOOK_URL ? { webhook: { callbackURL: WEBHOOK_URL } } : {})
  };
  const r = await fetch(`${SHARPIFY_BASE}/api/v1/gateway/payment/create-paymnet`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-sharpify-client-id': SHARPIFY_CLIENT_ID, 'x-sharpify-client-secret': SHARPIFY_CLIENT_SECRET },
    body: JSON.stringify(payload)
  });
  const json = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(json).slice(0, 300));
  const pl = json.data;
  return {
    id: pl.id, status: pl.status,
    qrCode: pl.payment?.gateway?.data?.qrCode,
    code: pl.payment?.gateway?.data?.code,
    paymentLink: pl.payment?.gateway?.data?.paymentLink,
    amount: pl.payment?.amount ?? value
  };
}

app.post('/api/doar', async (req, res) => {
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
    const pay = await createSharpify({ value, causa, nome, email });
    const eventId = newEventId();
    await addDonation({ id: pay.id, amount: value, causa, nome: nome || 'Anônimo', email: email || '', status: pay.status || 'PENDING', code: pay.code, paymentLink: pay.paymentLink, visitorId, fbp, fbc, eventId, ...utm });
    res.json({ ...pay, eventId });
  } catch (e) {
    console.error(e);
    res.status(502).json({ error: 'Falha ao gerar PIX. Tente de novo 💛' });
  }
});

async function statusHandler(req, res) {
  try {
    const id = req.query.id || req.params.id;
    if (!id) return res.status(400).json({ error: 'id required' });
    if (String(id).startsWith('demo_')) return res.json({ status: 'PENDING', demo: true });
    const r = await fetch(`${SHARPIFY_BASE}/api/v1/gateway/payment/get-payment?paymentLinkId=${encodeURIComponent(id)}`, {
      headers: { 'x-sharpify-client-id': SHARPIFY_CLIENT_ID, 'x-sharpify-client-secret': SHARPIFY_CLIENT_SECRET }
    });
    const json = await r.json();
    const st = json.data?.status || 'PENDING';
    const prev = await getDonation(id);
    await updateStatus(id, st);
    // 🎯 aprovou de verdade (transição) → Purchase na Conversions API
    if (st === 'APPROVED' && prev && prev.status !== 'APPROVED') {
      const meta = await getMetaSecrets();
      sendPurchaseCAPI({
        pixelId: meta.pixelId, token: meta.token,
        eventId: prev.eventId || id, value: prev.amount,
        fbp: prev.fbp, fbc: prev.fbc,
        userAgent: req.headers['user-agent'], email: prev.email
      });
    }
    res.json({ status: st, data: json.data });
  } catch { res.status(500).json({ status: 'UNKNOWN' }); }
}
app.get('/api/status', statusHandler);
app.get('/api/status/:id', statusHandler);

app.get('/api/stats', async (req, res) => res.json(await getStats()));

// Config pública (só o que pode aparecer no navegador — Pixel ID é público por natureza)
app.get('/api/config', async (req, res) => res.json(await getMetaPublic()));

// Tracking de visitas (chamado pelo site a cada acesso)
app.post('/api/track', async (req, res) => {
  try {
    const b = req.body || {};
    await trackVisit({
      visitorId: b.visitorId, path: b.path,
      utm_source: b.utm_source, utm_medium: b.utm_medium, utm_campaign: b.utm_campaign,
      utm_content: b.utm_content, utm_term: b.utm_term,
      referrer: b.referrer, userAgent: req.headers['user-agent'] || ''
    });
    res.json({ ok: true });
  } catch { res.json({ ok: false }); }
});

// Feed público ao vivo (nomes mascarados, sem dados sensíveis)
app.get('/api/recent', async (req, res) => {
  res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=30');
  res.json({ donations: await recentList(8) });
});

function checkAdmin(req, res, next) {
  const pw = req.headers['x-admin-password'] || req.query.pw || req.body?.pw;
  if (pw !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Não autorizado' });
  next();
}
app.get('/api/admin/donations', checkAdmin, async (req, res) => res.json({ stats: await getStats(), donations: await listDonations() }));
app.get('/api/admin-donations', checkAdmin, async (req, res) => res.json({ stats: await getStats(), donations: await listDonations() }));
app.post('/api/admin/goal', checkAdmin, async (req, res) => {
  const { goal, baseRaised } = req.body || {};
  res.json(await setGoal(goal, baseRaised));
});
app.post('/api/admin-goal', checkAdmin, async (req, res) => {
  const { goal, baseRaised } = req.body || {};
  res.json(await setGoal(goal, baseRaised));
});
app.get('/api/traffic', checkAdmin, async (req, res) => {
  res.json(await trafficStats(Math.min(365, Math.max(1, Number(req.query.days) || 30))));
});
// ⚙️ Pixel & integrações (token nunca volta pro navegador)
app.get('/api/admin/settings', checkAdmin, async (req, res) => {
  const pub = await getMetaPublic();
  const sec = await getMetaSecrets();
  res.json({ metaPixelId: pub.metaPixelId, hasCapiToken: !!sec.token });
});
app.post('/api/admin/settings', checkAdmin, async (req, res) => {
  res.json(await saveMetaSettings({ pixelId: req.body?.pixelId, token: req.body?.token }));
});
// 💸 Verba de anúncios
app.get('/api/admin/spend', checkAdmin, async (req, res) => res.json({ spend: await listSpend() }));
app.post('/api/admin/spend', checkAdmin, async (req, res) => {
  res.json(await addSpend({ date: req.body?.date, campaign: req.body?.campaign, amount: req.body?.amount }));
});
app.delete('/api/admin/spend', checkAdmin, async (req, res) => {
  await deleteSpend(req.query.id);
  res.json({ ok: true });
});

app.post('/webhooks/sharpify', async (req, res) => {
  const evt = req.body;
  const id = evt?.event?.contextId;
  const name = evt?.event?.name;
  if (id && name === 'PAYMENT_LINK_APPROVED') await updateStatus(id, 'APPROVED');
  if (id && name === 'PAYMENT_LINK_CANCELLED') await updateStatus(id, 'CANCELLED');
  res.sendStatus(200);
});

app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, async () => {
  console.log(`\n✝ Luz de Jesus: http://localhost:${PORT}`);
  console.log(`📊 Admin: http://localhost:${PORT}/admin (senha: ${ADMIN_PASSWORD})`);
  console.log(`💛 Stats:`, await getStats());
});
