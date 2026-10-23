// Footage on cards: captured frame sequences (public/capture/<clip>/NNNN.jpg, 16:9, 30 fps),
// cropped by a View, on rounded cards, side by side or as a before/after wipe.
import React from 'react';
import {Img, staticFile} from 'remotion';
import {lerp, pop, prog, s, within} from './motion';
import {Pill} from './text';
import {useTheme} from './theme';

export type Box = {x: number; y: number; w: number; h: number};
// The part of a 16:9 capture a card shows: its left and top, and its width (all normalized,
// 0…1 of the capture); its height follows from the card's shape.
export type View = {x: number; y: number; w: number};

// Frames per clip (src/data/frames.json, written by prep-vlog.sh): register it once.
const FRAMES: Record<string, number> = {};
export const registerFrames = (frames: Record<string, number>) => Object.assign(FRAMES, frames);

// The view of a card `zoom` times closer than the whole capture, centred on (cx, cy), kept
// inside the capture (zoom 1 = the widest crop that fills the card).
export const view = (b: Box, zoom = 1, cx = 0.5, cy = 0.5): View => {
  const w = Math.min(1, b.w / b.h / (16 / 9)) / zoom;
  const h = (w * (16 / 9)) / (b.w / b.h);
  return {x: within(cx - w / 2, 0, 1 - w), y: within(cy - h / 2, 0, 1 - h), w};
};
export const mixView = (a: View, b: View, t: number): View => ({x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), w: lerp(a.w, b.w, t)});
export const mixBox = (a: Box, b: Box, t: number): Box => ({x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), w: lerp(a.w, b.w, t), h: lerp(a.h, b.h, t)});
// Where a point of the capture (normalized) lands on screen, on card `b` showing view `v`:
// the target for a pointer.
export const onCard = (b: Box, v: View, p: [number, number]): [number, number] => [
  b.x + ((p[0] - v.x) / v.w) * b.w,
  b.y + ((p[1] - v.y) / v.w) * b.w * (9 / 16),
];

// The capture frame shown at video frame f for a clip started at video frame `start`, at
// real speed (or `rate`); the last frame holds. Clamped both ways, so a section's fade-in
// (12 frames before its start) never asks for frame -1.
export const clipIndex = (name: string, f: number, start: number, rate = 1) =>
  Math.max(0, Math.min((FRAMES[name] ?? 1) - 1, Math.floor(((f - start) / 2) * rate)));

export const Clip: React.FC<{name: string; f: number; start: number; v: View; rate?: number; still?: number}> = ({name, f, start, v, rate = 1, still}) => {
  const index = still ?? clipIndex(name, f, start, rate);
  return (
    <div style={{position: 'absolute', inset: 0, overflow: 'hidden'}}>
      <Img
        src={staticFile(`capture/${name}/${String(index).padStart(4, '0')}.jpg`)}
        style={{position: 'absolute', left: `${(-v.x / v.w) * 100}%`, top: 0, width: `${100 / v.w}%`, transform: `translateY(${-v.y * 100}%)`}}
      />
    </div>
  );
};

export type Tagged = 'before' | 'after';
export const Tag: React.FC<{tag: Tagged; labels?: {before: string; after: string}; right?: boolean; opacity?: number}> = ({
  tag,
  labels = {before: 'BEFORE', after: 'AFTER'},
  right = false,
  opacity = 1,
}) => {
  const t = useTheme();
  return (
    <div style={{position: 'absolute', [right ? 'right' : 'left']: 22, top: 18, opacity}}>
      <Pill size={30} bg={tag === 'before' ? t.ink : t.accentDeep} color="#fff" style={{border: '3px solid #fff'}}>
        {labels[tag]}
      </Pill>
    </div>
  );
};

