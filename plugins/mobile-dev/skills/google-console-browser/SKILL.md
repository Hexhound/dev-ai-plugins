---
name: google-console-browser
description: Use when a Google AdMob or Google Play Console change has no API, or the API refuses it — creating an AdMob app or ad unit, the European regulations (GDPR) consent message, app-ads.txt verification, Play's Advertising ID declaration, Data safety, content rating, target audience, Ads declaration, Publishing overview — or when the Play service account lacks a permission. Drives the real consoles in a visible Chromium the developer signs into themselves, with Playwright attached over the DevTools port; the developer watches and approves. Also use when a Play API call fails with "your declaration on Play Console says…".
user-invocable: true
---

# AdMob and Play Console in the browser

The Play Developer API (the `play-publish` skill) uploads builds, edits listings, contact
details and screenshots, and posts Data safety as CSV. It has **no** endpoint for the
Advertising ID declaration, content rating, target audience or the Ads declaration, and
AdMob has no general write API at all (apps, ad units, privacy messages, app-ads.txt
checks). For those, drive the consoles themselves: a real Chromium on the developer's
screen, signed in by the developer, with Playwright attached over CDP. The developer
follows along and approves; you do the clicking and typing.

Use the API whenever it can do the job: it is exact and leaves a log. Come here for what
it can't, and when it answers with a Console-only error, for example:

> This release includes the com.google.android.gms.permission.AD_ID permission but your
> declaration on Play Console says your app doesn't use advertising ID.

## Rules

- **The developer signs in, never you.** Launch the browser, ask them to sign in to the
  Google account that owns AdMob and Play Console, and wait for their "done". Never ask
  for, type or store a password or a 2FA code.
- **Confirm before anything outward-facing** unless the developer already approved that
  exact change in this conversation: creating an app or ad unit, publishing a consent
  message, saving a declaration, sending changes for review, rolling out a release. Show
  what you will enter (the values, the checkboxes) and get a yes. Reading is free.
- **Never** delete apps or ad units, touch payments, tax, users and permissions, or
  account settings, and never tap a live ad.
