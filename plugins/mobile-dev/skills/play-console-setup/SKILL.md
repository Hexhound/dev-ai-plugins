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

## The Console's layout changed (2026): use the new names

Google redesigned Play Console's navigation. The old click paths ("Policy → App content",
"Release → Testing", "Grow → Store presence", "All apps → Settings") send the user hunting for
menus that are gone. **Every instruction uses the new layout**, and a path that can't be
confirmed says so.

Inside an app, the left navigation (read off a screenshot, 2026-10-24):

| Section | What lives there |
|---|---|
| Dashboard · Statistics · Publishing overview · Protected with Play | overview, the review status ("In review"), integrity |
| **Test and release** | production, the testing tracks (internal, closed, open), app bundles, setup |
| **Monitor and improve** | vitals, ratings and reviews, and policy: **App content** (privacy policy, ads, advertising ID, data safety, target audience…) |
| **Grow users** | store presence: store listings and their translations, store settings (category, contact details) |
| **Monetize with Play** | products (one-time products, subscriptions), promotions / promo codes, orders |

Outside an app (account level): **Home** (all apps, *Create app*) and **Manage account** (users
and permissions, account settings such as *License testing*).

Rules:
- Give paths with these section names. For a page inside a section that no screenshot has
  confirmed yet, name the section and add: "if it isn't there, type the page's name in the
  Console's search box at the top". Never present a guessed path as certain.
- When the user sends a Console screenshot, read the real labels off it and correct this map:
  add the path to *Confirmed paths* below, with the date.
