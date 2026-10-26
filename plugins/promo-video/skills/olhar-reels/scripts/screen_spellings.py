"""Ear-proxy pre-screen of a pronunciation round: Whisper transcribes every clip that
lexicon_test.py made and ranks each word's spellings by how close it writes the word back.
Prints the payload for the review_pronunciations tool (JSON on stdout).

    $PY -I screen_spellings.py <words.json> <round dir> <engine:voice> [--round R] [--key K] [--story-url U]

<round dir> is lexicon_test.py's --out folder (voices/pronuncia-<date>). $PY is a venv with
faster-whisper (~/.cache/tts-eval/venv/bin/python).
"""
import argparse
import difflib
import json
import re
import sys
import unicodedata
from pathlib import Path

import librosa
from faster_whisper import WhisperModel

# Same file naming as lexicon_test.py.
slug = lambda s: re.sub(r"[^a-z0-9]+", "-", s.lower().translate(str.maketrans("áâãéêíóôõúç", "aaaeeiooouc"))).strip("-")


def norm(s):
    s = unicodedata.normalize("NFKD", s.lower())
    return "".join(c for c in s if c.isalnum())


def closest(word, text):
    """The 1–3 word stretch of `text` closest to `word`, and its similarity (0–1)."""
    tokens = re.findall(r"[\wÀ-ÿ'-]+", text)
    best = ("", 0.0)
    for n in (1, 2, 3):
        for i in range(len(tokens) - n + 1):
            heard = " ".join(tokens[i:i + n])
            score = difflib.SequenceMatcher(None, norm(heard), norm(word)).ratio()
            if score > best[1]:
                best = (heard, score)
    return best


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("words")
    ap.add_argument("round_dir")
    ap.add_argument("voice")
    ap.add_argument("--round")
    ap.add_argument("--key", help="lexicon key for the approved reading (default: the engine)")
    ap.add_argument("--story-url", default="")
    args = ap.parse_args()

    words = json.loads(Path(args.words).read_text())
    clips_dir = Path(args.round_dir).resolve() / args.voice.replace(":", "-")
    engine = args.voice.split(":", 1)[0]
    whisper = WhisperModel("large-v3-turbo", device="cpu", compute_type="int8", cpu_threads=12)

    out = []
    for word, spec in words.items():
        clips = []
        for i, spelling in enumerate(spec["spellings"]):
            f = clips_dir / f"{slug(word)}-{i + 1}.mp3"
            if not f.exists():
                print(f"missing {f}", file=sys.stderr)
                continue
            audio, _ = librosa.load(f, sr=16000, mono=True)
            segs, _ = whisper.transcribe(audio, language="pt", beam_size=5)
            text = " ".join(s.text.strip() for s in segs)
            heard, score = closest(word, text)
            clips.append({"n": i + 1, "spelling": spelling, "file": str(f), "heard": heard, "score": round(score, 2), "transcript": text})
        clips.sort(key=lambda c: -c["score"])
        out.append({"word": word, "target": spec.get("target", ""), "line": spec.get("line", ""), "voice": args.voice,
                    "lexicon_key": args.key or engine, "story_url": spec.get("story_url", args.story_url), "clips": clips})

    print(json.dumps({"round": args.round or Path(args.round_dir).name.removeprefix("pronuncia-"), "words": out}, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
