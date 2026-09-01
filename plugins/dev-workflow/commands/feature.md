---
description: Build a new feature the low-token way — brainstorm criteria, plan in-session, implement test-first, then run the review gate.
argument-hint: [short feature description]
---

Invoke the **feature-development** skill and drive it as a guided flow.

1. Confirm what we're building (use `$ARGUMENTS` if given; otherwise ask). Establish
   **acceptance criteria** explicitly — these become the reviewer's checklist.
2. Read the relevant code and the installed conventions skill (or `docs/guidelines.md`).
   Propose a short plan (files, new modules, tests, open decisions) and **stop for my OK**.
3. Implement test-first until `./.claude/verify` is green. Do not claim done on red.
4. Run the **review-gate** skill (fresh-context `code-reviewer`). Triage, fix, re-verify.

Follow the skill's rules exactly. Keep planning and implementation in THIS session — do
not spawn separate planner/implementer agents.

Feature: $ARGUMENTS
