/*
 * AI UtilityBelt — Premiere Pro host script (ExtendScript)
 *
 * Everything here runs inside Premiere's scripting engine. The panel calls
 * these AUB_* functions through CSInterface.evalScript(). All functions take
 * and return JSON strings so the bridge stays dumb and debuggable.
 */

// ---------------------------------------------------------------------------
// Minimal JSON polyfill (ExtendScript has no native JSON)
// ---------------------------------------------------------------------------
if (typeof JSON === "undefined") { JSON = {}; }
if (typeof JSON.stringify !== "function") {
  JSON.stringify = function (value) {
    var t = typeof value;
    if (value === null) return "null";
    if (t === "number") return isFinite(value) ? String(value) : "null";
    if (t === "boolean") return String(value);
    if (t === "string") {
      return '"' + value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
        .replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t") + '"';
    }
    if (value instanceof Array) {
      var parts = [];
      for (var i = 0; i < value.length; i++) parts.push(JSON.stringify(value[i]));
      return "[" + parts.join(",") + "]";
    }
    if (t === "object") {
      var props = [];
      for (var k in value) {
        if (value.hasOwnProperty(k) && typeof value[k] !== "function" && typeof value[k] !== "undefined") {
          props.push(JSON.stringify(k) + ":" + JSON.stringify(value[k]));
        }
      }
      return "{" + props.join(",") + "}";
    }
    return "null";
  };
}
if (typeof JSON.parse !== "function") {
  JSON.parse = function (text) {
    // Panel only ever sends JSON it built itself, so eval is acceptable here.
    return eval("(" + text + ")");
  };
}

var AUB_TICKS_PER_SECOND = 254016000000;

function AUB_ok(data) { data = data || {}; data.ok = true; return JSON.stringify(data); }
function AUB_err(message) { return JSON.stringify({ ok: false, error: String(message) }); }

function AUB_activeSequence() {
  if (!app.project || !app.project.activeSequence) return null;
  return app.project.activeSequence;
}

function AUB_fps(seq) {
  // seq.timebase = ticks per frame (string)
  var tb = Number(seq.timebase);
  if (!tb || tb <= 0) return 30;
  return AUB_TICKS_PER_SECOND / tb;
}

function AUB_secondsToTimecode(seconds, fps) {
  var totalFrames = Math.round(seconds * fps);
  var fpsInt = Math.round(fps);
  var frames = totalFrames % fpsInt;
  var totalSeconds = Math.floor(totalFrames / fpsInt);
  var s = totalSeconds % 60;
  var m = Math.floor(totalSeconds / 60) % 60;
  var h = Math.floor(totalSeconds / 3600);
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  return pad(h) + ":" + pad(m) + ":" + pad(s) + ":" + pad(frames);
}

// ---------------------------------------------------------------------------
// Diagnostics
// ---------------------------------------------------------------------------
function AUB_ping() {
  return AUB_ok({ app: app.appName || "PPRO", version: app.version });
}

function AUB_getSequenceInfo() {
  try {
    var seq = AUB_activeSequence();
    if (!seq) return AUB_err("No active sequence. Open a sequence in the timeline first.");
    var settings = null;
    try { settings = seq.getSettings(); } catch (e) {}
    return AUB_ok({
      name: seq.name,
      durationSeconds: seq.end / AUB_TICKS_PER_SECOND,
      fps: AUB_fps(seq),
      width: settings ? settings.videoFrameWidth : null,
      height: settings ? settings.videoFrameHeight : null,
      videoTracks: seq.videoTracks.numTracks,
      audioTracks: seq.audioTracks.numTracks
    });
  } catch (e) { return AUB_err(e); }
}

// Path of the first video clip's source media (used for optional auto-transcription)
function AUB_getPrimaryMediaPath() {
  try {
    var seq = AUB_activeSequence();
    if (!seq) return AUB_err("No active sequence.");
    for (var t = 0; t < seq.audioTracks.numTracks; t++) {
      var track = seq.audioTracks[t];
      for (var c = 0; c < track.clips.numItems; c++) {
        var clip = track.clips[c];
        if (clip && clip.projectItem) {
          var p = clip.projectItem.getMediaPath();
          if (p) return AUB_ok({ path: p });
        }
      }
    }
    return AUB_err("No media clips found in the active sequence.");
  } catch (e) { return AUB_err(e); }
}

