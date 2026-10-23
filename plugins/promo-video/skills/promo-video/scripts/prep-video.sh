#!/usr/bin/env bash
# Copies captures (as JPEG), capture/music metadata and promo/assets into the Remotion project.
# Usage: prep-video.sh <promo dir> [segment ...]   (default: every segment)
# Each segment and each asset entry is replaced, so frames or files removed since the last
# run don't linger in the project (a re-shot segment can have fewer frames).
set -euo pipefail
promo=$1 video=$1/video
shift
mkdir -p "$video/public/capture" "$video/src/data"
for seg in "$promo"/capture/*/; do
  name=$(basename "$seg")
  if [[ $# -gt 0 && " $* " != *" $name "* ]]; then continue; fi
  rm -rf "$video/public/capture/$name" && mkdir -p "$video/public/capture/$name"
  find "$seg" -maxdepth 1 -name '*.png' -printf '%f\n' | sed 's/\.png$//' |
    xargs -P "$(nproc)" -I{} magick "$seg/{}.png" -quality 92 "$video/public/capture/$name/{}.jpg"
  cp "$seg/capture.json" "$video/src/data/$name.json"
done
[[ -f $promo/music/music.json ]] && cp "$promo/music/music.json" "$video/src/data/music.json"
if [[ -d $promo/assets ]]; then
  for entry in "$promo"/assets/*; do rm -rf "$video/public/$(basename "$entry")"; done
  cp -r "$promo/assets/." "$video/public/"
fi
[[ -d $promo/data ]] && cp -r "$promo/data/." "$video/src/data/"
echo "prepared $(ls "$video/public/capture" | wc -l) segment(s)"
