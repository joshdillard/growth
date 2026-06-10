#!/usr/bin/env python3
"""Produce words.json ([{word, start, end}, ...]) from YouTube json3 captions
or by transcribing media with faster-whisper.

Usage:
  transcribe.py --json3 subs.en.json3 --out words.json
  transcribe.py --media source.mp4 --out words.json [--model small]
"""
import argparse
import json
import sys


def from_json3(path):
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    words = []
    for event in data.get("events", []):
        base = event.get("tStartMs")
        if base is None or "segs" not in event:
            continue
        dur = event.get("dDurationMs", 0)
        segs = [s for s in event["segs"] if s.get("utf8", "").strip()]
        for i, seg in enumerate(segs):
            start = (base + seg.get("tOffsetMs", 0)) / 1000.0
            if i + 1 < len(segs):
                end = (base + segs[i + 1].get("tOffsetMs", 0)) / 1000.0
            else:
                end = (base + dur) / 1000.0
            words.append({
                "word": seg["utf8"].strip(),
                "start": round(start, 3),
                "end": round(max(end, start + 0.05), 3),
            })
    return words


def from_media(path, model_size):
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        sys.exit("faster-whisper not installed: pip3 install --user faster-whisper")
    model = WhisperModel(model_size, compute_type="auto")
    segments, _ = model.transcribe(path, word_timestamps=True, vad_filter=True)
    words = []
    for seg in segments:
        for w in seg.words or []:
            words.append({
                "word": w.word.strip(),
                "start": round(w.start, 3),
                "end": round(w.end, 3),
            })
    return words


def main():
    ap = argparse.ArgumentParser()
    src = ap.add_mutually_exclusive_group(required=True)
    src.add_argument("--json3", help="YouTube json3 caption file")
    src.add_argument("--media", help="audio/video file to transcribe")
    ap.add_argument("--out", required=True)
    ap.add_argument("--model", default="small", help="faster-whisper model size")
    args = ap.parse_args()

    words = from_json3(args.json3) if args.json3 else from_media(args.media, args.model)
    if not words:
        sys.exit("No words extracted — try the other source (--media / --json3).")
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(words, f, ensure_ascii=False, indent=1)
    print(f"{len(words)} words -> {args.out} "
          f"({words[0]['start']:.1f}s .. {words[-1]['end']:.1f}s)")


if __name__ == "__main__":
    main()
