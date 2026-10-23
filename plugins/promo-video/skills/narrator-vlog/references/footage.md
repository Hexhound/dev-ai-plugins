# Footage

All footage is the real product, recorded by script into `capture/<clip>/NNNN.png` (30 fps,
16:9). Name clips `old_<what>` / `new_<what>` when they compare. Write every recording into
`vlog/<slug>/capture.sh` (steps by argument: `capture.sh chibis props night`), so a re-shoot
is one command and the README can point at it.

## The old version: a git worktree

```bash
git worktree add ../<app>_v1 <tag or commit>     # e.g. v1.0.0
cp -r tools/vlog ../<app>_v1/tools/               # the same capture tools in both
# copy any recorder the old version lacks (the promo recorder, a turntable)
godot --headless --path ../<app>_v1 --import       # Godot: import once
```

- The tools must only use what the old version has too; anything newer goes in the
  turntable's `setup=` script, written per version.
- The worktree checks out a branch: if that's `master` and the user later wants to merge
  into it, remove the worktree first (`git worktree remove --force ../<app>_v1`); it's
  disposable, and `capture.sh` says how to make it again.
- The same settings for both versions (seed, resolution, camera, time of day): the
  comparison is only fair, and wipes only line up, when only the version differs.

## Models: the turntable (Godot: `capture/godot/vlog_turntable.gd`)

Copy `vlog_turntable.gd` and `.tscn` to `res://tools/vlog/`. It shoots any scene or model
on a plain stage with the camera fitted to it:

| Shot | Arguments | For |
|---|---|---|
| The model, swinging | `scene=… sway=35 period=10 seconds=10 yaw=-20` | "the old one / the new one": a ¾ front view that never shows the back |
| Wireframe | `… wireframe=on bg=#2b1a33` | triangle density, side by side with a counter |
| X-ray | `… overdraw=on`, then `heat-xray.py capture/<clip>_xray` | surfaces hidden inside (a wireframe can't show them) |
| Line-up | `scene=a,b,c,… rows=2 fit=0.95` | "every character", same size, one frame |
| A set or level | `scene=… arc=on target=x,y,z distance=9 pitch=20 sweep=16 freeze=on` | props, levels: a slow camera arc, nobody moving |
| Expressions | `… turns=0 yaw=0 zoom=2 anim=blink,happy,surprised` | faces; make it as long as its section |

- Shoot both versions with the **same** sway, yaw, seconds and size (zoom the old one if its
  model is a different size): the clips stay in step, side by side and in wipes.
- `setup=res://tools/vlog/<file>.gd` (a `static func setup(root, args)`, run before the
  scene enters the tree) applies what the game does at runtime: its materials on a raw
  imported model, a detail level, emptying a menu that spawns characters. Without it a raw
  `.glb` shows untextured.
- Several detail levels of a model (8,000 / 2,500 triangles): one clip each with the same
  sway, then switch between them in the composition in step with the game's own switch.

## The x-ray

Godot's overdraw view draws every surface see-through and adds them up, so the brightness
counts the surfaces stacked at each pixel. `heat-xray.py` maps those steps to colours (one
scale for every clip: 1 blue, 2 mint, 3 yellow, more = orange to magenta) and writes
`<clip>_heat/`. The turntable drops outline passes, so an outline doesn't count as a
surface. In the composition, put a key ("surfaces stacked: 1 2 3 5 8+") next to it and a
pointer on the hot part ("up to 9 layers deep" — measure it from the frames, don't guess).

## The app running: modes, levels, screens

Use the product's own recorder (promo-video's capture adapters: `capture/godot`,
`capture/web`, `capture/qt` in the promo-video skill) or a small driver script:

- Record wide windows and pick moments from logged events: physics and timing don't replay
  the same, even with the same seed.
- Calm moments for calm claims ("they doze off at night"): stop the input a few seconds
  before the window, so nothing merges or pops up over it.
- Capture at 2400×1350 (or 2×): close-ups are cut from the full-size PNGs (`derived.txt`:
  `old_tank old_classic_day 1152x648+624+27`), never by zooming the 1080p JPEGs more than
  ~1.5×.

## UI drawn in the window (debug panels, overlays)

Something drawn in the main window (a debug panel, an overlay autoload) isn't in a
SubViewport capture. Record the window with Godot's Movie Maker:

```bash
printf '[display]\n\nwindow/size/window_width_override=1920\nwindow/size/window_height_override=1080\n' > override.cfg
godot --path . res://tools/vlog/<scene>.tscn --write-movie /tmp/clip.avi --fixed-fps 30 --disable-vsync &
sleep 10; rm override.cfg; wait
ffmpeg -ss <from> -t <len> -i /tmp/clip.avi -vf fps=30 -start_number 0 capture/<clip>/%04d.png
```

- Movie Maker runs slower than real time: hide fps / frame-time readouts (they'd read
  "10 fps"), on the very frame the panel opens too.
- Make a see-through panel opaque for the recording (the game behind it bleeds through its
  text).
- Find the frames where the panel's state changes (a model switch) from the footage, and
  sync any other clip to them.

## Godot gotchas

- `vlog/.gdignore` before the first capture, or the editor imports every PNG (thousands of
  `.import` files and cache).
- Save frames on worker threads with `image.save_png_to_buffer()` + `FileAccess`:
  `Image.save_png` from a thread errors.
- Wireframes need `RenderingServer.set_debug_generate_wireframes(true)` in `_init`, before
  any mesh loads (the turntable does it).
- Headless runs never fire `frame_post_draw`; capture from `_process`.
- Never EEVEE or GPU-heavy renders on a weak or unstable GPU; the turntable renders with
  the game's own renderer.

## Check every clip

`contact-sheet.sh capture/<clip> sheet.jpg` (promo-video) and look: the subject framed and
centred at every moment, the front shown while its line plays, no pop-ups at the moments you
will use, old and new in step.
