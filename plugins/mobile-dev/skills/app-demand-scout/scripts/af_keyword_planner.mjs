#!/usr/bin/env node
//
// af_keyword_planner.mjs — REAL search volume from Google Ads Keyword Planner (the only source with ABSOLUTE
// monthly search volume; everything else in this toolkit is a proxy: af_market/af_probe = in-store search-bar
// popularity 0-100, af_google = autocomplete breadth). Uses generateKeywordHistoricalMetrics on the exact
// keywords you pass (NOT idea-expansion) so you get avg monthly searches + competition + top-of-page bid for
// the concepts you already chose (e.g. the geo-arbitrage leads).
//
// WHY THIS EXISTS: for Brazil, in-store popularity floors at 5 for real concepts (discovery is off-store).
// Keyword Planner measures Google search volume directly — the channel that actually drives BR/Android
// discovery — so it's the hard-number gate that store popularity can't be for Brazil.
//
// CREDENTIALS (you must supply — this hits YOUR Google Ads account; see runbook below). Env or flags:
//   GADS_DEV_TOKEN       developer token (Ads account > API Center; approval can take days)
//   GADS_CLIENT_ID       OAuth2 client id      (Google Cloud console, OAuth desktop app)
//   GADS_CLIENT_SECRET   OAuth2 client secret
//   GADS_REFRESH_TOKEN   OAuth2 refresh token  (one-time consent; see runbook)
//   GADS_CUSTOMER_ID     the Ads customer id running the query (digits only, no dashes)
//   GADS_LOGIN_CID       (optional) manager (MCC) customer id if CUSTOMER_ID is under a manager
//
// USAGE:
//   GADS_DEV_TOKEN=... GADS_CLIENT_ID=... GADS_CLIENT_SECRET=... GADS_REFRESH_TOKEN=... GADS_CUSTOMER_ID=... \
//     node af_keyword_planner.mjs --geo br --lang pt \
//       --terms "transcrever audio whatsapp,jejum intermitente app,guarda compartilhada app,mapa astral,ruido branco bebe"
//   node af_keyword_planner.mjs --geo us --lang en --terms-file kw.txt --out vol.csv
//
// ---- CREDENTIAL RUNBOOK (one-time, ~30-40 min, then reusable) ----
//  1. Google Ads account (any active account). Tools > API Center > apply for a DEVELOPER TOKEN. A "test"
//     token works against test accounts only; for real production volume you need Basic access (a short form,
//     usually approved in 1-2 days). Keyword Planner also needs at least one campaign/billing on the account.
//  2. Google Cloud console > new project > enable "Google Ads API" > OAuth consent screen (External, add your
//     email as a test user) > Credentials > Create OAuth client ID > Desktop app. Note client id + secret.
//  3. Get a REFRESH TOKEN once (OAuth playground is easiest): https://developers.google.com/oauthplayground
//     gear > "Use your own OAuth credentials" > paste client id/secret > authorize scope
//     https://www.googleapis.com/auth/adwords > Exchange auth code > copy the refresh token.
//  4. CUSTOMER_ID = the 10-digit Ads account id (no dashes). If it sits under a manager account, set
//     GADS_LOGIN_CID to the manager id.
//  Then export the 5-6 env vars and run. Nothing here is stored; creds are read from env at call time.

import { readFileSync, writeFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const opt = (n, d = null) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };
const env = (n) => process.env[n] || '';

// geo target + language criterion ids (Google Ads constants). Extend as needed.
const GEO = { br: 2076, us: 2840, gb: 2826, uk: 2826, de: 2276, fr: 2250, es: 2724, it: 2380, pt: 2620,
  mx: 2484, ca: 2124, au: 2036, jp: 2392, nl: 2528, se: 2752, no: 2578, dk: 2208, fi: 2246, is: 2352 };
const LANG = { en: 1000, de: 1001, fr: 1002, es: 1003, it: 1004, ja: 1005, nl: 1010, pt: 1014, sv: 1015,
  no: 1013, da: 1009, fi: 1011, is: 1026 };

const geoKey = opt('geo', 'br').toLowerCase();
const langKey = opt('lang', 'pt').toLowerCase();
const geoId = GEO[geoKey]; const langId = LANG[langKey];
if (!geoId) { console.error(`Unknown --geo ${geoKey}. Known: ${Object.keys(GEO).join(', ')}`); process.exit(1); }
if (!langId) { console.error(`Unknown --lang ${langKey}. Known: ${Object.keys(LANG).join(', ')}`); process.exit(1); }
const apiVer = opt('api-version', 'v17');
const out = opt('out');
let terms = (opt('terms', '') || '').split(',').map(s => s.trim()).filter(Boolean);
if (opt('terms-file')) terms = terms.concat(readFileSync(opt('terms-file'), 'utf8').split('\n').map(s => s.trim()).filter(s => s && !s.startsWith('#')));
if (!terms.length) { console.error('Pass --terms "a,b,c" or --terms-file'); process.exit(1); }
terms = terms.slice(0, 10000);   // API caps at 10k keywords/request

