# OmaPhoto promo — storyboard v2

- Track: Werq — Kevin MacLeod (CC BY 4.0), 126.7 BPM, bar ≈ 1.90 s, starts at 90.68 s
- Length: 19 bars (≈ 36 s), 1920×1080 @ 60 fps
- Look: deep blue-black, violet/blue/peach bokeh from the icon gradient; glass + light
  material; Inter 800 headlines, JetBrains Mono eyebrows/readouts; spring motion.
  Every app shot: window with large soft shadow, 1px edge highlight, accent glow; overlays
  parallax against camera moves.
- Signature moments: (1) the product materializing as a clear glass pane; (2) the light
  sweep erasing the wolf's field, then the cut-out wolf match-cutting onto the poster;
  (3) the camera riding the brush tip.
- Story: a raw photo → one-click cut-out → it becomes a poster → layers, paint, colour →
  it wears your theme → end.
- Capture segments (story order): `remove` (tab "Wolf": raw photo → committed removal),
  `main` (poster: layers → paint → adjust), `themes` (one still per theme, paint hidden).

## S1 — Logo  ·  bars 0–2 (0–3.8 s)

- Idea: brand.  Notice: the icon's sunset gradient.
- Text: light streak crosses on bar 0; icon springs in on beat 2; "OmaPhoto" letters
  blur-in staggered over beats 3–4; mono sub "NATIVE · OFFLINE AI · OPEN SOURCE" on bar 1
  beat 1.
- Transition out: from bar 1 beat 3 the icon's glow swells into the backdrop and the logo
  lifts away as the glass slab arrives (continuous).

## S2 — The editor materializes  ·  bars 2–4 (3.8–7.6 s)

- Idea: a real, native pro editor.  Notice: a full Photoshop-style app, with a photo open.
- App state: `remove` `before` (tab "Wolf", the raw wolf photo on its dry-grass field).
- Camera: window right of centre, ry −14° rx 2° → ry −8° rx 0°, dolly 0.80→0.86.
- Entrance: an empty clear glass slab (transparent, bright 1px edge, reflection gradient)
  slides in from the right on bar 2 beat 1; bar 2 beats 3–4 a specular sweep crosses
  diagonally and the UI fills the glass behind it, sharpening from blur 18→0.
- Text: split headline left — eyebrow "01 · THE EDITOR", "Photo editing," on bar 3 beat 1,
  "native to Linux." on bar 3 beat 3; 80 px.
- Transition out: continuous — headline slides out left while the window flattens,
  centres and pushes into the canvas (S3).

## S3 — Remove background  ·  bars 4–7 (7.6–13.3 s)

- Idea: one-click offline AI cut-out.  Notice: the whole field vanishes around the wolf.
- App state: `remove` `before` → `after` (committed; checkerboard where the field was).
  The dialog is not shown.
- Camera: bar 4 flatten to 0°, push to the canvas at 1.3× so the photo fills the frame.
- Change: bar 5 beat 1, a bright vertical light line with particles sweeps right→left over
  1 s, revealing the real `after` frame behind it; hold after through bar 6.
- Text: glass card bottom-left, off the subject: eyebrow "02 · REMOVE BACKGROUND",
  "One click." (bar 5 beat 3) / "Fully offline." (bar 5 beat 4).
- Transition out: bar 7 match cut — the cut-out wolf holds its screen position while the
  poster (`main`) appears around it (the poster window is transformed so its wolf layer
  aligns with the S3 wolf), with a soft light flash; the camera then eases to the poster
  framing over bar 7.

## S4 — Layers  ·  bars 7–9 (13.3–17.1 s)

- Idea: real layers and blend modes.  Notice: the WILD text changing with each blend.
- App state: `main` `layers.*`: bar 8 beat 1 hide WILD, beat 2 show WILD, beat 3 Screen,
  beat 4 Difference, bar 9 beat 1 Normal, bar 9 beat 2 "new layer" (panel gains Layer 1).
