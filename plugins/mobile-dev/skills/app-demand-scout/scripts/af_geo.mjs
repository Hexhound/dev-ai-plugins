#!/usr/bin/env node
//
// af_geo.mjs — GEO-ARBITRAGE detector (US proven concept -> open, under-localized country e.g. Brazil).
//
// Same species as af_ios_android, but the arbitrage axis is COUNTRY, not platform. A US top-chart app
// with 4+ stars is a PROVEN concept (someone already validated willingness-to-pay). If no LOCALIZED
// competitor serves the same job in the target country, and target-country search demand for that concept
// is real (popularity high) and beatable (difficulty low), it's a port/localize opportunity.
//
// Method (public sources + the credit-free AppFigures dashboard session, no paid API):
//   1. iTunes RSS US top charts per genre -> successful iOS apps.
//        GET https://itunes.apple.com/us/rss/<chart>/limit=N/genre=<id>/json
//   2. iTunes lookup (US) -> keep only PROVEN: avg rating >= --min-stars AND ratings >= --min-ratings.
//        Derive the CONCEPT keyword(s) from the app's description + distinctive name tokens (NOT the brand).
//   3. iTunes lookup (target country) -> LOCALIZATION check. The app is global by default, so "not in the
//        BR store" is usually FALSE. What matters is whether a pt-BR-LOCALIZED app serves the concept.
//        HOLE #1 patched: we test localization (description language), not mere availability.
//   4. AppFigures /api/aso-ranks?country=<TARGET> for the concept term(s) -> popularity + competitiveness
//        + who ranks locally. Keep leads with popularity >= --min-pop (market-size weighted) AND
//        competitiveness <= --max-diff AND no strong local (pt) incumbent among the leaders.
//   5. Emit a ranked lead table + CSV + a localize-decision LLM prompt that forces the WHY-NOT-HERE
//        question (HOLE #2) and cultural/payment fit — the parts that separate a real gap from a trap.
//
// THREE HOLES this patches (see notes in the LLM prompt):
//   #1 "doesn't exist in other country" is usually a LOCALIZATION gap, not an availability gap. The moat
//      is language + local ASO, which an incumbent can copy in a week — know which gap you exploit.
//   #2 ASK WHY it isn't localized: small market / no WTP / payment friction (BR = Pix/boleto) / cultural
//      non-fit are KILLERS; "universal concept, needs local reframing" is the WIN (e.g. affirmations ->
//      "afirmações", winter-SAD reframed). The prompt makes you answer this per lead.
//   #3 NORMALIZE popularity by market size. pop 20 in BR (huge) >> pop 20 in Iceland (tiny). --min-pop
//      defaults are set per-market; the video's flat ">20" is too loose for big markets, too tight for small.
//
// PREREQ (for the demand step): Chromium --remote-debugging-port=9222 logged into appfigures.com. Same
// session trick as af_market.mjs / af_discover.mjs. Without it, step 4 is skipped (leads still emitted,
// but without popularity/difficulty — you then check keywords by hand in Astro/AppFigures).
//
// USAGE:
//   node af_geo.mjs --target br --genre health-fitness,lifestyle,education --chart topgrossing \
//     --per 50 --min-stars 4 --min-ratings 2000 --max-diff 50 --min-pop 20 \
//     --out geo_br.csv --llm-prompt geo_br.md
//   node af_geo.mjs --target br --chart toppaid --genre productivity      # paid charts = thinner, proven WTP
//   node af_geo.mjs --target br --no-demand --genre lifestyle             # skip AppFigures; leads only

import { chromium } from 'playwright-core';
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

// AppFigures/Apple country -> default market-size-weighted min popularity (HOLE #3). Bigger market => a
// given popularity number represents more absolute searches, so raise the bar; tiny market => lower it.
const MARKET_MINPOP = { us: 30, br: 20, mx: 20, de: 22, fr: 22, gb: 24, es: 20, it: 20, ca: 20, au: 20,
  jp: 22, in: 18, pt: 12, is: 8, no: 10, se: 12, dk: 10, fi: 10, nl: 14 };

