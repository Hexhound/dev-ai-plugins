// Building blocks for depth and light: the backdrop, grain, the product window, glass that
// fills with the app, light sweeps and wipes, a flash. Tint and shape them per product;
// don't reuse a look.
//
// Remotion's components filled their parent; these draw into a `rect` in the current
// coordinates (inside `stage`, window px; default the whole frame) and take what they
// reveal as draw callbacks. Shaders (the .wgsl files next to this one) do what boxes and
// gradients can't. Differences from the browser, as reel allows:
// - A shader can't read what is under it, so `mix-blend-mode: screen/overlay` are drawn as
//   normal alpha (a white light over a dark window looks the same; grain approximates
//   overlay), and `backdrop-filter` is `frosted()`: you redraw what is behind, blurred.
// - CSS `filter: brightness()` has no equivalent: glassMaterialize lifts the content toward
//   white instead.
// - Layer masks are in screen coordinates: a masked block inside `stage` needs the stage's
//   matrix (`stage` hands it to its callback) as `m`.
import { type Canvas, type Color, type Look, type Matrix, alpha, interpolate, matrix, random } from "reel";
import type { Rect } from "./capture.ts";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// This file's shaders sit next to it (relative paths resolve against the scene file).
const wgsl = (name: string) => `${import.meta.dirname}/${name}`;

const rgbaOf = (c: Color) => alpha(c, 1) as number[];
const full = (cv: Canvas): Rect => [0, 0, cv.width, cv.height];

// ── the backdrop ─────────────────────────────────────────────────────────────────────────

/** A soft light drifting on the backdrop: colour, top-left (x, y) and size of its square, drift period `speed` (frames per radian) and `phase`. */
export type Blob = { color: Color; x: number; y: number; size: number; speed: number; phase: number };

/**
 * The full-bleed backdrop: `base` colour, up to 7 blurred `blobs` of light drifting slowly
 * (±120 px across, ±90 px down), a dark vignette (`vignette`, 0…1 at the corners) and living
 * grain (`grain`, overlay strength). One shader over `rect` (default the frame).
 */
export const backdrop = (
  cv: Canvas,
  f: number,
  opts: { base: Color; blobs: Blob[]; vignette?: number; grain?: number; blobOpacity?: number },
  rect: Rect = full(cv),
) => {
  const { base, blobs, vignette = 0.65, grain: g = 0.05, blobOpacity = 0.55 } = opts;
  if (blobs.length > 7) throw new Error(`backdrop: at most 7 blobs (got ${blobs.length})`);
  const b = rgbaOf(base);
  const params = [b[0], b[1], b[2], vignette, g, Math.floor(f) % 997, blobs.length, 40];
  for (const blob of blobs) {
    const left = blob.x + Math.sin(f / blob.speed + blob.phase) * 120;
    const top = blob.y + Math.cos(f / (blob.speed * 1.3) + blob.phase) * 90;
    const c = rgbaOf(blob.color);
    // radial-gradient(circle, colour 0%, transparent 65%): farthest-corner radius s/√2
    params.push(left + blob.size / 2, top + blob.size / 2, (0.65 * blob.size) / Math.SQRT2, 0, c[0], c[1], c[2], c[3] * blobOpacity);
  }
  cv.shader(wgsl("backdrop.wgsl"), { rect, params });
};

/** Film grain over everything drawn before it, `opacity` 0…1 (0.04–0.08 reads as film), new every frame. */
export const grain = (cv: Canvas, f: number, opacity: number, rect: Rect = full(cv)) => {
  if (opacity > 0) cv.shader(wgsl("grain.wgsl"), { rect, params: [opacity, Math.floor(f) % 997, 0, 0] });
};

// ── the window ───────────────────────────────────────────────────────────────────────────

/**
 * The product window at `rect`: a deep shadow, a 1 px edge light, an accent `glow`, rounded
 * corners (`radius`); `draw` draws its content clipped to it (a capture frame:
 * `frameImage(cv, framePath(c, i), rect)`). Under `stage`, rect is [0, 0, base, base·h/w].
 */
export const window = (cv: Canvas, rect: Rect, glow: Color, draw: () => void, radius = 14) => {
  const [x, y, w, h] = rect;
  cv.rect(x, y, w, h, {
    fill: "transparent",
    radius,
    shadow: [
      { y: 70, blur: 160, color: "rgba(0, 0, 0, 0.7)" },
      { spread: 1, color: "rgba(255, 255, 255, 0.14)" },
      { blur: 140, color: glow },
    ],
    clipShadows: true,
  });
  cv.clip(rect, radius, draw);
};

/** A captured frame (or any image) filling `rect` (the Remotion lib's `Frame`; renamed beside camera's `frame`). */
export const frameImage = (cv: Canvas, src: string, rect: Rect, look?: Look) => cv.image(src, rect[0], rect[1], rect[2], rect[3], look);

