# Tutorials — narrated how-to videos from the real app

A tutorial is a different film from a promo: 25–60 s, one feature, the real app filmed
doing it step by step, a narrator saying what to tap, captions, and a ring on what the
viewer should look at. It backs an in-app "?" button or a help page, so it is watched by
someone trying to *do* the thing — clarity beats spectacle. Every rule here exists because
an owner's frame-by-frame review flagged its absence as amateurish.

Pipeline (same capture contract as the promo, a different edit):

1. **Take** — a script drives the app from a fresh, seeded state and records segments with
   a marker on every action (`save.tap`), the rect of everything the camera frames or a
   ring circles, and the finger's track.
2. **Spec** — per video, steps: a capture range, the line said over it, a header label,
   camera keys and rings, all timed by capture markers or by a word of the line
   (`say:save`).
3. **Voice** — every line spoken with several seeds; speech-to-text keeps the takes heard
   word for word; the closest delivery to the reference wins; word times are kept for
   `say:` timing and karaoke captions.
4. **Build** — the spec becomes a frame timeline: footage holds while a line finishes,
   rings and taps are put in order (below), steps that don't continue each other crossfade.
5. **Render** — draft first, full after the OK (SKILL.md, phase 6).

## 1. A ring comes before its tap, and ends with it

The narrator names a button; a ring appears on it; *then* the finger presses it. A ring
that shows up after the screen has moved on "highlights nothing".

- Up ≥ 0.75 s before the press, gone at the press. When the line names the button later
  than the footage taps it, **freeze the footage just before the press** (≈ 0.25 s before,
  so the finger still settles) until the ring has been up long enough — never move the ring
  late.
- No ring lasts into a crossfade or starts inside one; drop a ring that would be up for
  less than ~0.4 s.
- Ring only what is acted on or what changes. Never ring an option that is already
  selected, or a control the take didn't actually need to tap.
- A ring hugs its target. Measure the smallest node that is the target (a chip, not the
  card holding its label); padding in proportion to the target (≈ 0.2 of its short side,
  10–18 px). Where the label has no node of its own, measure the box from the frame.
- Check in the build that every ring is inside what the camera shows (not under the
  header or caption fades) for its whole life.

## 2. One smooth scroll, or a cut

Never several short scrolls in a row — a helper that drags a fixed distance and checks
again reads as fumbling. Scroll once, sized to the target, with an ease-out drag (a slow
eased start can register as a long press). If the target is far, cut instead.
Never scroll to something already on screen — a helper that decides "on screen" by the
bottom bar's top must know a sheet has none, or it swipes at a button already in view and
the footage stands still for seconds. A drag that moved nothing means stop.

## 3. The camera shows what is being done

- A sheet opening at the bottom, a field being typed into, a row being tapped: frame it
  before the action, not after.
- Nothing the line talks about sits under the caption band or the header fade — move the
  camera, or scroll the app so the subject is in the middle.
- A web page in a browser: **show the whole page and scroll it; don't zoom**. A zoom (even
  one that starts after the page has loaded) reads as a cropped page.
- Don't linger on empty parts of a screen; pull back after the action.

## 4. The app must look still when it is still

- Time-dilated capture (the app slowed so the emulator can keep up, then retimed) slows
  animations, but **not timer-driven UI**: a text caret blinks N× too fast. Make the
  capture build hold the caret steady (Flutter: `EditableText.debugDeterministicCursor =
  true`), and avoid typing into system UI you can't change (search fields in launchers,
  pickers).
- With the caret steady, turn off "show password characters" so a typed password's last
  letter isn't left on show.
- **No on-screen keyboard at all.** One that opens and closes between fields drops the
  sheet and lifts it again — the form jumps; one that stays up hides half the screen.
  Text appearing in a field with its caret reads fine on its own.
  - Android: install `capture/android/nokeyboard` (`build.sh`): an input method that
    never shows and commits typed keys itself; type with adb `input text`. The obvious
    shortcuts fail: Gboard can't be switched off (the system turns it back on);
    "hardware keyboard, hide the on-screen one" leaves a black navigation strip with
    keyboard icons; Google's autofill input method shows its own panel; an input method
    that lets typed keys through to the app takes the window out of touch mode, and a
    Flutter app then wears a focus outline round the whole screen.
  - iOS Simulator: I/O → Keyboard → Connect Hardware Keyboard.
  - Driver helpers that "hide the keyboard" with Back must check that one is actually
    visible (Android: `mIsInputViewShown`, not `mInputShown`), or Back leaves the screen.
  - A typed key that reaches an app with no field focused still takes the screen out of
    touch mode; an app opened then keeps the outline until it's opened again. Check the
    screen edge after resetting the app and relaunch if it's there.
