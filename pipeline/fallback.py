"""A plain show that always passes the checker, built from the spoken words alone.

Used when the LLM could not produce a valid show after its repair rounds. It is not pretty, but it
always plays: one shot per sentence or two, environments and a few safe props rotated by a seeded
choice (a prop named in the shot's words is used when the catalogue has it), "text" overlays of 1-3
key words, and varied camera moves.

build_fallback_show(words, title, seed=0) -> show dict. words = words.json content.
Its guarantees are tested over many random scripts in tests/py/test_fallback.py.
"""
import random
import re

# Safe environments (every value here is valid for that environment).
ENVS = [
    {"type": "space", "nebula": "blue"},
    {"type": "studio", "color": "teal", "floor": False},
    {"type": "micro", "tint": "cool"},
    {"type": "space", "nebula": "purple"},
    {"type": "studio", "color": "indigo", "floor": False},
    {"type": "underwater", "depth": "shallow", "seabed": False},
    {"type": "micro", "tint": "warm"},
    {"type": "sky", "time": "day", "ground": "none", "clouds": 0.5},
]
# Props that look fine alone with default params, in a floor-less environment.
SAFE_PROPS = ["planet", "atom", "crystal", "gear", "lightbulb", "galaxy", "molecule", "ball", "clock", "dna"]
# Props that may be picked because a shot's words name them (all build with default params).
NAMED_PROPS = {
    "planet", "sun", "volcano", "cloud", "black_hole", "asteroid", "comet", "rocket", "satellite", "galaxy",
    "atom", "molecule", "magnet", "lightning", "tree", "city", "house", "rock", "island", "iceberg", "fire",
    "crystal", "person", "crowd", "brain", "heart", "eye", "virus", "cell", "dna", "fish", "bird",
    "dinosaur", "car", "plane", "ship", "submarine", "lightbulb", "battery", "thermometer", "clock",
    "gauge", "phone", "gear", "mountain",
}
WORD_TO_PROP = {"planets": "planet", "stars": "sun", "star": "sun", "moon": "planet", "earth": "planet",
                "rockets": "rocket", "trees": "tree", "houses": "house", "rocks": "rock", "cells": "cell",
                "viruses": "virus", "fishes": "fish", "birds": "bird", "cars": "car", "planes": "plane",
                "ships": "ship", "brains": "brain", "hearts": "heart", "eyes": "eye", "molecules": "molecule",
                "atoms": "atom", "people": "crowd", "volcanoes": "volcano", "clouds": "cloud",
                "comets": "comet", "asteroids": "asteroid", "mountains": "mountain", "bulb": "lightbulb"}
MOVES = ["push_in", "orbit", "pull_out", "drift", "rise", "pan"]
ANGLES = ["front", "three-quarter", "high", "front", "low", "side"]
COLOURS = ["yellow", "orange", "pink", "cyan", "white", "gold", "red", "green"]
STOP = set("""a an the and or but so of to in on at by for with from into onto than then that this these those
it its it's is are was were be been being do does did have has had not no yes you your we our they their
he she his her them us i me my if what why how when where which who whom will would can could should may
might must just very more most less much many some any all every each about over under up down out off
there here also even only still too as like such one two""".split())
MIN_SHOT, TARGET_SHOT, MAX_PIECE = 2.0, 4.0, 7.0


def norm(text):
    """Same normalisation the checker uses for phrase matching: letters and digits, lower case."""
    return re.sub(r"[^0-9a-z]+", "", text.lower())


def _sentence_ends(words):
    return [i for i, w in enumerate(words) if re.search(r"[.!?][\"')\]]*$", w["text"])]


def cut_points(words):
    """Word indices where shots start (always includes 0). Shots are at least MIN_SHOT seconds and
    try to end on sentence ends; a long stretch with no sentence end is cut at a word."""
    n = len(words)
    ends = set(_sentence_ends(words))
    cuts = [0]
    for i in range(1, n):
        since = words[i]["start"] - words[cuts[-1]]["start"]
        if (i - 1) in ends and since >= TARGET_SHOT:
            cuts.append(i)
        elif since >= MAX_PIECE:
            cuts.append(i)
    # The last shot must be long enough too: drop the last cut while it is too short.
    while len(cuts) > 1 and words[-1]["end"] + 0.4 - words[cuts[-1]]["start"] < MIN_SHOT:
        cuts.pop()
    return cuts


