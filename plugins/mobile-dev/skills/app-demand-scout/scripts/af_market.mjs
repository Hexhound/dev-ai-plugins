#!/usr/bin/env node
//
// af_market.mjs — DEMAND-FIRST market discovery (top-down; complements af_discover's app-first).
//
// af_discover is app-first: seed -> incumbents -> only the terms those incumbents ALREADY rank
// for. By construction it cannot see a high-demand term that no current app serves well — i.e.
// an OPEN market. af_market starts from the demand surface itself:
//
//   1. domain seed(s) -> Apple App Store search-hints (autocomplete)  -> the terms people
//      ACTUALLY type, ordered by Apple's own popularity. Recursed + alphabet-expanded into a
//      broad candidate-term field. (Public, free, no login — Apple's MZSearchHints endpoint.)
//   2. each candidate term -> AppFigures /api/aso-ranks?term=<ANY>  -> the term's real
//      popularity + competitiveness + keyword_depth, for ARBITRARY keywords, no app, NO tracking.
//      (Credit-free via the logged-in dashboard session over CDP — the same trick af_discover uses.
//      This is the "arbitrary keyword lookup" the public API can't do.)
//   3. rank by demand x openness; flag high-popularity + low-competitiveness + shallow-depth as
//      OPEN markets — exactly the underserved gaps app-first discovery structurally misses.
//   4. emit a demand-ranked market table + CSV + a clustering prompt for the SKILL (LLM) to
//      cluster into candidate markets, apply the 2026 kill-filters, and pick which to review-mine.
//
// One aso-ranks call also instantly kills dead-search niches: `bill reminder` -> popularity 5.
//
// Confirmed endpoints (reverse-engineered live):
//   hints (Apple, public): GET https://search.itunes.apple.com/WebObjects/MZSearchHints.woa/wa/hints
//                          ?clientApplication=Software&term=<q>   (header X-Apple-Store-Front: <sf>)
//                          -> plist <string> pairs: [hintTerm, searchUrl, ...]
//   demand (AppFigures)  : GET /api/aso-ranks?term=<ANY>&country=US&storefront=apple:ios&page=1
//                          &device=handheld&count=5&include_stale=true
//                          -> metadata.keyword.{popularity, competitiveness, keyword_depth,
//                             supports_popularity}; results[].{id,name,developer} (the ranking apps)
//   The X-ST session token (window.afReqToken) is read from the page at runtime.
//
// PREREQ: Chromium --remote-debugging-port=9222 logged into appfigures.com (Monitor+/trial, so
// Keyword Popularity is unlocked). See af_auto.mjs / af_discover.mjs headers for the launch line.
//
// USAGE:
//   node af_market.mjs --seed "pet,dog,cat" --country us --depth 2 --max-terms 150 \
//     --out markets.csv --llm-prompt market.md
//   node af_market.mjs --seed "sleep" --alpha            # alphabet-expand seeds for max breadth
//   node af_market.mjs --seed "budget" --exclude "loan,casino"   # drop candidate terms by substring

import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const opt = (name, def = null) => { const i = argv.indexOf('--' + name); return i >= 0 ? argv[i + 1] : def; };
const flag = (name) => argv.includes('--' + name);
const list = (s) => (s || '').split(',').map(x => x.trim()).filter(Boolean);

const cdp = opt('cdp', 'http://127.0.0.1:9222');
const country = opt('country', 'us').toLowerCase();
let seeds = list(opt('seed'));
if (opt('seed-file')) seeds = seeds.concat(
  readFileSync(opt('seed-file'), 'utf8').split('\n').map(s => s.trim()).filter(s => s && !s.startsWith('#')));