- **Confirmed paths:**
  - the sections above (2026-10-24);
  - **Data safety** is a page of App content, under **Monitor and improve** (2026-10-24). The
    form has five steps: Overview → Data collection and security → Data types → Data usage and
    handling → Preview, with **Export to CSV / Import from CSV** at the top. On its second step:
    collect or share (yes / no), encrypted in transit, the account-creation methods (tick "My app
    does not allow users to create an account" for an app without accounts), and optional badges.
  - **Monetize with Play** opens into: **Products** (App pricing · **One-time products** ·
    Subscriptions · Play Points), Merchandising and optimization, Price experiments, Promo codes,
    Financial reports, Monetization setup (2026-10-24).
  - **One-time products stays locked until a build with the BILLING permission is uploaded**:
    the page says "Your app doesn't have any one-time products yet. To add one-time products, you
    need to add the BILLING permission to your APK" (2026-10-24). So the order is: publish the
    first build that has Play Billing (internal testing is enough), *then* create the product.
    The app must cope with the product missing meanwhile (say "not on sale yet", don't crash).

## The forms and their fields (Console as of 2026)

### Create app (Home → Create app)
- **App name**: 30 chars max (shown in the store; can change later).
- **Default language**; **App or game**; **Free or paid** — a free app can never become
  paid (a free app with an in-app unlock is free here).
- Declarations: developer policies, US export laws — tick.

### Main store listing (Grow users → Store presence → Main store listing)
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

### Store settings (Grow users → Store presence → Store settings)
- **Category**: app or game, and the category (e.g. Games → Puzzle / Casual); up to 5
  **tags**.
- **Contact details**: email (required, public), website and phone (optional). An app with
  **AdMob needs the website**: AdMob looks for `app-ads.txt` at the root of the site named
  here (the same `google.com, pub-…, DIRECT, f08c47fec0942fa0` line for every app of the
  account); without it the app's ads are limited.

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
- **Review it through the API** when the user asks to check it (the publisher service account can
  read it): `GET androidpublisher/v3/applications/<package>/oneTimeProducts/<productId>` returns
  the listings per language, each purchase option's `state` (`ACTIVE`), `buyOption.legacyCompatible`
  (= the Console's *Backwards compatible*) and every region's price and availability. The old
  `/inappproducts` answers 403 "Please migrate to the new publishing API". The icon isn't in the
  answer. Check the automatic prices of low-purchasing-power markets (India, Indonesia): Play's
  conversion often lands *above* the US price there.
- **Save**, then **Activate**. The app must be on a testing track (internal is enough) with
  the billing permission before the store returns the product, and testers must be **license
  testers** (Manage account → Settings → License testing) to buy for free.

### App content (Monitor and improve → Policy and programs → App content)
- **Privacy policy**: a public URL, required even when the app collects nothing.
- **Ads**: does the app show ads (any kind, including house ads)?
- **App access**: is everything reachable without a login? If not, give test credentials.
- **Content rating**: the IARC questionnaire (violence, gambling, user interaction, …).
- **Target audience and content**: the age groups. Choosing under-13 brings in the Families
  policy (stricter rules on ads, purchases, data); a cute look can make a reviewer ask
  whether the app also appeals to children — answer that part honestly.
- **Data safety**: what's collected and shared. Google Play Billing purchases are handled by
  Google; follow the form's help text for purchase history. Crash or analytics SDKs count.
  **With AdMob**, take the data types from Google's disclosure for the SDK the build really uses
  (the GMA Next-Gen SDK has its own page: admob/android/next-gen/privacy/play-data-disclosure).
  As of 2026-10 it lists four, collected **and** shared, for advertising, analytics and fraud
  prevention, encrypted in transit: Approximate location (the IP address), App interactions,
  Diagnostics, Device or other IDs. Not crash logs.
  **Prefer the CSV over clicking:** have the user press *Export to CSV* on the Data safety page
  (the question ids are Google's; never write the file from memory), fill it by
  `(Question ID, Response ID)` with code, and give it back for *Import from CSV*. The format:
  `true` on each chosen option (checkboxes and single choices), `true` / `false` for a yes/no row
  without a response id (e.g. `…:PSL_DATA_USAGE_EPHEMERAL`), empty for everything else; CRLF line
  endings, minimal quoting. The AdMob answers map to `PSL_APPROX_LOCATION`, `PSL_USER_INTERACTION`,
  `PSL_PERFORMANCE_DIAGNOSTICS`, `PSL_DEVICE_ID`, each with `PSL_DATA_USAGE_ONLY_COLLECTED` +
  `PSL_DATA_USAGE_ONLY_SHARED` (both), `PSL_DATA_USAGE_USER_CONTROL_REQUIRED`, and the purposes
  `PSL_ADVERTISING`, `PSL_ANALYTICS`, `PSL_FRAUD_PREVENTION_SECURITY`; no accounts =
  `PSL_SUPPORTED_ACCOUNT_CREATION_METHODS / PSL_ACM_NONE`. Save the filled CSV in the project's
  store folder. The same CSV goes through the API (`applications.dataSafety`) when the service
  account may manage policy declarations. (Cast the Bones' `docs/store/src/fill_data_safety.py`
  is a working example.)
- **Advertising ID**: **Yes** when the build carries `com.google.android.gms.permission.AD_ID`
  (AdMob and Firebase Analytics merge it in); tick the same purposes as Data safety
  (advertising, analytics, fraud prevention). **A build with that permission is refused at
  upload while this says No**: "This release includes the com.google.android.gms.permission.AD_ID
  permission but your declaration on Play Console says your app doesn't use advertising ID". No
  API changes this form: the user saves it in the Console, then the upload goes through.
- **News app**, **Government app**, **Financial features**, **Health**: answer each (usually no
  for a game).

### Test purchases (testers buy for free)

Testers get paid content by buying it with a **test card that always approves** — no money
changes hands. Only **license testers** see test cards. Steps for the README:

1. **License testers**: leave the app (Home or **Manage account**) → **Settings → License testing** → under
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
5. **Repeat a test**: Play Console → **Monetize with Play → Order management** (or the search box) → the test order → **Refund** and
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

### Testing and release (Test and release → Testing)
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
