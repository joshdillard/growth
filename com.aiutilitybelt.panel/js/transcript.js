/*
 * transcript.js — normalizes every transcript source into:
 *   { segments: [{ start, end, text }], plainText, hasTimestamps }
 *
 * Sources supported:
 *   - SRT   (Premiere: Text panel -> captions -> Export -> SRT)
 *   - VTT   (WebVTT)
 *   - Whisper verbose_json (from the optional auto-transcribe feature)
 *   - Plain pasted text (no timestamps -> Episode Kit only)
 */
const AUBTranscript = {

  parseTimecode(tc) {
    // "00:01:02,345" or "00:01:02.345" or "01:02.345"
    const m = tc.trim().match(/(?:(\d+):)?(\d+):(\d+)[.,](\d+)/);
    if (!m) return null;
    const h = parseInt(m[1] || "0", 10);
    const min = parseInt(m[2], 10);
    const s = parseInt(m[3], 10);
    const ms = parseInt((m[4] + "000").slice(0, 3), 10);
    return h * 3600 + min * 60 + s + ms / 1000;
  },

  parseSRT(text) {
    const segments = [];
    const blocks = text.replace(/\r/g, "").split(/\n\n+/);
    for (const block of blocks) {
      const lines = block.split("\n").filter(l => l.trim() !== "");
      if (!lines.length) continue;
      let idx = 0;
      if (/^\d+$/.test(lines[0].trim())) idx = 1; // sequence number
      if (idx >= lines.length) continue;
      const tm = lines[idx].match(/([\d:.,]+)\s*-->\s*([\d:.,]+)/);
      if (!tm) continue;
      const start = this.parseTimecode(tm[1]);
      const end = this.parseTimecode(tm[2]);
      const body = lines.slice(idx + 1).join(" ").replace(/<[^>]+>/g, "").trim();
      if (start !== null && end !== null && body) {
        segments.push({ start, end, text: body });
      }
    }
    return segments;
  },

  parseVTT(text) {
    // VTT is SRT-ish; strip the header and cue settings then reuse the SRT parser
    const body = text.replace(/^﻿?WEBVTT[^\n]*\n/, "")
      .replace(/^NOTE[^\n]*\n(?:[^\n]+\n)*/gm, "")
      .replace(/(-->\s*[\d:.,]+)[^\n]*/g, "$1");
    return this.parseSRT(body);
  },

  parseWhisperJSON(json) {
    const data = typeof json === "string" ? JSON.parse(json) : json;
    const segs = data.segments || [];
    return segs.map(s => ({ start: s.start, end: s.end, text: (s.text || "").trim() }))
      .filter(s => s.text);
  },

  fromFileContent(filename, content) {
    const lower = (filename || "").toLowerCase();
    let segments = [];
    if (lower.endsWith(".vtt")) segments = this.parseVTT(content);
    else if (lower.endsWith(".srt")) segments = this.parseSRT(content);
    else if (lower.endsWith(".json")) segments = this.parseWhisperJSON(content);
    else {
      // sniff
      if (/-->/.test(content)) segments = /WEBVTT/.test(content) ? this.parseVTT(content) : this.parseSRT(content);
    }
    return this.build(segments, content);
  },

  fromPlainText(text) {
    return this.build([], text);
  },

  build(segments, fallbackText) {
    segments = (segments || []).slice().sort((a, b) => a.start - b.start);
    const hasTimestamps = segments.length > 0;
    const plainText = hasTimestamps
      ? segments.map(s => s.text).join(" ")
      : (fallbackText || "").trim();
    return { segments, plainText, hasTimestamps };
  },

  // Render segments the way the model sees them: "[12.4–15.7] text"
  toModelText(transcript, maxChars) {
    if (!transcript.hasTimestamps) return transcript.plainText.slice(0, maxChars || 400000);
    const lines = transcript.segments.map(
      s => "[" + s.start.toFixed(1) + "–" + s.end.toFixed(1) + "] " + s.text
    );
    let out = lines.join("\n");
    if (maxChars && out.length > maxChars) out = out.slice(0, maxChars) + "\n[...transcript truncated...]";
    return out;
  },

  // Pause detection is pure math — no AI call needed.
  detectPauses(transcript, thresholdSec, paddingSec) {
    const cuts = [];
    const segs = transcript.segments;
    for (let i = 0; i < segs.length - 1; i++) {
      const gap = segs[i + 1].start - segs[i].end;
      if (gap >= thresholdSec) {
        const start = segs[i].end + paddingSec;
        const end = segs[i + 1].start - paddingSec;
        if (end - start > 0.05) {
          cuts.push({
            start, end,
            type: "pause",
            reason: "Silence of " + gap.toFixed(1) + "s between dialogue",
            confidence: 1.0,
          });
        }
      }
    }
    return cuts;
  },

  formatTime(sec) {
    sec = Math.max(0, sec);
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    const pad = n => (n < 10 ? "0" : "") + n;
    return h > 0 ? h + ":" + pad(m) + ":" + pad(s) : m + ":" + pad(s);
  },
};
