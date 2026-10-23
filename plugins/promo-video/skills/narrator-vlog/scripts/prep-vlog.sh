#!/usr/bin/env bash
# Copies a vlog's material into its Remotion project (<vlog>/video):
#   - capture/<clip>/NNNN.png -> public/capture/<clip>/NNNN.jpg (at most 1920x1080), except
#     *_xray clips (raw overdraw; the video uses their heat maps from heat-xray.py);
#   - derived.txt crops: "<name> <source clip> <WxH+X+Y>" per line, cut from the full-size
#     PNGs (sharper than zooming into the 1080p JPEGs), 16:9, scaled to 1920x1080;
#   - src/data/frames.json (frames per clip), lines.json (voice/), timing.json;
#   - voice/*.wav -> public/voice/, and everything in assets/ (music, font, pointer, logo)
#     -> public/.
#   prep-vlog.sh <vlog dir> [clip ...]   (only those clips; "none" for data and assets only)
set -euo pipefail
vlog=$(cd "$1" && pwd); shift
video=$vlog/video
pub=$video/public
mkdir -p "$pub/capture" "$pub/voice" "$video/src/data"
PICK=("$@")
for dir in "$vlog"/capture/*/; do
  [[ -d $dir ]] || continue
  name=$(basename "$dir")
  [[ $name == *_xray ]] && continue
  if [[ ${#PICK[@]} -gt 0 && " ${PICK[*]} " != *" $name "* ]]; then continue; fi
  rm -rf "$pub/capture/$name" && mkdir -p "$pub/capture/$name"
  find "$dir" -maxdepth 1 -name '*.png' -printf '%f\n' | sed 's/\.png$//' |
    xargs -P "$(nproc)" -I{} magick "$dir/{}.png" -resize '1920x1080>' -quality 90 "$pub/capture/$name/{}.jpg"
done
if [[ -f $vlog/derived.txt ]]; then
  # `|| [[ -n $name ]]`: the last line counts without a newline after it too.
  while read -r name source crop || [[ -n $name ]]; do
    [[ -z $name || $name == \#* ]] && continue
    if [[ ${#PICK[@]} -gt 0 && " ${PICK[*]} " != *" $name "* ]]; then continue; fi
    rm -rf "$pub/capture/$name" && mkdir -p "$pub/capture/$name"
    find "$vlog/capture/$source" -maxdepth 1 -name '*.png' -printf '%f\n' | sed 's/\.png$//' |
      xargs -P "$(nproc)" -I{} magick "$vlog/capture/$source/{}.png" -crop "$crop" +repage -resize 1920x1080 -quality 92 "$pub/capture/$name/{}.jpg"
  done < "$vlog/derived.txt"
fi
python3 - "$pub/capture" "$video/src/data/frames.json" <<'PY'
import json, os, sys
root, out = sys.argv[1], sys.argv[2]
counts = {n: len([f for f in os.listdir(os.path.join(root, n)) if f.endswith(".jpg")]) for n in sorted(os.listdir(root))}
json.dump(counts, open(out, "w"), indent=1)
print(len(counts), "clips")
PY
cp "$vlog/voice/lines.json" "$video/src/data/lines.json"
cp "$vlog/timing.json" "$video/src/data/timing.json"
cp "$vlog"/voice/*.wav "$pub/voice/"
[[ -d $vlog/assets ]] && cp -r "$vlog/assets/." "$pub/"
echo "prepared $video"
