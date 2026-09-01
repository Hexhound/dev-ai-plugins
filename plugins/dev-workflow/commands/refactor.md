---
description: Refactor without changing behavior — pin behavior with tests first, refactor incrementally, prove invariance through the verify gate.
argument-hint: [target module/function + goal]
---

Invoke the **refactoring** skill and drive it as a guided flow.

1. Confirm the target and goal (use `$ARGUMENTS` if given; otherwise ask). Restate the
   invariant: what behavior and public API must NOT change.
2. Map current behavior and existing test coverage. If coverage can't prove behavior is
   preserved, propose characterization tests first and show them green on the CURRENT
   code. Propose the refactor plan and **stop for my OK**.
3. Refactor incrementally; `./.claude/verify` stays green with the SAME tests after each
   step. Do not edit tests to make them pass.
4. Run the **review-gate** skill; tell the reviewer the invariant is "behavior and public
   API unchanged."

Target + goal: $ARGUMENTS
