# Capture adapters

Every adapter produces the same thing — the capture contract in
`references/storyboard-format.md`: per segment, `NNNN.png` frames plus `capture.json`
(`fps`, `size`, `frames`, `markers`, `tracks`, `rects`; coordinates normalized to the
frame). The composition never touches the app, only this.

Principles for every stack:

- **Drive the real app from code**, in story order, one segment per continuous shot.
  Prefer the app's own model/controller APIs for state changes (deterministic) and real
  synthetic pointer events for anything with a cursor, brush or drag (so the app draws
  its own cursor/brush ring and the track is real).
- **Advance time yourself**: one captured frame per step, never wall-clock screen
  recording. Holds duplicate a frame; animations call `step(t)` then capture.
- **Headless and scaled**: 1.5–2× device pixel ratio for zoom headroom; fonts through
  fontconfig (`FONTCONFIG_FILE`) so brand fonts are present.
- **Composite every window**: dialogs, popovers and floating panels are often separate
  surfaces — draw them onto the frame at their position, with a soft shadow.
- **Park overlays** (dialogs, toasts) where they don't cover the subject of the shot.

Status: **Qt — tested** (OmaPhoto). **Web — tested** (sample page). **Godot 4 — tested**
(Chibi Chuu, a 3D phone/PC game). GTK4 and Flutter are recipes — validate on the first real
app and update this file with what you learn.

## Qt (Widgets / QML) — `capture/qt/promo_recorder.h`

Tested on OmaPhoto (C++/Qt 6). A small driver executable links the app's code and runs
the real main window under `QT_QPA_PLATFORM=offscreen`.

- Build: if the app has a core library target, add
  `add_executable(promo promo/promo.cpp)` + `target_link_libraries(promo PRIVATE <core> Qt6::Test)`
  and put `promo_recorder.h` on the include path. Otherwise compile the app's sources
  except its `main`.
- Run: `QT_QPA_PLATFORM=offscreen QT_SCALE_FACTOR=1.5 PROMO_OUT=promo/capture ./promo`.
- Construct the app like its `main()` does, `window.show()`, `QTest::qWaitForWindowActive`.
- `promo::Recorder rec(window, out)`: `begin(segment)`, `marker(name)`,
  `track(name, windowPoint | nullopt)` (sticky), `value(name, v)`, `rect(name, widget |
  windowRect)`, `frame()`, `hold(n)`, `animate(n, step)`, `finish()`.
- Pointer tools: send `QMouseEvent` moves to the canvas widget (see the example's
  `send`) and record the window-mapped point as a track on every move.
- Waiting on async work (filters, imports): `promo::waitFor(predicate)`; find widgets
  by `objectName` with `promo::find<T>(name)`.
- Theme switching: re-apply the app's palette/theme object between frames.
- Example: `examples/omaphoto/capture/promo.cpp`.

## Web / Electron — `capture/web/recorder.mjs`

Tested. Playwright (`playwright-core` from the Nix node_modules) with the Nix chromium;
the page clock is frozen and advanced exactly one frame per capture, so CSS/JS animation
is deterministic.

```js
import {record} from '<skill>/capture/web/recorder.mjs';
await record({url: 'http://localhost:4000', out: 'promo/capture'}, async (rec, page) => {
  await rec.begin('main');
  await rec.rect('sidebar', page.locator('nav'));
  rec.marker('open');
  await page.getByRole('button', {name: 'New'}).click();
  await rec.hold(20);
  await rec.drag([[200, 300], [600, 420]], 30, 'cursor'); // real pointer, tracked
});
```

- `CHROMIUM` env var = the Nix chromium path. Viewport 1600×940 at scale 1.5 by default.
- Seed the app with demo data first (fixtures, a seeded dev DB, a demo account).
- Hide dev overlays, cookie banners and scrollbars with injected CSS.
- Electron: launch with `_electron.launch({executablePath, args})` from playwright-core
  and pass `page: await app.firstWindow()` to `record`.

## Godot 4 (games) — `capture/godot/promo_recorder.gd`

Tested on Chibi Chuu (Godot 4.7, 3D, a phone UI and a PC UI). The driver is a dev scene in
the game's own project (`res://tools/promo/`, Godot can't load scripts from a folder with a
`.gdignore`, like `promo/`), run as its own main scene.

- **Render into a SubViewport** of a fixed size, not the window: the capture then doesn't
  depend on the window or the display. Phone UI: the design size × 1.5 with
  `size_2d_override` (= design size) and `size_2d_override_stretch`, so the UI lays out as on
  the phone and renders sharper (1080×2160 → 1620×3240). A world shot without UI: 2400×1350.
- **Step time yourself**: `godot --fixed-fps 30 --disable-vsync --path . res://tools/promo/x.tscn
  -- promo_out=<dir> …`. Every frame is then exactly 1/30 s of game time whatever the machine;
  `--disable-vsync` also keeps a hidden window (Wayland, a locked screen) from stalling.
- **Drive the real game** through its own API — the mode scene, its launcher, its menus — or
  a self-playing tool it already has (an autoplay); set seeds. Pointer gestures: call the
  game's own handlers (grab, drag, throw) and record the point as a track.
