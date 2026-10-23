#!/usr/bin/env bash
# Scaffolds a vlog's Remotion project: promo-video's config, the narrator-vlog engine
# (src/vlog) and the template composition (src/Vlog.tsx, look.ts, Thumbnail.tsx). Existing
# files are kept, except the engine, which is refreshed. node_modules comes from Nix
# (promo-video-node-modules), or $NODE_MODULES (an existing Remotion 4 node_modules), or npm.
#   init-vlog.sh <vlog dir>        (the project goes in <vlog dir>/video)
set -euo pipefail
vlog=$1
here=$(cd "$(dirname "$0")/.." && pwd)
promo=$(cd "$here/../promo-video" && pwd)
dest=$vlog/video
mkdir -p "$dest/src/data" "$dest/public"
# Kept if there: a test, not `cp -n` (which exits 1 on a skipped file in some coreutils).
for f in "$promo/engine/remotion.config.ts" "$promo/engine/tsconfig.json"; do
  [[ -e $dest/${f##*/} ]] || cp "$f" "$dest/"
done
[[ -f $dest/package.json ]] || printf '{\n  "name": "vlog",\n  "private": true,\n  "scripts": {"studio": "remotion studio src/index.ts"}\n}\n' > "$dest/package.json"
rm -rf "$dest/src/vlog" && cp -r "$here/engine/src/vlog" "$dest/src/vlog"
for f in "$here/engine/template/"*; do
  [[ -e $dest/src/${f##*/} ]] || cp "$f" "$dest/src/"
done
modules=$(promo-video-node-modules 2>/dev/null || true)
modules=${NODE_MODULES:-$modules}
if [[ -n $modules ]]; then
  ln -sfn "$modules" "$dest/node_modules"
elif [[ ! -e $dest/node_modules ]]; then
  echo "promo-video-node-modules not on PATH; falling back to npm install" >&2
  (cd "$dest" && npm install --no-audit --no-fund remotion @remotion/cli react react-dom)
fi
echo "scaffolded $dest: edit src/look.ts and src/Vlog.tsx, then run prep-vlog.sh"
