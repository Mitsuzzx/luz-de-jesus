// Luz de Jesus — doação + animações + checkout grande + stats
const MIN = 2.00;
let causa = 'necessitados';
let valor = 20;
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const fmt = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/* ---------- TRACKING (visitas + UTMs + Meta Pixel) ---------- */
window._vid = (() => { try { let v = localStorage.getItem('lj_vid'); if (!v) { v = 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 9); localStorage.setItem('lj_vid', v); } return v; } catch { return 'v' + Date.now(); } })();
window._utm = (() => {
  try {
    const q = new URLSearchParams(location.search);
    const u = {};
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(k => { const v = q.get(k); if (v) u[k] = v.slice(0, 120); });
    if (Object.keys(u).length) sessionStorage.setItem('lj_utm', JSON.stringify(u));
    return Object.keys(u).length ? u : JSON.parse(sessionStorage.getItem('lj_utm') || '{}');
  } catch { return {}; }
})();
function getCookie(n) { const m = document.cookie.match(new RegExp('(^| )' + n + '=([^;]+)')); return m ? decodeURIComponent(m[2]) : ''; }
try {
  const payload = JSON.stringify({ visitorId: window._vid, path: location.pathname, referrer: document.referrer || '', ...window._utm });
  if (navigator.sendBeacon) navigator.sendBeacon('/api/track', new Blob([payload], { type: 'application/json' }));
  else fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true }).catch(() => {});
} catch {}
// Meta Pixel (ID vem do backend em /api/config; sem ID configurado, nada carrega)
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

$('#menuBtn').onclick = () => $('#mmenu').classList.toggle('open');
$$('#mmenu a').forEach(a => a.onclick = () => $('#mmenu').classList.remove('open'));

/* ---------- ANIMAÇÕES ---------- */
const io = new IntersectionObserver(es => {
  es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('vis'); io.unobserve(e.target); } });
}, { threshold: .12 });
$$('.rv').forEach(el => io.observe(el));

/* ---------- META / STATS (corrige 0%) ---------- */
async function loadStats() {
  // valor padrão imediato (começa zerado)
  paintStats({ raised: 0, goal: 65000, pct: 0, donors: 0, totalDonations: 0, today: 0 });
  try {
    const r = await fetch('/api/stats');
    if (!r.ok) throw 0;
    paintStats(await r.json());
  } catch { /* mantém padrão */ }
}
function paintStats(s) {
  const bar = $('#heroBar');
  if (bar) {
    bar.style.width = '0%';
    requestAnimationFrame(() => setTimeout(() => bar.style.width = s.pct + '%', 250));
  }
  if ($('#goalRaised')) $('#goalRaised').textContent = fmt(s.raised);
  if ($('#goalTotal')) $('#goalTotal').textContent = fmt(s.goal);
  if ($('#goalPct')) $('#goalPct').textContent = s.raised > 0
    ? `${s.pct}% alcançado 💛 • faltam ${fmt(Math.max(0, s.goal - s.raised))}`
    : '0% — seja a primeira pessoa a doar 💛';
  if ($('#pillTxt')) $('#pillTxt').textContent = s.raised > 0
    ? `${fmt(s.raised)} ARRECADADOS • META ${s.pct}% • PIX INSTANTÂNEO`
    : 'COMECE A MISSÃO • SEJA A PRIMEIRA DOAÇÃO 💛';
  if ($('#trustDonors')) $('#trustDonors').textContent = s.donors > 0
    ? `${s.donors.toLocaleString('pt-BR')} doadores já ajudaram • 4.9★`
    : 'Nenhum doador ainda — seja o primeiro! 💛';
  if ($('#todayLine')) $('#todayLine').textContent = s.today > 0 ? `• ${s.today} hoje 🔴` : '';
  // 🎉 avisa em tempo real quando chega doação nova
  if (window._lastTotal !== undefined && (s.totalDonations || 0) > window._lastTotal) {
    toast('🎉 Nova doação recebida! Deus abençoe 🙏');
    hearts(16);
  }
  window._lastTotal = s.totalDonations || 0;
}
window.addEventListener('load', () => { loadStats(); loadFeed(); animateCounts(); });
setInterval(loadStats, 15000); // tempo real: meta atualiza sozinha
setInterval(loadFeed, 20000);  // feed ao vivo

