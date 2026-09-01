#!/usr/bin/env bash
# Stop hook: block turn-end until the project's verify gate passes.
#
# The gate command is the REPO's own executable `./.claude/verify` script, so this hook
# stays language-neutral — an Elixir repo drops `exec mix precommit`, Go `exec go test
# ./...`, Node `exec npm test`, etc. No `./.claude/verify` -> no gate -> allow.
#
# Reads the Stop hook payload as JSON on stdin (fields used: .stop_hook_active).
# On failure it emits {"decision":"block","reason":...} so Claude keeps fixing; it caps
# consecutive blocks per project dir so a permanently-red repo can never wedge the session.
# Fails OPEN: any missing dependency or parse error -> allow (exit 0).

set -uo pipefail

MAX_BLOCKS=5

payload="$(cat)"

# Fail open if jq is unavailable (e.g. devenv shell not yet reloaded).
command -v jq >/dev/null 2>&1 || exit 0

# No gate defined for this repo -> nothing to enforce.
[ -x ./.claude/verify ] || exit 0

# Per-project block counter, keyed by cwd so parallel projects don't share state.
key="$(pwd | cksum | tr -d ' \t')"
counter="${TMPDIR:-/tmp}/verify-gate.${key}.count"

# Gate passes -> reset counter and allow.
if ./.claude/verify >"${TMPDIR:-/tmp}/verify-gate.log" 2>&1; then
  rm -f "$counter"
  exit 0
fi

# Gate failed. Bump the counter; once we've blocked MAX_BLOCKS times, let the turn end
# anyway (with a warning) rather than loop forever on an unfixable failure.
n=0
[ -f "$counter" ] && n="$(cat "$counter" 2>/dev/null || echo 0)"
n=$((n + 1))
printf '%s' "$n" >"$counter"

tail="$(tail -n 40 "${TMPDIR:-/tmp}/verify-gate.log" 2>/dev/null || true)"

if [ "$n" -ge "$MAX_BLOCKS" ]; then
  rm -f "$counter"
  printf 'verify gate still failing after %s attempts — letting the turn end. Fix required:\n%s\n' \
    "$MAX_BLOCKS" "$tail" >&2
  exit 0
fi

jq -nc --arg r "Verify gate failed (attempt ${n}/${MAX_BLOCKS}) — do not end the turn on red. Fix the failures, then stop again. Last 40 lines of ./.claude/verify output:
${tail}" '{decision:"block", reason:$r}'
exit 0
