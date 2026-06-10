#!/usr/bin/env python3
"""Cut a clip, reframe to 9:16, and brand it John Amanchukwu style:
logo top-left, 5-second title card, word-pop captions, optional
split-screen layout for host + guest segments.

Usage:
  make_clip.py --video source.mp4 --words words.json \
    --start 312.4 --end 348.9 --title "THROWN OUT OF A SCHOOL BOARD MEETING" \
    --logo assets/logo.png --out clip.mp4 [--layout split] [--no-track]
"""
import argparse
import json
import os
import subprocess
import sys
import tempfile

OUT_W, OUT_H = 1080, 1920
TITLE_SECONDS = 5.0
LOGO_WIDTH = 200          # px, overlaid at top-left
MAX_WORDS_PER_CUE = 3
CUE_GAP_BREAK = 0.6       # start a new caption cue after a pause this long


def run(cmd):
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        sys.exit(f"command failed: {' '.join(cmd)}\n{proc.stderr[-2000:]}")
    return proc.stdout


def probe_size(path):
    out = run(["ffprobe", "-v", "error", "-select_streams", "v:0",
               "-show_entries", "stream=width,height", "-of", "csv=p=0", path])
    w, h = out.strip().split("\n")[0].split(",")
    return int(w), int(h)


def cut_segment(video, start, end, dest):
    run(["ffmpeg", "-y", "-ss", f"{start:.3f}", "-to", f"{end:.3f}", "-i", video,
         "-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
         "-c:a", "aac", "-b:a", "192k", dest])


