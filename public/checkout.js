// Checkout dedicado Luz de Jesus — /doacao/:valor?style clean
const MIN = 2.00;
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const fmt = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// valor da rota /doacao/30 (aceita 30, 30.5 ou 30,50)
let valor = (() => {
  const seg = (location.pathname.split('/').filter(Boolean).pop() || '').replace(',', '.');
  const v = parseFloat(seg);
  return !isNaN(v) && v > 0 ? Math.round(v * 100) / 100 : 20;
})();
let causa = new URLSearchParams(location.search).get('causa') || 'ambos';
if (!['necessitados', 'animais', 'ambos'].includes(causa)) causa = 'ambos';

/* tracking (mesmo padrão do site) */
window._vid = (() => { try { let v = localStorage.getItem('lj_vid'); if (!v) { v = 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 9); localStorage.setItem('lj_vid', v); } return v; } catch { return 'v' + Date.now(); } })();
window._utm = (() => { try { return JSON.parse(sessionStorage.getItem('lj_utm') || '{}'); } catch { return {}; } })();
function getCookie(n) { const m = document.cookie.match(new RegExp('(^| )' + n + '=([^;]+)')); return m ? decodeURIComponent(m[2]) : ''; }
try {
  const p = JSON.stringify({ visitorId: window._vid, path: location.pathname, referrer: document.referrer || '', ...window._utm });
  if (navigator.sendBeacon) navigator.sendBeacon('/api/track', new Blob([p], { type: 'application/json' }));
  else fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: p, keepalive: true }).catch(() => {});
} catch {}
fetch('/api/config').then(r => r.json()).then(c => {
  if (!c.metaPixelId) return;
  !(function (f, b, e, v, n, t, s) {
    if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
    if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
    t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
  })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
  fbq('init', c.metaPixelId);
  fbq('track', 'PageView');
}).catch(() => {});

function causaInfo(c) {
  return c === 'animais'
    ? { emoji: '🐾', title: 'Doação — Patas Protegidas' }
    : c === 'necessitados'
      ? { emoji: '🍞', title: 'Doação — Prato Cheio' }
      : { emoji: '💛', title: 'Doação — Ambas as causas' };
}
function impactoTxt(v, c) {
  if (c === 'animais') {
    if (v < 5) return `${Math.max(1, Math.floor(v / 2))} potes de ração`;
    if (v < 15) return `${Math.floor(v / 5)} dias de ração`;
    if (v < 60) return `vacina + ração p/ ${Math.floor(v / 15)} animais`;
    return `castração p/ ${Math.floor(v / 60)} animais! 🐾`;
  }
  if (c === 'ambos') return `${Math.floor(v / 2)} marmitas + ração`;
  if (v < 10) return `${Math.max(1, Math.floor(v / 2))} marmitas quentinhas`;
  if (v < 50) return `${Math.floor(v / 10)} cestas básicas`;
  return `${Math.floor(v / 50)} família(s) por 1 semana! 🍞`;
}
function paint() {
  const info = causaInfo(causa);
  $('#pEmoji').textContent = info.emoji;
  $('#pTitle').textContent = info.title;
  $('#pValor').textContent = fmt(valor);
  $('#pImpact').textContent = `💛 Com ${fmt(valor)} você garante ${impactoTxt(valor, causa)}!`;
  $('#btnGen').textContent = `⚡ GERAR PIX DE ${fmt(valor)}`;
  $$('#pCausas button').forEach(x => x.classList.toggle('on', x.dataset.c === causa));
  $$('#pVals button').forEach(x => x.classList.toggle('on', parseFloat(x.dataset.v) === valor));
  $('#fErr').classList.toggle('hidden', valor >= MIN);
}
$$('#pCausas button').forEach(b => b.onclick = () => { causa = b.dataset.c; paint(); });
$$('#pVals button').forEach(b => b.onclick = () => { valor = parseFloat(b.dataset.v); paint(); });

