---
description: Drive Google AdMob and Play Console in a visible Chromium you sign into, for the steps their APIs can't do (AdMob apps, ad units, consent messages, app-ads.txt checks; Play's Advertising ID, Data safety, content rating, target audience).
argument-hint: [what to do, e.g. "create a native ad unit for Data Heist" or "Advertising ID declaration"]
---

Invoke the **google-console-browser** skill for: $ARGUMENTS

1. Launch the browser (`scripts/console_browser.sh launch`) and ask the developer to sign in
   to the Google account that owns the consoles; wait for their "done". Never handle a
   password.
2. Read the page first (text, then a screenshot when needed), then fill what was asked.
3. Show the values before anything outward-facing (create, publish, save a declaration,
   send for review) unless the developer already approved that exact change, and read the
   page back after saving.
4. Prefer the Play Developer API (`play-publish`) for builds, listings, screenshots and
   contact details.

Task: $ARGUMENTS