- **Record**: `PromoRecorder` (class in `capture/godot/`): `begin(segment, viewport, out, 30)`,
  then each `_process`: `capture()` (the frame drawn last), `marker(name)`,
  `track(name, viewport_point | null)` (sticky), `value(name, number)`, `rect(name, Rect2)`,
  `event({...})` (facts the composition reads: a drop's tier, a merge, a combo count),
  `finish()`. `project(world)` / `project_box(aabb)` turn 3D positions into the 2D points
  tracks and rects want. PNGs are written on worker threads.
- **Markers from the game's signals** (dropped, landed, merged, combo, card shown), so the
  composition retimes the real events to the beat.
- **Physics doesn't replay exactly.** The same seed can play out differently on the next run
  (Jolt, timing), so a moment picked from one recording isn't there in the next. Record a
  wider window than the shot needs (e.g. 12–48 s for an 8-second shot), save every event,
  then pick the window with a small script over `capture.json` (e.g. "a landing, then a
  combo chain of ×2…×4 whose merges fit the beats at real speed"), and set the frames in the
  composition. Re-check after every re-record.
- **Sound**: Godot doesn't record audio with these frames. Place the game's own sound files
  at the markers in the composition and mix them with the music (SKILL.md, PHASE 5: the
  app's own sounds; `<Sequence><Audio/></Sequence>` cues and `scripts/mix-sfx.sh` in a
  Remotion project).
- **Cost**: about 0.3–1.2 s a frame at 1620×3240 (readback + PNG), so a 12-segment promo
  takes 15–45 min to record; record segments in parallel processes when the machine allows.
- **Look**: the game's own fonts and shaders render as in the game; turn off debug
  overlays; pick the detail level the promo shows (e.g. full detail on a phone where a
  low-detail setting starts on).
- Example, in the game's own repo (not shipped here; only `promo_recorder.gd` is): Chibi
  Chuu's `tools/promo/` (`promo_play.gd` records a mode's run with drop / land / merge /
  combo markers, `promo_menu.gd` a title-screen grab-and-throw, `promo_merge.gd` a staged
  merge) and `play_store/promo/driver/capture_all.sh`.

## GTK4 (e.g. chatot — Go + gotk4) — recipe

In-process, like Qt: build the app with a `promo` build tag / flag that, instead of
waiting for the user, runs a driver on the GTK main loop.

- Headless display: `GDK_BACKEND=broadway` with `gtk4-broadwayd :5 &` and
  `BROADWAY_DISPLAY=:5`, or a headless Wayland compositor (`WLR_BACKENDS=headless cage --
  app` / `weston --backend=headless`). `GDK_SCALE=2` for resolution; `GSK_RENDERER=cairo`
  if GL is unavailable.
- Frame capture: snapshot the window through its own renderer —
  `paintable := gtk.NewWidgetPaintable(window)`; `snap := gtk.NewSnapshot()`;
  `paintable.Snapshot(snap, w, h)`; `node := snap.ToNode()`;
  `tex := window.Native().Renderer().RenderTexture(node, nil)`; `tex.SaveToPNG(path)`.
  Popovers/dialogs are their own natives: snapshot them the same way and composite at
  their `ComputeBounds` offset relative to the window.
- Driving: activate actions (`widget.ActivateAction("win.send", nil)`), set model state,
  feed text into entries; GTK4 has no public synthetic-pointer API, so call the gesture
  handlers' underlying functions and record the point you "moved" to as the track.
- Iterate the main loop between steps (`glib.MainContextDefault().Iteration(false)` until
  idle) so layout and animations settle before each snapshot.
- Unverified: validate on chatot first; record the working incantation here.

## Flutter (desktop and mobile, e.g. caremate) — recipe

Use an `integration_test` that drives the real app and captures its root
`RepaintBoundary` each frame — the same UI renders on the Linux desktop target, so mobile
apps are captured without an emulator.

- Wrap the app root in `RepaintBoundary(key: promoKey, child: app)` behind a
  `--dart-define=PROMO=true` flag.
- Mobile layout on desktop: set the view to the phone's logical size and DPR
  (`tester.view.physicalSize = const Size(1290, 2796); tester.view.devicePixelRatio =
  3;`).
- Per frame: `await tester.pump(const Duration(milliseconds: 33));` then
  `final image = await (promoKey.currentContext!.findRenderObject() as RenderRepaintBoundary).toImage(pixelRatio: 1);`
  → `image.toByteData(format: ImageByteFormat.png)` → write `NNNN.png`. Keep markers,
  tracks (a `TestGesture`'s positions) and rects (`tester.getRect(finder)`) in a map and
  write `capture.json` at the end, same schema.
- Input: `tester.tap`, `tester.enterText`, and `TestGesture` moves one step per frame for
  drags/drawing (record the position as a track).
- Run headless: `xvfb-run flutter test integration_test/promo_test.dart -d linux` (or
  under a headless Wayland compositor). Stub platform plugins that don't exist on Linux
  (camera, billing) in promo mode with demo data.
- In the composition, present mobile captures inside a device frame (a CSS bezel, or a
  3D phone render from the mobile-dev plugin's `store-screenshots` for hero stills).
- Unverified: validate on caremate first; record the working incantation here.

## Anything else (TUI, third-party apps) — fallback

Run the app under a headless wlroots compositor (`WLR_BACKENDS=headless sway` or `cage`),
drive it with `wtype`/`ydotool`, and capture each step with `grim` (optionally `-g` a
region). Record tracks from your own input script. Terminal apps: render into xterm.js in
a web page and use the web recorder, or `vhs` for a plain terminal look.