- **Read back after every save** (the page's text or the API) and report what the console
  now says, not what you meant to set.
- The browser profile keeps the Google session. It lives in
  `~/.cache/console-browser/profile`; deleting that folder signs out. Never copy it
  anywhere or commit it.

## Setup

Needs Chromium or Chrome and Node 18+ on PATH. The script installs `playwright-core` (no
bundled browsers) into `~/.cache/console-browser` on first use.

```bash
S=<this skill>/scripts/console_browser.sh
$S launch            # visible Chromium on :9222 with AdMob and Play Console open
                     # (pass URLs to open others); reuses a browser already up
$S status            # the open tabs
$S run <tab> step.js # run a step script against the first tab whose URL contains <tab>
$S stop              # close it when the work is done (ask first; the developer may want it)
```

The browser is started like a normal one and Playwright only **attaches** to it: Google
refuses to sign in a browser that Playwright launched ("This browser or app may not be
secure"). Detaching (`browser.close()` on a CDP connection) leaves the window open.

## Working

Write one small step script per action in a scratch folder (not in the project, not in
this skill), run it, read its output, then write the next. A step script:

```js
// step.js — run with: console_browser.sh run admob.google.com step.js
module.exports = async (page, { ctx, lib, args, shot }) => {
  await page.goto('https://admob.google.com/v2/apps/list', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6000);                 // the consoles render late
  console.log(await lib.text(page, { from: /^App$/, max: 1500 }));
};
```

`lib` (scripts/lib.js): `text(scope, {from, max})` page text as one line,
`frame(page, urlPart)`, `controls(scope)` every checkbox/radio with index, label and
state, `tick(scope, labels)`, `expand(page, title)` for Play's Show/Hide accordions,
`rowAction(page, rowText, 'Manage')` for list rows whose buttons aren't links,
`shot(page, name)` a screenshot path under `~/.cache/console-browser`.

- **Text first.** Print `lib.text` and `lib.controls` to find what is on the page; take a
  screenshot (and look at it) when a click seems to do nothing, before a final save, and
  to show the developer the result.
- Both consoles are Angular Material. Buttons are often `material-button` with an
  `aria-label` rather than a `<button>`; checkboxes and radios have `role` but their label
  is in the wrapper (`lib.label`). `getByRole('button', { name })` misses some of them:
  fall back to `getByText(name, { exact: true })` or the `aria-label` selector.
- A locator that "isn't visible" usually has a twin hidden in a closed menu; scope it to
  the dialog (`page.locator('[role="dialog"]').last()`) or the row.
- Wait after each navigation or click that loads (`waitForTimeout(3000–8000)`); there is
  no reliable network-idle on these consoles.

## AdMob (admob.google.com/v2)

- **Apps list**: `/v2/apps/list` shows each app's ID (`ca-app-pub-…~…`), approval status
  ("Requires review · Limited ad serving · Verify app to lift limit") and its ad units.
  The app's own pages are `/v2/apps/<numeric id>/…`.
- **Ad unit**: `/v2/apps/<id>/adunits/list` → Get started / Add ad unit. The format
  cards' "Select" are `material-button[aria-label="Native advanced"]` (Banner,
  Interstitial, Rewarded…). Name field, then **Advanced settings** → Media type
  Image/Video checkboxes (keep Image only for Google's small native template, which has no
  media view). **Create ad unit** shows both the app ID and the unit ID
  (`ca-app-pub-…/…`): copy them from the page text.
- **European regulations message**: Privacy & messaging → European regulations. The list
  page renders inside an iframe (`lib.frame(page, 'display-ads-user-messaging-embed')`);
  **Create message** opens the editor back in the main frame.
  - *Select apps* lists every app with its privacy policy URL; an app without one shows
    "Add URL": click that cell, fill the input that appears, **Save**, then tick the row.
  - Name field: `input[aria-label="Input for name of the message"]`.
  - Additional languages: Portuguese is offered only as pt-PT (right for an EEA message).
  - **Publish stays disabled until "Do not consent" is set** (On or Off) explicitly.
  - Read the list afterwards: the new message should say *Published*.
- **app-ads.txt**: Apps → the app → *Verify app* → **Check for updates**. AdMob reads
  `https://<the Play listing's Website>/app-ads.txt`. "Your details don't match" usually
  means the file is missing and the host answered with its index page (Cloudflare Pages
  does that, with status 200), or the Play listing has no Website. The crawl can take up
  to a day after a fix; don't spam the button.

## Play Console (play.google.com/console)

- The first page may be *Choose developer account*: click the account name.
- The app's ID is not the package name. Find it in the dashboard links: the card holding
  the package name contains `a[href*="/app/<numeric id>/app-dashboard"]`. Pages are
  `/console/u/0/developers/<dev id>/app/<app id>/…`.
- **App content** (`…/app-content/overview`): finished declarations are under the
  **Actioned** tab (`getByRole('tab', { name: 'Actioned' })`); each row's **Manage** is a
  button, so use `lib.rowAction(page, 'Data safety', 'Manage')`.
- **Advertising ID** (`…/app-content/ad-id-declaration`): radio Yes, then the purposes
  (App functionality, Analytics, Developer communications, Advertising or marketing, Fraud
  prevention…, Personalization, Account management). For the Google Mobile Ads SDK:
  Advertising or marketing, Analytics, Fraud prevention. **Leave "Turn off release errors"
  unticked.** Save → a "Go to Publishing overview?" dialog → *Not now* if more forms follow.
- **Data safety** (`…/app-content/data-privacy-security`), a 5-step wizard (or *Import
  from CSV*, or the API's `applications.dataSafety`):
  1. Overview → Next.
  2. Collect or share? / encrypted in transit / account creation / outside logins /
     deletion request. The radios' DOM order isn't their visual order: print
     `lib.controls` after each answer, since new questions appear as you go.
  3. Data types: an accordion where opening a section closes the others, and only the
     open section's checkboxes exist. Do one section at a time: `lib.expand`, then
     `lib.tick`.
  4. Each data type: **Start** opens a dialog. Collected / Shared checkboxes reveal
     *ephemeral* and *required/optional* radios plus two purpose lists (collection first,
     then sharing, each in the order above). Save each dialog.
  5. Preview → **Save**.
- **Publishing overview** (`…/publishing`): with *Managed publishing off*, saved changes go
  to review on their own after quick checks (up to ~15 min). With it on, the developer
  sends them for review here: confirm first.
- Listing text, screenshots, contact details and releases: use the API (`play-publish`)
  instead. It's faster and it can be verified.

## When done

Report what changed in each console and what each now shows, what still waits on Google
(review, crawls), and leave the browser open or `stop` it as the developer prefers.
