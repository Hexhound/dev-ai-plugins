#!/usr/bin/env node
//
// af_google.mjs — WEB/SEO demand probe (the non-ASO channel af_market can't see).
//
// af_market measures App-STORE search demand only. Many real markets are "dead ASO" yet alive on the
// web (Google/Reddit/word-of-mouth) — a channel MISMATCH, not absent demand (news SaaS, city-events,
// real estate, hobby/emotional verticals). This tool measures the WEB side, free, no API key, via
// Google Suggest (autocomplete): the richness of a term's autocomplete tree is a proxy for real search
// activity Google has indexed, and the intent words in the suggestions tell you whether it's a
// solution/product hunt (SEO-addressable) or informational (content-SEO) demand.
//
// Read it AGAINST af_market's popularity to place each idea in the 2x2:
//   high ASO + high web = mainstream (usually WALLED)         low ASO + HIGH web = dead-on-store, alive
//   high ASO + low web  = store-native / brand                 on web -> SEO/content channel (BUCKET B)
//   low ASO + low web   = genuinely dead
// The bottom-left->top-right diagonal is noise; the LOW-ASO + HIGH-WEB cell is the prize this tool exists
// to surface — the ideas af_market wrongly buried as "dead search."
//
// Signal (public, no auth):
//   GET https://suggestqueries.google.com/complete/search?client=firefox&hl=<lang>&gl=<country>&q=<q>
//     -> JSON [query, [suggestion, ...]]
//   breadth = unique suggestions across seed + alphabet-expansion (seed + " a".." z").
//   app_intent = suggestions signalling a product/solution hunt (app, best, vs, alternative, tool...).
//   q_intent   = informational suggestions (how, what, why, guide, ideas...) => content-SEO demand.
//
// Google Trends is deliberately NOT used (429s from datacenters, unreliable). Autocomplete is the robust
// free signal. Validate a survivor for real with a fake-door (landing page + $50 ad -> CPI/signups).
//
// USAGE:
//   node af_google.mjs --seed "city events,rental inspection,news bias" --country us --lang en --out web.csv --llm-prompt web.md
//   node af_google.mjs --seed "eventos na cidade,vistoria de imovel" --country br --lang pt-BR --deep

import { writeFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const opt = (n, d = null) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };
const flag = (n) => argv.includes('--' + n);
const list = (s) => (s || '').split(',').map(x => x.trim()).filter(Boolean);

const seeds = list(opt('seed'));
const country = (opt('country', 'us')).toLowerCase();
const lang = opt('lang', country === 'br' ? 'pt-BR' : 'en');
const deep = flag('deep');                 // also append " a".." z" bigram probes for extra breadth
const out = opt('out');
const llmPrompt = opt('llm-prompt');
const sleep = ms => new Promise(r => setTimeout(r, ms));
if (!seeds.length) { console.error('Give seeds: --seed "city events,rental inspection"'); process.exit(1); }

const APP_INTENT = ['app', 'apps', 'online', 'tool', 'software', 'best', 'top', 'vs', 'alternative', 'alternatives',
  'review', 'reviews', 'free', 'download', 'template', 'generator', 'tracker', 'planner', 'automatic', 'ai',
  'aplicativo', 'melhor', 'melhores', 'gratis', 'grátis', 'gratuito', 'programa', 'site'];
const Q_INTENT = ['how', 'what', 'why', 'when', 'where', 'which', 'can', 'does', 'is', 'do', 'meaning', 'examples',
  'tips', 'guide', 'ideas', 'como', 'que', 'qual', 'quais', 'por que', 'porque', 'o que', 'quanto', 'dicas'];
const BUY_INTENT = ['buy', 'price', 'cost', 'cheap', 'discount', 'near me', 'service', 'preço', 'preco', 'valor',
  'custo', 'contratar', 'perto de mim'];

async function suggest(q) {
  const url = 'https://suggestqueries.google.com/complete/search?client=firefox' +
    '&hl=' + encodeURIComponent(lang) + '&gl=' + encodeURIComponent(country) + '&q=' + encodeURIComponent(q);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': lang } });
    if (r.status !== 200) return [];
    const j = await r.json();       // [query, [suggestions...]]
    return Array.isArray(j) && Array.isArray(j[1]) ? j[1] : [];
  } catch { return []; }
}

const alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('');
const has = (s, words) => { const t = ' ' + s.toLowerCase() + ' '; return words.some(w => t.includes(' ' + w + ' ') || s.toLowerCase().includes(w)); };

