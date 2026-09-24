---
name: designing-ui-in-rounds
description: Use when a user wants mockups, a new look, a redesign, or screens for an app (any platform or framework) made with a design tool such as Claude Design or Open Design, before the UI is built in code.
---

# Designing UI in rounds

## Overview

A design tool fed one big brief returns a stuffed, generic UI. What works is
small briefs, one area per round, each reviewed against the real app before
the next. Layout is locked in greyscale before any colour exists. The look
comes second. Other screen sizes come last.

You write briefs and review what comes back. The user runs the design tool.

## Phases

| Phase | Output | Locked when |
|---|---|---|
| 1. Wireframe | Greyscale frames of one area at the main size, one frame per state | The user accepts a round with no revision needed |
| 2. Look foundation | One board: mascot or illustration style, palette, type, key components, motion notes | The user picks a direction |
| 3. Look per area | Each locked wireframe in the look, plus one animated moment and a list of stills | As for phase 1 |
| 4. Other sizes | Phone, tablet or TV derived from the locked main size | As for phase 1 |

Start at the size most users meet first. Ask the user if unsure. Never start
phase 2 before the areas it styles have locked wireframes.

## Each round

1. **Ground it.** Read the app's real strings file (l10n/ARB/i18n JSON) and
   the backend rules for the area: who may do what, which states exist. A
   design tool invents states the server does not allow. Only you can catch
   that.
2. **Write the brief** in `docs/design/YYYY-MM-DD-<area>-<phase>.md`, using
   the shapes in `brief-shapes.md`. Keep it to about 400 words. Write every
   label out in real copy. Every brief has a `Do not add` list.
3. **Hand it over.** Tell the user the file path and what to attach (earlier
   boards, reference images).
4. **Review the export** with `reviewing-exports.md`: render each frame, then
   check it against the brief and the app's rules.
5. **Answer with a revision** `<same-name>-r2.md` that lists only changes,
   opening with "Keep everything as it is, except what is listed here." Or
   declare the round locked.
6. **Record** the locked decisions (palette, fonts, bans, what the user
   rejected) in project memory or `docs/design/README.md`.

## Rules for every brief

- Real copy from the strings file. New copy is marked as new so it lands in
  the strings file later.
- Content is written out as realistic sample data: `Friday at Mika's`,
  `Grandma's lemon cake`, `1:12 of 3:45`. A slot like `Recipe title` or
  `{author}` comes back as grey lines.
- One area per brief, with its frames numbered and named after states
  (`3. Empty`, `3b. Clipping`).
- Name only what exists in the app. Anything the brief does not list must
  not appear.
- A look brief says what the area should feel like, then gives one "moment
  with a story": a 6–10 s animated sequence, beat by beat. It ends with a
  list of stills.
- Colour carries meaning. Reserve the strongest colour for "press this", and
  say so.
- One mascot or illustration per screen, at most.

## Review checklist (every export)

- Every label matches the brief or the strings file. No placeholder text or
  grey lines where the brief gave words.
- No state the backend forbids. Examples: a guest seeing host controls, an
  enabled button with nothing to act on, Play shown while playing.
- Nothing hidden: moving or animated elements must not cover headings.
- The emphasis colour is only on actions.
- The bans from earlier rounds still hold.
- An export identical to the previous one means the tool had not finished.
  Ask for a re-export.

## Common mistakes

- Mixing layout and look in one round. Colour hides layout problems.
- Revisions that restate the whole brief. The tool then redraws everything
  and drifts.
- Accepting invented features because they look good.
- Skipping the render and judging from the thumbnail or the source.

Next step once everything is locked: the `porting-mockups-to-code` skill.
