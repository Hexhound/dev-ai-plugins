---
name: code-comments
description: Use when writing, editing, or reviewing code in ANY language — governs when a comment earns its place, what a module or function doc may say, and forbids obvious, cross-referencing, or history-narrating comments.
---

# Code Comments

Apply this whenever you add or change a comment in code, in any language.

**A comment must be true from the file it lives in alone, and must earn its place.**
Default to writing no comment. Write one only to explain a non-obvious *why* the code
itself cannot show — a workaround, an external constraint, a gotcha that would trip up
the next reader.

## Never write a comment that

- **Restates what the adjacent code plainly does.** "increment the counter", "start the
  service", "append the token", "runs before boot". If the line below already shows it,
  the comment is noise — delete it.
- **Describes, names, or depends on code or state in another file, module, or system.**
  "X already renders this", "NOT a duplicate of Y", "mirrors Z", "the primer sets this
  elsewhere". It couples this file to things that change independently, so it goes stale
  and becomes a lie. This is the worst kind — it actively misleads once the other code
  drifts.
- **Narrates history, intent, or runbooks.** "we also…", "so the feature can…", "now
  unused", "rotate by doing A then B". That belongs in commit messages, docs, or the
  code's structure — not inline where it rots.

## Pre-write test

Before writing any comment, ask:

1. Could this go stale if code in another file changed?
2. Is it already obvious from the line it sits on?

If either is **yes**, don't write it.

## What good looks like

Match the surrounding files — most codebases are comment-light. A terse one-liner for a
genuine local gotcha is fine:

```
# prev.ghostty (not final) avoids infinite recursion in the overlay
```

That earns its place: the *why* is invisible in the code, and it's true from this file
alone. Everything else, leave out.

---
## Module and function docs

The same rule applies to a module's doc block (`@moduledoc`, a class or package
docstring) and a function's doc (`@doc`, a docstring).

- A module doc says **what the module does** in one to three sentences a reader with no
  prior context can follow, plus what calls it or what it calls only when the name
  doesn't already say so.
- A function doc is one sentence on what it does and returns.
- **Never** put design rationale, trade-offs, rejected alternatives, another module's
  mechanism, or performance war stories in a doc. Rationale goes in the commit message or
  PR description; a mechanism is explained once, in the module that owns it, and named
  elsewhere; a fact a line can't be changed without is a one-line comment on that line.

```
# do
@moduledoc """
Deletes what replaced or failed ingest runs of one source left behind: their
fact rows, orphaned regions, and the run records. Runs at the end of every ingest.
"""

# don't
@moduledoc """
Physically removes what an ingest has already made invisible ... Runs at the end of
each ingest job, still under the lock, so no run is in flight — which is what makes
"not active" the same as "stale" ... one DELETE of that size bloats WAL ...
"""
```

Pre-write test: would a newcomer opening only this file know what it does from the
first sentence? If the doc needs the rest of the design to make sense, cut until it
doesn't.

---

See `core/guidelines/code-comments.md` in the `dev-ai-plugins` repo for the
provider-neutral source of this rule.
