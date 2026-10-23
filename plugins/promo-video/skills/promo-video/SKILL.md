---
name: promo-video
description: Make a polished 30–45 s product promo / ad video for a desktop, web or mobile app or a game — real captured app footage driven by a script, composed in reel (TypeScript scenes drawn on the GPU) with camera moves, text treatments and beat-synced royalty-free music. Storyboard reviewed by a critic agent before anything is captured. Also narrated how-to / tutorial videos of app features from the same footage pipeline, and re-shoots a finished promo when the app's look changes. Use when asked for a promo, ad, launch, trailer or tutorial video of an app, or to update one.
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
look. For **tutorials** (narrated how-tos: one feature, the narrator says what to tap,
captions, rings on what to look at) read `references/tutorials.md` too: there the voice
sets the pace instead of the beat, and its checklist is what the owner will review.

Everything lives in the app repo under `promo/`:

```
promo/brief.md  promo/storyboard.md  promo/reviews/  promo/music/  promo/capture/
promo/driver/ (capture code)  promo/video/ (reel scenes)  promo/out/
```

reel is in the plugin's Nix deps (`promo-video-deps`; it brings ffmpeg, the
Vulkan loader and fallback fonts; the GPU driver comes from the system). **Read `reel docs`
before composing** — the guide, the patterns, and how to check work — and `reel docs api`
for every function. The plugin's Nix deps (`promo-video-deps`) cover the rest: node,
ffmpeg, aubio, imagemagick, jq, Playwright for web capture. Without Nix, `music-prepare.sh`
falls back to `scripts/aubiotrack-numpy.py` when aubio is missing. Scripts below are in this
skill's `scripts/` dir. Heavy capture/render can run on a stronger machine over ssh.

---

## RECALL

Check memory and `promo/` for prior state (brief, chosen track, storyboard version and
review verdicts, captures, renders). Summarize and resume; don't restart finished phases.

A **finished** promo (`promo/out/` has the render) and an app whose look has changed since
(new art, characters, UI, colours): ask whether to **re-shoot** it (same cut, music and
words; see RESHOOT) or make a new one. Re-shooting is the default.

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
playbook paths. If the agent isn't available (the plugin's agents aren't installed), spawn a
general-purpose agent with the contents of this plugin's `agents/promo-critic.md` as its
instructions, plus the same inputs. Save its review to `promo/reviews/storyboard-v<N>.md`,
apply the blockers and the improvements you agree with, bump the version, and run one more round if the
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
- Mobile: no on-screen keyboard in the footage (`capture/android/nokeyboard`, or the iOS
  Simulator's hardware keyboard), and nothing else running on the capture machine while
  a take films — see `references/tutorials.md` §4.
- Edits refer to capture frames by marker (+ offset), never by absolute frame number: a
  take filmed again shifts every frame.
- **Runs that don't replay exactly** (games with physics, anything timing-dependent): the
  same seed can play differently next time. Record a wider window than the shot needs,
  save every event (`events` in `capture.json`), and pick the shot's moment with a small
  script over them; never hard-code a frame from an earlier recording.
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
- **The app's own sounds** (a game's pops and chimes, a click): put them in `promo/assets/`
  and place them on their markers as more tracks in the config's `audio`, next to the music
  (see `AudioTrack` in `reel docs api`).

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
`loudness: -14`, −16 for tutorials): `reel render promo/video/promo.ts -o
promo/out/<name>.mp4` draws, encodes H.264 (BT.709 limited range, tagged) and mixes it in
one pass (`--encoder nvenc` on an NVIDIA GPU is much faster). Write a small
`promo/render.sh` that runs the promo's exact steps, so a re-render is one command.

1. **Draft first.** While the user is still reviewing, render half size and light
   (`--scale 0.5 --no-motion-blur --crf 26`) and deliver that; do the full render only
   after their OK. Every revision round goes through a draft.
