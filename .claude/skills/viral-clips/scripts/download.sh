#!/usr/bin/env bash
# Download a YouTube video as source.mp4 (+ word-timed English captions if available).
# Usage: download.sh <url> <workdir>
set -euo pipefail

URL="${1:?usage: download.sh <url> <workdir>}"
WORKDIR="${2:?usage: download.sh <url> <workdir>}"
mkdir -p "$WORKDIR"

# H.264 ≤1080p keeps ffmpeg/OpenCV happy everywhere; fall back to best mp4.
yt-dlp \
  -f "bv*[vcodec^=avc1][height<=1080]+ba[ext=m4a]/b[ext=mp4][height<=1080]/b[height<=1080]/b" \
  --merge-output-format mp4 \
  -o "$WORKDIR/source.%(ext)s" \
  --no-playlist \
  "$URL"

# Word-timed captions (json3). Auto-generated subs carry per-word timing.
yt-dlp --skip-download --no-playlist \
  --write-auto-subs --write-subs \
  --sub-langs "en.*,en" --sub-format json3 \
  -o "$WORKDIR/subs.%(ext)s" \
  "$URL" || echo "No captions available; transcribe with whisper instead." >&2

# Normalize caption filename to subs.en.json3 if a variant was written.
shopt -s nullglob
for f in "$WORKDIR"/subs.*.json3; do
  [ "$f" = "$WORKDIR/subs.en.json3" ] || mv "$f" "$WORKDIR/subs.en.json3"
  break
done

ls -lh "$WORKDIR"
