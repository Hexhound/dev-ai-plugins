---
name: bugfixing
description: Use when fixing a bug or investigating unexpected behavior — reproduce with a failing test first, find root cause before touching code, then fix and gate. No guessing.
---

# Bug Fixing

Systematic, not guess-and-check.

## Steps

1. **Reproduce as a failing test.** Encode the bug as an automated test that fails on the
   current code. If you can't reproduce it, you don't understand it yet — keep
   investigating before changing anything.
2. **Find root cause, not symptom.** Trace to the actual defect. State the cause in one
   sentence before proposing a fix.
3. **Fix minimally.** Change the least code that makes the failing test pass without
   breaking others. While iterating, run only the **fast** check — compile + the tests around
   this bug (`mix compile --warnings-as-errors && mix test <the test file>`), not the whole
   suite.
4. **Gate 1 (full, once):** when the fix settles, run `./.claude/verify` — full suite +
   linters — to confirm no regression anywhere and no new warnings.
5. **Gate 2:** `review-gate` skill — reviewer confirms the fix addresses the root cause and
   adds no regression.

## Rules

- No speculative fixes. If unsure of the cause, instrument and observe — don't patch
  blindly.
- The failing-then-passing test stays in the suite as a regression guard.
