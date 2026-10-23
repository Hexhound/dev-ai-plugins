---
name: play-console-setup
description: Use when publishing an Android app or game on Google Play, or whenever the user is filling a Play Console form (create app, store listing, graphics, store settings, in-app product, purchase option, pricing, app content, testing tracks) — give the exact value for every field, checked against its limit, plus a researched price recommendation from comparable apps. Engine-agnostic (Flutter, Godot, native).
user-invocable: true
---

# Google Play Console, field by field

The user should never have to guess what goes into a Play Console field. Whenever a Play
Console form comes up — a screenshot of it, a question about it, or a release step that
leads to it — answer with **every field of that screen**, ready to copy, and the files to
upload. Never answer with only the field that was asked about.

## At the start of a release: a promo video?

When a release begins (a first publish or an update going to Production), before any form,
ask the user one question: **"Do you want to generate a promo video?"** — with the options:

- **Make a new promo video**: run the `promo-video` skill (the promo-video plugin) for the
  app.
- **Re-shoot the existing one**: the app already has a promo (`promo/out/`, or the store
  folder's `promo/`) and its look has changed since (new art, characters, UI): run the
  `promo-video` skill's RESHOOT steps (same cut, new footage).
- **Not now**: no video for this release.

Make the video while the forms are filled; it takes a while (capture, review, render). When
it is done, the store listing's **Video** field takes its YouTube link (upload it public or
unlisted, ads off, embedding on); give the user the upload text too. If the promo-video
plugin isn't installed, say so and how to add it, and carry on without the video.

## The output, every time

For each screen, a table:

| Field | Value | Rule / note |
|---|---|---|
| exact field label from the Console | the text to type, or the file path to upload | its limit, why this value, what can't change later |

- **Values come from the project, not invented.** Product IDs come from the code (grep the
  billing code); package name, version code and name from the build config; texts from the
  app's own copy (store listing drafts, strings); files from the repo (icon, screenshots).
  If a value is a business decision (price, audience, contact email), recommend one, say
  why, and mark it as the user's call.
- **Check every limit with code** (`len()` of each text), and say the count:
  "`Full Game: All 7 Modes` (22/55)".
- Flag the fields that **can never be changed** (product ID, purchase option ID, package
  name, app free/paid) before the user saves.
