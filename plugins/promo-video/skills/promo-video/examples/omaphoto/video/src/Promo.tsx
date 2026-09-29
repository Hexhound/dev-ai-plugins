import React from 'react';
import {AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {cameraAt, follow, frame, project, Stage, type Cam, type Key} from './lib/camera';
import {frameUrl, marker, rect, remap, smoothPoint, trackAt, type Capture, type Rect} from './lib/capture';
import {Backdrop, Flash, Frame, GlassMaterialize, LightWipe, SweepReveal, Window} from './lib/material';
import {makeClock} from './lib/music';
import {Callout, GlassCard, KineticWords, Readout, Scrim, SplitHeadline, useReveal, type Type} from './lib/text';
import mainJson from './data/main.json';
import musicJson from './data/music.json';
import removeJson from './data/remove.json';
import themesJson from './data/themes.json';
import themeColors from './data/theme-colors.json';

const main = {...mainJson, name: 'main'} as unknown as Capture;
const removal = {...removeJson, name: 'remove'} as unknown as Capture;
const themes = {...themesJson, name: 'themes'} as unknown as Capture;
const c = makeClock(musicJson, 60);
export const TOTAL = c.at(20);

const T: Type = {sans: 'Inter, sans-serif', mono: '"JetBrains Mono", monospace', ink: '#ffffff', muted: 'rgba(255,255,255,0.72)'};
const ACCENT = {editor: '#9d7cff', remove: '#ff8a5c', layers: '#6aa8ff', paint: '#ff6fb5', adjust: '#3ddc97'};
const BASE = 1500;
const SIZE = main.size as [number, number];
const H = (BASE * SIZE[1]) / SIZE[0];
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const lerp = (f: number, i: number[], o: number[]) => interpolate(f, i, o, clamp);

// ── the continuous app shot (S2–S6): one camera across both captures, cut only at the match cut.
const PHOTO = rect(removal, 'photo');
const WOLF = rect(main, 'wolf');
const union = (a: Rect, b: Rect): Rect => {
  const x = Math.min(a[0], b[0]);
  const y = Math.min(a[1], b[1]);
  return [x, y, Math.max(a[0] + a[2], b[0] + b[2]) - x, Math.max(a[1] + a[3], b[1] + b[3]) - y];
};
const photoCam = frame(PHOTO, SIZE, BASE, {fill: 0.9});
const matchZoom = photoCam.zoom * 1.06;
// The blend control and the right half of WILD, where the blend visibly changes.
const layersCam = frame([0.4, 0.1, 0.6, 0.46], SIZE, BASE, {fill: 0.96});
const canvasCam = frame(rect(main, 'canvas'), SIZE, BASE, {fill: 0.97});
const center: Cam = {ax: 0.5, ay: 0.5, sx: 960, sy: 540, zoom: 1, rx: 0, ry: 0};

const KEYS: Key[] = [
  {f: c.at(2), ...center, sx: 2500, zoom: 0.8, rx: 2, ry: -14},
  {f: c.at(2, 2), ...center, sx: 1330, zoom: 0.8, rx: 2, ry: -14},
  {f: c.at(4), ...center, sx: 1300, zoom: 0.84, rx: 0, ry: -8},
  {f: c.at(5), ...photoCam},
  {f: c.at(7) - 1, ...photoCam, zoom: matchZoom},
  // Match cut: the poster's wolf takes the removed wolf's exact place on screen.
  {f: c.at(7), cut: true, ...center, ax: WOLF[0] + WOLF[2] / 2, ay: WOLF[1] + WOLF[3] / 2, zoom: (matchZoom * PHOTO[2]) / WOLF[2]},
  {f: c.at(7, 4), ...center, zoom: 1.08},
  {f: c.at(8, 1), ...layersCam},
  {f: c.at(9, 2), ...layersCam, zoom: layersCam.zoom * 1.04},
  {f: c.at(9, 3), ...canvasCam, zoom: 1.9},
  {f: c.at(11, 1) - 8, ...canvasCam, zoom: 1.95},
  // Pull back through the whole window so the eye toggle that hides the strokes is seen.
  {f: c.at(11, 1) + 14, ...center, zoom: 1.02},
  {f: c.at(11, 2) + 20, ...center, zoom: 1.02},
  {f: c.at(11, 4), ...canvasCam, sx: 1190, zoom: 1.18},
  {f: c.at(13, 1), ...canvasCam, sx: 1170, zoom: 1.24},
  {f: c.at(13, 1) + 16, ...canvasCam, sx: -1400, zoom: 1.24},
];

const mainAt = remap([
  [c.at(7), 0],
  [c.at(8, 1) - 1, marker(main, 'layers.screen') - 1],
  [c.at(8, 1), marker(main, 'layers.screen')],
  [c.at(8, 2), marker(main, 'layers.difference')],
  [c.at(8, 3), marker(main, 'layers.overlay')],
  [c.at(8, 4), marker(main, 'layers.normal')],
  [c.at(9, 1), marker(main, 'layers.new')],
  [c.at(9, 2.4), marker(main, 'paint.start')],
  [c.at(9, 3), marker(main, 'paint.soft')],
  [c.at(10, 1.5), marker(main, 'paint.soft') + 44],
  [c.at(10, 3), marker(main, 'paint.hard')],
  [c.at(11, 1), marker(main, 'paint.hard') + 44],
  [c.at(11, 2), marker(main, 'paint.hide')],
  [c.at(11, 3) - 1, marker(main, 'paint.hide') + 15],
  [c.at(11, 3), marker(main, 'adjust.open')],
  [c.at(11, 4), marker(main, 'adjust.hue')],
  [c.at(12, 2), marker(main, 'adjust.hue') + 45],
  [c.at(12, 2.5), marker(main, 'adjust.back')],
  [c.at(12, 3.6), marker(main, 'adjust.back') + 30],
  [c.at(12, 4), marker(main, 'adjust.saturation')],
  [c.at(12, 4.7), marker(main, 'adjust.saturation') + 20],
  [c.at(13, 1), marker(main, 'adjust.end')],
]);

const followWeight = (f: number) => lerp(f, [c.at(9, 2), c.at(9, 3), c.at(11, 1) - 14, c.at(11, 1)], [0, 1, 1, 0]);

const camAt = (f: number): Cam => {
  const base = cameraAt(KEYS, f);
  if (f < c.at(7)) return base;
  const at = mainAt(f);
  const cam = follow(base, smoothPoint(main, 'brush', at, 4, 12), followWeight(f));
  const before = smoothPoint(main, 'brush', mainAt(f - 3), 4, 12);
  const now = smoothPoint(main, 'brush', at, 4, 12);
  const vx = before && now ? (now[0] - before[0]) * 400 : 0;
  return {...cam, ry: cam.ry + Math.max(-4, Math.min(4, vx)) * followWeight(f)};
};

const AppShot: React.FC = () => {
  const f = useCurrentFrame();
  const cam = camAt(f);
  const prev = camAt(f - 1);
  const [x0, y0] = project(prev, BASE, SIZE, 0.5, 0.5);
  const [x1, y1] = project(cam, BASE, SIZE, 0.5, 0.5);
  const v = Math.hypot(x1 - x0, y1 - y0) + Math.abs(cam.zoom - prev.zoom) * 250;
  const blur = Math.min(5, Math.max(0, v - 22) * 0.05);
  // The UI fills the glass while it is still sliding in, never an empty pane at rest.
  const fill = lerp(f, [c.at(2) + 8, c.at(2, 2) + 24], [0, 1]);
  const sweep = lerp(f, [c.at(5, 1), c.at(5, 1) + 60], [0, 1]);
  const exit = lerp(f, [c.at(13, 1) + 8, c.at(13, 1) + 16], [1, 0]);
  const before = <Frame src={frameUrl(removal, marker(removal, 'before'))} />;
  const after = <Frame src={frameUrl(removal, removal.frames - 1)} />;
  let content: React.ReactNode;
  if (f < c.at(4)) content = <GlassMaterialize p={fill}>{before}</GlassMaterialize>;
  else if (f < c.at(7)) content = <SweepReveal p={sweep} before={before} after={after} color={ACCENT.remove} />;
  else content = <Frame src={frameUrl(main, mainAt(f))} />;
  const glow = f < c.at(7) ? 'rgba(157,124,255,0.28)' : 'rgba(106,168,255,0.22)';
  return (
    <AbsoluteFill style={{opacity: exit}}>
      <Stage cam={cam} base={BASE} size={SIZE} blur={blur}>
        <Window width={BASE} height={H} glow={glow}>
          {content}
        </Window>
      </Stage>
      <Flash peak={c.at(7)} length={16} />
      <AppText cam={cam} />
    </AbsoluteFill>
  );
};

const AppText: React.FC<{cam: Cam}> = ({cam}) => {
  const f = useCurrentFrame();
  const dropdown = rect(main, 'blendDropdown');
  const point = project(cam, BASE, SIZE, dropdown[0] + 0.01, dropdown[1] + dropdown[3] / 2);
  const hue = trackAt(main, 'hue', mainAt(f));
  const sat = trackAt(main, 'saturation', mainAt(f));
  const signed = (v: number | [number, number] | null, unit = '') => {
    const n = Math.round(typeof v === 'number' ? v : 0);
    return `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n)}${unit}`;
  };
  return (
    <>
      <SplitHeadline type={T} n="01" label="THE EDITOR" accent={ACCENT.editor} lines={['Photo editing,', 'native to Linux.']} at={[c.at(3, 1), c.at(3, 3)]} out={c.at(4, 1)} x={100} y={410} size={70} />
      <GlassCard
        type={T}
        n="02"
        label="REMOVE BACKGROUND"
        accent={ACCENT.remove}
        lines={['One click.', 'Fully offline.']}
        at={[c.at(5, 3), c.at(5, 4)]}
        out={c.at(7) - 10}
        x={80}
        y={770}
      />
      {f >= c.at(7, 4) && f < c.at(9, 3) && (
        <Callout type={T} n="03" label="LAYERS" accent={ACCENT.layers} text="Blend modes, live." point={point} offset={[-360, 330]} at={c.at(8, 1) - 8} out={c.at(9, 2)} />
      )}
      <Scrim from={c.at(9, 2)} to={c.at(11, 1)} width={0.4} />
      <KineticWords
        type={T}
        n="04"
        label="PAINT"
        accent={ACCENT.paint}
        words={[
          {text: 'Soft.', at: c.at(9, 3)},
          {text: 'Hard.', at: c.at(10, 3)},
        ]}
        eyebrowAt={c.at(9, 2)}
        out={c.at(11, 1)}
        x={90}
        y={600}
        size={116}
      />
      <Scrim from={c.at(11, 3)} to={c.at(13, 1)} />
      <Readout
        type={T}
        n="05"
        label="ADJUST"
        accent={ACCENT.adjust}
        rows={[
          {label: 'HUE', value: signed(hue, '°'), at: c.at(11, 3) + 6},
          {label: 'SAT', value: signed(sat), at: c.at(12, 4)},
        ]}
        caption="Levels, Curves, Hue/Saturation."
        at={c.at(11, 3)}
        out={c.at(13, 1)}
        x={90}
        y={560}
      />
    </>
  );
};

// ── S1 logo
const Logo: React.FC = () => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const icon = spring({frame: f - c.at(0, 2), fps, config: {damping: 14, stiffness: 120}});
  const streak = lerp(f, [0, 32], [0, 1]);
  const lift = lerp(f, [c.at(1, 3), c.at(2, 1) + 10], [0, 1]);
  const swell = lerp(f, [c.at(1, 3), c.at(2, 2)], [0, 1]);
  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
      <div
        style={{
          position: 'absolute',
          left: 960 - 700,
          top: 380 - 700,
          width: 1400,
          height: 1400,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,150,110,0.55), rgba(157,124,255,0.25) 40%, transparent 70%)',
          transform: `scale(${0.15 + swell * 1.6})`,
          opacity: icon * (1 - swell * 0.7),
          filter: 'blur(30px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 470,
          left: 0,
          width: 1920,
          height: 2,
          background: `linear-gradient(90deg, transparent ${streak * 100 - 30}%, rgba(255,255,255,0.95) ${streak * 100}%, transparent ${streak * 100 + 6}%)`,
          opacity: 1 - lerp(f, [26, 44], [0, 1]),
          boxShadow: '0 0 30px rgba(160,140,255,0.9)',
        }}
      />
      <div style={{opacity: 1 - lift, transform: `translateY(${-lift * 90}px) scale(${1 + lift * 0.08})`, filter: `blur(${lift * 14}px)`, display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
        <Img src={staticFile('icon.png')} style={{width: 150, height: 150, marginTop: -60, transform: `translateY(${(1 - icon) * -60}px) scale(${0.6 + 0.4 * icon})`, opacity: icon, filter: 'drop-shadow(0 20px 60px rgba(255,120,80,0.45))'}} />
        <div style={{display: 'flex', marginTop: 30, fontFamily: T.sans, fontWeight: 800, fontSize: 116, color: 'white', letterSpacing: '-0.035em'}}>
          {'OmaPhoto'.split('').map((ch, i) => {
            const q = spring({frame: f - c.at(0, 3) - i * 3, fps, config: {damping: 200}, durationInFrames: 24});
            return (
              <span key={i} style={{opacity: q, filter: `blur(${(1 - q) * 12}px)`, transform: `translateY(${(1 - q) * 20}px)`, display: 'inline-block'}}>
                {ch}
              </span>
            );
          })}
        </div>
        <div style={{marginTop: 24, fontFamily: T.mono, fontSize: 21, letterSpacing: '0.46em', color: 'rgba(255,255,255,0.72)', opacity: lerp(f, [c.at(1, 1), c.at(1, 1) + 18], [0, 1])}}>
          NATIVE · OFFLINE AI · OPEN SOURCE
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── S7 interlude, zooming through "theme." into the first wallpaper
const Interlude: React.FC = () => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const words = [
    {t: 'It wears', at: c.at(13, 1) + 6},
    {t: 'your', at: c.at(13, 2)},
    {t: 'theme.', at: c.at(13, 3)},
  ];
  const zoom = interpolate(f, [c.at(13, 4), c.at(14, 1)], [0, 1], {...clamp, easing: (t) => t * t * t});
  const first = themeColors[0];
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', transform: `scale(${1 + zoom * 38})`, transformOrigin: '71% 50%'}}>
        <div style={{display: 'flex', gap: 28, fontFamily: T.sans, fontWeight: 800, fontSize: 104, letterSpacing: '-0.035em'}}>
          {words.map((w) => {
            const q = spring({frame: f - w.at, fps, config: {damping: 200}, durationInFrames: 24});
            return (
              <span
                key={w.t}
                style={{
                  opacity: q,
                  filter: `blur(${(1 - q) * 14}px)`,
                  transform: `translateY(${(1 - q) * 24}px)`,
                  background: `linear-gradient(90deg, #9d7cff, #6aa8ff 45%, ${first.accent})`,
                  WebkitBackgroundClip: 'text',
                  color: 'transparent',
                }}
              >
                {w.t}
              </span>
            );
          })}
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{opacity: lerp(zoom, [0.55, 1], [0, 1])}}>
        <Img src={staticFile(`bg/${first.name}.jpg`)} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ── S8 theme montage: fixed window, a light-edge wipe per beat
const themeFrame = (name: string) => frameUrl(themes, marker(themes, name));
const MONTAGE_W = 1320;
const Montage: React.FC = () => {
  const f = useCurrentFrame();
  const start = c.at(14, 1);
  const i = Math.max(0, Math.min(themeColors.length - 1, Math.floor((f - start) / c.beatFrames)));
  const local = f - (start + i * c.beatFrames);
  const p = i === 0 ? 1 : lerp(local, [0, 14], [0, 1]);
  const now = themeColors[i];
  const was = themeColors[Math.max(0, i - 1)];
  const bg = (t: (typeof themeColors)[number]) => <Img src={staticFile(`bg/${t.name}.jpg`)} style={{width: '100%', height: '100%', objectFit: 'cover'}} />;
  const shot = (t: (typeof themeColors)[number]) => <Frame src={themeFrame(t.name)} />;
  const eyebrow = useReveal(start + 6, c.at(16, 1));
  return (
    <AbsoluteFill>
      <LightWipe p={p} prev={bg(was)} next={bg(now)} />
      <AbsoluteFill style={{background: 'rgba(0,0,0,0.22)'}} />
      <AbsoluteFill style={{perspective: 2400, alignItems: 'center', justifyContent: 'center'}}>
        <div style={{transform: `rotateY(-4deg) rotateX(2deg) scale(${1 + (f - start) * 0.00012})`}}>
          <Window width={MONTAGE_W} height={(MONTAGE_W * SIZE[1]) / SIZE[0]} glow={`${now.accent}66`}>
            <LightWipe p={p} prev={shot(was)} next={shot(now)} />
          </Window>
        </div>
      </AbsoluteFill>
      <div style={{position: 'absolute', top: 54, left: 64, fontFamily: T.mono, fontSize: 17, letterSpacing: '0.4em', color: 'rgba(255,255,255,0.85)', opacity: eyebrow}}>
        <span style={{color: now.accent}}>06</span>&nbsp;&nbsp;THEME SYNC
      </div>
      <div style={{position: 'absolute', top: 54, right: 64, fontFamily: T.mono, fontSize: 17, color: 'rgba(255,255,255,0.75)', opacity: eyebrow}}>
        {String(i + 1).padStart(2, '0')} / {String(themeColors.length).padStart(2, '0')}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 64,
          bottom: 56,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 20px',
          borderRadius: 14,
          background: 'rgba(10,10,14,0.72)',
          backdropFilter: 'blur(14px)',
          border: '1px solid rgba(255,255,255,0.14)',
          opacity: eyebrow,
        }}
      >
        {now.colors.map((col, k) => (
          <div key={k} style={{width: 16, height: 16, borderRadius: 5, background: col, boxShadow: '0 0 0 1px rgba(255,255,255,0.15)'}} />
        ))}
        <div style={{marginLeft: 10, fontFamily: T.mono, fontSize: 21, color: 'white'}}>{now.name}</div>
      </div>
    </AbsoluteFill>
  );
};

