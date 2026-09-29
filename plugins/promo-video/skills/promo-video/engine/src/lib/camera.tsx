import React from 'react';
import {Easing, interpolate} from 'remotion';
import type {Rect} from './capture';

// A camera over one captured window. `a` is the window point (0…1) placed at screen point
// `s`, the window drawn `zoom` × its base width, tilted by rx/ry around that point.
export type Cam = {ax: number; ay: number; sx: number; sy: number; zoom: number; rx: number; ry: number};
export type Key = Cam & {f: number; cut?: boolean; ease?: (t: number) => number};

export const smooth = Easing.bezier(0.45, 0, 0.2, 1);

// Keyframes → the camera at frame f. A key with `cut` jumps instead of travelling to it.
export const cameraAt = (keys: Key[], f: number): Cam => {
  let i = keys.findIndex((k) => k.f > f);
  if (i === -1) return keys[keys.length - 1];
  if (i === 0) return keys[0];
  const a = keys[i - 1];
  const b = keys[i];
  if (b.cut) return a;
  const t = (b.ease ?? smooth)(interpolate(f, [a.f, b.f], [0, 1]));
  const mix = (k: keyof Cam) => a[k] + (b[k] - a[k]) * t;
  return {ax: mix('ax'), ay: mix('ay'), sx: mix('sx'), sy: mix('sy'), zoom: mix('zoom'), rx: mix('rx'), ry: mix('ry')};
};

// A camera that frames `r` (window-normalized) with `fill` of the screen.
export const frame = (r: Rect, size: [number, number], base: number, opts: Partial<Cam> & {fill?: number} = {}): Cam => {
  const {fill = 0.86, ...rest} = opts;
  const h = (base * size[1]) / size[0];
  const zoom = Math.min((1920 * fill) / (r[2] * base), (1080 * fill) / (r[3] * h));
  return {ax: r[0] + r[2] / 2, ay: r[1] + r[3] / 2, sx: 960, sy: 540, zoom, rx: 0, ry: 0, ...rest};
};

// Blends toward a followed point by weight w (0 = keyframes, 1 = point at screen centre).
export const follow = (cam: Cam, point: [number, number] | null, w: number): Cam =>
  point ? {...cam, ax: cam.ax + (point[0] - cam.ax) * w, ay: cam.ay + (point[1] - cam.ay) * w} : cam;

// Screen position of a window point under a camera (ignores tilt; keep tilt small when used).
export const project = (cam: Cam, base: number, size: [number, number], x: number, y: number) => {
  const h = (base * size[1]) / size[0];
  return [cam.sx + (x - cam.ax) * base * cam.zoom, cam.sy + (y - cam.ay) * h * cam.zoom] as const;
};

// Screen-space speed of the camera, for motion blur.
export const speed = (keys: Key[], f: number, base: number, size: [number, number], at = cameraAt) => {
  const a = at(keys, f - 1);
  const b = at(keys, f);
  const [x0, y0] = project(a, base, size, 0.5, 0.5);
  const [x1, y1] = project(b, base, size, 0.5, 0.5);
  return Math.hypot(x1 - x0, y1 - y0) + Math.abs(b.zoom - a.zoom) * base * 0.5;
};

export const Stage: React.FC<{cam: Cam; base: number; size: [number, number]; blur?: number; children: React.ReactNode}> = ({
  cam,
  base,
  size,
  blur = 0,
  children,
}) => {
  const h = (base * size[1]) / size[0];
  return (
    <div style={{position: 'absolute', inset: 0, perspective: 2400, perspectiveOrigin: `${cam.sx}px ${cam.sy}px`, overflow: 'hidden'}}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: base,
          height: h,
          transformOrigin: `${cam.ax * base}px ${cam.ay * h}px`,
          transform: `translate(${cam.sx - cam.ax * base}px, ${cam.sy - cam.ay * h}px) rotateX(${cam.rx}deg) rotateY(${cam.ry}deg) scale(${cam.zoom})`,
          filter: blur > 0.3 ? `blur(${blur}px)` : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
};
