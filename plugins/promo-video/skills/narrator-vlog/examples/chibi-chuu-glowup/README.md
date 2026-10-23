# Example: Chibi Chuu devlog, "the glow-up" (1:38)

A Godot merge game replaced its quick low-poly test characters (v1.0.0) with painted
high-poly ones, rebuilt its props, and kept its day/night cycle and seven modes. This vlog
shows the change, narrated by Kokoro `af_heart` as "we", the studio. Read it for technique;
never copy its look (pastel lilac, Comfortaa, a paw sticker: that's this game's identity).

It was made before the engine was extracted, so `Devlog.tsx` defines its own versions of
what is now `engine/src/vlog` (`Clip`, `View`, `Card`, `Split`, `Wipe`, `Paw` = `Pointer`,
`Counter`, `HeatKey` = `Key`, `RoundWord` = `OutlineWord`, the music bed).

| File | What it shows |
|---|---|
| `script.md` | 13 lines; the user's own reasons ("made fast, just to test the physics"); a `|` fixing a bad subtitle split |
| `timing.json` | the voice-first timeline: lines 1–2.5 s apart, the montage the only longer gap |
| `capture.sh` | the old version from a worktree, the same tools for both, sway clips, the x-ray, line-ups, props on a camera arc, calm night clips, the F1 panel through Movie Maker |
| `Devlog.tsx` | the sections: hook wipe, the model (card aside with counter, x-ray with key), both x-rays side by side, the live F1 panel synced with a wireframe, faces, props and tank wipes, day/night with a push-in, a cropped mode montage, the outro |
| `Thumbnail.tsx` | before/after faces, "the glow-up!", the logo |
| `youtube.md` | title, description, chapters merged to ≥ 10 s each, credits |

## What the critic caught (and what fixed it)

First render, verdict "revise":

- **41 s of 110 without a voice** (a 14 s montage, a static night) → the montage cut to
  1.25 s per mode, the night held 1.5 s after its line, a line added for the tank; 98 s.
- **The music swelled between lines** (0.32 bed, 0.11 under the voice, single-pass
  loudnorm lifting the gaps) → a 0.16 / 0.085 bed dipping once per passage, and one fixed
  gain plus a limiter.
- **"Hidden inside the body" had no proof**: the 30k wireframe was a uniform mush → the
  overdraw x-ray as a heat map (old core 6–9 surfaces deep, new mostly 1–2), with a key.
- **The F1 panel showed only numbers** → the panel cropped big on the left, the 8k / 2.5k
  wireframe swapping in step on the right.
- **Turntables showed the back** while "made with care" was said → a ±35° sway.
- **A weak hook** (8 s of a static title) → the old fox wipes into the new one by 3 s.

Second render, "revise":

- **Pointers on the old side of a moving wipe** → wipes that reveal the new version and
  hold, and a tank pointer where the divider never goes.
- **A soft, blocky tank close-up** (3.3× into 1080p JPEGs) → cut from the 2400×1350 PNGs.
- **The F1 panel's title cut, the score showing through it, "100 ms a frame" visible** →
  re-recorded with an opaque panel and the fps line hidden on the open frame too.
- **The night push-in hid the string lights** while they were named → push in on the pile,
  then pull back to show the lights.
- **A long end card, a sagging montage** → 4 s after the last word.

Smaller fixes along the way: labels clipped at the frame's edge (the bubble's transform was
overwritten by its entrance animation), counters off-centre (the same bug), outline spikes
on the "w" of "glow-up" (round text-shadow outlines), a crash 12 frames before the modes
section (index −1), "every tier" (code jargon) → "every chibi".