// ── S9 end card over a faint wall that recalls the whole video
const wallTiles = [
  frameUrl(main, 0),
  themeFrame('catppuccin-latte'),
  frameUrl(main, marker(main, 'paint.end') - 4),
  themeFrame('gruvbox'),
  frameUrl(removal, removal.frames - 1),
  themeFrame('rose-pine'),
  frameUrl(main, marker(main, 'adjust.end') - 1),
  themeFrame('hackerman'),
  themeFrame('kanagawa'),
  frameUrl(removal, 0),
  themeFrame('retro-82'),
  themeFrame('tokyo-night'),
];
const End: React.FC = () => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = c.at(16, 1);
  const sink = interpolate(f, [s, c.at(16, 3)], [0, 1], {...clamp, easing: (t) => 1 - Math.pow(1 - t, 3)});
  const at = (bar: number, beat: number) => spring({frame: f - c.at(bar, beat), fps, config: {damping: 200}, durationInFrames: 26});
  const icon = spring({frame: f - c.at(16, 2), fps, config: {damping: 14, stiffness: 120}});
  const fade = lerp(f, [c.at(19, 1), c.at(20, 1)], [1, 0]);
  const drift = (f - s) * 0.9;
  const last = themeColors[themeColors.length - 1];
  const chips = ['Arch', 'Omarchy', 'Ubuntu', 'Fedora', 'NixOS'];
  return (
    <AbsoluteFill style={{opacity: fade}}>
      <AbsoluteFill style={{opacity: 1 - sink}}>
        <Img src={staticFile(`bg/${last.name}.jpg`)} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
      </AbsoluteFill>
      <AbsoluteFill style={{perspective: 1600, overflow: 'hidden'}}>
        <div
          style={{
            position: 'absolute',
            left: -900 - drift,
            top: interpolate(sink, [0, 1], [-240, 560]),
            display: 'grid',
            gridTemplateColumns: 'repeat(6, 560px)',
            gap: 34,
            transform: `rotateX(${interpolate(sink, [0, 1], [0, 58])}deg)`,
            transformOrigin: '50% 0%',
            opacity: interpolate(sink, [0, 1], [0.9, 0.34]),
            WebkitMaskImage: 'linear-gradient(transparent, black 20%, black 70%, transparent)',
            maskImage: 'linear-gradient(transparent, black 20%, black 70%, transparent)',
          }}
        >
          {[...wallTiles, ...wallTiles].map((src, k) => (
            <div key={k} style={{width: 560, height: (560 * SIZE[1]) / SIZE[0], borderRadius: 10, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.6)'}}>
              <Img src={src} style={{width: '100%', height: '100%'}} />
            </div>
          ))}
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{background: `radial-gradient(ellipse at 50% 34%, rgba(6,7,11,-e) 25%, rgba(6,7,11,-e) 80%)`}} />
      <AbsoluteFill style={{alignItems: 'center', paddingTop: 170, flexDirection: 'column'}}>
        <Img src={staticFile('icon.png')} style={{width: 124, height: 124, opacity: icon, transform: `scale(${0.6 + 0.4 * icon})`, filter: 'drop-shadow(0 20px 60px rgba(255,120,80,0.5))'}} />
        <div style={{marginTop: 22, fontFamily: T.sans, fontWeight: 800, fontSize: 124, color: 'white', letterSpacing: '-0.035em', opacity: at(16, 3), filter: `blur(${(1 - at(16, 3)) * 12}px)`}}>
          OmaPhoto
        </div>
        <div style={{marginTop: 4, fontFamily: T.sans, fontSize: 34, color: 'rgba(255,255,255,0.78)', opacity: at(17, 1)}}>Layered photo editing for Linux. Loves Omarchy.</div>
        <div style={{marginTop: 34, display: 'flex', gap: 12}}>
          {chips.map((chip, k) => {
            const q = at(17, 2 + k * 0.5);
            return (
              <div
                key={chip}
                style={{
                  padding: '9px 20px',
                  borderRadius: 999,
                  border: '1px solid rgba(255,255,255,0.2)',
                  background: 'rgba(255,255,255,0.06)',
                  fontFamily: T.mono,
                  fontSize: 19,
                  color: 'rgba(255,255,255,0.88)',
                  opacity: q,
                  transform: `translateY(${(1 - q) * 12}px)`,
                }}
              >
                {chip}
              </div>
            );
          })}
        </div>
        <div
          style={{
            marginTop: 30,
            padding: '13px 28px',
            borderRadius: 12,
            border: '1px solid rgba(157,124,255,0.55)',
            background: 'rgba(124,92,255,0.14)',
            fontFamily: T.mono,
            fontSize: 24,
            color: 'white',
            opacity: at(18, 1),
            boxShadow: '0 0 50px rgba(124,92,255,0.3)',
          }}
        >
          github.com/ZacharyZhang-NY/OmaPhoto
        </div>
        <div style={{marginTop: 26, fontFamily: T.mono, fontSize: 16, letterSpacing: '0.5em', color: 'rgba(255,255,255,0.55)', opacity: at(18, 2)}}>FREE · OPEN SOURCE · MIT</div>
      </AbsoluteFill>
      <div style={{position: 'absolute', bottom: 26, width: '100%', textAlign: 'center', fontFamily: T.mono, fontSize: 13, color: 'rgba(255,255,255,0.4)', opacity: at(18, 2)}}>
        Music: “Werq” — Kevin MacLeod (incompetech.com) · CC BY 4.0
      </div>
    </AbsoluteFill>
  );
};

export const Promo: React.FC = () => {
  const f = useCurrentFrame();
  const show = (from: number, to: number, node: React.ReactNode) => (f >= from && f < to ? node : null);
  return (
    <AbsoluteFill style={{background: '#06070b'}}>
      <Backdrop
        base="#06070b"
        blobs={[
          {color: '#7c5cff', x: -200, y: -250, size: 1100, speed: 110, phase: 0},
          {color: '#1f4bff', x: 1100, y: -300, size: 1000, speed: 140, phase: 2},
          {color: '#ff6a3d', x: 900, y: 500, size: 1000, speed: 125, phase: 4},
        ]}
      />
      {show(0, c.at(2, 2), <Logo />)}
      {show(c.at(2), c.at(13, 1) + 18, <AppShot />)}
      {show(c.at(13, 1), c.at(14, 1) + 1, <Interlude />)}
      {show(c.at(14, 1), c.at(16, 1) + 1, <Montage />)}
      {show(c.at(16, 1), TOTAL, <End />)}
    </AbsoluteFill>
  );
};
