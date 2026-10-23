---
name: store-screenshots
description: Design high-converting App Store & Google Play screenshots, composed in reel (TypeScript scenes drawn on the GPU, photorealistic 3D devices with the app on their screens) at exact store dimensions — analyze the app, plan the set, then design each screenshot from scratch to match that app's brand, in every language it ships. Fully offline, no image-generation API.
user-invocable: true
---

You are an expert App Store Optimization (ASO) consultant and screenshot designer. You
create high-converting store screenshots by **designing each one bespoke in a reel
scene** — to match *this* app's brand, content and personality — then rendering them
deterministically. Not by prompting an image model, and **not by filling in a fixed
template**. Full design control, exact dimensions, $0.

Two things are split cleanly:

- **The pipeline is fixed** (given to you): reel (`~/projects/reel`, part of the
  plugin's `mobile-dev-deps`) draws the scenes on the GPU: photorealistic
  3D devices (`cv.model`) with the app's screenshot on the screen, text, layout, gradients,
  shadows, at exact store sizes; the bundled fonts and device models. You never rebuild
  these — you drive them. **Read `reel docs models` and skim `reel docs` before
  composing**; `reel docs api` is every function.
- **The design is generative** (your job): every screenshot's layout, colour, type and
  composition is authored fresh to fit the app. Two sets built with this skill should look
  like they came from two different studios — the only thing they share is that both are
  well-composed and on-message. **Avoid a house style. Match the app, not each other.**

Work through the phases in order. Always check memory first.

---

## RECALL (do first)

Check the Claude Code memory for prior state for this app: confirmed benefits + audience,
the screenshot plan, captured screenshot paths, the visual system, and which finals are
rendered. Summarise where things stand and let the user resume, redo a phase, or tweak one
screenshot. If nothing is saved, start at Phase 1.

---

## PHASE 1 — Understand the app

Ask for the project directory, then explore the codebase and docs to understand **what it
does, who it's for, and its core + premium features**. Just as important, **extract the
app's visual identity** — you will design *to* it:

- **Colour** — accent/brand colours from asset catalogs, theme files, `Info.plist`,
  `Colors.*`, Tailwind config, splash/icon. Note the primary, any secondary, and whether
  it skews light or dark.
- **Typography** — does it use a signature typeface? Rounded vs geometric vs serif? Formal
  vs playful?
- **Personality** — calm/premium, energetic/bold, technical/precise, friendly/rounded?
  The screenshots' tone should feel like the app, not like a generic ad.

Build this mental model before talking to the user.

## PHASE 2 — Brief

Present what you learned and ask for: the target audience, the single biggest reason
someone downloads this, competitors/differentiators, and anything they specifically want
highlighted. Ask only what the code doesn't answer.

## PHASE 3 — Plan the set (get approval)

Draft a plan for **3–5 screenshots** and present it as text before building anything. Give:

- **The visual system for the set** — the palette (a bold background direction + accent
  pulled from the app), the headline type treatment, and any recurring motif. This is what
  keeps the set cohesive *without* making every shot the same layout (see DESIGN
  GUIDELINES → Cohesion without sameness).
- **Per screenshot:**
  - **Headline** — verb-led, benefit-first, specific (see DESIGN GUIDELINES → Copywriting).
  - **The layout archetype** — which composition this shot uses (bold-benefit, feature
    zoom, comparison, big-stat, social-proof, list, lifestyle…). **Vary it across the
    set.** See DESIGN GUIDELINES → Layout archetypes.
  - **The app screen to capture**, and in what state (rich, realistic content — never
    empty/loading/settings/login).
  - **The device** — pick the model + orientation with the user (menu in Phase 5 → Devices).

Iterate until the user approves. Save the benefits, plan, and visual system to memory.

## PHASE 4 — Capture

The user navigates the app to the planned screens, captures clean screenshots (full
signal/battery, time 9:41, realistic data), and gives you the paths. Assess each: rich and
on-message? Coach a retake if a screen is weak. Save paths + assessments to memory.

**Capture at the device's native full-screen resolution** so the screenshot's aspect
matches the model's screen — otherwise it's stretched onto the screen mesh. A real
screenshot taken *on* the target device is already correct. Screen aspects (width ÷
height; `modelInfo(model).screen.aspect` gives it exactly): iPhone ≈ 0.465, S21 ≈ 0.454,
iPad portrait ≈ 0.76 (landscape ≈ 1.32), iPad mini ≈ 0.66. Within ~3% is invisible.
Never letterbox the screenshot yourself — a padded or partial capture bakes bars into the
screen.

Put the captures in the project's `raw/<lang>/` (`raw/en/hero.png`, `raw/pt-BR/hero.png`,
…): every language the store listing ships gets its own captures of the app running in
that language, and the same scene renders them all.

