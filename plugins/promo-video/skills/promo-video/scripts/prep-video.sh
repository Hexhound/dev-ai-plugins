#!/usr/bin/env bash
# Copies captures (as JPEG), capture/music metadata and promo/assets into the Remotion project.
# Usage: prep-video.sh <promo dir>
set -euo pipefail
promo=$1 video=$1/video
mkdir -p "$video/public/capture" "$video/src/data"
for seg in "$promo"/capture/*/; do
  name=$(basename "$seg")
  rm -rf "$video/public/capture/$name" && mkdir -p "$video/public/capture/$name"
  find "$seg" -maxdepth 1 -name '*.png' -printf '%f\n' | sed 's/\.png$//' |
    xargs -P "$(nproc)" -I{} magick "$seg/{}.png" -quality 92 "$video/public/capture/$name/{}.jpg"
  cp "$seg/capture.json" "$video/src/data/$name.json"
done
[[ -f $promo/music/music.json ]] && cp "$promo/music/music.json" "$video/src/data/music.json"
[[ -d $promo/assets ]] && cp -r "$promo/assets/." "$video/public/"
[[ -d $promo/data ]] && cp -r "$promo/data/." "$video/src/data/"
echo "prepared $(ls "$video/public/capture" | wc -l) segment(s)"