const depth = Number(opt('depth', '2'));          // hint-recursion levels (>=1)
const alpha = flag('alpha') || depth >= 2;         // append " a".." z" to seeds for breadth
const hintsPer = Number(opt('hints-per', '10'));   // hints kept per query
const maxTerms = Number(opt('max-terms', '150'));  // cap on terms sent to aso-ranks (cost bound)
const minPop = Number(opt('min-pop', '0'));        // drop candidates below this popularity from output
const minLen = Number(opt('min-len', '3'));
const allowNonLatin = flag('allow-nonlatin');
// ledger / noise: drop candidate terms containing any of these substrings (already-covered markets, junk brands)
let excludeSub = list(opt('exclude')).map(s => s.toLowerCase());
if (opt('exclude-file')) excludeSub = excludeSub.concat(
  readFileSync(opt('exclude-file'), 'utf8').split('\n').map(s => s.trim().toLowerCase()).filter(s => s && !s.startsWith('#')));
const out = opt('out');
const llmPrompt = opt('llm-prompt');

if (!seeds.length) { console.error('Give at least one domain seed: --seed "pet,dog,cat"'); process.exit(1); }

// Apple storefront ids (for the search-hints X-Apple-Store-Front header). "<id>-1,29" = platform tail.
const STOREFRONTS = { us: '143441', gb: '143444', de: '143443', fr: '143442', br: '143503', ca: '143455', au: '143460', jp: '143462', es: '143454', it: '143450', mx: '143468', in: '143467' };
const storefront = (opt('storefront') || (STOREFRONTS[country] || STOREFRONTS.us)) + '-1,29';

const latinBad = /[^ -ɏ]/;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---- Apple search-hints (node-side; public, no session) ----
async function appleHints(term) {
  const url = 'https://search.itunes.apple.com/WebObjects/MZSearchHints.woa/wa/hints' +
    '?clientApplication=Software&term=' + encodeURIComponent(term);
  try {
    const r = await fetch(url, { headers: {
      'X-Apple-Store-Front': storefront,
      'User-Agent': 'iTunes/12.11 (Macintosh; OS X 10.15.7)',
      'Accept-Language': country + '-' + country,
    } });
    if (r.status !== 200) return [];
    const t = await r.text();
    return [...t.matchAll(/<string>([^<]+)<\/string>/g)]
      .map(m => m[1].replace(/&amp;/g, '&').trim())
      .filter(s => s && s !== 'Suggestions' && !/^https?:/i.test(s) && /[a-z]/i.test(s));
  } catch { return []; }
}

function acceptable(term) {
  const t = term.trim();
  if (t.length < minLen) return false;
  if (!/[a-z]/i.test(t)) return false;
  if (!allowNonLatin && latinBad.test(t)) return false;
  if (excludeSub.some(sub => t.toLowerCase().includes(sub))) return false;
  return true;
}

async function expandTerms() {
  const collected = new Map();               // term(lower) -> original
  const add = (t) => { const k = t.toLowerCase(); if (acceptable(t) && !collected.has(k)) collected.set(k, t.trim()); };
  const alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('');

  // level 0: seeds themselves + (optional) alphabet-expanded seeds -> hint breadth
  let queries = [...seeds];
  if (alpha) for (const s of seeds) for (const c of alphabet) queries.push(s + ' ' + c);
  queries = [...new Set(queries)];

  const frontier = new Set();
  for (const q of queries) {
    const hs = await appleHints(q);
    hs.slice(0, hintsPer).forEach(h => { add(h); frontier.add(h.toLowerCase()); });
    await sleep(90);
    if (collected.size >= maxTerms * 3) break;   // plenty to rank; stop hammering Apple
  }
  console.error(`level 1: ${collected.size} candidate terms from ${queries.length} hint queries`);

  // level 2+: recurse hints on discovered multi-word terms for depth
  let level = 1;
  let toExpand = [...frontier].filter(t => t.split(/\s+/).length >= 2);
  while (level < depth && collected.size < maxTerms * 3 && toExpand.length) {
    const next = [];
    for (const q of toExpand.slice(0, 40)) {
      const hs = await appleHints(q);
      hs.slice(0, hintsPer).forEach(h => { if (!collected.has(h.toLowerCase())) { add(h); next.push(h.toLowerCase()); } });
      await sleep(90);
      if (collected.size >= maxTerms * 3) break;
    }
    level++;
    toExpand = next.filter(t => t.split(/\s+/).length >= 2);
    console.error(`level ${level}: ${collected.size} candidate terms so far`);
  }

  // prefer short, category-shaped terms (1–4 words) when capping
  return [...collected.values()]
    .sort((a, b) => a.split(/\s+/).length - b.split(/\s+/).length || a.length - b.length)
    .slice(0, maxTerms);
}

