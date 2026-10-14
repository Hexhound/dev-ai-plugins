---
name: generate-hi3d-model
description: Use when the user wants hi3d.ai (Hi3D) to turn an image into a 3D model and wants the resulting GLB as a file — e.g. to compare a new model's output against a ground-truth mesh. Signs up a throwaway account, uploads the image, waits for the generation and saves the exact GLB the site's viewer loads, with a preview.
user-invocable: true
---

# Generate a 3D model on hi3d.ai and save it

`scripts/hi3d-generate` (in this skill's directory) does the whole run in a headless
chromium, with no input from the user:

1. creates a disposable inbox on [mail.tm](https://mail.tm) (free REST API, no key) and
   signs up a **new** hi3d account with it (110 free credits; one generation costs 65);
2. uploads the image on `/workspace?panel=generate-3d` with the site's default settings
   (v3.0, Quality, Geometry + Stylized Texture) and clicks Generate;
3. waits for it (≈8–10 min) and captures the GLB the viewer downloads from the CDN, the
   same bytes the page renders.

It uses the current PATH when `asset-extract-deps` is installed, and otherwise builds the
deps (node, chromium, playwright-core) from the plugin's `nix/deps.nix` with nix-shell.

## 1. Inputs

Get from the user, asking for whatever they didn't give:

- **the image**: JPG, PNG or WEBP, at most 20 MB;
- **where to save**: a directory (the model is saved as `<image name>.glb` inside it) or a
  `.glb` path.

## 2. Run it

It takes about 10 minutes, so run it in the background and wait for it to finish rather
than polling:

```bash
scripts/hi3d-generate --image <image> --out <dir/ | file.glb>
```

stderr is the progress log (inbox, code, `generating N%`, saved path); stdout is one JSON
line `{"model", "meta", "viewer", "bytes"}`. Next to the model it writes:

| File | What |
|---|---|
| `<name>.glb` | the model, checked to be a complete binary glTF |
| `<name>.meta.json` | source image, hi3d task id, CDN URL, sha256, the mail.tm login, run time |
| `<name>.viewer.png` | the site's viewer showing the finished model |

To let the user watch, add `--headed --keep-open`: the browser stays on the result until
they close it. That opens a window on their screen, so only do it when they ask.

## 3. Check it and hand it over

Inspect it with the sibling skill's tool:

```bash
../extract-browser-3d-model/scripts/browser-models info <model.glb>
../extract-browser-3d-model/scripts/browser-models preview <model.glb> -o <scratch>/preview.png
```

Read the preview PNG (a point splat, so speckle is expected) and confirm it is the
subject of the image. Report the model path, triangle count and texture sizes, and show
the preview and `viewer.png`. hi3d's GLBs are plain (no meshopt/Draco), so they load
directly in Blender and mesh-comparison tools.

## When it fails

The script saves `<name>.failure.png` and logs the inbox login before exiting non-zero.

| Symptom | Cause / fix |
|---|---|
| `no verification code reached …` | hi3d sometimes accepts the send but never delivers; the script already resent twice. Run it again. If it keeps failing, mail.tm's current domain may be blocked: check `curl https://api.mail.tm/domains` |
| Timed out on the login dialog, Generate button, or a click | The site's UI changed (it A/B tests the login dialog and adds promo pop-ups). Open the failure screenshot; update the selector or add a `page.addLocatorHandler` for the new pop-up in `hi3d_generate.mjs` |
| `generation not finished after 20 min` | Queue is slow; rerun with `--timeout-min 40` |
| `the viewer never fetched a .glb` | The CDN path no longer matches `MODEL_URL`; record the page's responses to find the new one |

Every run creates an account named `hi3d-<hex>@<mail.tm domain>`. Don't loop it more
than needed: each one is a real sign-up on production.
