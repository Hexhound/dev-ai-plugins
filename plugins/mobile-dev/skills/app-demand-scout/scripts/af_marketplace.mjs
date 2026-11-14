#!/usr/bin/env node
//
// af_marketplace.mjs — PROVEN-WTP discovery from startup marketplaces (complements af_market's demand-first).
//
// The lesson from studying $1M solo-app builders: a clear-demand + no-offer gap is near-impossible in a
// saturated store (empirically ~0 open head terms). So instead of hunting the empty gap, start from
// markets where money is ALREADY changing hands and COPY the pattern (verticalize / do it better / port).
//
// Flippa exposes a public JSON API of app/SaaS businesses FOR SALE with real revenue+profit numbers and
// a "verified revenue" flag. Every listing is a free case study: what people pay for, how much it makes,
// and (via the summary) what it does. We pull the profitable-but-small ones (proven WTP, not yet scaled),
// group by industry, and emit a clustering prompt that applies the SAME marketability/verticalize/moat
// gates as af_market — so a "copy the pattern" idea still has to clear distribution before you build it.
//
// Confirmed endpoint (public, no auth):
//   GET https://api.flippa.com/v3/listings?filter[property_type]=<t>&filter[status]=open&page[size]=N&page[number]=P
//     -> data[].attributes.{property_name, property_type, industry, business_model, summary, title,
//        revenue_per_month, profit_per_month, current_price, display_price, has_verified_revenue,
//        has_verified_traffic, app_downloads_per_month, html_url, established_at, sale_method}
//   property_type values: ios_app_v2, android_app, saas, ecommerce, content, service, ... (ios_app => ios_app_v2)
//
// USAGE:
//   node af_marketplace.mjs --type ios_app --max-mrr 10000 --verified --out mkt.csv --llm-prompt copy.md
//   node af_marketplace.mjs --type ios_app,android_app,saas --min-mrr 500 --max-mrr 15000 --pages 6
//   node af_marketplace.mjs --type ios_app --android-gap        # flag iOS listings likely absent on Play

import { writeFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const opt = (name, def = null) => { const i = argv.indexOf('--' + name); return i >= 0 ? argv[i + 1] : def; };
const flag = (name) => argv.includes('--' + name);
const list = (s) => (s || '').split(',').map(x => x.trim()).filter(Boolean);

// property_type FILTER values (Flippa maps ios_app -> ios_app_v2 server-side; filter must use ios_app)
const TYPE_ALIAS = { ios_app: 'ios_app', ios: 'ios_app', android_app: 'android_app', android: 'android_app',
  saas: 'saas', ecommerce: 'ecommerce', content: 'content', service: 'service', app: 'ios_app' };
const types = (list(opt('type', 'ios_app,android_app,saas'))).map(t => TYPE_ALIAS[t] || t);
const minMrr = Number(opt('min-mrr', '1'));        // proven WTP: at least $1/mo real revenue
const maxMrr = Number(opt('max-mrr', '10000'));    // <=$10k: early, unscaled, copyable pattern
const verifiedOnly = flag('verified');             // only Flippa-verified revenue (higher trust)
const pages = Number(opt('pages', '5'));           // pages per type (page size 50 => up to 250/type)
const pageSize = Number(opt('page-size', '50'));
const androidGap = flag('android-gap');            // heuristic flag: iOS listing whose summary implies no Android
const out = opt('out');
const llmPrompt = opt('llm-prompt');
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchPage(type, page) {
  const url = 'https://api.flippa.com/v3/listings' +
    '?filter%5Bproperty_type%5D=' + encodeURIComponent(type) +
    '&filter%5Bstatus%5D=open' +
    '&page%5Bsize%5D=' + pageSize + '&page%5Bnumber%5D=' + page +
    '&sort=-revenue_per_month';
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', accept: 'application/json' } });
    if (r.status !== 200) return [];
    const j = await r.json();
    return (j.data || []).map(d => d.attributes || d);
  } catch { return []; }
}

function clean(s) { return (s || '').replace(/\s+/g, ' ').trim(); }
// crude "no Android" signal from the pitch copy
const IOS_ONLY_RE = /\biOS(?:[ -]only)?\b|\bApp Store\b|\biPhone\b|\bSwift(?:UI)?\b/i;
const HAS_ANDROID_RE = /\bandroid\b|\bplay store\b|\bgoogle play\b|\bflutter\b|\breact native\b|\bcross[- ]platform\b/i;

