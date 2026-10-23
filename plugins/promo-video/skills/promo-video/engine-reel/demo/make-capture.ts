// Makes the demo's stand-in capture segment: a little paint app whose brush follows the
// `brush` track in capture/demo/capture.json and whose size readout follows `size`. Not
// part of the lib; run it only to regenerate the frames (60 PNGs, 1280×768):
//   reel still demo/make-capture.ts --at 0,1,…,59 --no-motion-blur -o <dir>
// then rename <dir>/000NN.png → capture/demo/00NN.png.
import { video, polyline } from "reel";
import { loadCapture, trackAt, type Point } from "../lib/capture.ts";

const cap = loadCapture("demo", "capture");
const [W, H] = cap.size;
const INK = "#E8E6F0";
const MUTED = "#8B8FA3";
const ACCENT = "#FF6FB5";

export default video({ width: W, height: H, fps: 30, duration: cap.frames, background: "#14151C", motionBlur: false }, (cv, f) => {
  // title bar
  cv.rect(0, 0, W, 48, { fill: "#1B1D26" });
  ["#FF5F57", "#FEBC2E", "#28C840"].forEach((c, i) => cv.circle(26 + i * 22, 24, 7, c));
  cv.text("Sketchbook — untitled.sk", W / 2, 12, { size: 18, weight: 600, color: MUTED, anchor: "center" });
  // layers sidebar
  cv.rect(0, 48, 220, H - 48, { fill: "#1E2029" });
  cv.text("LAYERS", 24, 72, { size: 13, weight: 700, color: MUTED, letterSpacing: 0.2 });
  ["Ink", "Sketch", "Background"].forEach((name, i) => {
    const y = 104 + i * 54;
    cv.rect(14, y, 192, 44, { fill: i === 0 ? "#2C2F3D" : "transparent", radius: 8 });
    cv.rect(26, y + 8, 28, 28, { fill: i === 2 ? "#F2EFE8" : "#3A3E50", radius: 4 });
    cv.text(name, 66, y + 10, { size: 17, weight: 600, color: INK });
  });
  // the canvas, and the stroke drawn so far
  const [cx, cy, cw, ch] = cap.rects.canvas as number[];
  cv.rect(cx * W, cy * H, cw * W, ch * H, { fill: "#F2EFE8", radius: 6, shadow: { y: 6, blur: 24, color: "rgba(0, 0, 0, 0.4)" } });
  const pts: [number, number][] = [];
  for (let i = 0; i <= f; i++) {
    const p = cap.tracks.brush[i];
    if (Array.isArray(p)) pts.push([p[0] * W, p[1] * H]);
  }
  const size = trackAt(cap, "size", f) as number;
  if (pts.length > 1) cv.path(polyline(pts), { stroke: ACCENT, width: size * 0.6 });
  const now = trackAt(cap, "brush", f) as Point | null;
  if (now && cap.tracks.brush[f]) {
    cv.circle(now[0] * W, now[1] * H, size * 0.6, { fill: "transparent", border: { width: 2, color: "#33291F" } });
  }
  // brush panel: size value and slider
  cv.rect(1060, 68, 200, 680, { fill: "#1E2029", radius: 8 });
  cv.text("BRUSH", 1080, 88, { size: 13, weight: 700, color: MUTED, letterSpacing: 0.2 });
  cv.text("Size", 1080, 124, { size: 17, weight: 600, color: INK });
  cv.text(`${Math.round(size)} px`, 1240, 124, { size: 17, weight: 700, color: ACCENT, anchor: "end" });
  cv.rect(1080, 166, 160, 6, { fill: "#3A3E50", radius: 3 });
  const k = (size - 12) / 36;
  cv.rect(1080, 166, 160 * k, 6, { fill: ACCENT, radius: 3 });
  cv.circle(1080 + 160 * k, 169, 10, "#FFFFFF");
  ["Soft", "Hard", "Ink"].forEach((name, i) => {
    cv.rect(1080, 220 + i * 50, 160, 40, { fill: i === 0 ? "#2C2F3D" : "transparent", radius: 8, border: { width: 1, color: "#2C2F3D" } });
    cv.text(name, 1096, 228 + i * 50, { size: 16, weight: 600, color: INK });
  });
});
