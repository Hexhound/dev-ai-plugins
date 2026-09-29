import React from 'react';
import {AbsoluteFill, Img, interpolate, random, useCurrentFrame} from 'remotion';

// Building blocks for depth and light. Tint and shape them per product; don't reuse a look.

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

export type Blob = {color: string; x: number; y: number; size: number; speed: number; phase: number};

export const Backdrop: React.FC<{base: string; blobs: Blob[]; vignette?: number; grain?: number}> = ({base, blobs, vignette = 0.65, grain = 0.05}) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{background: base, overflow: 'hidden'}}>
      {blobs.map((b, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: b.x + Math.sin(f / b.speed + b.phase) * 120,
            top: b.y + Math.cos(f / (b.speed * 1.3) + b.phase) * 90,
            width: b.size,
            height: b.size,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${b.color} 0%, transparent 65%)`,
            filter: 'blur(40px)',
            opacity: 0.55,
          }}
        />
      ))}
      <AbsoluteFill style={{background: `radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,${vignette}) 100%)`}} />
      {grain > 0 && <Grain opacity={grain} />}
    </AbsoluteFill>
  );
};

// Film grain: an SVG noise tile shifted every frame.
export const Grain: React.FC<{opacity: number}> = ({opacity}) => {
  const f = useCurrentFrame();
  const svg = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter><rect width="256" height="256" filter="url(#n)"/></svg>`,
  );
  return (
    <AbsoluteFill
      style={{
        backgroundImage: `url("data:image/svg+xml,${svg}")`,
        backgroundPosition: `${Math.floor(random(`gx${f}`) * 256)}px ${Math.floor(random(`gy${f}`) * 256)}px`,
        opacity,
        mixBlendMode: 'overlay',
        pointerEvents: 'none',
      }}
    />
  );
};

// The product window: shadow, 1px edge light, accent glow, rounded corners.
export const Window: React.FC<{width: number; height: number; glow: string; radius?: number; children: React.ReactNode}> = ({
  width,
  height,
  glow,
  radius = 14,
  children,
}) => (
  <div
    style={{
      position: 'relative',
      width,
      height,
      borderRadius: radius,
      overflow: 'hidden',
      boxShadow: `0 70px 160px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.14), 0 0 140px ${glow}`,
    }}
  >
    {children}
  </div>
);

export const Frame: React.FC<{src: string; style?: React.CSSProperties}> = ({src, style}) => (
  <Img src={src} style={{position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', ...style}} />
);

// A clear glass slab that fills with `children` behind a diagonal specular sweep.
// p: 0…1 fill progress (0 = empty glass, 1 = content fully in).
export const GlassMaterialize: React.FC<{p: number; children: React.ReactNode}> = ({p, children}) => {
  const edge = interpolate(p, [0, 1], [-30, 130]);
  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.16), rgba(255,255,255,0.03) 45%, rgba(255,255,255,0.08))',
          backdropFilter: 'blur(8px) saturate(1.3)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5), inset 0 0 0 1px rgba(255,255,255,0.22), inset 0 -40px 80px rgba(255,255,255,0.04)',
        }}
      />
      <AbsoluteFill
        style={{
          WebkitMaskImage: `linear-gradient(115deg, black ${edge - 12}%, transparent ${edge + 4}%)`,
          maskImage: `linear-gradient(115deg, black ${edge - 12}%, transparent ${edge + 4}%)`,
          filter: `blur(${interpolate(p, [0, 1], [18, 0], clamp)}px) brightness(${interpolate(p, [0, 0.7, 1], [1.6, 1.15, 1], clamp)})`,
        }}
      >
        {children}
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          background: `linear-gradient(115deg, transparent ${edge - 6}%, rgba(255,255,255,0.55) ${edge}%, transparent ${edge + 5}%)`,
          mixBlendMode: 'screen',
          opacity: p > 0 && p < 1 ? 1 : 0,
        }}
      />
    </AbsoluteFill>
  );
};

// Reveals `after` over `before` behind a vertical light line moving right→left (p 0…1).
export const SweepReveal: React.FC<{p: number; before: React.ReactNode; after: React.ReactNode; color: string; seed?: string}> = ({
  p,
  before,
  after,
  color,
  seed = 'sweep',
}) => {
  const x = interpolate(p, [0, 1], [102, -2]);
  const live = p > 0 && p < 1;
  return (
    <AbsoluteFill>
      <AbsoluteFill>{before}</AbsoluteFill>
      <AbsoluteFill style={{clipPath: `inset(0 0 0 ${Math.max(0, x)}%)`}}>{after}</AbsoluteFill>
      {live && (
        <>
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: `${x}%`,
              width: 4,
              marginLeft: -2,
              background: `linear-gradient(transparent, white 20%, ${color} 50%, white 80%, transparent)`,
              boxShadow: `0 0 30px 8px ${color}, 0 0 90px 30px ${color}88`,
            }}
          />
          {Array.from({length: 26}, (_, i) => {
            const r = (k: string) => random(`${seed}-${i}-${k}`);
            const drift = (p * 3 + r('t')) % 1;
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: `calc(${x}% + ${(drift * 90 + 4) * (r('side') > 0.3 ? 1 : -0.4)}px)`,
                  top: `${r('y') * 100}%`,
                  width: 3 + r('s') * 4,
                  height: 3 + r('s') * 4,
                  borderRadius: '50%',
                  background: 'white',
                  boxShadow: `0 0 10px ${color}`,
                  opacity: (1 - drift) * 0.9,
                }}
              />
            );
          })}
        </>
      )}
    </AbsoluteFill>
  );
};

// A diagonal wipe with a bright edge: `next` covers `prev` as p goes 0…1.
export const LightWipe: React.FC<{p: number; prev: React.ReactNode; next: React.ReactNode; color?: string}> = ({p, prev, next, color = 'white'}) => {
  const e = interpolate(p, [0, 1], [-20, 120]);
  return (
    <AbsoluteFill>
      <AbsoluteFill>{prev}</AbsoluteFill>
      <AbsoluteFill style={{clipPath: `polygon(0 0, ${e}% 0, ${e - 20}% 100%, 0 100%)`}}>{next}</AbsoluteFill>
      {p > 0 && p < 1 && (
        <AbsoluteFill
          style={{
            background: `linear-gradient(101deg, transparent ${e - 11}%, ${color} ${e - 10}%, transparent ${e - 8.5}%)`,
            mixBlendMode: 'screen',
            opacity: 0.85,
          }}
        />
      )}
    </AbsoluteFill>
  );
};

// A soft white flash peaking at `peak` frames into the local timeline.
export const Flash: React.FC<{peak: number; length?: number; color?: string}> = ({peak, length = 14, color = 'white'}) => {
  const f = useCurrentFrame();
  const o = interpolate(f, [peak - length / 3, peak, peak + length], [0, 0.55, 0], clamp);
  return <AbsoluteFill style={{background: `radial-gradient(ellipse at center, ${color}, transparent 70%)`, opacity: o, pointerEvents: 'none'}} />;
};
