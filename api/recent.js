// GET /api/recent — últimas doações p/ feed ao vivo (público, nomes mascarados)
import { recentList } from '../lib/db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=30');
  return res.json({ donations: await recentList(8) });
}
