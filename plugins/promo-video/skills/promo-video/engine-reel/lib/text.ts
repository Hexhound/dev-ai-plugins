// Text treatments (craft §4). Each takes the frame and absolute frames for its entrances
// and exit, so it can be timed straight from the beat clock, and draws at an absolute
// position (x, y = the block's top-left, as the Remotion components' `left`/`top`). Type,
// colour and sizes come from the brief. Over busy footage, put a `scrim` under the text.
//
// The glass cards' `backdrop-filter` is opt-in here (`behind`: redraw what is under the
// card, see material.ts `frosted`); without it the card's own translucent fill does the work.
import { type Canvas, type Color, type Rect as R, alpha, interpolate, measureText, spring } from "reel";
import type { Point } from "./capture.ts";
import { frosted } from "./material.ts";

/** Font families (from the video's `fonts`, or "sans-serif"/"monospace"), the main text colour and the muted one. */
export type Type = { sans: string; mono: string; ink: Color; muted: Color };

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** 0…1 out over `outLen` frames from `out` (0 before it; never when out is Infinity). */
const gone = (f: number, out: number, outLen: number) => (Number.isFinite(out) ? interpolate(f, [out, out + outLen], [0, 1], clamp) : 0);

/** 0…1 entrance at frame `at` (an overdamped spring settling in `len` frames), and 1…0 exit over `outLen` from `out` (the Remotion lib's useReveal). */
export const reveal = (f: number, at: number, out = Infinity, outLen = 12, len = 26) => {
  const inn = spring({ frame: f - at, config: { damping: 200 }, durationInFrames: len });
  return Math.min(inn, 1 - gone(f, out, outLen));
};

/** A linear 14-frame entrance at `at` and 12-frame exit at `out` (Readout's rows). */
export const revealAt = (f: number, at: number, out = Infinity) => Math.min(interpolate(f, [at, at + 14], [0, 1], clamp), 1 - gone(f, out, 12));

/** Draws `draw` faded in by p, risen from `px` below and unblurred from `blur` px: the treatments' entrance. */
export const rise = (cv: Canvas, p: number, px: number, blur: number, draw: () => void) => {
  if (p <= 0.001) return;
  cv.group({ opacity: Math.min(1, p), y: (1 - p) * px, blur: p < 0.999 ? (1 - p) * blur : 0 }, draw);
};

/** The eyebrow's size without drawing it (at full reveal). */
export const eyebrowSize = (type: Type, n: string, label: string, size = 17) => {
  const m = measureText(`${n}  ${label}`, { font: type.mono, size, letterSpacing: 0.32 });
  return { width: 44 + 16 + m.width, height: m.height };
};

/**
 * The eyebrow at (x, y): an `accent` bar growing to 44 px, then "n  LABEL" in spaced mono
 * caps (n in the accent), entering with p. Returns its height.
 */
export const eyebrow = (cv: Canvas, o: { type: Type; n: string; label: string; accent: Color; p: number; x: number; y: number; size?: number }) => {
  const { type, n, label, accent, p, x, y, size = 17 } = o;
  const h = measureText("x", { font: type.mono, size }).height;
  rise(cv, p, 8, 6, () => {
    if (p > 0) cv.rect(x, y + h / 2 - 1, 44 * p, 2, { fill: accent, radius: 2 });
    cv.text([{ text: n, color: accent }, { text: `  ${label}` }], x + 44 * p + 16, y, { font: type.mono, size, letterSpacing: 0.32, color: type.muted });
  });
  return h;
};

/** Heavy lines, each rising in at its own frame (the components' Line). */
const lines = (cv: Canvas, f: number, s: string[], at: number[], out: number, x: number, y: number, style: { font: string; size: number; weight: number; lh: number; ls: number; color: Color; align?: "start" | "end"; width?: number }) => {
  s.forEach((line, i) => {
    const p = reveal(f, at[i] ?? at[at.length - 1], out);
    const lx = style.align === "end" && style.width ? x + style.width : x;
    rise(cv, p, 22, 12, () => {
      cv.text(line, lx, y + i * style.size * style.lh, { font: style.font, size: style.size, weight: style.weight, letterSpacing: style.ls, lineHeight: style.size * style.lh, color: style.color, anchor: style.align === "end" ? "end" : "start" });
    });
  });
};

/**
 * Big type beside the product: an eyebrow (in 10 frames before the first line), then
 * `lines` each rising in at its `at`; at `out` everything leaves, sliding 160 px left.
 * (x, y) is the block's top-left; `size` the type size (line height 1.02).
 */