- Say what comes **next** (the next screen or step), and what makes the step fail
  (e.g. a product the store can't find until the app is on a testing track).
- **Save** the values in the project (next to the store art, e.g. `play_store/listing.md`
  or `store/play-console.md`), so the next form or release reuses them.
- **An app with in-app purchases always gets a "Test purchases" section in its store README**
  (the project's Play publishing guide), written from *Test purchases* below with the app's own
  product IDs, tester groups and feedback email — even when the user didn't ask, the first time
  a product or a testing track comes up. Testers must never be stuck at a paywall.

## The forms and their fields (Console as of 2026)

### Create app (All apps → Create app)
- **App name**: 30 chars max (shown in the store; can change later).
- **Default language**; **App or game**; **Free or paid** — a free app can never become
  paid (a free app with an in-app unlock is free here).
- Declarations: developer policies, US export laws — tick.

### Main store listing (Grow → Store presence → Main store listing)
- **App name** 30 · **Short description** 80 · **Full description** 4000 chars.
- **App icon**: 512×512, 32-bit PNG, ≤ 1 MB (the same art as the launcher icon).
- **Feature graphic**: 1024×500, JPEG or 24-bit PNG, no transparency.
- **Phone screenshots**: 2–8, JPEG or 24-bit PNG without alpha, each side 320–3840 px, the
  long side ≤ 2× the short side (1080×1920 or 1080×2160 is safe; ≥ 1080 px for featuring).
- **7-inch / 10-inch tablet screenshots**: up to 8 each, same rules — required when the
  build declares tablet support (large / xlarge screens).
- **Video**: a YouTube URL (public or unlisted, ads off, landscape recommended) — the promo
  from the release's first question, if the user chose to make one.
- Graphics rules: no price or promotion words ("free", "sale", "#1", "best", rankings,
  awards you can't prove), no Google Play badge or device art that misleads, text legible.
  Store art made with the `store-screenshots` skill already follows these.

### Store settings (Grow → Store presence → Store settings)
- **Category**: app or game, and the category (e.g. Games → Puzzle / Casual); up to 5
  **tags**.
- **Contact details**: email (required, public), website and phone (optional).

### In-app one-time product (Monetize with Play → Products → One-time products → Create)
Step 1, *Product details*:
- **Product ID**: exactly the ID in the code. Starts with a lowercase letter or number;
  lowercase letters, numbers, `_` and `.`. **Never changeable, never reusable**, even after
  deletion.
- **Tags**: optional, internal (lowercase, ≤ 20 chars).
- **Name**: 55 chars, shown in the purchase sheet — the benefit, not the app name
  ("Full Game: All 7 Modes", "Remove ads").
- **Description**: 200 chars, what the purchase unlocks.
- **Icon** (optional): 32-bit PNG, ≤ 8 MB, 1:1, 512–1080 px a side; **unique to the
  product, no text, no promotions, no branding** — so not the app icon. Make one with the
  app's own art (render it like the store art; save it as RGBA).

Step 2, *Availability and pricing*:
- **Purchase option ID**: ≤ 63 chars, lowercase letters, numbers, hyphens; users never see
  it; **never changeable**. Use `buy` for a plain one-time unlock.
- **Purchase type**: **Buy** (Rent is for time-limited access).
- **Advanced options → Backwards compatible: ON.** A client that buys *without naming a
  purchase option* gets the backwards-compatible one: the GodotGooglePlayBilling plugin
  called with an empty `purchase_option_id`, the Flutter `in_app_purchase` plugin, any
  Billing Library < 8 client. Without it the purchase can't start. Leave multi-quantity off
  for an unlock.
- **Availability and pricing**: *Set prices → Bulk edit pricing*: all regions, one price in
  the default currency; Play converts it to every local currency with local price endings.
  Optionally lower it by hand in low-purchasing-power markets (Brazil, India, Indonesia…).
- **Save**, then **Activate**. The app must be on a testing track (internal is enough) with
  the billing permission before the store returns the product, and testers must be **license
  testers** (Settings → License testing) to buy for free.

### App content (Policy → App content)
- **Privacy policy**: a public URL, required even when the app collects nothing.
- **Ads**: does the app show ads (any kind, including house ads)?
- **App access**: is everything reachable without a login? If not, give test credentials.
- **Content rating**: the IARC questionnaire (violence, gambling, user interaction, …).
- **Target audience and content**: the age groups. Choosing under-13 brings in the Families
  policy (stricter rules on ads, purchases, data); a cute look can make a reviewer ask
  whether the app also appeals to children — answer that part honestly.
- **Data safety**: what's collected and shared. Google Play Billing purchases are handled by
  Google; follow the form's help text for purchase history. Crash or analytics SDKs count.
- **Advertising ID**, **News app**, **Government app**, **Financial features**, **Health**:
  answer each (usually no for a game).

### Test purchases (testers buy for free)

Testers get paid content by buying it with a **test card that always approves** — no money
changes hands. Only **license testers** see test cards. Steps for the README:

1. **License testers**: leave the app (All apps) → **Settings → License testing** → under
   *License testers* pick **Google Groups** or email lists → add the testers → Save. The
   developer account itself is always a license tester. Leave *License response* alone (it's
   for the old licensing library).
   - **The list is account-wide**: its members can buy *every* app of the developer account
     for free, production builds included. Warn the user whenever a group looks public
     (e.g. a `testers-community@googlegroups.com` swap group for the 12-tester requirement):
     use promo codes for those testers instead.
2. **The product is active** (purchase option active, backwards compatible) and the build is
   rolled out on the track whose *Testers* tab has the same groups (plus a feedback email).
3. **Testers join** through the track's join link and **install from the Play Store** with the
   same Google account. A sideloaded APK/debug build can't buy.
4. **They buy**: the purchase sheet lists *Test card, always approves* (the full unlock),
   *Test card, always declines* (test the failure message), *Slow test card, approves / declines
   after a few minutes* (test pending purchases).
5. **Repeat a test**: Play Console → **Order management** → the test order → **Refund** and
   remove the entitlement; the app must notice on its next ownership check (launch/resume).
   A test purchase the app never acknowledges is refunded by Google after ~3 minutes.
6. **Real payment methods instead of test cards?** Close the sheet without buying. The Play
   Store caches the account's tester status: clear the **Play Store's** storage (Settings →
   Apps → Google Play Store → Storage → Clear cache / Clear data, or
   `adb shell pm clear com.android.vending`), open the Play Store once, then the app — the
   sheet then shows *Test card, always approves* and "this is a test order". Verified on a real
   device right after adding the groups. If it still fails: the account isn't in the group,
   the change hasn't propagated yet, the Play Store uses another account, or the app wasn't
   installed from Play. Clearing Play Store data also resets its own settings (auto-update,
   parental-control PIN) — say so before doing it over adb.

**Testers outside the license list** (strangers, community groups): **promo codes** — Monetize
with Play → Promotions / Promo codes → a promotion for the one-time product (its *Buy* option
active) with one code per tester; they redeem it in the Play Store (profile → Payments &
subscriptions → Redeem code). Up to **500 codes per quarter** for an app's one-time products,
lost if unused. The app must handle purchases made outside its own flow (query purchases at
launch/resume and acknowledge them) — the `flutter-remove-ads-iap` service and the Godot
billing plugin's reconcile both do.

### Testing and release
- **Internal testing**: up to 100 testers, minutes to go live — where purchases are tested.
- **Closed testing**: personal developer accounts created after 13 Nov 2023 need **12
  testers opted in for 14 days** before they can apply for production.
- **Production**: create a release with the AAB; the first review takes days.
- Every upload needs a new **version code**.

## Price research (every time a price is asked for)

Recommend a price from evidence, not instinct:

1. **Pick 4–8 comparables**: same genre and look, same business model when possible
   (free-to-try + unlock, paid upfront, free + ads), plus the genre's best-known title.
   Search the web for them, then read the live price from their store pages:
   `node <this skill>/scripts/play-prices.mjs <package.id> …` prints each app's current US
   price, its in-app purchase range, rating and downloads, from the Play page's own data. Note when a
   price is a sale (press coverage of the list price helps: "usually $4.99").
2. **Place the app**: more content than the comparable → up a step; free-to-try (players
   already got value free) → an impulse price; a crowded free-with-ads genre → keep the
   unlock an easy yes.
3. **Recommend one price** with a short table of the comparables (app, model, price,
   source link) and the reasoning; give the step above and below as alternatives, and say
   it can be tested later (Play price experiments, sales via promotions).

Keep the sources: end the answer with the links used.
