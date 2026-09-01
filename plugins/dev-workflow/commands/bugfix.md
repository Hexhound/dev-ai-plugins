---
description: Fix a bug systematically — reproduce with a failing test, find root cause, fix minimally, then run the review gate.
argument-hint: [bug description or failing behavior]
---

Invoke the **bugfixing** skill and drive it as a guided flow.

1. Confirm the reported behavior (use `$ARGUMENTS` if given; otherwise ask).
2. Reproduce it as a **failing test**. If you can't reproduce it, keep investigating —
   do not change code yet.
3. Trace to **root cause** and state it in one sentence before proposing a fix.
4. Fix minimally until `./.claude/verify` is green (new test + all existing).
5. Run the **review-gate** skill; reviewer confirms root-cause fix, no regression.

Bug: $ARGUMENTS