export const splitHeadline = (
  cv: Canvas,
  f: number,
  o: { type: Type; n: string; label: string; accent: Color; lines: string[]; at: number[]; out?: number; x: number; y: number; size?: number },
) => {
  const { type, n, label, accent, at, out = Infinity, y, size = 80 } = o;
  const x = o.x + (Number.isFinite(out) ? interpolate(f, [out, out + 18], [0, -160], clamp) : 0);
  const eh = eyebrow(cv, { type, n, label, accent, p: reveal(f, at[0] - 10, out), x, y });
  lines(cv, f, o.lines, at, out, x, y + eh + 22, { font: type.sans, size, weight: 800, lh: 1.02, ls: -0.03, color: type.ink });
};

/**
 * An eyebrow and a short headline (56 px) on dark frosted glass at (x, y), entering 12
 * frames before the first line. `align: "right"` right-aligns the lines in the card.
 * `behind` (and the stage matrix `m` if inside one) frosts what is under it.
 */
export const glassCard = (
  cv: Canvas,
  f: number,
  o: { type: Type; n: string; label: string; accent: Color; lines: string[]; at: number[]; out?: number; x: number; y: number; align?: "left" | "right"; behind?: () => void },
) => {
  const { type, n, label, accent, at, out = Infinity, x, y, align = "left", behind } = o;
  const p = reveal(f, at[0] - 12, out);
  const size = 56;
  const eb = eyebrowSize(type, n, label);
  const lineW = Math.max(...o.lines.map((s) => measureText(s, { font: type.sans, size, weight: 800, letterSpacing: -0.02 }).width));
  const inner = Math.max(eb.width, lineW);
  const w = inner + 76;
  const h = 28 + eb.height + 16 + o.lines.length * size * 1.04 + 32;
  rise(cv, p, 26, 10, () => {
    if (behind) frosted(cv, [x, y, w, h], 22, 22, behind);
    cv.rect(x, y, w, h, {
      gradient: { angle: 135, stops: [["rgba(28, 30, 40, 0.72)", 0], ["rgba(14, 15, 22, 0.55)", 1]] },
      radius: 22,
      border: { width: 1, color: "rgba(255, 255, 255, 0.12)" },
      shadow: [{ y: 30, blur: 80, color: "rgba(0, 0, 0, 0.5)" }, { blur: 60, color: alpha(accent, 0.13) }],
      inset: { y: 1, color: "rgba(255, 255, 255, 0.1)" },
      clipShadows: true,
    });
    eyebrow(cv, { type, n, label, accent, p, x: x + 38, y: y + 28 });
    lines(cv, f, o.lines, at, out, x + 38, y + 28 + eb.height + 16, { font: type.sans, size, weight: 800, lh: 1.04, ls: -0.02, color: type.ink, align: align === "right" ? "end" : "start", width: inner });
  });
};

/**
 * A label pinned to a screen `point` by a leader line: a dot and ring at the point, a line
 * growing along `offset` to a dark card (eyebrow + `text`) whose near edge sits at the line's
 * end. Pass the point every frame (`project(cam, …)`) so it rides the camera.
 */
export const callout = (
  cv: Canvas,
  f: number,
  o: { type: Type; n: string; label: string; accent: Color; text: string; point: Point | readonly [number, number]; offset: [number, number]; at: number; out?: number; behind?: () => void },
) => {
  const { type, n, label, accent, text, point, offset, at, out = Infinity, behind } = o;
  const p = reveal(f, at, out);
  const line = reveal(f, at, out, 12, 18);
  if (line <= 0.001 && p <= 0.001) return;
  const [px, py] = point;
  cv.circle(px, py, 7 * line, accent);
  cv.circle(px, py, 16 * line + 1, { fill: "transparent", border: { width: 2, color: alpha(accent, 0.5) } });
  if (line > 0.001) cv.path(`M ${px} ${py} L ${px + offset[0] * line} ${py + offset[1] * line}`, { stroke: accent, width: 2 });
  const eb = eyebrowSize(type, n, label, 15);
  const tm = measureText(text, { font: type.sans, size: 38, weight: 700, letterSpacing: -0.01 });
  const w = Math.max(eb.width, tm.width) + 52;
  const h = 18 + eb.height + 8 + tm.height + 18;
  const cx = px + offset[0] - (offset[0] < 0 ? w : 0);
  const cy = py + offset[1] - h / 2;
  rise(cv, p, 12, 8, () => {
    if (behind) frosted(cv, [cx, cy, w, h], 16, 16, behind);
    cv.rect(cx, cy, w, h, { fill: "rgba(12, 13, 20, 0.78)", radius: 16, border: { width: 1, color: alpha(accent, 0.33) } });
    eyebrow(cv, { type, n, label, accent, p, x: cx + 26, y: cy + 18, size: 15 });
    cv.text(text, cx + 26, cy + 18 + eb.height + 8, { font: type.sans, size: 38, weight: 700, letterSpacing: -0.01, color: type.ink });
  });
};