async function run() {
  console.error(`pulling Flippa: types=[${types.join(', ')}], ${pages} pages x ${pageSize}, MRR ${minMrr}-${maxMrr}${verifiedOnly ? ', verified-only' : ''}`);
  const rows = [];
  for (const type of types) {
    for (let p = 1; p <= pages; p++) {
      const batch = await fetchPage(type, p);
      if (!batch.length) break;
      for (const a of batch) {
        const mrr = Number(a.revenue_per_month || 0);
        if (mrr < minMrr || mrr > maxMrr) continue;
        if (verifiedOnly && !a.has_verified_revenue) continue;
        const summary = clean(a.summary || a.title);
        const iosOnly = androidGap && /ios/.test(String(a.property_type)) &&
          IOS_ONLY_RE.test(summary) && !HAS_ANDROID_RE.test(summary);
        rows.push({
          name: clean(a.property_name) || '(confidential)',
          type: a.property_type,
          industry: clean(a.industry),
          model: clean(a.business_model),
          mrr, profit: Number(a.profit_per_month || 0),
          price: Number(a.current_price || a.display_price || 0),
          verified: !!a.has_verified_revenue,
          downloads: a.app_downloads_per_month || null,
          ios_only_guess: iosOnly,
          url: a.html_url || '',
          summary: summary.slice(0, 180),
        });
      }
      await sleep(120);
    }
    console.error(`  ${type}: ${rows.length} cumulative kept`);
  }

  // annual-revenue multiple (price / (mrr*12)) as a rough "how the market values this pattern"
  for (const r of rows) r.mult = r.mrr > 0 && r.price > 0 ? +(r.price / (r.mrr * 12)).toFixed(1) : null;
  rows.sort((a, b) => b.mrr - a.mrr);

  // ---- output ----
  console.log(`\n=== proven-WTP marketplace patterns — ${rows.length} listings (Flippa, MRR ${minMrr}-${maxMrr}) ===`);
  console.log('MRR    profit  price    mult  ver  industry / name  :: summary');
  for (const r of rows.slice(0, 50)) {
    console.log(
      `$${String(r.mrr).padStart(5)}  $${String(r.profit).padStart(5)}  $${String(r.price).padStart(6)}  ` +
      `${String(r.mult ?? '-').padStart(4)}  ${r.verified ? '✓' : ' '}  ` +
      `${(r.industry || r.type).slice(0, 22)} / ${r.name.slice(0, 32)}${r.ios_only_guess ? '  [iOS-only?]' : ''}` +
      `\n         :: ${r.summary}`);
  }

  // industry rollup — where the proven money clusters
  const byInd = {};
  for (const r of rows) { const k = r.industry || r.type; (byInd[k] = byInd[k] || { n: 0, mrr: 0 }); byInd[k].n++; byInd[k].mrr += r.mrr; }
  const rollup = Object.entries(byInd).sort((a, b) => b[1].mrr - a[1].mrr).slice(0, 15);
  console.log('\n=== industry rollup (proven MRR clusters) ===');
  for (const [k, v] of rollup) console.log(`  ${String(v.n).padStart(3)} listings  $${String(v.mrr).padStart(6)}/mo total  ${k}`);

  if (out) {
    const cols = ['name', 'type', 'industry', 'model', 'mrr', 'profit', 'price', 'mult', 'verified', 'downloads', 'ios_only_guess', 'url', 'summary'];
    const csv = cols.join(',') + '\n' + rows.map(r => cols.map(k =>
      typeof r[k] === 'string' ? JSON.stringify(r[k]) : (r[k] ?? '')).join(',')).join('\n');
    writeFileSync(out, csv + '\n');
    console.error('CSV -> ' + out + ` (${rows.length} rows)`);
  }

  if (llmPrompt) {
    const top = rows.slice(0, 60);
    const table = top.map(r => `${r.name} | ${r.industry || r.type} | $${r.mrr}/mo${r.verified ? ' (verified)' : ''} | ask $${r.price} | ${r.summary}`).join('\n');
    const prompt = `# Proven-WTP pattern mining — Flippa (${types.join(', ')}, MRR ${minMrr}-${maxMrr})

Every row is a real app/SaaS business FOR SALE with actual monthly revenue. These prove people PAY for
the pattern — the market risk is already retired. Your job is NOT to buy them; it's to find the PATTERN
worth copying/verticalizing/porting, then run it through the same gates that kill most ideas.

${table}

Your job (COPY-THE-PATTERN DISCOVERY):
1. CLUSTER into 4–8 patterns (a pattern = a job people pay for, not one listing). Name each; note the
   proven MRR band and whether revenue was verified.
2. For each pattern pick the ANGLE that beats the incumbent listing (they're for sale = often stalled):
   - VERTICALIZE — same tool, hyper-targeted to a niche/profession/region the generic one ignores
     (the "Freed" move: a proven horizontal made magic for one audience).
   - PORT — successful on one platform/store/country, absent on another (esp. iOS-success -> Android gap,
     or US -> BR). Demand proven, you just re-serve it. Flag any listing whose pitch implies single-platform.
   - DO-IT-BETTER — same market, win on design / price / speed / support (moat = execution, not novelty).
3. MARKETABILITY gate (the survival variable): content volume in the niche? show-don't-tell in one <15s
   clip? tell-a-friend moment? -> EASY / HARD(channel) / GRAVEYARD.
4. MOAT test: what stops the original (or anyone) copying you back in a week? Name the real moat
   (data feed, workflow lock, network, distribution, domain access). "Just a feature" = say so.
5. FIT filter: prefer patterns that sit on the user's real edge (real-estate + computer-vision + BR access)
   over generic ones they can't out-market.
6. Output the 2–3 best patterns to validate: pattern, proven MRR, chosen angle (verticalize/port/better),
   marketability verdict, moat, and the fake-door ground-truth step (landing page + 10 signups/week +
   5 real conversations) before building.
`;
    writeFileSync(llmPrompt, prompt);
    console.error('LLM prompt -> ' + llmPrompt);
  }
  console.error('\nNOTE: Flippa listings are businesses FOR SALE (often stalled) — copy the PROVEN PATTERN, not the asset.');
}

run().catch(e => { console.error('FATAL', e.message); process.exit(1); });