/**
 * backdrop-filter, as reel allows: redraws what is behind `rect` (`behind`, e.g. the
 * backdrop call) blurred by `blur` px and clipped to the rounded rect. Inside `stage`, pass
 * the stage matrix as `m` so screen-space `behind` lands where it is on screen.
 */
export const frosted = (cv: Canvas, rect: Rect, radius: number, blur: number, behind: () => void, m?: Matrix) => {
  cv.clip(rect, radius, () => cv.group({ blur }, () => (m ? cv.transform(matrix.invert(m), behind) : behind())));
};

// ── light ────────────────────────────────────────────────────────────────────────────────

// A CSS gradient line's point at fraction t, for `angle` over rect.
const cssLine = (rect: Rect, angle: number) => {
  const a = (angle * Math.PI) / 180;
  const d: [number, number] = [Math.sin(a), -Math.cos(a)];
  const len = Math.abs(rect[2] * d[0]) + Math.abs(rect[3] * d[1]);
  const cx = rect[0] + rect[2] / 2;
  const cy = rect[1] + rect[3] / 2;
  return { d, at: (t: number): [number, number] => [cx + (t - 0.5) * len * d[0], cy + (t - 0.5) * len * d[1]] };
};

// A layer mask's line (screen space) for a gradient running from local a0 to a1 along d,
// under m: the iso-lines are mapped, so the edge stays straight on a tilted window.
const maskLine = (m: Matrix | undefined, a0: [number, number], a1: [number, number], d: [number, number]): [number, number, number, number] => {
  if (!m) return [a0[0], a0[1], a1[0], a1[1]];
  const p0 = matrix.apply(m, a0[0], a0[1]);
  const p1 = matrix.apply(m, a1[0], a1[1]);
  const q0 = matrix.apply(m, a0[0] - d[1] * 100, a0[1] + d[0] * 100);
  const ex = q0[0] - p0[0];
  const ey = q0[1] - p0[1];
  const el = Math.hypot(ex, ey) || 1;
  let nx = -ey / el;
  let ny = ex / el;
  const k = (p1[0] - p0[0]) * nx + (p1[1] - p0[1]) * ny;
  if (k < 0) {
    nx = -nx;
    ny = -ny;
  }
  const s = Math.abs(k);
  return [p0[0], p0[1], p0[0] + nx * s, p0[1] + ny * s];
};

/** A CSS three-stop gradient band (transparent, `color`, transparent at fractions s0 < s1 < s2 of the `angle` gradient line) over `rect`. */
export const band = (cv: Canvas, rect: Rect, angle: number, s0: number, s1: number, s2: number, color: Color) => {
  const c = rgbaOf(color);
  cv.shader(wgsl("band.wgsl"), { rect, params: [angle, s0, s1, s2, c[0], c[1], c[2], c[3]] });
};

/** A radial light: `color` at (cx, cy) fading linearly to transparent at the ellipse rx × ry, filling `rect`. */
export const glow = (cv: Canvas, cx: number, cy: number, rx: number, ry: number, color: Color, rect: Rect = full(cv)) => {
  const c = rgbaOf(color);
  if (c[3] > 0) cv.shader(wgsl("radial.wgsl"), { rect, params: [cx, cy, rx, ry, c[0], c[1], c[2], c[3]] });
};

/**
 * A clear glass slab over `rect` that fills with `draw` (the content) behind a diagonal
 * specular sweep. p: 0…1 fill progress (0 = empty glass, 1 = content fully in); the content
 * comes in blurred and bright and settles. opts: `m` the stage matrix when inside `stage`
 * (the reveal is a layer mask, in screen space), `behind` to frost what is under the glass
 * (see `frosted`), `radius` of the glass.
 */
