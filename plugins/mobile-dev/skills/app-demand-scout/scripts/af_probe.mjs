#!/usr/bin/env node
//
// af_probe.mjs — probe EXACT keywords (no hint-expansion) for popularity/competitiveness/leaders in any
// country via the credit-free AppFigures dashboard session. The precise counterpart to af_market (which
// EXPANDS seeds): here you pass the final keywords you already chose (e.g. hand-identified concepts for
// geo-arbitrage) and get their real demand + who ranks. Used to validate af_geo leads with CORRECT
// local-language concept terms instead of auto-extracted noise.
//
// PREREQ: Chromium --remote-debugging-port=9222 logged into appfigures.com (same session as af_market).
//
// USAGE:
//   node af_probe.mjs --country br --terms "afirmações,tarô,guarda compartilhada,mapa das estrelas"
//   node af_probe.mjs --country br --terms-file terms.txt --min-pop 20 --max-diff 50

import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const opt = (n, d = null) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };
const country = opt('country', 'br').toLowerCase();
const store = opt('store', 'apple:ios');            // apple:ios | google:play (Play popularity is MODELED, softer)
const cdp = opt('cdp', 'http://127.0.0.1:9222');
const minPop = Number(opt('min-pop', '0'));
const maxDiff = Number(opt('max-diff', '100'));
let terms = (opt('terms', '') || '').split(',').map(s => s.trim()).filter(Boolean);
if (opt('terms-file')) terms = terms.concat(readFileSync(opt('terms-file'), 'utf8').split('\n').map(s => s.trim()).filter(s => s && !s.startsWith('#')));
if (!terms.length) { console.error('Pass --terms "a,b,c" or --terms-file'); process.exit(1); }

async function run() {
  const browser = await chromium.connectOverCDP(cdp);
  const ctx = browser.contexts()[0];
  const page = ctx.pages().find(p => p.url().includes('appfigures.com')) || ctx.pages().at(-1);
  if (!page) { console.error('No appfigures.com tab open.'); process.exit(1); }
  const getToken = (pg) => pg.evaluate(() => {
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
  let tok = await getToken(page);
  if (!tok) {
    await page.goto('https://appfigures.com/reports/keyword-inspector', { waitUntil: 'networkidle', timeout: 25000 }).catch(() => {});
    await page.waitForTimeout(2500);
    tok = await getToken(page);
  }
  if (!tok) { console.error('No AppFigures session token.'); process.exit(1); }

  const rows = await page.evaluate(async (args) => {
    const { terms, country, store, tok } = args;
    const H = { accept: 'application/json', 'x-requested-with': 'XMLHttpRequest', 'x-st': tok };
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    // Google Play rejects the `device` param (400 "Unknown SeoSources"); iOS needs device=handheld.
    const deviceParam = store === 'google:play' ? '' : '&device=handheld';
    const out = [];
    for (const term of terms) {
      try {
        const url = '/api/aso-ranks?term=' + encodeURIComponent(term) +
          '&country=' + country.toUpperCase() + '&storefront=' + store + '&page=1' + deviceParam + '&count=5&include_stale=true';
        const r = await fetch(url, { headers: H });
        if (r.status !== 200) { out.push({ term, status: r.status }); await sleep(120); continue; }
        const d = await r.json();
        const k = (d && d.metadata && d.metadata.keyword) || {};
        const leaders = ((d && d.results) || []).slice(0, 5).map(x => x.name).filter(Boolean);
        out.push({ term, status: 200, popularity: k.popularity ?? null, competitiveness: k.competitiveness ?? null, depth: k.keyword_depth ?? null, leaders });
      } catch { out.push({ term, status: 'ERR' }); }
      await sleep(140);
    }
    return out;
  }, { terms, country, store, tok });
  await browser.close();

  const ok = rows.filter(r => r.status === 200 && r.popularity != null)
    .sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
  console.log(`\n=== ${country.toUpperCase()} exact-keyword probe [${store}] (${ok.length}/${terms.length} resolved) ===`);
  console.log('pop  diff  depth  band       keyword   [top apps]');
  for (const r of ok) {
    const band = (r.popularity >= minPop && (r.competitiveness == null || r.competitiveness <= maxDiff)) ? 'BUILDABLE' : '   ---   ';
    console.log(`${String(r.popularity).padStart(3)}  ${String(r.competitiveness ?? '-').padStart(4)}  ${String(r.depth ?? '-').padStart(5)}  ${band}  ${r.term}   [${r.leaders.slice(0, 3).join(', ')}]`);
  }
  const dead = rows.filter(r => r.status === 200 && (r.popularity == null || r.popularity < 5)).map(r => r.term);
  if (dead.length) console.error(`\ndead/floor: ${dead.join(', ')}`);
  const fail = rows.filter(r => r.status !== 200).map(r => r.term);
  if (fail.length) console.error(`failed: ${fail.join(', ')}`);
}
run().catch(e => { console.error('FATAL', e.message); process.exit(1); });
