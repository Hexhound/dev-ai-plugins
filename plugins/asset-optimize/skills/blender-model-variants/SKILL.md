---
name: blender-model-variants
description: Use when a 3D model (GLB/glTF/FBX/OBJ/STL/PLY/.blend) has too many triangles for a game or mobile app and the user wants lighter versions — a ladder of triangle-budget variants to compare, or one specific count (e.g. 7000 triangles) — saved as one .blend per variant, optionally with an unlit-albedo material that shows the texture as painted (like a web viewer's "Albedo" button). Typical input: multi-million-triangle AI image-to-3D models (Hi3D, Tripo, Meshy).
user-invocable: true
---

# Triangle-budget variants of a 3D model, one .blend each

The work is done by `scripts/model-variants` in this skill's directory, a wrapper that
runs `scripts/model_variants.py` in a headless Blender. It uses the `blender` on PATH
(the `asset-optimize-deps` flake package provides one), otherwise `nix run nixpkgs#blender`.
It never touches a Blender the user has open.

## 1. Settle the three choices

Ask for any the user hasn't given:

| Choice | Options | `--flag` |
|---|---|---|
| Which variants | **All**: 40k, 20k, 12k, 8k, 5k, 2.5k, 1k triangles, to compare. **Specific**: one or more counts, e.g. `7000` or `8000,5000` | `--tris all` / `--tris 7000` |
| Material | **Original** (the model's own lit PBR material), **unlit albedo** (the texture as painted, no lighting), or **both** (two files per variant) | `--material original\|unlit\|both` |
| Where to save | A directory | positional `OUT_DIR` |

If they have no budget in mind, offer "all" first so they can see the difference before
picking. For reference, phone games usually keep a character at roughly 5k–15k triangles.
That's a rule of thumb, not a limit.

## 2. Run it

```bash
model-variants INPUT OUT_DIR --tris all --material both --name axolotl \
    --preview OUT_DIR/variants_preview.png
```

- `--name` sets the file prefix (default: the input file name). Files are
  `<name>_<tris>.blend` and `<name>_<tris>_unlit.blend`, with counts zero-padded so they
  sort.
- `--preview` writes a labelled sheet: the original plus every variant, front and ¾ views,
  rendered with the unlit material when one was asked for. Always ask for it.
- `--saturation 1.0` is the unlit albedo's starting saturation (stored on a node, so the
  user can tune it later).
- Counts at or above the original's are skipped with a message.

Time: importing and welding a 2M-triangle mesh, then the first decimation, take about a
minute; each further variant takes seconds. Run it in the background for large inputs.

What it does to the mesh:

1. **Welds vertices split along UV seams.** Importers split a mesh wherever its UVs are
   discontinuous; decimating that would open cracks between the islands. After welding,
   Blender's collapse decimator keeps the seams' UVs intact. Measured on a 2M-triangle
   Hi3D model, 33k open seam edges went down to 1.
2. **Collapse-decimates in a chain**: each variant comes from the previous, larger one.
   That's much faster than starting each from the original, with the same result. When
   there are several mesh objects, each gets its share of the budget.
3. **Clears imported custom normals and shades smooth.** That suits the organic AI
   models this is for; hard-surface models may want *Shade Auto Smooth* afterwards.

What the unlit material is: whatever fed the Principled BSDF's Base Color goes through a
Hue/Saturation node (*Albedo Saturation*) into an Emission shader (*Albedo Unlit*,
strength 1). Alpha is kept with a Transparent mix. The Principled BSDF stays in the tree,
disconnected, so it's easy to switch back. The file's view transform is set to
**Standard**, because AgX/Filmic wash out emission colours. Every file opens in Material
Preview, framed on the model, with its textures packed.

## 3. Check before handing over

`Read` the preview sheet. Compare each variant with the original and name the first
budget where something breaks. Typically, in that order: hair-line and eye-outline
texture wobble, then jagged silhouette edges (fins, ears, tails), then smeared faces.
If the user wants a closer look, render crops of the face from the files instead of
guessing. For a single requested count, still say whether it holds up.

## 4. Report

Give a table: file, actual triangle count (the script prints a SUMMARY with them),
vertex count if asked, and a one-line verdict per variant. Then tell the user:

- **Viewing:** open the file. If it shows grey, the viewport is in Solid mode: press `Z`
  and pick Material Preview, or set Solid mode's Color to Texture.
- **Tuning the unlit look:** Shading tab, *Albedo Saturation* node. Above 1 pushes
  pinks/oranges toward red quickly; values around 0.9–1.1 are the useful range.
- **Engines:** the unlit node setup lives only in Blender and doesn't export to glTF
  reliably. In the engine, use the same albedo texture on an unshaded material: Godot
  *Shading Mode: Unshaded*, Unity *Unlit/Texture*, three.js `MeshBasicMaterial`.
- **Textures:** AI models often carry 4K–8K textures, which cost far more memory on
  mobile than the triangles do. Suggest resizing, e.g. to 1024–2048, if they're that
  large. The script leaves them as they are.

Leave the output where the user asked. The script cleans up its own temporary work file.
