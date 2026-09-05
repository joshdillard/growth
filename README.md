# AIUTILITYBELT — video pipeline

Programmatic video editing: **HyperFrames** authors motion-graphics scenes as
HTML/CSS/GSAP, **Remotion** assembles them with the source footage into a final MP4.

## Layout

| Path | Purpose |
| --- | --- |
| `assembly/` | Remotion project — timeline assembly and final encode |
| `scenes/` | HyperFrames project — HTML/GSAP scenes (created per source video) |
| `media/` | Source footage (gitignored) |

## Pipeline

1. **Ingest** — drop the source video in `media/`.
2. **Transcribe + scaffold scenes** — HyperFrames reads the video and builds a
   scene project with word-level timestamps:
   ```bash
   npx hyperframes init scenes --video media/source.mp4 --non-interactive \
     --resolution portrait --tailwind
   ```
3. **Author scenes** — edit the HTML/CSS in `scenes/`, preview with
   `npx hyperframes preview`, render with `npx hyperframes render`.
4. **Assemble** — reference the source footage and rendered scenes from a
   Remotion composition in `assembly/src/`, then:
   ```bash
   cd assembly && ./render.sh <CompositionId> ../out/final.mp4
   ```

## Container notes

Remotion needs an explicit Chrome binary here; `assembly/render.sh` passes the
preinstalled Chromium headless shell and `--gl=swangle` (software rendering).
`@remotion/renderer` ships its own FFmpeg, so no system FFmpeg is required.

Verified working: Node 22.22, Remotion 4.0.520, HyperFrames CLI 0.8.29.
