# Director's playbook — what makes a product promo feel polished

These are the rules the storyboard is written to and the critic grades against. They are
about *film grammar*, not a look: two promos built with them should share the grammar and
nothing else. Every rule exists because breaking it produced a flat, template-feeling video.

## 1. Continuity: move the camera, don't cut

Consecutive scenes that happen in the **same app state** (same window, same document) are
one continuous shot. The camera travels from one region of interest to the next — pan,
dolly, re-tilt — while the footage keeps playing. A fade or cut between two views of the
same window reads as "slideshow".

- Cut only when the *context* changes: a different document or screen, a different
  theme, a typographic interlude, the end card.
- When you do cut, make the cut a device (whip pan with motion blur, zoom-through into the
  next scene, a light sweep, a match cut on shape or colour) — never the default crossfade
  twice in a row.
- Capture in story order so continuous scenes are one continuous recording.

## 2. Motion follows action

Whenever something moves in the app — a brush tip, a cursor, a drag, a slider thumb, a
scrolling list — the camera zooms in (1.4–2.2×) and **tracks it**, smoothed, leading the
motion slightly. The viewer's eye should never have to hunt. This needs per-frame focus
data from the capture (see the capture contract), so plan it before capturing.

Static UI changes (a toggle, a dropdown) get a push-in toward the element instead — tight
enough that the control being changed is unmistakably the subject (≈2× on a side panel),
while keeping the part of the canvas it affects in frame.

Tracked action plays at **real speed or slower**. Never compress a captured stroke or drag to
fit the beat grid — a fast-forwarded brush reads as a glitch and the follow-cam smears.
Give the action more beats, or cut an action (two slow strokes beat three rushed ones).
When the camera must travel between two actions, give the move its own beat.

## 3. Transformations must be legible

A before→after feature (remove background, filters, AI fill, format conversion, sync) is
only impressive if the viewer registers both states:

1. **Before**, clean and isolated, held ≥ 1 bar. The subject is obvious; no clutter; no
   dialogs covering it.
2. **The change**, dramatized over ≥ 0.8 s: a sweep/wipe with a light edge, a split slider,
   a scan, a morph. The dramatization reveals the *real* after state — never a fake.
3. **After**, held ≥ 1 bar, framed so the difference is the biggest thing on screen
   (e.g. transparency checkerboard filling the frame).

**Never show the after state earlier in the video.** If the poster in scene 2 already has
the cut-out subject, the removal demo in scene 6 needs a fresh subject or a fresh document.

**Isolate each demo.** Before showing the next feature, clear unrelated edits from earlier
scenes (hide the paint layer before a colour adjustment) so only the new effect changes on
screen — and make the clearing a visible app action on a beat (an eye toggle during a
pull-back), not a silent pop between segments.

## 4. Vary the text treatment

Text is a design element that changes with the content. No treatment twice in a row, and
no treatment more than twice in the whole video. The palette:

- **Split headline**: big type on one side, the product on the other (great for the first
  product shot).
- **Anchored callout**: a small label with a leader line pinned to the UI element being
  shown; moves with the camera.
- **Glass card**: eyebrow + two-line headline on frosted glass. Good once or twice, fatal
  when it is every scene.
