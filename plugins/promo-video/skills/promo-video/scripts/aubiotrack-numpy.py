#!/usr/bin/env python3
"""Stand-in for aubio's `aubiotrack -i <file.wav>` (when aubio isn't installed): prints one
beat time (seconds) per line, the format the promo-video skill's music-prepare.sh reads.

Method (Ellis 2007, "Beat tracking by dynamic programming"): a spectral-flux onset envelope,
the tempo from its autocorrelation (weighted toward ~115 BPM), then beats placed by dynamic
programming so they sit on onsets and stay close to the tempo. NumPy only.
"""
import sys
import wave

import numpy as np

HOP = 512
WIN = 2048


def read_wav(path):
    with wave.open(path, "rb") as w:
        rate = w.getframerate()
        channels = w.getnchannels()
        width = w.getsampwidth()
        data = w.readframes(w.getnframes())
    dtype = {2: np.int16, 4: np.int32}[width]
    samples = np.frombuffer(data, dtype=dtype).astype(np.float32)
    if channels > 1:
        samples = samples.reshape(-1, channels).mean(axis=1)
    return samples / np.iinfo(dtype).max, rate


def onset_envelope(samples, rate):
    frames = 1 + (len(samples) - WIN) // HOP
    window = np.hanning(WIN).astype(np.float32)
    idx = np.arange(WIN)[None, :] + HOP * np.arange(frames)[:, None]
    spectrum = np.abs(np.fft.rfft(samples[idx] * window, axis=1))
    # Mel-ish weighting is overkill here: log magnitude, positive flux, summed per frame.
    log_mag = np.log1p(1000.0 * spectrum)
    flux = np.maximum(0.0, np.diff(log_mag, axis=0)).sum(axis=1)
    flux = np.concatenate([[0.0], flux])
    # Remove the slow trend and normalise.
    kernel = np.ones(int(rate / HOP)) / int(rate / HOP)
    flux = np.maximum(0.0, flux - np.convolve(flux, kernel, mode="same"))
    return flux / (flux.std() + 1e-9), rate / HOP


def tempo_period(env, fps, prior_bpm=115.0):
    env = env - env.mean()
    corr = np.correlate(env, env, mode="full")[len(env) - 1:]
    lags = np.arange(len(corr))
    lo, hi = int(fps * 60 / 180), int(fps * 60 / 60)
    bpm = 60.0 * fps / np.maximum(lags, 1)
    weight = np.exp(-0.5 * (np.log2(bpm / prior_bpm) / 0.9) ** 2)
    score = corr * weight
    score[:lo] = -np.inf
    score[hi:] = -np.inf
    return float(np.argmax(score))


def track(env, period, tightness=100.0):
    n = len(env)
    score = env.copy()
    back = np.full(n, -1)
    p = period
    for t in range(n):
        lo, hi = int(round(t - 2 * p)), int(round(t - p / 2))
        if hi <= 0:
            continue
        lo = max(lo, 0)
        prev = np.arange(lo, hi)
        penalty = -tightness * np.log((t - prev) / p) ** 2
        cand = score[lo:hi] + penalty
        k = int(np.argmax(cand))
        if cand[k] > 0:
            score[t] = env[t] + cand[k]
            back[t] = prev[k]
    # Start from the best-scoring frame in the last period and walk back.
    tail = n - int(p)
    t = tail + int(np.argmax(score[tail:]))
    beats = []
    while t >= 0:
        beats.append(t)
        t = back[t]
    return beats[::-1]


def main():
    args = sys.argv[1:]
    path = args[args.index("-i") + 1] if "-i" in args else args[0]
    samples, rate = read_wav(path)
    env, fps = onset_envelope(samples, rate)
    period = tempo_period(env, fps)
    for frame in track(env, period):
        print(f"{frame / fps:.6f}")


if __name__ == "__main__":
    main()
