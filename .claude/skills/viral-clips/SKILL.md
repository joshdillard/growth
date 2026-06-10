---
name: viral-clips
description: Turn John Amanchukwu's (@revwutruth) long-form YouTube videos into branded 9:16 shorts — download, find the genuinely viral moments, reframe to the speaker (split-screen for guest segments), add the channel logo top-left, a 5-second title card, word-pop captions, and export to the user's Desktop. Use when the user gives a YouTube URL and wants shorts/reels made from it.
---

# Viral Clips: @revwutruth long-form → branded 9:16 shorts

Pipeline: download → transcribe → pick viral moments → cut + reframe (single or split-screen) → brand (logo, title card, captions) → export to Desktop.

Helper scripts live in `scripts/` next to this file; the channel logo belongs at `assets/logo.png`.

## The style (match it, don't improvise)

John Amanchukwu's content: school-board confrontations, sermons, and interviews. His shorts:

- **Logo top-left** for the whole clip (`assets/logo.png` — if missing, ask the user for it once and save it there).
- **Title card for the first 5 seconds**: the reel's title, ALL CAPS, white on a red box at the top. Channel-style titles are dramatic and concrete: "THROWN OUT OF A SCHOOL BOARD MEETING IN FLORIDA!", "SLAMS ASHEVILLE SCHOOL BOARD", "GOES OFF ABOUT LGBT BOOKS".
- **Word-pop captions**: ≤3 uppercase words per cue, bold white with black outline, lower third.
- **Split screen with guests**: when a clip is a back-and-forth between John and a guest, use the stacked two-panel layout instead of single-speaker framing.

## Step 0 — Dependencies

- `yt-dlp`, `ffmpeg`/`ffprobe`
- Python: `faster-whisper` (transcription), `opencv-python-headless` (face tracking; optional — falls back to center framing)

```bash
command -v yt-dlp ffmpeg ffprobe || true
python3 -c "import faster_whisper" 2>/dev/null || pip3 install --user faster-whisper
python3 -c "import cv2" 2>/dev/null || pip3 install --user opencv-python-headless
```

## Step 1 — Download

```bash
bash scripts/download.sh "<YOUTUBE_URL>" <workdir>   # workdir: mktemp -d -t viralclips.XXXX
```

Produces `<workdir>/source.mp4` and, when available, `<workdir>/subs.en.json3` (word-timed captions).

## Step 2 — Transcribe (word-level timestamps)

```bash
python3 scripts/transcribe.py --json3 <workdir>/subs.en.json3 --out <workdir>/words.json
# or if no captions exist:
python3 scripts/transcribe.py --media <workdir>/source.mp4 --out <workdir>/words.json
```

## Step 3 — Find the viral moments (YOU do this — no script)

Read `words.json` (reconstruct the transcript with timestamps; chunk long videos) and select **self-contained 20–60 s moments**. Quality over quantity — 2–4 strong clips beat 8 weak ones, and a filler clip damages the channel. For this channel, look for:

1. **Confrontation peaks** — the sharpest exchange, the moment he's cut off, escorted out, or the room reacts.
2. **Mic-drop lines** — quotable one-liners with moral force; the line people will repeat.
3. **Receipts** — reading an explicit passage, naming a statistic, holding up the book: concrete evidence moments.
4. **Scripture + application** — a verse landed directly on a current controversy.
5. **Guest sparks** — a genuine back-and-forth, disagreement, or revelation in an interview (→ split layout).

**Reject**: procedural setup, pleasantries, mid-argument context that needs the previous 5 minutes, anything without a hook in the first 2 seconds and a payoff by the end. Snap boundaries to sentence starts/ends (start ~0.3 s before the first word, end ~0.5 s after the last).

For each clip write a **title** in channel voice: ≤9 words, ALL CAPS, concrete and dramatic, never a lie. Write picks to `<workdir>/clips.json`:

```json
[
  {"start": 312.4, "end": 348.9, "layout": "single",
   "title": "THROWN OUT FOR READING THEIR OWN BOOK", "slug": "thrown-out"},
  {"start": 1120.0, "end": 1163.5, "layout": "split",
   "title": "HIS GUEST COULDN'T BELIEVE THIS", "slug": "guest-reaction"}
]
```

Use `"layout": "split"` only when the clip is genuinely two people trading lines on screen; use `"single"` for speeches and monologues.

## Step 4 — Cut, reframe, brand

For each clip in `clips.json` (resolve the `assets/logo.png` path relative to this skill's directory):

```bash
python3 scripts/make_clip.py \
  --video <workdir>/source.mp4 --words <workdir>/words.json \
  --start 312.4 --end 348.9 --layout single \
  --title "THROWN OUT FOR READING THEIR OWN BOOK" \
  --logo <skill-dir>/assets/logo.png \
  --out <workdir>/out/thrown-out.mp4
```

What it does: cuts the segment; in `single` layout it face-tracks the speaker (OpenCV + smoothed dynamic crop via ffmpeg `sendcmd`) into a 1080×1920 frame; in `split` layout it finds the two speakers and stacks them in 1080×960 panels; overlays the logo at top-left; burns in the 5-second title card and the word-pop captions. Output is H.264/AAC, Shorts/Reels-ready.

If framing looks wrong (cutaways, B-roll, three people), re-run with `--no-track` for stable center framing or adjust `--start/--end` to dodge the cutaway.

## Step 5 — Export to Desktop

```bash
DEST="$HOME/Desktop"; [ -d "$DEST" ] || DEST="$PWD/viral-clips-output"; mkdir -p "$DEST"
cp <workdir>/out/*.mp4 "$DEST"/
```

If there is no Desktop (headless/remote session), use `./viral-clips-output` and say where the files are. Finish with a rundown: for each clip — filename, duration, title, layout, and one line on why that moment will travel.