let timerIv = null, pollIv = null;
function startTimer() {
  let s = 15 * 60;
  clearInterval(timerIv);
  const tick = () => {
    const m = String(Math.floor(s / 60)).padStart(2, '0'), ss = String(s % 60).padStart(2, '0');
    $('#cTimer').textContent = s > 0 ? `⏳ Expira em ${m}:${ss}` : '⚠️ QR expirado — gere outro';
    if (s <= 0) clearInterval(timerIv);
    s--;
  };
  tick(); timerIv = setInterval(tick, 1000);
}
function toast(m) { $('#cStatus').textContent = m; }

$('#btnGen').onclick = async () => {
  if (valor < MIN) { $('#fErr').classList.remove('hidden'); return; }
  const nome = $('#fNome').value.trim(), email = $('#fEmail').value.trim();
  $('#step1').classList.add('hidden'); $('#step2').classList.remove('hidden');
  $('#st1').classList.remove('on'); $('#st2').classList.add('on');
  $('#cResumo').textContent = `${fmt(valor)} • ${causa === 'animais' ? 'Animais 🐾' : causa === 'necessitados' ? 'Pessoas 🍞' : 'Ambas 💛'}${nome ? ' • ' + nome : ''}`;
  $('#cSpin').style.display = 'block'; $('#cQr').classList.add('hidden');
  $('#cCode').textContent = 'gerando...'; $('#cLink').classList.add('hidden');
  toast('Gerando seu PIX...');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (typeof fbq === 'function') { try { fbq('track', 'InitiateCheckout', { value: valor, currency: 'BRL' }); } catch {} }
  try {
    const r = await fetch('/api/doar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: valor, causa, nome: nome || 'Anônimo', email, visitorId: window._vid, fbp: getCookie('_fbp'), fbc: getCookie('_fbc'), ...window._utm }) });
    if (!r.ok) throw 0;
    const d = await r.json();
    window._eid = d.eventId || null;
    $('#cSpin').style.display = 'none';
    const img = $('#cQr'); img.src = d.qrCode || ''; img.classList.remove('hidden');
    $('#cCode').textContent = d.code || '—';
    if (d.paymentLink) { const l = $('#cLink'); l.href = d.paymentLink; l.classList.remove('hidden'); }
    toast(d.demo ? '🧪 Demonstração — PIX real com backend conectado.' : '✅ Abra o app do banco e pague 📱');
    startTimer();
    if (d.id && !d.demo) poll(d.id);
  } catch {
    toast('😕 Falha ao gerar. Tente de novo.');
    $('#cSpin').style.display = 'none';
  }
};
async function statusOf(id) {
  try { const r = await fetch(`/api/status?id=${encodeURIComponent(id)}`); if (r.ok) { const j = await r.json(); if (j.status) return j.status; } } catch {}
  try { const r2 = await fetch(`/api/status/${encodeURIComponent(id)}`); if (r2.ok) return (await r2.json()).status; } catch {}
  return 'PENDING';
}
function poll(id) {
  let n = 0;
  pollIv = setInterval(async () => {
    if (++n > 60) { clearInterval(pollIv); return; }
    if ((await statusOf(id)) === 'APPROVED') {
      clearInterval(pollIv); clearInterval(timerIv);
      if (typeof fbq === 'function') { try { fbq('track', 'Purchase', { value: valor, currency: 'BRL' }, { eventID: window._eid || undefined }); } catch {} }
      $('#step2').classList.add('hidden'); $('#stepOk').classList.remove('hidden');
      const su = location.origin + '/#doar';
      $('#cShare').href = `https://wa.me/?text=${encodeURIComponent('Acabei de doar 🙏 Junte-se a mim! ')}${encodeURIComponent(su)}`;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, 5000);
}
$('#cCopy').onclick = async () => {
  try { await navigator.clipboard.writeText($('#cCode').textContent); toast('📋 Código copiado! Cola no app do banco 💛'); }
  catch { toast('Selecione o código e copie manualmente'); }
};
$('#cBack').onclick = () => {
  clearInterval(pollIv); clearInterval(timerIv);
  $('#step2').classList.add('hidden'); $('#step1').classList.remove('hidden');
  $('#st2').classList.remove('on'); $('#st1').classList.add('on');
};

paint();
