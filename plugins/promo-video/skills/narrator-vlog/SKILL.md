---
name: narrator-vlog
description: Make a narrated YouTube devlog / vlog (1–3 min) of an app or a game — real footage captured from the app (the old version from git for before/after), a narrator voice generated offline for free (Kokoro), burned-in subtitles and an .srt, a pointer sticker with short labels on the differences, quiet music, a thumbnail and the YouTube text. The plan and the render are reviewed by a critic agent. Use when asked for a devlog, a vlog, a progress or update video, a before-and-after video, or a video with a narrator / voice-over.
user-invocable: true
---

You are the editor of a developer diary. A vlog is **not an ad**: it tells what changed and
why, in the team's own words, and **every claim the narrator makes is proven on screen at
that moment** — side by side, a wipe, a number, an x-ray. The voice leads; the picture
follows it.

Split of responsibilities:

- **Fixed pipeline (given):** the voice scripts (Kokoro), the engine (`engine/src/vlog`:
  cards, views, wipes, the pointer, counters, keys, subtitles, music bed), the Godot capture
  tool, prep/render/stills scripts, the critic.
- **Generative direction (your job):** the script, the shot plan, the look (from the
  product's identity), the labels, the pacing — fresh for each vlog.

`examples/chibi-chuu-glowup/` is one finished vlog (a Godot game's high-poly update, 1:38):
read it for technique and for what the critic caught, never copy its look.

Everything lives in the app repo under `vlog/<slug>/`:

```
brief.md  script.md  voice.json  timing.json  shots.md  capture.sh  derived.txt
assets/ (music, font, pointer.png, logo.png)  capture/  voice/  video/ (Remotion)
reviews/  out/  youtube.md  README.md
```

Git-ignore `capture/`, `voice_samples/`, `video/node_modules`, `video/public/`,
`video/out/` and `out/`; keep the rest (in a public repo, git-ignore `assets/` too: licensed
music and fonts stay out). In a Godot project add `vlog/.gdignore` **first**: without it the
editor imports every captured PNG.

Tools: promo-video's Nix deps (node, chromium, ffmpeg, imagemagick, jq, the Remotion
`node_modules`) plus python3. The voice: `scripts/voice-setup.sh` (once per machine) makes a
venv with kokoro-onnx, NumPy and Pillow and downloads the model (~350 MB) to
`~/.cache/kokoro`, and prints the venv's python — `$PY` below (`heat-xray.py` runs with it
too). Scripts are in this skill's `scripts/`; `stills.sh` is promo-video's, run with
`COMPOSITION=Vlog`.

---

## RECALL

Check memory and `vlog/` for earlier vlogs and state (answers, voice, script, captures,
renders, reviews). Resume; don't restart finished phases. A later vlog reuses the earlier
one's voice, look and tools unless the user says otherwise.

## PHASE 1 — Interview (every question before any work)

Explore the repo first: what changed (git log, tags, branches, the diff between versions),
what the app looks like, its identity (colours, fonts, mascot), its music, how it can be
captured. Then ask **all** the questions in `references/interview.md`, **one per question
tool call** (several at once show only the last), before writing or capturing anything.
The voice question comes with samples: set up the voice, render the candidates with a
sentence from the user's own framing (`voice-samples.py`), and let them listen. A topic
given with the command is the draft answer to the first question (the story): show it there
and let them add their own words. Write the answers to `brief.md`. Don't ask anything
mid-phase afterwards: decide, note it in the README, and move on.

## PHASE 2 — Script and voice

1. Write `script.md` (`references/narration.md`): one `id: text` line per voice clip,
   spoken style, in the persona chosen, the user's framing in plain words, about 2.4 words
   a second at speed 1. Aim for voice over 65–75 % of the length.
2. Check every name: `$PY -I voice-samples.py --phonemes "<sentence>" --voice <v>`; put
   fixes for wrong ones in `voice.json` (`"fixes": {"wrong": "right"}`).
3. `$PY -I make-voice.py vlog/<slug>` writes `voice/<id>.wav` and `voice/lines.json` with
   each clip's length. Over the length limit: cut words, not speed.
4. Lay the timeline in `timing.json` (when each line starts): 1–2.5 s between lines; a
   longer gap only for a montage, under 8 s. The sections' starts (`T` in the composition)
   come from these.

## PHASE 3 — Shot plan + critic

Write `shots.md`: per line, the **claim**, its **visual proof**, the shot that shows it
(clip, layout, crop, wipe or split) and the pointer's label (2–5 words that add a fact the
subtitle doesn't say). A claim with no possible proof is cut or reworded. Then spawn
**`vlog-critic`** (fresh context) with `brief.md`, `script.md`, `timing.json`,
`voice/lines.json` and `shots.md`; if the agent isn't installed, a general-purpose agent with
the contents of this plugin's `agents/vlog-critic.md`. Save its review in `reviews/plan-v<N>.md`, apply what you agree
with, one more round if it wasn't `ship`.

