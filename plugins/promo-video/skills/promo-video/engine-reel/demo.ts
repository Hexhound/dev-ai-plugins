// The lib's self-check: a 22 s scene that uses every building block, on a stand-in capture
// (demo/capture/demo: 60 frames of a little paint app, made by demo/make-capture.ts) and
// stand-in screens drawn with shapes. If the lib breaks, this breaks:
//   reel check demo.ts
//   reel sheet demo.ts -o sheet.png --count 24
//   reel still demo.ts --at glass,sweep,follow,readout,montage,end -o stills/
// Shots (bars of a 120 BPM clock, 2 s each):
//   0–2  backdrop, glow, splitHeadline, then a flash
//   2–4  the window flies in on a tilted camera, glassMaterialize (frosted), glassCard
//   4–5  sweepReveal (skeleton → app), callout pinned to the slider via project()
//   5–7  the capture plays through remap; the camera frames the canvas and follows the
//        brush (smoothPoint); scrim + kineticWords
//   7–8½ pull back; readout of the live `size` track
//   8½–10 montage: lightWipe between screens on beats
//   10–11 end card, flash; grain over everything throughout
import { type Canvas, video, lerp, Easing } from "reel";
import { makeClock } from "./lib/clock.ts";
import { framePath, loadCapture, marker, rect, rectFrom, remap, smoothPoint, trackAt, type Rect } from "./lib/capture.ts";
import { type Cam, type Key, cameraAt, center, follow, frame, project, speed, stage } from "./lib/camera.ts";
import { backdrop, flash, frameImage, glassMaterialize, glow, grain, lightWipe, sweepReveal, window } from "./lib/material.ts";
import { callout, eyebrow, glassCard, kineticWords, readout, reveal, rise, scrim, splitHeadline, type Type } from "./lib/text.ts";

const c = makeClock("demo/music.json", 60);
const TOTAL = c.at(11);
const cap = loadCapture("demo", "demo/capture");

const T: Type = { sans: "sans-serif", mono: "monospace", ink: "#FFFFFF", muted: "rgba(255, 255, 255, 0.72)" };
const ACCENT = "#FF6FB5";
const BLUE = "#6AA8FF";
const GREEN = "#3DDC97";
const BASE = 1400;
const SIZE = cap.size;
const H = (BASE * SIZE[1]) / SIZE[0];
const WIN: Rect = [0, 0, BASE, H];
const k = BASE / SIZE[0];

// ── stand-in screens, in window px (rects and text only, so lightWipe can cut them) ──────
const skeleton = (cv: Canvas) => {
  cv.rect(0, 0, BASE, H, { fill: "#14151C" });
  cv.rect(0, 0, BASE, 48 * k, { fill: "#1B1D26" });
  cv.rect(0, 48 * k, 220 * k, H, { fill: "#1E2029" });
  for (let i = 0; i < 3; i++) cv.rect(14 * k, (104 + i * 54) * k, 192 * k, 44 * k, { fill: "#262935", radius: 8 * k });
  cv.rect(240 * k, 68 * k, 800 * k, 680 * k, { fill: "#232633", radius: 6 * k });
  cv.text("Loading…", (640 * k), 380 * k, { size: 34, weight: 600, color: "#4A4E63", anchor: "center" });
  cv.rect(1060 * k, 68 * k, 200 * k, 680 * k, { fill: "#1E2029", radius: 8 * k });
};

const SWATCHES = [["#FF6FB5", "Rose"], ["#6AA8FF", "Sky"], ["#3DDC97", "Mint"], ["#FFB547", "Amber"], ["#9D7CFF", "Iris"], ["#F2EFE8", "Paper"]];
const themes = (cv: Canvas) => {
  cv.rect(0, 0, BASE, H, { fill: "#0F1016" });
  cv.text("Themes", 70 * k, 50 * k, { size: 56, weight: 800, color: "#FFFFFF", letterSpacing: -0.02 });
  SWATCHES.forEach(([col, name], i) => {
    const x = (70 + (i % 3) * 390) * k;
    const y = (170 + Math.floor(i / 3) * 290) * k;
    cv.rect(x, y, 360 * k, 250 * k, { fill: "#1B1D26", radius: 18 * k, border: { width: 1, color: "#2C2F3D" } });
    cv.rect(x + 24 * k, y + 24 * k, 312 * k, 140 * k, { fill: col, radius: 12 * k });
    cv.text(name, x + 24 * k, y + 184 * k, { size: 30, weight: 700, color: "#E8E6F0" });
  });
};