// ---------------------------------------------------------------------------
// Markers
// payload: { markers: [{ start, end, name, comments, colorIndex }] }
// ---------------------------------------------------------------------------
function AUB_addMarkers(payloadJson) {
  try {
    var payload = JSON.parse(payloadJson);
    var seq = AUB_activeSequence();
    if (!seq) return AUB_err("No active sequence.");
    var added = 0;
    for (var i = 0; i < payload.markers.length; i++) {
      var m = payload.markers[i];
      var marker = seq.markers.createMarker(m.start);
      if (m.name) marker.name = m.name;
      if (m.comments) marker.comments = m.comments;
      if (typeof m.end === "number" && m.end > m.start) {
        try { marker.end = m.end; } catch (eEnd) {}
      }
      if (typeof m.colorIndex === "number") {
        try { marker.setColorByIndex(m.colorIndex); } catch (eColor) {}
      }
      added++;
    }
    return AUB_ok({ added: added });
  } catch (e) { return AUB_err(e); }
}

// ---------------------------------------------------------------------------
// Shorts: build a 9:16 auto-reframed sequence from a time range
// payload: { start, end, name }
//
// Flow: set in/out on the source sequence -> createSubsequence() -> rename ->
// autoReframeSequence(9, 16) which yields a new vertical sequence.
// ---------------------------------------------------------------------------
function AUB_createShort(payloadJson) {
  try {
    var payload = JSON.parse(payloadJson);
    var seq = AUB_activeSequence();
    if (!seq) return AUB_err("No active sequence.");

    seq.setInPoint(payload.start);
    seq.setOutPoint(payload.end);

    var sub = seq.createSubsequence(true); // true = ignore track targeting
    if (!sub) return AUB_err("createSubsequence failed. Is the sequence empty in that range?");

    var baseName = payload.name || (seq.name + " — Short");
    try { sub.name = baseName + " (source)"; } catch (eName) {}

    var reframed = null;
    try {
      // (numerator, denominator, motionPreset: 0 slower / 1 default / 2 faster,
      //  newTitle, useNestedSequences)
      reframed = sub.autoReframeSequence(9, 16, 1, baseName + " [9x16]", false);
    } catch (eReframe) {
      // Auto Reframe unavailable (old Premiere / effect missing): fall back to
      // resizing the subsequence canvas to 1080x1920 so the editor can reframe by hand.
      try {
        var s = sub.getSettings();
        s.videoFrameWidth = 1080;
        s.videoFrameHeight = 1920;
        sub.setSettings(s);
        try { sub.name = baseName + " [9x16 manual]"; } catch (eN2) {}
      } catch (eSettings) {
        return AUB_err("Subsequence created, but auto-reframe failed: " + eReframe);
      }
    }

    // Restore the source sequence as active for the next short
    try { app.project.activeSequence = seq; } catch (eAct) {}

    return AUB_ok({
      created: reframed ? reframed.name : sub.name,
      reframed: !!reframed
    });
  } catch (e) { return AUB_err(e); }
}

