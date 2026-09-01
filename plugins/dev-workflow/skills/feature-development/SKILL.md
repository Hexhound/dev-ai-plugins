---
name: feature-development
description: Use when adding new functionality to a project — a plan-in-session, test-first workflow that ends at the review gate. Language-neutral; pairs with a per-stack conventions skill if one is installed.
---

# Building a New Feature

Do the whole thing in ONE session (planning + implementation share context — don't split
them into separate agents).

## Steps

1. **Brainstorm intent, not code.** Nail down acceptance criteria first — they are also
   the reviewer's checklist. If the goal is fuzzy, ask. (~42% of failures are fuzzy specs.)
2. **Plan in-session and stop for approval.** List files to touch, new modules, tests to
   write, and any decisions you're unsure about. Wait for the human's OK before coding.
3. **Implement test-first.** Write failing tests against the acceptance criteria, then the
   implementation, until the deterministic gate is green.
4. **Gate 1:** `./.claude/verify` must pass. Never claim done on red.
5. **Gate 2:** run the `review-gate` skill (fresh-context `code-reviewer`). Triage, fix,
   re-verify.
6. **Gate 4:** push → PR bot.

## Rules

- Follow the installed conventions skill (e.g. `phoenix-liveview-conventions`) or
  `docs/guidelines.md`. If a rule blocks you, say so — don't silently ignore it.
- Keep it simple. No speculative abstraction.
- Respect declared out-of-scope boundaries.