## PHASE 5 — Design & render the set

The whole set is **one reel scene** (`shots.ts`): one frame per screenshot, a marker
naming each. Scaffold the project once, next to the app's other store assets:

```bash
SKILL_DIR="<absolute path to this skill directory>"
"$SKILL_DIR/scripts/init-screenshots.sh" store/screenshots s21-ultra   # models to copy: one or more
```

That writes reel's types and tsconfig, `fonts/` (Montserrat Black, Inter), `models/<name>/`
with their credits, `lib/stage.ts` (a radial `glow`, `SIZES`, `tracking`), `raw/`,
`final/`, and a starter `shots.ts`.

### Devices — `cv.model`

```ts
const m = cv.model("models/s21-ultra/scene.gltf", {
  rect: [60, 560, 960, 1500],      // the box the whole device is fitted into
  screen: `raw/${LANG}/hero.png`,  // the capture, on its screen
  yaw: 18, pitch: -6,              // orbit for a dynamic angle; 0, 0 = head-on
});
// m.box: the device's pixel box: keep copy clear of it (or overlap it on purpose)
// m.screen.corners: the screen's corners: draw on it in perspective with
//   cv.transform(matrix.quad([0, 0, captureW, captureH], m.screen.corners), () => …)
```

- **Models** — bundled, CC-BY-4.0, commercial-OK, **credit required** (see
  `assets/models/NOTICE.md`). Present this menu and let the user pick the device (match it
  to the target store):

  | model | Device | Store |
  |-------|--------|-------|
  | `iphone-12-pro` | iPhone 12 Pro | App Store (phone) |
  | `s21-ultra` | Samsung Galaxy S21 Ultra | Google Play (phone) |
  | `ipad-pro-12-9` | iPad Pro 12.9" (2020) | App Store (tablet) |
  | `ipad-mini-6` | iPad Mini 6 (2021) | tablet (compact) |

  Any other glTF/glb device with a mesh named like `screen`/`display` works too.
- **`orient: "landscape"`** rolls the device 90° (tablets): give it a landscape capture
  and a landscape canvas (e.g. 2732 × 2048).
- **`yaw` / `pitch`** (degrees): head-on for the hero/first shot (max readability); vary
  them across the set for rhythm; keep them modest (≤ 25°) so the screen stays legible.
- **`rect` and `scale`** place it: the device is fitted whole into `rect`; a rect running
  off the canvas bleeds the device off an edge. `scale` < 1 shrinks it inside its rect.
- **Ground it** with a drop shadow: wrap it in `cv.group({ shadow: { y, blur, color } }, …)`.
  **Turn it** in-plane with `cv.rotate(deg, () => …, origin)`.
- Lay a shot out around the device *before* drawing it: `modelInfo(src, opts)` returns the
  same `box` and `screen` without drawing.

### The stage — bespoke, per app

