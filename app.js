// Interactive A/B authoring page. One row by default; user adds more
// rows, types prompts, drops/picks ACE-Step + Suno files per row. The
// rendered playback is blind A/B with a per-row Reveal toggle.
//
// State is in-browser only — files are not uploaded anywhere. Refresh
// clears the page. Object URLs are revoked when files are replaced or
// rows removed.

(function () {
  "use strict";

  // Stable 32-bit hash so blind shuffle is deterministic per prompt
  // (different prompts → different A/B assignments without obvious pattern).
  function hash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (h << 5) - h + str.charCodeAt(i);
      h |= 0;
    }
    return h;
  }

  function revokeIfBlob(url) {
    if (url && typeof url === "string" && url.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(url);
      } catch (e) {
        /* noop */
      }
    }
  }

  function buildPair() {
    const tpl = document.getElementById("pair-template");
    const node = tpl.content.firstElementChild.cloneNode(true);

    const promptInput = node.querySelector(".pair-prompt-input");
    const acestepSlot = node.querySelector('.upload-slot[data-source="acestep"]');
    const sunoSlot = node.querySelector('.upload-slot[data-source="suno"]');
    const sides = node.querySelector(".pair-sides");
    const actions = node.querySelector(".pair-actions");
    const audioA = node.querySelector(".audio-a");
    const audioB = node.querySelector(".audio-b");
    const sideAEl = sides.children[0];
    const sideBEl = sides.children[1];
    const badgeA = sideAEl.querySelector(".badge");
    const badgeB = sideBEl.querySelector(".badge");
    const revealBtn = node.querySelector(".reveal-btn");
    const removeBtn = node.querySelector(".remove-btn");

    // Pause one when the other plays.
    audioA.addEventListener("play", function () {
      audioB.pause();
    });
    audioB.addEventListener("play", function () {
      audioA.pause();
    });

    // Hidden ACE-Step / Suno object URLs, separate from the audio
    // element src so we can re-shuffle which side they appear on.
    const state = { acestepUrl: "", sunoUrl: "" };

    function refreshSides() {
      const haveBoth = !!state.acestepUrl && !!state.sunoUrl;
      sides.classList.toggle("hidden", !haveBoth);
      actions.classList.toggle("hidden", !haveBoth);
      if (!haveBoth) return;

      const seed = promptInput.value || state.acestepUrl + state.sunoUrl;
      const acestepOnA = (hash(seed) & 1) === 0;

      const newA = acestepOnA ? state.acestepUrl : state.sunoUrl;
      const newB = acestepOnA ? state.sunoUrl : state.acestepUrl;

      if (audioA.src !== newA) {
        audioA.pause();
        audioA.src = newA;
      }
      if (audioB.src !== newB) {
        audioB.pause();
        audioB.src = newB;
      }
      badgeA.className = "badge " + (acestepOnA ? "acestep" : "suno");
      badgeA.textContent = acestepOnA ? "ACE-Step" : "Suno";
      badgeB.className = "badge " + (acestepOnA ? "suno" : "acestep");
      badgeB.textContent = acestepOnA ? "Suno" : "ACE-Step";
    }

    function wireSlot(slot, kind) {
      const fileInput = slot.querySelector('input[type="file"]');
      const filenameEl = slot.querySelector(".upload-filename");

      function loadFile(file) {
        if (!file) return;
        const oldUrl = kind === "acestep" ? state.acestepUrl : state.sunoUrl;
        revokeIfBlob(oldUrl);
        const url = URL.createObjectURL(file);
        if (kind === "acestep") state.acestepUrl = url;
        else state.sunoUrl = url;
        slot.classList.add("filled");
        filenameEl.textContent = file.name;
        // Collapse the revealed state so each new round starts blind.
        node.classList.remove("revealed");
        revealBtn.textContent = "Reveal";
        refreshSides();
      }

      fileInput.addEventListener("change", function (e) {
        const file = e.target.files && e.target.files[0];
        loadFile(file);
      });

      // Drag-and-drop on the whole slot.
      ["dragenter", "dragover"].forEach(function (evt) {
        slot.addEventListener(evt, function (e) {
          e.preventDefault();
          e.stopPropagation();
          slot.classList.add("drag-over");
        });
      });
      ["dragleave", "drop"].forEach(function (evt) {
        slot.addEventListener(evt, function (e) {
          e.preventDefault();
          e.stopPropagation();
          slot.classList.remove("drag-over");
        });
      });
      slot.addEventListener("drop", function (e) {
        const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        loadFile(file);
      });
    }

    wireSlot(acestepSlot, "acestep");
    wireSlot(sunoSlot, "suno");

    // Refresh A/B assignment when prompt changes (changes the hash seed).
    promptInput.addEventListener("input", function () {
      if (state.acestepUrl && state.sunoUrl) {
        node.classList.remove("revealed");
        revealBtn.textContent = "Reveal";
        refreshSides();
      }
    });

    revealBtn.addEventListener("click", function () {
      const revealed = node.classList.toggle("revealed");
      revealBtn.textContent = revealed ? "Hide" : "Reveal";
    });

    removeBtn.addEventListener("click", function () {
      revokeIfBlob(state.acestepUrl);
      revokeIfBlob(state.sunoUrl);
      audioA.pause();
      audioB.pause();
      node.remove();
    });

    return node;
  }

  function addPair() {
    const list = document.getElementById("pairs-list");
    const node = buildPair();
    list.appendChild(node);
    const promptInput = node.querySelector(".pair-prompt-input");
    promptInput.focus();
    return node;
  }

  function setupRevealAll() {
    document.getElementById("reveal-all").addEventListener("click", function () {
      document.querySelectorAll(".pair").forEach(function (p) {
        p.classList.add("revealed");
        const btn = p.querySelector(".reveal-btn");
        if (btn) btn.textContent = "Hide";
      });
    });
    document.getElementById("hide-all").addEventListener("click", function () {
      document.querySelectorAll(".pair").forEach(function (p) {
        p.classList.remove("revealed");
        const btn = p.querySelector(".reveal-btn");
        if (btn) btn.textContent = "Reveal";
      });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    setupRevealAll();
    document.getElementById("add-pair").addEventListener("click", addPair);
    addPair(); // start with a single empty row
  });
})();