async function probe(seed) {
  const all = new Set();
  const queries = [seed, seed + ' '];
  for (const c of alphabet) queries.push(seed + ' ' + c);
  if (deep) for (const c of alphabet.filter((_, i) => i % 2 === 0)) for (const d of ['a', 'e', 'i', 'o']) queries.push(seed + ' ' + c + d);
  for (const q of queries) {
    (await suggest(q)).forEach(s => { if (s && s.toLowerCase() !== seed.toLowerCase()) all.add(s.trim()); });
    await sleep(70);
  }
  const sugg = [...all];
  // classify on the suggestion with the SEED removed, so a seed that itself contains an intent word
  // (e.g. "meditation app") doesn't mark every completion as product-intent.
  const strip = s => s.toLowerCase().split(seed.toLowerCase()).join(' ');
  const appHits = sugg.filter(s => has(strip(s), APP_INTENT));
  const qHits = sugg.filter(s => has(strip(s), Q_INTENT));
  const buyHits = sugg.filter(s => has(strip(s), BUY_INTENT));
  const breadth = sugg.length;
  const band = breadth >= 40 ? 'HIGH' : breadth >= 15 ? 'med' : 'low';
  return { seed, breadth, band, app_intent: appHits.length, q_intent: qHits.length, buy_intent: buyHits.length,
    sample: sugg.slice(0, 8), app_samples: appHits.slice(0, 5) };
}

async function run() {
  console.error(`Google web-demand probe: ${seeds.length} seeds (${country}/${lang}${deep ? ', deep' : ''})`);
  const rows = [];
  for (const s of seeds) { rows.push(await probe(s)); console.error(`  ${s}: breadth ${rows.at(-1).breadth} (${rows.at(-1).band})`); }
  rows.sort((a, b) => b.breadth - a.breadth);

  console.log(`\n=== WEB/SEO demand (Google Suggest, ${country.toUpperCase()}/${lang}) ===`);
  console.log('breadth band  app  ques  buy  seed   -> product-intent completions');
  for (const r of rows) {
    console.log(`${String(r.breadth).padStart(6)}  ${r.band.padEnd(4)}  ${String(r.app_intent).padStart(3)}  ${String(r.q_intent).padStart(4)}  ${String(r.buy_intent).padStart(3)}  ${r.seed}`);
    if (r.app_samples.length) console.log(`         ↳ ${r.app_samples.join(' · ')}`);
  }
  console.log('\nRead vs af_market ASO popularity: LOW ASO + HIGH web breadth = dead-on-store / alive-on-web');
  console.log('=> the SEO/content channel play (bucket B). HIGH app_intent = solution hunt = product-shaped.');

  if (out) {
    const cols = ['seed', 'breadth', 'band', 'app_intent', 'q_intent', 'buy_intent'];
    const csv = cols.join(',') + '\n' + rows.map(r => cols.map(k => typeof r[k] === 'string' ? JSON.stringify(r[k]) : r[k]).join(',')).join('\n');
    writeFileSync(out, csv + '\n'); console.error('CSV -> ' + out);
  }
  if (llmPrompt) {
    const table = rows.map(r => `${r.seed} | web-breadth ${r.breadth} (${r.band}) | app-intent ${r.app_intent} | question-intent ${r.q_intent} | buy-intent ${r.buy_intent} | e.g. ${r.app_samples.slice(0, 3).join(', ') || r.sample.slice(0, 3).join(', ')}`).join('\n');
    const prompt = `# Web/SEO demand read — ${country.toUpperCase()}/${lang} (Google Suggest)

This is the NON-ASO demand signal. breadth = richness of the autocomplete tree (proxy for real web
search volume). app_intent = product/solution-seeking completions (SEO-addressable, product-shaped).
question_intent = informational (content-SEO). buy_intent = commercial.

${table}

Your job:
1. Cross-read each seed against its af_market ASO popularity:
   - LOW ASO + HIGH web breadth = DEAD-ON-STORE, ALIVE-ON-WEB -> the SEO/content/community channel play
     (bucket B). This is the cell to act on — af_market wrongly buried these.
   - HIGH ASO + HIGH web = mainstream, usually WALLED. HIGH ASO + LOW web = store-native/brand.
     LOW + LOW = genuinely dead.
2. For the LOW-ASO+HIGH-WEB survivors, pick the channel: high app_intent -> SEO landing pages targeting
   the product-intent queries; high question_intent -> content-SEO (answer the questions, capture email);
   high buy_intent -> paid-search / direct.
3. VALIDATE before building: fake-door landing page ranked/advertised on the winning query -> measure
   clicks + signups (10/week bar) or a $50 ad -> CPI. Autocomplete proves interest EXISTS; the fake-door
   proves they'll ACT.
`;
    writeFileSync(llmPrompt, prompt); console.error('LLM prompt -> ' + llmPrompt);
  }
  console.error('\nNOTE: breadth = web-search interest proxy (Google indexed these completions). It is a LEAD; confirm WTP with a fake-door.');
}

run().catch(e => { console.error('FATAL', e.message); process.exit(1); });