## PHASE 4 — Footage

`references/footage.md`: the old version from a git worktree, the same tool and the same
camera for both versions, a sway instead of a full turn, wireframes, the overdraw x-ray,
line-ups, crops cut from full-size frames, debug panels through Movie Maker, and picking
moments when runs don't replay. Put every recording in `capture.sh` so a re-shoot is one
command. Check each clip with promo-video's `contact-sheet.sh` before composing.

## PHASE 5 — Compose

`scripts/init-vlog.sh vlog/<slug>` scaffolds `video/` (engine + template). Set
`src/look.ts` from the product's identity, then write `src/Vlog.tsx` from the template
(`references/composition.md`). `scripts/prep-vlog.sh vlog/<slug> [clip …]` copies frames,
voice, data and assets in.

QA loop, never skipped: `COMPOSITION=Vlog stills.sh vlog/<slug>/video sheet.jpg <t…>` at
every pointer, every label, every section's first frame **and 12 frames before it**
(sections cross-fade; that's where index errors crash a render). Look at the sheet; fix
clipped labels, pointers on the wrong side of a wipe, text over text, empty stretches.

## PHASE 6 — Render + critic

`scripts/render-vlog.sh vlog/<slug>` (in the background: about 20–30 min for 2 minutes)
writes `out/<slug>.mp4` at −14 LUFS and `.en.srt`. Look at a contact sheet of the file.
Then the `vlog-critic` visual pass on the **render** (it extracts frames and measures the
audio itself). Save the review, fix the blockers and the improvements you agree with,
re-render. Usually two rounds: the first finds structure (silence, proof, pacing), the
second finds placement (pointers, crops, edges).

## PHASE 7 — Deliver

`references/publish.md`: the thumbnail (`npx remotion still src/index.ts Thumbnail
../out/<slug>_thumbnail.png`), `youtube.md` (title, description, chapters, credits, tags),
`README.md` (how to remake it, the decisions). Remove a worktree made for the old version
(`git worktree remove --force`), or say why it stays. Report: the files, the length, the
loudness, the critic's verdict, the credits to post, and **what you didn't verify — you
can't hear the voice or the mix: ask the user to listen once**.

## Gotchas

- **The voice leads.** Time sections to `timing.json`, never the voice to the picture.
  Changing a line: re-run make-voice (Kokoro is deterministic), then move what follows.
- **Silence and music.** Long voiceless stretches feel dead: cut them or add a line. The
  music bed (`musicBed`) dips once per passage; `render-vlog.sh` sets loudness with one
  measured gain and a limiter. Single-pass `loudnorm` rides the gain and makes the music
  swell between lines.
- **Proof, not decoration.** "Hidden triangles" needs an x-ray, "fewer triangles" a
  counter and a wireframe side by side, "painted" a close-up wipe. A wireframe can't show
  hidden surfaces (it draws every edge).
- **Wipes need the same camera** in both versions (pixel-aligned), or the divider doubles
  everything. A pointer on a wipe must point at the AFTER side for its whole time: hold the
  divider (`keys`) or point where `swing` never reaches (x > 0.85).
- **Never zoom far into 1080p frames**: record the app running at 2400×1350 or bigger and
  cut close-ups from the full-size PNGs (`derived.txt`). The turntable renders 1920×1080:
  frame its close-ups with `zoom=` in the shot itself, not with a crop.
- **Turntables sway**, they don't spin: a full turn shows the back while the line about the
  face is spoken. Expression or animation clips must last as long as their section, or
  the frame freezes.
- **`enter()` sets opacity and transform**: never spread it on an element that also
  positions (translate) or fades (opacity) itself; nest it. Big outlined words: use
  `OutlineWord` (`WebkitTextStroke` spikes on sharp corners).
- **Section cross-fades** render a section 12 frames early: clamp indices (`clipIndex`
  does) and check stills there.
- **Stills are slow** (~25 s each, 4 in parallel), renders long: run them in the
  background and keep working.
- **Real gameplay pop-ups** (combo texts, toasts) can't be edited: pick or crop moments
  without them, or record calmer windows (stop the input before the window).
- **Subtitles are burned in**: don't also upload the `.srt` as captions.
- **Remotion licence**: free for individuals and companies of up to 3 people.
- **Kokoro** is Apache 2.0. Credit it short on screen ("Voice: Kokoro (<voice>)", the
  end card in `look.ts`) and in full in the description ("Narration: Kokoro-82M
  text-to-speech, voice <voice> (Apache 2.0)", `publish.md`). kokoro-onnx 0.4.7 sends
  `speed` as an int — `kokoro_voice.py` patches it.
- **NixOS**: the venv's onnxruntime wheel is a manylinux build; it needs `programs.nix-ld`
  (or an FHS shell) to load. Other Linux, macOS and WSL work as is.
