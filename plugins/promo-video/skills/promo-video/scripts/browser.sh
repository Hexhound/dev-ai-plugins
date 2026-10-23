# Sourced by the render scripts: sets CHROMIUM, the browser Remotion renders with.
# - chrome-headless-shell, not chromium: see engine/remotion.config.ts.
# - Remotion starts it with --disable-dev-shm-usage, so its shared memory goes to files in
#   TMPDIR: on a disk that's ~15 MB/s a tab, and the render waits on the disk. A wrapper
#   gives the browser alone a TMPDIR (and disk cache) in RAM; Remotion's bundle stays where
#   it was, since it copies the whole of public/ (the captures) into it. The wrapper's name
#   keeps "headless-shell", which is how the config tells the mode.
# - Without chrome-headless-shell (no Nix deps), CHROMIUM stays empty and Remotion uses its
#   own browser; `|| true` keeps `set -e` in the sourcing script from exiting on it silently.
CHROMIUM=${CHROMIUM:-$(command -v chrome-headless-shell || true)}
if [[ -n $CHROMIUM && -d /dev/shm ]]; then
  browser_tmp=$(mktemp -d /dev/shm/remotion-browser-XXXXXX)
  trap 'rm -rf "$browser_tmp"' EXIT
  printf '#!/bin/sh\nTMPDIR=%s exec %s --disk-cache-dir=%s/cache "$@"\n' \
    "$browser_tmp" "$CHROMIUM" "$browser_tmp" > "$browser_tmp/chrome-headless-shell"
  chmod +x "$browser_tmp/chrome-headless-shell"
  CHROMIUM=$browser_tmp/chrome-headless-shell
fi
export CHROMIUM
