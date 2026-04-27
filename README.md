# Song A/B

Blind A/B listening test for ACE-Step vs Suno. One static page, no build step.

Live URL (after deploy): **https://robert-nguyenn.github.io/song-ab/**

## How it works

- `pairs.json` lists all the prompt → (ACE-Step file, Suno file) triples
- `index.html` + `style.css` + `app.js` render them in a blind A/B layout
- The page picks which side (A or B) gets ACE-Step per pair using a stable hash of the prompt — so reloads stay consistent, but different pairs randomize independently
- A "Reveal" button per row, plus a "Reveal all" / "Hide all" pair at the top
- A drag-and-drop quick-preview at the top for local A/B without committing anything (ephemeral, not persisted)

## Adding a new batch (5–7 pairs at a time)

1. Generate songs in the ACE-Step pipeline (Magic notebook, `generate_song_batch(...)`).
2. **Convert outputs to MP3** before committing — WAVs are too big for git:
   ```bash
   ffmpeg -i input.wav -b:a 192k output.mp3
   ```
   192 kbps stereo MP3 ≈ 4 MB per 3-minute track. ACE-Step output is 48 kHz; ffmpeg will downsample to 44.1 kHz inside the MP3 container, which is fine.
3. Drop both files into `audio/` with a clear naming convention, e.g.:
   ```
   audio/03_phoebe_acestep.mp3
   audio/03_phoebe_suno.mp3
   ```
4. Append an entry to `pairs.json`:
   ```json
   {
     "prompt": "phoebe bridgers song about being a startup founder pre product-market-fit",
     "acestep": "audio/03_phoebe_acestep.mp3",
     "suno": "audio/03_phoebe_suno.mp3"
   }
   ```
   Make sure the JSON is valid (commas between entries, no trailing comma after the last one).
5. Commit and push:
   ```bash
   git add audio/ pairs.json
   git commit -m "add pair: phoebe bridgers founder song"
   git push
   ```
6. GitHub Pages redeploys in ~30 s. Boss visits the URL and listens.

## First-time deploy

```bash
cd c:/Users/hunga/Desktop/song-ab
git init
git branch -M main
git add .
git commit -m "scaffold: blind A/B page"
git remote add origin https://github.com/robert-nguyenn/song-ab.git
git push -u origin main
```

Then on GitHub:

1. Go to **Settings** → **Pages**
2. Under **Source**, choose **Deploy from a branch**
3. Branch: **main**, folder: **/ (root)**, click **Save**
4. Wait ~30 s, refresh — the URL `https://robert-nguyenn.github.io/song-ab/` will be live

## Local testing before pushing

Browsers block `fetch("pairs.json")` over `file://`. Use Python's built-in static server:

```bash
cd c:/Users/hunga/Desktop/song-ab
python -m http.server 8000
```

Then open http://localhost:8000.

## File layout

```
song-ab/
├── index.html       # the page
├── style.css        # dark-theme styling
├── app.js           # vanilla JS — fetches pairs.json, renders rows, blind shuffle, reveal logic
├── pairs.json       # list of A/B pairs (edit this when adding new ones)
├── audio/           # mp3 files — referenced by pairs.json
│   └── ...
└── README.md
```

## Why MP3 not WAV

- 3-min stereo 48kHz WAV ≈ 30 MB. 7 pairs × 2 = 14 files = ~420 MB → GitHub rejects files >100 MB and warns at 50 MB.
- 192 kbps MP3 of the same audio ≈ 4 MB. 14 files = ~56 MB total. Comfortably within GitHub Pages' 1 GB site limit.
- Boss is listening on a laptop / Discord — he won't hear MP3 vs WAV at 192 kbps.

## Troubleshooting

- **"Couldn't load pairs.json"** → you opened `index.html` with `file://`. Use the Python server above, or push to GitHub Pages.
- **Audio plays silently / not at all** → check the browser console; the file path in `pairs.json` is probably wrong, or the MP3 is corrupt.
- **Pages site shows 404 after deploy** → wait 1 min and hard-refresh (Ctrl+Shift+R). First deploy can take a couple minutes.