2. **Use the machine.** One render already runs the scene on every core but two
   (`--workers`) and draws on the GPU, and x264 is usually the slowest part. For a set of
   videos (a tutorial series), render them one after another, or side by side with
   `--workers` ≈ (cores − 2) ÷ lanes; check `nproc` and the load first. `--from`/`--to`
   re-render just a part.
3. **QA the file, not the plan.** Make a contact sheet of the final file (`reel sheet`
   samples the scene; `scripts/contact-sheet.sh` the file) and look at it, *and* scan every
   frame of the file for single-frame glitches (a frame far from both neighbours while
   they agree) — a sheet samples one frame in hundreds and misses them. reel draws the
   same frame the same way every time, so a glitch is in the footage or the timeline (a
   torn capture frame, a keyframe that snaps): fix it there. Play every transition frame
   by frame.

Deliver the path, length, the attribution line(s) to put in the post, and what you didn't
verify (you can't hear the mix).

Projects made before reel use the Remotion engine (`engine/`, `init-video.sh`,
`prep-video.sh`, `render.sh`, `stills.sh`); keep those working, but start new ones in reel.
Their renders go through `chrome-headless-shell` (in the deps; `scripts/browser.sh` sets
it up with its shared memory in `/dev/shm`): plain `chromium` now and then screenshots a
frame before all of it is drawn. `remotion render --sequence` refuses an output dir with a
dot anywhere in its path: give it one relative to the video project. In those projects:

- `prep-video.sh promo [segment …]` copies only the named segments (a re-shoot).
- The app's own sounds are `<Sequence from={…}><Audio src={…}/></Sequence>` cues on the
  markers; `scripts/mix-sfx.sh promo/video <track> <music.json>` renders them alone and
  mixes them over the music (ducked under each cue), then `render.sh promo/video
  promo/video/out/mix.wav promo/video/out/mix.json <out.mp4> 0.3`.
- Stills are slow (about 25 s each, a fresh bundle per still; `stills.sh` runs `JOBS` at
  once): pick 10–26 times per sheet, and run long sheets and renders in the background.

## RESHOOT — the app changed after the promo was made

The approved cut stays; only the footage that shows what changed is recorded again.

1. **Back up** the delivered video and its thumbnail (`promo/out/bkp/`), unless the user
   says otherwise.
2. **Find the segments that show the change**: look at their contact sheets and their
   `events` (a character that only appears at a tier, a UI element in every phone shot).
   Segments that don't show it keep their footage.
3. **Re-record** those segments with the same driver. Check what the driver depends on
   (renamed characters, a new detail level, a new loading screen before the first frame).
4. **Re-pick the moments**: runs may not replay exactly, so every marker the composition
   names (`land.26`, `merge.14`) can be gone. Search the new `events` for each shot's
   pattern, keep footage at or below real speed, and update the markers, offsets and beat
   placements the composition uses. Note the moves in the storyboard ("Re-shot" section).
5. **QA**: stills at every shot's key moment (`reel still … --at`; `stills.sh` in a
   Remotion project), then one `promo-critic` visual pass told that the cut is approved and
   only the re-shoot is under review (it judges legibility, subject size, the app's own
   pop-ups clashing with the overlays, framing). Fix its blockers; a blocker that the
   approved cut already had is reported, not fixed.
6. **Render**, make the thumbnail again, look at a contact sheet of the file, deliver.

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
- **The app's own pop-ups** (score text, combo counters, toasts) are real footage: pick
  moments where they don't contradict the overlays (a "×3" from an earlier chain right
  before the readout's "×2").
- **A frozen app** (paused game, a modal) still draws: check that the frames around each
  marker move.
- Time-dilated capture slows animations but not timers: a caret (or any blink) flickers.
  Hold it steady in the capture build (tutorials.md §4).
- The device frame's camera hole must line up with the screen's cutout — emulators often
  draw theirs off-centre; look at a still of the bare phone.
- Driving a render host with `ssh host bash -s <<'EOF' … EOF`: ffmpeg reads stdin and eats
  the rest of the script. Use `ffmpeg -nostdin` (or `</dev/null`) for every command in it.
