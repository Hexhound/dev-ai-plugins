import React from 'react';
import {interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';

// Text treatments (craft §4). Each takes absolute frames for its entrances and exit, so it
// can be timed straight from the beat clock. Type, colour and sizes come from the brief.

export type Type = {sans: string; mono: string; ink: string; muted: string};

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

// 0…1 entrance at frame `at`, and 1…0 exit over `outLen` from `out`.
export const useReveal = (at: number, out = Infinity, outLen = 12, len = 26) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const inn = spring({frame: f - at, fps, config: {damping: 200}, durationInFrames: len});
  const gone = interpolate(f, [out, out + outLen], [0, 1], clamp);
  return Math.min(inn, 1 - gone);
};

const rise = (p: number, px = 16, blur = 10): React.CSSProperties => ({
  opacity: p,
  transform: `translateY(${(1 - p) * px}px)`,
  filter: p < 0.999 ? `blur(${(1 - p) * blur}px)` : undefined,
});

export const Eyebrow: React.FC<{type: Type; n: string; label: string; accent: string; p: number; size?: number}> = ({type, n, label, accent, p, size = 17}) => (
  <div style={{display: 'flex', alignItems: 'center', gap: 16, ...rise(p, 8, 6)}}>
    <div style={{width: 44 * p, height: 2, background: accent, borderRadius: 2}} />
    <div style={{fontFamily: type.mono, fontSize: size, letterSpacing: '0.32em', color: type.muted}}>
      <span style={{color: accent}}>{n}</span>&nbsp;&nbsp;{label}
    </div>
  </div>
);

// Big type beside the product.
export const SplitHeadline: React.FC<{
  type: Type;
  n: string;
  label: string;
  accent: string;
  lines: string[];
  at: number[];
  out: number;
  x: number;
  y: number;
  size?: number;
}> = ({type, n, label, accent, lines, at, out, x, y, size = 80}) => {
  const f = useCurrentFrame();
  const eyebrow = useReveal(at[0] - 10, out);
  const slide = interpolate(f, [out, out + 18], [0, -160], clamp);
  return (
    <div style={{position: 'absolute', left: x + slide, top: y}}>
      <Eyebrow type={type} n={n} label={label} accent={accent} p={eyebrow} />
      <div style={{marginTop: 22, fontFamily: type.sans, fontWeight: 800, fontSize: size, lineHeight: 1.02, letterSpacing: '-0.03em', color: type.ink}}>
        {lines.map((line, i) => (
          <Line key={i} at={at[i]} out={out}>
            {line}
          </Line>
        ))}
      </div>
    </div>
  );
};

const Line: React.FC<{at: number; out: number; children: React.ReactNode}> = ({at, out, children}) => {
  const p = useReveal(at, out);
  return <div style={{whiteSpace: 'nowrap', ...rise(p, 22, 12)}}>{children}</div>;
};

// Eyebrow + short headline on frosted glass.
export const GlassCard: React.FC<{
  type: Type;
  n: string;
  label: string;
  accent: string;
  lines: string[];
  at: number[];
  out: number;
  x: number;
  y: number;
  align?: 'left' | 'right';
}> = ({type, n, label, accent, lines, at, out, x, y, align = 'left'}) => {
  const p = useReveal(at[0] - 12, out);
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        padding: '28px 38px 32px',
        borderRadius: 22,
        background: 'linear-gradient(135deg, rgba(28,30,40,0.72), rgba(14,15,22,0.55))',
        backdropFilter: 'blur(22px) saturate(1.4)',
        border: '1px solid rgba(255,255,255,0.12)',
        boxShadow: `0 30px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1), 0 0 60px ${accent}22`,
        textAlign: align,
        ...rise(p, 26, 10),
      }}
    >
      <Eyebrow type={type} n={n} label={label} accent={accent} p={p} />
      <div style={{marginTop: 16, fontFamily: type.sans, fontWeight: 800, fontSize: 56, lineHeight: 1.04, letterSpacing: '-0.02em', color: type.ink}}>
        {lines.map((line, i) => (
          <Line key={i} at={at[i]} out={out}>
            {line}
          </Line>
        ))}
      </div>
    </div>
  );
};

