#!/usr/bin/env bash
# Downloads a track and fits it to the video: music.json (tempo grid, start offset) + preview.mp3.
# Usage: music-prepare.sh <url|file> <out-dir> <videoSeconds> <anchorSeconds>
#   anchorSeconds: when the first scene change should land on a downbeat.
set -euo pipefail
src=$1 out=$2 video=$3 anchor=$4
here=$(cd "$(dirname "$0")" && pwd)
mkdir -p "$out"
if [[ $src == http* ]]; then curl -sfL -o "$out/track.mp3" "$src"; else cp "$src" "$out/track.mp3"; fi
ffmpeg -loglevel error -y -i "$out/track.mp3" -ac 1 -ar 44100 "$out/track.wav"
aubiotrack -i "$out/track.wav" > "$out/track.beats"
ffmpeg -hide_banner -nostats -i "$out/track.wav" -af ebur128=metadata=1,ametadata=print:key=lavfi.r128.S -f null - 2>&1 |
  grep -oE 'lavfi.r128.S=-?[0-9.]+' | cut -d= -f2 > "$out/track.loud"
node "$here/music-analyze.mjs" "$out/track.beats" "$out/track.loud" "$video" "$anchor" > "$out/music.json"
start=$(jq .start "$out/music.json")
ffmpeg -loglevel error -y -ss "$start" -t "$video" -i "$out/track.mp3" \
  -af "afade=t=in:d=0.25,afade=t=out:st=$(jq -n "$video - 3"):d=3,loudnorm=I=-14:TP=-1.5" "$out/preview.mp3"
rm -f "$out/track.wav"
jq -c '{bpm, start, bodyLufs, jitter}' "$out/music.json"