const source = opt('source', 'us').toLowerCase();          // proven-concept market (charts)
const target = opt('target', 'br').toLowerCase();          // under-localized market to port INTO
const chart = CHART[opt('chart', 'topgrossing')] || CHART.topgrossing;
const per = Number(opt('per', '50'));
const genres = list(opt('genre', 'lifestyle,health-fitness,education')).map(g => GENRES[g] || g);
const minStars = Number(opt('min-stars', '4'));
const minRatings = Number(opt('min-ratings', '2000'));     // "proven" bar in the source market
const maxDiff = Number(opt('max-diff', '50'));             // competitiveness ceiling (his "difficulty < 50")
const minPop = Number(opt('min-pop', String(MARKET_MINPOP[target] ?? 20)));  // market-weighted (HOLE #3)
const maxTerms = Number(opt('max-terms', '220'));          // AppFigures call budget
const noDemand = flag('no-demand');                        // skip AppFigures (leads without pop/diff)
const cdp = opt('cdp', 'http://127.0.0.1:9222');
const out = opt('out');
const llmPrompt = opt('llm-prompt');

const sleep = ms => new Promise(r => setTimeout(r, ms));
const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9à-ÿ ]/g, ' ').replace(/\s+/g, ' ').trim();

// ecosystem/locale-locked hint (won't port cleanly)
const LOCKED_RE = /\b(watch|widget|imessage|sticker|siri|shortcut|airpods|homekit|carplay|apple\s?tv|mac|safari|content\s?blocker|adblock|extension)\b/i;

// generic app words that are NOT the concept (brand/category filler)
const GENERIC = new Set(['app','apps','free','pro','plus','lite','the','and','for','with','your','you','my','ai',
  'best','new','get','now','daily','tracker','planner','maker','editor','manager','master','mobile','online',
  'premium','official','game','games']);

// Target-language markers to detect a LOCALIZED description (HOLE #1). Keyed by target country; falls back
// to pt. A localized description => the app already serves locals in-language (lane is walled, not open).
const LOCALE_MARKERS = {
  br: /\b(você|voce|para|com|aplicativo|grátis|gratis|seu|sua|não|nao|mais|fotos|saúde|dinheiro|treino|receitas|diário|acompanhe)\b|[ãõçáéíóúâ]/i,
  pt: /\b(você|voce|para|com|aplicativo|grátis|gratis|seu|sua|não|nao|mais|saúde|dinheiro|acompanhe)\b|[ãõçáéíóúâ]/i,
  de: /\b(und|für|mit|dein|deine|kostenlos|gesundheit|schlaf|training|rezepte|nicht|oder|über|dich|jetzt|einfach)\b|[äöüß]/i,
  fr: /\b(et|pour|avec|votre|vos|gratuit|santé|entraînement|recettes|vous|votre|application|quotidien)\b|[àâçéèêëîïôùû]/i,
  es: /\b(y|para|con|tu|tus|gratis|salud|entrenamiento|recetas|tú|aplicación|diario|seguimiento)\b|[áéíóúñ¿¡]/i,
  it: /\b(e|per|con|tuo|tua|gratis|salute|allenamento|ricette|applicazione|quotidiano)\b|[àèéìòù]/i,
  jp: /[ぁ-んァ-ヶ一-龠]/,
};
const TARGET_MARKER = LOCALE_MARKERS[target] || LOCALE_MARKERS.pt;

