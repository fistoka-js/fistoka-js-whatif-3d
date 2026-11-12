"""The fallback show (pipeline/fallback.py) must pass the real checker for any script."""
import json
import random
import shutil
import subprocess
from pathlib import Path

import pytest

from pipeline import fallback

REPO = Path(__file__).resolve().parents[2]
VOCAB = ("the water ice planet rocket moon sun fish brain heart cell virus clock gear light heat cold big small "
         "fast slow star earth ocean air molecule atom and of to in it is was a an but so why what if "
         "two-thirds 10,000 don't it's").split()


def fake_words(rng, n_words):
    """words.json for a random script: punctuation, repeated words, varied pauses."""
    words, t = [], rng.uniform(0.05, 0.3)
    for i in range(n_words):
        w = rng.choice(VOCAB)
        if rng.random() < 0.25:
            w = "the"                                    # lots of repeats
        r = rng.random()
        if r < 0.12:
            w += "."
        elif r < 0.16:
            w += "?"
        elif r < 0.22:
            w += ","
        elif r < 0.24:
            w += " —"
        if i == 0:
            w = w.capitalize()
        dur = rng.uniform(0.12, 0.5)
        words.append({"text": w, "start": round(t, 3), "end": round(t + dur, 3)})
        t += dur + (rng.uniform(0.3, 0.6) if w[-1] in ".?" else rng.uniform(0.0, 0.12))
    return words


def validate(tmp, show, words):
    tmp.mkdir(parents=True, exist_ok=True)
    (tmp / "show.json").write_text(json.dumps(show), encoding="utf-8")
    (tmp / "words.json").write_text(json.dumps(words), encoding="utf-8")
    (tmp / "voice.mp3").write_bytes(b"")                 # the checker only needs the file to exist
    p = subprocess.run(["node", "tools/validate.mjs", str(tmp), "--json"], cwd=REPO, capture_output=True,
                       text=True, encoding="utf-8")
    return json.loads(p.stdout)


@pytest.mark.skipif(shutil.which("node") is None, reason="node is not installed")
def test_fifty_random_scripts_all_validate(tmp_path):
    rng = random.Random(1234)
    lengths = [1, 2, 3, 5, 8] + [rng.randint(10, 190) for _ in range(45)]
    for n, length in enumerate(lengths):
        words = fake_words(rng, length)
        show = fallback.build_fallback_show(words, f"Test {n}", seed=n)
        result = validate(tmp_path / f"s{n}", show, words)
        assert result["ok"], f"script {n} ({length} words): {result['errors'][:3]}"


def test_shots_rotate_environments_and_moves():
    rng = random.Random(7)
    words = fake_words(rng, 140)
    show = fallback.build_fallback_show(words, "T", seed=3)
    assert len(show["shots"]) >= 5
    envs = [json.dumps(s["env"], sort_keys=True) for s in show["shots"]]
    assert all(a != b for a, b in zip(envs, envs[1:]))
    moves = [s["camera"]["move"] for s in show["shots"]]
    assert all(a != b for a, b in zip(moves, moves[1:]))


def test_named_prop_is_used():
    words = [{"text": t, "start": i * 0.4, "end": i * 0.4 + 0.3}
             for i, t in enumerate("A rocket goes up into the sky today.".split())]
    show = fallback.build_fallback_show(words, "T")
    assert show["shots"][0]["props"][0]["type"] == "rocket"


def test_same_seed_same_show():
    rng = random.Random(9)
    words = fake_words(rng, 80)
    assert fallback.build_fallback_show(words, "T", seed=2) == fallback.build_fallback_show(words, "T", seed=2)


def test_empty_words_raise():
    with pytest.raises(ValueError):
        fallback.build_fallback_show([], "T")
