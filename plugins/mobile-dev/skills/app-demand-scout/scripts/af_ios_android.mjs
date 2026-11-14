#!/usr/bin/env node
//
// af_ios_android.mjs — iOS->Android ARBITRAGE detector.
//
// Strategy B (the strong one for a dev, not a marketer): demand is already PROVEN if an app succeeds on
// iOS. Many US indies ship iOS-only. So a successful iOS app that is ABSENT / weak on Google Play is a
// port opportunity — you re-serve proven demand instead of hunting the (near-nonexistent) empty gap.
//
// Method (public sources, no auth):
//   1. iTunes RSS top charts per genre/country -> successful iOS apps (top-grossing = proven WTP).
//        GET https://itunes.apple.com/<cc>/rss/<chart>/limit=N/genre=<id>/json
//        chart: topgrossingapplications | topfreeapplications | toppaidapplications
//   2. For each, Google Play search -> presence check.
//        GET https://play.google.com/store/search?q=<name>&c=apps&gl=<cc>&hl=en
//        PRESENT if the developer name appears OR a top result package id contains a distinctive name
//        token (e.g. "Duolingo" -> com.duolingo). Play returns ~20-40 apps for ANY query, so mere
//        result-count means nothing — we match identity, not presence of *some* app.
//   3. iOS-success + Android-absent  => arbitrage candidate. Flag ecosystem-locked (won't port) and
//      note the Android-ARPU caveat. Emit CSV + a port-decision LLM prompt (marketability/moat gates).
//
// CAVEATS baked into output: skip iOS-ecosystem-locked (iMessage/watch/widget/HealthKit) apps; Android
// ARPU is lower (favor ad-monetizable / genuine-WTP niches); clone the CONCEPT clean-room, never the
// code/name/assets. Presence check can false-POSITIVE when the Play title differs from iOS (a present app
// looks absent) — treat "absent" as a lead to verify by hand, not a guarantee.
//
// USAGE:
//   node af_ios_android.mjs --genre health-fitness,education --chart topgrossing --per 40 --out gap.csv --llm-prompt port.md
//   node af_ios_android.mjs --genre 6013 --country us --per 60          # raw genre id ok
//   node af_ios_android.mjs --names "Some App,Another App"              # check a hand list instead

import { writeFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const opt = (n, d = null) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };
const flag = (n) => argv.includes('--' + n);
const list = (s) => (s || '').split(',').map(x => x.trim()).filter(Boolean);

const GENRES = { 'business': 6000, 'weather': 6001, 'utilities': 6002, 'travel': 6003, 'sports': 6004,
  'lifestyle': 6012, 'health-fitness': 6013, 'health': 6013, 'productivity': 6007, 'photo-video': 6008,
  'finance': 6015, 'education': 6017, 'reference': 6006, 'food-drink': 6023, 'books': 6018, 'medical': 6020,
  'entertainment': 6016, 'music': 6011, 'news': 6009, 'navigation': 6010, 'social': 6005 };
const CHART = { topgrossing: 'topgrossingapplications', topfree: 'topfreeapplications', toppaid: 'toppaidapplications' };

const country = opt('country', 'us').toLowerCase();
const chart = CHART[opt('chart', 'topgrossing')] || CHART.topgrossing;
const per = Number(opt('per', '40'));                    // apps checked per genre (Play-call budget)
const genres = list(opt('genre', 'health-fitness')).map(g => GENRES[g] || g);
const names = list(opt('names'));
const out = opt('out');
const llmPrompt = opt('llm-prompt');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

// ecosystem-locked hint (won't/shouldn't port) — from the app name
const LOCKED_RE = /\b(watch|widget|imessage|sticker|siri|shortcut|airpods|homekit|carplay|apple\s?tv|mac|safari|content\s?blocker|ad\s?block|adblock|extension|userscript|tampermonkey)\b/i;

async function topApps(genreId) {
  const url = `https://itunes.apple.com/${country}/rss/${chart}/limit=${per}/genre=${genreId}/json`;
  try {
    const j = await (await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })).json();
    return (j.feed.entry || []).map(e => ({
      name: e['im:name'].label,
      dev: e['im:artist'].label,
      id: e.id.attributes['im:id'],
      genre: (e.category && e.category.attributes.label) || genreId,
    }));
  } catch { return []; }
}

