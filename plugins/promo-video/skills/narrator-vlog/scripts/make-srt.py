"""The subtitles as an .srt file (the same chunks the video burns in): each narration line
(<vlog>/voice/lines.json) split at its "|" marks, or else at its commas and full stops into
chunks of at most ~56 characters, each shown for its share of the line, from its start in
<vlog>/timing.json. Keep in step with buildSubs in the engine's text.tsx.

    python3 make-srt.py <vlog dir> > <vlog>/out/<name>.en.srt
"""
import json
import re
import sys
from pathlib import Path

vlog = Path(sys.argv[1])


def stamp(seconds):
    ms = int(round(seconds * 1000))
    return f"{ms // 3600000:02}:{ms // 60000 % 60:02}:{ms // 1000 % 60:02},{ms % 1000:03}"


lines = json.loads((vlog / "voice/lines.json").read_text())
starts = json.loads((vlog / "timing.json").read_text())["vo"]
n = 0
for line in sorted(lines, key=lambda line: starts[line["id"]]):
    chunks = []
    if "|" in line["text"]:
        chunks = [chunk.strip() for chunk in line["text"].split("|")]
    else:
        for part in re.split(r"(?<=[.!?,])\s+", line["text"]):
            if chunks and len(chunks[-1] + " " + part) <= 56:
                chunks[-1] += " " + part
            else:
                chunks.append(part)
    total = sum(len(c) for c in chunks)
    t = starts[line["id"]]
    for chunk in chunks:
        length = line["seconds"] * len(chunk) / total
        n += 1
        print(f"{n}\n{stamp(t)} --> {stamp(t + length)}\n{chunk}\n")
        t += length