- Camera: bar 7 settle (1.0×, flat); bar 8 push to the union of `layersPanel` and
  `wildText` at ≈1.4×; bar 9 beat 3 dolly toward the canvas as the brush appears.
- Text: anchored callout — leader line from the `blendDropdown` to a label "03 · LAYERS —
  Blend modes, live."; counter-scaled so it stays 1:1 while the camera zooms.

## S5 — Paint  ·  bars 9–11 (17.1–20.9 s)

- Idea: real brushes on real pixels.  Notice: the brush tip and the stroke textures.
- App state: `main` `paint.*`: soft pink stroke (hardness 0.25), hard yellow stroke
  (hardness 1), eraser stroke cutting across both; brush ring visible.
- Camera: 1.9×, follows the `brush` track (critically damped, leading 6 frames), ry swings
  ±4° with horizontal velocity, motion blur when fast.
- Text: kinetic words lower-left, screen-fixed: eyebrow "04 · PAINT", then "Soft." "Hard."
  "Erase." each landing as its stroke starts.
- Transition out: continuous pull back to 1.1× (S6); the paint layer is hidden between
  segments so S6 is clean.

## S6 — Adjust  ·  bars 11–13 (20.9–24.7 s)

- Idea: live colour adjustments.  Notice: only the lake recolours; wolf and text don't.
- App state: `main` `adjust.*`: lake selected, Hue/Saturation open; hue 0→+180 across bar 11
  beats 2–4; hue −79 lands on bar 12 beat 1; saturation +24 on bar 12 beat 3. No cancel.
- Camera: 1.1× framing the canvas (lake + wolf), the dialog's left edge just in frame.
- Text: live readout top-left: huge mono "HUE +180°" ticking with the capture's `hue`
  values, "SAT +24" appearing on bar 12 beat 3; eyebrow "05 · ADJUST", small line "Levels,
  Curves, Hue/Saturation.".
- Transition out: whip pan right with motion blur on bar 13.

## S7 — Interlude  ·  bar 13–14 (24.7–26.6 s)

- Idea: transition to theming.  Text: "It wears your theme." words on beats 1–4, gradient
  violet→blue→peach. Out: zoom through the word "theme" — its gradient fill becomes the
  first wallpaper (S8).

## S8 — Theme montage  ·  bars 14–16 (26.6–30.4 s)

- Idea: follows the Omarchy theme.  Notice: the same window recolouring.
- App state: `themes`: tokyo-night, catppuccin-latte, gruvbox, hackerman, rose-pine,
  kanagawa, retro-82, osaka-jade — one per beat.
- Camera: window fixed (centre, 1320 px wide, ry −4°); each beat a diagonal light-edge
  wipe inside the window reveals the next theme while the wallpaper behind changes on the
  same wipe.
- Text: caption strip bottom-left (8 swatches + theme name); eyebrow "06 · THEME SYNC"
  top-left; counter "03 / 08" top-right.
- Transition out: bar 16 pull back — the window becomes one tile of a 3D wall (themes +
  hero frames) which sinks into the lower half and dims to 15% (continuous into S9).

## S9 — End card  ·  bars 16–19 (30.4–36 s)

- Idea: CTA.  Notice: the name and where to get it.
- Background: the wall from S8 as a faint masked strip in the lower half, slowly drifting;
  tiles mix theme stills with the poster, the brush close-up and the checkerboard wolf.
- Text: icon springs (bar 16 beat 2), "OmaPhoto" 112 px (beat 3), "Layered photo editing
  for Linux. Loves Omarchy." (bar 17 beat 1), distro chips on beats of bar 17, URL pill
  (bar 18 beat 1), "FREE · OPEN SOURCE · MIT" (bar 18 beat 3); tiny credit "Music: Werq —
  Kevin MacLeod (incompetech.com) · CC BY 4.0".
- Out: 1-bar fade of picture and music over bar 18.
