# Song A/B

Interactive blind A/B player for ACE-Step vs Suno. Drop audio files in your browser and the page saves them to a server — boss visits the URL and hears them, no git commits required.

## How it works

- Frontend: vanilla HTML / CSS / JS (no build step)
- Backend: two Vercel serverless functions in `api/`
  - `api/upload.js` — issues client-upload tokens for direct-to-blob uploads
  - `api/pairs.js` — `GET` returns the saved pairs JSON; `POST` overwrites it
- Storage: **Vercel Blob** (Vercel's first-party file storage) — both the audio files and the `pairs.json` metadata live there

When you drop an audio file, the browser uploads it directly to Vercel Blob and stores the public URL in the pairs JSON. When the boss visits the URL, his browser fetches `pairs.json` and renders the rows.

## First-time deploy (one-time setup)

1. **Push this repo to GitHub** if it isn't already:
   ```bash
   git add .
   git commit -m "migrate to vercel + blob storage"
   git push
   ```

2. **Sign in to Vercel** at https://vercel.com (free tier is fine).

3. **Import the project**:
   - Click **Add New → Project**
   - Pick `robert-nguyenn/song-ab` from the GitHub list
   - Framework preset: **Other** (Vercel auto-detects static + functions)
   - Click **Deploy**

4. **Enable Vercel Blob** for the project:
   - Once the first deploy finishes, open the project in Vercel
   - Go to **Storage** tab → **Create Database** → pick **Blob**
   - Name it anything (e.g. `song-ab-blob`), click **Create**
   - When prompted, **connect it to this project**
   - Vercel auto-injects the `BLOB_READ_WRITE_TOKEN` env var

5. **Redeploy** so the functions pick up the new env var:
   - Vercel project → **Deployments** → click the latest → **Redeploy**
   - (Or push any small change to trigger a redeploy)

6. **Disable GitHub Pages** for this repo (it's now redundant):
   - GitHub repo → **Settings → Pages → Source → None**

7. **Live URL**: shown on Vercel project page, looks like `https://song-ab-<hash>.vercel.app`. Send that to Li.

## Day-to-day workflow

1. Open the deployed URL in your browser.
2. Type a prompt in the row, drop ACE-Step file in the green slot, drop Suno file in the orange slot. Both files upload immediately; "Saved ✓" appears.
3. Click **+ Add pair** for the next one.
4. When you're done, click **Copy share link** and send the URL to Li.
5. He opens it on his end, sees the same pairs, listens, clicks **Reveal** on each.

Reload-safe, multi-device-safe, refresh-safe. The pairs are server-side, not in your browser.

## File layout

```
song-ab/
├── api/
│   ├── upload.js     # Vercel function — generates client-upload tokens
│   └── pairs.js      # Vercel function — GET/POST pairs.json (in Vercel Blob)
├── index.html        # markup + row template
├── style.css         # dark-theme styling
├── app.js            # vanilla JS — talks to both API routes
├── package.json      # declares @vercel/blob dependency
├── .gitignore
└── README.md
```

## Notes

- **No auth.** Anyone who has the URL can add/remove pairs and upload files. For a single-author tool with a private boss-facing share, this is usually fine. If Li or someone else accidentally edits the pairs, just reset — the original audio blobs aren't deleted on row-removal so you can always rebuild.
- **Cost.** Vercel Hobby + Vercel Blob free tier = 1 GB storage, 10 GB monthly egress. 5–7 pairs × 2 × ~4 MB ≈ 50 MB. You'll be fine for a long time.
- **File size.** The upload function caps individual files at 25 MB. A 192 kbps MP3 of a 4-minute track is ~5 MB so this is plenty of headroom.
- **Cleaning up old uploads.** When you remove a row or replace a file, the old blob stays in Vercel Blob (orphaned). Unused storage is essentially free at this scale; if you want to clean up, you can do it manually from the Vercel Blob dashboard or add a janitor function later.

## Local dev

To run locally with the Vercel CLI (so the API routes work):

```bash
npm install
npx vercel dev
```

Open the URL it prints (usually `http://localhost:3000`). You'll need to be logged in to Vercel and have the project linked: `npx vercel link`.

For UI-only tweaks (where you don't need the backend), `python -m http.server 8000` still works for static editing — the API calls will 404, but you can iterate on layout.
