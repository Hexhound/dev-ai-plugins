# The narration

## Writing `script.md`

One line per voice clip, `id: text`, grouped under `##` headings (one per section); other
lines are ignored by the scripts. Example:

```
## The chibis: art and triangles
fast: Our first chibis were made fast, just to test the physics and the merging.
waste: They had around thirty thousand triangles each, but many were wasted, hidden inside the body.
```

- **Spoken, short, concrete.** One idea per line, 8–22 words. Say what changed and why,
  with the user's reasons from the interview. No marketing adjectives ("stunning",
  "revolutionary"); no claims the footage can't prove.
- **The persona** chosen: "we rebuilt…", "I rebuilt…", or "the update rebuilds…". Keep it
  the same all the way through.
- **Numbers as words** when they're spoken ("thirty thousand", "two thousand five
  hundred"): espeak reads digits oddly. On-screen counters show the digits.
- **Names**: the product's and characters' names, spelled as the user writes them; fix
  their pronunciation in `voice.json` (below), never by misspelling the script.
- **Rhythm**: start with a hook line over the opening image, end with a short thanks and
  "see you in the next update". About 2.4 words a second at speed 1 (`af_heart`), so
  120 seconds holds about 200 spoken words with pauses.
- **Subtitle breaks**: a line is split at commas and full stops into chunks of 56
  characters at most. Where that splits a phrase badly ("with smoother, / rounded edges"),
  mark the break yourself with `|` ("Every prop was rebuilt too, | with smoother, rounded
  edges…"). The voice never says the `|`.
- **Terms**: speak like a viewer, not like the code. Say "every chibi", not "every tier";
  "Low detail", not "LOD level 1".

## The voice

`voice.json` in the vlog folder:

```json
{"voice": "af_heart", "speed": 1.0, "fixes": {"tʃˈɪbaɪ": "tʃˈiːbi", "tʃˈɪbɪs": "tʃˈiːbiz"}}
```

- `voice`: the one chosen in the interview. Its first letter sets the language for the
  phonemizer (a/b English US/UK, e Spanish, f French, h Hindi, i Italian, j Japanese,
  p Portuguese BR, z Mandarin); `"lang"` overrides it.
- `speed`: keep 1.0. Over the length limit, cut words; a faster voice sounds rushed.
- `fixes`: phoneme replacements, applied to every line. Find the wrong ones with
  `voice-samples.py --phonemes "Welcome back to Chibi Chuu!" --voice af_heart`: it prints
  the IPA espeak makes ("tʃˈɪbaɪ" = CHIB-eye). Write the right IPA (stress mark `ˈ` before
  the stressed vowel, `ː` for long vowels: "tʃˈiːbi" = CHEE-bee). Check the plural and the
  lowercase forms too: they phonemize separately.

`make-voice.py` writes each clip and `voice/lines.json` (id, text, seconds). It's
deterministic: the same line gives the same clip, so editing one line doesn't change the
others' timing.

## The timeline

`timing.json`: `{"vo": {"intro": 1.2, "fast": 9.6, …}}`, seconds from the start.

- The first line starts at about 1 s (after the title pops in); the last ends 4–6 s before
  the end (end card; 5 s or more if the user wants YouTube end-screen elements).
- 1–2.5 s between lines, longer at a section change. A gap over 4 s needs something to watch
  (a montage, a wipe); over 8 s, add a line or cut.
- Sections start a little before their first line (0.4–0.6 s): the picture lands, then the
  voice explains it.
- Put a section's proof exactly under the words that claim it (a line's chunks are spread
  over its length by character count, so "hidden inside the body" in the second half of a
  line lands in the second half of its clip).
