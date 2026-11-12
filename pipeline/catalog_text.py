"""Compact text version of kit/catalog.json for the LLM prompt that writes show.json.

kit/catalog.json is generated from the kit's code (tools/catalog.mjs) and is too long for a
prompt (about 38 KB). catalog_text() turns it into short lines: one per prop, one per
environment, one per action, plus slots, camera options and colour names.

Run `python -m pipeline.catalog_text` to print it (and its size).
"""
import json
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
CATALOG_PATH = REPO / "kit" / "catalog.json"

# Which environments have a ground that non-floating props stand on. catalog.json does not
# carry this flag (it lives in each kit/envs/<name>.js meta as `ground`), so it is copied here.
# tests/py/test_catalog_text.py fails when an environment is added and is missing from this table.
ENV_GROUND = {
    "space": "no ground: everything floats",
    "studio": "ground (floor), unless floor: false",
    "sky": "ground (grass/ocean/desert/ice), unless ground: \"none\"",
    "underwater": "ground (seabed), unless seabed: false",
    "micro": "no ground: everything floats",
    "lab": "ground (grid floor)",
    "planet_surface": "ground (the planet's surface)",
}


# Easing names, listed once in the text instead of on every action that has an "ease" field.
EASES = ["in_out", "out", "in", "linear", "back", "bounce"]


def load_catalog(path=CATALOG_PATH):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def _num(v):
    """1.0 -> '1', 0.25 -> '0.25'."""
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    return str(v)


def _param(name, spec):
    """One prop/env param in short form, e.g. 'look=earth|moon', 'turn -1..1', 'color'."""
    t = spec.get("type")
    if t == "enum":
        return f"{name}=" + "|".join(spec["values"])
    if name == "seed":
        return "seed"                    # which random variant; the range does not matter
    if t in ("number", "int"):
        if "min" in spec and "max" in spec:
            return f"{name} {_num(spec['min'])}..{_num(spec['max'])}"
        return f"{name} (number)"
    if t == "bool":
        return f"{name}:bool"
    if t == "color":
        return name                      # colour fields are obvious from the name; see COLOURS
    if t == "point":
        return f"{name}=point"
    if t == "list":
        of = spec.get("of", {}).get("type", "value")
        return f"{name}=[{of}s, {spec.get('min', 1)}-{spec.get('max', '')}]"
    return f"{name} ({t})"


def _summary(p):
    """The prop summary without its 'Animate "x" ...' sentences, which repeat the anim list."""
    text = p["summary"]
    if p.get("animatable"):
        # A sentence ends at ". " before a capital letter, or at the very end ("0..1" is not an end).
        text = re.sub(r'\s*Animate .*?(?:\.(?=\s+[A-Z])|\.$)', "", text).strip()
    return text


def prop_line(name, p):
    flags = []
    if p.get("stageSpace"):
        flags.append("STAGE-SPACE")
    elif p.get("floats"):
        flags.append("floats")
    params = ", ".join(_param(k, v) for k, v in p.get("params", {}).items())
    anim = ", ".join(f"{k} {_num(a['min'])}..{_num(a['max'])} [starts {_num(a['default'])}]"
                     for k, a in p.get("animatable", {}).items())
    head = name + (" [" + ", ".join(flags) + "]" if flags else "")
    out = f"- {head} ({params})"
    if anim:
        out += f" anim: {anim}"
    return out + f" -- {_summary(p)}"


def env_line(name, e):
    params = ", ".join(_param(k, v) for k, v in e.get("params", {}).items())
    ground = ENV_GROUND.get(name, "UNKNOWN ground")
    return f"- {name} ({params}) [{ground}] -- {e['summary']}"


def _field(name, spec):
    """One action field: name, short type, (req) or default."""
    t = spec.get("type")
    if t == "enum" and spec["values"] == EASES:
        s = f"{name}=EASE"
    elif t == "enum":
        s = f"{name}=" + "|".join(spec["values"])
    elif t in ("number", "int") and "min" in spec and "max" in spec:
        s = f"{name} {_num(spec['min'])}..{_num(spec['max'])}"
    elif t == "list":
        s = f"{name}=[{spec.get('of', {}).get('type', 'value')}...]"
    else:
        s = f"{name}:{t}"
    if spec.get("required"):
        s += " (required)"
    elif "default" in spec and t != "enum":
        s += f" (default {json.dumps(spec['default'])})"
    elif t == "enum" and "default" in spec:
        s += f" (default {spec['default']})"
    return s


def action_line(name, a):
    prop = {"required": "prop", "optional": "prop optional", "none": "no prop"}[a["prop"]]
    over = f", over={_num(a['over'])}s" if "over" in a else ", no over"
    fields = "; ".join(_field(k, v) for k, v in a.get("fields", {}).items())
    return f"- {name} [{prop}{over}] {fields} -- {a['doc']}"


def catalog_text(cat=None):
    """The whole compact catalogue as one string."""
    cat = cat or load_catalog()
    lines = ["PROPS (name [floats/STAGE-SPACE] (params) anim: animatable params for the \"set\" action -- what it is)"]
    lines += [prop_line(n, p) for n, p in cat["props"].items()]
    lines += ["", "ENVIRONMENTS (name (params) [ground or not] -- what it is)"]
    lines += [env_line(n, e) for n, e in cat["envs"].items()]
    lines += ["", "ACTIONS [needs a prop or not, default \"over\" seconds] fields -- what it does. Every action has \"at\" (anchor) and \"do\". \"over\" (seconds) is allowed only where a default is listed."]
    lines += [action_line(n, a) for n, a in cat["actions"].items()]
    lines += ["EASE = " + "|".join(EASES)]
    slots = ", ".join(f"{k} [{', '.join(_num(x) for x in v)}]" for k, v in cat["slots"].items())
    lines += ["", f"SLOTS (for \"at\", \"to\", \"from\", \"place\"; or give [x, y, z]): {slots}"]
    cam = cat["camera"]
    lines += ["", "CAMERA fields:"]
    for k, spec in cam.items():
        if spec.get("options"):
            opts = "; ".join(f"{o} = {d}" for o, d in spec["options"].items())
            lines.append(f"- {k}: {opts} (default {spec.get('default')})")
        else:
            lines.append(f"- {_field(k, spec)} -- {spec.get('doc', '')}")
    lines += ["", "TRANSITIONS: " + "; ".join(f"{k} = {v}" for k, v in cat["transitions"].items())]
    lines += ["", "COLOURS: any #rrggbb, or a name: " + ", ".join(cat["colors"])
              + " (accent = the channel's yellow)"]
    pf = ", ".join(_field(k, v) for k, v in cat["propFields"].items())
    lines += ["", f"EVERY PLACED PROP has: {pf}. {cat['stageSpaceNote']}"]
    lines += [f"ANCHORS: {cat['anchors']}"]
    return "\n".join(lines) + "\n"


def main():
    text = catalog_text()
    sys.stdout.reconfigure(encoding="utf-8")
    print(text)
    print(f"[{len(text)} characters, about {len(text) // 4} tokens]", file=sys.stderr)


if __name__ == "__main__":
    main()
