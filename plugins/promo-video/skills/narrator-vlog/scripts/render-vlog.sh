#!/usr/bin/env bash
# Renders a vlog: the composition's sound (narration + music bed) to a WAV, the frames as
# JPEGs, then H.264 at 60 fps with AAC at -14 LUFS (YouTube's level), and the .srt.
#   render-vlog.sh <vlog dir> [out.mp4]     (default <vlog>/out/<vlog name>.mp4)
# Run prep-vlog.sh first. A 2-minute vlog takes about 20-30 minutes on 8 cores (the sound
# pass walks every frame too): run it in the background.
set -euo pipefail
vlog=$(cd "$1" && pwd)
here=$(cd "$(dirname "$0")" && pwd)
video=$vlog/video
out=$(realpath -m "${2:-$vlog/out/$(basename "$vlog").mp4}")
mkdir -p "$(dirname "$out")" "$video/out"
(cd "$video" && npx remotion render src/index.ts Vlog out/audio.wav --codec=wav --log=error)
rm -rf "$video/out/seq"
for attempt in 1 2; do
  (cd "$video" && npx remotion render src/index.ts Vlog out/seq --sequence --image-format=jpeg --jpeg-quality=95 --log=error) && break
  [[ $attempt == 2 ]] && exit 1
done
# -14 LUFS with one fixed gain and a limiter for the peaks it pushes past -2 dB. Not
# single-pass loudnorm: it rides the gain and lifts the music between lines to the voice's
# loudness. The limiter lowers the result when it catches many peaks (a sparse voice over
# quiet music), so the mix is measured again and the gain topped up (by 1.5x the shortfall:
# the limiter eats about half of it), up to four passes.
level() { ffmpeg -hide_banner -nostats -i "$1" -af ebur128 -f null - 2>&1 | awk '$1 == "I:" {i = $2} END {print i}'; }
gain=$(awk -v i="$(level "$video/out/audio.wav")" 'BEGIN {print -14 - i}')
for pass in 1 2 3 4; do
  ffmpeg -loglevel error -y -i "$video/out/audio.wav" \
    -af "volume=${gain}dB,alimiter=limit=0.79:level=false:attack=5:release=80" -ar 48000 "$video/out/mix.wav"
  off=$(awk -v n="$(level "$video/out/mix.wav")" 'BEGIN {d = -14 - n; if (d > 0.5 || d < -0.5) print d}')
  [[ -z $off ]] && break
  gain=$(awk -v g="$gain" -v d="$off" 'BEGIN {print g + 1.5 * d}')
done
ffmpeg -loglevel error -y -framerate 60 -i "$video/out/seq/element-%04d.jpeg" -i "$video/out/mix.wav" \
  -map 0:v -map 1:a -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p -c:a aac -b:a 192k -ar 48000 \
  -shortest -movflags +faststart "$out"
python3 "$here/make-srt.py" "$vlog" > "${out%.mp4}.en.srt"
ffprobe -v error -show_entries format=duration,size -of default=nw=1 "$out"
ffmpeg -hide_banner -nostats -i "$out" -af ebur128=peak=true -f null - 2>&1 | grep -E '^\s+(I|Peak):' | tail -2
