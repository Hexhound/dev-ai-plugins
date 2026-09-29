// Records a web app (or Electron app) as the capture contract, driven by Playwright.
// Deterministic: the page clock is frozen and advanced one frame per capture.
//
//   import {record} from '<skill>/capture/web/recorder.mjs';
//   await record({url: 'http://localhost:4000', out: 'promo/capture'}, async (rec, page) => {
//     await rec.begin('main');
//     await rec.rect('sidebar', page.locator('nav'));
//     rec.marker('open');
//     await rec.hold(20);
//     await rec.drag([[200, 300], [600, 420]], 30, 'cursor');
//   });
import {chromium} from 'playwright-core';
import {mkdirSync, rmSync, writeFileSync} from 'node:fs';

const round = (v) => Math.round(v * 1e4) / 1e4;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export async function record({url, out, width = 1600, height = 940, scale = 1.5, fps = 30, executablePath = process.env.CHROMIUM, page: given}, script) {
  const browser = given ? null : await chromium.launch({executablePath, args: ['--font-render-hinting=none']});
  const page = given ?? (await (await browser.newContext({viewport: {width, height}, deviceScaleFactor: scale})).newPage());
  await page.clock.install();
  if (url) await page.goto(url, {waitUntil: 'networkidle'});

  let segment = null;
  let count = 0;
  let meta;
  const pending = new Map();
  const dir = () => `${out}/${segment}`;
  const file = (i) => `${dir()}/${String(i).padStart(4, '0')}.png`;
  const flush = () => {
    for (const [name, value] of pending) {
      const series = (meta.tracks[name] ??= []);
      while (series.length < count) series.push(null);
      series.push(value);
    }
    count++;
  };
  const finish = () => {
    if (!segment) return;
    writeFileSync(`${dir()}/capture.json`, JSON.stringify({...meta, frames: count}, null, 2));
    segment = null;
  };

  const rec = {
    page,
    async begin(name) {
      finish();
      segment = name;
      count = 0;
      pending.clear();
      meta = {fps, size: [Math.round(width * scale), Math.round(height * scale)], markers: {}, tracks: {}, rects: {}};
      rmSync(dir(), {recursive: true, force: true});
      mkdirSync(dir(), {recursive: true});
    },
    marker(name) {
      meta.markers[name] = count;
    },
    // Sticky until set again; pass null when the action point goes idle.
    track(name, point) {
      pending.set(name, point ? [round(point[0] / width), round(point[1] / height)] : null);
    },
    value(name, v) {
      pending.set(name, v);
    },
    // A locator or a {x, y, width, height} box in CSS pixels.
    async rect(name, target) {
      const box = typeof target.boundingBox === 'function' ? await target.boundingBox() : target;
      if (!box) throw new Error(`rect ${name}: element not visible`);
      meta.rects[name] = {from: count, rect: [round(box.x / width), round(box.y / height), round(box.width / width), round(box.height / height)]};
    },
    async frame() {
      await page.clock.runFor(1000 / fps);
      await page.screenshot({path: file(count), animations: 'allow'});
      flush();
    },
    async hold(frames) {
      for (let i = 0; i < frames; i++) await rec.frame();
    },
    async animate(frames, step) {
      for (let i = 0; i < frames; i++) {
        await step(ease((i + 1) / frames));
        await rec.frame();
      }
    },
    // Real pointer moves along a path over `frames`, tracked for the camera.
    async drag(path, frames, trackName = 'cursor', {button = true} = {}) {
      const at = (t) => {
        const seg = Math.min(path.length - 2, Math.floor(t * (path.length - 1)));
        const u = t * (path.length - 1) - seg;
        return [path[seg][0] + (path[seg + 1][0] - path[seg][0]) * u, path[seg][1] + (path[seg + 1][1] - path[seg][1]) * u];
      };
      await page.mouse.move(...path[0]);
      rec.track(trackName, path[0]);
      if (button) await page.mouse.down();
      await rec.animate(frames, async (t) => {
        const p = at(t);
        await page.mouse.move(p[0], p[1], {steps: 4});
        rec.track(trackName, p);
      });
      if (button) await page.mouse.up();
    },
    finish,
  };

  try {
    await script(rec, page);
  } finally {
    finish();
    await browser?.close();
  }
}