// compact EN->PT concept dictionary (only high-value app-concept nouns; unknown terms pass through and are
// probed in English, which BR users also search for many categories).
const EN_PT = { affirmation:'afirmações', affirmations:'afirmações', budget:'orçamento', budgeting:'orçamento',
  meditation:'meditação', sleep:'sono', workout:'treino', fitness:'academia', calorie:'calorias', diet:'dieta',
  recipe:'receitas', recipes:'receitas', habit:'hábitos', journal:'diário', journaling:'diário', gratitude:'gratidão',
  fasting:'jejum', water:'água', period:'menstruação', pregnancy:'gravidez', baby:'bebê', prayer:'oração',
  bible:'bíblia', devotional:'devocional', language:'idiomas', flashcard:'flashcards', study:'estudos',
  quiz:'simulado', math:'matemática', reading:'leitura', story:'histórias', kids:'crianças', anxiety:'ansiedade',
  therapy:'terapia', mood:'humor', breathing:'respiração', focus:'foco', productivity:'produtividade',
  todo:'tarefas', notes:'notas', scanner:'scanner', invoice:'nota fiscal', expense:'despesas', savings:'poupança',
  invest:'investimentos', crypto:'cripto', astrology:'astrologia', horoscope:'horóscopo', tarot:'tarô',
  dating:'namoro', wallpaper:'papel de parede', photo:'fotos', video:'vídeo', collage:'colagem', plant:'plantas',
  garden:'jardim', dog:'cachorro', pet:'pet', cleaning:'limpeza', workout_plan:'treino', running:'corrida',
  steps:'passos', posture:'postura', skincare:'cuidados com a pele', hair:'cabelo', makeup:'maquiagem' };
const toPt = w => EN_PT[w] || null;

// ---- iTunes RSS: US top charts ----
async function topApps(genreId) {
  const url = `https://itunes.apple.com/${source}/rss/${chart}/limit=${per}/genre=${genreId}/json`;
  try {
    const j = await (await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })).json();
    return (j.feed.entry || []).map(e => ({
      name: e['im:name'].label,
      dev: e['im:artist'].label,
      id: e.id.attributes['im:id'],
      summary: (e.summary && e.summary.label) || '',
      genre: (e.category && e.category.attributes.label) || genreId,
    }));
  } catch { return []; }
}

// ---- iTunes lookup (any storefront) ----
async function lookup(id, country) {
  try {
    const j = await (await fetch(`https://itunes.apple.com/lookup?id=${id}&country=${country}`,
      { headers: { 'User-Agent': 'iTunes/12.11' } })).json();
    return (j.results || [])[0] || null;
  } catch { return null; }
}

// derive up to 3 concept terms: top frequent description nouns + distinctive name token (skip the brand).
function conceptTerms(app, usMeta) {
  const desc = norm((usMeta && usMeta.description) || app.summary || '');
  const freq = new Map();
  for (const w of desc.split(' ')) {
    if (w.length < 5 || GENERIC.has(w)) continue;
    freq.set(w, (freq.get(w) || 0) + 1);
  }
  const descTop = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(e => e[0]);
  const nameToks = norm(app.name).split(' ').filter(w => w.length >= 4 && !GENERIC.has(w));
  // dedupe, prefer description concepts first (brand-independent)
  const terms = [...new Set([...descTop, ...nameToks.slice(0, 1)])].slice(0, 3);
  return terms;
}

