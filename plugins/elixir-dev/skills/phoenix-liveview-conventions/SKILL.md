---
name: phoenix-liveview-conventions
description: Use when writing, reviewing, or structuring Elixir/Phoenix/LiveView code — establishes this workspace's context boundaries, LiveView conventions, and the mix precommit verify gate before generating or changing Elixir code.
---

# Phoenix / LiveView Conventions

Apply these whenever working on an Elixir/Phoenix app in this workspace. This is the seed
skill for `elixir-dev` — expand it as real project patterns solidify. It pairs with the
language-neutral `dev-workflow` plugin: this skill supplies the *conventions* and the
*verify command*; `dev-workflow` supplies the *workflow and the gate mechanism*.

## The verify gate — two tiers (required by dev-workflow)

To avoid re-running the whole suite + linters on every build↔review iteration, use two
scripts:

- **`./.claude/verify-fast`** — the cheap per-turn check the Stop hook runs each turn:
  compile only. Fast tests during the loop are the tests *related to the change*, which the
  agent runs directly (not the whole suite).
- **`./.claude/verify`** — the FULL, authoritative gate: `mix precommit` (full suite +
  formatter + credo + sobelow + `ash.codegen --check`). Run once before concluding a feature;
  the commit guard also runs it so nothing commits on a red full gate.

```
mkdir -p .claude
printf '#!/usr/bin/env bash\nexec mix precommit\n' > .claude/verify
printf '#!/usr/bin/env bash\nexec mix compile --warnings-as-errors\n' > .claude/verify-fast
chmod +x .claude/verify .claude/verify-fast
```

Rationale: full suite catches regressions elsewhere and credo/sobelow catch bad
code/security — but those only need to run **once at the end**, not every iteration. The
inner loop stays cheap (compile + focused tests).

Define the `precommit` alias in `mix.exs` if it doesn't exist — the full check the gate
depends on. For an Ash + Phoenix project:

```elixir
def cli do
  # Without this, `mix test` inside the precommit alias runs in the :dev env and errors.
  [preferred_envs: [precommit: :test]]
end

defp aliases do
  [
    precommit: [
      "compile --warnings-as-errors",
      "ash.codegen --check",
      "format --check-formatted",
      "credo --strict",
      "sobelow --exit",
      "test"
    ]
  ]
end
```

- The flag is `--warnings-as-errors` (plural) — `--warning-as-errors` is silently ignored.
- `def cli/0` with `preferred_envs: [precommit: :test]` is required: an alias that ends in
  `test` otherwise runs `mix test` in `:dev` and fails with an env error.
- `ash.codegen --check` fails if generated resources/migrations are stale — run
  `mix ash.codegen <name>` to regenerate, never hand-edit generated files.
- Include `credo`/`sobelow` here (the full gate) — **not** in `verify-fast` and **not** in
  the per-iteration loop; they only need to run once before concluding. Drop either if a
  project doesn't use it.
- The `verify-fast` script (compile) runs on turn-end via the Stop hook; the full
  `mix precommit` runs before concluding a feature and on every `git commit` (commit guard).
  If a project prefers to only ask about credo/sobelow/tests per the user's choice, gate
  them behind that decision — but always keep the full run available as the final step.

## Code conventions

- **Contexts are the boundary.** Business logic lives in context modules; LiveViews and
  controllers stay thin and call contexts. No Ecto queries in the web layer.
- **Schemas hold no business logic** beyond changesets/validations.
- **LiveView:** keep `mount/3` cheap; assign in helper functions; prefer function
  components (`~H`) over macro-heavy markup; stream large collections instead of holding
  them in assigns.
- **Granular assigns.** Break assigns into individual pipes —
  `socket |> assign(key1: val1) |> assign(key2: val2)`. **Never** cram multiple keys into one
  `assign(socket, key1: ..., key2: ...)` call. Keep assigns sparse; split complex markup or
  event logic into smaller, stateless components.
- **Tests:** context functions get unit tests; LiveViews get `Phoenix.LiveViewTest`
  interaction tests asserting the acceptance criteria, not implementation details.
- Follow the `code-comments` guideline (from `coding-guidelines`) — comment-light.

## Out of scope

Front-end (Next.js) is a separate concern — do not touch it from an Elixir task.
