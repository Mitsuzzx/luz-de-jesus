// POST /api/webhook — recebe PAYMENT_LINK_APPROVED/CANCELLED da Sharpify
import { updateStatus } from '../lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const evt = req.body || {};
  const id = evt?.event?.contextId;
  const name = evt?.event?.name;
  if (id && name === 'PAYMENT_LINK_APPROVED') await updateStatus(id, 'APPROVED');
  if (id && name === 'PAYMENT_LINK_CANCELLED') await updateStatus(id, 'CANCELLED');
  return res.status(200).end();
}