async function run() {
  // 1) US top charts
  let apps = [];
  for (const g of genres) {
    const t = await topApps(g);
    apps.push(...t);
    console.error(`${source.toUpperCase()} genre ${g}: ${t.length} top-${chart.replace('applications', '')} apps`);
    await sleep(150);
  }
  const seen = new Set();
  apps = apps.filter(a => { const k = norm(a.name); if (seen.has(k) || LOCKED_RE.test(a.name)) return false; seen.add(k); return true; });
  console.error(`${apps.length} unique unlocked apps -> enriching + localization check (target ${target.toUpperCase()})...`);

  // 2+3) enrich (US proven bar) + target localization check
  const enriched = [];
  for (const a of apps) {
    const us = await lookup(a.id, source);
    await sleep(120);
    const ratings = us ? (us.userRatingCount || 0) : 0;
    const avg = us ? (us.averageUserRating || 0) : 0;
    if (avg < minStars || ratings < minRatings) continue;            // proven-concept filter
    const tgt = await lookup(a.id, target);
    await sleep(120);
    const availableInTarget = !!tgt;                                 // app itself sold in target store
    const tgtDesc = tgt ? (tgt.description || '') : '';
    const ptLocalized = availableInTarget && TARGET_MARKER.test(tgtDesc); // localized description => already serving locals
    const terms = conceptTerms(a, us);
    enriched.push({
      name: a.name, dev: a.dev, id: a.id, genre: a.genre,
      us_ratings: ratings, us_avg: avg,
      available_in_target: availableInTarget, target_localized: ptLocalized,
      concept_terms: terms,
    });
  }
  console.error(`${enriched.length} proven apps (>=${minStars}★, >=${minRatings} ratings). ` +
    `${enriched.filter(e => !e.target_localized).length} NOT localized in ${target.toUpperCase()} (open-lane candidates).`);

  // build the target-market demand term set: concept (en) + pt translation, for the non-localized apps
  const openLane = enriched.filter(e => !e.target_localized);
  const termMeta = new Map();   // term(lower) -> {en, pt}
  for (const e of openLane) {
    for (const t of e.concept_terms) {
      const pt = toPt(t);
      if (t) termMeta.set(t, { term: t, kind: 'en' });
      if (pt) termMeta.set(pt, { term: pt, kind: 'pt' });
    }
  }
  let terms = [...termMeta.keys()].slice(0, maxTerms);

  // 4) AppFigures demand in the TARGET country for every concept term (one credit-free session)
  let demand = new Map();  // term -> {popularity, competitiveness, leaders[]}
  if (!noDemand && terms.length) {
    console.error(`measuring ${terms.length} concept terms in ${target.toUpperCase()} via AppFigures...`);
    const browser = await chromium.connectOverCDP(cdp);
    const ctx = browser.contexts()[0];
    const page = ctx.pages().find(p => p.url().includes('appfigures.com')) || ctx.pages().at(-1);
    if (!page) { console.error('No appfigures.com tab in the debugged chromium — run with --no-demand or open the dashboard.'); process.exit(1); }
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
    if (!tok) { console.error('No AppFigures session token — log in on appfigures.com or use --no-demand.'); process.exit(1); }
    console.error('session token ok');
    const rows = await page.evaluate(async (args) => {
      const { terms, country, tok } = args;
      const H = { accept: 'application/json', 'x-requested-with': 'XMLHttpRequest', 'x-st': tok };
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const out = [];
      for (const term of terms) {
        try {
          const url = '/api/aso-ranks?term=' + encodeURIComponent(term) +
            '&country=' + country.toUpperCase() + '&storefront=apple:ios&page=1&device=handheld&count=5&include_stale=true';
          const r = await fetch(url, { headers: H });
          if (r.status !== 200) { out.push({ term, status: r.status }); await sleep(120); continue; }
          const d = await r.json();
          const k = (d && d.metadata && d.metadata.keyword) || {};
          const leaders = ((d && d.results) || []).slice(0, 5).map(x => ({ name: x.name, dev: x.developer }));
          out.push({ term, status: 200, popularity: k.popularity ?? null, competitiveness: k.competitiveness ?? null, leaders });
        } catch { out.push({ term, status: 'ERR' }); }
        await sleep(140);
      }
      return out;
    }, { terms, country: target, tok });
    await browser.close();
    for (const r of rows) if (r.status === 200 && r.popularity != null)
      demand.set(r.term, { popularity: r.popularity, competitiveness: r.competitiveness, leaders: r.leaders || [] });
    console.error(`demand measured for ${demand.size}/${terms.length} terms`);
  }

  // 5) join: best concept term per app; a LEAD = open lane + real+beatable target demand + no pt incumbent
  const leads = [];
  for (const e of openLane) {
    let best = null;
    for (const t of e.concept_terms) {
      for (const cand of [t, toPt(t)].filter(Boolean)) {
        const d = demand.get(cand);
        if (!d) continue;
        if (!best || (d.popularity || 0) > (best.popularity || 0)) best = { term: cand, ...d };
      }
    }
    // detect a LOCALIZED (pt) incumbent among the leaders for the best term (walls the lane)
    const ptIncumbent = best ? best.leaders.some(l => TARGET_MARKER.test((l.name || '') + ' ' + (l.dev || ''))) : false;
    const lead = {
      name: e.name, dev: e.dev, id: e.id, genre: e.genre,
      us_ratings: e.us_ratings, us_avg: e.us_avg,
      available_in_target: e.available_in_target,
      concept: best ? best.term : e.concept_terms[0] || '',
      target_pop: best ? best.popularity : null,
      target_diff: best ? best.competitiveness : null,
      pt_incumbent: ptIncumbent,
      target_leaders: best ? best.leaders.slice(0, 3).map(l => l.name).filter(Boolean) : [],
    };
    // qualification (only when demand measured): real demand, beatable, no pt incumbent
    lead.qualified = noDemand ? null :
      (lead.target_pop != null && lead.target_pop >= minPop && (lead.target_diff == null || lead.target_diff <= maxDiff) && !ptIncumbent);
    leads.push(lead);
  }

  // sort: qualified first, then by target popularity, then US ratings
  leads.sort((a, b) =>
    (Number(b.qualified === true) - Number(a.qualified === true)) ||
    ((b.target_pop || 0) - (a.target_pop || 0)) ||
    (b.us_ratings - a.us_ratings));

  const qualified = leads.filter(l => l.qualified === true);
  console.log(`\n=== ${source.toUpperCase()}->${target.toUpperCase()} geo-arbitrage leads` +
    `${noDemand ? '' : ` — ${qualified.length} QUALIFIED (pop>=${minPop}, diff<=${maxDiff}, no local incumbent)`} ===`);
  console.log('pop  diff  US★(cnt)  loc?  concept        app   [target leaders]');
  for (const l of leads.slice(0, 40)) {
    const mark = l.qualified === true ? '★★' : (l.qualified === false ? '  ' : ' ?');
    console.log(
      `${String(l.target_pop ?? '-').padStart(3)}  ${String(l.target_diff ?? '-').padStart(4)}  ` +
      `${String(l.us_avg.toFixed(1))}(${String(l.us_ratings).padStart(6)})  ` +
      `${l.pt_incumbent ? 'PT' : (l.available_in_target ? 'en' : '—')}  ${mark} ${(l.concept || '').slice(0, 12).padEnd(12)}  ` +
      `${l.name.slice(0, 28)}  [${l.target_leaders.slice(0, 2).join(', ')}]`);
  }
  console.error(`\n${leads.length} proven apps checked | ${qualified.length} qualified geo-leads | ` +
    `localized-already (skipped as walled): ${enriched.length - openLane.length}`);

  if (out) {
    const cols = ['name', 'dev', 'genre', 'id', 'us_avg', 'us_ratings', 'available_in_target',
      'concept', 'target_pop', 'target_diff', 'pt_incumbent', 'qualified', 'target_leaders'];
    const csv = cols.join(',') + '\n' + leads.map(l => cols.map(k =>
      k === 'target_leaders' ? JSON.stringify(l[k].join(' | ')) :
      (typeof l[k] === 'string' ? JSON.stringify(l[k]) : (l[k] ?? ''))).join(',')).join('\n');
    writeFileSync(out, csv + '\n');
    console.error('CSV -> ' + out + ` (${leads.length} rows)`);
  }

  if (llmPrompt) {
    const ranked = (qualified.length ? qualified : leads).slice(0, 40);
    const table = ranked.map(l => `${l.name} | ${l.genre} | US ${l.us_avg}★ (${l.us_ratings}) | concept "${l.concept}" | ` +
      `${target.toUpperCase()} pop ${l.target_pop ?? '?'} / diff ${l.target_diff ?? '?'} | ` +
      `${l.pt_incumbent ? 'LOCAL INCUMBENT present' : 'no local incumbent'} | local leaders: ${l.target_leaders.join(', ') || '—'}`).join('\n');
    const prompt = `# ${source.toUpperCase()}->${target.toUpperCase()} geo-arbitrage — localize-decision

Each app is PROVEN in ${source.toUpperCase()} (top chart, >=${minStars}★, >=${minRatings} ratings) and appears to have
NO ${target.toUpperCase()}-LOCALIZED competitor for its core concept. Target-market demand was measured on
AppFigures: popularity 0-100 (search demand), competitiveness 0-100 (how walled). Qualified = popularity
>= ${minPop} (market-size weighted for ${target.toUpperCase()}) AND competitiveness <= ${maxDiff} AND no local-language incumbent.

${table}

READ THESE THREE THINGS FIRST (they separate a real gap from a trap):
- HOLE #1 — this is a LOCALIZATION gap, not an availability gap. The app is installable in ${target.toUpperCase()}; what's
  missing is a ${target.toUpperCase()}-language, locally-marketed competitor. Your moat = language + local ASO/SEO +
  payment + cultural fit. That moat is copyable in a week by the original dev — so favor DORMANT/solo originals
  and add a real local edge, not a 1:1 translation.
- HOLE #2 — for EACH lead, answer WHY it isn't localized yet. KILLERS: market too small, low willingness-to-pay,
  payment friction (Brazil = Pix/boleto, not just card), cultural non-fit, content/IP/regulation. WINS: universal
  concept that just needs LOCAL REFRAMING (the "affirmations -> afirmações, reframed for local anxieties" pattern).
  If the honest answer is a killer, kill it. If it's "nobody bothered to localize a universal need," it's real.
- HOLE #3 — popularity is already market-size weighted here (${target.toUpperCase()} bar = ${minPop}). Don't re-apply the flat
  ">20" rule from generic advice.

Your job (LOCALIZE DECISION):
1. VERIFY the localization gap by hand for the top leads (search the concept in the ${target.toUpperCase()} store in the local
   language; the detector flags leads, not certainties — a differently-named local app can hide).
2. For each, answer HOLE #2 (why-not-here) in one line: WIN (universal + reframe) or KILL (which killer).
3. CULTURAL + PAYMENT fit: does the concept survive local reframing? Is there local willingness-to-pay, and can
   you take money the local way (Pix/boleto/local card)? Free-expectation markets need ads/one-time, not subs.
4. MOAT: what stops the original dev from localizing in a week? Favor dormant/solo originals; add a domain edge
   (your Brazil + CV/real-estate reach, or a local content/community loop) beyond translation.
5. MARKETABILITY in the target: content volume in local social? show-don't-tell in one <15s clip in-language?
   tell-a-friend moment? A proven concept usually ports — confirm the FORMAT ports to local culture.
6. LEGAL: clone the CONCEPT clean-room — never the code, name, icon, or copy.
7. Output the 5-8 best LOCALIZE plays: app, concept, target pop/diff, the WIN reframe, monetization the local way,
   the added edge, and the GROUND-TRUTH gate (in-language fake-door landing page + one local channel's traffic ->
   signups) before building.
`;
    writeFileSync(llmPrompt, prompt);
    console.error('LLM prompt -> ' + llmPrompt);
  }
  console.error('\nNOTE: "no local competitor" = a LOCALIZATION gap (copyable moat), not proof of an empty market. ' +
    'Always answer WHY-not-here before building; validate with an in-language fake-door.');
}

run().catch(e => { console.error('FATAL', e.message); process.exit(1); });
