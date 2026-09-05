#!/usr/bin/env bash
# Render a Remotion composition using the container's preinstalled Chromium.
# Usage: ./render.sh <CompositionId> <output.mp4> [extra remotion flags...]
set -euo pipefail

COMP="${1:?composition id required}"
OUT="${2:?output path required}"
shift 2

CHROME="${REMOTION_BROWSER_EXECUTABLE:-/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell}"

exec npx remotion render src/index.ts "$COMP" "$OUT" \
  --browser-executable="$CHROME" \
  --gl=swangle \
  "$@"
