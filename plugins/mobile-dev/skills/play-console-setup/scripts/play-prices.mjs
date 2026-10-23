#!/usr/bin/env node
// Prints the live Google Play price of apps, for pricing research.
// Usage: node play-prices.mjs <package.id> [package.id ...] [--country US] [--lang en_US]
// For each app: the upfront price (from the store page's structured data), the in-app
// purchase range, rating, and downloads. No API key; one page fetch per app.

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args.splice(i, 2)[1] : fallback;
};
const country = opt('country', 'US');
const lang = opt('lang', 'en_US');
if (args.length === 0) {
  console.error('usage: play-prices.mjs <package.id> [...] [--country US] [--lang en_US]');
  process.exit(2);
}

for (const id of args) {
  const url = `https://play.google.com/store/apps/details?id=${id}&hl=${lang}&gl=${country}`;
  try {
    const res = await fetch(url, {headers: {'User-Agent': 'Mozilla/5.0', 'Accept-Language': lang.replace('_', '-')}});
    if (!res.ok) {
      console.log(`${id}\tnot found (${res.status})`);
      continue;
    }
    const html = await res.text();
    const blocks = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>(.*?)<\/script>/gs)]
      .map((m) => {
        try {
          return JSON.parse(m[1]);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
    const app = blocks.find((b) => b['@type'] === 'SoftwareApplication') ?? {};
    const offer = [].concat(app.offers ?? [])[0];
    const price = offer ? (Number(offer.price) === 0 ? 'free' : `${offer.price} ${offer.priceCurrency}`) : '?';
    // "$0.49 - $2.49 per item" (any currency: a short token, a dash, a short token).
    const iap = (html.match(/[^\s"\[\]>]{1,12} - [^\s"\[\]<]{1,12} per item/) ?? ['no in-app purchases'])[0];
    const rating = app.aggregateRating ? Number(app.aggregateRating.ratingValue).toFixed(1) : '-';
    const downloads = (html.match(/>([\d.,]+[KMB]?\+)<\/div><div[^>]*>Downloads/) ?? [])[1] ?? '?';
    console.log(`${id}\t${app.name ?? '?'}\tprice ${price}\tIAP ${iap}\trating ${rating}\tdownloads ${downloads}\t${url}`);
  } catch (err) {
    console.log(`${id}\terror ${err.message}`);
  }
}
