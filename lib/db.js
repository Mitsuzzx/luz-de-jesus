// Camada de dados: usa Supabase quando configurado, senão cai pro store local.
// Frontend nunca fala com o Supabase direto — só via /api (a chave service fica no servidor).
// IMPORTANTE: client() é lazy — lê as envs SÓ na primeira chamada,
// porque imports ESM carregam antes do dotenv.config() rodar.
import { createClient } from '@supabase/supabase-js';
import * as local from './store.js';

let sb = null, inited = false, useSb = false;
function client() {
  if (!inited) {
    inited = true;
    const URL = process.env.SUPABASE_URL || '';
    const KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '';
    if (URL && KEY) {
      sb = createClient(URL, KEY);
      useSb = true;
      console.log('💛 Banco: Supabase conectado');
    } else {
      console.log('💛 Banco: modo local (defina SUPABASE_URL + SUPABASE_SERVICE_KEY p/ usar Supabase)');
    }
  }
  return useSb ? sb : null;
}
export function usingSupabase() { return !!client(); }

async function getSettings() {
  const c = client();
  if (!c) {
    const s = local.getStats();
    return { goal: s.goal, baseRaised: 0, baseDonors: 0 };
  }
  const { data } = await c.from('settings').select('key,value');
  const map = {};
  (data || []).forEach(r => { map[r.key] = r.value; });
  return {
    goal: Number(map.goal ?? process.env.GOAL ?? 65000),
    baseRaised: Number(map.base_raised ?? process.env.BASE_RAISED ?? 0),
    baseDonors: Number(map.base_donors ?? process.env.BASE_DONORS ?? 0)
  };
}

export async function getStats() {
  const c = client();
  if (!c) return local.getStats();
  const cfg = await getSettings();
  const { data } = await c.from('donations').select('amount,status,created_at');
  const rows = data || [];
  const approved = rows.filter(d => d.status === 'APPROVED').reduce((s, d) => s + Number(d.amount), 0);
  const pending = rows.filter(d => d.status !== 'APPROVED').reduce((s, d) => s + Number(d.amount), 0);
  const approvedCount = rows.filter(d => d.status === 'APPROVED').length;
  const raised = cfg.baseRaised + approved;
  const pct = cfg.goal > 0 ? Math.min(100, Math.round((raised / cfg.goal) * 100)) : 0;
  const day = new Date(); day.setHours(0, 0, 0, 0);
  const today = rows.filter(d => d.status !== 'CANCELLED' && new Date(d.created_at) >= day).length;
  return { raised, goal: cfg.goal, pct, donors: cfg.baseDonors + approvedCount, approved, pending, totalDonations: rows.length, today };
}

export async function addDonation(d) {
  const c = client();
  if (!c) return local.addDonation(d);
  await c.from('donations').insert({
    id: d.id, amount: d.amount, causa: d.causa,
    nome: d.nome || 'Anônimo', email: d.email || '',
    status: d.status || 'PENDING', code: d.code || null,
    payment_link: d.paymentLink || null
  });
  return d;
}

export async function updateStatus(id, status) {
  const c = client();
  if (!c) return local.updateStatus(id, status);
  await c.from('donations').update({ status }).eq('id', id);
}

export async function listDonations(limit = 200) {
  const c = client();
  if (!c) return local.listDonations();
  const { data } = await c.from('donations').select('*').order('created_at', { ascending: false }).limit(limit);
  return (data || []).map(r => ({
    id: r.id, amount: Number(r.amount), causa: r.causa, nome: r.nome,
    email: r.email, status: r.status, code: r.code,
    paymentLink: r.payment_link, createdAt: r.created_at,
    visitorId: r.visitor_id || null, utm_source: r.utm_source || null,
    utm_medium: r.utm_medium || null, utm_campaign: r.utm_campaign || null,
    eventId: r.event_id || null, fbp: r.fbp || null, fbc: r.fbc || null
  }));
}

export async function setGoal(goal, baseRaised) {
  const c = client();
  if (!c) return local.setGoal(goal, baseRaised);
  if (goal) await c.from('settings').upsert({ key: 'goal', value: Number(goal) });
  if (baseRaised !== undefined && baseRaised !== '') await c.from('settings').upsert({ key: 'base_raised', value: Number(baseRaised) });
  return getStats();
}

export async function recentList(limit = 8) {
  const c = client();
  if (!c) return local.recentList(limit);
  const { data } = await c.from('donations').select('nome,amount,causa,created_at,status').neq('status', 'CANCELLED').order('created_at', { ascending: false }).limit(limit);
  return (data || []).map(r => ({ nome: local.maskName(r.nome), amount: Number(r.amount), causa: r.causa, createdAt: r.created_at, status: r.status }));
}

export async function getDonation(id) {
  const c = client();
  if (!c) return local.getDonation(id);
  const { data } = await c.from('donations').select('*').eq('id', id).single();
  if (!data) return null;
  return {
    id: data.id, amount: Number(data.amount), causa: data.causa, nome: data.nome,
    email: data.email, status: data.status, eventId: data.event_id || null,
    fbp: data.fbp || null, fbc: data.fbc || null, createdAt: data.created_at
  };
}

export async function trackVisit(e = {}) {
  const c = client();
  if (!c) return local.trackVisit(e);
  await c.from('visits').insert({
    visitor_id: String(e.visitorId || 'anon').slice(0, 64),
    path: String(e.path || '/').slice(0, 200),
    utm_source: e.utm_source || null, utm_medium: e.utm_medium || null,
    utm_campaign: e.utm_campaign || null, utm_content: e.utm_content || null,
    utm_term: e.utm_term || null,
    referrer: String(e.referrer || '').slice(0, 300),
    user_agent: String(e.userAgent || '').slice(0, 300)
  });
}