// A label pinned to a screen point by a leader line; pass the point every frame so it
// rides the camera.
export const Callout: React.FC<{
  type: Type;
  n: string;
  label: string;
  accent: string;
  text: string;
  point: readonly [number, number];
  offset: [number, number];
  at: number;
  out: number;
}> = ({type, n, label, accent, text, point, offset, at, out}) => {
  const p = useReveal(at, out);
  const line = useReveal(at, out, 12, 18);
  const [px, py] = point;
  const lx = px + offset[0];
  const ly = py + offset[1];
  const len = Math.hypot(offset[0], offset[1]);
  return (
    <>
      <svg style={{position: 'absolute', inset: 0, width: 1920, height: 1080, overflow: 'visible'}}>
        <circle cx={px} cy={py} r={7 * line} fill={accent} />
        <circle cx={px} cy={py} r={16 * line} fill="none" stroke={accent} strokeOpacity={0.5} strokeWidth={2} />
        <line x1={px} y1={py} x2={px + offset[0] * line} y2={py + offset[1] * line} stroke={accent} strokeWidth={2} strokeDasharray={len} />
      </svg>
      <div
        style={{
          position: 'absolute',
          left: lx,
          top: ly,
          transform: `translate(${offset[0] < 0 ? '-100%' : '0'}, -50%)`,
          padding: '18px 26px',
          borderRadius: 16,
          background: 'rgba(12,13,20,0.78)',
          backdropFilter: 'blur(16px)',
          border: `1px solid ${accent}55`,
          ...rise(p, 12, 8),
        }}
      >
        <Eyebrow type={type} n={n} label={label} accent={accent} p={p} size={15} />
        <div style={{marginTop: 8, fontFamily: type.sans, fontWeight: 700, fontSize: 38, color: type.ink, whiteSpace: 'nowrap', letterSpacing: '-0.01em'}}>{text}</div>
      </div>
    </>
  );
};

// Words landing one by one (on beats), stacked.
export const KineticWords: React.FC<{
  type: Type;
  n: string;
  label: string;
  accent: string;
  words: {text: string; at: number}[];
  eyebrowAt: number;
  out: number;
  x: number;
  y: number;
  size?: number;
}> = ({type, n, label, accent, words, eyebrowAt, out, x, y, size = 96}) => {
  const f = useCurrentFrame();
  const eyebrow = useReveal(eyebrowAt, out);
  return (
    <div style={{position: 'absolute', left: x, top: y}}>
      <Eyebrow type={type} n={n} label={label} accent={accent} p={eyebrow} />
      <div style={{marginTop: 14}}>
        {words.map((w, i) => {
          const p = spring({frame: f - w.at, fps: 60, config: {damping: 13, stiffness: 180}});
          const gone = interpolate(f, [out, out + 12], [1, 0], clamp);
          const current = i === words.filter((k) => k.at <= f).length - 1;
          return (
            <div
              key={i}
              style={{
                fontFamily: type.sans,
                fontWeight: 900,
                fontSize: size,
                lineHeight: 0.98,
                letterSpacing: '-0.04em',
                color: current ? type.ink : 'rgba(255,255,255,0.38)',
                opacity: Math.min(1, p) * gone,
                transform: `translateX(${(1 - Math.min(1, p)) * -60}px) scale(${0.9 + 0.1 * p})`,
                transformOrigin: 'left center',
                textShadow: '0 8px 40px rgba(0,0,0,0.6)',
              }}
            >
              {w.text}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// A big live value, proving the thing is live.
export const Readout: React.FC<{
  type: Type;
  n: string;
  label: string;
  accent: string;
  rows: {label: string; value: string; at: number}[];
  caption: string;
  at: number;
  out: number;
  x: number;
  y: number;
}> = ({type, n, label, accent, rows, caption, at, out, x, y}) => {
  const f = useCurrentFrame();
  const p = useReveal(at, out);
  return (
    <div style={{position: 'absolute', left: x, top: y}}>
      <Eyebrow type={type} n={n} label={label} accent={accent} p={p} />
      {rows.map((r) => {
        const q = useRevealAt(f, r.at, out);
        return (
          <div key={r.label} style={{display: 'flex', alignItems: 'baseline', gap: 22, marginTop: 10, ...rise(q, 14, 8)}}>
            <div style={{fontFamily: type.mono, fontSize: 30, color: accent, width: 80, letterSpacing: '0.1em'}}>{r.label}</div>
            <div style={{fontFamily: type.mono, fontWeight: 700, fontSize: 124, color: type.ink, letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums', textShadow: '0 10px 50px rgba(0,0,0,0.6)'}}>
              {r.value}
            </div>
          </div>
        );
      })}
      <div style={{marginTop: 10, fontFamily: type.sans, fontWeight: 600, fontSize: 30, color: type.muted, ...rise(p, 10, 6)}}>{caption}</div>
    </div>
  );
};

const useRevealAt = (f: number, at: number, out: number) =>
  Math.min(interpolate(f, [at, at + 14], [0, 1], clamp), interpolate(f, [out, out + 12], [1, 0], clamp));

// A dark gradient from the left edge so text stays legible over busy footage.
export const Scrim: React.FC<{from: number; to: number; width?: number; strength?: number}> = ({from, to, width = 0.55, strength = 0.82}) => {
  const f = useCurrentFrame();
  const o = Math.min(interpolate(f, [from, from + 14], [0, 1], clamp), interpolate(f, [to, to + 12], [1, 0], clamp));
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: `linear-gradient(90deg, rgba(6,7,11,${strength}) 0%, rgba(6,7,11,${strength * 0.6}) ${width * 55}%, transparent ${width * 100}%)`,
        opacity: o,
        pointerEvents: 'none',
      }}
    />
  );
};
