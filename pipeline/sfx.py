"""Sound effects synthesised with numpy only (our own work, no licence risk).

Run `python -m pipeline.sfx` to regenerate assets/sfx/*.wav and SOURCES.csv.
Fixed seeds make the output identical every time.
All files: 48 kHz, mono, 16-bit, 5 ms fade in, 20 ms fade out, peak -3 dBFS.
"""
import csv
import hashlib
import wave
from pathlib import Path

import numpy as np

SR = 48000
PEAK_DBFS = -3.0
FADE_IN = 0.005
FADE_OUT = 0.020
OUT_DIR = Path(__file__).resolve().parent.parent / "assets" / "sfx"


def _t(seconds):
    return np.arange(int(SR * seconds)) / SR


def _noise(seed, n):
    return np.random.default_rng(seed).standard_normal(n)


def _lowpass(x, fc):
    """One-pole low-pass. fc may be a number or an array (cutoff in Hz per sample)."""
    fc = np.broadcast_to(np.asarray(fc, dtype=float), x.shape)
    a = 1 - np.exp(-2 * np.pi * fc / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc += a[i] * (x[i] - acc)
        y[i] = acc
    return y


def _highpass(x, fc):
    return x - _lowpass(x, fc)


def _decay(t, tau):
    return np.exp(-t / tau)


def whoosh():
    t = _t(0.5)
    fc = 250 + 2600 * np.sin(np.pi * t / 0.5) ** 2          # cutoff sweeps up, then down
    y = _highpass(_lowpass(_noise(1, len(t)), fc), 120)
    return y * np.sin(np.pi * t / 0.5) ** 1.5


def pop():
    t = _t(0.12)
    f = 300 + 300 * _decay(t, 0.02)                          # pitch drops 600 -> 300 Hz
    phase = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(phase) * _decay(t, 0.035)


def tick():
    t = _t(0.04)
    return np.sin(2 * np.pi * 1800 * t) * _decay(t, 0.008)


def _bell(t, f, tau):
    parts = [(1.0, 1.0), (2.76, 0.35), (5.4, 0.12)]          # soft inharmonic partials
    return sum(a * np.sin(2 * np.pi * f * m * t) * _decay(t, tau / m) for m, a in parts)


def chime():
    y = np.zeros(int(SR * 0.9))
    for start, f in ((0.0, 784.0), (0.18, 1174.7)):          # G5 then D6
        n0 = int(start * SR)
        seg = _bell(_t(0.9 - start), f, 0.3)
        y[n0:n0 + len(seg)] += seg
    return y


def shimmer():
    t = _t(0.8)
    rng = np.random.default_rng(2)
    y = np.zeros_like(t)
    for f in (2093, 2637, 3136, 3951, 4699):
        trem = 0.6 + 0.4 * np.sin(2 * np.pi * rng.uniform(5, 11) * t + rng.uniform(0, 6.28))
        y += np.sin(2 * np.pi * f * t + rng.uniform(0, 6.28)) * trem
    return y * np.sin(np.pi * t / 0.8) ** 2


def rumble():
    t = _t(0.8)
    y = _lowpass(_noise(3, len(t)), 90) * 6 + 0.6 * np.sin(2 * np.pi * 48 * t)
    return y * np.minimum(t / 0.12, 1) * _decay(t, 0.5)


def buzz():
    t = _t(0.35)
    y = np.zeros_like(t)
    for f in (110.0, 117.0):                                 # slightly clashing pair
        for h in (1, 3, 5, 7):
            y += np.sin(2 * np.pi * f * h * t) / h ** 1.5
    return _lowpass(y, 900) * (0.7 + 0.3 * np.sin(2 * np.pi * 20 * t))


def rise():
    t = _t(1.0)
    f = 220 * (4.0 ** (t / 1.0))                              # 220 -> 880 Hz glide
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR)
    air = _lowpass(_noise(4, len(t)), 400 + 3000 * t) * 0.8
    return (tone * 0.6 + air) * (t / 1.0) ** 1.5


def thud():
    t = _t(0.3)
    f = 45 + 45 * _decay(t, 0.05)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * _decay(t, 0.09)
    knock = _lowpass(_noise(5, len(t)), 300) * _decay(t, 0.012) * 1.5
    return body + knock


SOUNDS = {
    "whoosh": (whoosh, "filtered noise, cutoff sweeps up then down"),
    "pop": (pop, "sine with a quick pitch drop 600 to 300 Hz"),
    "tick": (tick, "very short 1.8 kHz sine blip"),
    "chime": (chime, "two soft bell notes G5 and D6"),
    "shimmer": (shimmer, "five high sines with slow tremolo"),
    "rumble": (rumble, "low-passed noise plus 48 Hz sine"),
    "buzz": (buzz, "two clashing low buzzes, soft low-passed"),
    "rise": (rise, "sine glide 220 to 880 Hz plus rising airy noise"),
    "thud": (thud, "pitch-dropping low sine plus soft knock"),
}


def finish(y):
    """Apply the fades and normalise to the peak target. Returns int16 array."""
    y = np.asarray(y, dtype=float).copy()
    y -= y.mean()
    n_in, n_out = int(FADE_IN * SR), int(FADE_OUT * SR)
    y[:n_in] *= np.linspace(0, 1, n_in)
    y[-n_out:] *= np.linspace(1, 0, n_out)
    y *= 10 ** (PEAK_DBFS / 20) / np.max(np.abs(y))
    return np.round(y * 32767).astype(np.int16)


def write_wav(path, samples):
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(samples.tobytes())


def generate(out_dir=OUT_DIR):
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    rows = []
    for name, (fn, how) in SOUNDS.items():
        path = out_dir / f"{name}.wav"
        write_wav(path, finish(fn()))
        rows.append([path.name, "synthesised with numpy: " + how,
                     "own work, made by pipeline/sfx.py",
                     hashlib.sha256(path.read_bytes()).hexdigest()])
    with open(out_dir / "SOURCES.csv", "w", newline="", encoding="utf-8") as f:
        wr = csv.writer(f, lineterminator="\n")
        wr.writerow(["file", "how made", "licence", "sha256"])
        wr.writerows(rows)
    return rows


if __name__ == "__main__":
    for r in generate():
        print(r[0], r[3][:12])
