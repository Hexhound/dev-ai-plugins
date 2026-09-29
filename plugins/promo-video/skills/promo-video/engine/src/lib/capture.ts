import {interpolate, staticFile} from 'remotion';

// One capture segment as the capture contract describes it.
export type Rect = [number, number, number, number];
export type Capture = {
  name: string;
  fps: number;
  size: [number, number];
  frames: number;
  markers: Record<string, number>;
  tracks: Record<string, (number | [number, number] | null)[]>;
  rects: Record<string, {from: number; rect: Rect}>;
};

export const frameUrl = (c: Capture, index: number) =>
  staticFile(`capture/${c.name}/${String(Math.max(0, Math.min(c.frames - 1, Math.round(index)))).padStart(4, '0')}.jpg`);

export const marker = (c: Capture, name: string) => {
  const m = c.markers[name];
  if (m === undefined) throw new Error(`capture ${c.name} has no marker ${name}`);
  return m;
};

export const rect = (c: Capture, name: string): Rect => {
  const r = c.rects[name];
  if (!r) throw new Error(`capture ${c.name} has no rect ${name}`);
  return r.rect;
};

// Maps video frames to capture frames through [videoFrame, captureFrame] pairs, so capture
// events land on beats: e.g. [[at(8,1), marker(c,'layers.screen')], [at(8,2), ...]].
export const remap = (points: [number, number][]) => (f: number) =>
  interpolate(
    f,
    points.map((p) => p[0]),
    points.map((p) => p[1]),
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
  );

// A track's value at a (fractional) capture frame; points interpolate, nulls hold the last value.
export const trackAt = (c: Capture, name: string, index: number): number | [number, number] | null => {
  const series = c.tracks[name] ?? [];
  const i = Math.max(0, Math.min(series.length - 1, Math.floor(index)));
  let a = series[i];
  let k = i;
  while (a == null && k > 0) a = series[--k];
  const b = series[Math.min(series.length - 1, i + 1)] ?? a;
  if (a == null) return null;
  const t = index - Math.floor(index);
  if (typeof a === 'number') return a + ((typeof b === 'number' ? b : a) - a) * t;
  const bb = Array.isArray(b) ? b : a;
  return [a[0] + (bb[0] - a[0]) * t, a[1] + (bb[1] - a[1]) * t];
};

// A point track smoothed by averaging a window around `index + lead` (in capture frames).
export const smoothPoint = (c: Capture, name: string, index: number, lead = 3, window = 5): [number, number] | null => {
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