export async function trafficStats(days = 30) {
  const c = client();
  if (!c) return local.trafficStats(days);
  const since = new Date(Date.now() - days * 864e5).toISOString();
  const sinceDay = since.slice(0, 10);
  const [{ data: visits }, { data: dons }, { data: spendRows }] = await Promise.all([
    c.from('visits').select('visitor_id,utm_source,utm_campaign,created_at').gte('created_at', since).limit(5000),
    c.from('donations').select('amount,utm_source,utm_campaign,created_at').eq('status', 'APPROVED').gte('created_at', since).limit(2000),
    c.from('ad_spend').select('campaign,amount,date').gte('date', sinceDay).limit(1000)
  ]);
  const V = visits || [], D = (dons || []).map(d => ({ ...d, amount: Number(d.amount) }));
  const uniques = new Set(V.map(v => v.visitor_id)).size;
  const revenue = D.reduce((s, d) => s + d.amount, 0);
  const spendBy = {};
  (spendRows || []).forEach(r => { const k = (r.campaign || '(geral)').trim().toLowerCase(); spendBy[k] = (spendBy[k] || 0) + Number(r.amount); });
  const spendTotal = Object.values(spendBy).reduce((s, v) => s + v, 0);
  const metrics = (donations, rev, spend) => ({
    revenue: Math.round(rev * 100) / 100,
    spend: Math.round(spend * 100) / 100,
    ticket: donations ? Math.round(rev / donations * 100) / 100 : 0,
    roas: spend > 0 ? Math.round(rev / spend * 100) / 100 : null,
    roi: spend > 0 ? Math.round((rev - spend) / spend * 1000) / 10 : null
  });
  const group = (keyFn) => {
    const m = {};
    V.forEach(v => { const k = keyFn(v) || '(direto)'; m[k] = m[k] || { name: k, visits: 0, donations: 0, revenue: 0 }; m[k].visits++; });
    D.forEach(d => { const k = keyFn(d) || '(direto)'; m[k] = m[k] || { name: k, visits: 0, donations: 0, revenue: 0 }; m[k].donations++; m[k].revenue += d.amount; });
    return Object.values(m)
      .map(r => ({ name: r.name, visits: r.visits, donations: r.donations, conv: r.visits ? Math.round(r.donations / r.visits * 1000) / 10 : 0, ...metrics(r.donations, r.revenue, spendBy[r.name.trim().toLowerCase()] || 0) }))
      .sort((a, b) => b.revenue - a.revenue || b.visits - a.visits);
  };
  const g = metrics(D.length, revenue, spendTotal);
  return {
    days, visits: V.length, uniques, donations: D.length,
    conversion: uniques ? Math.round(D.length / uniques * 1000) / 10 : 0,
    ...g,
    byCampaign: group(x => x.utm_campaign),
    bySource: group(x => x.utm_source)
  };
}

// ⚙️ Configurações (Pixel etc.) — Supabase `settings`, fallback .env/local
export async function getMetaPublic() {
  const c = client();
  let pixel = process.env.META_PIXEL_ID || '';
  if (c) {
    const { data } = await c.from('settings').select('value').eq('key', 'meta_pixel_id').single();
    if (data?.value) pixel = String(data.value);
  } else {
    pixel = local.getSetting('meta_pixel_id', pixel) || '';
  }
  return { metaPixelId: pixel };
}
export async function getMetaSecrets() {
  const c = client();
  let pixel = process.env.META_PIXEL_ID || '', token = process.env.META_CAPI_TOKEN || '';
  if (c) {
    const { data } = await c.from('settings').select('key,value').in('key', ['meta_pixel_id', 'meta_capi_token']);
    (data || []).forEach(r => {
      if (r.key === 'meta_pixel_id' && r.value) pixel = String(r.value);
      if (r.key === 'meta_capi_token' && r.value) token = String(r.value);
    });
  } else {
    pixel = local.getSetting('meta_pixel_id', pixel) || '';
    token = local.getSetting('meta_capi_token', token) || '';
  }
  return { pixelId: pixel, token };
}
export async function saveMetaSettings({ pixelId, token }) {
  const c = client();
  if (pixelId !== undefined && pixelId !== '') {
    if (c) await c.from('settings').upsert({ key: 'meta_pixel_id', value: String(pixelId).trim() });
    else local.setSetting('meta_pixel_id', String(pixelId).trim());
  }
  if (token !== undefined && token !== '') {
    if (c) await c.from('settings').upsert({ key: 'meta_capi_token', value: String(token).trim() });
    else local.setSetting('meta_capi_token', String(token).trim());
  }
  const pub = await getMetaPublic();
  return { ...pub, hasCapiToken: !!(await getMetaSecrets()).token };
}

// 💸 Verba de anúncios
export async function addSpend({ date, campaign, amount }) {
  const c = client();
  if (!c) return local.addSpend({ date, campaign, amount });
  const row = { id: 'sp' + Date.now().toString(36), date: date || new Date().toISOString().slice(0, 10), campaign: String(campaign || '(geral)').slice(0, 120), amount: Number(amount) || 0 };
  await c.from('ad_spend').insert(row);
  return row;
}
export async function listSpend() {
  const c = client();
  if (!c) return local.listSpend();
  const { data } = await c.from('ad_spend').select('*').order('date', { ascending: false }).limit(300);
  return data || [];
}
export async function deleteSpend(id) {
  const c = client();
  if (!c) return local.deleteSpend(id);
  await c.from('ad_spend').delete().eq('id', id);
}

export const MIN_DONATION = 2;
