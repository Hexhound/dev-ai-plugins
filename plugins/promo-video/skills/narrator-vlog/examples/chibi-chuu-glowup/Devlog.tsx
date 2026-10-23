// Chibi Chuu devlog: the glow-up (devlog/script.md). Before (v1.0.0) and after, narrated by
// Kokoro af_heart, with burned-in subtitles and a paw that points at the differences.
// 60 fps; the captures are 30 fps (a capture frame is two video frames).
import React from 'react';
import {AbsoluteFill, Audio, Img, interpolate, Sequence, staticFile, useCurrentFrame} from 'remotion';
import {C, clamp, Confetti, enter, FONT, FontFace, gone, Pill, pop, Sky, sticker} from './chibi/look';
import {RoundWord} from './RoundWord';
import linesJson from './data/lines.json';
import framesJson from './data/frames.json';
// When each narration line starts (seconds): devlog/timing.json, shared with make_srt.py.
import timingJson from './data/timing.json';

const FPS = 60;
const s = (seconds: number) => Math.round(seconds * FPS);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => t * t * (3 - 2 * t);
const prog = (f: number, a: number, b: number) => interpolate(f, [a, b], [0, 1], clamp);
const within = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
// A value easing from keyframe to keyframe ([seconds, value], in order).
const keys = (f: number, frames: [number, number][]) => {
  for (let i = 1; i < frames.length; i++) {
    if (f < s(frames[i][0])) return lerp(frames[i - 1][1], frames[i][1], ease(prog(f, s(frames[i - 1][0]), s(frames[i][0]))));
  }
  return frames[frames.length - 1][1];
};

type Line = {id: string; text: string; seconds: number};
const LINES = linesJson as Line[];
const FRAMES = framesJson as Record<string, number>;

const VO: Record<string, number> = timingJson.vo;

// Section boundaries (seconds).
const T = {
  chibis: 9.0,
  oldWire: 15.4,
  xray: 19.6,
  newFox: 23.8,
  lineup: 27.6,
  pair: 31.4,
  f1: 35.4,
  textures: 44.6,
  props: 58.6,
  propsClose: 63.0,
  tank: 67.4,
  dayNight: 73.6,
  dusk: 75.6,
  night: 77.4,
  modes: 82.0,
  outro: 90.75,
  end: 98.0,
};
export const TOTAL = s(T.end);

// ── Footage ─────────────────────────────────────────────────────────────────────────────
type Box = {x: number; y: number; w: number; h: number};
// The part of a 16:9 capture a card shows: its left and top, and its width (all normalized);
// its height follows from the card's shape.
type View = {x: number; y: number; w: number};

// The view of a card `zoom` times closer than the whole capture, centred on (cx, cy) and kept
// inside the capture.
const view = (b: Box, zoom = 1, cx = 0.5, cy = 0.5): View => {
  const w = Math.min(1, b.w / b.h / (16 / 9)) / zoom;
  const h = (w * (16 / 9)) / (b.w / b.h);
  return {x: within(cx - w / 2, 0, 1 - w), y: within(cy - h / 2, 0, 1 - h), w};
};
const mixView = (a: View, b: View, t: number): View => ({x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), w: lerp(a.w, b.w, t)});
// Where a point of the capture (normalized) lands on screen.
const onCard = (b: Box, v: View, p: [number, number]): [number, number] => [
  b.x + ((p[0] - v.x) / v.w) * b.w,
  b.y + ((p[1] - v.y) / v.w) * b.w * (9 / 16),
];

// A capture sequence (public/capture/<name>/NNNN.jpg) from video frame `start`, at real speed
// (or `rate`), holding its last frame; `v` is the part shown.
const clipIndex = (name: string, f: number, start: number, rate = 1) =>
  Math.max(0, Math.min((FRAMES[name] ?? 1) - 1, Math.floor(((f - start) / 2) * rate)));
