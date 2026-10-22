#!/usr/bin/env bash
# Scaffolds a store-screenshot project for reel: reel's types and tsconfig, the bundled
# fonts, the device models asked for (with their credits), lib/ (stage helpers), and a
# starter shots.ts (kept if one exists).
# Usage: init-screenshots.sh <dir> <model>...   (models: s21-ultra iphone-12-pro ipad-pro-12-9 ipad-mini-6)
set -euo pipefail
dest=${1:?usage: init-screenshots.sh <dir> <model>...}
shift
here=$(cd "$(dirname "$0")/.." && pwd)
command -v reel >/dev/null || { echo "reel is not installed: add mobile-dev-deps from github:Hexhound/dev-ai-plugins" >&2; exit 1; }
(($#)) || { echo "name at least one model: $(ls "$here/assets/models" | grep -v NOTICE | tr '\n' ' ')" >&2; exit 1; }
mkdir -p "$dest"/{fonts,models,lib,raw,final}
reel init "$dest" >/dev/null
rm -f "$dest/scene.ts"
cp "$here"/assets/fonts/* "$dest/fonts/"
for m in "$@"; do
  [[ -d $here/assets/models/$m ]] || { echo "no model $m" >&2; exit 1; }
  cp -r "$here/assets/models/$m" "$dest/models/"
done
cp "$here/assets/models/NOTICE.md" "$dest/models/"
cp "$here"/lib/* "$dest/lib/"
if [[ ! -f $dest/shots.ts ]]; then
  sed "s|@MODEL@|$1|" "$here/scripts/shots.ts" > "$dest/shots.ts"
fi
echo "scaffolded $dest: raw/ for the captures, shots.ts for the set, final/ for the PNGs"
echo "next: reel check $dest/shots.ts · reel still $dest/shots.ts --at markers -o $dest/final/"
