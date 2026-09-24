---
name: porting-mockups-to-code
description: Use when locked mockups from Claude Design, Open Design or another HTML design tool must become real UI code in an existing app (Flutter, web, or any other framework), or when a built screen drifts from its approved design.
---

# Porting mockups to code

**Status: first version.** Not yet proven on a full port. Update it with what
the first real port teaches.

## Overview

The mockup is a specification, not code to copy. It is HTML/CSS/JSX the app
cannot run. Port it in layers: tokens, then components, then screens, then
motion. Check every layer against a render of the mockup at the same size.
The locked briefs in `docs/design/` say what each frame means. The mockup
says how it looks.

## Before starting

- Every area to port has a locked wireframe and a locked look. Anything not
  locked goes back to `designing-ui-in-rounds`.
- The mockup source is on disk: an unzipped Claude Design export, or the
  Open Design project folder (see `designing-ui-in-rounds` →
  `reviewing-exports.md`).
- The app's backend already supports every state the frames show. If it
  doesn't, list the gaps and build them first. UI for impossible states is
  wasted work.

## Layers

1. **Inventory.** Map each frame to a screen, a widget and a state in the
   app. Record it in `docs/design/port-map.md`: frame → file → state source
   → strings. Flag frames with no app state, and app states with no frame.
2. **Tokens.** Read colours, fonts, sizes, radii, spacing, shadows, and
   motion durations and curves out of the mockup's CSS and JS. Do not guess
   them from screenshots. Put them in the framework's theme layer (Flutter:
   `ThemeData` plus a `ThemeExtension`; web: CSS custom properties). Bundle
   the fonts with the app. Include light and dark mode if the look has both.
3. **Components.** Build the repeated pieces once: buttons, cards, rows,
   meters, the mascot slot. Put them on a gallery screen. Render the gallery
   and compare each piece with the mockup render. Fix differences here, not
   per screen.
4. **Screens.** One screen per slice, test-first. Each wireframe frame's
   state becomes a test (a widget test, a golden test or a component test).
   Use real strings from the l10n file; add new keys for copy the briefs
   marked as new. Wire existing state. Add nothing the mockup doesn't show.
5. **Motion.** Port each "moment" as its own slice, with the prototype's
   beat timings and curves. Respect the platform's reduced-motion setting.
6. **Sizes.** Other sizes come from their own locked mockups, via the app's
   existing breakpoints or shape rules.

## Checking a slice

Render the app screen at the mockup's canvas size, in the same state:
- Flutter: golden tests, or a desktop build under Xvfb plus a screenshot.
- Web: headless chromium.

Put it beside the mockup still. List every difference in layout, spacing,
colour, type and copy, then fix them or record why not. Run the project's
full verify gate, then its fresh-context review.

## Common mistakes

- Pasting mockup CSS values into widgets one by one instead of tokens.
- Porting a screen before its components match.
- Keeping the design tool's placeholder copy or invented controls.
- Mascot art: use a clearly marked placeholder until the final asset
  exists. Never ship a traced guess.
