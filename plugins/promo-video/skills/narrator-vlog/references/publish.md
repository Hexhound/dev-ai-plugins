# Publishing

Delivered in `vlog/<slug>/out/`: `<slug>.mp4`, `<slug>.en.srt`, `<slug>_thumbnail.png`; and
`vlog/<slug>/youtube.md`, `vlog/<slug>/README.md`.

## The thumbnail

`npx remotion still src/index.ts Thumbnail ../out/<slug>_thumbnail.png` (from `video/`),
from `Thumbnail.tsx`: 1280×720, under 2 MB. Before and after side by side, big; a headline
of one big word and at most one small one; the product's logo legible at phone size. Check
it at 320 px wide: if a word or the logo doesn't read, make it bigger. Keep confetti and
stickers off the edges.

## `youtube.md`

- **Title**: the product, the topic, a hook, under 70 characters ("Chibi Chuu devlog: the
  glow-up (before and after)").
- **Description**: two sentences of what changed and why, then one line per section, then
  the chapters, the credits and the links the user wants.
- **Chapters**: one per line, `m:ss Name`, the first at `0:00`, at least three, each **at
  least 10 seconds** long (YouTube ignores the list otherwise): merge short sections.
- **Credits**: the music's line exactly as its licence asks ("Music: "Cozy Horizons" from
  Wholesome Place Vol. 1 by Kounine"), "Narration: Kokoro-82M text-to-speech, voice
  af_heart (Apache 2.0)", the studio.
- **Tags**: the product, devlog, the engine, the genre, before and after.
- **Settings to mention**: category (Gaming for a game); the audience question is the
  user's call; the synthetic narrator: YouTube asks to disclose realistic synthetic people
  or events, which a narrator over real footage normally isn't, but ticking it does no
  harm.
- **Captions**: the subtitles are burned in, so don't upload the `.srt` as captions
  (viewers would see two). Keep it for a clean version or translations.

## `README.md` in the vlog folder

What the video is, the files, how to make it again (voice, footage with `capture.sh`, prep,
render, thumbnail), and the decisions (counts and where they come from, why a shot is
framed so, what the critic found and what was changed).

## Before reporting

- Contact sheet of the final file (promo-video's `contact-sheet.sh out/<slug>.mp4 sheet.jpg
  2`) and a look at it.
- Loudness: integrated about −14 LUFS, true peak under −1 dB (`render-vlog.sh` prints both).
- Duration within the user's limit.
- Licensed music stays out of public repos (git-ignore `assets/` if the repo is public).
