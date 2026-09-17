---
name: elixir-module-structure
description: Use when creating a NEW LiveView, LiveComponent, GenServer, Hologram Page, or Hologram Component in this Elixir workspace — enforces splitting each into its mandated files (LiveView/LiveComponent → shell / impl / ui / state; GenServer → public API / impl / server / state; Hologram Page/Component → shell / .holo / server / client / components) and deciding when a stateful widget should become a LiveComponent or a stateful Hologram Component.
---

# Elixir Module Structure

When you create a **new LiveView**, a **new LiveComponent**, a **new GenServer**, a **new
Hologram Page**, or a **new Hologram Component**, do not write it as a single monolithic file. Split it into the mandated files below. This is a hard
convention for this workspace — follow it whenever the trigger matches; if a specific module
genuinely shouldn't be split, say so and ask before collapsing it.

## LiveView module → 4 files

For a LiveView `MyAppWeb.ThingLive`, create a directory for it and split responsibilities:

| File | Holds |
|------|-------|
| `thing_live.ex` (the `*_live.ex`) | The LiveView shell: `mount/3`, `handle_event/3`, `handle_info/2`, `render/1`. Thin — it wires callbacks to the other modules and holds no business or view-building logic. |
| `impl.ex` | Business/domain logic for this LiveView: the functions the callbacks delegate to. No socket, no markup. |
| `ui.ex` | View layer: function components / `~H` markup and presentation helpers. No business logic. |
| `state.ex` | The socket-assigns shape and pure state transitions (build/update assigns). No side effects. |

The `*_live.ex` callbacks stay short: parse input → call `impl`/`state` → assign → render
via `ui`.

## LiveComponent module → 4 files (same split)

A LiveComponent gets the identical split. For `MyAppWeb.ThingComponent`:

| File | Holds |
|------|-------|
| `thing_component.ex` (the shell) | `use Phoenix.LiveComponent` + the callbacks: `mount/1`, `update/2`, `handle_event/3`, `render/1`. Thin — wires callbacks to the other modules. |
| `impl.ex` | Business/domain logic the callbacks delegate to. No socket, no markup. |
| `ui.ex` | Markup / function components / presentation helpers. |
| `state.ex` | The assigns shape and pure transitions over them. |

## When should something be a LiveComponent?

Extract a piece of a page into a LiveComponent when **the state naturally belongs to the
widget, not the page** — ask *"does it make sense for this data to be handled by the LV or by
a LiveComponent?"*

Reach for a LiveComponent when:

- It is a **stateful widget** with its own local state/lifecycle (e.g. a media player, an
  editor, a live-updating panel) — especially one that must **keep state across page
  navigation**.
- Folding its logic into the parent LV would make the LV large and complex, or would couple
  logic that wants to be **reusable** elsewhere.

Keep it in the LV when the state is really the page's. Use LiveComponents **deliberately, not
by default** — the goal is smaller LVs and reusable widgets, not a component for everything.

## GenServer module → 4 files

For a GenServer `MyApp.Thing`, split into:

| File | Holds |
|------|-------|
| public API (the `thing.ex` entry module) | The client-facing functions (`start_link/1`, and the `call`/`cast` wrappers). This is the only module callers touch. No `handle_*` here. |
| `impl.ex` | The actual work each callback performs, as plain functions. No `GenServer` callbacks, no state struct plumbing — just logic that takes inputs and returns results. |
| `server.ex` | The `GenServer` callbacks (`init/1`, `handle_call/3`, `handle_cast/2`, `handle_info/2`, `terminate/2`). Thin — each callback delegates to `impl` and updates `state`. |
| `state.ex` | The state struct and pure transitions over it. Keep it simple and serializable. |

## Hologram Page → shell + template + server + client (+ components)

For a page `MyApp.Pages.Admin.Releases`, create a directory for it. Unlike the LiveView split,
this one follows the **runtime boundary**: one file is server-only, one compiles to JavaScript.

| File | Holds |
|------|-------|
| `releases.ex` (the shell) | `use Hologram.Page`, `route`, `layout`, `param`s, middleware attachments, `init/3`, `action/3`, `command/3`. Thin — each clause is one call into `server` or `client`. **`action/3` and `command/3` both stay here**: Hologram splits the module by function, so do not move them out. |
| `releases.holo` | The colocated template. Hologram resolves `Path.rootname(module_path) <> ".holo"`; the shell then has no `template/0`. |
| `server.ex` | Server-only logic that `init/3` and `command/3` delegate to. Ash and every side effect live here. Returns plain, render-safe data. |
| `client.ex` | The client-state shape (a typespec of plain maps) and the pure transitions `action/3` delegates to. **Compiled to JavaScript** — supported-Elixir subset only, no side effects, no Ash, no structs with a lifecycle. |
| `components/` | `Hologram.Component` modules used by this page (each with its own `.holo`). This is what the LiveView `ui.ex` becomes. |

`server.ex` here is a **homonym** of the GenServer split's `server.ex` (the callbacks file). They
are different module kinds and never share a directory; do not conflate them when reading
both tables.

## Hologram Component → same split, scaled to what it owns

| File | Holds |
|------|-------|
| `thing.ex` (the shell) | `use Hologram.Component`, `prop`s, and — only if it owns state — `init/2` (client) or `init/3` (server), `action/3`, `command/3`. |
| `thing.holo` | The colocated template. |
| `server.ex` / `client.ex` | Only when the component owns state or server work. A stateless component is **shell + `.holo` and nothing else**. |

## When should a Hologram Component own state?

Same judgement as a LiveComponent: extract and give it state when **the state naturally
belongs to the widget, not the page** — a live-updating panel, an editor, a filter bar that
must survive re-renders of its parent. Keep state in the page when it is really the page's.
Stateful components deliberately, not by default.

## Why this split

Each file has one reason to change; callbacks stay thin and testable; business logic
(`impl`, or `server`/`client` for Hologram) is unit-testable without a socket, a running
process, or the Hologram runtime. For Hologram the split additionally makes the JavaScript
boundary visible in the file name. Match the surrounding
codebase's exact naming and namespacing for these files.

## Extending

Other module kinds may get their own mandated split over time — add them here as the
workspace adopts them, keeping this skill the single source for structural rules.