let counted = false;
function animateCounts() {
  if (counted) return; counted = true;
  $$('.count').forEach(el => {
    const target = parseFloat(el.dataset.n) || 0;
    const t0 = performance.now(), dur = 1400;
    (function tick(t) {
      const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * e);
      if (p < 1) requestAnimationFrame(tick);
    })(t0);
  });
}
const io2 = new IntersectionObserver(es => {
  es.forEach(e => { if (e.isIntersecting) { animateCounts(); io2.disconnect(); } });
}, { threshold: .3 });
if (document.querySelector('.t3')) io2.observe(document.querySelector('.t3'));

/* ---------- SELEÇÃO ---------- */
$$('.tabs button').forEach(t => {
  t.onclick = () => {
    $$('.tabs button').forEach(x => x.classList.remove('on'));
    t.classList.add('on'); causa = t.dataset.t; update();
  };
});
$$('.pick').forEach(b => {
  b.onclick = () => {
    causa = b.dataset.c;
    $$('.tabs button').forEach(x => x.classList.toggle('on', x.dataset.t === causa));
    document.querySelector('#doar').scrollIntoView({ behavior: 'smooth' }); update();
  };
});
$$('.vals button').forEach(b => {
  b.onclick = () => {
    $$('.vals button').forEach(x => x.classList.remove('on'));
    b.classList.add('on'); valor = parseFloat(b.dataset.v);
    $('#valor').value = valor; update();
  };
});
$('#valor').addEventListener('input', e => {
  valor = parseFloat(e.target.value) || 0;
  $$('.vals button').forEach(x => x.classList.toggle('on', parseFloat(x.dataset.v) === valor));
  update();
});

function causaNome(c) { return c === 'animais' ? '🐾 Animais' : c === 'necessitados' ? '🍞 Pessoas' : '💛 Ambos'; }
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
function update() {
  const ok = valor >= MIN;
  $('#err').hidden = ok || !valor;
  $('#btnDoar').textContent = `Doar ${fmt(valor || 0)} agora 💛`;
  const imp = $('#impact');
  imp.innerHTML = `💛 Com <b>${fmt(valor || 0)}</b> → <b>${impactoTxt(valor || 0, causa)}</b>`;
  imp.style.animation = 'none'; void imp.offsetWidth; imp.style.animation = '';
}
function toast(m) { const t = $('#toast'); t.textContent = m; t.hidden = false; setTimeout(() => t.hidden = true, 2800); }

/* ---------- CHECKOUT GRANDE ---------- */
const co = $('#checkout');
function openCheckout() {
  valor = parseFloat($('#valor').value) || 0;
  if (valor < MIN) { $('#err').hidden = false; toast('Ops! Mínimo R$ 2,00 💛'); return; }
  $('#coStep1').hidden = false; $('#coStep2').hidden = true;
  $('#coNome').value = $('#nome')?.value || '';
  $('#coEmail').value = $('#email')?.value || '';
  paintCo();
  co.hidden = false;
  document.body.style.overflow = 'hidden';
}
function paintCo() {
  $('#coAmountBig').textContent = fmt(valor);
  $('#coCauseLine').textContent = causaNome(causa);
  $('#coTitle').textContent = causa === 'animais' ? 'Sua doação 🐾' : causa === 'necessitados' ? 'Sua doação 🍞' : 'Sua doação 💛';
  $('#coImpact').textContent = `💛 Com ${fmt(valor)} você garante ${impactoTxt(valor, causa)}!`;
}
function closeCheckout() { co.hidden = true; document.body.style.overflow = ''; if (window._poll) clearInterval(window._poll); }

$('#form').addEventListener('submit', e => {
  e.preventDefault(); openCheckout();
  if (typeof fbq === 'function') { try { fbq('track', 'InitiateCheckout', { value: parseFloat($('#valor').value) || 0, currency: 'BRL' }); } catch {} }
});
$('#coX').onclick = closeCheckout;
co.addEventListener('click', e => { if (e.target === co) closeCheckout(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !co.hidden) closeCheckout(); });
$('#coEdit').onclick = () => { closeCheckout(); document.querySelector('#doar').scrollIntoView({ behavior: 'smooth' }); };
$('#coBack').onclick = () => { $('#coStep2').hidden = true; $('#coStep1').hidden = false; if (window._poll) clearInterval(window._poll); };

