#!/usr/bin/env bash
# Renders stills at the given seconds and tiles them into one sheet to look at.
# Usage: stills.sh <promo/video> <sheet.jpg> <t1> [t2 ...]
set -euo pipefail
video=$1 sheet=$(realpath -m "$2"); shift 2
cd "$video" && rm -rf out/stills && mkdir -p out/stills
for t in "$@"; do
  npx remotion still src/index.ts Promo "out/stills/$(printf '%08.3f' "$t").png" --frame="$(awk "BEGIN{print int($t*60)}")" --log=error
done
magick montage out/stills/*.png -geometry 640x360+3+3 -tile 4x -font DejaVu-Sans -pointsize 18 -set label '%t' "$sheet"
echo "$sheet"
