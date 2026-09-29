#!/usr/bin/env node
// Picks where in a track the video starts and fits the beat grid it lands on.
// Usage: music-analyze.mjs <track.beats> <track.loud> <videoSeconds> <anchorSeconds>
// .beats: one beat time per line (aubiotrack). .loud: ebur128 short-term LUFS every 0.1 s.
import {readFileSync} from 'node:fs';

const [beatsFile, loudFile, videoArg, anchorArg] = process.argv.slice(2);
const video = Number(videoArg);
const anchor = Number(anchorArg);
const beats = readFileSync(beatsFile, 'utf8').split('\n').filter(Boolean).map(Number);
// Short-term loudness needs 3 s of audio; earlier readings are meaningless.
const loud = readFileSync(loudFile, 'utf8').split('\n').filter(Boolean).map((v, i) => (i < 30 ? NaN : Math.max(-70, Number(v))));
const trackEnd = loud.length / 10;

const intervals = beats.slice(1).map((b, i) => b - beats[i]).sort((a, b) => a - b);
const beat = intervals[Math.floor(intervals.length / 2)];
const mean = (from, to) => {
  const a = Math.max(0, Math.round(from * 10));
  const b = Math.min(loud.length, Math.round(to * 10));
  let sum = 0;
  let n = 0;
  for (let i = a; i < b; i++) if (!Number.isNaN(loud[i])) (sum += loud[i]), n++;
  return n ? sum / n : NaN;
};

// The body should be loud; the anchor should land where the energy rises.
let best = null;
for (const b of beats) {
  const start = b - anchor;
  if (start < 0 || start + video > trackEnd) continue;
  const body = mean(start + anchor, start + video - 3);
  const rise = Math.min(6, mean(start + anchor, start + anchor + 2) - mean(start + anchor - 2, start + anchor)) || 0;
  const score = body + 0.5 * rise;
  if (!best || score > best.score) best = {start, score, body, rise};
}
if (!best) throw new Error('track shorter than the video');

// Trackers drop and double beats; fit one constant-tempo grid through the window instead.
const anchorBeat = best.start + anchor;
const window = beats.filter((b) => b >= best.start - 1 && b <= best.start + video + 1);
const indexed = window.map((b) => [Math.round((b - anchorBeat) / beat), b]);
const n = indexed.length;
const sx = indexed.reduce((s, [k]) => s + k, 0);
const sy = indexed.reduce((s, [, b]) => s + b, 0);
const sxx = indexed.reduce((s, [k]) => s + k * k, 0);
const sxy = indexed.reduce((s, [k, b]) => s + k * b, 0);
const period = (n * sxy - sx * sy) / (n * sxx - sx * sx);
const origin = (sy - period * sx) / n;
const residual = Math.sqrt(indexed.reduce((s, [k, b]) => s + (b - origin - period * k) ** 2, 0) / n);
const first = Math.ceil((best.start - origin) / period);
const grid = [];
for (let k = first; origin + period * k <= best.start + video; k++) grid.push(+(origin + period * k - best.start).toFixed(4));
const anchorIndex = -first;
const bars = grid.filter((_, i) => (((i - anchorIndex) % 4) + 4) % 4 === 0);
console.log(
  JSON.stringify({
    bpm: +(60 / period).toFixed(2),
    beat: +period.toFixed(5),
    jitter: +residual.toFixed(4),
    // Bar n starts at barOrigin + n * 4 * beat (video seconds); bar 0 sits at or just before 0.
    barOrigin: +(origin - best.start - Math.round((origin - best.start) / (4 * period)) * 4 * period).toFixed(4),
    start: +best.start.toFixed(3),
    bodyLufs: +best.body.toFixed(1),
    rise: +best.rise.toFixed(1),
    beats: grid,
    bars,
  }),
);
