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