def anchor_for(words, i, search_from):
    """A phrase (1-6 words starting at word i) whose first match at or after word `search_from` is
    word i, so the checker resolves it to the right time. None if no such phrase exists."""
    keys = [norm(w["text"]) for w in words]
    if not keys[i]:
        return None
    for length in range(1, 7):
        if i + length > len(words):
            break
        phrase = keys[i:i + length]
        if any(not k for k in phrase):
            break
        first = None
        for j in range(search_from, len(words) - length + 1):
            if keys[j:j + length] == phrase:
                first = j
                break
        if first == i:
            return " ".join(w["text"] for w in words[i:i + length])
    return None


def key_words(words, limit=3):
    """1-3 longest meaningful words of a shot, in spoken order, in capitals, under 22 characters."""
    cands = []
    for k, w in enumerate(words):
        clean = re.sub(r"[^A-Za-z0-9'-]+", "", w["text"]).strip("'-")
        if len(clean) >= 4 and clean.lower() not in STOP:
            cands.append((len(clean), -k, k, clean.upper()))
    best = sorted(cands, reverse=True)[:limit]
    picked = [c[3] for c in sorted(best, key=lambda c: c[2])]
    text = ""
    for p in picked:
        if len((text + " " + p).strip()) <= 21:
            text = (text + " " + p).strip()
    return text or None


def named_prop(words):
    for w in words:
        k = re.sub(r"[^a-z_]+", "", w["text"].lower())
        k = WORD_TO_PROP.get(k, k)
        if k in NAMED_PROPS:
            return k
    return None


def build_fallback_show(words, title, seed=0):
    """A valid show for any non-empty words list."""
    if not words:
        raise ValueError("no words to build a show from")
    rng = random.Random(seed)
    envs = ENVS[:]
    rng.shuffle(envs)
    props = SAFE_PROPS[:]
    rng.shuffle(props)
    cuts = cut_points(words)
    # Each shot start is a phrase that the checker resolves to exactly that word. When no such
    # phrase exists (the same words were spoken just before), the start is the word's time instead:
    # safe here, because the fallback is built for this exact voice recording.
    shots = []
    kept = cuts
    starts = {}
    for k, c in enumerate(cuts[1:], start=1):
        phrase = anchor_for(words, c, cuts[k - 1])
        starts[c] = phrase if phrase is not None else {"time": words[c]["start"]}
    for s, c in enumerate(kept):
        end_i = kept[s + 1] if s + 1 < len(kept) else len(words)
        shot_words = words[c:end_i]
        prop_type = named_prop(shot_words) or props[s % len(props)]
        env = dict(envs[s % len(envs)])
        prop = {"id": "subject", "type": prop_type, "at": "center", "size": 1.1}
        shot = {
            "id": f"shot-{s + 1}",
            "env": env,
            "props": [prop],
            "camera": {"move": MOVES[(s + seed) % len(MOVES)], "angle": ANGLES[(s + seed) % len(ANGLES)],
                       "amount": 0.5},
            "actions": [
                {"at": {"shot": 0}, "do": "appear", "prop": "subject", "style": "grow"},
                {"at": {"shot": 0.55}, "do": "pulse", "prop": "subject", "strength": 0.2},
            ],
        }
        if s > 0:
            shot["start"] = starts[c]
        text = key_words(shot_words)
        if text:
            shot["actions"].append({"at": {"shot": 0.2}, "do": "text", "text": text, "style": "title",
                                    "pos": "top"})
        if s % 2 == 1:
            shot["actions"].append({"at": {"shot": 0.4}, "do": "color", "prop": "subject",
                                    "to": COLOURS[(s + seed) % len(COLOURS)]})
        shots.append(shot)
    # Keep the first shot's keys in the usual order: id first, no start.
    show = {"format": 1, "title": (title or "Untitled")[:120],
            "voice": {"audio": "voice.mp3", "words": "words.json"}, "shots": shots}
    # A very short voice still needs a shot of at least 1.5 s: stretch the tail (max 3 s).
    total = words[-1]["end"] + 0.4
    if total < 1.6:
        show["tail"] = round(min(3.0, 1.6 - words[-1]["end"]), 3)
    return show
