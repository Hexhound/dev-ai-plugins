#!/usr/bin/env bash
# Scaffolds a promo's reel project: reel's types and tsconfig, the engine lib, a starter
# promo.ts (kept if one exists).
# Usage: init-reel.sh <promo/video>
set -euo pipefail
dest=$1
here=$(cd "$(dirname "$0")/.." && pwd)
command -v reel >/dev/null || { echo "reel is not installed: add promo-video-deps from github:Hexhound/dev-ai-plugins" >&2; exit 1; }
mkdir -p "$dest"
reel init "$dest" >/dev/null
rm -f "$dest/scene.ts"
mkdir -p "$dest/lib"
cp -r "$here/engine-reel/lib/." "$dest/lib/"
[[ -f $dest/promo.ts ]] || cp "$here/engine-reel/promo.ts" "$dest/promo.ts"
echo "scaffolded $dest: write promo.ts for the storyboard (demo: $here/engine-reel/demo.ts)"
