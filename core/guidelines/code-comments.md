# Code comments (provider-neutral)

A comment must be true from the file it lives in alone, and must earn its place. Default
to no comment. Write one only to explain a non-obvious *why* the code itself cannot show
— a workaround, an external constraint, a gotcha.

Never write a comment that:

- **Restates what the adjacent code plainly does** — if the line shows it, delete it.
- **Describes, names, or depends on code/state in another file, module, or system** — it
  couples this file to things that drift, so it goes stale and becomes a lie.
- **Narrates history, intent, or runbooks** ("we also…", "now unused", "rotate by doing A
  then B") — that belongs in commit messages, docs, or the code's structure.

Pre-write test: could it go stale if code elsewhere changed, or is it already obvious
from the line it sits on? If either, drop it.

Match the surrounding files — most are comment-light. A terse one-liner for a genuine
local gotcha is fine.

## Module and function docs

The same rule applies to a module's doc block (`@moduledoc`, a class or package docstring)
and a function's doc (`@doc`, a docstring): it must read true from this file alone, and it
must earn its place.

A module doc says **what the module does**, in one to three sentences a reader with no
prior context can follow — and, only when the name does not already say it, what calls it
or what it calls. A function doc is one sentence on what it does and returns; arguments
only when they are not obvious.

Never put in a doc:

- **Design rationale, trade-offs, or rejected alternatives** ("so a reload is safe without
  a long transaction", "an earlier version did X") — that is the commit message or the PR
  description.
- **Another module's mechanism** — explain a mechanism once, in the module that owns it;
  elsewhere name that module and stop.
- **Performance or failure war stories** ("one DELETE of that size bloats WAL") — if a
  line genuinely cannot be changed safely without one such fact, that fact is a one-line
  comment on that line, not part of the doc.

Pre-write test: would a newcomer opening only this file know what it does from the first
sentence? If the doc needs the rest of the design to make sense, cut until it doesn't.
