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
"$home/venv/bin/pip" install -q -U --disable-pip-version-check kokoro-onnx soundfile numpy
for f in kokoro-v1.0.onnx voices-v1.0.bin; do
  [[ -s $home/$f ]] || curl -fL --retry 3 -o "$home/$f" "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.1/$f"
done
echo "$home/venv/bin/python"