const Clip: React.FC<{name: string; f: number; start: number; v: View; rate?: number; still?: number}> = ({name, f, start, v, rate = 1, still}) => {
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

const Tag: React.FC<{tag: 'before' | 'after'; right?: boolean; opacity?: number}> = ({tag, right = false, opacity = 1}) => (
  <div style={{position: 'absolute', [right ? 'right' : 'left']: 22, top: 18, opacity}}>
    <Pill size={30} bg={tag === 'before' ? C.plum : C.pinkDeep} color="#fff" style={{border: '3px solid #fff'}}>
      {tag === 'before' ? 'BEFORE · v1.0' : 'AFTER'}
    </Pill>
  </div>
);

// A rounded card with its footage and a BEFORE / AFTER tag.
const Card: React.FC<{box: Box; tag?: 'before' | 'after'; p?: number; bg?: string; children: React.ReactNode}> = ({box, tag, p = 1, bg = '#f3eaf7', children}) => (
  <div
    style={{
      position: 'absolute',
      left: box.x,
      top: box.y,
      width: box.w,
      height: box.h,
      borderRadius: 34,
      overflow: 'hidden',
      border: `6px solid ${C.cream}`,
      boxShadow: '0 26px 60px rgba(90,57,77,0.32)',
      background: bg,
      transform: `scale(${0.9 + 0.1 * p})`,
      opacity: Math.min(1, p * 1.5),
    }}
  >
    {children}
    {tag && <Tag tag={tag} />}
  </div>
);

const LEFT: Box = {x: 60, y: 196, w: 880, h: 560};
const RIGHT: Box = {x: 980, y: 196, w: 880, h: 560};
const BIG: Box = {x: 250, y: 118, w: 1420, h: 799};
// The turntable's card moves aside for the wireframe and the x-ray, with their counter and
// key on its right.
const SIDE: Box = {x: 60, y: 150, w: 1240, h: 698};
const mixBox = (a: Box, b: Box, t: number): Box => ({x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), w: lerp(a.w, b.w, t), h: lerp(a.h, b.h, t)});

// Old on the left, new on the right; `v` is the part of both shown.
const Split: React.FC<{f: number; at: number; old: string; now: string; start?: number; v?: View}> = ({f, at, old, now, start = at, v = view(LEFT)}) => (
  <>
    <Card box={LEFT} tag="before" p={pop(f, at, 160, 14)}>
      <Clip name={old} f={f} start={start} v={v} />
    </Card>
    <Card box={RIGHT} tag="after" p={pop(f, at + 6, 160, 14)}>
      <Clip name={now} f={f} start={start} v={v} />
    </Card>
  </>
);

// One shot, old and new on top of each other (the same camera in both), split by a divider
// at `split` (0…1 across the card): the old one left of it.
const Wipe: React.FC<{f: number; box: Box; at: number; old: string; now: string; start: number; v: View; split: number}> = ({f, box, at, old, now, start, v, split}) => (
  <Card box={box} p={pop(f, at, 160, 14)}>
    <Clip name={now} f={f} start={start} v={v} />
    <div style={{position: 'absolute', inset: 0, clipPath: `inset(0 ${(1 - split) * 100}% 0 0)`}}>
      <Clip name={old} f={f} start={start} v={v} />
    </div>
    <div style={{position: 'absolute', top: 0, bottom: 0, left: `${split * 100}%`, width: 6, marginLeft: -3, background: C.cream, boxShadow: '0 0 18px rgba(90,57,77,0.45)'}} />
    <div
      style={{
        position: 'absolute',
        top: '50%',
        left: `${split * 100}%`,
        width: 64,
        height: 64,
        margin: '-32px 0 0 -32px',
        borderRadius: 32,
        background: C.cream,
        boxShadow: '0 6px 16px rgba(90,57,77,0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: C.plum,
        fontFamily: FONT,
        fontWeight: 700,
        fontSize: 30,
      }}
    >
      ‹›
    </div>
    <Tag tag="before" opacity={prog(split, 0.12, 0.3)} />
    <Tag tag="after" right opacity={1 - prog(split, 0.7, 0.88)} />
  </Card>
);
// The divider swinging from 80 % across to 20 % and back, every `period` seconds.
const swing = (f: number, start: number, period: number) => 0.5 + 0.3 * Math.cos(((f - start) / s(period)) * Math.PI * 2);

