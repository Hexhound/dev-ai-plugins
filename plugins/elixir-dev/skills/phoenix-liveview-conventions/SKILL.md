---
name: phoenix-liveview-conventions
description: Use when writing, reviewing, or structuring Elixir/Phoenix/LiveView code — establishes this workspace's context boundaries, LiveView conventions, and the mix precommit verify gate before generating or changing Elixir code.
---

# Phoenix / LiveView Conventions

Apply these whenever working on an Elixir/Phoenix app in this workspace. This is the seed
skill for `elixir-dev` — expand it as real project patterns solidify. It pairs with the
language-neutral `dev-workflow` plugin: this skill supplies the *conventions* and the
*verify command*; `dev-workflow` supplies the *workflow and the gate mechanism*.

## The verify gate (required by dev-workflow)

`dev-workflow`'s Stop hook runs `./.claude/verify` and blocks turn-end until it passes.
In an Elixir repo, that script is one line:

```bash
#!/usr/bin/env bash
exec mix precommit
```

Create it once per repo and make it executable:

```
mkdir -p .claude
printf '#!/usr/bin/env bash\nexec mix precommit\n' > .claude/verify
chmod +x .claude/verify
```

Define the `precommit` alias in `mix.exs` if it doesn't exist — it should run the full
deterministic check the gate depends on:

```elixir
defp aliases do
  [
    precommit: [
      "compile --warning-as-errors",
      "format --check-formatted",
      "credo --strict",
      "test"
    ]
  ]
end
```

If the project uses Dialyzer or `deps.unlock --check-unused`, add them here — the gate is
only as strong as this alias.

## Code conventions

- **Contexts are the boundary.** Business logic lives in context modules; LiveViews and
  controllers stay thin and call contexts. No Ecto queries in the web layer.
- **Schemas hold no business logic** beyond changesets/validations.
- **LiveView:** keep `mount/3` cheap; assign in helper functions; prefer function
  components (`~H`) over macro-heavy markup; stream large collections instead of holding
  them in assigns.
- **Tests:** context functions get unit tests; LiveViews get `Phoenix.LiveViewTest`
  interaction tests asserting the acceptance criteria, not implementation details.
- Follow the `code-comments` guideline (from `coding-guidelines`) — comment-light.

## Out of scope

Front-end (Next.js) is a separate concern — do not touch it from an Elixir task.
