# Reviewing what the design tool returns

Always look at the rendered frames, not only the source. The source shows
what the tool meant to draw. The render shows what it actually drew:
overlaps, cut-off text, a heading hidden under a moving row.

## Getting the export

**Claude Design (claude.ai).** The user downloads the project as a zip,
usually to `~/Downloads/<Project name>(N).zip`, and sends you the path.

1. Unzip each export to its own folder: `unzip -q "<zip>" -d /tmp/<app>-N`.
2. Compare it with the previous export:
   `node scripts/compare-exports.mjs /tmp/<app>-<N-1> /tmp/<app>-N`.
   If nothing changed, the tool had not finished when the user exported.
   Ask them to wait for it to finish and export again.
3. Merge it into one working folder with `cp -r /tmp/<app>-N/. /tmp/<app>/`.
   Exports often hold only the files of the current project, and earlier
   boards reference shared files.

Files are `*.dc.html` pages that load `*.jsx` with in-browser Babel. They
need HTTP; `file://` fails. Serve the folder:
`node scripts/serve.mjs /tmp/<app> 8765` (run in the background).

**Open Design (local).** The project already sits on disk: the Open Design
data folder's `projects/<project-id>/` (in a devenv usually
`.devenv/state/open-design/projects/`). Ask the user which project if there
are several. Its HTML artifacts open over `file://` directly. Put any
temporary copy inside the project folder, so relative paths still work, and
delete it afterwards.

## Rendering

`scripts/shot.sh <url> <out.png> [width] [height]` wraps headless chromium.
Use the brief's canvas size. Use a taller window (e.g. 1640×1500) when frames
are stacked, or they get cut off.

- **One frame per image.** Boards hold many frames. Render one at a time.
  Make a temporary copy of the page with only that frame kept. Frames are
  usually one element each (`<div id="...">`), or one entry in a JS frames
  array: filter it, e.g. `frames.filter(f => f.id === "4")`. Screenshot the
  copy.
- **Animated prototypes.** Headless chromium's virtual time only runs about
  1.5 s of animation. To see a later beat, find the prototype's own
  time-seek hook (a `?t=` parameter, or a scrubber function) and call it
  from an injected script. Colours or numbers caught mid-transition are
  artefacts of that, not bugs.
- Read each image. Describe to yourself what is on it before judging it.

## Checking

Go through the review checklist in the skill for every frame. Then write:

- the revision file (changes only), or
- "locked", naming the round and the export number, and record the locked
  decisions.

Tell the user briefly what you saw and why each change is needed.
