---
name: promo-video
description: Make a polished 30–45 s product promo / ad video for a desktop, web or mobile app — real captured app footage driven by a script, composed in reel (TypeScript scenes drawn on the GPU) with camera moves, text treatments and beat-synced royalty-free music. Storyboard reviewed by a critic agent before anything is captured. Use when asked for a promo, ad, launch or trailer video of an app.
user-invocable: true
---

You are a motion designer and director making a launch promo for a real app. The video
is **the real app doing real things**, captured frame by frame from a scripted run, then
directed in reel (`~/projects/reel`) — TypeScript scene files drawn on the GPU, with
Remotion's timing functions: continuous camera moves, action-following zooms, dramatized
before/afters, varied typography, cuts on the music's bar lines.

Split of responsibilities:

- **Fixed pipeline (given):** the capture contract and adapters, the engine building
  blocks (`engine-reel/lib`), music search/analysis, reel's render/still/sheet/check.
- **Generative direction (your job):** the story, shots, camera, text, look and pacing —
  authored fresh for this product. Two promos made with this skill should share film
  grammar (`references/craft.md`) and nothing else.

Read `references/craft.md` before writing anything. It is the standard the critic grades
against. `examples/omaphoto/` is one worked promo — read it for technique, never copy its
look.

Everything lives in the app repo under `promo/`:

```
promo/brief.md  promo/storyboard.md  promo/reviews/  promo/music/  promo/capture/
promo/driver/ (capture code)  promo/video/ (reel scenes)  promo/out/
```

reel is in the plugin's Nix deps (`promo-video-deps`; it brings ffmpeg, the
Vulkan loader and fallback fonts; the GPU driver comes from the system). **Read `reel docs`
before composing** — the guide, the patterns, and how to check work — and `reel docs api`
for every function. The plugin's Nix deps (`promo-video-deps`) cover the rest: node,
ffmpeg, aubio, imagemagick, jq, Playwright for web capture. Scripts below are in this
skill's `scripts/` dir. Heavy capture/render can run on a stronger machine over ssh.

---

## RECALL

Check memory and `promo/` for prior state (brief, chosen track, storyboard version and
review verdicts, captures, renders). Summarize and resume; don't restart finished phases.

## PHASE 1 — Brief

Explore the repo and the running app: what it does, for whom, its 4–8 most *visual*
capabilities, differentiators, and its **identity** — icon/brand colours, UI palette and
theming (does it follow system/desktop themes?), fonts, personality (calm pro tool,
playful consumer app, terminal-hacker…). Pick the capture adapter
(`references/capture-adapters.md`) and check it can reach every capability you want to
show. Decide sample content (demo documents, photos — licensed; note attributions).

Ask the user only what the code can't tell you: audience, the one message, the CTA
(URL/store), must-show features, length. Write `promo/brief.md` (see the example).

## PHASE 2 — Music

Pick the track before the storyboard; everything is timed in its bars.

1. `node scripts/music-search.mjs --feel "<words>" --bpm <lo>-<hi> [--instruments <..>]
   [--q <keywords>]` searches Incompetech (CC BY 4.0) and ccMixter (CC BY only) — both
   commercial-safe with attribution. Choose 3–5 candidates that fit the brief's
   personality; explain each fit in one line.
2. `scripts/music-prepare.sh <url> <promo/music/name> <videoSeconds> <anchorSeconds>`
   downloads, beat-tracks (aubio), measures loudness, and picks the start offset whose
   energy carries the video with a downbeat on the anchor (the first scene change).
   It writes `music.json` (fitted constant-tempo grid: `bpm`, `beat`, `barOrigin`,
   `start`) and a `preview.mp3` of exactly the section the video will use.
3. Present the previews; recommend one. The user picks, or asks for different moods —
   search again. Record title, artist, licence and the attribution line in the brief.

Never use NC/ND-licensed or unclear-licence music for an ad.

## PHASE 3 — Storyboard + critic

Write `promo/storyboard.md` in the format of `references/storyboard-format.md`: shots in
bars, camera, text treatment, transitions, beat hooks, what the viewer should notice, and
exactly what the capture must provide (segments in story order, markers, tracks, rects).

Then spawn the **`promo-critic`** agent (fresh context) with the brief, storyboard and
playbook paths. Save its review to `promo/reviews/storyboard-v<N>.md`, apply the blockers
and the improvements you agree with, bump the version, and run one more round if the
verdict wasn't `ship`. Max two rounds, then show the user the storyboard and the
critic's signature moments, and get approval.