// ── Pointers, labels, subtitles ─────────────────────────────────────────────────────────
// The paw: it slides in beside `target`, its toes toward it, taps, and says `label` in a
// bubble; a ring pulses on the target. `side`: where the paw rests (from the target), or
// `offset` (pixels) to rest it further off, in empty space.
const Paw: React.FC<{f: number; at: number; until: number; target: [number, number]; label: string; side?: 'left' | 'right' | 'below' | 'above'; offset?: [number, number]}> = ({
  f,
  at,
  until,
  target,
  label,
  side = 'right',
  offset: away,
}) => {
  if (f < at || f > until + 14) return null;
  const p = pop(f, at, 150, 12);
  const out = gone(f, until, 14);
  const offset = away ?? {left: [-150, 70], right: [150, 70], below: [40, 160], above: [40, -170]}[side];
  const rest: [number, number] = [target[0] + offset[0], target[1] + offset[1]];
  const from: [number, number] = [rest[0] + offset[0] * 1.2, rest[1] + offset[1] * 1.2];
  const tap = Math.max(0, Math.sin(((f - at - 18) / 34) * Math.PI)) * (f > at + 18 ? 1 : 0);
  const x = lerp(from[0], rest[0], p) + (target[0] - rest[0]) * 0.12 * tap;
  const y = lerp(from[1], rest[1], p) + (target[1] - rest[1]) * 0.12 * tap;
  const angle = (Math.atan2(target[0] - x, -(target[1] - y)) * 180) / Math.PI;
  const ring = (f - at) / 40;
  // The bubble goes left of the paw if asked, or if it would run off the frame's right edge.
  const bubbleLeft = side === 'left' || rest[0] + 80 + label.length * 19 + 56 > 1880;
  return (
    <div style={{position: 'absolute', inset: 0, opacity: Math.min(out, p * 2), pointerEvents: 'none'}}>
      <div
        style={{
          position: 'absolute',
          left: target[0] - 56,
          top: target[1] - 56,
          width: 112,
          height: 112,
          borderRadius: 56,
          border: `6px solid ${C.pink}`,
          opacity: p * (0.85 - 0.5 * (ring % 1)),
          transform: `scale(${0.7 + 0.5 * (ring % 1)})`,
        }}
      />
      <Img
        src={staticFile('stickers/paw.png')}
        style={{
          position: 'absolute',
          left: x - 70,
          top: y - 70,
          width: 140,
          transform: `rotate(${angle}deg) scale(${1 - 0.1 * tap})`,
          filter: 'drop-shadow(0 8px 10px rgba(90,57,77,0.35))',
        }}
      />
      <div style={{position: 'absolute', left: bubbleLeft ? x - 90 : x + 80, top: y + 10, width: 'max-content', transform: `translate(${bubbleLeft ? '-100%' : '0'}, -50%)`}}>
        <div style={enter(pop(f, at + 10, 170, 13), bubbleLeft ? 30 : -30, 0)}>
          <Pill size={38}>{label}</Pill>
        </div>
      </div>
    </div>
  );
};

// A big counter that counts up: "≈ 30,000" over "triangles".
const Counter: React.FC<{f: number; at: number; until: number; value: number; approx?: boolean; x: number; y: number; size?: number; color?: string}> = ({
  f,
  at,
  until,
  value,
  approx = false,
  x,
  y,
  size = 110,
  color = C.plum,
}) => {
  if (f < at || f > until + 14) return null;
  const p = pop(f, at, 170, 12);
  const n = Math.round(value * ease(prog(f, at, at + 30)));
  return (
    <div style={{position: 'absolute', left: x, top: y, width: 'max-content', transform: 'translate(-50%, -50%)', opacity: gone(f, until, 14)}}>
      <div style={{textAlign: 'center', ...enter(p, 0, 30)}}>
        <div style={sticker(size, color, C.cream, 0.2)}>
          {approx ? '≈ ' : ''}
          {n.toLocaleString('en-US')}
        </div>
        <div style={{...sticker(size * 0.4, C.plum, C.cream, 0.3), marginTop: 6}}>triangles</div>
      </div>
    </div>
  );
};

