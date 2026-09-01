---
name: refactoring
description: Use when changing code structure without changing behavior — pins behavior with tests first, refactors incrementally, and proves invariance through the verify gate.
---

# Refactoring

Behavior-preserving change. Tests are your proof of invariance.

## Golden rule

If the code you're about to move isn't covered by tests, **step 1 is adding
characterization tests** — not refactoring. Prove they pass on the *unchanged* code first.

## Steps

1. **Pin behavior.** Map the target and its existing test coverage. If coverage is
   insufficient to prove behavior is preserved, add characterization tests and show them
   green on the current code. Stop for approval on the refactor plan.
2. **Refactor incrementally**, small steps. After each step the deterministic gate stays
   green with the **same** tests. Do not edit tests to make them pass.
3. **Gate 1:** `./.claude/verify` green — same tests passing = behavior preserved.
4. **Gate 2:** `review-gate` skill, telling the reviewer the invariant is *"behavior and
   public API are unchanged."*

## Rules

- No behavior change. No public-API change unless explicitly requested.
- Keep it simple; the goal is less code / clearer structure, not more abstraction.
