---
description: Make a narrated YouTube devlog / vlog of an app or game — before/after footage from the real app, a free offline narrator voice, subtitles, a pointer on the differences, critic-reviewed.
argument-hint: [app project directory] [what the video is about]
---

Invoke the **narrator-vlog** skill and run it for the app at `$ARGUMENTS` (the current
project if empty).

Ask every interview question first (`references/interview.md`), one question per tool call,
voice samples included, and nothing after that: the user wants no questions in the middle of
the work. Then work through the phases in order:

1. Script and voice — `script.md`, pronunciation fixes, the clips, `timing.json`.
2. Shot plan, reviewed by the `vlog-critic` agent (every claim needs visual proof).
3. Footage — the old version from a git worktree for before/after, the same tools and
   camera for both.
4. Composition — stills at every pointer and section boundary, looked at and fixed.
5. Render, then `vlog-critic` on the render; fix and re-render until it passes (usually
   two rounds).
6. Deliver — the video, the `.srt`, the thumbnail, `youtube.md`, the README, and what you
   couldn't verify (you can't hear it: ask the user to listen once).

Direct the look from the product's own identity; never reuse another vlog's look.

App project directory and topic: $ARGUMENTS
