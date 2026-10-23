# Composition

`init-vlog.sh` gives `video/src/`: `vlog/` (the engine, refreshed on every init), and the
template `Vlog.tsx`, `look.ts`, `Thumbnail.tsx`, `Root.tsx`, `index.ts` (yours to edit).
`prep-vlog.sh` fills `src/data/` (`lines.json`, `timing.json`, `frames.json`) and `public/`.
1920×1080, 60 fps; a capture frame is two video frames.

## The look (`look.ts`)

From the product's identity, never from another vlog: `font` + `fontFile` (in `assets/`),
`ink` (text, outlines), `accent` / `accentDeep` (AFTER tags, rings, the headline word),
`paper` (pills, borders), `card` / `cardDark` (footage backgrounds; dark for wireframes and
x-rays), `pointer` (the sticker, pointing up), `background` (the page). The title, the
thumbnail headline, the music file and the credits line are in `TEXT`.

## Timeline

`T` holds each section's start, from `timing.json`: a section starts 0.4–0.6 s before its
first line. Each section is drawn from 12 frames before its start to 12 after its end and
cross-fades; inside, every element has `at`/`until` frames (`s(seconds)`), mostly tied to
`VO.<line>`. Clip indices are clamped (`clipIndex`), so the early frames are safe.

## Layout (1920×1080)

| Box | Where | For |
|---|---|---|
| `LEFT` / `RIGHT` | 880×560 at y 196 | before / after side by side; `Center` label under them at y 790 |
| `BIG` | 1420×799 centred | one shot, a wipe, a line-up |
| `SIDE` | 1240×698 at the left | a shot with a counter or a key in the right column (x 1300–1920) |

The section `Chip` sits top left (y 48), subtitles at the bottom (from y ≈ 976). Keep cards,
labels and pointers clear of both. `mixBox` slides a card between boxes (big while the model
turns alone, aside when the counter comes in).

## Footage: `View`, `Clip`, `Card`, `Split`, `Wipe`

- `view(box, zoom, cx, cy)`: the crop of a capture a card shows, `zoom`× closer than the
  widest crop that fills the card, centred on (cx, cy) and kept inside the frame. Animate
  crops with `mixView` (a push-in on the subject, then a pull-back to show the context).
- `onCard(box, view, [x, y])`: where a point of the capture lands on screen — the target
  for a pointer. Measure points from the capture frames (normalized 0…1).
- `Split`: before left, after right, same view; for different footage of the same thing.
- `Wipe`: before and after stacked, the divider at `split`. **Same camera only.** Drive
  `split` with `keys(f, [[t, v], …])` (hold the before, sweep to the after, hold) or `swing`
  (back and forth between 20 % and 80 %).
- `Card dark` for wireframes and x-rays.

## Pointers and labels

- `Pointer`: target, label, `side` (or `offset` into empty space). It must point at the
  thing **in the version the label describes for its whole time on screen**: on a wipe,
  hold the divider left of the target or point where it never goes. One pointer at a time;
  1.5–4 s each; start it as the words land.
- Labels: 2–5 words that add something ("up to 9 layers deep", "drawn over painted eyes"),
  not the subtitle again. Fully inside a card or fully outside, never across an edge; the
  bubble flips left near the right edge by itself.
- `Counter` (counts up, caption under it), `Key` (a colour key for an x-ray), `Center` (a
  phase or mode name), `Chip` (the section's name).
- `OutlineWord` for big headline words (round outline); `sticker(theme, size)` for the
  plain words next to it.
- Nest `enter()` inside any element that positions or fades itself: its transform and
  opacity would overwrite them.

## Sound

`<Narration lines starts/>` places every voice clip. `musicBed(lines, starts, TOTAL)` gives
the music's volume per frame: a quiet bed (0.16) dipping to 0.085 under each passage
(lines under 4 s apart count as one), fading in and out. `render-vlog.sh` brings it to −14
LUFS with one fixed gain. Expect the voice around −13 LUFS and music-only stretches around
−20 to −28.

## Sections that worked

- **Hook (0–3 s)**: the old hero wipes into the new one under the title, then the whole
  cast, old row over new row.
- **The model**: big card, sway; aside with the counter for the wireframe; the x-ray with
  its key and a pointer on the hot core; then old and new x-rays side by side with a
  counter under each.
- **A live readout** (a debug panel): the panel cropped big on the left, the model it
  switches on the right, swapping in step with the panel, with a badge saying which.
- **Textures / faces**: close-ups side by side, the expression changing as the pointer
  arrives.
- **Props / sets**: wipes on the same camera arc; a sharp close-up cut from the full-size
  capture.
- **Day / night or modes**: side by side, a `Center` label per phase or mode, crops on the
  action (zoom 1.8–2.2), a push-in where the line names a detail.
- **Outro**: logo, "Thanks for watching!", credits in pills; 4–6 s after the last word.

## QA

Stills (`COMPOSITION=Vlog stills.sh video sheet.jpg t…`) at every pointer's middle, every
label, every section's first frame and 0.2 s before it, the hook at 0.5/2/3.5 s, and the
end card. Look for: text over text, labels across card edges or off the frame, pointers on
the wrong version, a subject cut by its crop, frozen footage, empty cards.