$('#coGen').onclick = async () => {
  valor = parseFloat($('#valor').value) || 0;
  const nome = $('#coNome').value.trim(), email = $('#coEmail').value.trim();
  if ($('#nome')) $('#nome').value = nome;
  if ($('#email')) $('#email').value = email;
  $('#coStep1').hidden = true; $('#coStep2').hidden = false;
  $('#coResumo').textContent = `${fmt(valor)} • ${causaNome(causa)}${nome ? ' • ' + nome : ''}`;
  $('#coSpin').style.display = 'block'; $('#coQr').style.display = 'none';
  $('#coCode').textContent = 'gerando...'; $('#coLink').hidden = true; $('#coOk').hidden = true;
  $('#coStatus').textContent = '⏳ Gerando seu PIX...';
  try {
    const r = await fetch('/api/doar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: valor, causa, nome: nome || 'Anônimo', email, visitorId: window._vid, fbp: getCookie('_fbp'), fbc: getCookie('_fbc'), ...window._utm }) });
    if (!r.ok) throw 0;
    const d = await r.json();
    window._eid = d.eventId || null;
    showPay(d);
    if (d.id && !d.demo) poll(d.id);
    loadStats();
  } catch {
    const demo = `PIX LuzDeJesus ${causa} ${valor.toFixed(2)}`;
    showPay({ qrCode: `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(demo)}`, code: demo, demo: true });
    $('#coStatus').textContent = '🧪 Demonstração — conecte o backend p/ PIX real.';
  }
};
function showPay(d) {
  $('#coSpin').style.display = 'none';
  const img = $('#coQr'); img.src = d.qrCode || ''; img.style.display = 'block';
  $('#coCode').textContent = d.code || '—';
  if (d.paymentLink) { const l = $('#coLink'); l.href = d.paymentLink; l.hidden = false; }
  if (!d.demo) $('#coStatus').textContent = '⏳ Aguardando pagamento... pague no app do banco 📱';
}
async function statusOf(id) {
  try {
    let r = await fetch(`/api/status?id=${encodeURIComponent(id)}`);
    if (r.ok) { const j = await r.json(); if (j.status) return j.status; }
  } catch {}
  try {
    const r2 = await fetch(`/api/status/${encodeURIComponent(id)}`);
    if (r2.ok) return (await r2.json()).status;
  } catch {}
  return 'PENDING';
}
function poll(id) {
  let n = 0;
  window._poll = setInterval(async () => {
    if (++n > 60) { clearInterval(window._poll); return; }
    const st = await statusOf(id);
    if (st === 'APPROVED') {
      clearInterval(window._poll);
      $('#coStatus').textContent = '✅ Recebido!';
      $('#coOk').hidden = false;
      toast('✅ Doação recebida! Deus te abençoe 🙏');
      hearts(26);
      if (typeof fbq === 'function') { try { fbq('track', 'Purchase', { value: valor, currency: 'BRL' }, { eventID: window._eid || undefined }); } catch {} }
      loadStats();
    }
  }, 5000);
}
$('#coCopy').onclick = async () => {
  try { await navigator.clipboard.writeText($('#coCode').textContent); toast('📋 Código copiado! Cola no app do banco 💛'); }
  catch { toast('Selecione o código e copie manualmente'); }
};

/* ---------- chuva de corações 💛 ---------- */
function hearts(n = 14) {
  const layer = $('#hearts');
  if (!layer) return;
  const emojis = ['💛', '💛', '✨', '🙏', '💛', '🤍'];
  for (let i = 0; i < n; i++) {
    const s = document.createElement('span');
    s.className = 'heart';
    s.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    s.style.left = Math.random() * 100 + 'vw';
    s.style.fontSize = (14 + Math.random() * 22) + 'px';
    s.style.animationDuration = (2.2 + Math.random() * 2.4) + 's';
    s.style.animationDelay = (Math.random() * 0.6) + 's';
    layer.appendChild(s);
    setTimeout(() => s.remove(), 5200);
  }
}
// coraçõezinhos ao escolher valor / gerar PIX
$$('.vals button').forEach(b => b.addEventListener('click', () => hearts(6)));
const _coGen = $('#coGen');
if (_coGen) _coGen.addEventListener('click', () => setTimeout(() => hearts(10), 400));

/* ---------- FEED AO VIVO + COMPARTILHAR + CTA FIXO ---------- */
function timeAgo(iso) {
  const s = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (s < 60) return 'agora mesmo';
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)}h`;
  return `há ${Math.floor(s / 86400)}d`;
}
function causaEmoji(c) { return c === 'animais' ? '🐾' : c === 'necessitados' ? '🍞' : '💛'; }
async function loadFeed() {
  try {
    const r = await fetch('/api/recent');
    if (!r.ok) return;
    const { donations } = await r.json();
    const feed = $('#feed');
    if (!feed) return;
    if (!donations || !donations.length) {
      feed.innerHTML = '<p class="dim feed-empty">Nenhuma doação ainda — seja a primeira! 💛</p>';
      return;
    }
    feed.innerHTML = donations.map(d => `
      <div class="feed-item">
        <span class="feed-av">${(d.nome || '?')[0].toUpperCase()}</span>
        <p><b>${d.nome}</b> doou <b>${fmt(d.amount)}</b> ${causaEmoji(d.causa)}<small> • ${timeAgo(d.createdAt)}${d.status !== 'APPROVED' ? ' • ⏳ confirmando' : ''}</small></p>
      </div>`).join('');
  } catch {}
}

// CTA fixo no mobile após rolar
const _sticky = $('#stickyDonate');
window.addEventListener('scroll', () => {
  if (_sticky) _sticky.hidden = !(window.scrollY > window.innerHeight * 0.7);
}, { passive: true });

// compartilhar = doação grátis
function siteUrl() { return location.href.split('#')[0]; }
const _shareTxt = encodeURIComponent('🙏 Ajude famílias e animais resgatados! Doe a partir de R$2 via PIX 💛 ');
if ($('#shareWa')) $('#shareWa').href = `https://wa.me/?text=${_shareTxt}${encodeURIComponent(siteUrl())}`;
if ($('#shareTg')) $('#shareTg').href = `https://t.me/share/url?url=${encodeURIComponent(siteUrl())}&text=${_shareTxt}`;
if ($('#shareCopy')) $('#shareCopy').onclick = async () => {
  try { await navigator.clipboard.writeText(siteUrl()); toast('🔗 Link copiado! Espalhe o amor 💛'); }
  catch { toast('Copie o endereço da página'); }
};
if ($('#coShare')) $('#coShare').onclick = () => {
  window.open(`https://wa.me/?text=${encodeURIComponent('Acabei de doar 🙏 Junte-se a mim e ajude também! ')}${encodeURIComponent(siteUrl())}`, '_blank');
};

