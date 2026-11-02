// Helpers for step scripts (passed in as `lib`). Prefer reading text over
// screenshots: a page's innerText is a few hundred bytes, a screenshot is an
// image to look at. Screenshot when a click "did nothing" or before a save.
const fs = require('fs');
const path = require('path');

const home = () => process.env.CONSOLE_BROWSER_HOME || path.join(require('os').homedir(), '.cache/console-browser');

/** Visible text of a page, frame or locator as one ` | `-joined line, from the first line matching `from`. */
exports.text = async (scope, { from, max = 3000 } = {}) => {
  const target = scope.locator ? scope.locator('body') : scope;
  const lines = (await target.innerText()).split('\n').map(s => s.trim()).filter(Boolean);
  const i = from ? Math.max(0, lines.findIndex(l => from.test(l))) : 0;
  return lines.slice(i).join(' | ').slice(0, max);
};

/** The first frame whose URL contains `part` (AdMob's Privacy & messaging lives in one). */
exports.frame = (page, part) => page.frames().find(f => f.url().includes(part)) || null;

/** The visible label of a checkbox or radio (Angular Material wraps the input). */
exports.label = (loc) => loc.evaluate(e =>
  (e.closest('material-checkbox, mat-checkbox, material-radio, mat-radio-button, label') || e.parentElement)
    .innerText.trim().split('\n')[0].trim());

/** Every checkbox and radio in `scope`, with its index, label and state. */
exports.controls = async (scope) => {
  const out = [];
  for (const role of ['checkbox', 'radio']) {
    const all = scope.getByRole(role);
    for (let k = 0; k < await all.count(); k++) {
      const c = all.nth(k);
      out.push({ role, index: k, label: await exports.label(c), checked: await c.isChecked().catch(() => null) });
    }
  }
  return out;
};

/** Ticks the checkboxes in `scope` whose label is in `labels` (never unticks). */
exports.tick = async (scope, labels) => {
  const boxes = scope.getByRole('checkbox');
  const done = [];
  for (let k = 0; k < await boxes.count(); k++) {
    const b = boxes.nth(k);
    const l = await exports.label(b);
    if (labels.includes(l)) { if (!(await b.isChecked())) await b.click(); done.push(l); }
  }
  return done;
};

/** Opens a Play Console accordion section ("Show"/"Hide" next to its title). Only one stays open. */
exports.expand = async (page, title) => {
  const header = page.locator(`xpath=//*[normalize-space(text())="${title}"]`).first();
  await header.scrollIntoViewIfNeeded();
  const state = await header.evaluate(h => {
    let x = h;
    for (let i = 0; i < 6 && x; i++) {
      x = x.parentElement;
      const t = [...x.querySelectorAll('*')].find(e => e.childElementCount === 0 && /^(Show|Hide)$/.test(e.textContent.trim()));
      if (t) { if (t.textContent.trim() === 'Show') t.click(); return t.textContent.trim(); }
    }
    return null;
  });
  await page.waitForTimeout(1200);
  return state;
};

/** Clicks the `action` button ("Manage", "Start", "Edit"…) on the list row whose text contains `rowText`. */
exports.rowAction = async (page, rowText, action) => {
  const buttons = page.getByText(action, { exact: true });
  for (let k = 0; k < await buttons.count(); k++) {
    const row = await buttons.nth(k).evaluate(e => {
      let x = e;
      for (let i = 0; i < 8; i++) { x = x.parentElement; if (x.innerText.length > e.innerText.length + 10) break; }
      return x.innerText;
    });
    if (row.includes(rowText)) { await buttons.nth(k).click(); return true; }
  }
  return false;
};

/** Saves a viewport screenshot under CONSOLE_BROWSER_HOME and returns its path. */
exports.shot = async (page, name = 'shot', fullPage = false) => {
  fs.mkdirSync(home(), { recursive: true });
  const file = path.join(home(), `${name}.png`);
  await page.screenshot({ path: file, fullPage });
  return file;
};
