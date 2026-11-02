#!/usr/bin/env bash
# Drives Google's web consoles (AdMob, Play Console) in a visible Chromium the
# developer signs into themselves; Playwright attaches over the DevTools port.
#
#   console_browser.sh launch [url...]          start (or reuse) the browser; default
#                                               opens AdMob and Play Console
#   console_browser.sh status                   is it up, which tabs are open
#   console_browser.sh run <tab> <step.js> [..] run a step script against the first tab
#                                               whose URL contains <tab> (or a new tab)
#   console_browser.sh stop                     close the browser (the login stays in
#                                               the profile for next time)
#
# CONSOLE_BROWSER_PORT (9222), CONSOLE_BROWSER_HOME (~/.cache/console-browser) and
# CONSOLE_BROWSER_PROFILE ($HOME/profile) override the defaults.
set -euo pipefail

PORT="${CONSOLE_BROWSER_PORT:-9222}"
HOME_DIR="${CONSOLE_BROWSER_HOME:-$HOME/.cache/console-browser}"
PROFILE="${CONSOLE_BROWSER_PROFILE:-$HOME_DIR/profile}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export CONSOLE_BROWSER_PORT="$PORT" CONSOLE_BROWSER_HOME="$HOME_DIR"

chromium_bin() {
  for b in chromium chromium-browser google-chrome google-chrome-stable; do
    if command -v "$b" >/dev/null; then command -v "$b"; return; fi
  done
  echo "No Chromium or Chrome on PATH." >&2
  exit 1
}

cdp_up() {
  node -e "fetch('http://127.0.0.1:$PORT/json/version').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
}

# playwright-core only (no bundled browsers): it attaches to the real Chromium.
ensure_playwright() {
  if [ ! -d "$HOME_DIR/node_modules/playwright-core" ]; then
    mkdir -p "$HOME_DIR"
    (cd "$HOME_DIR" && { [ -f package.json ] || npm init -y >/dev/null; } &&
      npm install --silent playwright-core >/dev/null)
  fi
}

case "${1:-}" in
  launch)
    shift
    ensure_playwright
    if cdp_up; then
      echo "browser already up on :$PORT"
      exit 0
    fi
    mkdir -p "$PROFILE"
    urls=("$@")
    [ ${#urls[@]} -eq 0 ] && urls=("https://admob.google.com/" "https://play.google.com/console/")
    # Started like a normal browser, not by Playwright: Google refuses sign-in in
    # automation-launched browsers ("This browser or app may not be secure").
    setsid nohup "$(chromium_bin)" --remote-debugging-port="$PORT" \
      --user-data-dir="$PROFILE" --no-first-run --no-default-browser-check \
      "${urls[@]}" >"$HOME_DIR/browser.log" 2>&1 </dev/null &
    for _ in $(seq 1 40); do cdp_up && break; sleep 0.5; done
    if cdp_up; then
      echo "browser up on :$PORT (profile $PROFILE)"
    else
      echo "The browser did not start; see $HOME_DIR/browser.log" >&2
      exit 1
    fi
    ;;
  status)
    if ! cdp_up; then echo "browser not running on :$PORT"; exit 1; fi
    ensure_playwright
    NODE_PATH="$HOME_DIR/node_modules" node "$HERE/run.js" --tabs
    ;;
  run)
    shift
    [ $# -ge 2 ] || { echo "usage: $0 run <tab-url-substring> <step.js> [args...]" >&2; exit 2; }
    cdp_up || { echo "browser not running; run: $0 launch" >&2; exit 1; }
    ensure_playwright
    NODE_PATH="$HOME_DIR/node_modules" node "$HERE/run.js" "$@"
    ;;
  stop)
    cdp_up || { echo "browser not running"; exit 0; }
    ensure_playwright
    NODE_PATH="$HOME_DIR/node_modules" node "$HERE/run.js" --stop
    ;;
  *)
    sed -n '2,17p' "$0"
    exit 2
    ;;
esac
