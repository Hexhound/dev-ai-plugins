// The pointer: a sticker (theme.pointer: a paw, a hand, the mascot's mitten, drawn pointing
// up) that slides in beside a target, turns its tip toward it, taps, and says a short label
// in a bubble, while a ring pulses on the target.
import React from 'react';
import {Img, staticFile} from 'remotion';
import {enter, gone, lerp, pop} from './motion';
import {Pill} from './text';
import {useTheme} from './theme';

type Side = 'left' | 'right' | 'below' | 'above';
const OFFSETS: Record<Side, [number, number]> = {left: [-150, 70], right: [150, 70], below: [40, 160], above: [40, -170]};

// `side`: where it rests, from the target; or `offset` (pixels) to rest it further off, in
// empty space. The bubble sits right of the pointer, or left of it when side is 'left' or
// it would run off the frame's right edge. Keep labels short (2–5 words) and adding a fact
// the subtitle doesn't already say.
export const Pointer: React.FC<{f: number; at: number; until: number; target: [number, number]; label: string; side?: Side; offset?: [number, number]}> = ({
  f,
  at,
  until,
  target,
  label,
  side = 'right',
  offset,
}) => {
  const t = useTheme();
  if (f < at || f > until + 14) return null;
  const p = pop(f, at, 150, 12);
  const away = offset ?? OFFSETS[side];
  const rest: [number, number] = [target[0] + away[0], target[1] + away[1]];
  const from: [number, number] = [rest[0] + away[0] * 1.2, rest[1] + away[1] * 1.2];
  const tap = Math.max(0, Math.sin(((f - at - 18) / 34) * Math.PI)) * (f > at + 18 ? 1 : 0);
  const x = lerp(from[0], rest[0], p) + (target[0] - rest[0]) * 0.12 * tap;
  const y = lerp(from[1], rest[1], p) + (target[1] - rest[1]) * 0.12 * tap;
  const angle = (Math.atan2(target[0] - x, -(target[1] - y)) * 180) / Math.PI;
  const ring = ((f - at) / 40) % 1;
  const bubbleLeft = side === 'left' || rest[0] + 80 + label.length * 19 + 56 > 1880;
  return (
    <div style={{position: 'absolute', inset: 0, opacity: Math.min(gone(f, until, 14), p * 2), pointerEvents: 'none'}}>
      <div
        style={{
          position: 'absolute',
          left: target[0] - 56,
          top: target[1] - 56,
          width: 112,
          height: 112,
          borderRadius: 56,
          border: `6px solid ${t.accent}`,
          opacity: p * (0.85 - 0.5 * ring),
          transform: `scale(${0.7 + 0.5 * ring})`,
        }}
      />
      <Img
        src={staticFile(t.pointer)}
        style={{
          position: 'absolute',
          left: x - 70,
          top: y - 70,
          width: 140,
          transform: `rotate(${angle}deg) scale(${1 - 0.1 * tap})`,
          filter: 'drop-shadow(0 8px 10px rgba(40,25,50,0.35))',
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
