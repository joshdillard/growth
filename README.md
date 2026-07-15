# 🛠️ AI UtilityBelt — AI YouTube Editor for Premiere Pro

A Premiere Pro extension (CEP panel) that turns a long-form recording into a
finished YouTube package — like AutoCut, but built around your own AI keys and
your own workflow.

**What it does, from one timeline + one transcript:**

| Tab | What you get |
|---|---|
| 🎬 **Shorts** | AI finds the most viral moments, then builds a **9:16 auto-reframed sequence** in your project for each one — with a hook, reel title, caption, hashtags and a virality score |
| ✂️ **Cleanup** | Removes unnecessary pauses and detects stutters, false starts, filler runs and retakes ("let me start over", "correct this", "scratch that"). Mark them for review, or **auto-cut them on a duplicate sequence** |
| 📦 **Episode Kit** | For 15–25 min podcast episodes: 5 YouTube title options, a full description, chapter **timestamps** (one click adds them as timeline chapter markers), 3 thumbnail concepts, and tags |
| ⚙️ **Settings** | Your Anthropic API key, model choice, channel context (so titles/captions match your voice), and detection defaults |

Everything runs inside Premiere. Nothing is uploaded anywhere except the
transcript text you send to the AI APIs you configure.

---

## Installation

Requirements: **Premiere Pro 2020 (v14) or newer** (Auto Reframe is used for the
9:16 conversion), plus an **Anthropic API key** ([console.anthropic.com](https://console.anthropic.com)).

### macOS
```bash
git clone https://github.com/joshdillard/AIUTILITYBELT.git
cd AIUTILITYBELT
bash scripts/install-mac.sh
```

### Windows (PowerShell)
```powershell
git clone https://github.com/joshdillard/AIUTILITYBELT.git
cd AIUTILITYBELT
.\scripts\install-win.ps1
```

Restart Premiere, then open **Window → Extensions → AI UtilityBelt — YouTube Editor**.
Go to the ⚙️ tab and paste your Anthropic API key.

> The install scripts enable Adobe's `PlayerDebugMode` so the unsigned dev panel
> loads. For distributing to other people, package it as a signed `.zxp` with
> [ZXPSignCmd](https://github.com/Adobe-CEP/CEP-Resources).

---

## Workflow

### 1. Get a transcript (once per project)

The panel needs a **timestamped transcript** to know where words happen on your
timeline. Three ways, pick one:

1. **Premiere Speech-to-Text (recommended, free):**
   Window → Text → Transcript → *Transcribe sequence* → after it finishes,
   `…` menu → **Export → Export to SRT file**. Then click **Import SRT/VTT** in the panel.
2. **Paste** any SRT/VTT content (or plain text — plain text supports the Episode Kit only).
3. **Auto-transcribe**: pick an audio/video file (≤25 MB) and the panel transcribes
   it with the Whisper API (needs an OpenAI key in Settings).

> ⚠️ The transcript's timestamps must match the active sequence. Do transcription
> *before* cutting, or re-export the SRT after big edits.

### 2. ✂️ Cleanup — tighten the raw take

1. Open the raw sequence, click **Analyze**.
   - *Pauses* are found mathematically from gaps between dialogue (threshold + padding are tunable).
   - *Blunders* are found by AI: retakes, "let me start over" meta-comments, heavy stuttering,
     abandoned sentences, filler runs. Each comes with the exact quote, a reason, and a confidence.
2. Review the checklist (low-confidence items start unchecked), then either:
   - **Add Markers** — red/yellow markers so you cut by hand, or
   - **Auto-Cut (on duplicate)** — the panel duplicates your sequence, razors every
     range on all tracks, deletes the pieces and closes the gaps. **Your original
     sequence is never modified.**

> Unlock all tracks before auto-cutting. The auto-cut runs on a duplicate precisely
> so you can compare against the original and undo by deleting the duplicate.

### 3. 🎬 Shorts — cut the reels

1. Set how many shorts you want and the length range (default 20–59s).
2. **Find Viral Moments** — each candidate card shows the hook, why it works,
   a reel title, a ready-to-post caption + hashtags, and a 1–100 virality score.
3. **Create 9:16 Sequence** (or **Create All**) — for each short the panel:
   - sets in/out on your sequence at the clip range,
   - makes a subsequence,
   - runs Premiere's **Auto Reframe** to 9:16 (1080×1920-style vertical).
   The vertical sequences appear in your project bin, named `Short N — Title [9x16]`.
4. **copy caption** puts title + caption + hashtags on your clipboard for posting.

Tip: run **Cleanup first**, open the cleaned duplicate, re-export its SRT, and cut
shorts from that — the reels come out tighter.

### 4. 📦 Episode Kit — package the upload

Click **Generate Episode Kit** and you get, all with copy buttons:

- **5 title options** (≤70 chars, ranked)
- **Description** (hook + summary, written for humans first) — plus a one-click
  *copy description + timestamps* for pasting straight into YouTube
- **Chapter timestamps** — based on real topic shifts; **Add as Chapter Markers**
  drops them on the timeline
- **3 thumbnail concepts** with 1–4 word overlay text and why each works
- **Tags**

Set **Channel context** in ⚙️ once (what your channel is about, tone, audience) and
every title, caption and clip pick is written in your voice.

---

## How it's built

```
com.aiutilitybelt.panel/
├── CSXS/manifest.xml     CEP manifest (Premiere 14+)
├── index.html            Panel UI (tabs: Shorts / Cleanup / Episode Kit / Settings)
├── css/style.css         Premiere-native dark theme
├── js/
│   ├── lib/CSInterface.js  Adobe CEP bridge (slim)
│   ├── bridge.js           Promise wrapper around ExtendScript calls
│   ├── store.js            Settings (localStorage, local-only)
│   ├── transcript.js       SRT/VTT/Whisper parsing + pause detection
│   ├── claude.js           Claude API client (structured outputs, adaptive thinking)
│   ├── whisper.js          Optional Whisper auto-transcription
│   └── main.js             UI controller
└── jsx/host.jsx           ExtendScript: markers, subsequence + Auto Reframe,
                           razor/delete/close-gaps auto-cut on a duplicate
```

**AI:** the panel calls the Anthropic Messages API directly (default model
`claude-opus-4-8`, switchable to Sonnet 5 / Haiku 4.5 in Settings) with JSON-schema
structured outputs, so every response is machine-parseable — no brittle text
scraping. Pause removal uses no AI at all: it's computed from transcript gaps.

**Timeline operations:** markers and the 9:16 pipeline use documented Premiere
scripting APIs (`markers.createMarker`, `createSubsequence`, `autoReframeSequence`).
Auto-cut razors via the QE DOM, then deletes and shifts clips with the same offsets
on every track so audio/video never drift out of sync — and always on a duplicate
sequence.

## Known limitations

- **Auto-cut on drop-frame sequences (29.97/59.94 DF)** can be off by a frame at
  cut points; verify the duplicate before exporting. Marker mode is always exact.
- **Locked tracks** are skipped by the razor — unlock everything before auto-cutting.
- Auto Reframe centers on detected subjects; two-person podcast frames may want a
  manual reframe pass on the generated vertical sequences.
- Whisper auto-transcribe caps at 25 MB per file (use Premiere's Speech-to-Text
  for anything bigger — it's free and has no limit).

## Roadmap ideas

- Burned-in animated captions on shorts
- Word-level cut precision (word-timestamp transcripts)
- One-click export queue via Adobe Media Encoder
- B-roll / zoom-punch suggestions on flagged low-energy sections
