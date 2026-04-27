// GET  /api/pairs  -> returns the current pairs JSON (or [] if none yet)
// POST /api/pairs  -> body is the full pairs array; replaces the stored pairs.json
//
// We store the metadata as a single blob at pathname "pairs.json" with
// a stable URL (no random suffix, allowOverwrite). For a single-author
// tool this is fine; concurrent writers would race.

import { put, list } from '@vercel/blob';

const PAIRS_PATHNAME = 'pairs.json';

async function findPairsBlob() {
  // list() with prefix returns the existing blob if any.
  const result = await list({ prefix: PAIRS_PATHNAME, limit: 10 });
  // pathnames may include random-suffix entries from older versions; pick exact match.
  const exact = result.blobs.find((b) => b.pathname === PAIRS_PATHNAME);
  return exact || null;
}

async function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf-8') || '[]';
        resolve(JSON.parse(text));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

export const config = {
  api: { bodyParser: false },
};

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const blob = await findPairsBlob();
      if (!blob) {
        res.status(200).json([]);
        return;
      }
      // Cache-bust to always read latest. Vercel Blob is eventually consistent
      // but typically near-instant for our usage.
      const r = await fetch(blob.url + '?t=' + Date.now(), { cache: 'no-store' });
      if (!r.ok) {
        res.status(200).json([]);
        return;
      }
      const data = await r.json();
      res.status(200).json(Array.isArray(data) ? data : []);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
    return;
  }

  if (req.method === 'POST') {
    let body;
    try {
      body = await readJsonBody(req);
    } catch (err) {
      res.status(400).json({ error: 'Invalid JSON: ' + err.message });
      return;
    }
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
      res.status(500).json({ error: err.message });
    }
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}
