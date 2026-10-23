// Text: pills, sticker words, the outlined headline word, labels, counters, keys and the
// burned-in subtitles.
import React from 'react';
import {enter, ease, gone, pop, prog, s} from './motion';
import {useTheme, type Theme} from './theme';

// A rounded label. Defaults: ink text on paper.
export const Pill: React.FC<{children: React.ReactNode; size?: number; style?: React.CSSProperties; color?: string; bg?: string}> = ({children, size = 44, style, color, bg}) => {
  const t = useTheme();
  return (
    <div
      style={{
        position: 'relative',
        display: 'inline-block',
        padding: `${size * 0.32}px ${size * 0.62}px ${size * 0.38}px`,
        borderRadius: size,
        background: bg ?? t.paper,
        color: color ?? t.ink,
        fontFamily: t.font,
        fontWeight: 700,
        fontSize: size,
        whiteSpace: 'nowrap',
        boxShadow: `0 ${size * 0.25}px ${size * 0.6}px rgba(40,25,50,0.28)`,
        border: `3px solid ${bg ? 'rgba(255,255,255,0.6)' : t.accent + '55'}`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

// Text with a stroked outline (sticker look). The stroke joins are mitred: fine for round
// fonts at normal sizes; for big words with sharp corners use OutlineWord.
export const sticker = (t: Theme, size: number, color = t.ink, outline = t.paper, stroke = 0.24): React.CSSProperties => ({
  fontFamily: t.font,
  fontWeight: 700,
  fontSize: size,
  lineHeight: 1.04,
  letterSpacing: '-0.02em',
  color,
  WebkitTextStroke: `${Math.round(size * stroke)}px ${outline}`,
  paintOrder: 'stroke fill',
  whiteSpace: 'nowrap',
});

const ring = (radius: number, color: string, steps = 36) =>
  Array.from({length: steps}, (_, i) => {
    const a = (i / steps) * Math.PI * 2;
    return `${(Math.cos(a) * radius).toFixed(2)}px ${(Math.sin(a) * radius).toFixed(2)}px 0 ${color}`;
  });

// A headline word with an ink outline and a paper outer edge, drawn as rings of text
// shadows so every corner is round. (WebkitTextStroke mitres corners, and at big sizes it
// spikes out of sharp glyph corners, like a "w".)
export const OutlineWord: React.FC<{size: number; children: React.ReactNode; color?: string; style?: React.CSSProperties}> = ({size, children, color, style}) => {
  const t = useTheme();
  const inner = size * 0.12;
  const outer = size * 0.22;
  const shadows = [...[0.35, 0.7, 1].flatMap((k) => ring(inner * k, t.ink)), ...[0.55, 0.8, 1].flatMap((k) => ring(outer * k, t.paper))];
  return (
    <span
      style={{
        display: 'inline-block',
        fontFamily: t.font,
        fontWeight: 700,
        fontSize: size,
        lineHeight: 1.04,
        letterSpacing: '-0.02em',
        whiteSpace: 'nowrap',
        color: color ?? t.accent,
        textShadow: shadows.join(', '),
        ...style,
      }}
    >
      {children}
    </span>
  );
};

// The section's name, top left, while the section plays.
export const Chip: React.FC<{f: number; at: number; until: number; children: React.ReactNode}> = ({f, at, until, children}) => {
  if (f < at || f > until + 12) return null;
  return (
    <div style={{position: 'absolute', left: 60, top: 48, opacity: gone(f, until, 12)}}>
      <div style={enter(pop(f, at, 170, 13), -40, 0)}>
        <Pill size={40}>{children}</Pill>
      </div>
    </div>
  );
};

// A centred label under the side-by-side cards (y 790), or at `top`.
export const Center: React.FC<{f: number; at: number; until: number; top?: number; children: React.ReactNode}> = ({f, at, until, top = 790, children}) => {
  if (f < at || f > until + 10) return null;
  return (
    <div style={{position: 'absolute', left: 0, right: 0, top, textAlign: 'center', opacity: gone(f, until, 10)}}>
      <div style={enter(pop(f, at, 180, 13), 0, 20)}>
        <Pill size={46}>{children}</Pill>
      </div>
    </div>
  );
};

// A big number counting up over a caption: "≈ 30,000" over "triangles".
export const Counter: React.FC<{f: number; at: number; until: number; value: number; caption: string; approx?: boolean; x: number; y: number; size?: number; color?: string}> = ({
  f,
  at,
  until,
  value,
  caption,
  approx = false,
  x,
  y,
  size = 110,
  color,
}) => {
  const t = useTheme();
  if (f < at || f > until + 14) return null;
  const n = Math.round(value * ease(prog(f, at, at + 30)));
  return (
    <div style={{position: 'absolute', left: x, top: y, width: 'max-content', transform: 'translate(-50%, -50%)', opacity: gone(f, until, 14)}}>
      <div style={{textAlign: 'center', ...enter(pop(f, at, 170, 12), 0, 30)}}>
        <div style={sticker(t, size, color ?? t.ink, t.paper, 0.2)}>
          {approx ? '≈ ' : ''}
          {n.toLocaleString('en-US')}
        </div>
        <div style={{...sticker(t, size * 0.4, t.ink, t.paper, 0.3), marginTop: 6}}>{caption}</div>
      </div>
    </div>
  );
};

// A colour key: a title over chips (an x-ray's "surfaces stacked: 1 2 3 5 8+").
export const Key: React.FC<{f: number; at: number; until: number; x: number; y: number; title: string; items: {label: string; color: string}[]}> = ({f, at, until, x, y, title, items}) => {
  const t = useTheme();
  if (f < at || f > until + 14) return null;
  return (
    <div style={{position: 'absolute', left: x, top: y, width: 'max-content', transform: 'translate(-50%, 0)', opacity: gone(f, until, 14)}}>
      <div
        style={{
          padding: '16px 24px 18px',
          borderRadius: 30,
          background: t.paper,
          boxShadow: '0 10px 26px rgba(40,25,50,0.25)',
          fontFamily: t.font,
          fontWeight: 700,
          color: t.ink,
          textAlign: 'center',
          ...enter(pop(f, at, 170, 13), 0, 20),
        }}
      >
        <div style={{fontSize: 30, marginBottom: 12}}>{title}</div>
        <div style={{display: 'flex', gap: 10, justifyContent: 'center'}}>
          {items.map((k) => (
            <div key={k.label} style={{minWidth: 66, height: 52, padding: '0 8px', borderRadius: 16, background: k.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, color: t.inkDeep}}>
              {k.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ── Subtitles ───────────────────────────────────────────────────────────────────────────
export type Line = {id: string; text: string; seconds: number};
export type Sub = {at: number; until: number; text: string};

// Each narration line split at its "|" marks (script.md), or else at commas and full stops
// into chunks of at most ~56 characters, each shown for its share of the line's time. The
// same rule as make-srt.py: keep them in step.
export const buildSubs = (lines: Line[], starts: Record<string, number>): Sub[] => {
  const out: Sub[] = [];
  for (const l of lines) {
    const chunks: string[] = l.text.includes('|') ? l.text.split('|').map((c) => c.trim()) : [];
    if (chunks.length === 0) {
      for (const part of l.text.split(/(?<=[.!?,])\s+/)) {
        const last = chunks[chunks.length - 1];
        if (last && (last + ' ' + part).length <= 56) chunks[chunks.length - 1] = last + ' ' + part;
        else chunks.push(part);
      }
    }
    const total = chunks.reduce((n, c) => n + c.length, 0);
    let time = starts[l.id];
    chunks.forEach((chunk, i) => {
      const len = (l.seconds * chunk.length) / total;
      // A line's last chunk stays 6 frames past the voice; the others hand over on time.
      out.push({at: s(time), until: s(time + len) + (i === chunks.length - 1 ? 6 : 0), text: chunk});
      time += len;
    });
  }
  return out;
};

export const Subtitles: React.FC<{f: number; subs: Sub[]}> = ({f, subs}) => {
  const t = useTheme();
  // The latest one to start, so a line's lingering last chunk gives way to the next line.
  const sub = subs.reduce<Sub | undefined>((on, x) => (f >= x.at && f < x.until && (!on || x.at >= on.at) ? x : on), undefined);
  if (!sub) return null;
  return (
    <div style={{position: 'absolute', left: 0, right: 0, bottom: 34, textAlign: 'center', opacity: Math.min(1, (f - sub.at) / 6)}}>
      <div
        style={{
          display: 'inline-block',
          maxWidth: 1500,
          padding: '14px 34px 18px',
          borderRadius: 26,
          background: 'rgba(36,27,43,0.82)',
          color: t.paper,
          fontFamily: t.font,
          fontWeight: 700,
          fontSize: 40,
          lineHeight: 1.3,
          boxShadow: '0 10px 28px rgba(36,27,43,0.3)',
        }}
      >
        {sub.text}
      </div>
    </div>
  );
};
