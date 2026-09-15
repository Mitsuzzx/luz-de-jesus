// Meta Conversions API — evento Purchase server-side.
// Deduplicado com o Pixel do navegador via event_id (mesmo ID nos dois).
export function newEventId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export async function sendPurchaseCAPI({ pixelId, token, eventId, value, fbp, fbc, userAgent, email }) {
  if (!pixelId || !token) return { skipped: true };
  try {
    const crypto = await import('crypto');
    const hash = (s) => (s ? crypto.createHash('sha256').update(String(s).trim().toLowerCase()).digest('hex') : undefined);
    const user_data = {};
    if (fbp) user_data.fbp = fbp;
    if (fbc) user_data.fbc = fbc;
    if (userAgent) user_data.client_user_agent = String(userAgent).slice(0, 300);
    const em = hash(email);
    if (em) user_data.em = [em];
    const body = {
      data: [{
        event_name: 'Purchase',
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId || String(Date.now()),
        action_source: 'website',
        user_data,
        custom_data: { currency: 'BRL', value: Number(value) || 0 }
      }]
    };
    const r = await fetch(`https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${token}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) console.error('CAPI erro:', JSON.stringify(j).slice(0, 300));
    return j;
  } catch (e) {
    console.error('CAPI falha:', e.message);
    return { error: true };
  }
}
