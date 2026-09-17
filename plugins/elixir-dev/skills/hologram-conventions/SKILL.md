---
name: hologram-conventions
description: Use when writing, reviewing, or structuring Hologram pages, components, layouts, or middleware in an Elixir/Phoenix app — establishes the client/server boundary, client-state discipline, auth and realtime patterns, theming tokens, and the mix precommit verify gate. Pairs with phoenix-liveview-conventions for the non-Hologram parts of the same app.
---

# Hologram Conventions

Apply these whenever working on Hologram (`~> 0.11`) code. Hologram compiles part of your
Elixir to JavaScript; most rules below exist because a file either runs on the server or in
the browser, and the two cannot do the same things. This skill pairs with the language-neutral
`dev-workflow` plugin exactly as `phoenix-liveview-conventions` does: **use the same
`.claude/verify`, `.claude/verify-fast` and `mix precommit` alias defined there** — do not
define a second gate.

## The mental model

| Callback | Runs on | Does |
|---|---|---|
| `init/3` (page, layout, component) | **server** | Receives params, the component struct and the server struct. Seeds client state with `put_state`; may `put_subscription`. |
| `init/2` (component only) | **client** | Client-side initialisation for a component that owns state. |
| `action/3` | **client** — compiled to JavaScript | Pure transition over `component.state`. May `put_command` to ask the server for work, `put_action` to chain (a delayed action is dropped if the page is left). |
| `command/3` | **server** | Dispatched from the client by `put_command`. Does the work; may hand an action back with `put_action`; may `put_broadcast`. |
| `Hologram.Middleware.call/2` | **server** | Runs before a page renders and before a command executes. Can short-circuit with `put_redirect` / `put_status`. |

Templates are either `~HOLO` in `template/0` or a **colocated `<module>.holo` file** next to
the module (Hologram resolves `Path.rootname(module_path) <> ".holo"`). Prefer the colocated
file; it keeps the module free of markup.

## Rules

1. **Actions are client, commands are server.** Never call Ash, the Repo, `System`, or
   anything with a side effect from `action/3` or from `client.ex`. Server work goes
   `put_command` → `command/3` → `server.ex`.
2. **Client state holds only what the template renders.** Plain maps, lists, strings,
   numbers, booleans, atoms. No Ash records, no full user struct, no anything with a
   lifecycle. Narrow the data in `server.ex` before it reaches `put_state`.
3. **`init/3` loads through `server.ex`.** Pages and components never query directly.
4. **Every page has an explicit gate.** Auth is a `Hologram.Middleware` leaf that bridges the
   AshAuthentication session: `put_stash(:current_user, user)` (server-only), `put_stash(
   :scope_actor, actor)` (the only user-derived value allowed into client state), and
   `put_user_id(user.id)` (enables `{:user, id}` broadcast targeting). Stack gates as a
   **composite** middleware (`AdminStack`) and attach it to the page. A page without a gate is
   a bug, not a default — Hologram warns when `call/2` is missing precisely so a forgotten gate
   never silently passes.
5. **Realtime through one relay.** Subscribe in `init/3` with `put_subscription`. Inside
   `command/3` use `put_broadcast`. From outside handlers — Oban jobs, GenServers, Ash
   notifiers — use `Hologram.Realtime.broadcast_action/3` through a single `RealtimeBridge`
   GenServer that subscribes to Phoenix.PubSub and translates notifications into channel
   actions (keep the translation in a pure `action_for/1` so it is testable without the
   runtime). Existing publishers keep publishing to Phoenix.PubSub; pages never subscribe to
   PubSub directly. Target identities are `{:instance, id}`, `{:session, id}`, `{:user, id}`.
6. **Components are stateless by default.** Typed `prop`s with defaults; markup in the
   `.holo`. Give a component its own `init/2`, actions and `client.ex` only when the state
   belongs to the widget, not the page (same judgement as a LiveComponent).
7. **Layouts are components with `<slot />`.** Variant and current-section via props; the
   layout's `init/3` may seed things like the masthead date.
8. **Navigate with `Hologram.UI.Link` and page modules**, never string paths. Include
   `<Hologram.UI.Runtime />` in the layout head.
9. **Never rely on a delayed `put_action` to persist anything** — it is dropped on navigation.
10. **All UI text goes through the project's i18n module.** No literal user-facing strings in
    templates.
11. **`@moduledoc` / `@doc` say what, not why** (see `code-comments` in `coding-guidelines`).
12. **Theming is tokens only — always.** Semantic CSS custom properties defined once under
    `[data-theme="…"]` on `<html>`; components reference tokens, never literal colours.
    `data-theme` comes from a layout prop with a default. Grep for hex/oklch outside the
    token file to enforce it.
13. **Dark mode is a per-project decision — ask once, then follow it.** Before the first UI
    change in a project, check memory and the project `AGENTS.md` for a recorded theme
    decision. If there is none, ask the user: *single theme for now (tokens wired so a
    second theme is a one-block addition later), or dark mode from the start?* Record the
    answer in memory and in `AGENTS.md`, then follow it. With dark mode: every UI change is
    verified in both themes before it is called done. Without it: never add a toggle, a
    `prefers-color-scheme` rule, or a second theme block on your own initiative.


## Dev-only pages

Hologram discovers pages by **enumerating compiled modules**
(`Hologram.Reflection.list_pages/0`), not by scanning a directory. A page under a path that is
in `elixirc_paths(:dev)` only — e.g. `bench/pages/` — exists in dev and is structurally absent
from the release. Use this for benchmarks and internal tools that must not ship.

## Testing

- `server.ex` — unit tests, no Hologram runtime.
- `client.ex` — unit tests on the transitions. **Highest value:** it is the JS-compiled part,
  so its tests double as a check that it stays inside the supported subset.
- `init/3` and `command/3` — call them directly with built component/server structs where
  practical.
- Feature tests — `Hologram.Test.setup()` in `test_helper.exs` (sets `HOLOGRAM_START=1`,
  runs the compiler, restarts the app) plus a browser driver. Reserve for acceptance paths;
  assert the acceptance criteria, not implementation details.

## Out of scope

LiveView pages that remain in the app (e.g. AshAuthentication's generated pages) follow
`phoenix-liveview-conventions`. Module file layout for pages and components is in
`elixir-module-structure`.
