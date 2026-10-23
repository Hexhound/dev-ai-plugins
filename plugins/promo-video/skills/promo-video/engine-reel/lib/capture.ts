// One capture segment as the capture contract describes it (references/storyboard-format.md):
// promo/capture/<segment>/NNNN.png frames plus capture.json with markers, tracks and rects,
// coordinates normalized to the captured frame. reel reads the PNGs directly.
import { exists, interpolate, readJson } from "reel";

/** x, y, w, h; in a capture, fractions of the captured frame. */
export type Rect = [number, number, number, number];
export type Point = [number, number];

export type Capture = {
  name: string;
  /** The segment's directory (relative to the scene file, or absolute). */
  dir: string;
  /** "png" (the contract), or "jpg" for a segment that was converted. */
  ext: string;
  fps: number;
  /** The captured frame's size in px. */
  size: [number, number];
  frames: number;
  markers: Record<string, number>;
  tracks: Record<string, (number | Point | null)[]>;
  /** A rect is `[x, y, w, h]`, or `{ from, rect }` when it appears at frame `from`. */
  rects: Record<string, Rect | { from: number; rect: Rect }>;
};

/**
 * Loads segment `name` from `root` (relative to the scene file: promo/video/promo.ts reads
 * "../capture", the default): its capture.json, and which frame files it has.
 */
export const loadCapture = (name: string, root = "../capture"): Capture => {
  const dir = `${root}/${name}`;
  const j = readJson(`${dir}/capture.json`);
  return {
    name,
    dir,
    ext: exists(`${dir}/0000.png`) || !exists(`${dir}/0000.jpg`) ? "png" : "jpg",
    fps: j.fps ?? 30,
    size: j.size,
    frames: j.frames,
    markers: j.markers ?? {},
    tracks: j.tracks ?? {},
    rects: j.rects ?? {},
  };
};

/** The file of the capture frame nearest `index` (fractional, clamped to the segment), for `cv.image`. */
export const framePath = (c: Capture, index: number) =>
  `${c.dir}/${String(Math.max(0, Math.min(c.frames - 1, Math.round(index)))).padStart(4, "0")}.${c.ext}`;

/** The Remotion lib's name for `framePath`. */
export const frameUrl = framePath;

/** The capture frame of a marker; throws if the capture lacks it. */
export const marker = (c: Capture, name: string) => {
  const m = c.markers[name];
  if (m === undefined) throw new Error(`capture ${c.name} has no marker ${name}`);
  return m;
};

/** A named rect (window fractions); throws if the capture lacks it. */
export const rect = (c: Capture, name: string): Rect => {
  const r = c.rects[name];
  if (!r) throw new Error(`capture ${c.name} has no rect ${name}`);
  return Array.isArray(r) ? r : r.rect;
};

/** The capture frame a rect appears from (0 when it is always there). */
export const rectFrom = (c: Capture, name: string): number => {
  const r = c.rects[name];
  if (!r) throw new Error(`capture ${c.name} has no rect ${name}`);
  return Array.isArray(r) ? 0 : r.from;
};

/**
 * Maps video frames to capture frames through [videoFrame, captureFrame] pairs (clamped at
 * both ends), so capture events land on beats: e.g.
 * `remap([[at(8, 1), marker(c, "layers.screen")], [at(8, 2), …]])`. The result is fractional:
 * pass it to framePath, trackAt, smoothPoint.
 */
export const remap = (points: [number, number][]) => (f: number) =>
  interpolate(
    f,
    points.map((p) => p[0]),
    points.map((p) => p[1]),
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

/** A track's value at a (fractional) capture frame; points and numbers interpolate, nulls hold the last value. */
export const trackAt = (c: Capture, name: string, index: number): number | Point | null => {
  const series = c.tracks[name] ?? [];
  if (series.length === 0) return null;
  const i = Math.max(0, Math.min(series.length - 1, Math.floor(index)));
  let a = series[i];
  let k = i;
  while (a == null && k > 0) a = series[--k];
  const b = series[Math.min(series.length - 1, i + 1)] ?? a;
  if (a == null) return null;
  const t = Math.max(0, Math.min(1, index - Math.floor(index)));
  if (typeof a === "number") return a + ((typeof b === "number" ? b : a) - a) * t;
  const bb = Array.isArray(b) ? b : a;
  return [a[0] + (bb[0] - a[0]) * t, a[1] + (bb[1] - a[1]) * t];
};

/**
 * A point track smoothed by a triangular average of `window` frames either side of
 * `index + lead` (capture frames): leading the action a little reads as the camera
 * anticipating it. Null when the track has no point there.
 */
export const smoothPoint = (c: Capture, name: string, index: number, lead = 3, window = 5): Point | null => {
  let x = 0;
  let y = 0;
  let n = 0;
  for (let k = -window; k <= window; k++) {
    const p = trackAt(c, name, index + lead + k);
    if (Array.isArray(p)) {
      const w = window + 1 - Math.abs(k);
      x += p[0] * w;
      y += p[1] * w;
      n += w;
    }
  }
  return n ? [x / n, y / n] : null;
};
