---
description: Build a new feature the low-token way — brainstorm criteria, plan in-session, implement test-first, then run the review gate.
argument-hint: [short feature description]
---

Invoke the **feature-development** skill and drive it as a guided flow.

1. Confirm what we're building (use `$ARGUMENTS` if given; otherwise ask). Establish
   **acceptance criteria** explicitly — these become the reviewer's checklist.
2. Dispatch the read-only `scout` subagent (Sonnet) to explore the codebase and return a
   compact brief (files to touch, conventions, integration points, gotchas). Skip only if
   the change's location is already obvious. Do NOT let the scout plan — it gathers facts.
3. Using the brief and the installed conventions skill (or `docs/guidelines.md`), propose a
   short plan (files, new modules, tests, open decisions) and **stop for my OK**.
4. Implement test-first until `./.claude/verify` is green. Do not claim done on red.
5. Run the **review-gate** skill (fresh-context `code-reviewer`). Triage, fix, re-verify.

Follow the skill's rules exactly. Keep planning and implementation in THIS session — offload
only *exploration* (the scout), never the planning or building.

Feature: $ARGUMENTS