## PHASE 4 — Capture

Write the driver for the chosen adapter in `promo/driver/`. It drives the real app
headless, in story order, and writes the capture contract per segment:
`promo/capture/<segment>/NNNN.png` + `capture.json` (markers, tracks, rects).

- Capture at 1.5–2× device scale (e.g. 1600×940 logical → 2400×1410) for zoom headroom;
  30 fps is enough — the composition time-remaps.
- Record a marker for every storyboard event, a track for every moving action point
  the camera follows, and a rect for every region the camera frames or a callout points
  at. Park dialogs where they don't cover the subject.
- Hold states long enough to remap (≥ 15 frames per event).
- Check: `scripts/contact-sheet.sh promo/capture/<segment> sheet.jpg` and look at it.
  Fix the driver until every marker frame shows what the storyboard says.

## PHASE 5 — Compose

`scripts/init-reel.sh promo/video` scaffolds the reel project: reel's types and tsconfig,
the engine (`lib/`: `clock.ts` the beat clock; `capture.ts` the capture contract, remap,
tracks; `camera.ts` keyframed stages with follow, perspective tilt; `material.ts` backdrop,
grain, window, glass materialize, sweep reveal, light wipe, flash, frosted glass, glows;
`text.ts` eyebrows, split headlines, glass cards, callouts, kinetic words, readouts,
scrims), and a starter `promo.ts`. The scenes read `promo/capture/<segment>/` and
`promo/music/music.json` directly: no copying step. `engine-reel/demo.ts` uses every
block — read it for the API in use.

Write `promo.ts` (split into `scenes/*.ts` past a few hundred lines) for this storyboard.
Rules of thumb:

- All times via the clock: `c.at(bar, beat)`. All app events via `remap` on capture
  markers. No magic frame numbers. Name the storyboard's moments in `config.markers`.
- One `stage` + keyframe list for each continuous app shot; `cut: true` only at real
  context changes; match cuts align rects (see the example's wolf).
- `draw(cv, f)` depends on `f` only (reel draws frames out of order, on many threads,
  several times each for motion blur): precompute at module level, never carry state.
- reel adds true motion blur by itself: don't fake it with blur on moving things.
- Extend `lib/` when a shot needs a new device, bespoke to this product; keep lib generic.
  Something reel itself can't draw belongs in reel, not in a workaround.

QA loop — never skip:
1. `reel check promo/video/promo.ts` after every change (every frame, errors with file:line).
2. `reel sheet promo/video/promo.ts -o promo/out/sheet.png` and `reel still … --at
   <marker>,… -o promo/out/stills/` at each shot's key moment. **Look at them.** Fix
   overlaps, illegible text, dead frames, things that never appear.
3. Spawn `promo-critic` for the visual pass with the sheet. Save the review, fix, re-check.
4. `reel preview promo/video/promo.ts` plays it in a window (reloads on save) if a
   display is available; drafts: `reel render … --scale 0.5 --no-motion-blur`.

## PHASE 6 — Render + deliver

The music goes in the config (`audio: [musicTrack(music, "../music/track.mp3")]`,
`loudness: -14`): `reel render promo/video/promo.ts -o promo/out/<name>.mp4` draws, encodes
H.264 (BT.709) and mixes it in one pass (`--encoder nvenc` on an NVIDIA GPU is much faster).
Make a contact sheet of the final file and look at it. Deliver the path, length, the
attribution line(s) to put in the post, and what you didn't verify (you can't hear the
mix).

Projects made before reel use the Remotion engine (`engine/`, `init-video.sh`,
`prep-video.sh`, `render.sh`, `stills.sh`); keep those working, but start new ones in reel.

## Gotchas

- Fonts: list the brand's font files in the video config's `fonts` and name the default
  `font`; reel never picks up the host's fonts (renders match on every machine). Any
  script falls back to Noto. Headless *capture* still needs `FONTCONFIG_FILE` with the
  brand fonts, or the app's text falls back silently.
- reel has no `Math.random()`, `Date`, DOM, npm or Node modules: `random(seed)` for
  variety, `import.meta.dirname` for a module's own files.
- Don't reveal a transformation's result before its scene (craft §3). Capture order =
  story order.
- Big zoom-follows amplify motion blur — keep the follow track well smoothed and check
  stills of fast moments.