/**
 * Words landing one by one (on beats), stacked under an eyebrow at (x, y): each springs in
 * from the left at its `at`; the latest is `type.ink`, earlier ones `dim`. All leave at `out`.
 */
export const kineticWords = (
  cv: Canvas,
  f: number,
  o: { type: Type; n: string; label: string; accent: Color; words: { text: string; at: number }[]; eyebrowAt: number; out?: number; x: number; y: number; size?: number; dim?: Color },
) => {
  const { type, n, label, accent, words, eyebrowAt, out = Infinity, x, y, size = 96, dim = "rgba(255, 255, 255, 0.38)" } = o;
  const eh = eyebrow(cv, { type, n, label, accent, p: reveal(f, eyebrowAt, out), x, y });
  const g = 1 - gone(f, out, 12);
  const landed = words.filter((k) => k.at <= f).length;
  const lh = size * 0.98;
  words.forEach((w, i) => {
    const p = spring({ frame: f - w.at, config: { damping: 13, stiffness: 180 } });
    const q = Math.min(1, p);
    const op = q * g;
    if (op <= 0.001) return;
    const top = y + eh + 14 + i * lh;
    cv.group({ opacity: op, shadow: { y: 8, blur: 40, color: "rgba(0, 0, 0, 0.6)" } }, () => {
      cv.translate((1 - q) * -60, 0, () => {
        cv.scale(0.9 + 0.1 * p, () => {
          cv.text(w.text, x, top, { font: type.sans, size, weight: 900, lineHeight: lh, letterSpacing: -0.04, color: i === landed - 1 ? type.ink : dim });
        }, [x, top + lh / 2]);
      });
    });
  });
};

/**
 * A big live value, proving the thing is live: an eyebrow at (x, y), rows of a small mono
 * label beside a huge mono value (each row in at its `at`; pass the value every frame, e.g.
 * from `trackAt`), and a caption. Leaves at `out`.
 */
export const readout = (
  cv: Canvas,
  f: number,
  o: { type: Type; n: string; label: string; accent: Color; rows: { label: string; value: string; at: number }[]; caption: string; at: number; out?: number; x: number; y: number },
) => {
  const { type, n, label, accent, rows, caption, at, out = Infinity, x, y } = o;
  const p = reveal(f, at, out);
  let top = y + eyebrow(cv, { type, n, label, accent, p, x, y });
  const labelStyle = { font: type.mono, size: 30, letterSpacing: 0.1, color: accent };
  const valueStyle = { font: type.mono, size: 124, weight: 700, letterSpacing: -0.04, color: type.ink };
  for (const r of rows) {
    top += 10;
    const q = revealAt(f, r.at, out);
    const vm = measureText(r.value, valueStyle);
    const lm = measureText(r.label, labelStyle);
    const rowTop = top;
    rise(cv, q, 14, 8, () => {
      // baselines aligned, as the flex row's align-items: baseline
      cv.text(r.label, x, rowTop + vm.baseline - lm.baseline, labelStyle);
      cv.group({ shadow: { y: 10, blur: 50, color: "rgba(0, 0, 0, 0.6)" } }, () => {
        cv.text(r.value, x + 80 + 22, rowTop, valueStyle);
      });
    });
    top += vm.height;
  }
  rise(cv, p, 10, 6, () => {
    cv.text(caption, x, top + 10, { font: type.sans, size: 30, weight: 600, color: type.muted });
  });
};

/**
 * A dark gradient from one edge (default the left: `angle` 90) so text stays legible over
 * busy footage: `strength` at the edge, 60% of it at `width`·55%, clear at `width` (of the
 * gradient line). Fades in over 14 frames from `from`, out over 12 from `to`.
 */
export const scrim = (cv: Canvas, f: number, o: { from: number; to: number; width?: number; strength?: number; angle?: number; color?: Color; rect?: R }) => {
  const { from, to, width = 0.55, strength = 0.82, angle = 90, color = "rgb(6, 7, 11)", rect = [0, 0, cv.width, cv.height] } = o;
  const op = Math.min(interpolate(f, [from, from + 14], [0, 1], clamp), interpolate(f, [to, to + 12], [1, 0], clamp));
  if (op <= 0) return;
  cv.rect(rect[0], rect[1], rect[2], rect[3], {
    gradient: { angle, stops: [[alpha(color, strength), 0], [alpha(color, strength * 0.6), width * 0.55], [alpha(color, 0), width]] },
    opacity: op,
  });
};
