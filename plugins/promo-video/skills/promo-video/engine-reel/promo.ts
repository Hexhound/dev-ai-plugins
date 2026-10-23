// Starter only: replace with this promo's storyboard. It lives in promo/video/ beside lib/,
// reads promo/music/music.json and promo/capture/<segment>/, and wires the beat clock, one
// capture segment and one camera shot. demo.ts uses every block in lib/; the Remotion
// example (examples/omaphoto/video/src/Promo.tsx) shows a whole promo built from them.
//   reel check promo.ts          after every change
//   reel sheet promo.ts -o ../out/sheet.png --count 24
//   reel still promo.ts --at <marker>,… -o ../out/stills/
//   reel render promo.ts -o ../out/promo.mp4
import { type Canvas, exists, video } from "reel";
import { makeClock, musicTrack, readMusic } from "./lib/clock.ts";
import { framePath, loadCapture, remap, type Rect } from "./lib/capture.ts";
import { type Key, cameraAt, center, stage } from "./lib/camera.ts";
import { backdrop, frameImage, grain, window } from "./lib/material.ts";
import { splitHeadline, type Type } from "./lib/text.ts";

const music = readMusic("../music/music.json");
const c = makeClock(music, 60);
// The storyboard's length in bars.
const TOTAL = c.at(20);

// One capture segment per continuous shot: promo/capture/<name>/.
const main = loadCapture("main");
const BASE = 1500; // the window's width on screen at zoom 1
const SIZE = main.size;
const WIN: Rect = [0, 0, BASE, (BASE * SIZE[1]) / SIZE[0]];

// The brief's look: fonts (list them in the config's `fonts`), palette.
const T: Type = { sans: "sans-serif", mono: "monospace", ink: "#FFFFFF", muted: "rgba(255, 255, 255, 0.72)" };
const ACCENT = "#9D7CFF";

// ── S1: the app shot. Each storyboard shot gets a block like this: its camera keys
// (frame(rect(main, "…"), SIZE, BASE) to push to a rect, follow + smoothPoint to chase a
// track, `cut: true` for a match cut), its capture timing (remap capture markers onto
// beats: [[c.at(bar, beat), marker(main, "…")], …]), and its text treatments.
const KEYS: Key[] = [
  { f: c.at(1), ...center, sx: 1200, zoom: 0.8, ry: -8 },
  { f: c.at(3), ...center, sx: 1140, zoom: 0.86 },
];
const mainAt = remap([
  [c.at(1), 0],
  [c.at(3), main.frames - 1],
]);

const appShot = (cv: Canvas, f: number) => {
  stage(cv, cameraAt(KEYS, f), BASE, SIZE, () => {
    window(cv, WIN, "rgba(157, 124, 255, 0.25)", () => frameImage(cv, framePath(main, mainAt(f)), WIN));
  });
  splitHeadline(cv, f, { type: T, n: "01", label: "THE IDEA", accent: ACCENT, lines: ["One line", "per beat."], at: [c.at(1, 3), c.at(2, 1)], out: c.at(3), x: 100, y: 420, size: 80 });
};

export default video(
  {
    duration: TOTAL,
    background: "#06070B",
    // fonts: ["../assets/fonts/*.ttf"], font: "Inter",
    audio: exists("../music/track.mp3") ? [musicTrack(music, "../music/track.mp3")] : [],
    loudness: -14,
    // one marker per shot: `reel still promo.ts --at s1`
    markers: { s1: c.at(1) },
  },
  (cv, f) => {
    backdrop(cv, f, {
      base: "#06070B",
      blobs: [
        { color: "#7C5CFF", x: -200, y: -250, size: 1100, speed: 110, phase: 0 },
        { color: "#FF6A3D", x: 900, y: 500, size: 1000, speed: 125, phase: 4 },
      ],
      grain: 0,
    });
    // the shots, each drawn only in its bars (overlap them by a few frames for transitions)
    if (f >= c.at(1) && f < c.at(3) + 12) cv.fade(Math.min(1, (c.at(3) + 12 - f) / 12), () => appShot(cv, f));
    grain(cv, f, 0.04);
  },
);
