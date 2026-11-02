// Attaches to the visible Chromium over CDP and runs one step script.
//
//   node run.js <tab-url-substring> <step.js> [args...]
//   node run.js --tabs | --stop
//
// A step script exports `async (page, { ctx, lib, args, shot })`. `page` is the
// first tab whose URL contains the substring (a new tab when none does). The
// browser stays open afterwards: only the CDP connection is dropped. On an
// error the tab is screenshotted and the path printed.
const path = require('path');
const { chromium } = require('playwright-core');
const lib = require('./lib.js');

(async () => {
  const port = process.env.CONSOLE_BROWSER_PORT || '9222';
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  const ctx = browser.contexts()[0];
  try {
    const [first, file, ...args] = process.argv.slice(2);
    if (first === '--tabs') {
      for (const p of ctx.pages()) console.log(`${p.url()}  |  ${await p.title()}`);
      return;
    }
    if (first === '--stop') {
      const session = await browser.newBrowserCDPSession();
      await session.send('Browser.close');
      console.log('browser closed');
      return;
    }
    let page = ctx.pages().find(p => p.url().includes(first));
    if (!page) page = await ctx.newPage();
    await page.bringToFront();
    const shot = (name) => lib.shot(page, name);
    try {
      await require(path.resolve(file))(page, { ctx, lib, args, shot });
    } catch (e) {
      console.log('ERROR ' + e.message.split('\n').slice(0, 6).join('\n'));
      console.log('screenshot: ' + await lib.shot(page, 'error').catch(() => '(none)'));
      process.exitCode = 1;
    }
  } finally {
    // For a CDP-connected browser this only disconnects; the window stays.
    await browser.close().catch(() => {});
  }
})();
