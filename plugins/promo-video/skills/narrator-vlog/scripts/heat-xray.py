"""Usage: $PY -I heat-xray.py <capture/name_xray> [...]   ($PY: voice-setup.sh's venv python,
which has NumPy and Pillow)

Turns overdraw clips (vlog_turntable.gd overdraw=on: every surface drawn see-through, adding
up) into heat maps of how many surfaces are stacked at each pixel, written next to them as
<name>_heat/NNNN.png. One scale for every clip, so a before and an after compare: 1 surface
is cool blue, 2 mint, 3 yellow, then orange, pink and magenta up to 10. This is the proof
for "the old model hid geometry inside": a wireframe can't show it (it draws every edge,
hidden or not).

Godot's overdraw view adds the same see-through layer per surface, so the brightness takes
fixed steps. LEVELS are the green values of 1, 2, 3... surfaces in Godot 4's Mobile and
Forward+ renderers on a black background; check them on a new engine version (a histogram
of one frame shows the steps). The composition's key uses STOPS' colours.
"""
import sys
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import numpy as np
from PIL import Image

# Green value of 0, 1, 2 ... 10 stacked surfaces.
LEVELS = [0, 80, 111, 134, 153, 170, 184, 197, 209, 221, 231]
# Surfaces -> colour: the card's dark plum, then cool to hot.
STOPS = [
    (0, "#2b1a33"),
    (1, "#4fb3d9"),
    (2, "#7fd8be"),
    (3, "#f6e27f"),
    (4.5, "#f9a85d"),
    (6, "#f2667a"),
    (8, "#d63a8f"),
    (10, "#fff0f5"),
]


def _rgb(hex_colour):
    return [int(hex_colour[i:i + 2], 16) for i in (1, 3, 5)]


def heat(path_in, path_out):
    green = np.asarray(Image.open(path_in).convert("RGB"))[..., 1].astype(np.float32)
    surfaces = np.interp(green, LEVELS, range(len(LEVELS)))
    xs = [s for s, _ in STOPS]
    out = np.stack([np.interp(surfaces, xs, [_rgb(c)[k] for _, c in STOPS]) for k in range(3)], -1)
    Image.fromarray(out.astype(np.uint8)).save(path_out)


def main():
    jobs = []
    for clip in sys.argv[1:]:
        clip = Path(clip)
        out = clip.with_name(clip.name.replace("_xray", "") + "_heat")
        out.mkdir(exist_ok=True)
        for old in out.glob("*.png"):
            old.unlink()
        jobs += [(str(frame), str(out / frame.name)) for frame in sorted(clip.glob("*.png"))]
    with ProcessPoolExecutor() as pool:
        list(pool.map(heat, *zip(*jobs), chunksize=8))
    print(len(jobs), "frames")


if __name__ == "__main__":
    main()
