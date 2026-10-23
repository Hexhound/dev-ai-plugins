"""The narration: one clip per `id: text` line of <vlog>/script.md, in the voice set in
<vlog>/voice.json. Writes <vlog>/voice/<id>.wav and <vlog>/voice/lines.json (id, text,
seconds), and prints each line's length and the total.

    $PY -I make-voice.py <vlog dir>

voice.json: {"voice": "af_heart", "speed": 1.0, "lang": "en-us" (optional, from the voice),
"fixes": {"tʃˈɪbaɪ": "tʃˈiːbi"}} (wrong phonemes -> right ones; see voice-samples.py
--phonemes). A "|" in a line breaks its subtitles there and isn't said. Kokoro is
deterministic: re-running gives the same clips, so only edit the lines that change.
"""
import json
import re
import sys
from pathlib import Path

import soundfile as sf

sys.path.insert(0, str(Path(__file__).resolve().parent))
import kokoro_voice  # noqa: E402

vlog = Path(sys.argv[1])
settings = json.loads((vlog / "voice.json").read_text())
voice = settings["voice"]
kokoro = kokoro_voice.load()
(vlog / "voice").mkdir(exist_ok=True)
lines = []
for raw in (vlog / "script.md").read_text().splitlines():
    match = re.match(r"^([a-z0-9_]+): (.+)$", raw)
    if not match:
        continue
    line_id, text = match.groups()
    audio, rate = kokoro_voice.speak(kokoro, text, voice, settings.get("speed", 1.0),
                                     settings.get("fixes"), settings.get("lang"))
    sf.write(vlog / "voice" / f"{line_id}.wav", audio, rate)
    lines.append({"id": line_id, "text": text, "seconds": round(len(audio) / rate, 2)})
    print(f"{line_id:10} {lines[-1]['seconds']:5.2f} s  {text}")
(vlog / "voice" / "lines.json").write_text(json.dumps(lines, indent=1, ensure_ascii=False))
print("total", round(sum(line["seconds"] for line in lines), 1), "s")
