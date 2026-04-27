// Talks to /api/pairs (read/write metadata) and /api/upload (issues
// blob upload tokens; the actual upload streams directly to Vercel Blob
// via the @vercel/blob/client SDK loaded from esm.sh).
//
// State of truth lives on the server. The client renders rows from the
// fetched pairs and writes back on every change. Refresh-safe; multi-
// device-safe; boss visits the URL and sees whatever the most recent
// save wrote.

(function () {
  "use strict";

  // ------------------------------------------------------------------
  // Tiny helpers
  // ------------------------------------------------------------------
  function hash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (h << 5) - h + str.charCodeAt(i);
      h |= 0;
    }
    return h;
  }

  function uid() {
    // 8-byte random id, hex.
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  function debounce(fn, ms) {
    let t = null;
    return function () {
      const args = arguments;
      const ctx = this;
      clearTimeout(t);
      t = setTimeout(function () {
        fn.apply(ctx, args);
      }, ms);
    };
  }

  function setStatus(text, kind) {
    const el = document.getElementById('save-status');
    if (!el) return;
    el.textContent = text || '';
    el.dataset.kind = kind || '';
  }

  // ------------------------------------------------------------------
  // Vercel Blob client SDK (loaded once, lazily, from esm.sh)
  // ------------------------------------------------------------------
  let _blobClientPromise = null;
  function blobClient() {
    if (!_blobClientPromise) {
      _blobClientPromise = import('https://esm.sh/@vercel/blob@0.27.3/client');
    }
    return _blobClientPromise;
  }

  // Vercel Blob rejects pathnames with spaces / parens / other URL-unsafe
  // characters with a 400. Sanitize but keep the file extension.
  function sanitizePathname(name) {
    const dot = name.lastIndexOf('.');
    let base = dot > 0 ? name.slice(0, dot) : name;
    let ext = dot > 0 ? name.slice(dot) : '';
    base = base.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
    ext = ext.replace(/[^a-zA-Z0-9.]+/g, '');
    if (!base) base = 'audio';
    return base + ext;
  }

  async function uploadFile(file) {
    setStatus('Uploading ' + file.name + '…', 'busy');
    const safeName = sanitizePathname(file.name);
    const { upload } = await blobClient();
    const blob = await upload(safeName, file, {
      access: 'public',
      handleUploadUrl: '/api/upload',
    });
    // Keep the original filename for display in the slot
    return { url: blob.url, name: file.name };
  }

  // ------------------------------------------------------------------
  // Server I/O
  // ------------------------------------------------------------------
  async function loadPairsFromServer() {
    const r = await fetch('/api/pairs', { cache: 'no-store' });
    if (!r.ok) throw new Error('Failed to load pairs: HTTP ' + r.status);
    return r.json();
  }

  async function persistPairs() {
    setStatus('Saving…', 'busy');
    const r = await fetch('/api/pairs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state.pairs),
    });
    if (!r.ok) {
      let detail = '';
      try { detail = (await r.json()).error || ''; } catch (e) {}
      setStatus('Save failed: ' + (detail || r.status), 'error');
      throw new Error('Save failed: HTTP ' + r.status);
    }
    setStatus('Saved ✓', 'ok');
    setTimeout(function () {
      const el = document.getElementById('save-status');
      if (el && el.dataset.kind === 'ok') setStatus('');
    }, 1800);
  }
  const persistPairsDebounced = debounce(persistPairs, 350);

  // ------------------------------------------------------------------
  // App state — single source of truth, mirrors what's on the server
  // ------------------------------------------------------------------
  const state = {
    pairs: [], // array of { id, prompt, acestepUrl, acestepName, sunoUrl, sunoName }
  };

  function getPair(id) {
    return state.pairs.find(function (p) { return p.id === id; });
  }

  function newPair() {
    return { id: uid(), prompt: '', acestepUrl: '', acestepName: '', sunoUrl: '', sunoName: '' };
  }

  // ------------------------------------------------------------------
  // Row rendering — one DOM row per pair, kept in sync with state
  // ------------------------------------------------------------------
  function renderRow(pair) {
    const tpl = document.getElementById('pair-template');
    const node = tpl.content.firstElementChild.cloneNode(true);
    node.dataset.id = pair.id;

    const promptInput = node.querySelector('.pair-prompt-input');
    const acestepSlot = node.querySelector('.upload-slot[data-source="acestep"]');
    const sunoSlot = node.querySelector('.upload-slot[data-source="suno"]');
    const sides = node.querySelector('.pair-sides');
    const actions = node.querySelector('.pair-actions');
    const audioA = node.querySelector('.audio-a');
    const audioB = node.querySelector('.audio-b');
    const sideAEl = sides.children[0];
    const sideBEl = sides.children[1];
    const badgeA = sideAEl.querySelector('.badge');
    const badgeB = sideBEl.querySelector('.badge');
    const revealBtn = node.querySelector('.reveal-btn');
    const removeBtn = node.querySelector('.remove-btn');

    promptInput.value = pair.prompt || '';

    // Pause one when the other plays
    audioA.addEventListener('play', function () { audioB.pause(); });
    audioB.addEventListener('play', function () { audioA.pause(); });

    function refreshSlotUI() {
      if (pair.acestepUrl) {
        acestepSlot.classList.add('filled');
        acestepSlot.querySelector('.upload-filename').textContent = pair.acestepName || 'ACE-Step file';
      } else {
        acestepSlot.classList.remove('filled');
        acestepSlot.querySelector('.upload-filename').textContent = 'No file selected';
      }
      if (pair.sunoUrl) {
        sunoSlot.classList.add('filled');
        sunoSlot.querySelector('.upload-filename').textContent = pair.sunoName || 'Suno file';
      } else {
        sunoSlot.classList.remove('filled');
        sunoSlot.querySelector('.upload-filename').textContent = 'No file selected';
      }
    }

    function refreshSides() {
      const haveBoth = !!pair.acestepUrl && !!pair.sunoUrl;
      sides.classList.toggle('hidden', !haveBoth);
      actions.classList.toggle('hidden', !haveBoth);
      if (!haveBoth) return;

      const seed = pair.prompt || (pair.acestepUrl + pair.sunoUrl);
      const acestepOnA = (hash(seed) & 1) === 0;
      const newA = acestepOnA ? pair.acestepUrl : pair.sunoUrl;
      const newB = acestepOnA ? pair.sunoUrl : pair.acestepUrl;
      if (audioA.src !== newA) { audioA.pause(); audioA.src = newA; }
      if (audioB.src !== newB) { audioB.pause(); audioB.src = newB; }
      badgeA.className = 'badge ' + (acestepOnA ? 'acestep' : 'suno');
      badgeA.textContent = acestepOnA ? 'ACE-Step' : 'Suno';
      badgeB.className = 'badge ' + (acestepOnA ? 'suno' : 'acestep');
      badgeB.textContent = acestepOnA ? 'Suno' : 'ACE-Step';
    }

    function wireSlot(slot, kind) {
      const fileInput = slot.querySelector('input[type="file"]');

      async function ingest(file) {
        if (!file) return;
        try {
          const { url, name } = await uploadFile(file);
          if (kind === 'acestep') {
            pair.acestepUrl = url;
            pair.acestepName = name;
          } else {
            pair.sunoUrl = url;
            pair.sunoName = name;
          }
          node.classList.remove('revealed');
          revealBtn.textContent = 'Reveal';
          refreshSlotUI();
          refreshSides();
          await persistPairs();
        } catch (err) {
          console.error('Upload failed:', err);
          setStatus('Upload failed: ' + err.message, 'error');
        }
      }

      fileInput.addEventListener('change', function (e) {
        const file = e.target.files && e.target.files[0];
        ingest(file);
      });

      ['dragenter', 'dragover'].forEach(function (evt) {
        slot.addEventListener(evt, function (e) {
          e.preventDefault();
          e.stopPropagation();
          slot.classList.add('drag-over');
        });
      });
      ['dragleave', 'drop'].forEach(function (evt) {
        slot.addEventListener(evt, function (e) {
          e.preventDefault();
          e.stopPropagation();
          slot.classList.remove('drag-over');
        });
      });
      slot.addEventListener('drop', function (e) {
        const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        ingest(file);
      });
    }

    wireSlot(acestepSlot, 'acestep');
    wireSlot(sunoSlot, 'suno');

    promptInput.addEventListener('input', function () {
      pair.prompt = promptInput.value;
      // Reshuffle when prompt changes (it's the seed for the blind A/B)
      if (pair.acestepUrl && pair.sunoUrl) {
        node.classList.remove('revealed');
        revealBtn.textContent = 'Reveal';
        refreshSides();
      }
      persistPairsDebounced();
    });

    revealBtn.addEventListener('click', function () {
      const revealed = node.classList.toggle('revealed');
      revealBtn.textContent = revealed ? 'Hide' : 'Reveal';
    });

    removeBtn.addEventListener('click', async function () {
      const idx = state.pairs.findIndex(function (p) { return p.id === pair.id; });
      if (idx >= 0) state.pairs.splice(idx, 1);
      audioA.pause();
      audioB.pause();
      node.remove();
      try { await persistPairs(); } catch (e) { /* status already set */ }
    });

    refreshSlotUI();
    refreshSides();
    return node;
  }

  function renderAll() {
    const list = document.getElementById('pairs-list');
    list.innerHTML = '';
    state.pairs.forEach(function (pair) {
      list.appendChild(renderRow(pair));
    });
  }

  function addEmptyPair() {
    const pair = newPair();
    state.pairs.push(pair);
    const list = document.getElementById('pairs-list');
    const row = renderRow(pair);
    list.appendChild(row);
    row.querySelector('.pair-prompt-input').focus();
    persistPairsDebounced();
  }

  // ------------------------------------------------------------------
  // Top-bar controls
  // ------------------------------------------------------------------
  function setupRevealAll() {
    document.getElementById('reveal-all').addEventListener('click', function () {
      document.querySelectorAll('.pair').forEach(function (p) {
        p.classList.add('revealed');
        const btn = p.querySelector('.reveal-btn');
        if (btn) btn.textContent = 'Hide';
      });
    });
    document.getElementById('hide-all').addEventListener('click', function () {
      document.querySelectorAll('.pair').forEach(function (p) {
        p.classList.remove('revealed');
        const btn = p.querySelector('.reveal-btn');
        if (btn) btn.textContent = 'Reveal';
      });
    });
  }

  function setupClearAll() {
    document.getElementById('clear-all').addEventListener('click', async function () {
      if (!confirm('Delete all saved pairs? This affects what your boss sees too. Audio files in Vercel Blob will not be deleted automatically.')) return;
      state.pairs = [];
      renderAll();
      try { await persistPairs(); } catch (e) {}
    });
  }

  // The "Publish bundle" button is no longer needed on the Vercel deploy
  // (everything saves to the server automatically), so we relabel it to
  // "Copy share link" — gives boss-friendly URL to the clipboard.
  function setupPublish() {
    const btn = document.getElementById('publish');
    btn.textContent = 'Copy share link';
    btn.addEventListener('click', async function () {
      try {
        await navigator.clipboard.writeText(window.location.origin + window.location.pathname);
        setStatus('Link copied — send it to your boss', 'ok');
        setTimeout(function () {
          if (document.getElementById('save-status').dataset.kind === 'ok') setStatus('');
        }, 2000);
      } catch (e) {
        setStatus('Copy failed: ' + e.message, 'error');
      }
    });
  }

  // ------------------------------------------------------------------
  // Boot
  // ------------------------------------------------------------------
  async function init() {
    setupRevealAll();
    setupClearAll();
    setupPublish();
    document.getElementById('add-pair').addEventListener('click', addEmptyPair);

    setStatus('Loading…', 'busy');
    try {
      const remote = await loadPairsFromServer();
      state.pairs = Array.isArray(remote) ? remote : [];
    } catch (err) {
      console.error(err);
      setStatus('Load failed (running in fresh state): ' + err.message, 'error');
      state.pairs = [];
    }

    if (state.pairs.length === 0) {
      addEmptyPair(); // start with one empty row
    } else {
      renderAll();
      setStatus('Loaded ' + state.pairs.length + ' pair(s)', 'ok');
      setTimeout(function () {
        if (document.getElementById('save-status').dataset.kind === 'ok') setStatus('');
      }, 1500);
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
