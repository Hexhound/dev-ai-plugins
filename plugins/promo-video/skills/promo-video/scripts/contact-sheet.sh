#!/usr/bin/env bash
# One image to look at: a video sampled every N seconds, or a capture segment's frames.
# Usage: contact-sheet.sh <video.mp4 | capture/segment dir> <out.jpg> [everySeconds|count]
set -euo pipefail
src=$1 out=$2 n=${3:-}
if [[ -d $src ]]; then
  total=$(find "$src" -maxdepth 1 -name '*.png' | wc -l)
  count=${n:-16}
  step=$(( (total + count - 1) / count ))
  mapfile -t picks < <(find "$src" -maxdepth 1 -name '*.png' | sort | awk -v s="$step" 'NR % s == 1')
  magick montage "${picks[@]}" -geometry 600x+3+3 -tile 4x -set label '%t' "$out"
else
  every=${n:-1.5}
  ffmpeg -loglevel error -y -i "$src" -vf "fps=1/$every,scale=480:-1,tile=6x5" -frames:v 1 "$out"
fi
echo "$out"
