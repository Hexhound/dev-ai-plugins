# store-screenshots

Design high-converting **App Store & Google Play screenshots** as bespoke reel scenes
(TypeScript drawn on the GPU), with photorealistic 3D devices showing the app, rendered
deterministically at exact store dimensions, in every language the listing ships. Fully
offline, **$0, no image-generation API.**

This README is the **reference**. For *how the skill runs* (the guided questionnaire,
design guidelines, phases) read `SKILL.md` — or invoke it:

```
/store-screenshots ~/projects/hexhound/caremate
```

## The core idea

- **The pipeline is fixed**: reel draws the scenes (devices with `cv.model`, text, layout,
  gradients, shadows); the bundled fonts and device models. You drive it, never rebuild it.
- **The design is generative** (the skill's job): every screenshot's layout, colour, type
  and composition is authored fresh to match *this* app's brand. Two sets built with this
  skill should look like they came from two different studios. **Match the app, not a
  house template.**

## Requirements

- **reel**: part of the plugin's `mobile-dev-deps` (it brings ffmpeg, the Vulkan loader
  and fallback fonts; the GPU driver comes from the system). `reel docs models` is the
  device reference, `reel docs` the guide.
- 3D device models are bundled under `assets/models/` (CC-BY-4.0, credits in the NOTICE
  there); fonts under `assets/fonts/` (OFL).

## Use

```bash
scripts/init-screenshots.sh store/screenshots s21-ultra    # types, fonts, the models, lib/, a starter shots.ts
reel check store/screenshots/shots.ts
reel sheet store/screenshots/shots.ts --count 5 --cols 5 -o sheet.png
reel still store/screenshots/shots.ts --at markers -o store/screenshots/final/en/
reel still store/screenshots/shots.ts --at markers -o store/screenshots/final/de-DE/ --set lang=de-DE
```

One scene holds the whole set: a frame per screenshot, a marker naming each; `--at
markers` writes `NAME.png` per marker.

## Directories

| dir | contents |
|---|---|
| `assets/` | bundled fonts + 3D device models (`models/`, with NOTICE) |
| `lib/` | `stage.ts` (a CSS-like radial `glow`, store `SIZES`, `tracking`), `glow.wgsl`; copied into each project |
| `scripts/` | `init-screenshots.sh` (scaffold), `shots.ts` (the starter scene it copies) |
| `examples/` | three worked compositions (`reel still examples/bold-benefit.ts --at 0 -o x.png`); `raw/app.ts` draws their demo app screen |

## Notes

- **Dimensions matter:** the stores reject mismatched sizes (`SIZES` in `lib/stage.ts`).
- **The first screenshot does most of the selling** — treat it (and its thumbnail
  legibility) as the priority; see the DESIGN GUIDELINES in SKILL.md.
- Deterministic + offline: same inputs → same PNGs, no network, no per-image cost.
- Before reel this skill composed HTML with headless Chromium and three.js; that pipeline
  is in git history. reel's devices match its renders (SSIM ≥ 0.997 on the phones) and
  land in the same place.