// The x-ray's key: how many surfaces are stacked, cool to hot (devlog/heat_xray.py's STOPS).
const HEAT_KEY = [
  {n: '1', color: '#4fb3d9'},
  {n: '2', color: '#7fd8be'},
  {n: '3', color: '#f6e27f'},
  {n: '5', color: '#f6936a'},
  {n: '8+', color: '#d63a8f'},
];
const HeatKey: React.FC<{f: number; at: number; until: number; x: number; y: number}> = ({f, at, until, x, y}) => {
  if (f < at || f > until + 14) return null;
  return (
    <div style={{position: 'absolute', left: x, top: y, width: 'max-content', transform: 'translate(-50%, 0)', opacity: gone(f, until, 14)}}>
      <div
        style={{
          padding: '16px 24px 18px',
          borderRadius: 30,
          background: C.cream,
          boxShadow: '0 10px 26px rgba(90,57,77,0.25)',
          fontFamily: FONT,
          fontWeight: 700,
          color: C.plum,
          textAlign: 'center',
          ...enter(pop(f, at, 170, 13), 0, 20),
        }}
      >
        <div style={{fontSize: 30, marginBottom: 12}}>surfaces stacked</div>
        <div style={{display: 'flex', gap: 10, justifyContent: 'center'}}>
          {HEAT_KEY.map((k) => (
            <div key={k.n} style={{width: 66, height: 52, borderRadius: 16, background: k.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, color: '#2b1a33'}}>
              {k.n}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// The section's name, top left.
const Chip: React.FC<{f: number; at: number; until: number; children: React.ReactNode}> = ({f, at, until, children}) => {
  if (f < at || f > until + 12) return null;
  return (
    <div style={{position: 'absolute', left: 60, top: 48, opacity: gone(f, until, 12)}}>
      <div style={enter(pop(f, at, 170, 13), -40, 0)}>
        <Pill size={40} tape>
          {children}
        </Pill>
      </div>
    </div>
  );
};

// A centred label under the cards (a phase, a mode's name), or at `top`.
const Center: React.FC<{f: number; at: number; until: number; top?: number; children: React.ReactNode}> = ({f, at, until, top = 790, children}) => {
  if (f < at || f > until + 10) return null;
  return (
    <div style={{position: 'absolute', left: 0, right: 0, top, textAlign: 'center', opacity: gone(f, until, 10)}}>
      <div style={enter(pop(f, at, 180, 13), 0, 20)}>
        <Pill size={46}>{children}</Pill>
      </div>
    </div>
  );
};

// Subtitles: each narration line split at its "|" marks, or else at its commas and full stops
// into chunks of at most ~56 characters, each shown for its share of the line's time.
const SUBS: {at: number; until: number; text: string}[] = (() => {
  const out: {at: number; until: number; text: string}[] = [];
  for (const l of LINES) {
    const start = VO[l.id];
    const chunks: string[] = l.text.includes('|') ? l.text.split('|').map((c) => c.trim()) : [];
    if (chunks.length === 0) {
      for (const part of l.text.split(/(?<=[.!?,])\s+/)) {
        const last = chunks[chunks.length - 1];
        if (last && (last + ' ' + part).length <= 56) chunks[chunks.length - 1] = last + ' ' + part;
        else chunks.push(part);
      }
    }
    const total = chunks.reduce((n, c) => n + c.length, 0);
    let t = start;
    for (const chunk of chunks) {
      const len = (l.seconds * chunk.length) / total;
      out.push({at: s(t), until: s(t + len) + 6, text: chunk});
      t += len;
    }
  }
  return out;
})();

const Subtitles: React.FC<{f: number}> = ({f}) => {
  const sub = SUBS.find((x) => f >= x.at && f < x.until);
  if (!sub) return null;
  const p = Math.min(1, (f - sub.at) / 6);
  return (
    <div style={{position: 'absolute', left: 0, right: 0, bottom: 34, textAlign: 'center', opacity: p}}>
      <div
        style={{
          display: 'inline-block',
          maxWidth: 1500,
          padding: '14px 34px 18px',
          borderRadius: 26,
          background: 'rgba(61,36,51,0.82)',
          color: C.cream,
          fontFamily: FONT,
          fontWeight: 700,
          fontSize: 40,
          lineHeight: 1.3,
          boxShadow: '0 10px 28px rgba(61,36,51,0.3)',
        }}
      >
        {sub.text}
      </div>
    </div>
  );
};

// ── Sections ────────────────────────────────────────────────────────────────────────────
// The hook: the old fox wipes into the new one; then both rosters, v1.0 over now.
const HOOK: Box = {x: 360, y: 300, w: 1200, h: 620};
const HOOK_END = 3.8;
const Intro: React.FC<{f: number}> = ({f}) => {
  const logo = pop(f, s(0.1), 150, 12);
  const title = pop(f, s(0.5), 160, 13);
  const band: Box = {x: 100, y: 0, w: 1720, h: 240};
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 0, right: 0, top: 40, textAlign: 'center', ...enter(logo, 0, -40)}}>
        <Img src={staticFile('logo_sticker.png')} style={{width: 620}} />
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: 196, textAlign: 'center', ...enter(title, 0, 30)}}>
        <span style={sticker(72)}>Devlog: the </span>
        <RoundWord size={72}>glow-up</RoundWord>
      </div>
      {f < s(HOOK_END) + 12 && (
        <div style={{position: 'absolute', inset: 0, opacity: 1 - prog(f, s(HOOK_END) - 6, s(HOOK_END) + 12)}}>
          <Wipe f={f} box={HOOK} at={0} old="old_fox" now="new_fox" start={0} v={view(HOOK, 1.2)} split={1 - ease(prog(f, s(1.2), s(2.8)))} />
        </div>
      )}
      {f >= s(HOOK_END) - 6 &&
        [
          {name: 'old_lineup', y: 384, p: pop(f, s(HOOK_END), 160, 14), label: 'v1.0'},
          {name: 'new_lineup', y: 678, p: pop(f, s(HOOK_END + 0.7), 160, 14), label: 'now'},
        ].map((row) => (
          <div key={row.name} style={{position: 'absolute', left: band.x, top: row.y, width: band.w, height: band.h, ...enter(row.p, 0, 40)}}>
            <div style={{position: 'absolute', inset: 0, borderRadius: 40, overflow: 'hidden', border: `6px solid ${C.cream}`, boxShadow: '0 20px 50px rgba(90,57,77,0.25)', background: '#f3eaf7'}}>
              <Clip name={row.name} f={f} start={0} still={0} v={view(band)} />
            </div>
            <div style={{position: 'absolute', left: -20, top: -24}}>
              <Pill size={34} bg={row.label === 'now' ? C.pinkDeep : C.plum} color="#fff" style={{border: '3px solid #fff'}}>
                {row.label}
              </Pill>
            </div>
          </div>
        ))}
    </AbsoluteFill>
  );
};

