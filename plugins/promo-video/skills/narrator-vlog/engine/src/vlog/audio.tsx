// The sound: one narration clip per script line, and a quiet music bed under it.
import React from 'react';
import {Audio, Sequence, staticFile} from 'remotion';
import {ease, lerp, prog, s} from './motion';
import type {Line} from './text';

// Every voice clip (public/voice/<id>.wav) at its start in timing.json.
export const Narration: React.FC<{lines: Line[]; starts: Record<string, number>}> = ({lines, starts}) => (
  <>
    {lines.map((l) => (
      <Sequence key={l.id} from={s(starts[l.id])} durationInFrames={s(l.seconds) + 30}>
        <Audio src={staticFile(`voice/${l.id}.wav`)} volume={1} />
      </Sequence>
    ))}
  </>
);

// The music's volume per frame: `bed` between passages, `under` while the voice speaks.
// Lines less than `merge` seconds apart count as one passage, so the music dips once per
// passage (a 0.6 s ramp down, 0.8 s back up) instead of swelling in every short gap; it
// fades in over the first 40 frames and out over the last 2.5 s. render-vlog.sh then sets
// the loudness with one fixed gain, so these levels are what the viewer hears.
export const musicBed = (lines: Line[], starts: Record<string, number>, total: number, bed = 0.16, under = 0.085, merge = 4) => {
  const passages = lines
    .map((l) => [s(starts[l.id]), s(starts[l.id] + l.seconds)])
    .sort((a, b) => a[0] - b[0])
    .reduce<number[][]>((out, span) => {
      const last = out[out.length - 1];
      if (last && span[0] - last[1] < s(merge)) last[1] = Math.max(last[1], span[1]);
      else out.push([...span]);
      return out;
    }, []);
  return (f: number) => {
    let duck = 0;
    for (const [a, b] of passages) duck = Math.max(duck, prog(f, a - 36, a) * (1 - prog(f, b, b + 48)));
    return lerp(bed, under, ease(duck)) * prog(f, 0, 40) * (1 - prog(f, total - 150, total));
  };
};
