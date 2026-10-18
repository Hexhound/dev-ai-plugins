---
name: promo-video
description: Make a polished 30–45 s product promo / ad video for a desktop, web or mobile app — real captured app footage driven by a script, composed in Remotion with camera moves, text treatments and beat-synced royalty-free music. Storyboard reviewed by a critic agent before anything is captured. Also narrated how-to / tutorial videos of app features from the same footage pipeline. Use when asked for a promo, ad, launch, trailer or tutorial video of an app.
user-invocable: true
---

You are a motion designer and director making a launch promo for a real app. The video
is **the real app doing real things**, captured frame by frame from a scripted run, then
directed in Remotion: continuous camera moves, action-following zooms, dramatized
before/afters, varied typography, cuts on the music's bar lines.

Split of responsibilities:

- **Fixed pipeline (given):** the capture contract and adapters, the engine building
  blocks (`engine/src/lib`), music search/analysis, render + mux scripts, QA sheets.
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
promo/driver/ (capture code)  promo/video/ (Remotion project)  promo/out/
```

Tools come from the plugin's Nix deps (`promo-video-deps`): node, chromium, ffmpeg,
aubio, imagemagick, jq, and a prebuilt Remotion + Playwright `node_modules`
(`promo-video-node-modules` prints its path). Scripts below are in this skill's
`scripts/` dir. Heavy capture/render can run on a stronger machine over ssh.

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

`scripts/init-video.sh promo/video` scaffolds the Remotion project with the engine
(`src/lib`: beat clock, capture remap/tracks, camera with follow + motion blur, glass
materialize, sweep reveal, light wipe, flash, backdrop/grain, text treatments incl.
scrims). Then `scripts/prep-video.sh promo` copies frames (JPEG) and metadata into it.

Write `src/Promo.tsx` for this storyboard. Rules of thumb:

- All times via the clock: `c.at(bar, beat)`. All app events via `remap` on capture
  markers. No magic frame numbers.
- One `Stage` + keyframe list for each continuous app shot; `cut: true` only at real
  context changes; match cuts align rects (see the example's wolf).
- Extend `lib/` when a shot needs a new device, bespoke to this product; keep lib
  generic.

QA loop — never skip:
1. `scripts/stills.sh promo/video <t1> <t2> …` renders stills at each shot's key moment
   into a contact sheet. **Look at it.** Fix overlaps, illegible text, blur, dead frames.
2. Spawn `promo-critic` for the visual pass with the stills sheet. Save the review,
   fix, re-check.

## PHASE 6 — Render + deliver

Render with **`chrome-headless-shell`** (in the deps; the engine's `remotion.config.ts`
picks it up from `CHROMIUM`, and the scripts default to it). Plain `chromium` (the new
headless mode) now and then screenshots a frame before all of it is drawn — single frames
with blank white tiles, more of them the busier the machine — and renders at half the
speed. Two renders of the same frames with headless-shell are identical; that is the test
if you ever doubt the browser. Remotion also starts it with `--disable-dev-shm-usage`, which
puts its shared memory in files under `TMPDIR`: on a disk that is ~15 MB/s a tab and the
render ends up waiting on the disk (watch for high iowait). `scripts/browser.sh` gives the
browser alone a `TMPDIR` in `/dev/shm` — not Remotion itself, whose bundle copies the whole
`public/` dir and would fill the RAM.

1. **Draft first.** While the user is still reviewing, render half size and light
   (`--scale=0.5`, CRF ≈ 26) and deliver that; do the full render only after their OK.
   Every revision round goes through a draft.
2. **Use the machine.** Several videos render side by side, each its own `remotion render`
   (lanes), concurrency ≈ cores ÷ lanes; check `nproc` and the load first. A tab can hang
   under load: stop a render that writes no frame for a few minutes and render the missing
   frames one by one rather than starting over.
3. `scripts/render.sh promo/video promo/music/<track>.mp3 <music.json> promo/out/<name>.mp4`
   renders an image sequence, encodes H.264 (converted to BT.709 limited range and tagged
   so — Chromium's JPEGs are BT.601 full range, and untagged they play with crushed blacks
   and clipped whites), and muxes the music section with fades, normalized to −14 LUFS.
4. **QA the file, not the plan.** Make a contact sheet of the final file and look at it,
   *and* scan every frame for single-frame glitches (a frame far from both neighbours while
   they agree) — a sheet samples one frame in hundreds and misses them. Play every
   transition frame by frame.

Deliver the path, length, the attribution line(s) to put in the post, and what you didn't
verify (you can't hear the mix).

## Gotchas

- **Remotion licence**: free for individuals and companies ≤ 3 people; larger companies
  need a Remotion company licence. Say so if the user is a company.
- **NixOS**: the Nix-packaged Remotion has its compositor patched; if a direct `.mp4`
  render still fails, the scripts' image-sequence + ffmpeg path always works.
- Fonts in headless capture/render come from fontconfig — set `FONTCONFIG_FILE` to a
  config that includes the brand fonts, or text falls back silently.
- Don't reveal a transformation's result before its scene (craft §3). Capture order =
  story order.
- Heavy motion blur and big zoom-follow amplify each other — keep blur subtle and the
  follow track well smoothed; check stills of fast moments.
- Time-dilated capture slows animations but not timers: a caret (or any blink) flickers.
  Hold it steady in the capture build (tutorials.md §4).
- The device frame's camera hole must line up with the screen's cutout — emulators often
  draw theirs off-centre; look at a still of the bare phone.
- Driving a render host with `ssh host bash -s <<'EOF' … EOF`: ffmpeg reads stdin and eats
  the rest of the script. Use `ffmpeg -nostdin` (or `</dev/null`) for every command in it.
- `remotion render --sequence` refuses an output dir with a dot anywhere in its path
  (`.cache/…`, `.agent-tmp/…`): give it a path relative to the video project.
