#!/usr/bin/env bash
# Scaffolds the Remotion project for a promo: engine lib + config, node_modules from Nix.
# Usage: init-video.sh <promo/video>
set -euo pipefail
dest=$1
here=$(cd "$(dirname "$0")/.." && pwd)
mkdir -p "$dest"
cp -rn "$here/engine/." "$dest/"
cp -r "$here/engine/src/lib/." "$dest/src/lib/"
modules=$(promo-video-node-modules 2>/dev/null || true)
if [[ -n $modules ]]; then
  ln -sfn "$modules" "$dest/node_modules"
else
  echo "promo-video-node-modules not on PATH; falling back to npm install" >&2
  (cd "$dest" && npm install --no-audit --no-fund remotion @remotion/cli react react-dom playwright-core)
fi
echo "scaffolded $dest — write src/Promo.tsx, then run prep-video.sh"
