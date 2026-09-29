# Example: OmaPhoto (Qt 6 photo editor)

A worked promo made with this skill — read for technique, never copy the look.

- `brief.md`, `storyboard.md` (v2, after two `promo-critic` rounds; round-1 summary in
  `reviews/`). Round 1 caught the key story flaw: the cut-out wolf appeared in the poster
  before the background-removal scene, spoiling it — fixed by opening on the raw photo,
  removing its background, then match-cutting the cut-out onto the poster.
- `capture/promo.cpp` — Qt driver (links the app's `compositor_core` library, runs
  offscreen, `promo_recorder.h`): segments `remove`, `main`, `themes`; markers per event,
  a `brush` track, `hue`/`saturation` values, rects for the camera and the callout.
- `music/music.json` — "Werq" (Kevin MacLeod, CC BY 4.0) fitted grid from `music-prepare.sh`.
- `video/src/Promo.tsx` — the composition: one continuous camera over the app shots
  (glass materialize → push to the photo → sweep reveal → pixel-locked match cut onto the
  poster → layers push with a pinned callout → brush-following camera with kinetic words
  → live hue readout over a scrim → whip), interlude zooming through a word into the theme
  montage (light-edge wipes per beat), end card over a sinking wall of the footage.