const need = ['GADS_DEV_TOKEN', 'GADS_CLIENT_ID', 'GADS_CLIENT_SECRET', 'GADS_REFRESH_TOKEN', 'GADS_CUSTOMER_ID'];
const missing = need.filter(k => !env(k));
if (missing.length) {
  console.error('Missing credentials: ' + missing.join(', '));
  console.error('See the CREDENTIAL RUNBOOK at the top of this file (one-time setup).');
  process.exit(2);
}

async function accessToken() {
  const body = new URLSearchParams({
    grant_type: 'refresh_token', client_id: env('GADS_CLIENT_ID'),
    client_secret: env('GADS_CLIENT_SECRET'), refresh_token: env('GADS_REFRESH_TOKEN'),
  });
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body });
  const j = await r.json();
  if (!j.access_token) throw new Error('OAuth token exchange failed: ' + JSON.stringify(j));
  return j.access_token;
}

async function run() {
  const token = await accessToken();
  const cid = env('GADS_CUSTOMER_ID').replace(/[^0-9]/g, '');
  const url = `https://googleads.googleapis.com/${apiVer}/customers/${cid}:generateKeywordHistoricalMetrics`;
  const headers = {
    'authorization': 'Bearer ' + token,
    'developer-token': env('GADS_DEV_TOKEN'),
    'content-type': 'application/json',
  };
  if (env('GADS_LOGIN_CID')) headers['login-customer-id'] = env('GADS_LOGIN_CID').replace(/[^0-9]/g, '');
  const payload = {
    keywords: terms,
    geoTargetConstants: [`geoTargetConstants/${geoId}`],
    language: `languageConstants/${langId}`,
    keywordPlanNetwork: 'GOOGLE_SEARCH',
    historicalMetricsOptions: { includeAverageCpc: true },
  };
  const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload) });
  const text = await r.text();
  if (r.status !== 200) {
    console.error(`Google Ads API ${r.status}:`);
    console.error(text.slice(0, 1200));
    process.exit(1);
  }
  const j = JSON.parse(text);
  const rows = (j.results || []).map(x => {
    const m = x.keywordMetrics || {};
    return {
      keyword: x.text,
      avg_monthly_searches: Number(m.avgMonthlySearches || 0),
      competition: m.competition || '-',                       // LOW | MEDIUM | HIGH
      competition_index: m.competitionIndex != null ? Number(m.competitionIndex) : null,  // 0-100
      low_bid: m.lowTopOfPageBidMicros ? (Number(m.lowTopOfPageBidMicros) / 1e6).toFixed(2) : null,
      high_bid: m.highTopOfPageBidMicros ? (Number(m.highTopOfPageBidMicros) / 1e6).toFixed(2) : null,
    };
  }).sort((a, b) => b.avg_monthly_searches - a.avg_monthly_searches);

  console.log(`\n=== Google Keyword Planner — REAL volume (${geoKey.toUpperCase()}/${langKey}, ${rows.length} keywords) ===`);
  console.log('avg/mo   comp    idx   topbid($low-high)  keyword');
  for (const r of rows) {
    console.log(`${String(r.avg_monthly_searches).padStart(7)}   ${String(r.competition).padEnd(6)} ${String(r.competition_index ?? '-').padStart(4)}   ` +
      `${(r.low_bid && r.high_bid ? `${r.low_bid}-${r.high_bid}` : '-').padEnd(16)}  ${r.keyword}`);
  }
  if (out) {
    const cols = ['keyword', 'avg_monthly_searches', 'competition', 'competition_index', 'low_bid', 'high_bid'];
    writeFileSync(out, cols.join(',') + '\n' + rows.map(r => cols.map(k =>
      typeof r[k] === 'string' ? JSON.stringify(r[k]) : (r[k] ?? '')).join(',')).join('\n') + '\n');
    console.error('CSV -> ' + out);
  }
  console.error('\navg_monthly_searches = REAL Google search volume (12-mo avg). This is the hard-number gate ' +
    'store popularity cannot be for Brazil. competition = ADVERTISER competition (buy-intent proxy), not organic difficulty.');
}
run().catch(e => { console.error('FATAL', e.message); process.exit(1); });
