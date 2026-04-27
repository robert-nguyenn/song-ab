// Vercel serverless function: hands out a one-time upload token so the
// browser can upload audio directly to Vercel Blob (avoids the 4.5 MB
// request-body limit on serverless functions). Audio files for 3-min
// MP3s are ~4 MB, right at that limit, so direct-upload is the safe path.

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
        // No-op. The client persists the resulting URL via /api/pairs.
      },
    });
    res.status(200).json(jsonResponse);
  } catch (err) {
    // Log to function logs for debugging in Vercel dashboard.
    console.error('upload handler error:', err);
    res.status(400).json({ error: err.message || String(err) });
  }
}