// ── the camera and the capture's timing ─────────────────────────────────────────────────
const canvasCam = frame(rect(cap, "canvas"), SIZE, BASE, { fill: 0.9, sx: 1180 });
const KEYS: Key[] = [
  { f: c.at(2), ...center, sx: 2700, zoom: 0.8, rx: 3, ry: -18 },
  { f: c.at(2, 3), ...center, sx: 1120, zoom: 0.8, rx: 2, ry: -10 },
  { f: c.at(4), ...center, sx: 980, zoom: 0.92, rx: 0, ry: -3 },
  { f: c.at(5), ...center, zoom: 1 },
  { f: c.at(5, 3), ...canvasCam },
  { f: c.at(7), ...canvasCam, zoom: canvasCam.zoom * 1.05 },
  { f: c.at(7, 3), ...center, sx: 1250, zoom: 0.78, ry: -6 },
];

const capAt = remap([
  [c.at(5, 3), marker(cap, "stroke")],
  [c.at(7), marker(cap, "lift")],
  [c.at(8, 2), marker(cap, "end")],
]);

const followWeight = (f: number) => lerp(f, [c.at(5, 3), c.at(6), c.at(7) - 20, c.at(7)], [0, 0.7, 0.7, 0]);
const camAt = (f: number): Cam => follow(cameraAt(KEYS, f), smoothPoint(cap, "brush", capAt(f), 4, 10), followWeight(f));

const drawBackdrop = (cv: Canvas, f: number) =>
  backdrop(cv, f, {
    base: "#06070B",
    blobs: [
      { color: "#7C5CFF", x: -200, y: -250, size: 1100, speed: 110, phase: 0 },
      { color: "#1F4BFF", x: 1100, y: -300, size: 1000, speed: 140, phase: 2 },
      { color: "#FF6A3D", x: 900, y: 500, size: 1000, speed: 125, phase: 4 },
    ],
    grain: 0.04,
  });

// ── shots ────────────────────────────────────────────────────────────────────────────────
const opening = (cv: Canvas, f: number) => {
  const swell = lerp(f, [0, c.at(1, 3)], [0, 1], Easing.out(Easing.cubic));
  glow(cv, 640, 470, 500 + 300 * swell, 400 + 220 * swell, `rgba(255, 111, 181, ${0.32 * reveal(f, 10)})`);
  splitHeadline(cv, f, { type: T, n: "01", label: "ENGINE-REEL", accent: ACCENT, lines: ["Every building block,", "drawn by reel."], at: [c.at(0, 2), c.at(0, 4)], out: c.at(1, 4), x: 160, y: 380, size: 92 });
};

const appShot = (cv: Canvas, f: number) => {
  const cam = camAt(f);
  const v = speed(KEYS, f, BASE, SIZE);
  const glowC = `rgba(255, 111, 181, ${0.22 + Math.min(0.18, v * 0.004)})`;
  const fill = lerp(f, [c.at(2) + 8, c.at(2, 3) + 24], [0, 1]);
  const sweep = lerp(f, [c.at(4, 1), c.at(4, 1) + 60], [0, 1]);
  const exit = lerp(f, [c.at(8, 3) - 6, c.at(8, 3)], [1, 0]);
  cv.fade(exit, () => {
    stage(cv, cam, BASE, SIZE, (m) => {
      window(cv, WIN, glowC, () => {
        if (f < c.at(4)) glassMaterialize(cv, fill, WIN, () => skeleton(cv), { m, behind: () => drawBackdrop(cv, f) });
        else if (f < c.at(5, 3)) sweepReveal(cv, sweep, WIN, () => skeleton(cv), () => frameImage(cv, framePath(cap, 0), WIN), ACCENT, 3);
        else frameImage(cv, framePath(cap, capAt(f)), WIN);
      });
    });
    glassCard(cv, f, { type: T, n: "02", label: "GLASS", accent: ACCENT, lines: ["Glass that fills", "with the app."], at: [c.at(2, 4), c.at(3, 1)], out: c.at(4) - 10, x: 90, y: 740, behind: () => drawBackdrop(cv, f) });
    if (f >= c.at(4, 2) && f < c.at(5, 3) && capAt(f) >= rectFrom(cap, "panel")) {
      const s = rect(cap, "slider");
      const point = project(cam, BASE, SIZE, s[0] + s[2] / 2, s[1] + s[3] / 2);
      callout(cv, f, { type: T, n: "03", label: "CALLOUT", accent: BLUE, text: "Pinned to the slider.", point, offset: [-380, -170], at: c.at(4, 2) + 8, out: c.at(5, 2) });
    }
    scrim(cv, f, { from: c.at(5, 2), to: c.at(8, 3) - 12, width: 0.5 });
    kineticWords(cv, f, {
      type: T, n: "04", label: "FOLLOW", accent: ACCENT,
      words: [{ text: "Follow.", at: c.at(5, 3) }, { text: "Track.", at: c.at(6, 1) }, { text: "Remap.", at: c.at(6, 3) }],
      eyebrowAt: c.at(5, 2), out: c.at(7), x: 110, y: 560, size: 116,
    });
    const size = trackAt(cap, "size", capAt(f));
    readout(cv, f, {
      type: T, n: "05", label: "READOUT", accent: GREEN,
      rows: [{ label: "SIZE", value: `${Math.round(typeof size === "number" ? size : 0)} px`, at: c.at(7, 1) + 6 }],
      caption: "Read live from a capture track.", at: c.at(7, 1), out: c.at(8, 3) - 12, x: 110, y: 560,
    });
  });
};

