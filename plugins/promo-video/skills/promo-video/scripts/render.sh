#!/usr/bin/env bash
# Renders the composition as an image sequence, encodes H.264 and muxes the music section.
# Usage: render.sh <promo/video> <track.mp3|-> <music.json> <out.mp4> [fadeOutSeconds]
set -euo pipefail
# (chrome-headless-shell, not chromium: see engine/remotion.config.ts)
export CHROMIUM=${CHROMIUM:-$(command -v chrome-headless-shell)}
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
# Chromium's JPEGs are BT.601 full range: convert to BT.709 limited range and tag it, or
# players read the pixels as limited range (crushed blacks, clipped whites).
v709=(-vf "scale=in_range=pc:out_range=tv:in_color_matrix=bt601:out_color_matrix=bt709,format=yuv420p,setparams=range=tv:colorspace=bt709:color_primaries=bt709:color_trc=bt709"
  -c:v libx264 -preset slow -crf 16 -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv)
if [[ $track == - ]]; then
  ffmpeg -nostdin -loglevel error -y -framerate 60 -i "$seq/element-%04d.jpeg" "${v709[@]}" -movflags +faststart "$out"
else
  start=$(jq .start "$music")
  fade=${fade:-$(jq '.beat * 4' "$music")}
  ffmpeg -nostdin -loglevel error -y -framerate 60 -i "$seq/element-%04d.jpeg" -ss "$start" -t "$dur" -i "$track" \
    -filter_complex "[1:a]afade=t=in:d=0.25,afade=t=out:st=$(jq -n "$dur - $fade"):d=$fade,loudnorm=I=-14:TP=-1.5:LRA=11[a]" \
    -map 0:v -map "[a]" "${v709[@]}" -c:a aac -b:a 192k -ar 48000 -shortest -movflags +faststart "$out"
fi
ffprobe -v error -show_entries format=duration,size -of default=nw=1 "$out"