export const glassMaterialize = (cv: Canvas, p: number, rect: Rect, draw: () => void, opts: { m?: Matrix; behind?: () => void; radius?: number } = {}) => {
  const { m, behind, radius = 0 } = opts;
  const [x, y, w, h] = rect;
  const edge = interpolate(p, [0, 1], [-30, 130]) / 100;
  if (behind) frosted(cv, rect, radius, 8, behind, m);
  cv.rect(x, y, w, h, {
    gradient: { angle: 135, stops: [["rgba(255, 255, 255, 0.16)", 0], ["rgba(255, 255, 255, 0.03)", 0.45], ["rgba(255, 255, 255, 0.08)", 1]] },
    radius,
    border: { width: 1, color: "rgba(255, 255, 255, 0.22)" },
    inset: [{ y: 1, color: "rgba(255, 255, 255, 0.5)" }, { y: -40, blur: 80, color: "rgba(255, 255, 255, 0.04)" }],
  });
  if (p <= 0) return;
  const blur = interpolate(p, [0, 1], [18, 0], clamp);
  // brightness(1.6 → 1) can't be done (no additive blend or colour filter): a light veil of
  // white stands in, kept faint so dark UI isn't washed grey
  const lift = (interpolate(p, [0, 0.7, 1], [1.6, 1.15, 1], clamp) - 1) * 0.25;
  if (p >= 1) {
    draw();
  } else {
    const line = cssLine(rect, 115);
    const mask = { linear: maskLine(m, line.at(edge - 0.12), line.at(edge + 0.04), line.d), stops: [[1, 0], [0, 1]] as [number, number][] };
    cv.group({ mask, blur }, () => {
      draw();
      if (lift > 0.002) cv.rect(x, y, w, h, { fill: `rgba(255, 255, 255, ${lift})` });
    });
    band(cv, rect, 115, edge - 0.06, edge, edge + 0.05, "rgba(255, 255, 255, 0.55)");
  }
};

/**
 * Reveals `after` over `before` behind a vertical light line moving right → left across
 * `rect` (p 0…1), with sparks trailing off it in `color`. `seed` varies the sparks.
 */
export const sweepReveal = (cv: Canvas, p: number, rect: Rect, before: () => void, after: () => void, color: Color, seed = 1) => {
  const [x, y, w, h] = rect;
  const lx = x + (w * interpolate(p, [0, 1], [102, -2])) / 100;
  before();
  const left = Math.max(x, lx);
  if (left < x + w) cv.clip([left, y, x + w - left, h], 0, after);
  if (!(p > 0 && p < 1)) return;
  // the line: a 4 px bar, white fading to `color` mid-height, with two glows
  cv.rect(lx - 2, y, 4, h, {
    fill: "transparent",
    shadow: [
      { blur: 30, spread: 8, color },
      { blur: 90, spread: 30, color: alpha(color, 0.53) },
    ],
    clipShadows: true,
  });
  cv.rect(lx - 2, y, 4, h / 2, { gradient: { stops: [["rgba(255, 255, 255, 0)", 0], ["white", 0.4], [color, 1]] } });
  cv.rect(lx - 2, y + h / 2, 4, h / 2, { gradient: { stops: [[color, 0], ["white", 0.6], ["rgba(255, 255, 255, 0)", 1]] } });
  for (let i = 0; i < 26; i++) {
    const r = (k: number) => random(seed * 1000 + i, k);
    const drift = (p * 3 + r(1)) % 1;
    const sx = lx + (drift * 90 + 4) * (r(2) > 0.3 ? 1 : -0.4);
    const sy = y + r(3) * h;
    const s = 3 + r(4) * 4;
    cv.circle(sx + s / 2, sy + s / 2, s / 2, { fill: "white", shadow: { blur: 10, color }, opacity: (1 - drift) * 0.9 });
  }
};

/**
 * A diagonal wipe with a bright edge: `next` covers `prev` across `rect` as p goes 0…1 (the
 * edge leans 20% of the width over the height). The cut is a half-plane clip, exact under
 * any camera, but it only cuts boxes (rects, images, text) drawn in rect's coordinates:
 * draw `next` without transforms of its own, and keep paths and shaders out of it.
 */
export const lightWipe = (cv: Canvas, p: number, rect: Rect, prev: () => void, next: () => void, color: Color = "white") => {
  const [x, y, w, h] = rect;
  if (p >= 1) return next();
  prev();
  if (p <= 0) return;
  const e = interpolate(p, [0, 1], [-0.2, 1.2]);
  // keep the side of the line (x + e·w, y) → (x + (e − 0.2)·w, y + h) that holds the top-left
  const ax = x + e * w;
  const dx = -0.2 * w;
  cv.clipHalf(-h, dx, h * ax - dx * y, next);
  band(cv, rect, 101, e - 0.11, e - 0.1, e - 0.085, alpha(color, 0.85));
};

/** A soft flash peaking at frame `peak` (rising over length/3 before, fading over `length` after), radial from the centre of `rect`. */
export const flash = (cv: Canvas, f: number, peak: number, length = 14, color: Color = "white", rect: Rect = full(cv)) => {
  const o = interpolate(f, [peak - length / 3, peak, peak + length], [0, 0.55, 0], clamp);
  if (o <= 0) return;
  // radial-gradient(ellipse at center, colour, transparent 70%): farthest-corner, so 0.7·√2 of the half sizes
  const k = 0.7 * Math.SQRT2;
  glow(cv, rect[0] + rect[2] / 2, rect[1] + rect[3] / 2, (rect[2] / 2) * k, (rect[3] / 2) * k, alpha(color, o), rect);
};