// The fox swings (the same sway, old and new, so the clips line up): plain, then her
// wireframe with its count, then the x-ray; the new fox, the roster, both x-rays side by side,
// and the F1 panel swapping the model live.
const COUNTER_AT: [number, number] = [1610, 380];
const OLD_CORE: [number, number] = [0.5, 0.42];
const Chibis: React.FC<{f: number}> = ({f}) => {
  const oldFox = f < s(T.oldWire);
  const wire = f >= s(T.oldWire) && f < s(T.xray);
  const xray = f >= s(T.xray) && f < s(T.newFox);
  const newFox = f >= s(T.newFox) && f < s(T.lineup);
  const lineup = f >= s(T.lineup) && f < s(T.pair);
  const pair = f >= s(T.pair) && f < s(T.f1);
  // Big while she swings alone, aside while the counter and the key show.
  const aside = ease(prog(f, s(T.oldWire), s(T.oldWire) + 24)) * (1 - ease(prog(f, s(T.newFox), s(T.newFox) + 24)));
  const box = mixBox(BIG, SIDE, aside);
  const v = view(box);
  return (
    <AbsoluteFill>
      {f < s(T.lineup) && (
        <Card box={box} tag={newFox ? 'after' : 'before'} p={pop(f, s(T.chibis), 150, 14)} bg={wire || xray ? '#2b1a33' : '#f3eaf7'}>
          {oldFox && <Clip name="old_fox" f={f} start={s(T.chibis)} v={v} />}
          {wire && <Clip name="old_fox_wire" f={f} start={s(T.oldWire)} v={v} />}
          {xray && <Clip name="old_fox_heat" f={f} start={s(T.xray)} v={v} />}
          {newFox && <Clip name="new_fox" f={f} start={s(T.newFox)} v={v} />}
        </Card>
      )}
      {lineup && (
        <Card box={BIG} tag="after" p={pop(f, s(T.lineup), 160, 14)}>
          <Clip name="new_lineup_grid" f={f} start={0} still={0} v={view(BIG)} />
        </Card>
      )}
      {pair && (
        <>
          <Split f={f} at={s(T.pair)} old="old_fox_heat" now="new_fox_heat" v={view(LEFT, 1.15)} />
          <Counter f={f} at={s(T.pair + 0.4)} until={s(T.f1 - 0.2)} value={30000} approx x={LEFT.x + LEFT.w / 2} y={858} size={80} />
          <Counter f={f} at={s(T.pair + 0.7)} until={s(T.f1 - 0.2)} value={8000} x={RIGHT.x + RIGHT.w / 2} y={858} size={80} color={C.pinkDeep} />
          <HeatKey f={f} at={s(T.pair + 0.2)} until={s(T.f1 - 0.2)} x={960} y={18} />
        </>
      )}
      {f >= s(T.f1) && <F1 f={f} />}
      <Paw f={f} at={s(T.chibis + 1.6)} until={s(T.oldWire - 0.3)} target={onCard(box, v, [0.56, 0.46])} label="the v1.0 fox" side="right" />
      <Counter f={f} at={s(T.oldWire + 0.5)} until={s(T.newFox - 0.2)} value={30000} approx x={COUNTER_AT[0]} y={COUNTER_AT[1]} />
      <HeatKey f={f} at={s(T.xray + 0.2)} until={s(T.newFox - 0.2)} x={COUNTER_AT[0]} y={560} />
      <Paw f={f} at={s(T.xray + 0.8)} until={s(T.newFox - 0.2)} target={onCard(box, v, OLD_CORE)} label="up to 9 layers deep" side="below" />
      <Paw f={f} at={s(T.newFox + 0.6)} until={s(T.lineup - 0.2)} target={onCard(box, v, [0.56, 0.46])} label="the new fox" side="right" />
      <Center f={f} at={s(T.lineup + 0.3)} until={s(T.pair - 0.2)} top={150}>
        11 animals, each one different
      </Center>
    </AbsoluteFill>
  );
};

