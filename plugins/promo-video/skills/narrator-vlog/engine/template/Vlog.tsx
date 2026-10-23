// The vlog's composition: a skeleton to rewrite for each video (keep the structure, replace
// the sections). Times come from data/timing.json (when each narration line starts) and the
// section map T below; the voice decides the timeline, the picture follows it.
import React from 'react';
import {AbsoluteFill, Audio, staticFile, useCurrentFrame} from 'remotion';
import {
  buildSubs,
  Card,
  Center,
  Chip,
  Clip,
  Counter,
  enter,
  FontFace,
  LEFT,
  type Line,
  musicBed,
  Narration,
  OutlineWord,
  onCard,
  Pill,
  Pointer,
  pop,
  prog,
  registerFrames,
  RIGHT,
  s,
  Split,
  sticker,
  Subtitles,
  SIDE,
  ThemeProvider,
  useTheme,
  view,
  Wipe,
  keys,
} from './vlog';
import {LOOK, TEXT} from './look';
import linesJson from './data/lines.json';
import framesJson from './data/frames.json';
import timingJson from './data/timing.json';

const LINES = linesJson as Line[];
const VO: Record<string, number> = timingJson.vo;
registerFrames(framesJson as Record<string, number>);
const SUBS = buildSubs(LINES, VO);

// Section starts (seconds). EDIT: one entry per section, from the voice lines' starts.
const T = {
  intro: 0,
  first: 9.0,
  second: 20.0,
  outro: 30.0,
  end: 36.0,
};
export const TOTAL = s(T.end);

// ── Sections (EDIT) ─────────────────────────────────────────────────────────────────────
// The hook: the old version wipes into the new one under the title, in the first 3 s.
const Intro: React.FC<{f: number}> = ({f}) => {
  const t = useTheme();
  const hook = {x: 360, y: 300, w: 1200, h: 620};
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 0, right: 0, top: 70, textAlign: 'center', ...enter(pop(f, s(0.3), 160, 13), 0, 30)}}>
        <span style={sticker(t, 72)}>{TEXT.titleLead} </span>
        <OutlineWord size={72}>{TEXT.titleWord}</OutlineWord>
      </div>
      <Wipe f={f} box={hook} at={0} old="old_hero" now="new_hero" start={0} v={view(hook, 1.2)} split={keys(f, [[0, 1], [1.2, 1], [2.8, 0]])} />
    </AbsoluteFill>
  );
};

// A claim and its proof, side by side, with a pointer on the AFTER card.
const First: React.FC<{f: number}> = ({f}) => {
  const v = view(LEFT);
  return (
    <AbsoluteFill>
      <Split f={f} at={s(T.first)} old="old_shot" now="new_shot" v={v} />
      <Pointer f={f} at={s(VO.first + 1.0)} until={s(T.second - 0.3)} target={onCard(RIGHT, v, [0.5, 0.5])} label="what changed" side="below" />
    </AbsoluteFill>
  );
};

// A number that matters: the card aside, the counter in the free column on its right, a
// short label under them (above the subtitles).
const Second: React.FC<{f: number}> = ({f}) => (
  <AbsoluteFill>
    <Card box={SIDE} tag="after" p={pop(f, s(T.second), 150, 14)}>
      <Clip name="new_shot" f={f} start={s(T.second)} v={view(SIDE)} />
    </Card>
    <Counter f={f} at={s(T.second + 0.5)} until={s(T.outro - 0.2)} value={8000} caption="triangles" x={1610} y={420} />
    <Center f={f} at={s(T.second + 0.3)} until={s(T.outro - 0.2)} top={872}>
      A short fact the subtitle doesn't say
    </Center>
  </AbsoluteFill>
);

const Outro: React.FC<{f: number}> = ({f}) => {
  const t = useTheme();
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 0, right: 0, top: 380, textAlign: 'center', ...enter(pop(f, s(T.outro + 0.4), 160, 13), 0, 30)}}>
        <span style={sticker(t, 80)}>Thanks for </span>
        <OutlineWord size={80}>watching!</OutlineWord>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: 560, textAlign: 'center', opacity: prog(f, s(T.outro + 1.4), s(T.outro + 2.2))}}>
        <Pill size={32}>{TEXT.credits}</Pill>
      </div>
    </AbsoluteFill>
  );
};

// ── The video ───────────────────────────────────────────────────────────────────────────
const music = musicBed(LINES, VO, TOTAL);

export const Vlog: React.FC = () => {
  const f = useCurrentFrame();
  // A section draws from 12 frames before its start to 12 after its end, cross-fading.
  const section = (a: number, b: number) => f >= s(a) - 12 && f < s(b) + 12;
  const fade = (a: number, b: number) => Math.min(prog(f, s(a) - 12, s(a) + 6), 1 - prog(f, s(b) - 6, s(b) + 12));
  return (
    <ThemeProvider value={LOOK}>
      <AbsoluteFill style={{background: LOOK.background, fontFamily: LOOK.font}}>
        <FontFace />
        {section(T.intro, T.first) && (
          <AbsoluteFill style={{opacity: fade(-1, T.first)}}>
            <Intro f={f} />
          </AbsoluteFill>
        )}
        {section(T.first, T.second) && (
          <AbsoluteFill style={{opacity: fade(T.first, T.second)}}>
            <Chip f={f} at={s(T.first)} until={s(T.second) - 6}>
              First section
            </Chip>
            <First f={f} />
          </AbsoluteFill>
        )}
        {section(T.second, T.outro) && (
          <AbsoluteFill style={{opacity: fade(T.second, T.outro)}}>
            <Chip f={f} at={s(T.second)} until={s(T.outro) - 6}>
              Second section
            </Chip>
            <Second f={f} />
          </AbsoluteFill>
        )}
        {f >= s(T.outro) - 12 && (
          <AbsoluteFill style={{opacity: prog(f, s(T.outro) - 12, s(T.outro) + 6)}}>
            <Outro f={f} />
          </AbsoluteFill>
        )}
        <Subtitles f={f} subs={SUBS} />
        {TEXT.music && <Audio src={staticFile(TEXT.music)} volume={music} />}
        <Narration lines={LINES} starts={VO} />
      </AbsoluteFill>
    </ThemeProvider>
  );
};
