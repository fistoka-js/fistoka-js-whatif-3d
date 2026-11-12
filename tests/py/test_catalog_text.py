"""The compact catalogue text for the show prompt (pipeline/catalog_text.py)."""
import re

from pipeline import catalog_text as CT


def test_every_prop_env_and_action_appears():
    cat = CT.load_catalog()
    text = CT.catalog_text(cat)
    for name in cat["props"]:
        assert re.search(rf"^- {re.escape(name)}[ (\[]", text, re.M), f"prop {name} missing"
    for name in cat["envs"]:
        assert re.search(rf"^- {re.escape(name)} \(", text, re.M), f"env {name} missing"
    for name in cat["actions"]:
        assert re.search(rf"^- {re.escape(name)} \[", text, re.M), f"action {name} missing"


def test_every_param_and_animatable_appears_on_its_line():
    cat = CT.load_catalog()
    lines = {l.split()[1]: l for l in CT.catalog_text(cat).splitlines() if l.startswith("- ")}
    for name, p in cat["props"].items():
        line = lines[name]
        for param in list(p["params"]) + list(p["animatable"]):
            assert param in line, f"{name}.{param} missing from: {line}"


def test_every_env_has_a_ground_entry():
    # catalog.json has no ground flag; a new environment must be added to ENV_GROUND by hand.
    cat = CT.load_catalog()
    assert set(cat["envs"]) == set(CT.ENV_GROUND), "update ENV_GROUND in pipeline/catalog_text.py"
    assert "UNKNOWN" not in CT.catalog_text(cat)


def test_floating_and_stage_space_props_are_marked():
    cat = CT.load_catalog()
    text = CT.catalog_text(cat)
    assert "- plane [floats]" in text
    assert "- beam [STAGE-SPACE]" in text
    assert "- car (" in text            # a ground prop has no flag


def test_size_stays_compact():
    # Target from the brief: about 3,500 tokens for 70 props (estimate: characters / 4).
    cat = CT.load_catalog()
    tokens = len(CT.catalog_text(cat)) / 4
    assert tokens < 3500 * len(cat["props"]) / 61 * 1.2