- **Kinetic words**: a list ("Brush. Heal. Clone.") landing word by word on beats.
- **Live readout**: a big number or value that ticks in sync with the app ("Hue 0° →
  180°"), proving it's live.
- **Typographic interlude**: full-screen words between sections ("It wears your theme.").
- **Lower third / caption strip**: quiet, for dense scenes where the UI must be read.

Copy: ≤ 6 words per headline, concrete verbs, no marketing filler ("powerful",
"seamless"). The eyebrow (`03 · PAINT`) gives structure; the headline gives the benefit.

Text over busy footage always sits on a scrim (a soft dark gradient from its edge) or glass —
check legibility on the stills, not in your head.

## 5. Entrances are events

The first appearance of the product and of the brand are signature moments, planned
individually:

- **Logo**: light streak / particles / assemble, then name letter by letter, then tagline.
- **Product**: materialize — e.g. a clear glass pane with a specular sweep that fills with
  the UI as it sharpens; assemble from its panels; rise from the backdrop with a reflection.
  Never "window fades in".

Everything else enters with purpose too: springs, not linear fades; blur-to-sharp on text;
staggered children.

Overlap entrance phases: the reveal starts while the thing is still moving in. A container
that arrives and then sits empty waiting for its content (an empty glass pane, a blank
window) reads as a loading state.

## 6. Depth and material

Flat compositing reads cheap. Build depth in layers:

- Backdrop: slow-moving blurred light (bokeh blobs), vignette, faint grain — tinted to the
  brand palette.
- The product window: soft large shadow, 1px edge highlight, a glow in the accent colour,
  slight 3D tilt that eases toward flat whenever the UI must be read.
- Foreground overlays sit on a different depth: they parallax against camera moves and use
  frosted glass so the footage shows through.
- Fast camera moves get motion blur proportional to speed — subtle (a few px), and only
  above a speed threshold; zoom-follow shots amplify it, so check their stills.

Restraint: tilts ≤ 15°, one simultaneous transform axis dominant, no jitter.

## 7. Rhythm: edit to the music

Pick the track before the storyboard; time everything in **bars**.

- Scene changes and major reveals land on bar lines.
- Micro-events (carousel items, kinetic words, toggles) land on beats.
- Alternate pace: a calm reveal → busy feature run → a fast montage (carousel on every
  beat) → a calm end card. A promo at one constant pace feels long.
- Leave the last 2–3 s for the end card over the track's resolution or fade.

## 8. One idea per scene

Each scene demonstrates exactly one capability, lasts 2–3.5 s (≈1–2 bars), and has one
thing the viewer should notice. Write that thing down per shot; if you can't, cut the
shot. Total length 30–45 s. The product's strongest, most visual capability goes early;
the second strongest goes last before the end card.

## 9. Show the real thing

Footage is the real app doing the real operation, captured deterministically. Overlays may
dramatize (sweeps, glows, zooms, readouts) but never fake a result the app didn't produce.
If a feature can't be captured well, cut it rather than mock it.

## 10. The ending is a callback

The end card is not an empty background with a logo. It echoes the video: a faint (10–20%
opacity), slowly moving 3D wall or strip of the footage behind or below the brand, masked
into the backdrop. Then: icon, name, one-line tagline, platform/availability chips, the
call to action (URL, store badges), and a licence/price line if relevant. Hold ≥ 2 s, then
resolve with the music.

## 11. Match the product, not the last promo

Palette, type, backdrop, motion personality and pacing come from the product's identity
(brief.md). A terminal tool gets mono type, hard cuts and scanlines; a meditation app gets
slow dissolves and soft light; a pro creative tool gets glass, depth and precise motion.
The rules above are grammar; the look is bespoke every time.

## Critic checklist (summary)

1. Any fades/cuts between scenes in the same app state? (§1)
2. Any moving action the camera doesn't follow? (§2)
3. Each transformation: clean before ≥ 1 bar, ≥ 0.8 s dramatized change, after ≥ 1 bar,
   and after-state not revealed earlier? (§3)
4. Text treatments: any repeated back-to-back, or used > 2×? (§4)
5. Are the product's and the logo's first appearances designed moments? (§5)
6. Depth: backdrop, shadows, parallax, motion blur? (§6)
7. Every scene change on a bar line; montage on beats; pacing varies? (§7)
8. Each scene: one idea, one "notice this", 2–3.5 s? Total 30–45 s? (§8)
9. Anything faked? (§9)
10. End card echoes the footage and has a clear CTA? (§10)
11. Does the look come from this product's brief, or from a previous promo? (§11)
12. The boredom test: is there something new to look at every ~2 s?
