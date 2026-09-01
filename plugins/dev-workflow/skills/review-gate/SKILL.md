---
name: review-gate
description: Use when a code change is complete and needs checking before commit or PR — runs the deterministic verify gate, then a fresh-context reviewer subagent, escalating to parallel specialists only for high-risk diffs.
---

# Review Gate

Every code-producing task ends here. Gates run in order; do not skip ahead.

## Gate 1 — Deterministic (zero model tokens)

The project's `./.claude/verify` script must exit 0. It runs automatically on turn-end via
the `dev-workflow` Stop hook, but run it yourself before asking for review:

```
./.claude/verify
```

If a repo has no `./.claude/verify`, create one (one line calling the stack's checks — e.g.
`exec mix precommit`, `exec go test ./...`, `exec npm test`). No script → no gate.

## Gate 2 — Fresh-context review (ONE subagent, not a fleet)

Spawn the `code-reviewer` subagent (Sonnet — review needs isolated context, not Opus
horsepower). Give it **only**:

- the diff (`git diff` of the change under review)
- the acceptance criteria / invariant for this change
- the relevant guideline skill or `docs/guidelines.md`

Do **not** give it your reasoning or chat history — bias defeats the point. It returns
findings ranked by severity and fixes nothing. Reviewers over-report; if it returns a pile
of nitpicks, push back and keep only real correctness/guideline/test-coverage issues.

Triage → fix real issues → re-run Gate 1.

## Gate 3 — Parallel specialists (HIGH-RISK diffs only; ~3–10x tokens)

Only for auth, migrations, money, or security-sensitive code. Fan out to independent
lenses (idioms / security / test-coverage / compilation), dedupe findings, Gate 1 again.
Skip for everything else.

## Gate 4 — PR bot

Push; let the PR review bot (e.g. CodeRabbit via `/coderabbit:review`) act as the final
independent gate. This is complementary to Gate 2, not a replacement — Gate 2 is
author-side and pre-push.