// ---------------------------------------------------------------------------
// Auto-cut: remove time ranges from a DUPLICATE of the active sequence.
// payload: { ranges: [[startSec, endSec], ...], duplicate: true }
//
// Algorithm (keeps every track in sync deterministically):
//   1. Duplicate the active sequence (never destroys the original edit).
//   2. Razor every video + audio track at every range boundary (QE DOM).
//   3. Delete every clip that falls inside a remove-range, leaving gaps.
//   4. Close the gaps by shifting every remaining clip left by the total
//      removed duration that precedes it (same offset on all tracks).
// ---------------------------------------------------------------------------
function AUB_autoCut(payloadJson) {
  try {
    var payload = JSON.parse(payloadJson);
    var ranges = payload.ranges || [];
    if (!ranges.length) return AUB_err("No cut ranges provided.");

    var src = AUB_activeSequence();
    if (!src) return AUB_err("No active sequence.");

    var seq = src;
    if (payload.duplicate !== false) {
      var before = {};
      for (var i0 = 0; i0 < app.project.sequences.numSequences; i0++) {
        before[app.project.sequences[i0].sequenceID] = true;
      }
      src.clone();
      // Find the sequence that appeared after clone()
      var cloned = null;
      for (var i1 = 0; i1 < app.project.sequences.numSequences; i1++) {
        var cand = app.project.sequences[i1];
        if (!before[cand.sequenceID]) { cloned = cand; }
      }
      if (!cloned) return AUB_err("Could not locate the duplicated sequence after clone().");
      app.project.activeSequence = cloned;
      seq = app.project.activeSequence;
    }

    // Sort ranges, merge overlaps
    ranges.sort(function (a, b) { return a[0] - b[0]; });
    var merged = [];
    for (var r = 0; r < ranges.length; r++) {
      var cur = ranges[r];
      if (merged.length && cur[0] <= merged[merged.length - 1][1] + 0.001) {
        merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], cur[1]);
      } else {
        merged.push([cur[0], cur[1]]);
      }
    }

    var fps = AUB_fps(seq);

    // --- 2. razor all tracks at every boundary (via QE DOM) ---
    app.enableQE();
    var qeSeq = qe.project.getActiveSequence();
    if (!qeSeq) return AUB_err("QE DOM unavailable (qe.project.getActiveSequence() returned nothing).");

    var boundaries = [];
    for (var b = 0; b < merged.length; b++) { boundaries.push(merged[b][0]); boundaries.push(merged[b][1]); }

    for (var bi = 0; bi < boundaries.length; bi++) {
      var tc = AUB_secondsToTimecode(boundaries[bi], fps);
      var vt;
      for (vt = 0; vt < qeSeq.numVideoTracks; vt++) {
        try { qeSeq.getVideoTrackAt(vt).razor(tc); } catch (eRv) {}
      }
      for (vt = 0; vt < qeSeq.numAudioTracks; vt++) {
        try { qeSeq.getAudioTrackAt(vt).razor(tc); } catch (eRa) {}
      }
    }

    // --- 3. delete clips inside remove-ranges (leave gaps) ---
    var EPS = 1.0 / fps; // one frame of tolerance
    function midpointInRanges(startS, endS) {
      var mid = (startS + endS) / 2;
      for (var m = 0; m < merged.length; m++) {
        if (mid > merged[m][0] - EPS && mid < merged[m][1] + EPS) return true;
      }
      return false;
    }

    var removedCount = 0;
    function purgeTrack(track) {
      // iterate backwards so indices stay valid while removing
      for (var c = track.clips.numItems - 1; c >= 0; c--) {
        var clip = track.clips[c];
        if (!clip) continue;
        if (midpointInRanges(clip.start.seconds, clip.end.seconds)) {
          try { clip.remove(false, false); removedCount++; } catch (eDel) {}
        }
      }
    }
    var t;
    for (t = 0; t < seq.videoTracks.numTracks; t++) purgeTrack(seq.videoTracks[t]);
    for (t = 0; t < seq.audioTracks.numTracks; t++) purgeTrack(seq.audioTracks[t]);

    // --- 4. close gaps: shift everything left by the removed time before it ---
    function removedBefore(timeS) {
      var total = 0;
      for (var m = 0; m < merged.length; m++) {
        if (merged[m][1] <= timeS + EPS) total += (merged[m][1] - merged[m][0]);
        else if (merged[m][0] < timeS) total += (timeS - merged[m][0]);
      }
      return total;
    }
    function compactTrack(track) {
      // left-to-right so clips never collide while shifting left
      for (var c = 0; c < track.clips.numItems; c++) {
        var clip = track.clips[c];
        if (!clip) continue;
        var offset = removedBefore(clip.start.seconds);
        if (offset > EPS / 2) {
          try { clip.move(-offset); } catch (eMove) {}
        }
      }
    }
    for (t = 0; t < seq.videoTracks.numTracks; t++) compactTrack(seq.videoTracks[t]);
    for (t = 0; t < seq.audioTracks.numTracks; t++) compactTrack(seq.audioTracks[t]);

    return AUB_ok({
      sequence: seq.name,
      cuts: merged.length,
      clipsRemoved: removedCount
    });
  } catch (e) { return AUB_err(e); }
}
