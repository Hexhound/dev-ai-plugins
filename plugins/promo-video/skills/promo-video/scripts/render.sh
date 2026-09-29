#!/usr/bin/env bash
# Renders the composition as an image sequence, encodes H.264 and muxes the music section.
# Usage: render.sh <promo/video> <track.mp3|-> <music.json> <out.mp4> [fadeOutSeconds]
set -euo pipefail
video=$1 track=$2 music=$3 out=$(realpath -m "$4") fade=${5:-}
seq=$video/out/seq
rm -rf "$seq"
# Chromium occasionally fails to open its page pool; one retry clears it.
for attempt in 1 2; do
  (cd "$video" && npx remotion render src/index.ts Promo out/seq --sequence --image-format=jpeg --jpeg-quality=95 --log=error) && break
  [[ $attempt == 2 ]] && exit 1
done
frames=$(ls "$seq" | wc -l)
dur=$(jq -n "$frames / 60")
mkdir -p "$(dirname "$out")"
if [[ $track == - ]]; then
  ffmpeg -loglevel error -y -framerate 60 -i "$seq/element-%04d.jpeg" -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p -movflags +faststart "$out"
else
  start=$(jq .start "$music")
  fade=${fade:-$(jq '.beat * 4' "$music")}
  ffmpeg -loglevel error -y -framerate 60 -i "$seq/element-%04d.jpeg" -ss "$start" -t "$dur" -i "$track" \
    -filter_complex "[1:a]afade=t=in:d=0.25,afade=t=out:st=$(jq -n "$dur - $fade"):d=$fade,loudnorm=I=-14:TP=-1.5:LRA=11[a]" \
    -map 0:v -map "[a]" -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p -c:a aac -b:a 192k -ar 48000 -shortest -movflags +faststart "$out"
fi
ffprobe -v error -show_entries format=duration,size -of default=nw=1 "$out"