function getToken(page) {
  return page.evaluate(() => {
    const test = v => (typeof v === 'string' && /^st_[a-z0-9]+/i.test(v)) ? v : null;
    for (const store of [localStorage, sessionStorage])
      for (let i = 0; i < store.length; i++) {
        const v = store.getItem(store.key(i));
        if (test(v)) return v;
        try { const o = JSON.parse(v); for (const k in o) if (test(o[k])) return o[k]; } catch {}
      }
    for (const m of document.querySelectorAll('meta')) if (test(m.getAttribute('content'))) return m.getAttribute('content');
    for (const k of Object.keys(window)) { try { if (test(window[k])) return window[k]; } catch {} }
    return null;
  });
}

async function run() {
  // 1) generate candidate terms from Apple hints (before touching the browser)
  console.error(`expanding ${seeds.length} seed(s) via Apple search-hints (${country.toUpperCase()}, depth ${depth}${alpha ? ', alpha' : ''})...`);
  const terms = await expandTerms();
  if (!terms.length) { console.error('No candidate terms produced from hints.'); process.exit(1); }
  console.error(`validating ${terms.length} terms via aso-ranks...`);

  // 2) validate demand for each term via aso-ranks (in-page, credit-free session)
  const browser = await chromium.connectOverCDP(cdp);
  const ctx = browser.contexts()[0];
  const page = ctx.pages().find(p => p.url().includes('appfigures.com')) || ctx.pages().at(-1);
  if (!page) { console.error('No appfigures.com tab open in the debugged chromium.'); process.exit(1); }
  let tok = await getToken(page);
  if (!tok) {
    await page.goto('https://appfigures.com/reports/keyword-inspector', { waitUntil: 'networkidle', timeout: 25000 }).catch(() => {});
    await page.waitForTimeout(2500);
    tok = await getToken(page);
  }
  if (!tok) { console.error('Could not find X-ST token — is the session logged in on appfigures.com?'); process.exit(1); }
  console.error('session token ok');

  const validated = await page.evaluate(async (args) => {
    const { terms, country, tok } = args;
    const H = { accept: 'application/json', 'x-requested-with': 'XMLHttpRequest', 'x-st': tok };
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const rows = [];
    for (const term of terms) {
      try {
        const url = '/api/aso-ranks?term=' + encodeURIComponent(term) +
          '&country=' + country.toUpperCase() + '&storefront=apple:ios&page=1&device=handheld&count=5&include_stale=true';
        const r = await fetch(url, { headers: H });
        if (r.status !== 200) { rows.push({ term, status: r.status }); await sleep(120); continue; }
        const d = await r.json();
        const k = (d && d.metadata && d.metadata.keyword) || {};
        const leaders = ((d && d.results) || []).slice(0, 3).map(x => x.name).filter(Boolean);
        rows.push({
          term, status: 200,
          popularity: k.popularity ?? null,
          competitiveness: k.competitiveness ?? null,
          depth: k.keyword_depth ?? null,
          supports: k.supports_popularity === true,
          leaders,
        });
      } catch (e) { rows.push({ term, status: 'ERR' }); }
      await sleep(140);
    }
    return rows;
  }, { terms, country, tok });

  await browser.close();

  // 3) score + rank
  const ok = validated.filter(r => r.status === 200 && r.popularity != null);
  const failed = validated.length - ok.length;
  let cands = ok.map(r => {
    const comp = r.competitiveness;
    const openness = (100 - (comp == null ? 100 : comp)) / 100;   // 1 = wide open
    const gap = Math.round((r.popularity || 0) * (0.5 + 0.5 * openness));
    // open-market flag: real demand, weak defense, not a crowded index
    const open = (r.popularity >= 20 && (comp == null || comp <= 60));
    return { keyword: r.term, popularity: r.popularity, competitiveness: comp, depth: r.depth,
      gap_score: gap, open, leaders: r.leaders || [] };
  }).filter(c => c.popularity >= minPop);
  cands.sort((a, b) => b.gap_score - a.gap_score || b.popularity - a.popularity);

  // ---- output ----
  console.error(`validated: ${ok.length} ok, ${failed} failed/empty`);
  console.log(`\n=== ${country.toUpperCase()} demand-first markets — ${cands.length} terms (seed: ${seeds.join(', ')}) ===`);
  console.log('gap  pop  comp  depth  open  keyword   [top apps]');
  for (const c of cands.slice(0, 45)) {
    console.log(
      `${String(c.gap_score).padStart(3)}  ${String(c.popularity).padStart(3)}  ${String(c.competitiveness ?? '-').padStart(4)}  ` +
      `${String(c.depth ?? '-').padStart(5)}  ${(c.open ? ' ✓ ' : '   ')}  ${c.keyword}   [${c.leaders.slice(0, 2).join(', ')}]`);
  }

  if (out) {
    const cols = ['keyword', 'popularity', 'competitiveness', 'depth', 'gap_score', 'open', 'leaders'];
    const csv = cols.join(',') + '\n' +
      cands.map(c => cols.map(k => k === 'keyword' || k === 'leaders'
        ? JSON.stringify(k === 'leaders' ? c[k].join(' | ') : c[k]) : (c[k] ?? '')).join(',')).join('\n');
    writeFileSync(out, csv + '\n');
    console.error('CSV -> ' + out + ` (${cands.length} rows)`);
  }

  if (llmPrompt) {
    const top = cands.slice(0, 60);
    const table = top.map(c => `${c.keyword} | pop ${c.popularity} | comp ${c.competitiveness ?? '-'} | depth ${c.depth ?? '-'} | ${c.open ? 'OPEN' : 'walled'} | apps: ${c.leaders.slice(0, 3).join(', ')}`).join('\n');
    const prompt = `# Demand-first market clustering — ${country.toUpperCase()} (seed: ${seeds.join(', ')})

These terms came from Apple's own search-autocomplete (what people TYPE) and were each validated
with real Apple Search Ads demand. popularity 0–100 = search demand (5 = the floor / nobody
searches). competitiveness 0–100 = how walled. depth = apps competing for the term. OPEN = real
demand with weak defense — the underserved gaps. "apps" = who currently ranks (context for naming).

Unlike app-first discovery, these include high-demand terms NO incumbent serves well.

${table}

Your job (DISCOVERY):
1. CLUSTER into 4–8 candidate MARKETS (a market = a job-to-be-done, not one keyword). Name each.
2. Rank by OPPORTUNITY = high popularity on the head term AND beatable (OPEN, low competitiveness,
   shallow depth, no funded giant in "apps"). Flag walled/saturated ones to avoid.
3. STRIP noise: brand terms (a brand name being searched ≠ an open market), foreign/junk terms,
   and single mega-brands whose popularity is theirs, not the category's.
4. Apply the 2026 kill-filters (defensibility, Apple 4.3/medical-claim purge, willingness-to-pay
   incl. the "free"/race-to-free trap, niche-narrowing).
5. Output the 2–3 MOST PROMISING markets to take into review_miner.exs (mine the incumbents'
   1–3★ reviews) for the actual WEDGE. For each: why it survived + the likely wedge.
`;
    writeFileSync(llmPrompt, prompt);
    console.error('LLM prompt -> ' + llmPrompt);
  }
}

run().catch(e => { console.error('FATAL', e.message); process.exit(1); });
