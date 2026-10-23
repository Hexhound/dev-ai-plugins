"""Voice samples for the user to choose from, or the voices and phonemes to check.

    $PY -I voice-samples.py --list
    $PY -I voice-samples.py <out dir> --text "A sentence from the script." --voices af_heart,af_bella,bf_emma,am_michael
    $PY -I voice-samples.py --phonemes "Welcome back to Chibi Chuu!" [--voice af_heart]

$PY is the python voice-setup.sh prints. Samples are MP3 (ffmpeg) named <voice>.mp3, each
the same sentence, so they compare. --phonemes prints how a sentence will be said: check
every product and character name, and fix the wrong ones in voice.json ("fixes").
"""
import argparse
import subprocess
import sys
from pathlib import Path

import soundfile as sf

sys.path.insert(0, str(Path(__file__).resolve().parent))
import kokoro_voice  # noqa: E402

parser = argparse.ArgumentParser()
parser.add_argument("out", nargs="?")
parser.add_argument("--text", default="Hi! This is our devlog. Here is what changed, and why.")
parser.add_argument("--voices", default="af_heart,af_bella,bf_emma,am_michael")
parser.add_argument("--speed", type=float, default=1.0)
parser.add_argument("--list", action="store_true")
parser.add_argument("--phonemes")
parser.add_argument("--voice", default="af_heart")
args = parser.parse_args()

kokoro = kokoro_voice.load()
if args.list:
    for voice in sorted(kokoro.get_voices()):
        print(voice, kokoro_voice.LANGS.get(voice[0], "?"))
elif args.phonemes:
    print(kokoro.tokenizer.phonemize(args.phonemes, kokoro_voice.lang_of(args.voice)))
else:
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    for voice in args.voices.split(","):
        audio, rate = kokoro_voice.speak(kokoro, args.text, voice, args.speed)
        wav = out / f"{voice}.wav"
        sf.write(wav, audio, rate)
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(wav), "-b:a", "128k",
                        str(wav.with_suffix(".mp3"))], check=True)
        wav.unlink()
        print(f"{voice:12} {len(audio) / rate:5.2f} s  {wav.with_suffix('.mp3')}")