- **Film on an idle machine.** A render (even at low priority) beside an emulator take
  halves the frames the emulator delivers: animations stutter. Film everything, then render.
- System pickers remember state (last folder, last choice): the take must detect and adapt
  to it, and clear leftovers (old exports) first.
- Check the device's display cutout lines up with the mockup's camera hole; emulators
  often draw it off-centre. Patch it in the composition if needed.

## 5. Narration

- Every shot that shows something has a line about it; silences over ~3 s get a short line
  ("Here, next Thursday morning.") or get cut.
- End on a closing line that says what the viewer now has ("Everything you add stays on
  the journey…"), never an abrupt stop after the last tap.
- Wording about privacy and data never implies the company holds the user's data ("not even
  <Company> can open it" reads as if they have it). Claim only what is true of the app.
- Same voice as the promo; −16 LUFS for tutorials (the promo's −14 is for ads), music bed
  quiet under the voice.

## 6. Review loop

- Look at every step's start, every tap and every ring on a strip of stills before
  rendering; play every crossfade frame by frame.
- Owner review on **drafts** (half size, fast); the full render only after their OK.
- Scan the full render frame by frame for single-frame glitches (a frame unlike both its
  neighbours) — a contact sheet samples and misses them.

## 7. Another language

The same videos in another language are the same edit with every word and every frame
replaced: film them again, don't overdub. Keep one source of the timing.

- **One switch, separate copies.** A single language variable that every script reads; each
  language its own footage, voice picks, timelines and outputs next to the original's, so
  one never overwrites the other. The tutorial specs stay the original's, with a translation
  file laid over them: the words, and which translated word each "when the voice says X"
  time waits for.
- **The whole device in that language**, not just the app: the launcher, the photo picker,
  the notifications and the widget picker show up in the takes. On an emulator image with
  no root, a tiny helper app granted `CHANGE_CONFIGURATION` and `WRITE_SETTINGS` over adb
  (and hidden APIs allowed) can call `LocaleManager.setSystemLocales`.
- **The demo data in that language**, with that country's names, phones, prices and
  clinics; and translated paper props (a prescription that gets scanned must read in the
  language, laid out like the original so anything timed to its lines still lines up).
- **The take scripts translate what they look for and type**, from the app's own string
  files first, then a short hand-written table for the system's screens, typed text and
  partial texts; a text with no translation stops the take naming it, rather than failing
  later on a missing button. The same English word can differ by place ("Done" →
  "Concluído" / "Pronto"): let the scripts name the place. adb's `input text` types ASCII
  only: keep typed text free of accents.
- **Film it and look at every sheet**: anything still in the original language on screen is
  an app bug (hard-coded strings, fixed date patterns like `MMM d` instead of locale
  skeletons, hand-made month tables, widget resources never translated, plurals). Fix the
  app, rebuild, film those takes again.
- **The voice**: a multilingual TTS with the same reference clip; whisper in that language
  to judge takes. Find the brand's spelling hint by ear-proxy: generate a sentence with a few
  spellings and keep the one whisper writes back as the brand. Short promo lines: they must
  fit the original's bars.

## Tutorial checklist (critic, and you before each render)

1. Every ring up ≥ 0.75 s before its tap, gone at it; none through a crossfade? (§1)
2. Any ring on something already selected, or not acted on? Any oversized ring? (§1)
3. Any run of short scrolls, or a scroll to something already visible? (§2)
4. Is the subject of every line on screen, clear of caption and header? (§3)
5. Web/browser views: whole page, scrolled, never zoomed? (§3)
6. Caret steady; no on-screen keyboard anywhere; nothing flickers? (§4)
7. Silences > 3 s, or stretches where nothing moves? A closing line? Privacy wording
   true? (§5)
8. Full render scanned frame by frame for glitches? (§6)
9. Another language: nothing on screen still in the original language — app, system,
   props, demo data? (§7)
