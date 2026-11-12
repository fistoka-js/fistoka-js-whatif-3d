import hashlib
import math
import wave

import numpy as np

from pipeline import sfx

NAMES = ["whoosh", "pop", "tick", "chime", "shimmer", "rumble", "buzz", "rise", "thud"]
LENGTHS = {"whoosh": 0.5, "pop": 0.12, "tick": 0.04, "chime": 0.9, "shimmer": 0.8,
           "rumble": 0.8, "buzz": 0.35, "rise": 1.0, "thud": 0.3}


def read(path):
    with wave.open(str(path), "rb") as w:
        assert (w.getframerate(), w.getnchannels(), w.getsampwidth()) == (48000, 1, 2)
        return np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16) / 32768.0


def test_deterministic(tmp_path):
    a, b = tmp_path / "a", tmp_path / "b"
    sfx.generate(a)
    sfx.generate(b)
    for n in NAMES:
        assert (a / f"{n}.wav").read_bytes() == (b / f"{n}.wav").read_bytes()
    assert (a / "SOURCES.csv").read_text() == (b / "SOURCES.csv").read_text()


def test_peak_length_and_fades(tmp_path):
    sfx.generate(tmp_path)
    for n in NAMES:
        x = read(tmp_path / f"{n}.wav")
        peak_db = 20 * math.log10(np.max(np.abs(x)))
        assert abs(peak_db - (-3.0)) < 0.02, n
        assert abs(len(x) / 48000 - LENGTHS[n]) < 0.01, n
        assert abs(x[0]) < 0.02 and abs(x[-1]) < 0.01, n   # fades: starts and ends near silence


def test_committed_files_match_generator(tmp_path):
    """The WAVs in assets/sfx must be what the code makes (so SOURCES.csv hashes are true)."""
    sfx.generate(tmp_path)
    for n in NAMES:
        assert (tmp_path / f"{n}.wav").read_bytes() == (sfx.OUT_DIR / f"{n}.wav").read_bytes()
    lines = (sfx.OUT_DIR / "SOURCES.csv").read_text().splitlines()
    for line in lines[1:]:
        name, sha = line.split(",")[0], line.split(",")[-1]
        assert hashlib.sha256((sfx.OUT_DIR / name).read_bytes()).hexdigest() == sha
