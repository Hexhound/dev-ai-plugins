---
name: extract-browser-3d-model
description: Use when the user wants a 3D model that is showing in one of their browser tabs (an AI image-to-3D generator like Tripo/Hi3D/Meshy, a product viewer, a model gallery) saved as a file — GLB/glTF/FBX/OBJ/STL — e.g. to open it in Blender. Pulls it from a Zen/Firefox-family browser's disk cache without touching the browser, unpacks compression Blender can't read, and can unpack textures and render a preview.
user-invocable: true
---

# Extract a 3D model from a browser tab

A web 3D viewer downloads the whole model file before it can draw it, so the file is
almost always sitting in the browser's HTTP disk cache. Read it from there. **Never drive,
screenshot or relaunch the user's browser**, and never start it with their profile (it
would hand the URL to their running copy): everything here reads files on disk.

Supported: Zen, Firefox, LibreWolf, Floorp, Waterfox (Firefox `cache2` format). Chromium
browsers use a different cache format and are not supported.

All commands go through `scripts/browser-models` in this skill's directory. It uses
the current PATH when `asset-extract-deps` is installed, and otherwise builds the deps
from the plugin's `nix/deps.nix` with nix-shell (slow the first time only). The profile
defaults to the most recently used one; pass `--profile <dir or name>` /
`--cache <cache2 dir>` before the subcommand to override.

## 1. Find the tab

```bash
browser-models tabs --limit 15        # most recently used first; --grep '3d|model' to filter
```

Confirm with the user which tab is meant if more than one could be it. Note its site.

## 2. Find the model in the cache

```bash
browser-models scan --since 120       # model-like entries from the last 2 hours, oldest first
```

Each row: hash, cache time, size, kind (by magic bytes, content type or extension),
completeness (`ok` / `TRUNC` / `partial` / `?`), host and path.

Picking the right row:

- **The model is often served from a CDN, not the page's host** (Hi3D →
  `hitem3dstatic.zaohaowu.net`, Tripo → `tripo-data.rg1.data.tripo3d.com`). Filter with
  `--grep` only once you know the CDN.
- Sites also cache showcase/gallery models and small viewer helpers (`cp-hd.glb`, point
  clouds). Choose by **time** (when the user viewed it), **path** (job/task id, today's date
  folder, words like `pbr_model`, `textured`, `original`), not by size alone.
- Prefer the textured/PBR variant over `point_cloud`, `white_mesh`, `base` variants.
- When unsure, extract the candidates and preview them (step 4) rather than guess.

## 3. Extract

Ask the user where to save the model if they didn't say.

```bash
browser-models extract <hash-prefix> -o <dest.glb | dest-dir/>
```

It undoes the HTTP content-encoding, checks the GLB length against its header, and prints
a summary (vertices, triangles, materials, texture sizes). A `.gltf` (JSON) entry is
written into a directory together with its `.bin`/texture files, which are pulled from
the cache too; missing ones are listed.

Meshopt-compressed GLBs (`EXT_meshopt_compression`, common from gltfpack-based sites such
as Tripo) are unpacked with gltfpack automatically: `dest.glb` is the plain version
Blender imports, `dest.meshopt.glb` the original. Draco-compressed files are left alone
(Blender imports Draco natively).

## 4. Check it and hand it over

```bash
browser-models preview <file.glb> -o <scratch>/preview.png   # 4 views around Y; then Read the PNG
browser-models textures <file.glb> -o <dest-dir>             # basecolor.jpg, normal.png, ...
browser-models info <file.glb>
```

The preview is a point splat, so speckle is expected; it's for confirming *which* model
it is and that the texture is mapped. Show it to the user. Textures are embedded in a
GLB, so unpacking them is only needed for editing or for tools that want loose images.

Tell the user how to open it: Blender → File → Import → glTF 2.0 (.glb/.gltf); the
viewport's Solid mode shows grey, switch to Material Preview (`Z`) to see textures.
Multi-million-triangle AI meshes are heavy; a Decimate modifier helps.

## Not in the cache?

| Cause | What to do |
|---|---|
| Viewer hasn't loaded it (tab restored but never shown, lazy loading) | Ask the user to open the tab and let the model render, then scan again |
| Larger than Firefox's per-entry limit (`browser.cache.disk.max_entry_size`, default 50 MB) | `browser-models refs --since 120` finds model URLs in the site's cached API/HTML responses; download with `curl -L -o <dest> '<url>'` while its signature is still valid. Re-opening the tab refreshes expired signed URLs |
| `TRUNC` / `partial` (streamed with range requests, download interrupted) | Same as above: get the URL with `refs` (or `scan --all --grep <cdn>`) and download it whole |
| Private window, or cache disabled | Nothing on disk. Ask the user to open it in a normal window |
| Proprietary/obfuscated formats (e.g. Sketchfab's own streaming format) | Out of scope; tell the user |

`scan --all --grep <host>` lists every cached entry from a host, which shows what the
viewer actually fetched when nothing looks like a model.

Only extract models the user made or is entitled to use. If a site gates the download
behind a paid tier, say so instead of presenting the cached copy as the paid export (it may
be lower quality or watermarked).