// enrich one app with iOS rating count (success signal) via public lookup
async function iosMeta(id) {
  try {
    const j = await (await fetch(`https://itunes.apple.com/lookup?id=${id}&country=${country}`)).json();
    const a = (j.results || [])[0];
    return a ? { ratings: a.userRatingCount || 0, price: a.price || 0, genres: (a.genres || []).join('/') } : {};
  } catch { return {}; }
}

// distinctive developer token: drop corporate suffixes, keep the longest real word
const CORP = new Set(['inc', 'llc', 'ltd', 'limited', 'gmbh', 'co', 'corp', 'technologies', 'technology', 'apps',
  'app', 'studio', 'studios', 'labs', 'lab', 'games', 'software', 'digital', 'mobile', 'group', 'team', 'the', 'and']);
function devToken(dev) {
  const words = norm(dev).split(' ').filter(w => w.length >= 4 && !CORP.has(w));
  return words.sort((a, b) => b.length - a.length)[0] || '';
}
async function playPresence(name, dev) {
  const url = `https://play.google.com/store/search?q=${encodeURIComponent(name)}&c=apps&gl=${country}&hl=en`;
  try {
    const t = await (await fetch(url, { headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Accept-Language': 'en-US' } })).text();
    const pkgs = [...new Set([...t.matchAll(/store\/apps\/details\?id=([a-zA-Z0-9._]+)/g)].map(m => m[1]))].slice(0, 12);
    const htmlNorm = norm(t);
    // developer match: distinctive token appears in a result package OR in the page text
    const dtok = devToken(dev);
    const devPkgHit = dtok ? pkgs.some(p => p.toLowerCase().replace(/[._]/g, '').includes(dtok)) : false;
    const devTextHit = dtok && dtok.length >= 5 ? htmlNorm.includes(dtok) : false;   // >=5 to avoid common short words
    // distinctive name tokens (drop generic category words)
    const generic = new Set(['app', 'free', 'pro', 'plus', 'the', 'and', 'for', 'lite', 'tracker', 'planner', 'my', 'ai',
      'calorie', 'counter', 'weight', 'workout', 'fitness', 'health', 'diet', 'sleep', 'meditation', 'photo', 'video', 'editor']);
    const toks = norm(name).split(' ').filter(w => w.length >= 4 && !generic.has(w));
    const namePkgHit = toks.length ? pkgs.some(p => { const pn = p.toLowerCase().replace(/[._]/g, ''); return toks.some(w => pn.includes(w)); }) : false;
    const packageIdentity = devPkgHit || namePkgHit;         // strong: a real result IS this app/dev
    const present = packageIdentity || devTextHit;           // devTextHit alone = weak (generic word risk)
    // trust the verdict when a package identity matched (present), or a clean miss with a usable dev token (absent)
    const confident = packageIdentity || (!present && dtok.length >= 4);
    return { present, devHit: devPkgHit, pkgHit: namePkgHit, topPkg: pkgs[0] || '', confident };
  } catch { return { present: null, error: true }; }
}

async function run() {
  let apps = [];
  if (names.length) {
    apps = names.map(n => ({ name: n, dev: '', id: null, genre: 'manual' }));
  } else {
    for (const g of genres) {
      const t = await topApps(g);
      apps.push(...t);
      console.error(`genre ${g}: ${t.length} top-${chart.replace('applications', '')} iOS apps`);
      await sleep(150);
    }
  }
  // dedupe by name
  const seen = new Set(); apps = apps.filter(a => { const k = norm(a.name); if (seen.has(k)) return false; seen.add(k); return true; });
  console.error(`checking Play presence for ${apps.length} iOS apps (country ${country})...`);

  const rows = [];
  for (const a of apps) {
    const p = await playPresence(a.name, a.dev);
    let meta = {};
    if (a.id && (p.present === false)) meta = await iosMeta(a.id);   // only enrich the candidates
    rows.push({
      name: a.name, dev: a.dev, genre: a.genre, ios_id: a.id,
      android_present: p.present, dev_hit: p.devHit, pkg_hit: p.pkgHit, top_pkg: p.topPkg,
      confident: p.confident, locked: LOCKED_RE.test(a.name),
      ios_ratings: meta.ratings ?? null,
    });
    await sleep(300);   // be polite to Play
  }

  const candidates = rows.filter(r => r.android_present === false && !r.locked);
  candidates.sort((a, b) => (b.ios_ratings || 0) - (a.ios_ratings || 0));

  console.log(`\n=== iOS-success + Android-GAP candidates — ${candidates.length} of ${rows.length} checked (${country.toUpperCase()}, ${chart}) ===`);
  console.log('iOS-ratings  conf  genre  name  (dev)  [iOS ' + '$' + ']');
  for (const c of candidates.slice(0, 40)) {
    console.log(`${String(c.ios_ratings ?? '?').padStart(9)}  ${c.confident ? 'HI' : 'lo'}  ${(c.genre || '').slice(0, 16).padEnd(16)}  ${c.name}  (${c.dev})`);
  }
  const locked = rows.filter(r => r.android_present === false && r.locked).length;
  const present = rows.filter(r => r.android_present === true).length;
  console.error(`\npresent on Play: ${present} | gap candidates: ${candidates.length} | ecosystem-locked (skipped): ${locked} | errors: ${rows.filter(r => r.android_present === null).length}`);

  if (out) {
    const cols = ['name', 'dev', 'genre', 'ios_id', 'ios_ratings', 'android_present', 'confident', 'dev_hit', 'pkg_hit', 'top_pkg', 'locked'];
    const csv = cols.join(',') + '\n' + rows.map(r => cols.map(k =>
      typeof r[k] === 'string' ? JSON.stringify(r[k]) : (r[k] ?? '')).join(',')).join('\n');
    writeFileSync(out, csv + '\n');
    console.error('CSV -> ' + out + ` (${rows.length} rows)`);
  }

  if (llmPrompt) {
    const table = candidates.slice(0, 50).map(c => `${c.name} | ${c.dev} | ${c.genre} | iOS ratings ${c.ios_ratings ?? '?'} | Play-match confidence ${c.confident ? 'high' : 'low'}`).join('\n');
    const prompt = `# iOS->Android port candidates — ${country.toUpperCase()} ${chart}

Each app is SUCCESSFUL on iOS (top-${chart.replace('applications', '')} chart) and appears ABSENT/weak on
Google Play (developer + package identity did not match in Play search). Demand is proven; the Android
audience is unserved. "confidence low" = verify the absence by hand (the Play title may just differ).

${table}

Your job (PORT DECISION):
1. VERIFY each candidate's absence by hand-checking Play (the detector flags leads, not certainties).
2. KILL the ones that are iOS-only for a REASON, not an oversight:
   - Ecosystem-locked value (iMessage/Watch/widget/HealthKit/Shortcuts) — won't port.
   - Audience-locked value (the whole point is an affluent US-iOS user; Android audience won't pay).
   - Regulated/liability content that Play polices differently.
3. MARKETABILITY still applies: content volume in the niche? show-don't-tell in one <15s clip?
   tell-a-friend moment? A proven iOS app usually clears this — confirm the format ports.
4. MOAT: after you port, what stops the ORIGINAL dev from shipping Android in a week and crushing you?
   Favor apps where the original is dormant/solo/abandoned, or where you add a real edge (localization
   to BR, a better model, your CV/real-estate domain) — not a pure 1:1 clone they can copy back.
5. LEGAL: clone the CONCEPT clean-room — never the code, name, icon, or copy.
6. Output the 3–5 best PORTS: app, why iOS-only looks like an oversight (not intentional), the Android
   monetization plan (ARPU is lower — ads vs subscription), the added edge, and the ground-truth step
   (ship a thin Android MVP + measure installs) before full build.
`;
    writeFileSync(llmPrompt, prompt);
    console.error('LLM prompt -> ' + llmPrompt);
  }
  console.error('\nNOTE: "Android-absent" is a LEAD to verify, not proof. Android ARPU < iOS — pick ad-monetizable/WTP niches. Clean-room the concept.');
}

run().catch(e => { console.error('FATAL', e.message); process.exit(1); });