// The F1 panel (left), pushing in from the whole game onto its readout, and her wireframe
// (right) switching with it: the panel's model choice changes at these capture frames (its
// readout follows about 5 frames later). Points in the footage: the model's number, and the
// number of triangles drawn.
const F1_SWITCHES = [93, 168, 243];
const F1_PANEL: View = {x: 0, y: 0.02, w: 0.37};
const F1_MODEL: [number, number] = [0.132, 0.12];
const F1_TRIANGLES: [number, number] = [0.05, 0.211];
const F1: React.FC<{f: number}> = ({f}) => {
  const index = clipIndex('f1_panel', f, s(T.f1));
  const low = F1_SWITCHES.filter((at) => index >= at).length % 2 === 1;
  const lastSwitch = Math.max(s(T.f1), ...F1_SWITCHES.map((at) => s(T.f1) + at * 2).filter((at) => f >= at));
  const v = mixView(view(LEFT), F1_PANEL, ease(prog(f, s(T.f1 + 0.9), s(T.f1 + 1.9))));
  return (
    <>
      <Card box={LEFT} p={pop(f, s(T.f1), 160, 14)}>
        <Clip name="f1_panel" f={f} start={s(T.f1)} v={v} />
      </Card>
      <Card box={RIGHT} p={pop(f, s(T.f1) + 6, 160, 14)} bg="#2b1a33">
        <Clip name={low ? 'new_fox_wire_2500' : 'new_fox_wire'} f={f} start={s(T.f1)} v={view(RIGHT, 1.1)} />
        <div style={{position: 'absolute', right: 22, top: 18, transform: `scale(${1 + 0.25 * (1 - prog(f, lastSwitch, lastSwitch + 14))})`, transformOrigin: 'right top'}}>
          <Pill size={34} bg={low ? C.plum : C.pinkDeep} color="#fff" style={{border: '3px solid #fff'}}>
            {low ? '2,500 triangles · Low detail' : '8,000 triangles'}
          </Pill>
        </div>
      </Card>
      <Center f={f} at={s(T.f1 + 0.6)} until={s(T.textures - 0.3)}>
        F1 test panel: the model swaps live
      </Center>
      <Paw f={f} at={s(T.f1 + 2.0)} until={s(T.f1 + 4.4)} target={onCard(LEFT, v, F1_MODEL)} label="the model" side="above" />
      <Paw f={f} at={s(T.f1 + 4.6)} until={s(T.textures - 0.3)} target={onCard(LEFT, v, F1_TRIANGLES)} label="triangles drawn, live" offset={[40, 250]} />
    </>
  );
};

const Textures: React.FC<{f: number}> = ({f}) => {
  const v = view(LEFT);
  return (
    <AbsoluteFill>
      <Split f={f} at={s(T.textures)} old="old_fox_face" now="new_fox_face" v={v} />
      <Paw f={f} at={s(VO.flat + 0.5)} until={s(VO.paint - 0.2)} target={onCard(LEFT, v, [0.3, 0.3])} label="flat colours" side="right" />
      <Paw f={f} at={s(VO.paint + 0.4)} until={s(VO.paint + 3.0)} target={onCard(RIGHT, v, [0.3, 0.3])} label="painted texture" side="right" />
      <Paw f={f} at={s(VO.paint + 3.2)} until={s(T.props - 0.3)} target={onCard(RIGHT, v, [0.6, 0.62])} label="drawn over painted eyes" side="below" />
    </AbsoluteFill>
  );
};

// The menu's playground with nobody in it (a slow camera arc, the same in both), then the
// top of the tank (a close-up cut from the full-size capture, prep.sh): each a wipe between
// old and new. The playground wipes reveal the new set and hold it while the paws point (so
// they always point at the new one); the tank's swings, its paw on the right post, which it
// never crosses.
const Props: React.FC<{f: number}> = ({f}) => {
  const close = f >= s(T.propsClose);
  const tank = f >= s(T.tank);
  const v = view(BIG);
  const reveal = (at: number) => keys(f, [[at, 0.86], [at + 0.8, 0.86], [at + 1.8, 0.1]]);
  return (
    <AbsoluteFill>
      {!close && <Wipe f={f} box={BIG} at={s(T.props)} old="old_props_wide" now="new_props_wide" start={s(T.props)} v={v} split={reveal(T.props)} />}
      {close && !tank && <Wipe f={f} box={BIG} at={s(T.propsClose)} old="old_props_close" now="new_props_close" start={s(T.propsClose)} v={v} split={reveal(T.propsClose)} />}
      {tank && <Wipe f={f} box={BIG} at={s(T.tank)} old="old_tank" now="new_tank" start={s(T.tank)} v={v} split={swing(f, s(T.tank), 6.2)} />}
      <Paw f={f} at={s(T.props + 2.0)} until={s(T.propsClose - 0.2)} target={onCard(BIG, v, [0.17, 0.3])} label="a rounder slide" side="below" />
      <Paw f={f} at={s(T.propsClose + 1.8)} until={s(T.propsClose + 3.0)} target={onCard(BIG, v, [0.3, 0.72])} label="painted strokes" side="right" />
      <Paw f={f} at={s(T.propsClose + 3.1)} until={s(T.tank - 0.2)} target={onCard(BIG, v, [0.47, 0.56])} label="softer, inked edges" side="below" />
      <Paw f={f} at={s(VO.tank + 0.4)} until={s(T.dayNight - 0.2)} target={onCard(BIG, v, [0.915, 0.6])} label="painted posts, inked edges" side="left" />
    </AbsoluteFill>
  );
};