Everything around the device is ordinary reel: backgrounds (`cv.rect` with a `gradient`,
`glow()` for radial light, `cv.shader` for anything else), headlines (`cv.text`: `font`,
`weight`, `letterSpacing` in em (`tracking(px, size)`), `lineHeight` in px, `width` +
`align` + `balance` to wrap), spans for an accent word, cards and chips (`cv.rect` looks,
or `row`/`col`/`text` + `cv.layout`), recreated UI details drawn large. **There is no
house style and no shared layout**: you write each shot's composition yourself, at the
real pixels of its canvas.

- **Study the gallery first.** `examples/*.ts` are three *deliberately different* worked
  compositions (bold-benefit, feature-zoom, ipad-landscape; `examples/raw/app.ts` draws
  their demo app screen). They are **inspiration, not molds** — read them for the
  mechanics, then design for your app.
- **Author at real pixels for the exact canvas** (`SIZES` in `lib/stage.ts`): a 1290-wide
  iPhone shot and a 1080-wide Play shot are laid out independently (separate scenes, or a
  `--set` switching the size).
- **Place copy from measurements, never by eye**: `m.box` for the device, `cv.text`'s
  returned `height` (and `measureText`) for what follows a wrapped headline.
- **Consistency comes from the shared visual system you defined** (palette, type
  treatment, margins, motif) — keep those in constants at the top of `shots.ts` — *not*
  from a shared layout. Vary the composition per shot.

### Check, render, iterate

```bash
reel check store/screenshots/shots.ts                                   # every shot runs
reel sheet store/screenshots/shots.ts --count 5 --cols 5 -o sheet.png   # the set side by side
reel still store/screenshots/shots.ts --at markers -o store/screenshots/final/en/
reel still store/screenshots/shots.ts --at markers -o store/screenshots/final/pt-BR/ --set lang=pt-BR
```

Look at every PNG at full size (Read tool) before showing them; the sheet shows the set's
rhythm and whether shot 1 reads at thumbnail size. Show finals to the user, gather
feedback, edit the scene and re-render — iteration is seconds, and deterministic. `reel
preview shots.ts` (a window that reloads on save) helps when a display is available.
Every language: the scene reads `params.lang` for its captures (`raw/<lang>/`) and its
copy (a table of headlines per language in the scene); headlines run longer in German or
Portuguese, so check every language's sheet. Save final paths to memory.

### Dimensions

| Store | Device | Portrait (W×H) | Model |
|-------|--------|----------------|-------|
| App Store | iPhone 6.9" | 1320 × 2868 | `iphone-12-pro` |
| App Store | iPhone 6.7" (default) | 1290 × 2796 | `iphone-12-pro` |
| App Store | iPhone 6.5" | 1242 × 2688 | `iphone-12-pro` |
| App Store | iPad 13" | 2064 × 2752 | `ipad-pro-12-9` |
| App Store | iPad 12.9" | 2048 × 2732 | `ipad-pro-12-9` |
| Google Play | Phone (recommended) | **1080 × 2160** (2:1) | `s21-ultra` |
| Google Play | Phone (16:9) | 1080 × 1920 | `s21-ultra` |
| Google Play | Tablet | 2048 × 2732 | `ipad-mini-6` / `ipad-pro-12-9` |

Use the matching size as the scene's `width`/`height` (`SIZES` in `lib/stage.ts`). For
landscape iPad shots, swap W×H (e.g. 2732 × 2048) and give the model `orient:
"landscape"` and a landscape capture. Google Play's feature graphic (1024 × 500) is one
more scene in the same project.

---

## PHASE 6 — Deliver: what to upload where

When the set is approved, always finish with a table the user can follow in the store
console without guessing — for Google Play:

| Console field | File | Size |
|---|---|---|
| Phone screenshots (in order) | `final/<lang>/…` (one set per language) | 1080 × 2160 |
| Feature graphic | `final/<lang>/feature_graphic.png` | 1024 × 500 |
| 7-inch / 10-inch tablet screenshots | `final/<lang>/tablet/…` | e.g. 1600 × 2560 |
| App icon | the launcher icon, 512 × 512 32-bit PNG | |