const SCREENS = [skeleton, (cv: Canvas) => frameImage(cv, framePath(cap, cap.frames - 1), WIN), themes];
const WIPES = [c.at(9, 1), c.at(9, 3)];
const montage = (cv: Canvas, f: number) => {
  const i = WIPES.filter((w) => w <= f).length;
  const p = i === 0 ? 1 : lerp(f, [WIPES[i - 1], WIPES[i - 1] + 18], [0, 1]);
  const prev = SCREENS[Math.max(0, i - 1)];
  const now = SCREENS[i];
  const cam: Cam = { ...center, sy: 570, zoom: 0.8 + (f - c.at(8, 3)) * 0.0001, rx: 2, ry: -5 };
  stage(cv, cam, BASE, SIZE, () => {
    window(cv, WIN, "rgba(106, 168, 255, 0.3)", () => lightWipe(cv, p, WIN, () => prev(cv), () => now(cv)));
  });
  const e = reveal(f, c.at(8, 3) + 6, c.at(10) - 12);
  eyebrow(cv, { type: T, n: "06", label: "LIGHT WIPE", accent: BLUE, p: e, x: 64, y: 54, size: 20 });
  cv.fade(e, () => cv.text(`${String(i + 1).padStart(2, "0")} / ${String(SCREENS.length).padStart(2, "0")}`, 1856, 54, { font: T.mono, size: 20, color: T.muted, anchor: "end" }));
};

const end = (cv: Canvas, f: number) => {
  const p = reveal(f, c.at(10) + 4);
  const q = reveal(f, c.at(10, 2));
  glow(cv, 960, 500, 900, 520, `rgba(124, 92, 255, ${0.35 * p})`);
  rise(cv, p, 24, 12, () => cv.text("engine-reel", 960, 380, { size: 150, weight: 800, color: "#FFFFFF", letterSpacing: -0.035, anchor: "center" }));
  rise(cv, q, 14, 8, () =>
    cv.text("clock · capture · camera · material · text", 960, 600, { font: T.mono, size: 30, letterSpacing: 0.12, color: T.muted, anchor: "center" }),
  );
};

export default video(
  {
    duration: TOTAL,
    background: "#06070B",
    markers: {
      title: c.at(1, 1),
      glass: c.at(2, 3) + 10,
      card: c.at(3, 3),
      sweep: c.at(4, 1) + 30,
      callout: c.at(5, 1),
      follow: c.at(6, 2),
      readout: c.at(8),
      wipe: c.at(9, 1) + 8,
      montage: c.at(9, 4),
      end: c.at(10, 3),
    },
  },
  (cv, f) => {
    drawBackdrop(cv, f);
    if (f < c.at(2) + 10) cv.fade(lerp(f, [c.at(1, 4), c.at(2) + 10], [1, 0]), () => opening(cv, f));
    if (f >= c.at(2) && f < c.at(8, 3)) appShot(cv, f);
    if (f >= c.at(8, 3) && f < c.at(10)) cv.fade(lerp(f, [c.at(10) - 12, c.at(10)], [1, 0]), () => montage(cv, f));
    if (f >= c.at(10)) end(cv, f);
    flash(cv, f, c.at(2), 16);
    flash(cv, f, c.at(8, 3), 14);
    flash(cv, f, c.at(10), 16);
    grain(cv, f, 0.04);
  },
);
