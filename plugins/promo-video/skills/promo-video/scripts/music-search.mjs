#!/usr/bin/env node
// Searches commercial-safe (CC BY) music: Incompetech's catalogue and ccMixter's API.
// Usage: music-search.mjs --feel "Bright,Driving" --bpm 100-135 [--instruments synth]
//        [--q "tech corporate"] [--min 60] [--limit 12] [--json]
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {homedir} from 'node:os';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, a, i, all) => (a.startsWith('--') ? [...pairs, [a.slice(2), all[i + 1]?.startsWith('--') ? true : all[i + 1] ?? true]] : pairs), []),
);
const words = (s) => (typeof s === 'string' ? s.toLowerCase().split(/[,\s]+/).filter(Boolean) : []);
const feel = words(args.feel);
const instruments = words(args.instruments);
const query = words(args.q);
const [lo, hi] = (args.bpm ?? '0-999').split('-').map(Number);
const minSeconds = Number(args.min ?? 60);
const limit = Number(args.limit ?? 12);

const seconds = (hms) => hms.split(':').reduce((s, v) => s * 60 + Number(v), 0);

async function incompetech() {
  const cache = `${process.env.XDG_CACHE_HOME ?? `${homedir()}/.cache`}/promo-video`;
  const file = `${cache}/incompetech-pieces.json`;
  if (!existsSync(file)) {
    mkdirSync(cache, {recursive: true});
    const res = await fetch('https://incompetech.com/music/royalty-free/pieces.json');
    if (!res.ok) throw new Error(`incompetech: HTTP ${res.status}`);
    writeFileSync(file, await res.text());
  }
  return JSON.parse(readFileSync(file, 'utf8')).map((p) => ({
    source: 'incompetech',
    title: p.title,
    artist: 'Kevin MacLeod',
    bpm: Number(p.bpm) || null,
    seconds: seconds(p.length ?? '0:0'),
    feel: p.feel ?? '',
    instruments: p.instruments ?? '',
    description: p.description ?? '',
    url: `https://incompetech.com/music/royalty-free/mp3-royaltyfree/${encodeURIComponent(p.filename)}`,
    license: 'CC BY 4.0',
    attribution: `"${p.title}" — Kevin MacLeod (incompetech.com), licensed under CC BY 4.0`,
  }));
}

async function ccmixter() {
  const tags = ['instrumental', ...query.slice(0, 2)].join(',');
  const res = await fetch(`https://ccmixter.org/api/query?f=json&tags=${encodeURIComponent(tags)}&lic=by&sort=rank&limit=60`);
  if (!res.ok) return [];
  return (await res.json())
    .filter((u) => !/vocals|singing|rap|spoken/.test(u.upload_tags ?? ''))
    .map((u) => {
      const bpm = /bpm_(\d+)_(\d+)/.exec(u.upload_tags ?? '');
      const file = (u.files ?? []).find((f) => /\.mp3$/i.test(f.download_url ?? '')) ?? {};
      return {
        source: 'ccmixter',
        title: u.upload_name,
        artist: u.user_name,
        bpm: bpm ? (Number(bpm[1]) + Number(bpm[2])) / 2 : null,
        seconds: seconds(file.file_format_info?.ps ?? '0:0'),
        feel: '',
        instruments: '',
        description: (u.upload_tags ?? '').replace(/^,|,$/g, '').replace(/,/g, ' '),
        url: file.download_url,
        license: u.license_name,
        attribution: `"${u.upload_name}" — ${u.user_name} (ccmixter.org), licensed under ${u.license_name}`,
      };
    })
    .filter((t) => t.url);
}

const score = (t) => {
  const text = `${t.feel} ${t.description} ${t.instruments} ${t.title}`.toLowerCase();
  let s = 0;
  for (const w of feel) if (t.feel.toLowerCase().includes(w)) s += 3;
  for (const w of instruments) if (t.instruments.toLowerCase().includes(w) || text.includes(w)) s += 2;
  for (const w of query) if (text.includes(w)) s += 2;
  if (t.bpm && t.bpm >= lo && t.bpm <= hi) s += 2;
  else if (t.bpm) s -= 3;
  return s;
};

const all = [...(await incompetech()), ...(await ccmixter().catch(() => []))]
  .filter((t) => !t.seconds || t.seconds >= minSeconds)
  .map((t) => ({...t, score: score(t)}))
  .filter((t) => t.score > 0)
  .sort((a, b) => b.score - a.score)
  .slice(0, limit);

if (args.json) console.log(JSON.stringify(all, null, 2));
else
  for (const t of all)
    console.log(
      `${String(t.score).padStart(2)}  ${t.title} — ${t.artist}  [${t.source}, ${t.license}]  ${t.bpm ?? '?'} BPM  ${Math.round(t.seconds)}s\n    ${t.feel || t.description.slice(0, 90)}${t.instruments ? ` · ${t.instruments}` : ''}\n    ${t.url}`,
    );
