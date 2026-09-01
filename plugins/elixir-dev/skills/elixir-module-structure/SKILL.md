---
name: elixir-module-structure
description: Use when creating a NEW LiveView or GenServer module in this Elixir workspace — enforces splitting each into its mandated files (LiveView → *_live / impl / ui / state; GenServer → public API / impl / server / state) instead of one monolithic module.
---

# Elixir Module Structure

When you create a **new LiveView** or a **new GenServer**, do not write it as a single
monolithic file. Split it into the mandated files below. This is a hard convention for this
workspace — follow it whenever the trigger matches; if a specific module genuinely shouldn't
be split, say so and ask before collapsing it.

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

## GenServer module → 4 files

For a GenServer `MyApp.Thing`, split into:

| File | Holds |
|------|-------|
| public API (the `thing.ex` entry module) | The client-facing functions (`start_link/1`, and the `call`/`cast` wrappers). This is the only module callers touch. No `handle_*` here. |
| `impl.ex` | The actual work each callback performs, as plain functions. No `GenServer` callbacks, no state struct plumbing — just logic that takes inputs and returns results. |
| `server.ex` | The `GenServer` callbacks (`init/1`, `handle_call/3`, `handle_cast/2`, `handle_info/2`, `terminate/2`). Thin — each callback delegates to `impl` and updates `state`. |
| `state.ex` | The state struct and pure transitions over it. Keep it simple and serializable. |

## Why this split

Each file has one reason to change; callbacks stay thin and testable; business logic
(`impl`) is unit-testable without a socket or a running process. Match the surrounding
codebase's exact naming and namespacing for these files.

## Extending

Other module kinds may get their own mandated split over time — add them here as the
workspace adopts them, keeping this skill the single source for structural rules.
