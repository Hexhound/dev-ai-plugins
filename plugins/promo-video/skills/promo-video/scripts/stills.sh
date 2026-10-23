#!/usr/bin/env bash
# Renders stills at the given seconds and tiles them into one sheet to look at.
# Usage: [COMPOSITION=Promo] [JOBS=4] stills.sh <video project> <sheet.jpg> <t1> [t2 ...]
# Each still bundles the project again (about 25 s): JOBS run at once. The narrator-vlog
# skill uses COMPOSITION=Vlog.
set -euo pipefail
. "$(dirname "$0")/browser.sh"
video=$1 sheet=$(realpath -m "$2"); shift 2
export COMPOSITION=${COMPOSITION:-Promo}
cd "$video" && rm -rf out/stills && mkdir -p out/stills
printf '%s\n' "$@" | xargs -P "${JOBS:-4}" -I{} sh -c \
  'npx remotion still src/index.ts "$COMPOSITION" "out/stills/$(printf %08.3f "$1").png" --frame="$(awk "BEGIN{print int($1*60)}")" --log=error >/dev/null || echo "still at $1 s failed" >&2' _ {}
magick montage out/stills/*.png -geometry 640x360+3+3 -tile 4x -font DejaVu-Sans -pointsize 18 -set label '%t' "$sheet"
echo "$sheet"
