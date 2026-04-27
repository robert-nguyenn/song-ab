// Vercel serverless function: hands out a one-time upload token so the
// browser can upload audio directly to Vercel Blob (avoids the 4.5 MB
// request-body limit on serverless functions). Audio files for 3-min
// MP3s are ~4 MB which is right at that limit, so direct-upload is the
// safe path.

import { handleUpload } from '@vercel/blob/client';

export const config = {
  api: { bodyParser: false },
};

async function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf-8') || '{}'));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch (err) {
    res.status(400).json({ error: 'Invalid JSON body: ' + err.message });
    return;
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => ({
        allowedContentTypes: [
          'audio/mpeg',
          'audio/mp3',
          'audio/wav',
          'audio/x-wav',
          'audio/wave',
          'audio/flac',
          'audio/x-flac',
          'audio/ogg',
          'audio/aac',
          'audio/mp4',
          'audio/x-m4a',
        ],
        addRandomSuffix: true,
        maximumSizeInBytes: 25 * 1024 * 1024, // 25 MB cap per file
      }),
      onUploadCompleted: async () => {
        // No-op. We persist the URL in pairs.json via /api/pairs from the client.
      },
    });
    res.status(200).json(jsonResponse);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}
