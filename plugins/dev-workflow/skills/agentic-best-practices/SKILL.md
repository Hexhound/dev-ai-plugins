---
name: agentic-best-practices
description: Use at the start of any feature, refactor, bugfix, or code-review task in ANY project — establishes the low-token agentic workflow (one working session, one fresh-context reviewer, a deterministic verify gate, no agent fleets).
---

# Agentic Development — Best Practices

Apply this to every code-producing task. It is the low-token default: it prefers one
strong session plus one cheap fresh-context reviewer over role-based agent fleets, which
cost 3–10x more tokens and degrade fidelity at each handoff.

## The five rules

1. **One session does the work. One *fresh* subagent reviews it.**
   Never spawn a fleet. The value of review comes from the reviewer's *isolated context*
   (it can't rationalize code it just wrote), not from more agents. Use the
   `code-reviewer` subagent (Sonnet) as the second gate.

2. **The primary gate is a script, not a model.**
   A deterministic check (`./.claude/verify`) runs on turn-end via a Stop hook and blocks
   until it passes — zero model tokens, no argument. Model review is the *second* gate,
   for logic and design the script can't see.

3. **Keep planning and implementation in the SAME session.**
   Fragmenting them into separate agents loses prompt cache and forces re-exploration of
   the codebase. Split work by *context boundary*, never by *role*
   (planner→implementer→tester is a telephone game).

4. **Parallel specialist review is opt-in, high-risk-only.**
   Auth, migrations, money, security. Everywhere else: single reviewer. Fan-out is ~3–10x
   tokens — spend it deliberately, not by default.

5. **Keep CLAUDE.md short; put conditional knowledge in Skills.**
   A bloated CLAUDE.md makes Claude ignore your real instructions. Skills load on demand
   (~100 tokens until triggered).

## How to run each task

- **New feature** → `/feature` (or the `feature-development` skill)
- **Refactor** → `/refactor` (or the `refactoring` skill)
- **Bug fix** → `/bugfix` (or the `bugfixing` skill)
- **Review anything** → `/review-gate` (or the `review-gate` skill)

Every one of them ends at the **review gate**. Do not skip it.

## Ambiguity is the #1 failure cause

~42% of agentic failures trace to under-specified tasks. Before writing code, pin down
**acceptance criteria** — they double as the reviewer's checklist. If the goal is fuzzy,
ask; do not infer.
