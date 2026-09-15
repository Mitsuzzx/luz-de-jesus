// Store compartilhado: funciona no Express local e nas functions da Vercel.
// Persistência: db.json local, /tmp/db.json na Vercel + memória.
import fs from 'fs';
import path from 'path';

const isVercel = !!process.env.VERCEL;
const DB_PATH = isVercel ? '/tmp/db.json' : path.join(process.cwd(), 'db.json');

function defaults() {
  return {
    goal: Number(process.env.GOAL || 65000),
    baseRaised: Number(process.env.BASE_RAISED || 0),
    baseDonors: Number(process.env.BASE_DONORS || 0),
    donations: [] // {id, amount, causa, nome, email, status, code, paymentLink, createdAt}
  };
}

function load() {
  if (globalThis.__LJ_DB) return globalThis.__LJ_DB;
  try {
    if (fs.existsSync(DB_PATH)) {
      const j = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
      globalThis.__LJ_DB = { ...defaults(), ...j };
      return globalThis.__LJ_DB;
    }
  } catch {}
  globalThis.__LJ_DB = defaults();
  return globalThis.__LJ_DB;
}

function save() {
  try { fs.writeFileSync(DB_PATH, JSON.stringify(globalThis.__LJ_DB)); } catch {}
}

export function getStats() {
  const db = load();
  const approved = db.donations.filter(d => d.status === 'APPROVED').reduce((s, d) => s + d.amount, 0);
  const pending = db.donations.filter(d => d.status !== 'APPROVED').reduce((s, d) => s + d.amount, 0);
  const raised = db.baseRaised + approved;
  const donors = db.baseDonors + db.donations.filter(d => d.status === 'APPROVED').length;
  const pct = db.goal > 0 ? Math.min(100, Math.round((raised / db.goal) * 100)) : 0;
  const day = new Date(); day.setHours(0, 0, 0, 0);
  const today = db.donations.filter(d => d.status !== 'CANCELLED' && new Date(d.createdAt) >= day).length;
  return { raised, goal: db.goal, pct, donors, approved, pending, totalDonations: db.donations.length, today };
}

export function maskName(name) {
  const parts = String(name || 'Anônimo').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'Anônimo';
  if (parts.length === 1) return parts[0].slice(0, 14);
  return `${parts[0].slice(0, 14)} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

// Feed público: sem e-mail, sem código, nome mascarado
export function recentList(limit = 8) {
  return load().donations
    .filter(d => d.status !== 'CANCELLED')
    .slice(0, limit)
    .map(d => ({ nome: maskName(d.nome), amount: d.amount, causa: d.causa, createdAt: d.createdAt, status: d.status }));
}

export function addDonation(d) {
  const db = load();
  db.donations.unshift({ ...d, createdAt: new Date().toISOString() });
  db.donations = db.donations.slice(0, 500);
  save();
  return d;
}

export function updateStatus(id, status) {
  const db = load();
  const f = db.donations.find(d => d.id === id);
  if (f) { f.status = status; save(); }
  return f;
}

export function listDonations() {
  return load().donations;
}

export function setGoal(goal, baseRaised) {
  const db = load();
  if (goal) db.goal = Number(goal);
  if (baseRaised !== undefined && baseRaised !== '') db.baseRaised = Number(baseRaised);
  save();
  return getStats();
}

export function getDonation(id) {
  return load().donations.find(d => d.id === id) || null;
}

export function trackVisit(e = {}) {
  const db = load();
  db.visits = db.visits || [];
  db.visits.unshift({
    visitorId: String(e.visitorId || 'anon').slice(0, 64),
    path: String(e.path || '/').slice(0, 200),
    utm_source: e.utm_source || null, utm_medium: e.utm_medium || null,
    utm_campaign: e.utm_campaign || null, utm_content: e.utm_content || null,
    utm_term: e.utm_term || null,
    referrer: String(e.referrer || '').slice(0, 300),
    userAgent: String(e.userAgent || '').slice(0, 300),
    createdAt: new Date().toISOString()
  });
  db.visits = db.visits.slice(0, 2000);
  save();
}

// Estatísticas estilo UTMify: visitas x doações x receita x VERBA por campanha/origem
export function trafficStats(days = 30) {
  const db = load();
  const cutoff = new Date(Date.now() - days * 864e5);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const visits = (db.visits || []).filter(v => new Date(v.createdAt) >= cutoff);
  const uniques = new Set(visits.map(v => v.visitorId)).size;
  const dons = db.donations.filter(d => d.status === 'APPROVED' && new Date(d.createdAt) >= cutoff);
  const revenue = dons.reduce((s, d) => s + Number(d.amount), 0);
  const spendRows = (db.spend || []).filter(s => (s.date || '') >= cutoffStr);
  const spendTotal = spendRows.reduce((s, r) => s + Number(r.amount), 0);
  const spendBy = {};
  spendRows.forEach(r => { const k = (r.campaign || '(geral)').trim().toLowerCase(); spendBy[k] = (spendBy[k] || 0) + Number(r.amount); });
  const metrics = (donations, rev, spend) => ({
    revenue: Math.round(rev * 100) / 100,
    spend: Math.round(spend * 100) / 100,
    ticket: donations ? Math.round(rev / donations * 100) / 100 : 0,
    roas: spend > 0 ? Math.round(rev / spend * 100) / 100 : null,
    roi: spend > 0 ? Math.round((rev - spend) / spend * 1000) / 10 : null
  });
  const group = (keyFn) => {
    const m = {};
    visits.forEach(v => { const k = keyFn(v) || '(direto)'; m[k] = m[k] || { name: k, visits: 0, donations: 0, revenue: 0 }; m[k].visits++; });
    dons.forEach(d => { const k = keyFn(d) || '(direto)'; m[k] = m[k] || { name: k, visits: 0, donations: 0, revenue: 0 }; m[k].donations++; m[k].revenue += Number(d.amount); });
    return Object.values(m)
      .map(r => ({ name: r.name, visits: r.visits, donations: r.donations, conv: r.visits ? Math.round(r.donations / r.visits * 1000) / 10 : 0, ...metrics(r.donations, r.revenue, spendBy[r.name.trim().toLowerCase()] || 0) }))
      .sort((a, b) => b.revenue - a.revenue || b.visits - a.visits);
  };
  const g = metrics(dons.length, revenue, spendTotal);
  return {
    days, visits: visits.length, uniques, donations: dons.length,
    conversion: uniques ? Math.round(dons.length / uniques * 1000) / 10 : 0,
    ...g,
    byCampaign: group(x => x.utm_campaign),
    bySource: group(x => x.utm_source)
  };
}

export function getSetting(key, fallback = null) {
  const db = load();
  db.kv = db.kv || {};
  return db.kv[key] !== undefined ? db.kv[key] : fallback;
}
export function setSetting(key, value) {
  const db = load();
  db.kv = db.kv || {};
  db.kv[key] = value;
  save();
  return value;
}

// 💸 Verba de anúncios (tráfego pago)
export function addSpend({ date, campaign, amount }) {
  const db = load();
  db.spend = db.spend || [];
  const row = {
    id: 'sp' + Date.now().toString(36),
    date: date || new Date().toISOString().slice(0, 10),
    campaign: String(campaign || '(geral)').slice(0, 120),
    amount: Number(amount) || 0
  };
  db.spend.unshift(row);
  db.spend = db.spend.slice(0, 500);
  save();
  return row;
}
export function listSpend() { return load().spend || []; }
export function deleteSpend(id) {
  const db = load();
  db.spend = (db.spend || []).filter(s => s.id !== id);
  save();
}

export const MIN_DONATION = 2;
