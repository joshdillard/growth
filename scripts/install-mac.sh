#!/bin/bash
# Install the AI UtilityBelt panel into Premiere Pro (macOS).
# Run from the repo root:  bash scripts/install-mac.sh
set -e

EXT_ID="com.aiutilitybelt.panel"
SRC="$(cd "$(dirname "$0")/.." && pwd)/$EXT_ID"
DEST="$HOME/Library/Application Support/Adobe/CEP/extensions/$EXT_ID"

if [ ! -d "$SRC" ]; then
  echo "Could not find $SRC — run this script from inside the repo." >&2
  exit 1
fi

mkdir -p "$(dirname "$DEST")"
rm -rf "$DEST"
cp -R "$SRC" "$DEST"
echo "Copied panel to: $DEST"

# Allow unsigned (development) extensions for every recent CEP runtime.
for v in 9 10 11 12; do
  defaults write "com.adobe.CSXS.$v" PlayerDebugMode 1 2>/dev/null || true
done
killall cfprefsd 2>/dev/null || true
echo "Enabled PlayerDebugMode (unsigned extensions allowed)."

echo ""
echo "Done. Restart Premiere Pro, then open:"
echo "  Window > Extensions > AI UtilityBelt — YouTube Editor"
