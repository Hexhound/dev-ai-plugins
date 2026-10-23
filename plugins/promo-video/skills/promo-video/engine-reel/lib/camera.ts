// A camera over one captured window. `a` is the window point (fractions) placed at screen
// point `s`, the window drawn `zoom` × its base width, tilted by rx/ry (degrees) around that
// point with real perspective. Keyframes ease between framings; `follow` leans toward a
// tracked point; `stage` draws the window under the camera.
//
// No motion-blur option: the Remotion Stage faked it with a blur filter scaled by camera
// speed; reel's motion blur is real (sub-frames averaged wherever things move), so a fast
// camera move blurs by itself. `speed` stays for anything else that should react to it.
import { type Canvas, Easing, type Matrix, interpolate, matrix } from "reel";
import type { Point, Rect } from "./capture.ts";

export type Cam = { ax: number; ay: number; sx: number; sy: number; zoom: number; rx: number; ry: number };
/** A keyframe: the camera at frame `f`. `cut` jumps to it instead of travelling; `ease` shapes the travel to it. */
export type Key = Cam & { f: number; cut?: boolean; ease?: (t: number) => number };

/** The default travel between keyframes: a soft start and a long settle. */
export const smooth = Easing.bezier(0.45, 0, 0.2, 1);

/** The window centred on screen at its base size, flat. Spread it into a key and override. */
export const center: Cam = { ax: 0.5, ay: 0.5, sx: 960, sy: 540, zoom: 1, rx: 0, ry: 0 };

/** Keyframes (sorted by `f`) → the camera at frame f. A key with `cut` jumps instead of travelling to it. */
export const cameraAt = (keys: Key[], f: number): Cam => {
  const i = keys.findIndex((k) => k.f > f);
  if (i === -1) return keys[keys.length - 1];
  if (i === 0) return keys[0];
  const a = keys[i - 1];
  const b = keys[i];
  if (b.cut) return a;
  const t = (b.ease ?? smooth)(interpolate(f, [a.f, b.f], [0, 1]));
  const mix = (k: keyof Cam) => a[k] + (b[k] - a[k]) * t;
  return { ax: mix("ax"), ay: mix("ay"), sx: mix("sx"), sy: mix("sy"), zoom: mix("zoom"), rx: mix("rx"), ry: mix("ry") };
};

/**
 * A camera that frames `r` (window fractions) with `fill` of the screen, centred on screen
 * point (sx, sy) (default the middle). `size` is the capture's px size, `base` the window's
 * width at zoom 1; `screen` is the video size (default 1920×1080). Other Cam fields override.
 */
export const frame = (r: Rect, size: [number, number], base: number, opts: Partial<Cam> & { fill?: number; screen?: [number, number] } = {}): Cam => {
  const { fill = 0.86, screen = [1920, 1080], ...rest } = opts;
  const h = (base * size[1]) / size[0];
  const zoom = Math.min((screen[0] * fill) / (r[2] * base), (screen[1] * fill) / (r[3] * h));
  return { ax: r[0] + r[2] / 2, ay: r[1] + r[3] / 2, sx: screen[0] / 2, sy: screen[1] / 2, zoom, rx: 0, ry: 0, ...rest };
};

/** Blends toward a followed point (window fractions) by weight w (0 = the keyframes, 1 = the point at the camera's screen point). */
export const follow = (cam: Cam, point: Point | null, w: number): Cam =>
  point ? { ...cam, ax: cam.ax + (point[0] - cam.ax) * w, ay: cam.ay + (point[1] - cam.ay) * w } : cam;

/**
 * The transform `stage` draws under: window px (0…base, 0…base·h/w) → screen px. CSS's
 * `perspective(perspective)` about (sx, sy), then rotateX, rotateY and scale about the
 * anchor, as the Remotion Stage composed them.
 */
export const stageMatrix = (cam: Cam, base: number, size: [number, number], perspective = 2400): Matrix => {
  const h = (base * size[1]) / size[0];
  const ox = cam.ax * base;
  const oy = cam.ay * h;
  const place = matrix.multiply(matrix.translate(cam.sx - ox, cam.sy - oy), matrix.scale(cam.zoom, cam.zoom, [ox, oy]));
  if (!cam.rx && !cam.ry) return place;
  return matrix.multiply(matrix.perspective({ rotateX: cam.rx, rotateY: cam.ry, origin: [cam.sx, cam.sy], distance: perspective }), place);
};

/**
 * Screen position of a window point (fractions) under a camera. Exact, tilt included (the
 * Remotion version ignored tilt), so callouts stay pinned to a tilted window.
 */
export const project = (cam: Cam, base: number, size: [number, number], x: number, y: number, perspective = 2400): Point => {
  const h = (base * size[1]) / size[0];
  return matrix.apply(stageMatrix(cam, base, size, perspective), x * base, y * h) as Point;
};

/** Screen-space speed of the camera at frame f, px per frame (the window's centre, plus zoom change). */
export const speed = (keys: Key[], f: number, base: number, size: [number, number], at = cameraAt) => {
  const a = at(keys, f - 1);
  const b = at(keys, f);
  const [x0, y0] = project(a, base, size, 0.5, 0.5);
  const [x1, y1] = project(b, base, size, 0.5, 0.5);
  return Math.hypot(x1 - x0, y1 - y0) + Math.abs(b.zoom - a.zoom) * base * 0.5;
};

/**
 * Draws `draw` in window coordinates (0…base × 0…base·size[1]/size[0], px) under the
 * camera: put `window(…)` and the capture frames inside. `draw` gets the matrix, for things
 * that need it (masks in material.ts are in screen space: pass it as their `m`). Nothing
 * clips to the screen: the window may fly in from off-frame.
 */
export const stage = (cv: Canvas, cam: Cam, base: number, size: [number, number], draw: (m: Matrix) => void, perspective = 2400) => {
  const m = stageMatrix(cam, base, size, perspective);
  cv.transform(m, () => draw(m));
};
