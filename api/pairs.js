// GET  /api/pairs  -> returns the current pairs JSON (or [] if none yet)
// POST /api/pairs  -> body is the full pairs array; replaces the stored pairs.json
//
// Stores metadata as a single blob at pathname "pairs.json" with a stable
// URL. For a single-author tool this is fine; concurrent writers race.

import { put, list } from '@vercel/blob';

const PAIRS_PATHNAME = 'pairs.json';

async function findPairsBlob() {
  const result = await list({ prefix: PAIRS_PATHNAME, limit: 10 });
  return result.blobs.find((b) => b.pathname === PAIRS_PATHNAME) || null;
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const blob = await findPairsBlob();
      if (!blob) {
        res.status(200).json([]);
        return;
      }
      const r = await fetch(blob.url + '?t=' + Date.now(), { cache: 'no-store' });
      if (!r.ok) {
        res.status(200).json([]);
        return;
      }
      const data = await r.json();
      res.status(200).json(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('pairs GET error:', err);
      res.status(500).json({ error: err.message || String(err) });
    }
    return;
  }

  if (req.method === 'POST') {
    const body = req.body;
    if (!Array.isArray(body)) {
      res.status(400).json({ error: 'Body must be a JSON array of pairs' });
      return;
    }
    try {
      const result = await put(PAIRS_PATHNAME, JSON.stringify(body), {
        access: 'public',
        contentType: 'application/json',
        addRandomSuffix: false,
        allowOverwrite: true,
      });
      res.status(200).json({ ok: true, url: result.url, count: body.length });
    } catch (err) {
      console.error('pairs POST error:', err);
      res.status(500).json({ error: err.message || String(err) });
    }
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}
