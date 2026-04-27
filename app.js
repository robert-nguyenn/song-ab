// Blind A/B player. Loads pairs.json, randomizes side assignment per pair
// (deterministic from prompt hash so reloads are stable), and reveals
// which side is ACE-Step vs Suno on demand.

(function () {
  "use strict";

  // Stable 32-bit hash. Used to decide which side (A or B) gets ACE-Step
  // for each pair — deterministic per prompt so reloads don't reshuffle,
  // but different across pairs so the boss can't pattern-match.
  function hash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (h << 5) - h + str.charCodeAt(i);
      h |= 0;
    }
    return h;
  }

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        if (k === "class") node.className = attrs[k];
        else if (k === "html") node.innerHTML = attrs[k];
        else if (k.startsWith("on") && typeof attrs[k] === "function") {
          node.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
        } else if (attrs[k] !== undefined && attrs[k] !== null) {
          node.setAttribute(k, attrs[k]);
        }
      }
    }
    if (children) {
      for (const c of children) {
        if (c == null) continue;
        node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
      }
    }
    return node;
  }

  function buildPair(pair, idx) {
    const acestepOnA = (hash(pair.prompt + "|" + idx) & 1) === 0;
    const sideAPath = acestepOnA ? pair.acestep : pair.suno;
    const sideBPath = acestepOnA ? pair.suno : pair.acestep;
    const sideALabel = acestepOnA ? "ACE-Step" : "Suno";
    const sideBLabel = acestepOnA ? "Suno" : "ACE-Step";
    const sideABadgeClass = acestepOnA ? "badge acestep" : "badge suno";
    const sideBBadgeClass = acestepOnA ? "badge suno" : "badge acestep";

    const audioA = el("audio", { controls: "", preload: "metadata", src: sideAPath });
    const audioB = el("audio", { controls: "", preload: "metadata", src: sideBPath });

    // Pause the other side when one starts playing — keeps the comparison clean.
    audioA.addEventListener("play", function () {
      audioB.pause();
    });
    audioB.addEventListener("play", function () {
      audioA.pause();
    });

    const sideA = el("div", { class: "side" }, [
      el("div", { class: "side-label" }, [
        document.createTextNode("A"),
        el("span", { class: sideABadgeClass }, [sideALabel]),
      ]),
      audioA,
    ]);
    const sideB = el("div", { class: "side" }, [
      el("div", { class: "side-label" }, [
        document.createTextNode("B"),
        el("span", { class: sideBBadgeClass }, [sideBLabel]),
      ]),
      audioB,
    ]);

    const revealBtn = el(
      "button",
      {
        class: "reveal-btn",
        type: "button",
      },
      ["Reveal"]
    );

    const pairEl = el("article", { class: "pair" }, [
      el("p", { class: "pair-prompt" }, [pair.prompt]),
      el("div", { class: "pair-sides" }, [sideA, sideB]),
      el("div", { class: "pair-actions" }, [revealBtn]),
    ]);

    revealBtn.addEventListener("click", function () {
      const revealed = pairEl.classList.toggle("revealed");
      revealBtn.textContent = revealed ? "Hide" : "Reveal";
    });

    return pairEl;
  }

  function renderPairs(pairs) {
    const list = document.getElementById("pairs-list");
    list.innerHTML = "";

    if (!Array.isArray(pairs) || pairs.length === 0) {
      list.appendChild(
        el("p", { class: "loading" }, [
          "No pairs in pairs.json yet. Drop audio in audio/ and add entries to pairs.json.",
        ])
      );
      return;
    }

    pairs.forEach(function (pair, idx) {
      if (!pair.prompt || !pair.acestep || !pair.suno) {
        console.warn("Skipping malformed pair:", pair);
        return;
      }
      list.appendChild(buildPair(pair, idx));
    });
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

  function setupDropzones() {
    function wire(zoneId, audioId) {
      const zone = document.getElementById(zoneId);
      const audio = document.getElementById(audioId);
      ["dragenter", "dragover"].forEach(function (evt) {
        zone.addEventListener(evt, function (e) {
          e.preventDefault();
          e.stopPropagation();
          zone.classList.add("drag-over");
        });
      });
      ["dragleave", "drop"].forEach(function (evt) {
        zone.addEventListener(evt, function (e) {
          e.preventDefault();
          e.stopPropagation();
          zone.classList.remove("drag-over");
        });
      });
      zone.addEventListener("drop", function (e) {
        const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (!file) return;
        if (audio.src && audio.src.startsWith("blob:")) URL.revokeObjectURL(audio.src);
        audio.src = URL.createObjectURL(file);
        const hint = zone.querySelector(".drop-hint");
        if (hint) hint.textContent = file.name;
      });
    }
    wire("drop-left", "audio-left");
    wire("drop-right", "audio-right");
  }

  function showError(msg) {
    const list = document.getElementById("pairs-list");
    list.innerHTML = "";
    list.appendChild(el("div", { class: "error" }, [msg]));
  }

  function loadPairs() {
    return fetch("pairs.json", { cache: "no-store" })
      .then(function (resp) {
        if (!resp.ok) throw new Error("HTTP " + resp.status);
        return resp.json();
      })
      .then(renderPairs)
      .catch(function (err) {
        console.error("Failed to load pairs.json:", err);
        showError(
          "Couldn't load pairs.json (" +
            err.message +
            "). If you're opening this file directly with file://, " +
            "use a local server or push to GitHub Pages — browsers block local fetch."
        );
      });
  }

  document.addEventListener("DOMContentLoaded", function () {
    setupRevealAll();
    setupDropzones();
    loadPairs();
  });
})();
