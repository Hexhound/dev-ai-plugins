#!/usr/bin/env bash
# The app's own sound effects under the music. Renders the composition's audio alone (its
# <Sequence><Audio/></Sequence> cues placed on the capture markers) to out/sfx.wav, then mixes
# it with the music section (music.json's start): the music fades in, fades out over the last
# bar, and is ducked a few dB under each effect (sidechain). Writes out/mix.wav and
# out/mix.json (the same grid, start 0) for render.sh:
#   mix-sfx.sh <promo/video> <track> <music.json> [sfxGainDb]
#   render.sh <promo/video> <promo/video>/out/mix.wav <promo/video>/out/mix.json <out.mp4> 0.3
# sfxGainDb (default 8) raises every effect; set each cue's own level with its <Audio volume>.
# The composition is `Promo` at 60 fps (the engine's defaults).
set -euo pipefail
. "$(dirname "$0")/browser.sh"
video=$(realpath "$1") track=$(realpath "$2") music=$(realpath "$3") gain=${4:-8}
(cd "$video" && npx remotion render src/index.ts Promo out/sfx.wav --codec=wav --log=error)
# The composition's length (the effects can end early, on their last sound).
frames=$(cd "$video" && npx remotion compositions src/index.ts 2>/dev/null | awk '$1 == "Promo" {print $4}')
dur=$(jq -n "$frames / 60")
start=$(jq .start "$music")
fade=$(jq '.beat * 4' "$music")
ffmpeg -loglevel error -y -ss "$start" -t "$dur" -i "$track" -i "$video/out/sfx.wav" -filter_complex "
  [0:a]aresample=48000,afade=t=in:d=0.25,afade=t=out:st=$(jq -n "$dur - $fade"):d=$fade[m];
  [1:a]apad,volume=${gain}dB,asplit[s][key];
  [m][key]sidechaincompress=threshold=0.08:ratio=2:attack=5:release=220[duck];
  [duck][s]amix=inputs=2:normalize=0:duration=first[a]" -map "[a]" -c:a pcm_s24le "$video/out/mix.wav"
jq '.start = 0' "$music" > "$video/out/mix.json"
echo "$video/out/mix.wav ($dur s)"
