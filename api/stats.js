// GET /api/stats — meta, arrecadado, doadores
import { getStats } from '../lib/db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=20, stale-while-revalidate=60');
  return res.json(await getStats());
}
