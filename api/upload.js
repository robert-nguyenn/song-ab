// Issues a one-time upload token so the browser can upload audio
// directly to Vercel Blob (bypassing the 4.5 MB function-body limit).
// This is required for uploads larger than ~4 MB.

import { handleUpload } from '@vercel/blob/client';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const jsonResponse = await handleUpload({
      body: req.body,
      request: req,
      onBeforeGenerateToken: async () => ({
        // Accept any audio MIME type — file pickers / browsers report
        // these inconsistently and there's no benefit to gating here.
        allowedContentTypes: ['audio/*', 'application/octet-stream'],
        addRandomSuffix: true,
        // 200 MB ceiling. WAVs are big (~10 MB/min stereo 48k) so leave headroom,
        // but encourage MP3 in the README.
        maximumSizeInBytes: 200 * 1024 * 1024,
      }),
      onUploadCompleted: async () => {
        // No-op. Client persists the resulting URL via /api/pairs.
      },
    });
    res.status(200).json(jsonResponse);
  } catch (err) {
    console.error('upload handler error:', err);
    res.status(400).json({ error: err.message || String(err) });
  }
}
