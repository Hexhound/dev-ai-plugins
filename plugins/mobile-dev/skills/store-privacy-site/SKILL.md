---
name: store-privacy-site
description: Use when an app or game needs its public privacy policy page (Google Play / App Store require a live URL even when nothing is collected) — write or check the policy against the code, build the small static site (home page + privacy policy + icon) and publish it on Cloudflare Pages at <app-name>.pages.dev, with the contact email always <app_name>@hexhound.dev. Engine-agnostic (Flutter, Godot, native).
user-invocable: true
---

# Store privacy site on Cloudflare Pages

Every Hexhound app gets the same tiny static site: a home page, the privacy policy and the
icon, deployed as a **classic Cloudflare Pages project**. The live examples are
`data-heist.pages.dev` and `cast-the-bones.pages.dev`; open one before building a new site.

## The names — fixed, never ask

From the app's name (the store title without a subtitle: "Cast the Bones: Dice Battler" →
"Cast the Bones"):

| What | Rule | Example |
|---|---|---|
| Pages project | kebab-case | `cast-the-bones` |
| Site URL | `https://<project>.pages.dev` | `https://cast-the-bones.pages.dev` |
| Policy URL (goes in the Console) | `https://<project>.pages.dev/privacy-policy` | Pages serves `privacy-policy.html` there |
| **Contact email** | **always `<app_name>@hexhound.dev`**, snake_case | `cast_the_bones@hexhound.dev`, `data_heist@hexhound.dev` |
| Custom domain (optional) | `<project>.hexhound.dev` | `risky-climb.hexhound.dev` |
| Copyright | `© <year> HEXHOUND` | |

The email is the same address on the policy, the home page, the store listing's contact
email and any docs. Never use a personal address or a placeholder like `CONTACT_EMAIL`.

## The folder

The site lives in the app's repo, deployed as a whole folder:

```
site/
  index.html            home page
  privacy-policy.html   the policy
  icon.png              192px, from the 512px store icon
```

- **Flutter / native:** `site/` at the repo root.
- **Godot:** inside a folder Godot already ignores, e.g. `docs/store/site/` when `docs/` has
  a `.gdignore`. Don't put a `.gdignore` *inside* the site, or it gets published with it.
- Add `.wrangler/` to the repo's `.gitignore` (wrangler drops a cache in the folder).

## The policy — true to the code

The policy is a claim about the app, so check every sentence against the project before
writing it. Look for:

- **Permissions:** the Android manifest / export preset (INTERNET? camera? storage?).
- **SDKs:** ads (AdMob), analytics / crash reporting (Firebase), billing (Play Billing,
  StoreKit), sign-in, cloud sync. Each one that ships needs its own paragraph: what it
  collects, who runs it, a link to *that provider's* policy.
- **On-device data:** what's saved locally (progress, settings), how to erase it (in-app
  reset, clearing storage, uninstalling).
- **Android backup:** if `allowBackup` is on (the default), Android may back up the saved
  files to the user's Google account. That runs under the
  [Google Privacy Policy](https://policies.google.com/privacy), so link Google's policy there.
  Your contact address is a separate thing and always goes in the Contact section.

Sections, in order: In short (one card) · Who we are · What we collect · What stays on your
device · Android backup (or the SDK sections) · Children · Changes · Contact. Add an
effective date and the package id in the subtitle. If the app ships in more than one
language, the policy repeats in each one on the same page (data-heist has en + pt-BR).

Start the file with a comment saying where it's served:

```html
<!doctype html>
<!--
  <App> — privacy policy, served at https://<project>.pages.dev/privacy-policy
  (Cloudflare Pages serves privacy-policy.html at that path). Deploy the whole site
  folder. Paste the URL into Play Console → Monitor and improve → Policy and programs → App
  content → Privacy policy, and into the listing.
-->
```

## The home page

One screen, no scripts, no external fonts or trackers (the site shouldn't collect anything
either): the icon (96px, `image-rendering: pixelated` for pixel art), a short kicker line, the
app name, a paragraph from the store listing's description, and a footer with
`Privacy policy` (link `privacy-policy`, no `.html`) · the mailto · `© <year> HEXHOUND`, plus
credits for any third-party art the store graphics use (e.g. CC BY phone models). Take the
colors from the app's own theme. First line:
`<!-- <App> — home page, https://<project>.pages.dev (Cloudflare Pages, deploy <site path>/). -->`

Make the icon from the store icon:

```bash
python3 -c "from PIL import Image; Image.open('<512 icon>').resize((192,192), Image.NEAREST).save('<site>/icon.png', optimize=True)"
```

(`Image.LANCZOS` instead of `NEAREST` for non-pixel art.)

## Publish — always the CLI

`scripts/pages.py` (stdlib Python, uses wrangler's login) does everything:

```bash
S=<this skill>/scripts/pages.py
python3 $S create <project>                       # classic Pages project, branch main
python3 $S deploy <project> <site-dir>             # wrangler pages deploy, from inside the folder
python3 $S verify https://<subdomain> --email <app_name>@hexhound.dev   # the URL create printed
python3 $S domain <project> <project>.hexhound.dev # optional custom domain
python3 $S status <project>                        # domain status + the DNS record it needs
```

Steps:

1. **Login.** `npx wrangler@latest whoami`. If it isn't logged in, `wrangler login` needs a
   browser, so ask the user to run `! npx wrangler@latest login`, or start it yourself in the
   background and give them the URL it prints.
2. **Confirm** the project name and URL with the user before the first `create` (the
   `pages.dev` name can't be renamed).
3. `create`, `deploy`, `verify`. All three URLs must return 200 and both pages must contain
   the email. `create` prints the site's real address: `<project>.pages.dev`, unless that name
   was taken and Cloudflare added a suffix. Then use the printed one everywhere below.
4. Replace every placeholder in the app's store docs (listing, Console answers, release
   checklist) with the live policy URL, the site URL and the email.

Redeploy after any edit with the same `deploy` command (or
`cd <site-dir> && npx wrangler@latest pages deploy . --project-name=<project> --branch=main`).

## Gotchas (all hit for real)

- **`wrangler pages project create` makes a Worker** since wrangler 4.147, not a Pages
  project like the others. If one slipped through, show the user the Worker (name, when it
  was made) and **get their yes** that it's the stray one, not a real Worker of theirs with
  that name. Then delete it (`npx wrangler@latest delete --name <project>`) and run the
  script's `create`. Never pass `--force` unless the user asks.
- **A stray `wrangler.jsonc` in the site folder gets published** as a public file. Don't let
  wrangler write config into the site.
- **The OAuth token expires** after about an hour. The API answers `Authentication error`
  (10000); the script refreshes the login with `wrangler whoami` and retries.
- **`pages.dev` returns 403 to Python's default User-Agent.** That's bot protection, not a
  broken deploy. `verify` sends a browser User-Agent.
- **A custom domain added through the API stays `pending`** ("CNAME record not set"): the
  wrangler login can't edit DNS. The user adds the CNAME that `status` prints
  (`<project> → <project>.pages.dev`, proxied) in the hexhound.dev zone, or opens the domain
  under Workers & Pages → project → Custom domains and lets the dashboard add it. Left alone for days it becomes
  `deactivated`. Add the record, then run `domain` again.
- **Use CLI deploys, not the dashboard drag-and-drop**: a drag-and-drop upload doesn't run
  Pages Functions (caremate-share needs them), and the CLI keeps every project the same.
