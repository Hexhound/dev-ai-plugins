---
description: Make lighter versions of a heavy 3D model in Blender — every triangle budget from 40k down to 1k, or one specific count — saved one .blend each, with the original material, an unlit-albedo look, or both.
argument-hint: [model file] [output dir]
---

Invoke the **blender-model-variants** skill for: $ARGUMENTS

Before running anything, ask the user (one question each, skipping any that the arguments
already answer):

1. **Which variants?** All of them, to compare (40k, 20k, 12k, 8k, 5k, 2.5k and 1k
   triangles), or a specific triangle count (e.g. 7000; several are fine, comma-separated).
2. **Which material?** The original material only, the modified unlit-albedo material
   only (the texture as painted, like a web viewer's "Albedo" view), or both (two files
   per variant).
3. **Where to save** the .blend files, if no output directory was given.

Ask for the model file if none was given. Then run the skill with a preview sheet, check
it, and finish with the table of files and triangle counts and the viewing notes.
