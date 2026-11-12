"""One real Edge TTS call. Needs internet. Run: pytest -m network"""
import json

import pytest

from pipeline.voice import make_voice

pytestmark = pytest.mark.network


def test_real_edge_voice(tmp_path):
    text = ("What if the Moon vanished tonight? At first — nothing. "
            "Over 10,000 years, our planet's tilt starts to wobble... and the seasons go wild.")
    stats = make_voice(text, tmp_path)
    words = json.loads((tmp_path / "words.json").read_text(encoding="utf-8"))
    assert (tmp_path / "voice.mp3").stat().st_size > 5000
    assert [w["text"] for w in words] == text.split() or len(words) == len(
        [t for t in text.split() if any(c.isalnum() for c in t)])
    assert all(a["end"] <= b["start"] + 0.05 for a, b in zip(words, words[1:]))
    assert 2.0 < stats["words_per_second"] < 4.0
    assert stats["duration"] >= words[-1]["end"] - 0.1
