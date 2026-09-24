#!/usr/bin/env bash
# Screenshots a page with headless chromium.
# Usage: shot.sh <url-or-file> <out.png> [width] [height] [virtual-time-ms]
set -euo pipefail

url="$1"
out="$2"
width="${3:-1440}"
height="${4:-900}"
budget="${5:-6000}"

browser="$(command -v chromium || command -v chromium-browser || command -v google-chrome || true)"
if [[ -z "$browser" ]]; then
  echo "no chromium or chrome on PATH" >&2
  exit 1
fi

"$browser" --headless=new --no-sandbox --disable-gpu --hide-scrollbars \
  --virtual-time-budget="$budget" --window-size="$width,$height" \
  --screenshot="$out" "$url" 2>/dev/null
echo "$out"
