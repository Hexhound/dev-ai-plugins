// Time and motion helpers. The vlog runs at 60 fps; times are written in seconds and turned
// into frames with s().
import type React from 'react';
import {interpolate, spring} from 'remotion';

export const FPS = 60;
export const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
export const s = (seconds: number) => Math.round(seconds * FPS);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const ease = (t: number) => t * t * (3 - 2 * t);
export const within = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
// 0 → 1 between frames a and b (clamped).
export const prog = (f: number, a: number, b: number) => interpolate(f, [a, b], [0, 1], clamp);
// A springy 0 → 1 from frame `at` (overshoots a little).
export const pop = (f: number, at: number, stiffness = 170, damping = 11) =>
  spring({frame: f - at, fps: FPS, config: {stiffness, damping, mass: 0.7}});
// 1 → 0 over `len` frames from frame `out`.
export const gone = (f: number, out: number, len = 12) => interpolate(f, [out, out + len], [1, 0], clamp);

// A value easing from keyframe to keyframe ([seconds, value], in order).
export const keys = (f: number, frames: [number, number][]) => {
  for (let i = 1; i < frames.length; i++) {
    if (f < s(frames[i][0])) return lerp(frames[i - 1][1], frames[i][1], ease(prog(f, s(frames[i - 1][0]), s(frames[i][0]))));
  }
  return frames[frames.length - 1][1];
};

// Blur-to-sharp springy entrance. It sets opacity, transform and filter: put it on an inner
// element, never on one that also positions itself with transform or fades with opacity
// (the spread would overwrite them).
export const enter = (p: number, dx = 0, dy = 30): React.CSSProperties => ({
  opacity: Math.min(1, p * 1.6),
  transform: `translate(${(1 - p) * dx}px, ${(1 - p) * dy}px) scale(${0.85 + 0.15 * p})`,
  filter: p < 0.98 ? `blur(${(1 - Math.min(1, p)) * 10}px)` : undefined,
});