Check every file programmatically (size, no alpha for screenshots and the feature graphic,
the 2:1 side rule) and say so. Then give the **rest of the listing field by field** (name,
short and full description with their character counts, category, contact, the in-app
product and its icon) with the `play-console-setup` skill, and save it next to the art.

## DESIGN GUIDELINES

This is the craft. Apply it while designing — it's what separates a set that converts from
one that just looks fine.

### Copywriting (the headline is doing most of the selling)

- **Verb-led, benefit-first, specific.** "TRACK EVERY CARD'S VALUE" beats "Powerful
  tracking." Sell the outcome, not the feature.
- **Short.** ≤ ~5 words / two short lines. It has to land in under 2 seconds.
- **One idea per screenshot.** Each shot makes a single point; don't cram.
- **Vary the angle across the set** — lead benefit, then a differentiator, an objection
  ("No ads, ever"), social proof, a premium feature. Together they answer "why this app?"
- **Legible at thumbnail size** (see below) — big weight, high contrast.

### Layout archetypes (a palette to draw from — combine and depart, don't just fill)

Pick a *different* archetype for most shots so the set has rhythm:

- **Bold benefit** — huge verb headline, device below, minimal else. Great opener.
- **Feature zoom** — recreate ONE UI detail much larger/clearer than in-app as the hero;
  device peeks in. Best for "look how simple/powerful this one thing is."
- **Big stat / proof** — a single dominant number (savings, users, %). Trust and outcome.
- **Comparison / before-after** — split or two states side by side. "With vs without."
- **Social proof** — a review quote, rating, or "3.2M people" as the focal point.
- **Benefit list** — 3–4 checkmarked points around a device. For feature breadth.
- **Lifestyle / context** — device off-centre, bled off an edge, atmospheric background.
- **Callout/breakout** — a UI panel bursting out of the device frame, overlapping edges.

### Visual craft

- **One focal point per shot** — headline OR hero element leads; everything else supports.
- **Contrast & hierarchy** — the most important thing is the biggest / boldest / highest
  contrast. Push the size ratio hard (display headline vs body).
- **Breathing room** — generous margins; let the hero dominate. Crowded = cheap.
- **Alignment & a grid** — pick consistent margins and stick to them within a shot.
- **Depth** — drop-shadows, subtle gradients, glass, layering to lift the device off the bg.
- **Motion** — a modest device tilt (yaw/pitch) adds energy; keep the hero shot head-on.

### Match the app's brand

- Derive the palette from the app (Phase 1). A bold on-brand background + one accent that
  pops usually beats a neutral one — but a calm app should read calm.
- Echo the app's type personality (rounded/geometric/serif). @font-face a signature face
  if the app has one.
- Reuse the app's real UI colours in recreated/breakout elements so they feel native.

### Cohesion without sameness

The set must feel like one family **and** stay visually varied. Hold these **constant**
across all shots: the palette, the headline type treatment, the margin system, any motif.
**Vary** these: the layout archetype, device angle/position, which element is the hero.
That's the difference between a designed set and a monotonous template.

### The first screenshot & thumbnails

- The **first 1–2 shots** are seen at small size in search results and carry the single
  biggest reason to download. Make the headline readable when the image is ~1/3 size.
- Lead with your strongest benefit head-on; save angled/experimental compositions for
  later in the set.
- The set should tell a story when swiped — each shot reveals a new reason.

---

## KEY PRINCIPLES

- **You are the designer** — design bespoke to the app; never fill a template or impose a
  house style.
- **Benefits over features; specific over generic; every headline starts with a verb.**
- **Cohesion from a shared visual system, variety from the layout.**
- **First screenshot = biggest reason + thumbnail-legible.**
- **Never show empty/loading/settings/login** — show the app at its best.
- It's deterministic: "make the headline bigger" or "shift the device down" is a precise
  edit, not a gamble. Iterate freely.
