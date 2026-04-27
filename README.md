# Song A/B

In-browser blind A/B player for ACE-Step vs Suno.

Live URL: **https://robert-nguyenn.github.io/song-ab/**

## How it works

- Page starts with one empty pair row
- Each row: type a prompt, drop or pick the ACE-Step file in the green slot, drop or pick the Suno file in the orange slot
- The page renders the two files as A and B with which side is which randomized per prompt (deterministic hash, so it stays stable while you listen)
- Click **Reveal** on a row to see which side is ACE-Step and which is Suno
- **+ Add pair** at the bottom to add more rows
- **Reveal all** / **Hide all** at the top to flip every row at once

Everything is local to the browser — files are never uploaded anywhere. Refreshing the page clears all rows.

## Why this design

You upload the songs you generated to two clearly-labeled slots (ACE-Step / Suno). The actual A/B playback hides those labels, so the listener (Li, you, anyone) makes an honest call before clicking Reveal. The shuffle is per-prompt, so different prompts may put ACE-Step on A and others on B — no pattern to memorize.

## Deploy

GitHub Pages serves whatever's on `main`. To redeploy after a change:

```bash
cd c:/Users/hunga/Desktop/song-ab
git add -A
git commit -m "your message"
git push
```

GitHub Pages auto-rebuilds in ~30 seconds.

## File layout

```
song-ab/
├── index.html       # markup + the row template
├── style.css        # dark-theme styling
├── app.js           # vanilla JS: row rendering, drag/drop, blind shuffle, reveal
└── README.md
```

No build step, no dependencies, no server.

## Local testing

```bash
cd c:/Users/hunga/Desktop/song-ab
python -m http.server 8000
```
Open http://localhost:8000.