// A rounded card holding footage, with an optional BEFORE / AFTER tag; `p` (0…1) pops it in.
export const Card: React.FC<{box: Box; tag?: Tagged; labels?: {before: string; after: string}; p?: number; dark?: boolean; children: React.ReactNode}> = ({
  box,
  tag,
  labels,
  p = 1,
  dark = false,
  children,
}) => {
  const t = useTheme();
  return (
    <div
      style={{
        position: 'absolute',
        left: box.x,
        top: box.y,
        width: box.w,
        height: box.h,
        borderRadius: 34,
        overflow: 'hidden',
        border: `6px solid ${t.paper}`,
        boxShadow: '0 26px 60px rgba(40,25,50,0.32)',
        background: dark ? t.cardDark : t.card,
        transform: `scale(${0.9 + 0.1 * p})`,
        opacity: Math.min(1, p * 1.5),
      }}
    >
      {children}
      {tag && <Tag tag={tag} labels={labels} />}
    </div>
  );
};

// The 1920×1080 layout: two cards side by side, one big card, and a card aside (its right
// third free for a counter or a key). Cards end above y≈920; the subtitles start near 976.
export const LEFT: Box = {x: 60, y: 196, w: 880, h: 560};
export const RIGHT: Box = {x: 980, y: 196, w: 880, h: 560};
export const BIG: Box = {x: 250, y: 118, w: 1420, h: 799};
export const SIDE: Box = {x: 60, y: 150, w: 1240, h: 698};

// Before on the left, after on the right, the same view of both.
export const Split: React.FC<{f: number; at: number; old: string; now: string; start?: number; v?: View; labels?: {before: string; after: string}}> = ({
  f,
  at,
  old,
  now,
  start = at,
  v = view(LEFT),
  labels,
}) => (
  <>
    <Card box={LEFT} tag="before" labels={labels} p={pop(f, at, 160, 14)}>
      <Clip name={old} f={f} start={start} v={v} />
    </Card>
    <Card box={RIGHT} tag="after" labels={labels} p={pop(f, at + 6, 160, 14)}>
      <Clip name={now} f={f} start={start} v={v} />
    </Card>
  </>
);

// One shot, before and after on top of each other, split by a divider at `split` (0…1 across
// the card): before left of it. Only for footage from the same camera in both versions
// (pixel-aligned), or the divider shows two of everything.
export const Wipe: React.FC<{f: number; box: Box; at: number; old: string; now: string; start: number; v: View; split: number; labels?: {before: string; after: string}}> = ({
  f,
  box,
  at,
  old,
  now,
  start,
  v,
  split,
  labels,
}) => {
  const t = useTheme();
  return (
    <Card box={box} p={pop(f, at, 160, 14)}>
      <Clip name={now} f={f} start={start} v={v} />
      <div style={{position: 'absolute', inset: 0, clipPath: `inset(0 ${(1 - split) * 100}% 0 0)`}}>
        <Clip name={old} f={f} start={start} v={v} />
      </div>
      <div style={{position: 'absolute', top: 0, bottom: 0, left: `${split * 100}%`, width: 6, marginLeft: -3, background: t.paper, boxShadow: '0 0 18px rgba(40,25,50,0.45)'}} />
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: `${split * 100}%`,
          width: 56,
          height: 56,
          margin: '-28px 0 0 -28px',
          borderRadius: 28,
          background: t.paper,
          boxShadow: '0 6px 16px rgba(40,25,50,0.35)',
        }}
      />
      <Tag tag="before" labels={labels} opacity={prog(split, 0.12, 0.3)} />
      <Tag tag="after" labels={labels} right opacity={1 - prog(split, 0.7, 0.88)} />
    </Card>
  );
};

// Divider motions for Wipe. swing: from 80 % across to 20 % and back every `period` seconds
// (point a pointer only at x > 0.85, which it never crosses). reveal: holds on the before,
// sweeps to the after and stays (point at anything right of 0.1 after `at + 1.8`).
export const swing = (f: number, start: number, period: number) => 0.5 + 0.3 * Math.cos(((f - start) / s(period)) * Math.PI * 2);
