"""Shared Kokoro helpers for the narrator-vlog scripts (imported, not run).

Kokoro-82M through kokoro-onnx, offline. The voice's first letter is its language: a/b
English (US/UK), e Spanish, f French, h Hindi, i Italian, j Japanese, p Portuguese (Brazil),
z Mandarin; the second its gender (f/m). Japanese and Mandarin need extra phonemizer
packages (misaki); test them with voice-samples.py before promising them.
"""
import os
from pathlib import Path

import numpy as np
import kokoro_onnx
from kokoro_onnx import Kokoro
from kokoro_onnx.config import MAX_PHONEME_LENGTH

HOME = Path(os.environ.get("KOKORO_HOME", Path.home() / ".cache/kokoro"))
LANGS = {"a": "en-us", "b": "en-gb", "e": "es", "f": "fr-fr", "h": "hi", "i": "it", "j": "ja",
         "p": "pt-br", "z": "cmn"}


def _create_audio(self, phonemes, voice, speed):
    """kokoro-onnx 0.4.7 sends `speed` as int32; the v1.0 model wants a float. Otherwise as
    0.4.7's: a batch past the model's 510 phonemes is cut (create() splits at punctuation,
    so only a long run without any gets here)."""
    phonemes = phonemes[:MAX_PHONEME_LENGTH]
    tokens = np.array(self.tokenizer.tokenize(phonemes), dtype=np.int64)
    style = np.array(voice[len(tokens)], dtype=np.float32)
    inputs = {"input_ids": [[0, *tokens, 0]], "style": style,
              "speed": np.array([speed], dtype=np.float32)}
    return self.sess.run(None, inputs)[0], 24000


kokoro_onnx.Kokoro._create_audio = _create_audio


def load():
    return Kokoro(str(HOME / "kokoro-v1.0.onnx"), str(HOME / "voices-v1.0.bin"))


def lang_of(voice):
    return LANGS[voice[0]]


def speak(kokoro, text, voice, speed=1.0, fixes=None, lang=None):
    """The audio (float32 at 24 kHz) of `text`, with `fixes` (wrong phonemes -> right ones)
    applied, so names come out right. A "|" only marks a subtitle break; it isn't said."""
    spoken = " ".join(text.replace("|", " ").split())
    phonemes = kokoro.tokenizer.phonemize(spoken, lang or lang_of(voice))
    for wrong, right in (fixes or {}).items():
        phonemes = phonemes.replace(wrong, right)
    audio, rate = kokoro.create(phonemes, voice=voice, speed=speed, is_phonemes=True)
    return audio, rate
