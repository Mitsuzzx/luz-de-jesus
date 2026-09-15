// GET /api/config — config pública (Pixel ID é público por natureza)
import { getMetaPublic } from '../lib/db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  return res.json(await getMetaPublic());
}
