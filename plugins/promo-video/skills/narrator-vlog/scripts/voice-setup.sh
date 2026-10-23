#!/usr/bin/env bash
# Sets up the narrator voice once per machine: Kokoro-82M (Apache 2.0) through kokoro-onnx
# (MIT), offline, on the CPU. A Python venv and the model files (about 350 MB) go in
# $KOKORO_HOME (default ~/.cache/kokoro). Prints the venv's python for the other scripts.
#   voice-setup.sh
set -euo pipefail
home=${KOKORO_HOME:-$HOME/.cache/kokoro}
mkdir -p "$home"
if [[ ! -x $home/venv/bin/python ]]; then
  python3 -m venv "$home/venv"
fi
# kokoro-onnx is pinned: kokoro_voice.py replaces one of its private methods, written against
# 0.4.7 (tested with onnxruntime 1.31). Pillow is for heat-xray.py.
"$home/venv/bin/pip" install -q --disable-pip-version-check kokoro-onnx==0.4.7 \
  'onnxruntime>=1.20.1,<1.32' soundfile numpy pillow
# The model-files-v1.1 release (its kokoro-v1.0.onnx is not the one in model-files-v1.0),
# checked against the sha256 GitHub lists for each file. A cut download stays in .part.
url=https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.1
sha() { if command -v sha256sum >/dev/null; then sha256sum "$1"; else shasum -a 256 "$1"; fi | cut -d' ' -f1; }
while read -r sum f; do
  [[ -s $home/$f ]] && continue
  curl -fL --retry 3 -o "$home/$f.part" "$url/$f"
  [[ $(sha "$home/$f.part") == "$sum" ]] || { echo "$f: checksum mismatch ($home/$f.part)" >&2; exit 1; }
  mv "$home/$f.part" "$home/$f"
done <<'EOF'
beb0d1848dee9a49da392cc3df26958d46cfa35d321edf434f52949153f0df3a kokoro-v1.0.onnx
bca610b8308e8d99f32e6fe4197e7ec01679264efed0cac9140fe9c29f1fbf7d voices-v1.0.bin
EOF
echo "$home/venv/bin/python"