def sample_face_centers(segment, src_w, src_h):
    """Sample frames every ~0.4s; return [(t, [face_center_x, ...]), ...]."""
    try:
        import cv2
    except ImportError:
        return None
    cascade = cv2.CascadeClassifier(
        cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    cap = cv2.VideoCapture(segment)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    step = max(1, int(fps * 0.4))
    samples, idx = [], 0
    while True:
        if not cap.grab():
            break
        if idx % step == 0:
            ok, frame = cap.retrieve()
            if ok:
                gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                faces = cascade.detectMultiScale(gray, 1.15, 5,
                                                 minSize=(src_h // 12, src_h // 12))
                samples.append((idx / fps, [x + w / 2 for x, y, w, h in faces]))
        idx += 1
    cap.release()
    return samples if len(samples) >= 2 else None


def speaker_path(samples, crop_w, src_w):
    """Track the dominant face; return smoothed [(t, crop_x), ...]."""
    last_cx = src_w / 2
    centers = []
    for t, faces in samples:
        if faces:
            last_cx = min(faces, key=lambda cx: abs(cx - last_cx)) \
                if len(faces) > 1 else faces[0]
        centers.append((t, last_cx))
    xs = [c for _, c in centers]
    smoothed = []
    for i in range(len(xs)):
        lo, hi = max(0, i - 3), min(len(xs), i + 4)
        smoothed.append(sum(xs[lo:hi]) / (hi - lo))
    max_x = src_w - crop_w
    return [(t, min(max(cx - crop_w / 2, 0), max_x))
            for (t, _), cx in zip(centers, smoothed)]


def two_speaker_centers(samples, src_w):
    """Median x-center of the left and right face clusters (host + guest)."""
    if samples:
        all_x = sorted(x for _, faces in samples for x in faces)
        if len(all_x) >= 4:
            mid = src_w / 2
            left = [x for x in all_x if x < mid]
            right = [x for x in all_x if x >= mid]
            if left and right:
                return left[len(left) // 2], right[len(right) // 2]
    return src_w * 0.27, src_w * 0.73  # typical side-by-side interview framing


def write_sendcmd(path_points, dest):
    """Interpolate crop-x keyframes into 10 Hz sendcmd updates."""
    lines = []
    for (t0, x0), (t1, x1) in zip(path_points, path_points[1:]):
        t = t0
        while t < t1:
            x = x0 + (x1 - x0) * (t - t0) / (t1 - t0)
            lines.append(f"{t:.2f} crop x {int(round(x))};")
            t += 0.1
    lines.append(f"{path_points[-1][0]:.2f} crop x {int(round(path_points[-1][1]))};")
    with open(dest, "w") as f:
        f.write("\n".join(lines) + "\n")


def ass_escape(text):
    return text.replace("\\", "").replace("{", "(").replace("}", ")").replace("\n", " ")


def ass_time(t):
    t = max(t, 0)
    h, rem = divmod(t, 3600)
    m, s = divmod(rem, 60)
    return f"{int(h)}:{int(m):02d}:{s:05.2f}"


def build_ass(words, start, end, title, dest):
    clip_words = [w for w in words if w["start"] >= start - 0.05 and w["end"] <= end + 0.05]
    cues, cur = [], []
    for w in clip_words:
        if cur and (len(cur) >= MAX_WORDS_PER_CUE
                    or w["start"] - cur[-1]["end"] > CUE_GAP_BREAK):
            cues.append(cur)
            cur = []
        cur.append(w)
        if w["word"] and w["word"][-1] in ".!?":
            cues.append(cur)
            cur = []
    if cur:
        cues.append(cur)

    # Title: white on red box (BorderStyle=3), top of frame, first 5 seconds.
    # Caption: white, heavy black outline, lower third.
    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {OUT_W}
PlayResY: {OUT_H}
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Title,Arial,68,&H00FFFFFF,&H00FFFFFF,&H001A1AC8,&H001A1AC8,-1,0,0,0,100,100,1,0,3,16,0,8,70,70,310,1
Style: Caption,Arial,88,&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,-1,0,0,0,100,100,1,0,1,7,3,2,40,40,420,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    events = []
    if title:
        events.append(
            f"Dialogue: 1,{ass_time(0)},{ass_time(TITLE_SECONDS)},Title,,0,0,0,,"
            f"{{\\fad(150,300)}}{ass_escape(title.upper())}")
    for cue in cues:
        t0 = cue[0]["start"] - start
        t1 = max(cue[-1]["end"] - start, t0 + 0.3)
        text = ass_escape(" ".join(w["word"] for w in cue).upper())
        pop = "{\\fscx80\\fscy80\\t(0,90,\\fscx100\\fscy100)}"
        events.append(f"Dialogue: 0,{ass_time(t0)},{ass_time(t1)},Caption,,0,0,0,,{pop}{text}")
    with open(dest, "w", encoding="utf-8") as f:
        f.write(header + "\n".join(events) + "\n")
    return len(cues)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--video", required=True)
    ap.add_argument("--words", required=True)
    ap.add_argument("--start", type=float, required=True)
    ap.add_argument("--end", type=float, required=True)
    ap.add_argument("--title", "--hook", dest="title", default="",
                    help="title card text, shown first 5s")
    ap.add_argument("--logo", default="", help="PNG overlaid top-left for the whole clip")
    ap.add_argument("--layout", choices=["single", "split"], default="single",
                    help="split = host + guest stacked panels")
    ap.add_argument("--out", required=True)
    ap.add_argument("--no-track", action="store_true", help="center crop, no face tracking")
    args = ap.parse_args()

    with open(args.words, encoding="utf-8") as f:
        words = json.load(f)
    if args.logo and not os.path.exists(args.logo):
        sys.exit(f"logo not found: {args.logo}")
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)

    with tempfile.TemporaryDirectory() as tmp:
        segment = os.path.join(tmp, "segment.mp4")
        cut_segment(args.video, args.start, args.end, segment)
        src_w, src_h = probe_size(segment)

        ass_path = os.path.join(tmp, "subs.ass")
        n_cues = build_ass(words, args.start, args.end, args.title, ass_path)

        samples = None
        if not args.no_track and src_w / src_h > 9 / 16:
            samples = sample_face_centers(segment, src_w, src_h)
            if samples is None:
                print("face tracking unavailable; using static framing", file=sys.stderr)

        if src_w / src_h <= 9 / 16:
            chain = (f"[0:v]scale={OUT_W}:-2,"
                     f"pad={OUT_W}:{OUT_H}:(ow-iw)/2:(oh-ih)/2[base]")
        elif args.layout == "split":
            # host + guest in stacked 1080x960 panels
            panel_h = OUT_H // 2
            crop_w = min(src_w, int(src_h * OUT_W / panel_h) // 2 * 2)
            cx_l, cx_r = two_speaker_centers(samples, src_w)
            xs = [int(min(max(c - crop_w / 2, 0), src_w - crop_w)) for c in (cx_l, cx_r)]
            chain = (f"[0:v]split=2[l][r];"
                     f"[l]crop=w={crop_w}:h={src_h}:x={xs[0]}:y=0,"
                     f"scale={OUT_W}:{panel_h}[top];"
                     f"[r]crop=w={crop_w}:h={src_h}:x={xs[1]}:y=0,"
                     f"scale={OUT_W}:{panel_h}[bot];"
                     f"[top][bot]vstack[base]")
        else:
            crop_w = int(src_h * 9 / 16) // 2 * 2
            init_x = (src_w - crop_w) // 2
            crop = f"crop=w={crop_w}:h={src_h}:x={init_x}:y=0"
            if samples:
                cmd_file = os.path.join(tmp, "crop.cmd")
                write_sendcmd(speaker_path(samples, crop_w, src_w), cmd_file)
                crop = f"sendcmd=f={cmd_file},{crop}"
            chain = f"[0:v]{crop},scale={OUT_W}:{OUT_H}[base]"

        inputs = ["-i", segment]
        if args.logo:
            inputs += ["-i", args.logo]
            chain += (f";[1:v]scale={LOGO_WIDTH}:-1[logo];"
                      f"[base][logo]overlay=40:40[branded]")
            last = "branded"
        else:
            last = "base"
        chain += f";[{last}]ass={ass_path}[vout]"

        run(["ffmpeg", "-y", *inputs, "-filter_complex", chain,
             "-map", "[vout]", "-map", "0:a?",
             "-c:v", "libx264", "-preset", "medium", "-crf", "19",
             "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k",
             "-movflags", "+faststart", args.out])

    print(f"wrote {args.out} ({args.end - args.start:.1f}s, "
          f"{args.layout} layout, {n_cues} caption cues)")


if __name__ == "__main__":
    main()
