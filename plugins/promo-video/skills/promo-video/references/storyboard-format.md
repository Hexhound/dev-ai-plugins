# Storyboard format

`promo/storyboard.md` is the contract between the designer, the critic, the capture
driver and the composition. Write it before capturing anything. Times are in **bars** of
the chosen track (from `promo/music/music.json`), with seconds in parentheses.

## Header

```markdown
# <Product> promo — storyboard v<N>

- Track: <title> — <artist> (<licence>), <bpm> BPM, bar = <s> s, starts at <offset> s
- Length: <bars> bars (<seconds> s), 1920×1080 @ 60 fps
- Look (from brief.md): palette, type pairing, backdrop, motion personality
- Signature moments: <the 1–3 moments this promo is remembered by>
- Capture segments: <list; each is one continuous recording, in story order>
```

## One block per shot

```markdown
## S<n> — <name>  ·  bars <a>–<b> (<t0>–<t1> s)

- Idea: <the one capability or message>
- Notice: <the single thing the viewer should register>
- App state: capture segment `<segment>`, markers `<from>`→`<to>`
  (what the app is doing, step by step)
- Camera: <start framing> → <end framing>; follow <track name> | push to <rect name>;
  tilt <rx/ry> easing to <..>; zoom <a>→<b>
- Text: <treatment from craft §4> — eyebrow "<..>", copy "<..>", placement, entry timing
- Transition in: <continuous move | cut device>; out: <..>
- Beat hooks: <which events land on which beats/bars>
- Capture needs: <markers, focus tracks, rects, separate documents, assets>
```

Non-app shots (logo, interludes, carousel, end card) use the same block without app state.

## Capture contract

Every capture segment is a folder `promo/capture/<segment>/` of `NNNN.png` frames (window
+ floating panels composited, fixed fps — usually 30) plus `capture.json`:

```json
{
  "fps": 30,
  "size": [2400, 1410],
  "frames": 412,
  "markers": {"layers.start": 0, "paint.start": 118, "paint.stroke1": 130},
  "tracks": {
    "brush": [[0.41, 0.62], [0.42, 0.61], null]
  },
  "rects": {
    "layersPanel": [0.78, 0.07, 0.21, 0.86],
    "hueDialog": {"from": 240, "rect": [0.55, 0.52, 0.36, 0.34]}
  }
}
```

- `markers`: frame index of each storyboard event. The composition maps shots to frames
  through markers, never through hard-coded numbers.
- `tracks`: per-frame normalized window coordinates of moving action points (brush tip,
  cursor, drag handle), `null` when idle. Drives "motion follows action".
- `rects`: normalized `[x, y, w, h]` of regions the camera pushes to or callouts point at,
  optionally with the frame they appear from.

Coordinates are normalized to the captured frame (0–1) so the composition can place the
window at any size.
