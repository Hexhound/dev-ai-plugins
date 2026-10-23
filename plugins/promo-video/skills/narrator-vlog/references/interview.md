# The interview

Ask everything below **before** any work, **one question per tool call** (the question tool
shows only the last of several parallel calls). Each question with fixed answers gets 2–4
options, each with a one-line trade-off, the recommended one first and marked
"(Recommended)". Skip a question the repo or an earlier vlog already answers, and say what
you assumed. Write every answer to `brief.md`.

Order matters: the framing first (it feeds the samples), then the language, then the voice.

## 1. The story, in their words (open)

"What should this video tell? In your own words: what changed, why, what you're proud of,
what was wrong before." Their answer is the script's backbone: keep their reasons and
words ("I did it super fast to test the physics"; "now I had more time and care"). Don't
invent motives they didn't give.

## 2. Language of the narration

Options from what Kokoro speaks well: English (Recommended for YouTube reach), Brazilian
Portuguese, Spanish, French, Italian, Hindi. Japanese and Mandarin need extra phonemizer
packages: offer them only after a sample works.

## 3. The voice (with samples)

Run `voice-setup.sh`, then `voice-samples.py <vlog>/voice_samples --text "<one sentence
from their framing, with the product's name>" --voices <4–5 voices>` and give the paths so
they listen. Good first picks:

| Language | Voices to sample |
|---|---|
| English (US) | `af_heart` (warm, the best-rated), `af_bella`, `am_michael`, `am_fenrir` |
| English (UK) | `bf_emma`, `bm_george` |
| Portuguese (BR) | `pf_dora`, `pm_alex` |
| Spanish | `ef_dora`, `em_alex` |
| French / Italian | `ff_siwis` / `if_sara`, `im_nicola` |

`voice-samples.py --list` prints every voice. Mention a mixed sample (a Portuguese sentence
in an English voice) sounds wrong: match the voice to the language. If the product's name
comes out wrong in the samples, say you'll fix its pronunciation.

## 4. Who speaks

- "We", the studio (Recommended for a team or brand channel)
- "I", the developer (personal channel)
- Neutral, third person ("the update brings…")

## 5. Length

- Under 2 minutes (Recommended: a devlog people finish)
- 2–3 minutes (room for more topics)
- About 60 seconds (one change, for Shorts-style posting)

A hard maximum ("max 2 min") is a constraint: keep under it, with the end card included.

## 6. Topics (multi-select)

Offer the 4–7 visible changes the repo shows (from the diff between versions, the changelog,
the README), each one line. Their picks are the sections, in a logical order: the biggest
change first, the whole-product montage last.

## 7. Footage

Which build to show: desktop landscape (Recommended for YouTube, 16:9), phone portrait in
a 16:9 frame, or both. And from where: the real app captured by script (always; never mock
the product).

## 8. Before and after

If there's an older version worth comparing: which one (a git tag or commit, with its
date). Options: compare with `<tag>` (Recommended when the update is visual), no
comparison (a feature tour). The old version runs from a git worktree with the capture
tools copied in (`footage.md`).

## 9. Music

- The product's own music, quiet under the voice (Recommended: on brand, already licensed —
  check its licence covers YouTube)
- A CC BY track (promo-video's `music-search.mjs`; the credit goes in the description)
- No music

## 10. The pointer

What points at the differences: a paw, a hand, an arrow, the mascot's mitten. Use a sticker
from the product's own art when it has one; otherwise draw a simple one (pointing up, PNG,
transparent). Labels are short and in the narration's language.

## Not asked (decide and note)

Subtitles: burned in plus an `.srt` (always; most people watch muted). Resolution: 1920×1080
at 60 fps. The thumbnail and YouTube text are part of the delivery. The look follows the
product's identity.