const PHASES = [
  {at: T.dayNight, name: 'Day', clip: 'classic_day'},
  {at: T.dusk, name: 'Dusk', clip: 'classic_dusk'},
  {at: T.night, name: 'Night: they doze off and glow', clip: 'night_calm'},
];
// At night the cards push in on the sleeping pile ("doze off and glow"), then pull back until
// the string lights on the top rail show above it ("under the string lights").
const nightView = (f: number) =>
  mixView(
    mixView(view(LEFT), view(LEFT, 1.8, 0.5, 0.86), ease(prog(f, s(T.night + 0.4), s(T.night + 1.2)))),
    view(LEFT, 1.25, 0.5, 0.51),
    ease(prog(f, s(T.night + 2.1), s(T.night + 2.9))),
  );
const DayNight: React.FC<{f: number}> = ({f}) => {
  const k = PHASES.reduce((n, ph, i) => (f >= s(ph.at) ? i : n), 0);
  const ph = PHASES[k];
  return (
    <AbsoluteFill>
      <Split f={f} at={s(T.dayNight)} old={`old_${ph.clip}`} now={`new_${ph.clip}`} start={s(ph.at)} v={k === 2 ? nightView(f) : view(LEFT)} />
      {PHASES.map((x, i) => (
        <Center key={x.name} f={f} at={s(x.at) + 6} until={i < PHASES.length - 1 ? s(PHASES[i + 1].at) - 4 : s(T.modes) - 4}>
          {x.name}
        </Center>
      ))}
      <Paw f={f} at={s(T.night + 1.0)} until={s(T.night + 2.0)} target={onCard(RIGHT, nightView(f), [0.5, 0.82])} label="asleep, and glowing" side="above" />
    </AbsoluteFill>
  );
};

// Each mode's play area (centre and zoom), so the chibis read.
const MODES = [
  {clip: 'classic_day', name: 'Classic', zoom: 2, at: [0.5, 0.74]},
  {clip: 'sphere', name: 'Magnetic Sphere', zoom: 2, at: [0.5, 0.55]},
  {clip: 'water', name: 'Aquarium', zoom: 2.2, at: [0.5, 0.37]},
  {clip: 'star', name: 'Star Bubble', zoom: 1.8, at: [0.42, 0.56]},
  {clip: 'ball', name: 'Ball Pool', zoom: 2, at: [0.5, 0.66]},
  {clip: 'candy', name: 'Candy Scale', zoom: 2, at: [0.5, 0.52]},
  {clip: 'tower', name: 'Hug Tower', zoom: 2, at: [0.5, 0.66]},
] as const;
const MODE_LEN = (T.outro - T.modes) / MODES.length;
const Modes: React.FC<{f: number}> = ({f}) => {
  // From 12 frames before the section (its fade in) to its end.
  const k = Math.max(0, Math.min(MODES.length - 1, Math.floor((f - s(T.modes)) / s(MODE_LEN))));
  const at = s(T.modes + k * MODE_LEN);
  const m = MODES[k];
  return (
    <AbsoluteFill>
      <Split f={f} at={k === 0 ? at : at - 20} old={`old_${m.clip}`} now={`new_${m.clip}`} start={at} v={view(LEFT, m.zoom, m.at[0], m.at[1])} />
      <Center f={f} at={at + 4} until={at + s(MODE_LEN) - 6}>
        {k + 1}/7 · {m.name}
      </Center>
    </AbsoluteFill>
  );
};

const Outro: React.FC<{f: number}> = ({f}) => {
  const logo = pop(f, s(T.outro + 0.2), 150, 12);
  const thanks = pop(f, s(T.outro + 0.9), 160, 13);
  const credits = prog(f, s(T.outro + 1.8), s(T.outro + 2.6));
  return (
    <AbsoluteFill>
      <Confetti opacity={0.45} seed="outro" count={12} />
      <div style={{position: 'absolute', left: 0, right: 0, top: 220, textAlign: 'center', ...enter(logo, 0, -40)}}>
        <Img src={staticFile('logo_sticker.png')} style={{width: 760}} />
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: 470, textAlign: 'center', ...enter(thanks, 0, 30)}}>
        <span style={sticker(80)}>Thanks for </span>
        <RoundWord size={80}>watching!</RoundWord>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: 640, textAlign: 'center', ...enter(credits, 0, 20)}}>
        <Pill size={32}>Music: Cozy Horizons by Kounine · Voice: Kokoro (af_heart)</Pill>
        <div style={{height: 22}} />
        <Pill size={32} bg={C.pinkDeep} color="#fff" style={{border: '3px solid #fff'}}>
          Made by Hexhound
        </Pill>
      </div>
    </AbsoluteFill>
  );
};