/* ---------- POPUP PROVA SOCIAL (só com doações reais) ---------- */
let _proofIdx = 0, _proofTimer = null;
async function proofLoop() {
  try {
    const r = await fetch('/api/recent');
    if (!r.ok) return;
    const { donations } = await r.json();
    if (!donations || !donations.length) return;
    const d = donations[_proofIdx % donations.length];
    _proofIdx++;
    const pop = $('#proofPop');
    if (!pop || !$('#checkout').hidden) { scheduleProof(); return; } // não atrapalha o checkout
    $('#proofAv').textContent = (d.nome || '?')[0].toUpperCase();
    $('#proofTxt').innerHTML = `<b>${d.nome}</b> doou <b>${fmt(d.amount)}</b> ${causaEmoji(d.causa)}<small>${timeAgo(d.createdAt)} • verificada ✅</small>`;
    pop.hidden = false;
    pop.classList.remove('hide');
    clearTimeout(_proofTimer);
    _proofTimer = setTimeout(() => { pop.classList.add('hide'); setTimeout(() => pop.hidden = true, 380); }, 5200);
  } catch {}
  scheduleProof();
}
function scheduleProof() { clearTimeout(window._proofSched); window._proofSched = setTimeout(proofLoop, 17000); }
const _proofX = $('#proofX');
if (_proofX) _proofX.onclick = () => { const p = $('#proofPop'); p.classList.add('hide'); setTimeout(() => p.hidden = true, 380); };
setTimeout(proofLoop, 9000);

update();
