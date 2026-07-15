/*
 * main.js — panel controller: wires the UI to the transcript pipeline,
 * the Claude client, and the Premiere host functions.
 */
(function () {
  "use strict";

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  // ---- state ----
  let transcript = null;   // { segments, plainText, hasTimestamps }
  let shorts = [];         // last shorts result
  let cuts = [];           // last cleanup result (pauses + blunders)

  // ---- tiny UI helpers ----
  function toast(msg, ok) {
    const el = $("#toast");
    el.textContent = msg;
    el.className = "app-footer show " + (ok ? "ok" : "err");
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.className = "app-footer"; }, ok ? 3500 : 7000);
  }

  function busy(msg) {
    $("#busy-text").textContent = msg;
    $("#busy").style.display = "flex";
  }
  function unbusy() { $("#busy").style.display = "none"; }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function needTimestamps() {
    if (!transcript) { toast("Load a transcript first (Import SRT/VTT above).", false); return true; }
    if (!transcript.hasTimestamps) {
      toast("This feature needs a timestamped transcript (SRT/VTT or auto-transcribe) so cuts land on real times.", false);
      return true;
    }
    return false;
  }

  const fmt = AUBTranscript.formatTime.bind(AUBTranscript);

  // ---- tabs ----
  $$(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
      $$(".tab").forEach(t => t.classList.remove("active"));
      $$(".tab-panel").forEach(p => p.classList.remove("active"));
      tab.classList.add("active");
      $("#tab-" + tab.dataset.tab).classList.add("active");
    });
  });

  // ---- sequence status ----
  async function refreshSequenceStatus() {
    const el = $("#seq-status");
    try {
      const info = await AUB.premiere.getSequenceInfo();
      el.textContent = "▶ " + info.name + " · " + fmt(info.durationSeconds);
      el.className = "seq-status ok";
    } catch (e) {
      el.textContent = "no active sequence";
      el.className = "seq-status bad";
    }
  }
  refreshSequenceStatus();
  setInterval(refreshSequenceStatus, 8000);

  // ---- transcript loading ----
  function setTranscript(t, sourceLabel) {
    transcript = t;
    const el = $("#transcript-status");
    if (t.hasTimestamps) {
      const dur = t.segments.length ? t.segments[t.segments.length - 1].end : 0;
      el.textContent = "✓ Transcript loaded (" + sourceLabel + "): " +
        t.segments.length + " segments · " + fmt(dur) + " · timestamped";
    } else {
      el.textContent = "✓ Transcript loaded (" + sourceLabel + "): plain text, no timestamps — Episode Kit only";
    }
    el.className = "transcript-status loaded";
  }

  $("#btn-import-srt").addEventListener("click", () => $("#file-srt").click());
  $("#file-srt").addEventListener("change", (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const t = AUBTranscript.fromFileContent(file.name, reader.result);
        if (!t.hasTimestamps && !t.plainText) throw new Error("Couldn't parse that file.");
        setTranscript(t, file.name);
        toast("Transcript imported.", true);
      } catch (e) { toast(e.message, false); }
    };
    reader.readAsText(file);
    ev.target.value = "";
  });

  // paste modal
  $("#btn-paste").addEventListener("click", () => { $("#paste-modal").style.display = "flex"; });
  $("#btn-paste-cancel").addEventListener("click", () => { $("#paste-modal").style.display = "none"; });
  $("#btn-paste-ok").addEventListener("click", () => {
    const text = $("#paste-text").value.trim();
    if (!text) return;
    const t = /-->/.test(text)
      ? AUBTranscript.fromFileContent(/WEBVTT/.test(text) ? "pasted.vtt" : "pasted.srt", text)
      : AUBTranscript.fromPlainText(text);
    setTranscript(t, "pasted");
    $("#paste-modal").style.display = "none";
    toast("Transcript loaded from paste.", true);
  });

  // whisper auto-transcription
  $("#btn-auto-transcribe").addEventListener("click", () => $("#file-media").click());
  $("#file-media").addEventListener("change", async (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    ev.target.value = "";
    busy("Transcribing " + file.name + " with Whisper… (this can take a minute)");
    try {
      const t = await AUBWhisper.transcribeFile(file);
      setTranscript(t, file.name);
      toast("Auto-transcription complete.", true);
    } catch (e) { toast(e.message, false); }
    unbusy();
  });

  // =========================================================
  // SHORTS
  // =========================================================
  $("#btn-find-shorts").addEventListener("click", async () => {
    if (needTimestamps()) return;
    const opts = {
      count: parseInt($("#shorts-count").value, 10) || 5,
      minLen: parseInt($("#shorts-min").value, 10) || 20,
      maxLen: parseInt($("#shorts-max").value, 10) || 59,
    };
    busy("Reading the transcript and hunting for viral moments…");
    try {
      shorts = await AUBClaude.findShorts(transcript, opts);
      renderShorts();
      toast("Found " + shorts.length + " candidate shorts.", true);
    } catch (e) { toast(e.message, false); }
    unbusy();
  });

  function scoreClass(s) { return s >= 80 ? "hot" : s >= 60 ? "warm" : "cool"; }

  function renderShorts() {
    const wrap = $("#shorts-results");
    wrap.innerHTML = "";
    shorts.forEach((sh, i) => {
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML =
        '<div class="card-head">' +
          '<span class="score ' + scoreClass(sh.virality_score) + '">' + esc(sh.virality_score) + '</span>' +
          '<span class="title">' + esc(sh.title) + '</span>' +
          '<span class="time">' + fmt(sh.start) + '–' + fmt(sh.end) + ' (' + Math.round(sh.end - sh.start) + 's)</span>' +
        '</div>' +
        '<div class="body"><b>Hook:</b> ' + esc(sh.hook) + '<br/><b>Why:</b> ' + esc(sh.reason) +
          '<br/><b>Caption:</b> ' + esc(sh.caption) + '</div>' +
        '<div class="hashtags">' + esc((sh.hashtags || []).map(h => h.startsWith("#") ? h : "#" + h).join(" ")) + '</div>' +
        '<div class="card-actions">' +
          '<button class="btn small" data-act="create" data-i="' + i + '">Create 9:16 Sequence</button>' +
          '<button class="btn small" data-act="mark" data-i="' + i + '">Add Marker</button>' +
          '<button class="copy-btn" data-act="copy" data-i="' + i + '">copy caption</button>' +
        '</div>';
      wrap.appendChild(card);
    });
    $("#btn-create-all-shorts").style.display = shorts.length ? "block" : "none";
  }

  async function createShort(i, silent) {
    const sh = shorts[i];
    const name = "Short " + (i + 1) + " — " + sh.title;
    await AUB.premiere.createShort(sh.start, sh.end, name);
    const card = $$("#shorts-results .card")[i];
    if (card) card.classList.add("created");
    if (!silent) toast('Created 9:16 sequence "' + name + '" in your project bin.', true);
  }

  $("#shorts-results").addEventListener("click", async (ev) => {
    const btn = ev.target.closest("[data-act]");
    if (!btn) return;
    const i = parseInt(btn.dataset.i, 10);
    const sh = shorts[i];
    try {
      if (btn.dataset.act === "create") {
        busy("Building 9:16 sequence (razor → subsequence → auto-reframe)…");
        await createShort(i);
      } else if (btn.dataset.act === "mark") {
        await AUB.premiere.addMarkers([{
          start: sh.start, end: sh.end,
          name: "SHORT: " + sh.title,
          comments: "Score " + sh.virality_score + " — " + sh.reason,
          colorIndex: 2, // typically green
        }]);
        toast("Marker added on the timeline.", true);
      } else if (btn.dataset.act === "copy") {
        const text = sh.title + "\n\n" + sh.caption + "\n\n" +
          (sh.hashtags || []).map(h => h.startsWith("#") ? h : "#" + h).join(" ");
        await navigator.clipboard.writeText(text);
        btn.textContent = "copied ✓"; btn.classList.add("copied");
        setTimeout(() => { btn.textContent = "copy caption"; btn.classList.remove("copied"); }, 1500);
      }
    } catch (e) { toast(e.message, false); }
    unbusy();
  });

  $("#btn-create-all-shorts").addEventListener("click", async () => {
    try {
      for (let i = 0; i < shorts.length; i++) {
        busy("Creating short " + (i + 1) + " of " + shorts.length + "…");
        await createShort(i, true);
      }
      toast("Created " + shorts.length + " vertical sequences. Check your project bin.", true);
    } catch (e) { toast(e.message, false); }
    unbusy();
  });

  // =========================================================
  // CLEANUP
  // =========================================================
  $("#btn-analyze-cleanup").addEventListener("click", async () => {
    if (needTimestamps()) return;
    const wantPauses = $("#cleanup-pauses").checked;
    const wantBlunders = $("#cleanup-blunders").checked;
    if (!wantPauses && !wantBlunders) { toast("Pick at least one thing to detect.", false); return; }

    cuts = [];
    try {
      if (wantPauses) {
        const threshold = parseFloat($("#pause-threshold").value) || 1.0;
        const padding = parseFloat($("#pause-padding").value) || 0.15;
        cuts = cuts.concat(AUBTranscript.detectPauses(transcript, threshold, padding));
      }
      if (wantBlunders) {
        busy("Reading the dialogue for stutters, false starts and retakes…");
        const blunders = await AUBClaude.findBlunders(transcript);
        cuts = cuts.concat(blunders);
      }
      cuts.sort((a, b) => a.start - b.start);
      renderCuts();
      toast("Analysis complete: " + cuts.length + " candidate cuts.", true);
    } catch (e) { toast(e.message, false); }
    unbusy();
  });

  function selectedCuts() {
    const boxes = $$("#cleanup-results input[type=checkbox]");
    return cuts.filter((c, i) => boxes[i] && boxes[i].checked);
  }

  function updateCleanupSummary() {
    const sel = selectedCuts();
    const saved = sel.reduce((acc, c) => acc + (c.end - c.start), 0);
    $("#cleanup-summary").textContent = sel.length
      ? sel.length + " cuts selected · removes " + saved.toFixed(1) + "s of dead weight"
      : "";
  }

  function renderCuts() {
    const wrap = $("#cleanup-results");
    wrap.innerHTML = "";
    cuts.forEach((c) => {
      const row = document.createElement("div");
      row.className = "cut-row";
      const conf = c.confidence != null ? Math.round(c.confidence * 100) + "%" : "";
      row.innerHTML =
        '<input type="checkbox" ' + (c.confidence == null || c.confidence >= 0.6 ? "checked" : "") + '/>' +
        '<div class="cut-info">' +
          '<span class="badge ' + esc(c.type) + '">' + esc(c.type.replace("_", " ")) + '</span> ' +
          '<span class="cut-time">' + fmt(c.start) + '–' + fmt(c.end) +
            ' (' + (c.end - c.start).toFixed(1) + 's) ' + conf + '</span><br/>' +
          (c.excerpt ? '<span class="cut-excerpt">“' + esc(c.excerpt) + '”</span><br/>' : "") +
          '<span class="cut-reason">' + esc(c.reason) + '</span>' +
        '</div>';
      wrap.appendChild(row);
    });
    wrap.addEventListener("change", updateCleanupSummary);
    $("#cleanup-actions").style.display = cuts.length ? "flex" : "none";
    updateCleanupSummary();
  }

  $("#btn-cleanup-markers").addEventListener("click", async () => {
    const sel = selectedCuts();
    if (!sel.length) { toast("Nothing selected.", false); return; }
    busy("Adding " + sel.length + " markers…");
    try {
      await AUB.premiere.addMarkers(sel.map(c => ({
        start: c.start, end: c.end,
        name: "CUT: " + c.type,
        comments: (c.excerpt ? '"' + c.excerpt + '" — ' : "") + c.reason,
        colorIndex: c.type === "pause" ? 1 : 0, // pause=yellow-ish, blunders=red-ish
      })));
      toast(sel.length + " markers added — review them on the timeline.", true);
    } catch (e) { toast(e.message, false); }
    unbusy();
  });

  $("#btn-cleanup-autocut").addEventListener("click", async () => {
    const sel = selectedCuts();
    if (!sel.length) { toast("Nothing selected.", false); return; }
    const saved = sel.reduce((acc, c) => acc + (c.end - c.start), 0);
    if (!confirm("Auto-cut " + sel.length + " ranges (" + saved.toFixed(1) + "s) on a DUPLICATE of the active sequence?\n\nYour original sequence is never touched. Unlock all tracks first.")) return;
    busy("Duplicating sequence, razoring " + sel.length + " ranges and closing gaps…");
    try {
      const res = await AUB.premiere.autoCut(sel.map(c => [c.start, c.end]));
      toast('Done — cleaned duplicate "' + res.sequence + '" created (' + res.clipsRemoved + " clip pieces removed).", true);
      refreshSequenceStatus();
    } catch (e) { toast(e.message, false); }
    unbusy();
  });

  // =========================================================
  // EPISODE KIT
  // =========================================================
  $("#btn-episode-kit").addEventListener("click", async () => {
    if (!transcript) { toast("Load a transcript first.", false); return; }
    busy("Writing titles, description, chapters and thumbnail concepts…");
    try {
      const kit = await AUBClaude.episodeKit(transcript);
      renderKit(kit);
      toast("Episode kit ready.", true);
    } catch (e) { toast(e.message, false); }
    unbusy();
  });

  function copyLine(text, sub) {
    return '<div class="copy-line"><div class="text">' + esc(text) +
      (sub ? "<small>" + esc(sub) + "</small>" : "") +
      '</div><button class="copy-btn" data-copy="' + esc(text) + '">copy</button></div>';
  }

  function renderKit(kit) {
    const wrap = $("#episode-results");
    const tsText = kit.timestamps
      .map(t => fmt(t.seconds) + " " + t.label).join("\n");
    const fullDescription = kit.description + "\n\nTIMESTAMPS:\n" + tsText;

    let html = "";

    html += '<div class="kit-section"><h4>Titles</h4>' +
      kit.titles.map(t => copyLine(t)).join("") + "</div>";

    html += '<div class="kit-section"><h4>Description</h4>' + copyLine(kit.description) +
      '<div class="button-row"><button class="btn small" id="btn-copy-full-desc">Copy description + timestamps</button></div></div>';

    html += '<div class="kit-section"><h4>Timestamps</h4>' + copyLine(tsText) +
      '<div class="button-row"><button class="btn small" id="btn-chapter-markers">Add as Chapter Markers</button></div></div>';

    html += '<div class="kit-section"><h4>Thumbnail ideas</h4>' +
      kit.thumbnail_ideas.map(t =>
        copyLine(t.text_overlay, t.concept + " — " + t.why_it_works)
      ).join("") + "</div>";

    html += '<div class="kit-section"><h4>Tags</h4>' + copyLine(kit.tags.join(", ")) + "</div>";

    wrap.innerHTML = html;

    wrap.querySelectorAll(".copy-btn[data-copy]").forEach(btn => {
      btn.addEventListener("click", async () => {
        await navigator.clipboard.writeText(btn.dataset.copy);
        btn.textContent = "copied ✓"; btn.classList.add("copied");
        setTimeout(() => { btn.textContent = "copy"; btn.classList.remove("copied"); }, 1500);
      });
    });

    $("#btn-copy-full-desc").addEventListener("click", async (ev) => {
      await navigator.clipboard.writeText(fullDescription);
      toast("Description + timestamps copied.", true);
    });

    $("#btn-chapter-markers").addEventListener("click", async () => {
      busy("Adding chapter markers…");
      try {
        await AUB.premiere.addMarkers(kit.timestamps.map(t => ({
          start: t.seconds,
          name: t.label,
          comments: "Chapter",
          colorIndex: 4,
        })));
        toast(kit.timestamps.length + " chapter markers added.", true);
      } catch (e) { toast(e.message, false); }
      unbusy();
    });
  }

  // =========================================================
  // SETTINGS
  // =========================================================
  function loadSettingsUI() {
    const s = AUBStore.load();
    $("#set-anthropic").value = s.anthropicKey;
    $("#set-openai").value = s.openaiKey;
    $("#set-model").value = s.model;
    $("#set-context").value = s.channelContext;
    $("#shorts-count").value = s.shortCount;
    $("#shorts-min").value = s.shortMin;
    $("#shorts-max").value = s.shortMax;
    $("#pause-threshold").value = s.pauseThreshold;
    $("#pause-padding").value = s.pausePadding;
  }

  $("#btn-save-settings").addEventListener("click", () => {
    const s = AUBStore.load();
    s.anthropicKey = $("#set-anthropic").value.trim();
    s.openaiKey = $("#set-openai").value.trim();
    s.model = $("#set-model").value;
    s.channelContext = $("#set-context").value.trim();
    s.shortCount = parseInt($("#shorts-count").value, 10) || 5;
    s.shortMin = parseInt($("#shorts-min").value, 10) || 20;
    s.shortMax = parseInt($("#shorts-max").value, 10) || 59;
    s.pauseThreshold = parseFloat($("#pause-threshold").value) || 1.0;
    s.pausePadding = parseFloat($("#pause-padding").value) || 0.15;
    AUBStore.save(s);
    $("#settings-saved").textContent = "Saved ✓";
    setTimeout(() => { $("#settings-saved").textContent = ""; }, 2000);
  });

  loadSettingsUI();
})();