// ── The video ───────────────────────────────────────────────────────────────────────────
const NIGHT_SKY = (f: number) =>
  f >= s(T.dayNight) && f < s(T.modes) ? Math.max(prog(f, s(T.dusk), s(T.night)) * 0.6, prog(f, s(T.night), s(T.night) + 30)) * (1 - prog(f, s(T.modes) - 10, s(T.modes) + 10)) : 0;

// The music: a quiet bed that dips under the voice. Lines less than 4 s apart count as one
// passage, so it dips once per passage instead of swelling between every line.
const PASSAGES = LINES.map((l) => [s(VO[l.id]), s(VO[l.id] + l.seconds)])
  .sort((a, b) => a[0] - b[0])
  .reduce<number[][]>((out, span) => {
    const last = out[out.length - 1];
    if (last && span[0] - last[1] < s(4)) last[1] = Math.max(last[1], span[1]);
    else out.push([...span]);
    return out;
  }, []);
const musicVolume = (f: number) => {
  let duck = 0;
  for (const [a, b] of PASSAGES) duck = Math.max(duck, prog(f, a - 36, a) * (1 - prog(f, b, b + 48)));
  const fadeIn = prog(f, 0, 40);
  const fadeOut = 1 - prog(f, TOTAL - 150, TOTAL);
  return lerp(0.16, 0.085, ease(duck)) * fadeIn * fadeOut;
};

export const Devlog: React.FC = () => {
  const f = useCurrentFrame();
  const section = (a: number, b: number) => f >= s(a) - 12 && f < s(b) + 12;
  const fade = (a: number, b: number) => Math.min(prog(f, s(a) - 12, s(a) + 6), 1 - prog(f, s(b) - 6, s(b) + 12));
  return (
    <AbsoluteFill style={{background: C.lilac, fontFamily: FONT}}>
      <FontFace />
      <Sky night={NIGHT_SKY(f)} />
      <Confetti opacity={0.22} seed="bg" count={8} />
      {section(0, T.chibis) && (
        <AbsoluteFill style={{opacity: fade(-1, T.chibis)}}>
          <Intro f={f} />
        </AbsoluteFill>
      )}
      {section(T.chibis, T.textures) && (
        <AbsoluteFill style={{opacity: fade(T.chibis, T.textures)}}>
          <Chip f={f} at={s(T.chibis)} until={s(T.textures) - 6}>
            The chibis
          </Chip>
          <Chibis f={f} />
        </AbsoluteFill>
      )}
      {section(T.textures, T.props) && (
        <AbsoluteFill style={{opacity: fade(T.textures, T.props)}}>
          <Chip f={f} at={s(T.textures)} until={s(T.props) - 6}>
            Textures and shading
          </Chip>
          <Textures f={f} />
        </AbsoluteFill>
      )}
      {section(T.props, T.dayNight) && (
        <AbsoluteFill style={{opacity: fade(T.props, T.dayNight)}}>
          <Chip f={f} at={s(T.props)} until={s(T.dayNight) - 6}>
            Props
          </Chip>
          <Props f={f} />
        </AbsoluteFill>
      )}
      {section(T.dayNight, T.modes) && (
        <AbsoluteFill style={{opacity: fade(T.dayNight, T.modes)}}>
          <Chip f={f} at={s(T.dayNight)} until={s(T.modes) - 6}>
            Day and night
          </Chip>
          <DayNight f={f} />
        </AbsoluteFill>
      )}
      {section(T.modes, T.outro) && (
        <AbsoluteFill style={{opacity: fade(T.modes, T.outro)}}>
          <Chip f={f} at={s(T.modes)} until={s(T.outro) - 6}>
            All seven modes
          </Chip>
          <Modes f={f} />
        </AbsoluteFill>
      )}
      {f >= s(T.outro) - 12 && (
        <AbsoluteFill style={{opacity: prog(f, s(T.outro) - 12, s(T.outro) + 6)}}>
          <Outro f={f} />
        </AbsoluteFill>
      )}
      <Subtitles f={f} />
      <Audio src={staticFile('music/cozy_horizons.ogg')} volume={musicVolume} />
      {LINES.map((l) => (
        <Sequence key={l.id} from={s(VO[l.id])} durationInFrames={s(l.seconds) + 30}>
          <Audio src={staticFile(`voice/${l.id}.wav`)} volume={1} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
