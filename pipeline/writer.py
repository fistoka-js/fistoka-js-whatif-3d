"""The writer: topic -> script -> voice -> storyboard -> show.json, with checks and repairs.

    python -m pipeline.writer --topic "What if the Moon disappeared?" --slug moon-gone [--mode api|files]

Steps (docs/WRITER.md explains each in plain words):
  1. Script call (title, script, beats, description, tags, feasible, mechanism_prop, missing, claims).
     Not feasible -> shows/<slug>/NEEDS-PROPS.md and exit 3. The beat list says, per sentence, what
     stays on screen (subject), what visibly changes (change) and which dial drives it. A sentence
     with no showable change -> one "script-rewrite" call, before any voice is made. The same check
     runs on a redraft and on a shortened script; one rewrite per run in total.
  2. Fact check (pipeline/fact_check.py): flagged claims -> one redraft (it may also answer
     not feasible) -> anything still flagged is listed under NEEDS FACT CHECK in review.md.
  3. Voice (pipeline.voice.make_voice, free Edge TTS). Longer than the limit -> one "shorten" call
     (its script is beat-checked and fact-audited, "audit-shorten", before it is voiced), then voice again.
  4. Storyboard (setting "storyboard", on by default): a "storyboard" call plans every sentence's picture
     (storyboard.json, storyboard.md), a code check and a separate "storyboard-review" call judge it, and
     up to "storyboard_repairs" (setting, default 2) "storyboard-repairN" calls fix it. Still failing -> exit 1.
     A "central" gap -> NEEDS-PROPS.md, exit 3.
  5. Show call (gets the beat list and the storyboard) -> shows/<slug>/show.json -> node tools/validate.mjs
     --story-rules. Errors, the story.scenes / story.subject warnings, no dial bound to two or more things,
     or a storyboard prop, text or flow direction the show misses -> up to 3 repair rounds.
  6. Picture check (node tools/qa.mjs). fail -> one repair round, then check again; keep the best.
  7. No valid show at all -> pipeline/fallback.py builds a plain one, marked
     "fallback: not good enough to publish" (it is checked without the story rules).
  8. review.md (for the human) and writer.json (for the pipeline runner).

Exit codes: 0 show written (by the LLM or the fallback), 1 failed, 2 bad command,
3 topic needs props the catalogue lacks, 4 files mode is waiting for a reply file.
"""
import argparse
import hashlib
import json
import math
import re
import subprocess
import sys
import unicodedata
from collections import Counter
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path

from . import catalog_text, fact_check, fallback, llm

REPO = Path(__file__).resolve().parents[1]
PROMPTS = Path(__file__).resolve().parent / "prompts"
EXAMPLES = PROMPTS / "examples"
# Worked examples put into the show prompt. "rings" and "ice" are kept as folders but left out: they
# are slideshows (a new object per sentence) that fail the story rules, so they would teach the old style.
EXAMPLE_ORDER = ["chameleon"]
FALLBACK_NOTE = "fallback: not good enough to publish"

# Settings and their defaults. settings.yaml (optional, at the repo root) can override them under
# a "writer:" section, e.g.  writer:\n  model: claude-haiku-5-5
DEFAULTS = {
    "mode": "files",              # files (free, a person/agent answers) or api (paid)
    "model": llm.DEFAULT_MODEL,   # claude-sonnet-5-5; claude-haiku-5-5 is the cheap option
    "effort": "medium",           # api only: low | medium | high
    "max_repairs": 3,             # validator repair rounds
    "qa_repair": True,            # one repair round when the picture check fails
    "qa": True,                   # run the picture check at all (needs Chrome and 2 GB free RAM)
    "max_seconds": 60.0,          # the voice must end before this; up to 62 s is accepted; the 2.5 s tail makes the video 64.5 s at most
    "voice": "en-US-AndrewNeural",
    "rate": "+12%",
    "fallback_seed": 0,
    "storyboard": True,           # plan and review every sentence's picture before the show call
    "storyboard_repairs": 2,      # storyboard repair rounds after a failed review
}
TAIL_SECONDS = fallback.TAIL      # quiet seconds after the last word (same default as kit/engine/show.js)
WORD_FLOOR = 180                   # the script prompt asks for 180 to 195 words; a shorten never goes below this
WORD_FLOOR_TOLERANCE = 5           # the model counts words approximately: a reply this far under the floor is still accepted
STILL_OK_SECONDS = 2.0            # a voice up to this much over max_seconds is accepted with a note ("a little over 60 s is fine")
SCRIPT_MAX_TOKENS = 16000          # a cap, not a cost: thinking (always on) plus the JSON must fit
SHOW_MAX_TOKENS = 16000
STORYBOARD_MAX_TOKENS = 16000
TEXT_MIN_SECONDS = 2.5             # on-screen text and key numbers stay up at least this long (storyboard prompts say so)
TEXT_START_TOLERANCE = 1.5         # coverage check: the show's text may start this far from the storyboard's phrase
TEXT_END_TOLERANCE = 0.5           # coverage check: ... and may go away this much before the storyboard says
FLOW_PROPS = ("wire", "arrow", "beam")   # drawn from "from" to "to", so their direction can be checked

EXIT_OK, EXIT_FAILED, EXIT_USAGE, EXIT_NEEDS_PROPS, EXIT_WAITING = 0, 1, 2, 3, 4


# ---------------------------------------------------------------- settings

def _scalar(text):
    """A YAML-ish scalar: true/false, numbers, quoted or bare strings."""
    t = text.strip()
    if " #" in t:
        t = t.split(" #", 1)[0].strip()
    if t.lower() in ("true", "yes", "on"):
        return True
    if t.lower() in ("false", "no", "off"):
        return False
    if len(t) >= 2 and t[0] == t[-1] and t[0] in "\"'":
        return t[1:-1]
    try:
        return int(t)
    except ValueError:
        pass
    try:
        return float(t)
    except ValueError:
        return t


def load_settings(path=None):
    """DEFAULTS, overridden by the "writer:" section of settings.yaml if the file exists.
    Reads only flat "key: value" lines inside that section (no PyYAML needed)."""
    path = Path(path) if path else REPO / "settings.yaml"
    out = dict(DEFAULTS)
    if not path.exists():
        return out
    in_writer = False
    for raw in path.read_text(encoding="utf-8").splitlines():
        if not raw.strip() or raw.lstrip().startswith("#"):
            continue
        indent = len(raw) - len(raw.lstrip())
        if indent == 0:
            in_writer = raw.split(":", 1)[0].strip() == "writer"
            continue
        if in_writer and ":" in raw:
            key, value = raw.strip().split(":", 1)
            if key.strip() in DEFAULTS and value.strip():
                out[key.strip()] = _scalar(value)
    return out


# ---------------------------------------------------------------- text helpers

def read_prompt(name):
    return (PROMPTS / name).read_text(encoding="utf-8")


def fill(template, **values):
    for k, v in values.items():
        template = template.replace("{{" + k + "}}", str(v))
    return template


# Common abbreviations end in "." but do not end a sentence ("U.S. scientists", "Dr. Lee"). The script
# prompt asks for none ("US", "Doctor"); a real sentence that ends in one joins the next sentence.
ABBREVIATIONS = {"u.s.", "u.k.", "dr.", "mr.", "mrs.", "ms.", "st.", "prof.", "e.g.", "i.e.", "etc.", "vs."}


def sentences(words):
    """Group words.json entries into sentences (lists of words)."""
    out, cur = [], []
    for w in words:
        cur.append(w)
        if w["text"].lower() in ABBREVIATIONS or re.fullmatch(r"(?:[A-Za-z]\.){2,}", w["text"]):
            continue
        if re.search(r"[.!?…][\"')\]}”’»]*$", w["text"]):
            out.append(cur)
            cur = []
    if cur:
        out.append(cur)
    return out


def words_block(words):
    """S1 [0.09-1.46] What if Earth had rings like Saturn?
       What 0.09 | if 0.25 | ...   (one sentence per pair of lines)"""
    lines = []
    for n, sent in enumerate(sentences(words), 1):
        text = " ".join(w["text"] for w in sent)
        lines.append(f"S{n} [{sent[0]['start']:.2f}-{sent[-1]['end']:.2f}] {text}")
        lines.append("   " + " | ".join(f"{w['text']} {w['start']:.2f}" for w in sent))
    return "\n".join(lines)


def show_duration(words, tail=TAIL_SECONDS):
    return round(words[-1]["end"] + tail, 2)


def script_sentences(script):
    """The script's sentences as strings, split exactly as sentences() splits the voiced words, so
    beat n of the script call is sentence S n of the show prompt."""
    return [" ".join(w["text"] for w in s) for s in sentences([{"text": t} for t in str(script).split()])]


# The beat word check is tiny on purpose. A false alarm uses up the run's one rewrite; a miss only gives
# the show call a weaker plan (the show rules and the story-rules checker still judge the show). So a
# change is flagged only when it is empty or exactly one of the phrases below. Everything else passes.

# Every apostrophe-like character: dropped, so "doesn't" / "doesn’t" / "doesnʼt" are all "doesnt".
_APOSTROPHES = "'`´‘’‛ʹʼ′"


NO_VISIBLE_CHANGE = frozenset("""
none|n/a|nothing|no change|no visible change|nothing happens|nothing changes|nothing moves
stays|it stays|stays the same|it stays the same|remains the same|unchanged|same as before|static|idle
is shown|it is shown|shown|spins|it spins|bobs|it bobs|orbits|it orbits
camera move|zoom in|zoom out|zooms in|zooms out|pan|pans|pan left|pan right|pan across
the camera zooms in|the camera zooms out|the camera pans|the camera pulls back|the camera pushes in
a label appears|the label appears|text appears|a number counts up|the number counts up|the counter counts up
""".replace("\n", "|").strip("|").split("|"))


def is_no_change(change):
    """True when the change is empty or exactly one phrase of NO_VISIBLE_CHANGE (case, apostrophes, spaces
    and end punctuation ignored). Anything else passes: "nothing moves except the lattice" is a real change."""
    text = re.sub(f"[{re.escape(_APOSTROPHES)}]", "", str(change).lower())
    text = re.sub(r"^[\W_]+|[\W_]+$", "", " ".join(text.split()))   # any end punctuation: … “ ” — [ ] and so on
    return not re.search(r"\w", text) or text in NO_VISIBLE_CHANGE


def normalise_beats(value):
    """The script reply's "beats" as a list of {sentence, subject, change, dial} strings (bad entries kept empty)."""
    out = []
    for b in value if isinstance(value, list) else []:
        b = b if isinstance(b, dict) else {}
        out.append({k: str(b.get(k) or "").strip() for k in ("sentence", "subject", "change", "dial")})
    return out


def _plain_words(text):
    """Lower-case words only: quotes, apostrophes (any kind), punctuation, case, spacing and a thousands
    separator ("1,000" is "1000") do not matter."""
    text = re.sub(r"(?<=\d)[,\u00a0\u2009\u202f](?=\d{3}(?!\d))", "", str(text).lower())
    # "U.S.", "U.S", "p.m.", "p.m" are one word each (final dot optional)
    text = re.sub(r"(?<![a-z0-9.])[a-z](?:\.[a-z])+\.?(?![a-z0-9])", lambda m: m.group().replace(".", ""), text)
    return re.findall(r"[a-z0-9]+", re.sub(f"[{re.escape(_APOSTROPHES)}]", "", text))


def _run_in(small, big):
    """True when the words of small appear in big as one unbroken run of whole words."""
    n = len(small)
    return any(big[i:i + n] == small for i in range(len(big) - n + 1))


def sentence_matches(beat_sentence, real_sentence, n):
    """True when a beat's "sentence" is this sentence (copied or cut short), or empty
    (the count already guards the order). A bare number or "S3" label must be this beat's own number.
    Only a clearly different sentence (a shifted or swapped beat) is False. Whole words only, and a short
    sentence (under 5 words) must be copied almost exactly, so "No dye." is not "No paint."."""
    got, real = _plain_words(beat_sentence), _plain_words(real_sentence)
    if not got:
        return True
    if len(got) == 1 and re.fullmatch(r"s?\d+", got[0]) and got != real:   # a label, unless the sentence is that text
        return int(got[0].lstrip("s")) == n
    if got == real:
        return True
    if len(got) > 1 and re.fullmatch(r"s\d+|\d+", got[0]) and got[0] != real[0] and re.sub(r"\D", "", got[0]) != str(n):
        return False                                     # a label for another beat in front of the sentence
    # Try the words as given first (the number may be part of the sentence), then without a leading label:
    # "S2: No dye." is still sentence 2.
    tries = [got] + ([got[1:]] if len(got) > 1 and re.fullmatch(rf"s{n}|{n}", got[0]) else [])
    return any(_same_sentence(g, real) for g in tries)


def _same_sentence(got, real):
    """The word-list part of sentence_matches: copied, cut short, or copied with a few extra words."""
    if got == real:
        return True
    if len(real) < 5:
        small, big = sorted((got, real), key=len)
        return len(small) >= 2 and _run_in(small, big) and len(small) / len(big) >= 0.75
    if _run_in(got, real):                               # cut short: 3+ words, or the first 2
        return len(got) >= 3 or (len(got) == 2 and real[:2] == got)
    if _run_in(real, got):
        return len(got) - len(real) <= 3                 # the whole sentence plus a few extra words
    return False                                         # a changed key word ("black" for "white") is a different sentence


def beat_problems(script, beats):
    """Why a beat list cannot be used: missing, the wrong length, or a sentence with nothing that changes."""
    sents = script_sentences(script)
    problems = []
    if sents and "comment" not in sents[-1].lower():
        problems.append(f"the last sentence \"{sents[-1]}\" must ask viewers to answer in the comments "
                        f"(for example \"Comment your answer below.\")")
    if not beats:
        return ["there is no beat list: give one beat per sentence"] + problems
    if len(beats) != len(sents):
        problems.append(f"the beat list has {len(beats)} entries but the script has {len(sents)} sentences "
                        f"(a sentence ends at . ? or !): give exactly one beat per sentence, in order")
    for n, (sent, b) in enumerate(zip(sents, beats), 1):
        if not sentence_matches(b["sentence"], sent, n):
            problems.append(f"S{n} \"{sent}\": the beat's sentence is \"{b['sentence']}\", which is not this "
                            f"sentence. Copy each sentence into its own beat, in order")
        if not b["subject"]:
            problems.append(f"S{n} \"{sent}\": no subject (the thing on screen)")
        if is_no_change(b["change"]):
            problems.append(f"S{n} \"{sent}\": nothing visibly changes (\"{b['change']}\"). Name a change to "
                            f"the subject itself that happens while the sentence is spoken (a verb: grows, "
                            f"spreads, turns red, ...); a camera move, label, number, pulse or shake does not count")
    return problems


def beats_block(script, beats, n_sentences=None):
    """The beat list for the show prompt, one line per sentence; or a note when it is not usable.
    n_sentences: the number of sentences in the voiced words (the S numbers of the show prompt)."""
    if not beats or beat_problems(script, beats) or (n_sentences is not None and len(beats) != n_sentences):
        return "(no usable picture plan came with this script: plan one change per sentence yourself)"
    lines = []
    for n, b in enumerate(beats, 1):
        line = f"S{n} subject: {b['subject']} | change: {b['change']}"
        lines.append(line + (f" | dial: {b['dial']}" if b["dial"] and b["dial"] != "-" else ""))
    return "\n".join(lines)


def compact_json(show):
    """show.json with one prop or action per line: readable and about half the tokens of indent=2."""
    def j(v):
        return json.dumps(v, ensure_ascii=False)
    shots = show.get("shots", [])
    if not isinstance(shots, list) or not all(isinstance(s, dict) and all(isinstance(s.get(k, []), list) for k in ("props", "actions")) for s in shots):
        return json.dumps(show, indent=1, ensure_ascii=False)     # malformed: the repair still gets to see it
    head = {k: v for k, v in show.items() if k != "shots"}
    lines = ["{"]
    for k, v in head.items():
        lines.append(f"  {j(k)}: {j(v)},")
    lines.append('  "shots": [')
    for si, shot in enumerate(show.get("shots", [])):
        lines.append("    {")
        keys = [k for k in shot if k not in ("props", "actions")]
        parts = []
        for k in keys:
            parts.append(f"      {j(k)}: {j(shot[k])}")
        for k in ("props", "actions"):
            if k in shot:
                items = shot[k]
                inner = ",\n".join(f"        {j(x)}" for x in items)
                parts.append(f"      {j(k)}: [\n{inner}\n      ]" if items else f"      {j(k)}: []")
        lines.append(",\n".join(parts))
        lines.append("    }" + ("," if si < len(show["shots"]) - 1 else ""))
    lines.append("  ]")
    lines.append("}")
    return "\n".join(lines)


def catalog_names(cat):
    """For the script prompt: prop and environment names with their one-line summaries, each prop's
    animatable values and each environment's dial parameters (what a dial can drive)."""
    lines = ["Props:"]
    for n, p in cat["props"].items():
        anim = ", ".join(p.get("animatable", {}))
        lines.append(f"- {n}: {catalog_text._summary(p)}" + (f" [can vary: {anim}]" if anim else ""))
    lines += ["Environments:"]
    for n, e in cat["envs"].items():
        dial = f" [can follow a dial (dialParams): {', '.join(e['dialParams'])}]" if e.get("dialParams") else ""
        lines.append(f"- {n}:{dial} {e['summary']}")
    return "\n".join(lines)


def examples_text():
    """The worked examples for the show prompt: input (words and picture plan, as a real call gives them), notes, output show."""
    out = []
    for n, name in enumerate(EXAMPLE_ORDER, 1):
        d = EXAMPLES / name
        show = json.loads((d / "show.json").read_text(encoding="utf-8"))
        words = json.loads((d / "words.json").read_text(encoding="utf-8"))
        plan = (d / "plan.md").read_text(encoding="utf-8").strip()
        notes = (d / "notes.md").read_text(encoding="utf-8").strip()
        # The heading line is taken from show_user.md so the example input reads exactly like a real call.
        heading = next(l for l in read_prompt("show_user.md").splitlines() if l.startswith("THE PICTURE PLAN"))
        out.append(f"## Example {n}: {show['title']}\n\nINPUT (exactly what you will get):\n"
                   f"{words_block(words)}\n\n{heading}\n{plan}\n\n"
                   f"NOTES ON THIS EXAMPLE (not part of the input or the reply):\n{notes}\n\n"
                   f"OUTPUT (the reply):\n{compact_json(show)}")
    return "\n\n".join(out)


def show_system_prompt(cat=None):
    cat = cat or catalog_text.load_catalog()
    return fill(read_prompt("show_system.md"), CATALOG=catalog_text.catalog_text(cat).strip(),
                EXAMPLES=examples_text(), TEXT_SECONDS=f"{TEXT_MIN_SECONDS:g}")


def script_system_prompt(cat=None):
    cat = cat or catalog_text.load_catalog()
    return fill(read_prompt("script_system.md"), CATALOG_NAMES=catalog_names(cat))


def show_user_prompt(title, words, script="", beats=None, board=None):
    """board: the approved storyboard (None when the storyboard step is off: the prompt is then as before)."""
    dur = show_duration(words)
    story = "" if not board else fill(read_prompt("show_storyboard.md"), BOARD=storyboard_text(board))
    return fill(read_prompt("show_user.md"), TITLE=title, WORDS=words_block(words),
                LAST_END=f"{words[-1]['end']:.2f}", DURATION=f"{dur:.2f}",
                BEATS=beats_block(script, beats, len(sentences(words))), STORYBOARD=story)


# ---------------------------------------------------------------- parsing replies

class BadReply(ValueError):
    pass


def strip_fence(text):
    """Remove one surrounding ``` code fence, if there is one."""
    t = text.strip()
    m = re.match(r"^```[A-Za-z]*\s*\n(.*?)\n?```\s*$", t, re.S)
    return m.group(1).strip() if m else t


def parse_show_reply(text):
    """The show reply must be one JSON object (after stripping one code fence)."""
    try:
        obj = json.loads(strip_fence(text))
    except (ValueError, RecursionError) as e:     # JSONDecodeError, and "Exceeds the limit (4300 digits)"
        raise BadReply(f"the reply is not valid JSON ({e})") from e
    if not isinstance(obj, dict):
        raise BadReply("the reply is JSON but not an object")
    return obj


def parse_loose_json(text):
    """For script-type replies: strip fences, take the outermost {...} (as the old draft step did)."""
    raw = strip_fence(text)
    start, end = raw.find("{"), raw.rfind("}") + 1
    if start >= 0 and end > start:
        raw = raw[start:end]
    try:
        obj = json.loads(raw)
    except (ValueError, RecursionError) as e:     # JSONDecodeError, and "Exceeds the limit (4300 digits)"
        raise BadReply(f"the reply is not valid JSON ({e})") from e
    if not isinstance(obj, dict):
        raise BadReply("the reply is JSON but not an object")
    return obj


def clean_script(text):
    """Only the words to be spoken: [bracketed notes] removed, whitespace collapsed."""
    text = re.sub(r"\[[^\]]*\]", " ", str(text or ""))
    text = text.replace("[", " ").replace("]", " ")
    text = re.sub(r"\s+([.,!?;:])", r"\1", " ".join(text.split()))
    return text.strip()


def as_list(value):
    if isinstance(value, list):
        return [str(x).strip() for x in value if str(x).strip()]
    if isinstance(value, str) and value.strip():
        return [p.strip() for p in re.split(r"[,\n]", value) if p.strip()]
    return []


def normalise_show(show, title):
    """Fill the fixed top-level fields the model might get wrong (they are not creative choices)."""
    show["format"] = 1
    show["voice"] = {"audio": "voice.mp3", "words": "words.json"}
    if not isinstance(show.get("title"), str) or not show["title"].strip():
        show["title"] = title
    return show


# ---------------------------------------------------------------- tools (node)

def node_json(args, timeout=600):
    """Run a node tool with --json and return (exit code, parsed json or None, stderr)."""
    p = subprocess.run(["node", *args, "--json"], cwd=REPO, capture_output=True, text=True,
                       encoding="utf-8", errors="replace", timeout=timeout)
    try:
        data = json.loads(p.stdout) if p.stdout.strip() else None
    except json.JSONDecodeError:
        data = None
    return p.returncode, data, p.stderr


def validate_show(folder, story_rules=True):
    """{"ok", "errors": [{path, message, hint}], "warnings"} from node tools/validate.mjs.
    story_rules: also check that the picture follows the words (SPEC section 14). On for every show the
    model writes; off only for the fallback, which is a plain slideshow by design."""
    flag = "--story-rules" if story_rules else "--no-story-rules"
    code, data, err = node_json(["tools/validate.mjs", str(folder), flag])
    if data is None:
        return {"ok": False, "errors": [{"path": "validator", "message": f"validator did not run: {err[-300:]}",
                                         "hint": ""}], "warnings": []}
    return data


def run_qa(slug):
    """{"result": pass|warn|fail, "findings": [...]} from node tools/qa.mjs, or result "not_run"."""
    try:
        code, data, err = node_json(["tools/qa.mjs", slug], timeout=900)
    except (OSError, subprocess.TimeoutExpired) as e:
        return {"result": "not_run", "reason": str(e)[:300], "findings": []}
    if data is None or "result" not in data:
        return {"result": "not_run", "reason": (err.strip() or "no output")[-300:], "findings": []}
    return data


def default_voice(script, folder, settings):
    from . import voice
    return voice.make_voice(script, folder, voice=settings["voice"], rate=settings["rate"])


# ---------------------------------------------------------------- the run

class Run:
    """Everything one writer run collects, for review.md and writer.json."""

    def __init__(self, topic, slug, folder, settings, mode):
        self.topic, self.slug, self.folder, self.settings, self.mode = topic, slug, folder, settings, mode
        self.calls = []                  # one dict per LLM call
        self.draft = {}
        # The beat list check (see beat_problems): was the script sent back once, and why.
        # The rewrite budget is one per run, shared by the first script, the redraft and the shorten.
        self.beats = {"rewritten": False, "first_problems": [], "error": None, "rewrite_after": None}
        self.warnings = []               # checker warnings on the accepted show, for review.md
        self.fact = {"first_audit": None, "final_audit": None, "redrafted": False,
                     "redraft_error": None, "needs_fact_check": False,
                     "audited": "script"}      # which script final_audit checked: script | redraft | shorten
        self.voice_stats = None
        self.voice_note = ""
        self.not_feasible_step = None    # which call answered "feasible": false (the run stops for props)
        self.show_source = "none"        # llm | fallback | none
        self.repairs = 0
        self.history = []                # one line per show attempt
        self.qa = {"result": "not_run", "reason": "no show", "findings": []}
        # The storyboard step (None when it is off): the board, the reviewer's last verdict and notes, repairs.
        self.storyboard = None
        self.props_wanted = []           # non-central gaps: drawn with a stand-in, listed for prop building
        self.status = "failed"
        self.error = None

    def price_model(self):
        return self.settings["model"]

    def record(self, reply):
        cost = llm.reply_cost(reply, None if reply.model != "files" else self.price_model())
        self.calls.append({"purpose": reply.purpose, "model": reply.model,
                           "input_tokens": reply.input_tokens, "output_tokens": reply.output_tokens,
                           "cache_read_tokens": reply.cache_read_tokens,
                           "cache_write_tokens": reply.cache_write_tokens,
                           "estimated": reply.estimated, "cost_usd": round(cost, 5)})

    def totals(self):
        t = {k: sum(c[k] for c in self.calls) for k in
             ("input_tokens", "output_tokens", "cache_read_tokens", "cache_write_tokens")}
        t["cost_usd"] = round(sum(c["cost_usd"] for c in self.calls), 4)
        t["estimated"] = any(c["estimated"] for c in self.calls)
        return t


def _ask(run, complete, system, user, purpose, max_tokens):
    reply = complete(system, user, purpose=purpose, max_tokens=max_tokens)
    reply.purpose = reply.purpose or purpose
    run.record(reply)
    return reply.text


class NotFeasible(Exception):
    """The model answered "feasible": false: no prop can show the mechanism. The writer stops with
    NEEDS-PROPS.md (exit 3)."""


# Shown in writer.json and review.md when the beat check still fails after the one rewrite.
BEATS_NOTE = "script has sentences with no visible change"
BEATS_NOTE_OTHER = "the picture plan does not fit the script"


def beats_note(problems):
    """The label for the problems left: "no visible change" only when a problem really says that; a
    wrong beat count or a missing subject gets the plain "does not fit" label."""
    if any("nothing visibly changes" in p for p in problems):
        return BEATS_NOTE
    return BEATS_NOTE_OTHER if problems else None


def _stop_not_feasible(run, reply, step):
    """Stop for props. run.draft stays the last script the run accepted (the one the audit on file and
    review.md describe), never an unchecked redraft or shortened script; it only gets the reply's
    feasibility fields for NEEDS-PROPS.md. step: which call answered not feasible, for review.md."""
    run.draft = dict(run.draft, **{k: reply[k] for k in ("feasible", "mechanism_prop", "missing") if k in reply})
    run.not_feasible_step = step
    raise NotFeasible()


def _script_and_beats(draft):
    """The current title, script and beat list as JSON, for a prompt that asks for a change to them."""
    return json.dumps({k: draft.get(k) for k in ("title", "script", "beats")}, ensure_ascii=False, indent=1)


def carry_over(new, old):
    """Fill the keys a model reply left out (title, tags, ...) from the draft it replaced. Claims are NOT
    carried: they describe one particular script, so a reply with none gets an empty list plus a flag
    that review.md shows, never the claims of a script that is not the voiced one."""
    for k, v in old.items():
        if k not in ("claims", "claims_missing"):
            new.setdefault(k, v)
    new.pop("claims_missing", None)
    if not as_list(new.get("claims")):
        new["claims"], new["claims_missing"] = [], True
    return new


def check_beats(run, complete, system, draft, after, max_words=None):
    """Send the script back when a sentence has nothing that visibly changes (it would become a still
    picture). Runs on the first script, on a fact-check redraft and on a shortened script, before that
    script is voiced; at most ONE rewrite per run in total. Returns the draft to use (raises NotFeasible
    when the rewrite answers "feasible": false). after: what made this draft, for review.md.
    max_words: set after a shorten: the rewrite is told this limit wins over the usual 180 to 195 word length
    (the shorten target itself is never below the 180-word floor), and a
    rewrite that comes back longer is not used (the shortened script is kept and the problem reported)."""
    problems = beat_problems(draft["script"], draft["beats"])
    if not problems or run.beats["rewritten"]:
        return draft                     # fine, or the budget is used: left_beat_problems reports it
    length = ("about the same number of words" if not max_words else
              f"at most {max_words} words: this script was just shortened to fit the voice limit, so that "
              f"word limit wins over the 180 to 195 word length, but never go below {WORD_FLOOR} words")
    rewrite_user = fill(read_prompt("script_rewrite_user.md"), TOPIC=run.topic,
                        PREVIOUS=_script_and_beats(draft), PROBLEMS="\n".join(f"- {p}" for p in problems),
                        LENGTH=length)
    run.beats.update(rewritten=True, first_problems=problems, rewrite_after=after)
    try:
        new = parse_loose_json(_ask(run, complete, system, rewrite_user, "script-rewrite", SCRIPT_MAX_TOKENS))
    except (BadReply, llm.LlmError) as e:
        run.beats["error"] = f"{type(e).__name__}: {str(e)[:160]}; kept the script it was asked about"
        return draft
    new["script"] = clean_script(new.get("script"))
    new["beats"] = normalise_beats(new.get("beats"))
    if new.get("feasible") is False:
        _stop_not_feasible(run, new, f"the beat rewrite after the {after} step")
    if not new["script"]:
        run.beats["error"] = "the rewrite had no script text; kept the script it was asked about"
        return draft
    # The same rule as the shortened script itself: over the target is reported, and a text is only
    # thrown away when a shorter one is at hand. So a rewrite is not used when it is over the target AND
    # longer than the shortened script it replaces.
    n_new = len(new["script"].split())
    if max_words and n_new < WORD_FLOOR - WORD_FLOOR_TOLERANCE:
        run.beats["error"] = (f"the rewrite had {n_new} words, below the {WORD_FLOOR}-word floor, so it was NOT "
                              f"used; kept the shortened script")
        return draft
    if max_words and n_new > max(max_words, len(draft["script"].split())):
        run.beats["error"] = (f"the rewrite had {n_new} words, over the {max_words}-word limit from the shorten "
                              f"step and longer than the shortened script, so it was NOT used; kept the "
                              f"shortened script")
        return draft
    if max_words and n_new > max_words:
        run.beats["length_note"] = (f"The rewrite had {n_new} words, over the {max_words}-word target from the "
                                    f"shorten step, but no longer than the shortened script, so it was used")
    return carry_over(new, draft)


def left_beat_problems(run):
    """What is still wrong with the final script's beat list (empty when it is usable)."""
    d = run.draft
    return beat_problems(d.get("script", ""), d.get("beats") or []) if d.get("script") else []


def write_script_step(run, complete, cat):
    """Script call + beat check + fact check (+ one redraft). Returns the draft dict; raises NotFeasible."""
    system = script_system_prompt(cat)
    user = fill(read_prompt("script_user.md"), TOPIC=run.topic)
    draft = parse_loose_json(_ask(run, complete, system, user, "script", SCRIPT_MAX_TOKENS))
    draft["script"] = clean_script(draft.get("script"))
    draft["beats"] = normalise_beats(draft.get("beats"))
    if draft.get("feasible") is False:
        # Nothing accepted: keep only the feasibility fields, never a script the reply also carried.
        run.draft = {k: draft[k] for k in ("title", "feasible", "mechanism_prop", "missing") if k in draft}
        run.not_feasible_step = "the script call"
        raise NotFeasible()
    run.draft = draft
    if not draft["script"]:
        raise BadReply("the script reply had no script text")
    run.draft = draft = check_beats(run, complete, system, draft, "script")

    def audit_call(purpose):
        return lambda prompt: _ask(run, complete, "", prompt, purpose, SCRIPT_MAX_TOKENS)

    first = fact_check.audit_script(draft["script"], "", run.topic, llm_call=audit_call("audit"))
    run.fact["first_audit"] = run.fact["final_audit"] = first
    if first["available"] and not first["ok"]:
        flagged = fact_check.flagged_claims(first)
        # The redraft sees the CURRENT script and beats (after any beat rewrite), not just the topic.
        redraft_user = fill(read_prompt("script_redraft_user.md"), TOPIC=run.topic,
                            PREVIOUS=_script_and_beats(draft),
                            CORRECTIONS=fact_check.build_corrections_block(flagged))
        try:
            redraft = parse_loose_json(_ask(run, complete, system, redraft_user, "script-redraft",
                                            SCRIPT_MAX_TOKENS))
            if redraft.get("feasible") is False:
                _stop_not_feasible(run, redraft, "the fact-check redraft")
            script = clean_script(redraft.get("script"))
            if not script:
                raise BadReply("the redraft had no script text")
            # The redraft's own beat list (or none): the old one may no longer match its sentences.
            redraft["beats"] = normalise_beats(redraft.get("beats"))
            redraft["script"] = script
            carry_over(redraft, draft)
            # Checked before the second audit, so the audited script is the one that is voiced.
            redraft = check_beats(run, complete, system, redraft, "redraft")
            final = fact_check.audit_script(redraft["script"], "", run.topic,
                                            llm_call=audit_call("audit-redraft"))
            run.draft = draft = redraft
            run.fact["redrafted"] = True
            run.fact["final_audit"] = final
            run.fact["audited"] = "redraft"
        except (BadReply, llm.LlmError) as e:
            # The redraft is optional: keep the first script and mark it for a human check.
            run.fact["redraft_error"] = f"{type(e).__name__}: {str(e)[:200]}"
    fa = run.fact["final_audit"]
    run.fact["needs_fact_check"] = (not fa["ok"]) or run.fact["redraft_error"] is not None
    return draft


def voice_step(run, complete, voice_fn, cat):
    """Make voice.mp3 and words.json (only when script.txt changed); shorten once if too long."""
    folder = run.folder
    script = run.draft["script"]
    stats = _voice_if_needed(folder, script, voice_fn, run.settings)
    limit = float(run.settings["max_seconds"])
    n_words = len(script.split())
    if stats["duration"] > limit and n_words > WORD_FLOOR:      # at the floor a shorten could only make it longer
        wps = stats["word_count"] / max(stats["duration"], 1)
        # Never ask for more words than the script has now, and never fewer than the floor.
        target = min(n_words, max(WORD_FLOOR, stats["word_count"] - (math.ceil((stats["duration"] - limit) * wps) + 6)))
        cut = n_words - target
        user = fill(read_prompt("shorten_user.md"), TOPIC=run.topic, SCRIPT=script,
                    SECONDS=f"{stats['duration']:.1f}", LIMIT=f"{limit:.0f}", WORDS=cut, TARGET=target, FLOOR=WORD_FLOOR)
        try:
            short = parse_loose_json(_ask(run, complete, script_system_prompt(cat), user, "shorten",
                                          SCRIPT_MAX_TOKENS))
            new_script = clean_script(short.get("script"))
            n_reply = len(new_script.split())
            if new_script and n_reply < WORD_FLOOR - WORD_FLOOR_TOLERANCE:
                # No model call here (the reply is already consumed), no re-voice, no new audit: the
                # kept long script is still the one on file and the one voiced.
                run.voice_note = (f"the shortened script had {n_reply} words, below the {WORD_FLOOR}-word floor, "
                                  f"so the first script was kept")
            elif new_script:
                # The shorter script's own beat list, checked like the first one before it is voiced.
                shorter = carry_over({"script": new_script, "beats": normalise_beats(short.get("beats")),
                                      "claims": short.get("claims")}, run.draft)
                run.draft = check_beats(run, complete, script_system_prompt(cat), shorter, "shorten",
                                       max_words=target)
                # Always audit the shortened words (new model text may carry new claims), so the audit on
                # file, the claims list and review.md all describe the script that gets voiced. In files
                # mode this stops with exit 4 on an "audit-shorten" prompt.
                run.fact["final_audit"] = fact_check.audit_script(
                    run.draft["script"], "", run.topic,
                    llm_call=lambda prompt: _ask(run, complete, "", prompt, "audit-shorten", SCRIPT_MAX_TOKENS))
                run.fact["audited"] = "shorten"
                # The shortened script is the voiced one and this audit covers it, so a failed redraft
                # earlier does not matter any more: only a flag on these words needs a check.
                run.fact["needs_fact_check"] = not run.fact["final_audit"]["ok"]
                stats = _voice_if_needed(folder, run.draft["script"], voice_fn, run.settings,
                                         shortened_from={"sha256": _fingerprint(script), "stats": stats})
                n_short = len(run.draft["script"].split())     # the script actually voiced (a beat rewrite may differ)
                run.voice_note = f"shortened once ({cut} words asked)" + (
                    f"; the shortened script had {n_short} words, over the {target}-word target"
                    if n_short > target else "")
            else:
                run.voice_note = "shorten gave no script text, so the long script was kept"
        except (BadReply, llm.LlmError) as e:
            run.voice_note = f"shorten failed: {e}"
    # The voice on disk must be the reported script's. When the long script is kept on a resumed run, the
    # files may be a shortened script's from before (the stats above came from voice.stats.json's
    # "shortened_from"), so this voices again; when they already match it returns the saved stats at once.
    stats = _voice_if_needed(folder, run.draft["script"], voice_fn, run.settings, exact=True)
    shown = round(stats["duration"], 2)        # decide on the number that is printed, so text and decision agree
    if shown > limit:
        over = f"{shown:.2f} s is over the {limit:.0f} s limit"
        if shown > limit + STILL_OK_SECONDS:
            run.voice_stats = stats
            what = run.voice_note or (f"the script has {len(run.draft['script'].split())} words, at or under the "
                                      f"{WORD_FLOOR}-word floor, so it was not shortened")
            raise RuntimeError(f"the voice is too long: {over}, more than {STILL_OK_SECONDS:.0f} s over "
                               f"(the most accepted is {limit + STILL_OK_SECONDS:.0f} s). "
                               f"{what[:1].upper()}{what[1:]}. "
                               "Use a shorter topic or a faster voice rate.")
        run.voice_note += ("; " if run.voice_note else "") + f"ACCEPTED, a little over the limit: {over}"
    run.voice_stats = stats
    return stats


def _fingerprint(script):
    return hashlib.sha256(script.encode("utf-8")).hexdigest()


def _voice_if_needed(folder, script, voice_fn, settings, shortened_from=None, exact=False):
    """Voice only when the script differs from the one last voiced, so a resumed run keeps the word
    times that an earlier show reply was written against. voice.stats.json remembers the last voiced
    script and, after a shorten, the long script it replaced (that one is not voiced again while the
    shorten step replays). exact: only the script whose voice is on disk counts, so the long script is
    voiced again when the shortened one is not used after all."""
    digest = _fingerprint(script)
    marker = folder / "voice.stats.json"
    (folder / "script.txt").write_text(script + "\n", encoding="utf-8")
    if marker.exists() and (folder / "words.json").exists():
        saved = json.loads(marker.read_text(encoding="utf-8"))
        if saved.get("sha256") == digest:
            return saved["stats"]
        before = saved.get("shortened_from") or {}
        if before.get("sha256") == digest and not exact:
            return before["stats"]          # the long version: the shorten step follows and replays
    stats = voice_fn(script, folder, settings)
    record = {"sha256": digest, "stats": stats}
    if shortened_from:
        record["shortened_from"] = shortened_from
    marker.write_text(json.dumps(record, indent=1), encoding="utf-8")
    return stats


def _error_lines(errors, limit=40):
    lines = [f"- {e.get('path', '?')}: {e.get('message', '')} {e.get('hint', '')}".rstrip() for e in errors[:limit]]
    if len(errors) > limit:
        lines.append(f"- ... and {len(errors) - limit} more")
    return "\n".join(lines)


def _finding_lines(findings, limit=30):
    lines = []
    for f in findings[:limit]:
        lines.append(f"- {f.get('level', '').upper()} shot \"{f.get('shot', '')}\" at {f.get('time', '')} s: "
                     f"{f.get('what', '')} Fix: {f.get('fix', '')}")
    return "\n".join(lines)


# Story warnings that a model-written show may not have (the checker only warns, so that hand-made
# shows and the fallback stay valid; the writer treats them like errors and sends them to the repair).
BLOCKING_WARNINGS = ("story.scenes", "story.subject")


def dial_reach(show):
    """The most things one dial is bound to inside one scene (a shot without "continue" plus the
    continuing shots after it: its environment and every prop field written as {"dial": ...})."""
    def dials_in(obj):
        if isinstance(obj, dict):
            own = [obj["dial"]] if isinstance(obj.get("dial"), str) else []
            return own + [d for v in obj.values() for d in dials_in(v)]
        if isinstance(obj, list):
            return [d for v in obj for d in dials_in(v)]
        return []
    best, found = 0, []
    shots = show.get("shots")
    for shot in shots if isinstance(shots, list) else []:
        if not isinstance(shot, dict):
            continue                                    # a malformed shot: the validator reports it
        if not shot.get("continue"):
            found = dials_in(shot.get("env"))          # a new scene; a continuing shot keeps the env
        found = found + dials_in(shot.get("props") or [])
        best = max([best] + [found.count(d) for d in set(found)])
    return best


def story_problems(show, result, board=None, words=None):
    """Why a show is not accepted beyond the checker's errors, in the checker's {path, message, hint}
    shape: a blocking story warning, no dial bound to two or more things, or (with an approved storyboard)
    a storyboard prop, text or flow direction the show misses."""
    problems = [w for w in result.get("warnings", []) if str(w.get("path", "")).startswith(BLOCKING_WARNINGS)]
    if board and words:
        problems += coverage_problems(board, show, words, result)
    if dial_reach(show) < 2:
        problems.append({"path": "story.dial", "message": "no dial is bound to two or more things in one scene.",
                         "hint": 'Add a "dials" entry for the quantity that changes and bind it with '
                                 '{"dial": ...} to two or more things on screen together (the subject\'s '
                                 'param, its colour, the background), with keys on the words where it changes.'})
    return problems


def show_step(run, complete, validate_fn, cat, words):
    """Show call + validator repairs. Returns the valid show dict, or None."""
    folder = run.folder
    title = run.draft.get("title") or run.topic
    system = show_system_prompt(cat)
    board = (run.storyboard or {}).get("board")
    original = show_user_prompt(title, words, run.draft.get("script", ""), run.draft.get("beats"), board)
    user, purpose = original, "show"
    max_rounds = int(run.settings["max_repairs"])
    for attempt in range(max_rounds + 1):
        if attempt:
            run.repairs = attempt
        try:
            text = _ask(run, complete, system, user, purpose, SHOW_MAX_TOKENS)
        except llm.LlmError as e:
            # Refused, cut off or API down: a failed round. Ask again with the same prompt.
            run.history.append(f"{purpose}: no answer ({str(e)[:120]})")
            purpose = f"repair{attempt + 1}"
            continue
        try:
            show = normalise_show(parse_show_reply(text), title)
        except BadReply as e:
            run.history.append(f"{purpose}: not valid JSON ({str(e)[:120]})")
            errors_text = f"- reply: {e}. Reply with the JSON object only, starting with {{ and ending with }}."
            previous = text if len(text) < 60000 else text[:60000]
        else:
            (folder / "show.json").write_text(json.dumps(show, indent=1, ensure_ascii=False), encoding="utf-8")
            result = validate_fn(folder)
            blocking = story_problems(show, result, board, words) if result.get("ok") else []   # a rejected show is not story-checked
            if result.get("ok") and not blocking:
                run.warnings = list(result.get("warnings", []))
                run.history.append(f"{purpose}: valid ({len(run.warnings)} warning(s))")
                return show
            run.history.append(f"{purpose}: {len(result.get('errors', []))} validator error(s), "
                               f"{len(blocking)} story problem(s)")
            errors_text = _error_lines(list(result.get("errors", [])) + blocking)
            previous = compact_json(show)
        user = fill(read_prompt("repair_user.md"), ORIGINAL=original, PREVIOUS=previous, ERRORS=errors_text)
        purpose = f"repair{attempt + 1}"
    return None


# ---------------------------------------------------------------- storyboard
#
# Between the voice and the show: a storyboard call plans every sentence's picture (objects, look and place,
# change, camera, on-screen text, flow directions, gaps the catalogue cannot draw), a short code check and a
# separate reviewer call judge it, and repair calls fix it. The show call then builds exactly that plan, and
# coverage_problems() checks the finished show against it. docs/WRITER.md explains it in plain words.

def _text(v):
    """A plain string from a model value (a list or dict where a string belongs counts as empty)."""
    return "" if v is None or isinstance(v, (dict, list)) else str(v).strip()


def _dicts(v):
    return [x for x in v if isinstance(x, dict)] if isinstance(v, list) else []


def _ends(v):
    """A text's "ends": a sentence number, "end", or whatever the model wrote (the code check reports it)."""
    if isinstance(v, float) and v.is_integer() and abs(v) < 10 ** 6:
        v = int(v)                    # 3.0 is sentence 3
    t = _text(v)
    if re.fullmatch(r"[Ss]?\d{1,6}", t):     # longer digit strings are not a sentence number (int() would choke)
        return int(t.lstrip("Ss"))
    return "end" if t.lower() == "end" else t


def normalise_storyboard(obj):
    """The storyboard reply in a fixed shape (every field present, the right type), so later code never
    trips over a model that wrote a string where a list belongs."""
    sents = []
    for s in _dicts(obj.get("sentences")):
        objects = [{"prop": _text(o.get("prop")), "look": _text(o.get("look")), "place": _text(o.get("place")),
                    "stands_for": _text(o.get("stands_for")), "missing": _text(o.get("missing")),
                    "stand_in": _text(o.get("stand_in")), "central": o.get("central") is True}
                   for o in _dicts(s.get("objects"))]
        sents.append({"scene": _text(s.get("scene")), "objects": objects, "change": _text(s.get("change")),
                      "camera": _text(s.get("camera")),
                      "texts": [{"words": _text(t.get("words")), "starts": _text(t.get("starts")),
                                 "ends": _ends(t.get("ends"))} for t in _dicts(s.get("texts"))],
                      "flows": [{k: _text(f.get(k)) for k in ("what", "by", "from", "to")}
                                for f in _dicts(s.get("flows"))]})
    ending = obj.get("ending") if isinstance(obj.get("ending"), dict) else {}
    return {"hook": _text(obj.get("hook")), "answer": _text(obj.get("answer")), "hero": _text(obj.get("hero")),
            "summary": _text(obj.get("summary")),
            "scenes": [{k: _text(x.get(k)) for k in ("scene", "env", "idea")} for x in _dicts(obj.get("scenes"))],
            "sentences": sents,
            "ending": {k: _text(ending.get(k)) for k in ("closing_question", "comment_line", "tail")}}


def storyboard_text(board):
    """The storyboard as JSON with one sentence per line (S n is line n of "sentences"), for prompts. The empty
    gap fields of ordinary objects are left out (noise for the model); storyboard.json keeps them."""
    j = lambda v: json.dumps(v, ensure_ascii=False)
    head = [f"  {j(k)}: {j(v)}," for k, v in board.items() if k != "sentences"]
    def plain(o):
        return o if o["missing"] else {k: v for k, v in o.items() if k not in ("missing", "stand_in", "central")}
    rows = [f"    {j(dict(s, objects=[plain(o) for o in s['objects']]))}" for s in board["sentences"]]
    return "{\n" + "\n".join(head) + '\n  "sentences": [\n' + ",\n".join(rows) + "\n  ]\n}"


def sentence_lines(words):
    """S1 [0.09-1.46] What if Earth had rings like Saturn?   (one line per sentence, no word times)"""
    return "\n".join(f"S{n} [{s[0]['start']:.2f}-{s[-1]['end']:.2f}] {' '.join(w['text'] for w in s)}"
                     for n, s in enumerate(sentences(words), 1))


def phrase_time(sent_words, phrase):
    """When the phrase starts inside one sentence's words (whole words, case and punctuation ignored), or None."""
    want = _plain_words(phrase)
    flat = [(tok, i) for i, w in enumerate(sent_words) for tok in _plain_words(w["text"])]
    toks = [t for t, _ in flat]
    for k in range(len(toks) - len(want) + 1):
        if want and toks[k:k + len(want)] == want:
            return sent_words[flat[k][1]]["start"]
    return None


def _text_window(t, n, sents, words):
    """(start, end) seconds of a storyboard text in sentence n, or None where its phrase or end is unusable."""
    start = phrase_time(sents[n - 1], t["starts"])
    e = t["ends"]
    if e == "end":
        end = words[-1]["end"] + TAIL_SECONDS    # the quiet tail after the last word is on screen too
    elif isinstance(e, int) and n < e <= len(sents):
        end = sents[e - 1][0]["start"]
    else:
        end = None
    return start, end


def storyboard_gaps(board):
    """[(sentence number, gap object)] for every object written as a gap."""
    return [(n, o) for n, s in enumerate((board or {}).get("sentences", []), 1) for o in s["objects"] if o["missing"]]


def storyboard_problems(board, words, cat):
    """The cheap code check that runs before the reviewer: shape, catalogue names, text timing. Plain strings,
    like the reviewer's problems, so both go to the same repair prompt."""
    sents = sentences(words)
    props = cat["props"]
    out = []
    if len(board["sentences"]) != len(sents):
        out.append(f"the storyboard has {len(board['sentences'])} sentence entries but the narration has "
                   f"{len(sents)} sentences: give exactly one entry per sentence, in order")
    for k in ("hook", "answer"):
        if not board[k]:
            out.append(f'"{k}" is empty')
    gaps = [o for _, o in storyboard_gaps(board)]
    # The hero is a prop the board uses (or a gap's stand-in). A hero that cannot be drawn is the usual central
    # gap: then it names that gap (or "none"). A central gap elsewhere does not excuse any other hero.
    used = {o["stand_in"] if o["missing"] else o["prop"] for s in board["sentences"] for o in s["objects"]}
    used = {u for u in used if u and u.lower() != "none"}   # a gap with no stand-in is not a prop the hero can be
    ends = {p.lower() for p in props} | {u.lower() for u in used}   # names a flow may start or end at
    central = [o for o in gaps if o["central"]]
    ok_hero = board["hero"] in used or (central and (board["hero"].lower() == "none"
                                                     or board["hero"] in [o["missing"] for o in central]))
    if not board["hero"] or not ok_hero:
        out.append(f'"hero" is "{board["hero"]}": it must be one of the props used in the objects '
                   f'({", ".join(sorted(used)) or "none"})')
    for k, v in board["ending"].items():
        if not v:
            out.append(f'"ending" has no "{k}"')
    for n, (s, sent) in enumerate(zip(board["sentences"], sents), 1):
        quote = f'S{n} "{" ".join(w["text"] for w in sent)}"'
        if not s["objects"]:
            out.append(f"{quote}: no objects on screen")
        if n == 1 and len(s["objects"]) > 2:
            out.append(f"{quote}: the first shot shows one clear subject plus at most one other small prop, not "
                       f"{len(s['objects'])} objects: keep the hero and one small prop")
        if not s["change"]:
            out.append(f"{quote}: no change")
        for o in s["objects"]:
            if o["missing"]:
                if o["stand_in"] and o["stand_in"].lower() != "none" and o["stand_in"] not in props:
                    out.append(f'{quote}: the gap\'s stand-in "{o["stand_in"]}" is not a catalogue prop (or write "none")')
            elif o["prop"] not in props:
                out.append(f'{quote}: "{o["prop"]}" is not a catalogue prop: use one, or write it as a gap '
                           '{"missing": ..., "stand_in": ..., "central": ...}')
        for t in s["texts"]:
            if not t["words"] or len(t["words"]) > 40:
                out.append(f'{quote}: a text needs "words" of 1 to 40 characters (got "{t["words"]}")')
                continue
            start, end = _text_window(t, n, sents, words)
            if start is None:
                out.append(f'{quote}: text "{t["words"]}" starts on "{t["starts"]}", which is not words of this '
                           f'sentence: copy them exactly')
            if end is None:
                later = (f"a later sentence number ({n + 1} to {len(sents)}) or " if n < len(sents) else "")
                out.append(f'{quote}: text "{t["words"]}" has "ends": "{t["ends"]}"; use {later}"end" '
                           f'(the end of the last sentence)')
            if start is not None and end is not None and end - start < TEXT_MIN_SECONDS - 0.05:
                out.append(f'{quote}: text "{t["words"]}" is on screen only {end - start:.1f} s; keep it at least '
                           f'{TEXT_MIN_SECONDS:g} s and until the idea moves on (a later "ends")')
        for f in s["flows"]:
            if not f["from"] or not f["to"]:
                out.append(f'{quote}: the flow of "{f["what"]}" needs "from" and "to"')
            if f["by"] not in props:
                out.append(f'{quote}: the flow of "{f["what"]}" is shown by "{f["by"]}", which is not a catalogue prop')
            for end in ("from", "to"):
                if f[end] and f[end].lower() not in ends:
                    out.append(f"{quote}: flow {end} '{f[end]}' is not a prop; use a catalogue prop name such as "
                               f"{next(iter(props), 'battery')}")
    return out


def parse_review(text):
    """(verdict, problem lines) from the reviewer's reply. "pass" wins even when it lists points (they are
    notes). "problems" with nothing readable listed is an unreadable review (BadReply): a failed round.
    A problem may be an object or a plain string (a single string counts as one problem)."""
    obj = parse_loose_json(text)
    lines = []
    listed = obj.get("problems")
    for p in listed if isinstance(listed, list) else [listed]:
        if isinstance(p, dict):
            what, fix = _text(p.get("what")), _text(p.get("fix"))
            if not what and not fix:
                continue   # an empty problem object tells the repair nothing
            raw = p.get("sentence")
            if isinstance(raw, bool):
                raw = None    # true/false is no sentence number
            elif isinstance(raw, float) and raw.is_integer():
                raw = int(raw)    # 3.0 is sentence 3
            label = _text(raw)
            m = re.fullmatch(r"\s*(?:sentence\s*)?s?\s*(\d{1,6})\s*", label, flags=re.I)
            # Only a number is an "S4"; "whole video", "all", "ending" are shown as written.
            if not m and re.fullmatch(r"\s*(?:-\s*\d+|\d{7,})\s*", label):
                label = ""                # a negative or absurdly long number is no sentence: whole video
            label = label[:60]
            where = (f"S{int(m.group(1))}" if int(m.group(1)) else "whole video") if m else (label or "whole video")
            detail = " ".join(x for x in (what, f"Fix: {fix}" if fix else "") if x)
            lines.append(f"{where} ({_text(p.get('kind')) or 'problem'}): {detail}")
        elif isinstance(p, str) and p.strip():
            lines.append(f"whole video (problem): {p.strip()}")
    verdict = _text(obj.get("verdict")).lower()
    if verdict not in ("pass", "problems"):
        raise BadReply(f'the review has no "verdict" of "pass" or "problems" (got "{verdict}")')
    if verdict == "problems" and not lines:
        raise BadReply('the verdict is "problems" but no problem could be read from "problems"')
    return verdict, lines


def storyboard_md(run, words):
    """storyboard.md: the plan as a short shot-by-shot list a person can follow."""
    sb = run.storyboard
    b = sb["board"]
    if not b:
        lines = [f"# Storyboard: {run.draft.get('title') or run.topic}", "", "No usable storyboard was written.", "",
                 "## Problems left", ""]
        return "\n".join(lines + [f"- {x}" for x in sb["notes"]] + [""])
    sents = sentences(words)
    review = {"pass": "PASS", "problems": "PROBLEMS"}.get(sb["verdict"], "not reviewed yet")
    lines = [f"# Storyboard: {run.draft.get('title') or run.topic}", "",
             f"- Hook: {b['hook']}", f"- Answer the video gives: {b['answer']}", f"- Hero prop: {b['hero']}",
             f"- Reviewer: {review}" + (f" (after {sb['repairs']} repair(s))" if sb["repairs"] else ""), "",
             b["summary"], ""]
    scene_info = {s["scene"]: s for s in b["scenes"]}
    current = None
    for n, s in enumerate(b["sentences"], 1):
        # An empty scene continues the previous scene's heading ("not named" when it is the first sentence).
        if (s["scene"] != current and s["scene"] != "") or current is None:
            current = s["scene"]
            info = scene_info.get(current, {})
            lines += [f"## Scene {current or '(not named)'}" + (f" ({info['env']})" if info.get("env") else "")
                      + (f": {info['idea']}" if info.get("idea") else ""), ""]
        sent = sents[n - 1] if n <= len(sents) else []
        said = " ".join(w["text"] for w in sent)
        lines.append(f"**S{n}**" + (f" at {sent[0]['start']:.1f} s" if sent else "") + f": \"{said}\"")
        for o in s["objects"]:
            name = (f"GAP: {o['missing']} (stand-in: {o['stand_in'] or 'none'}"
                    + (", CENTRAL" if o["central"] else "") + ")") if o["missing"] else o["prop"]
            about = [o["look"], o["place"]] + ([f"stands for {o['stands_for']}"] if o["stands_for"] else [])
            lines.append(f"- {name}" + (": " + "; ".join(x for x in about if x) if any(about) else ""))
        lines.append(f"- Changes: {s['change']}")
        if s["camera"]:
            lines.append(f"- Camera: {s['camera']}")
        for t in s["texts"]:
            ends = ("until the end" if t["ends"] == "end" else f"until S{t['ends']} starts" if isinstance(t["ends"], int)
                    else f"ends: {t['ends'][:60] or '(not given)'}")
            lines.append(f"- Text \"{t['words']}\" from \"{t['starts']}\" {ends}")
        for f in s["flows"]:
            lines.append(f"- Flow: {f['what']} along the {f['by']}, from {f['from']} to {f['to']}")
        lines.append("")
    e = b["ending"]
    lines += ["## Ending", f"- Closing question: {e['closing_question']}", f"- Comment line: {e['comment_line']}",
              f"- After the last word: {e['tail']}", ""]
    if not sb["fresh"]:
        lines += ["NOTE: the last repair reply could not be read, so this is an older version of the plan.", ""]
    if sb["notes"]:
        lines += ["## Reviewer notes" if sb["verdict"] == "pass" else "## Problems left", ""]
        lines += [f"- {x}" for x in sb["notes"]] + [""]
    return "\n".join(lines)


def _save_storyboard(run, words):
    sb = run.storyboard
    review = {"verdict": sb["verdict"], "notes": sb["notes"], "repairs": sb["repairs"]}
    if not sb["fresh"]:
        review["last_reply_unusable"] = True     # "board" (if any) is an older one: the newest reply did not parse
    (run.folder / "storyboard.json").write_text(json.dumps(
        dict(sb["board"] or {}, review=review), indent=1, ensure_ascii=False), encoding="utf-8")
    (run.folder / "storyboard.md").write_text(storyboard_md(run, words), encoding="utf-8")


def storyboard_step(run, complete, cat, words):
    """Storyboard call -> code check -> review call -> up to storyboard_repairs repair rounds. Accepted:
    run.storyboard["board"] is the plan the show call builds. Still failing: RuntimeError (exit 1). A central
    gap: NotFeasible (NEEDS-PROPS.md, exit 3). Non-central gaps go to run.props_wanted."""
    # "board" is the last storyboard that parsed. "fresh" is False when the newest reply did not parse, so
    # "board" is then an older one: it is still saved (for a person to read) but never decides anything.
    sb = run.storyboard = {"board": None, "verdict": None, "notes": [], "repairs": 0, "history": [], "fresh": False}
    names = catalog_names(cat)
    nums = dict(TEXT_SECONDS=f"{TEXT_MIN_SECONDS:g}", TAIL=f"{TAIL_SECONDS:g}")
    system = fill(read_prompt("storyboard_system.md"), CATALOG_NAMES=names, **nums)
    review_system = fill(read_prompt("storyboard_review_system.md"), CATALOG_NAMES=names, **nums)
    lines = sentence_lines(words)
    original = fill(read_prompt("storyboard_user.md"), TITLE=run.draft.get("title") or run.topic, TOPIC=run.topic,
                    SENTENCES=lines, BEATS=beats_block(run.draft.get("script", ""), run.draft.get("beats"),
                                                       len(sentences(words))))
    user, purpose = original, "storyboard"
    real = []                            # the real problems (code check or reviewer) of the last readable round
    rounds = run.settings.get("storyboard_repairs")
    # Only a real whole number counts (not a bool, string or float); anything else is the default 2. Below 0 is 0.
    rounds = max(0, rounds) if isinstance(rounds, int) and not isinstance(rounds, bool) else 2
    try:
        for attempt in range(rounds + 1):
            text = ""
            try:
                text = _ask(run, complete, system, user, purpose, STORYBOARD_MAX_TOKENS)
                board = normalise_storyboard(parse_loose_json(text))
            except (BadReply, llm.LlmError) as e:
                # Like the show step: a refused or cut-off answer (LlmError) is a failed round, not a crash.
                reason = str(e) if isinstance(e, BadReply) else f"the model gave no usable answer ({e})"
                # The real problems of the earlier round stay on the list; this adds one line to them.
                problems = real + [f"your last reply could not be read: {reason}. Reply with the JSON object only"]
                # The repair shows the last good board when there is one, not the broken reply.
                previous = storyboard_text(sb["board"]) if sb["board"] else (text[:60000] or "(no reply)")
                sb["fresh"] = False
                sb["history"].append(f"{purpose}: {reason.replace('the reply is ', '', 1)}")
            else:
                sb["board"], previous, sb["fresh"] = board, storyboard_text(board), True
                problems = storyboard_problems(board, words, cat)
                if problems:
                    sb["history"].append(f"{purpose}: {len(problems)} problem(s) found by the code check (no review call)")
                else:
                    review_user = fill(read_prompt("storyboard_review_user.md"), TOPIC=run.topic, SENTENCES=lines,
                                       STORYBOARD=previous)
                    try:
                        verdict, problems = parse_review(_ask(run, complete, review_system, review_user,
                                                              "storyboard-review", STORYBOARD_MAX_TOKENS))
                    except (BadReply, llm.LlmError) as e:
                        # An unreadable or cut-off review is a failed round like an unreadable storyboard: it uses a repair.
                        verdict, problems = "problems", [
                            f"the review of this storyboard could not be read ({e}); check every rule yourself and "
                            "reply with the complete corrected storyboard"]
                        sb["history"].append(f"{purpose}: review reply not usable")
                    else:
                        sb["history"].append(f"{purpose}: review {verdict} ({len(problems)} point(s))")
                    if verdict == "pass":
                        sb["verdict"], sb["notes"] = "pass", problems
                        break
            sb["verdict"], sb["notes"] = "problems", problems
            if sb["fresh"]:
                real = problems          # (an unreadable round keeps the earlier real problems)
            _save_storyboard(run, words)
            # Only the board of the LAST reply decides a central gap, and only when that reply parsed (fresh): a
            # board left over from an earlier round must not make the run stop for props.
            if (attempt == rounds and sb["fresh"]
                    and any(o["central"] for _, o in storyboard_gaps(sb["board"]))):
                break                        # it cannot be built anyway: stop for props below, not a failure
            if attempt == rounds:
                raise RuntimeError(f"the storyboard still has problems after {rounds} repair round(s): "
                                   + "; ".join(problems))
            user = fill(read_prompt("storyboard_repair_user.md"), ORIGINAL=original, PREVIOUS=previous,
                        PROBLEMS="\n".join(f"- {p}" for p in problems))
            purpose = f"storyboard-repair{attempt + 1}"
            sb["repairs"] = attempt + 1
    except Exception:
        # Any failure (LlmError, OSError, ...) still leaves the files for a person to read, even when no board
        # ever parsed (the files then say so).
        # WaitingForReply is not an Exception: files mode stops there and leaves the files of the last failed
        # round on disk; the next run deletes them.
        try:
            _save_storyboard(run, words)
        except OSError:
            pass                         # the original error is the one to report
        raise
    _save_storyboard(run, words)
    gaps = storyboard_gaps(sb["board"])
    central = [o for _, o in gaps if o["central"]]
    seen = set()
    for n, o in gaps:
        if not o["central"] and o["missing"].lower() not in seen:
            seen.add(o["missing"].lower())
            run.props_wanted.append({"missing": o["missing"], "stand_in": o["stand_in"] or "none", "sentence": n})
    if central:
        # The same stop as a "feasible": false script reply: NEEDS-PROPS.md, exit 3, topic queued for props.
        para = " ".join(f"{o['missing']}" + (f" (it stands for {o['stands_for']})" if o["stands_for"] else "") + "."
                        for o in central)
        _stop_not_feasible(run, {"feasible": False, "mechanism_prop": para,
                                 "missing": list(dict.fromkeys(o["missing"] for o in central))}, "the storyboard")
    return sb["board"]


# ---------------------------------------------------------------- coverage: does the show build the storyboard?
#
# Tolerant on purpose: a guard against the obvious misses (a planned prop, text or flow direction left out),
# not a second director. Anything it cannot work out (an unknown phrase, a slot name as a wire end) is skipped.

FILLER_WORDS = {"a", "an", "the", "of", "and", "is"}


def _number(t):
    """A token that is a plain number as its normal form ("3.50" -> "3.5"); anything else (even a circled
    digit that only looks like one) stays as it is."""
    t = t.replace("−", "-")
    if not re.fullmatch(r"-?\d+(\.\d+)?", t):
        return t
    try:
        return format(Decimal(t).normalize(), "f")
    except ArithmeticError:
        return t


def _is_num(t):
    return bool(re.fullmatch(r"-?\d+(\.\d+)?", t))


def _tokens(text):
    """Numbers and words of a text, units folded: "2000 °C", "2000 degrees" and "2000c" are all [2000, deg];
    "%" and "percent" are one token; thousands commas go; numbers are compared as numbers (3.5 = 3.50);
    accents are dropped ("Café" = "Cafe") and any alphabet counts. Case and punctuation are ignored."""
    s = unicodedata.normalize("NFKD", str(text)).lower()     # fold first: "℃" becomes "°C", then "°c"
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = re.sub(r"(?<=\d),(?=\d{3})", "", s)
    s = re.sub(r"[°º]|\bdegrees?\b|\bdeg\b|\bcelsius\b|(?<=\d)\s*c\b", " deg ", s)
    s = re.sub(r"%|\bper\s?cent\b", " percent ", s)
    s = re.sub(r"\bkm\s*/\s*h\b|\bkph\b", " kmh ", s)
    # A "-" or "−" right before a number (not after a letter or digit, so "3-5" stays 3 and 5) is its sign.
    toks = [_number(t) for t in re.findall(r"(?:(?<![\w.])[-−])?\d+(?:\.\d+)?|[^\W\d_]+", s)]
    return [t for i, t in enumerate(toks) if not (t == "c" and i and toks[i - 1] == "deg")]


def _overlay_tokens(o):
    """What an overlay shows. A count shows its final value ("to", with "decimals") and its unit."""
    if o.get("do") == "count" and isinstance(o.get("to"), (int, float)):
        dec = o.get("decimals")
        dec = dec if isinstance(dec, int) and not isinstance(dec, bool) and 0 <= dec <= 6 else 0   # bad -> 0
        try:
            return _tokens(f"{float(o['to']):.{dec}f}{o.get('unit') or ''}")
        except (OverflowError, ValueError):
            return []                    # a count too big to print shows nothing
    return _tokens(o.get("text") or "")


def text_covers(planned, shown):
    """Does one overlay (token list) show the planned text (token list)? Planned numbers: every one must be in
    the overlay (a number-only match is accepted, the number is the key fact, so a count with no unit is fine).
    No numbers: at least 70 percent of the planned words, whole words, in the same order. A tiny fragment
    ("0" for "2000 °C", "hot" for "hotter") never covers."""
    nums = [t for t in planned if _is_num(t)]
    if nums:
        return all(t in shown for t in nums)
    # "The bulb" is covered by a label "Bulb"; a text of only filler words ("is") keeps them all
    planned = [t for t in planned if t not in FILLER_WORDS] or planned
    pos, hit = 0, 0
    for t in planned:
        if t in shown[pos:]:
            pos = shown.index(t, pos) + 1
            hit += 1
    need = len(planned) if len(planned) <= 2 else int(0.7 * len(planned) + 0.5)   # 1-2 words: all of them
    return bool(planned) and hit >= need


def split_hits(want, overlays):
    """Overlays of one shot that together show the planned text (a text split over two labels): each part
    uses only words or numbers of the plan (and at least one), and together they hold every planned number and
    at least 70 percent of the words. One merged {t0, until} per such shot."""
    out = []
    for shot in dict.fromkeys(o.get("shot") for o in overlays):
        parts = [(o, set(_overlay_tokens(o))) for o in overlays if o.get("shot") == shot]
        parts = [(o, t) for o, t in parts if t and t <= set(want)]
        got = set().union(*[t for _, t in parts]) if parts else set()
        if len(parts) >= 2 and text_covers(want, [t for t in want if t in got]):
            out.append({"t0": min(o["t0"] for o, _ in parts), "until": max(o["until"] for o, _ in parts)}
                       if all("t0" in o and "until" in o for o, _ in parts) else parts[0][0])
    return out


def _flow_pairs(show):
    """Counter of (prop type, from type, to type) for every wire, arrow and beam whose two ends can be tied to
    a prop: a prop id, or an [x, y, z] point within 1 unit (x and z) of a prop's "at" in the same scene.
    Known weak spot (accepted): a prop with no "at" counts as sitting at [0, 0, 0], so a wire end near the
    origin can be tied to the wrong prop."""
    pairs, scene = Counter(), []
    shots = show.get("shots") if isinstance(show.get("shots"), list) else []
    for shot in [s for s in shots if isinstance(s, dict)]:
        if not shot.get("continue"):
            scene = []
        scene = scene + [p for p in shot.get("props") or [] if isinstance(p, dict)]

        def end_type(v):
            if isinstance(v, str):
                return next((p.get("type") for p in scene if p.get("id") == v), None)
            if isinstance(v, list) and len(v) == 3 and all(isinstance(x, (int, float)) for x in v):
                near = [(math.hypot(at[0] - v[0], at[2] - v[2]), p.get("type")) for p in scene
                        if p.get("type") not in FLOW_PROPS
                        for at in [p.get("at", [0, 0, 0])] if isinstance(at, list) and len(at) == 3
                        and all(isinstance(x, (int, float)) for x in at)]
                best = min(near, key=lambda t: t[0], default=None)
                return best[1] if best and best[0] <= 1.0 else None
            return None
        for p in shot.get("props") or []:
            if isinstance(p, dict) and p.get("type") in FLOW_PROPS:
                a, b = end_type(p.get("from")), end_type(p.get("to"))
                if a and b:
                    pairs[(p["type"], a, b)] += 1
    return pairs


def coverage_problems(board, show, words, result):
    """Storyboard misses in the finished show, as {path, message, hint} for the show repair loop:
    a planned prop type not in the show, a planned text missing, starting far from its phrase or removed early,
    and a wire/arrow/beam the storyboard gives a direction for that runs the other way (or is missing)."""
    out = []
    shots = [s for s in show.get("shots") or [] if isinstance(s, dict)] if isinstance(show.get("shots"), list) else []
    types = {p.get("type") for s in shots for p in s.get("props") or [] if isinstance(p, dict)}
    wanted = set()
    for s in board["sentences"]:
        for o in s["objects"]:
            name = o["stand_in"] if o["missing"] else o["prop"]
            if name and name.lower() != "none":
                wanted.add(name)
    for name in sorted(wanted - types):
        out.append({"path": "storyboard.props", "message": f'the storyboard shows a "{name}", but the show has none.',
                    "hint": f'Add a "{name}" prop where the storyboard puts it.'})
    # Texts. validate.mjs --json lists every label, text and count with its times; without that list only
    # the presence of the words is checked.
    timed = isinstance(result.get("overlays"), list)
    overlays = result["overlays"] if timed else [
        dict(a, shot=s.get("id")) for s in shots for a in s.get("actions") or []
        if isinstance(a, dict) and a.get("do") in ("label", "text", "count")]
    sents = sentences(words)
    for n, s in enumerate(board["sentences"][:len(sents)], 1):
        for t in s["texts"]:
            want = _tokens(t["words"])
            # Too short to judge: nothing, or a single letter / one-character word (a single digit is a key figure).
            if not want or (len(want) == 1 and not _is_num(want[0]) and len(want[0]) < 2):
                continue
            hits = [o for o in overlays if text_covers(want, _overlay_tokens(o))] or split_hits(want, overlays)
            where = f'S{n}: the storyboard text "{t["words"]}" on "{t["starts"]}"'
            if not hits:
                out.append({"path": "storyboard.text", "message": f"{where} is not in the show.",
                            "hint": "Add it as a label, text or count starting on that phrase."})
                continue
            start, end = _text_window(t, n, sents, words)
            if not timed or start is None:
                continue
            near = sorted((o for o in hits if abs(o["t0"] - start) <= TEXT_START_TOLERANCE), key=lambda o: o["t0"])
            if not near:
                out.append({"path": "storyboard.text", "message": f"{where} ({start:.2f} s) starts at "
                            f"{min(o['t0'] for o in hits):.2f} s in the show instead.",
                            "hint": "Start it on the storyboard's phrase."})
                continue
            # Same words in the next shots count as one text kept up (each label/text/count ends with its shot).
            shown_until = near[0]["until"]
            for o in sorted(hits, key=lambda o: o["t0"]):
                if near[0]["t0"] < o["t0"] <= shown_until + 0.6:
                    shown_until = max(shown_until, o["until"])
            if end is not None and shown_until < end - TEXT_END_TOLERANCE:
                out.append({"path": "storyboard.text", "message": f"{where} goes away at {shown_until:.2f} s, but the "
                            f"storyboard keeps it until {end:.2f} s.",
                            "hint": 'A label, text or count ends with its shot: give it again at the start of the next '
                                    'shot (same words), with "until" on the phrase where it should go.'})
    # Flow directions: count each planned flow once per sentence that needs it most (a circuit lists two wires).
    pairs, need = _flow_pairs(show), {}
    for s in board["sentences"]:
        here = {}
        for f in s["flows"]:
            if f["by"] in FLOW_PROPS and f["from"] and f["to"]:
                key = (f["by"], f["from"], f["to"])
                here[key] = here.get(key, 0) + 1
        for k, c in here.items():
            need[k] = max(need.get(k, 0), c)
    for (by, a, b), count in sorted(need.items()):
        forward, backward = pairs[(by, a, b)], pairs[(by, b, a)]
        if forward >= count:
            continue
        if backward > (need.get((by, b, a), 0)):
            out.append({"path": "storyboard.flow", "message": f'the storyboard sends a {by} from the {a} to the {b}, '
                        f'but the show\'s {by} runs from the {b} to the {a}.',
                        "hint": f'Swap that {by}\'s "from" and "to" (charge and arrows run from "from" to "to").'})
        elif forward == 0 and backward == 0 and {a, b} <= types:
            out.append({"path": "storyboard.flow", "message": f'the storyboard sends a {by} from the {a} to the {b}, '
                        f'but no {by} in the show could be matched to run between them (the wire ends could not '
                        f'be tied to the planned props, or there is none).',
                        "hint": f'Start the {by} at the {a} and end it at the {b} (their positions), or use the prop ids '
                                f'as "from" and "to".'})
    return out


def _count_fails(qa):
    # qa.mjs writes levels in capitals ("FAIL", "WARN").
    return sum(1 for f in qa.get("findings", []) if str(f.get("level", "")).lower() == "fail")


def qa_step(run, complete, validate_fn, qa_fn, cat, words, show):
    """Picture check; on fail one repair round, then check again and keep the better version."""
    if not run.settings["qa"]:
        run.qa = {"result": "not_run", "reason": "qa is off in settings", "findings": []}
        return show
    folder = run.folder
    qa = qa_fn(run.slug)
    run.qa = qa
    if qa.get("result") != "fail" or not run.settings["qa_repair"] or run.show_source != "llm":
        return show
    fails = _count_fails(qa)
    title = run.draft.get("title") or run.topic
    board = (run.storyboard or {}).get("board")
    user = fill(read_prompt("qa_repair_user.md"),
                ORIGINAL=show_user_prompt(title, words, run.draft.get("script", ""), run.draft.get("beats"), board),
                PREVIOUS=compact_json(show), FINDINGS=_finding_lines(qa.get("findings", [])))
    keep_old = lambda why: (run.history.append(f"qa-repair: {why}; kept the earlier show"),
                            (folder / "show.json").write_text(json.dumps(show, indent=1, ensure_ascii=False),
                                                              encoding="utf-8"))
    try:
        text = _ask(run, complete, show_system_prompt(cat), user, "qa-repair", SHOW_MAX_TOKENS)
        new = normalise_show(parse_show_reply(text), title)
    except (BadReply, llm.LlmError) as e:
        keep_old(f"no usable answer ({str(e)[:80]})")
        return show
    (folder / "show.json").write_text(json.dumps(new, indent=1, ensure_ascii=False), encoding="utf-8")
    check = validate_fn(folder)
    if not check.get("ok") or story_problems(new, check, board, words):
        keep_old("the repaired show did not pass the checker and story checks")
        return show
    qa2 = qa_fn(run.slug)
    fails2 = _count_fails(qa2)
    if qa2.get("result") == "not_run" or fails2 > fails:
        keep_old(f"picture check after repair: {qa2.get('result')} ({fails2} fails)")
        run.qa = qa
        return show
    run.history.append(f"qa-repair: picture check now {qa2.get('result')} ({fails2} fails, was {fails})")
    run.qa = qa2
    run.warnings = list(check.get("warnings", []))
    return new


def write_needs_props(run):
    mechanism = str(run.draft.get("mechanism_prop") or "").strip() or "(the model did not describe it)"
    missing = as_list(run.draft.get("missing")) or ["(the model did not say)"]
    text = (f"# Needs props: {run.topic}\n\nThe writer stopped: no prop in the 3D catalogue can show this "
            f"topic's central mechanism changing, and icons or bar charts are not an honest stand-in.\n\n"
            f"## The mechanism prop that is needed\n\n{mechanism}\n\n"
            f"## Missing\n\n" + "\n".join(f"- {m}" for m in missing) + "\n\n"
            "Add the props (see docs/AUTHORING.md), or pick another topic.\n")
    (run.folder / "NEEDS-PROPS.md").write_text(text, encoding="utf-8")


def _claims_md(run):
    claims = as_list(run.draft.get("claims"))
    if not claims and run.draft.get("claims_missing"):
        return ("- (the model gave no claims list for this script, which was rewritten after the first one. "
                "Check the automatic fact check below instead)")
    return "\n".join(f"- [ ] {c}" for c in claims) or "- (the model listed none)"


def _beats_md(run):
    d = run.draft
    beats = d.get("beats") or []
    # "-" means "no dial", as in beats_block (the show prompt), so it is not printed.
    lines = [f"- S{n}: {b['subject']} | {b['change']}"
             + (f" | dial: {b['dial']}" if b["dial"] and b["dial"] != "-" else "")
             for n, b in enumerate(beats, 1)] or ["- (none)"]
    if run.beats["rewritten"] and run.status == "needs_props" and run.beats["rewrite_after"] != "script" \
            and (run.not_feasible_step or "").startswith("the beat rewrite"):
        # The script that was sent back (a redraft or a shortened one) is not the one shown above.
        lines.append(f"- The {run.beats['rewrite_after']} step's script (not shown: its rewrite answered "
                     f"\"feasible\": false) was sent back because: " + "; ".join(run.beats["first_problems"]))
    elif run.beats["rewritten"]:
        lines.append(f"- Sent back once for a rewrite (after the {run.beats['rewrite_after']} step) because: "
                     + "; ".join(run.beats["first_problems"]))
    if run.beats["error"]:
        lines.append(f"- The rewrite failed: {run.beats['error']}")
    if run.beats.get("length_note"):
        lines.append(f"- {run.beats['length_note']}")
    left = reported_beat_problems(run)
    if left:
        # Only say what the show call got when there was one (run.history has one line per show attempt).
        lines.append(f"- STILL WRONG, {beats_note(left)}"
                     + (" (the show call got no plan)" if run.history else "") + ": " + "; ".join(left))
    return "\n".join(lines)


def _storyboard_review_md(run):
    """review.md's storyboard section: the reviewer's last verdict, what is left, and the props wanted."""
    sb = run.storyboard
    verdict = {"pass": "pass", "problems": "PROBLEMS (not approved)"}.get(sb["verdict"], "not reviewed")
    lines = [f"- Reviewer verdict: {verdict}, after {sb['repairs']} repair round(s)"]
    lines += [f"- {h}" for h in sb["history"]]
    if sb["notes"]:
        lines.append("- Reviewer notes:" if sb["verdict"] == "pass" else "- Problems left:")
        lines += [f"  - {x}" for x in sb["notes"]]
    if run.show_source == "fallback":
        lines.append("- The storyboard passed, but the show built from it never passed its checks: the slideshow fallback was used.")
    lines.append("")
    lines.append("### Props wanted (drawn with a stand-in for now; for the prop-building backlog)")
    lines += [f"- {p['missing']} (stand-in: {p['stand_in']}; first in S{p['sentence']})" for p in run.props_wanted] \
        or ["- none"]
    return "\n".join(lines)


def reported_beat_problems(run):
    """left_beat_problems, except when the run stopped for props: then no show is made from this script,
    so its beat list does not matter and nothing is reported (review.md, writer.json beats_note)."""
    return [] if run.status == "needs_props" else left_beat_problems(run)


def _audit_md(audit):
    if not audit:
        return "- not run"
    if not audit.get("available"):
        return f"- unavailable: {audit.get('error')}"
    return "\n".join(f"- {c['verdict']}: {c['claim']}" + (f" (Note: {c['note']})" if c.get("note") else "")
                     for c in audit["claims"])


def no_audited_script(run):
    """True when a stop for props has no accepted script (the first call said not feasible, or the first
    script was sent back before any audit). review.md, writer.json and the voice step all use this."""
    return not run.draft.get("script") or not run.fact["final_audit"]


def review_text(run):
    t = run.totals()
    d = run.draft
    made = {"llm": "first try" if run.repairs == 0 else f"repaired {run.repairs} time(s)",
            "fallback": f"{FALLBACK_NOTE} (plain automatic slideshow: the LLM's show never passed the checks)",
            "none": "no show"}[run.show_source]
    lines = []
    if run.show_source == "fallback":
        lines += [FALLBACK_NOTE.upper(), f"This is a {FALLBACK_NOTE}, a plain slideshow built from the words "
                  "alone. Use it only to test the rest of the pipeline.", ""]
    if run.fact["needs_fact_check"]:
        lines += ["NEEDS FACT CHECK", ""]
    if reported_beat_problems(run):
        lines += [beats_note(reported_beat_problems(run)).upper() + " (see Picture plan)", ""]
    stopped = run.status == "needs_props"
    # no accepted script: the title would come from a rejected reply, so head the page with the slug instead
    lines += [f"# Review: {run.slug if stopped and no_audited_script(run) else d.get('title') or run.topic}", "",
              f"- Topic: {run.topic}", f"- Slug: {run.slug}", f"- Status: {run.status}",
              f"- Show: {made}", f"- Picture check (QA): {run.qa.get('result')}"
              + (f" ({run.qa.get('reason')})" if run.qa.get("reason") else ""),
              ("- Voice: a voice was made for the script below, but no show was built (the run stopped for props; see NEEDS-PROPS.md)"
               if (run.folder / "voice.mp3").exists() and run.fact["final_audit"] else
               "- Voice: none used (the run stopped for props before a show was made; see NEEDS-PROPS.md)")
              if stopped else
              f"- Voice: {run.voice_stats['duration']:.2f} s, {run.voice_stats['word_count']} words"
              + (f" ({run.voice_note})" if run.voice_note else "") if run.voice_stats else "- Voice: not made",
              f"- Mode: {run.mode}; model priced as {run.price_model()}",
              f"- Written: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}", ""]
    if run.error:
        lines += ["## Error", run.error, ""]
    # Nothing accepted: the first script call said not feasible, or the first script was sent back before any audit.
    no_script = stopped and no_audited_script(run)
    if stopped:
        lines += ["## Stopped for props",
                  ("The approved storyboard has a central gap (an object no catalogue prop can draw), so the run stopped "
                   if run.not_feasible_step == "the storyboard" else
                   f"{(run.not_feasible_step or 'a model call')[:1].upper()}{(run.not_feasible_step or 'a model call')[1:]}"
                   " answered \"feasible\": false, so the run stopped ")
                  + "(see NEEDS-PROPS.md). No show was made. "
                  + ("No script was accepted, so there is no script, claims list or fact check."
                     if no_script else
                     "The script below is the last one the run accepted "
                     "(any later redraft or rewrite is not shown), and the claims and fact check below are about it."),
                  ""]
    if not no_script:
        lines += ["## Script", d.get("script", ""), "",
                  "## Picture plan (the beat list that goes with the script above)", _beats_md(run), ""]
        if run.storyboard is not None:
            lines += ["## Storyboard (see storyboard.md)", _storyboard_review_md(run), ""]
        lines += ["## Claims to check (tick each one you have verified)", _claims_md(run), ""]
    if run.fact["needs_fact_check"]:
        fa = run.fact["final_audit"] or {}
        flagged = fact_check.flagged_claims(fa) if fa.get("available") else []
        lines += ["## NEEDS FACT CHECK",
                  ("The automatic fact check could not run: " + str(fa.get("error"))) if not fa.get("available")
                  else "No claim is flagged, but the redraft failed (see below): check the claims by hand."
                  if not flagged
                  else "Flagged in the shortened script (its words were never redrafted):"
                  if run.fact["audited"] == "shorten"
                  else "Still flagged after one redraft:" if run.fact["audited"] == "redraft" else "Flagged:",
                  "\n".join(f"- {c['verdict']}: {c['claim']} (Note: {c['note']})" for c in flagged), ""]
    if not no_script:
        lines += ["## Automatic fact check (final audit)", _audit_md(run.fact["final_audit"]),
                  ("- Redrafted: a redraft was written but not used (the run stopped for props)"
                   if stopped and not run.fact["redrafted"] and any(c["purpose"] == "script-redraft" for c in run.calls)
                   else f"- Redrafted: {'yes' if run.fact['redrafted'] else 'no'}"
                   + (f" (redraft failed: {run.fact['redraft_error']})" if run.fact["redraft_error"] else "")), "",
                  "## Description", d.get("description", ""), "",
                  "## Tags", ", ".join(as_list(d.get("tags"))), ""]
    lines += ["## How the show was made"]
    lines += [f"- {h}" for h in run.history] or ["- (no show attempts)"]
    if run.warnings:
        lines += ["", "## Checker warnings on the accepted show", _error_lines(run.warnings)]
    if run.qa.get("findings"):
        lines += ["", "## Picture check findings", _finding_lines(run.qa["findings"])]
    lines += ["", "## Cost (estimate)" if t["estimated"] else "## Cost",
              "| call | input | output | cache read | cache write | $ |", "|---|---|---|---|---|---|"]
    for c in run.calls:
        lines.append(f"| {c['purpose']} | {c['input_tokens']} | {c['output_tokens']} | {c['cache_read_tokens']} | "
                     f"{c['cache_write_tokens']} | {c['cost_usd']:.4f} |")
    lines.append(f"| **total** | {t['input_tokens']} | {t['output_tokens']} | {t['cache_read_tokens']} | "
                 f"{t['cache_write_tokens']} | {t['cost_usd']:.4f} |")
    if t["estimated"]:
        lines.append(f"\nfiles mode: tokens are characters / 4, priced as {run.price_model()}; nothing was paid.")
    files = {p.name for p in run.folder.iterdir() if p.is_file()} | {"review.md", "writer.json"}
    if stopped:
        files.discard("show.json")       # a run that stops for props makes no show: one on disk is an old run's
        if no_script:                    # old voice/script files belong to no script this review describes
            files -= {"script.txt", "words.json", "voice.mp3", "voice.stats.json"}
    files = sorted(files)
    if (run.folder / "llm").is_dir():
        files.append("llm/ (every prompt and reply)")
    lines += ["", "## Files", ", ".join(files), ""]
    return "\n".join(lines)


def writer_json(run):
    d = run.draft
    t = run.totals()
    # A stop with no accepted script has no title, description, tags or beats to report (see review.md).
    text = {} if run.status == "needs_props" and no_audited_script(run) else {
        "title": d.get("title", ""), "description": d.get("description", ""), "tags": as_list(d.get("tags"))}
    beats = {} if not text else {"beats": d.get("beats") or []}
    return {
        "slug": run.slug, "topic": run.topic, "status": run.status, **text,
        "show": run.show_source, "repairs": run.repairs,
        # Set only for the fallback: the pipeline runner and people must not publish that show.
        "fallback_note": FALLBACK_NOTE if run.show_source == "fallback" else None,
        **beats, "beat_rewrite": run.beats["rewritten"],
        # Set when the final script still has a sentence with no usable beat (after the one rewrite).
        # Never set when the run stopped for props (no show is made from this script).
        "beats_note": beats_note(reported_beat_problems(run)),
        "beat_problems": reported_beat_problems(run),
        "qa": run.qa.get("result"),
        "needs_fact_check": run.fact["needs_fact_check"],
        "voice_seconds": run.voice_stats["duration"] if run.voice_stats else None,
        "voice_note": run.voice_note,
        "mode": run.mode, "model": run.price_model(),
        "tokens": {k: t[k] for k in ("input_tokens", "output_tokens", "cache_read_tokens", "cache_write_tokens")},
        "cost_usd": t["cost_usd"], "cost_is_estimate": t["estimated"],
        # The storyboard step (null when it is off) and the gaps it drew with a stand-in.
        "storyboard": None if run.storyboard is None else {
            k: run.storyboard[k] for k in ("verdict", "repairs", "notes")},
        "props_wanted": run.props_wanted,
        "calls": run.calls, "error": run.error,
    }


def finish(run, code):
    run.folder.mkdir(parents=True, exist_ok=True)
    (run.folder / "review.md").write_text(review_text(run), encoding="utf-8")
    (run.folder / "writer.json").write_text(json.dumps(writer_json(run), indent=1, ensure_ascii=False),
                                            encoding="utf-8")
    return code


def write(topic, slug, *, mode=None, settings=None, complete=None, voice_fn=None, validate_fn=None,
          qa_fn=None, shows_dir=None):
    """Run the whole writer. Returns the exit code. Every collaborator can be replaced (tests)."""
    settings = dict(settings or load_settings())
    mode = mode or settings["mode"]
    folder = Path(shows_dir or REPO / "shows") / slug
    folder.mkdir(parents=True, exist_ok=True)
    # Never leave an old result readable while this run is unfinished (NEEDS-PROPS.md is written again
    # if this run also stops for props; review.md is written again when the run ends; the storyboard files
    # again by the storyboard step, so a run with the storyboard off never lists an old one).
    for name in ("writer.json", "NEEDS-PROPS.md", "review.md", "storyboard.json", "storyboard.md"):
        if (folder / name).exists():
            (folder / name).unlink()
    complete = complete or llm.make_complete(mode, folder, model=settings["model"], effort=settings["effort"])
    voice_fn = voice_fn or default_voice
    validate_fn = validate_fn or validate_show
    qa_fn = qa_fn or run_qa
    run = Run(topic, slug, folder, settings, mode)
    cat = catalog_text.load_catalog()
    try:
        write_script_step(run, complete, cat)
        voice_step(run, complete, voice_fn, cat)
        words = json.loads((folder / "words.json").read_text(encoding="utf-8"))
        if settings["storyboard"]:
            storyboard_step(run, complete, cat, words)
        show = show_step(run, complete, validate_fn, cat, words)
        if show is not None:
            run.show_source = "llm"
        else:
            show = fallback.build_fallback_show(words, run.draft.get("title") or topic,
                                                seed=int(settings["fallback_seed"]))
            (folder / "show.json").write_text(json.dumps(show, indent=1, ensure_ascii=False), encoding="utf-8")
            # The fallback is a slideshow by design, so it is checked without the story rules.
            if not validate_fn(folder, story_rules=False).get("ok"):
                raise RuntimeError("the fallback show did not validate (a bug in pipeline/fallback.py)")
            run.show_source = "fallback"
            run.history.append(f"fallback show used ({FALLBACK_NOTE})")
        qa_step(run, complete, validate_fn, qa_fn, cat, words, show)
        run.status = "ok" if run.show_source == "llm" else "fallback"
        return finish(run, EXIT_OK)
    except NotFeasible:
        # From the first script, the beat rewrite, the fact-check redraft, a rewrite after a shorten, or a
        # central gap in the storyboard (storyboard_step). The audit on file belongs to run.draft
        # (see _stop_not_feasible); flag it if it found a problem, since the end of write_script_step, which normally does this, may not have been reached.
        fa = run.fact["final_audit"]
        if fa:
            run.fact["needs_fact_check"] = (not fa["ok"]) or run.fact["redraft_error"] is not None
        # Voice files left from an earlier run (a reset in files mode) may belong to another script: make
        # them match the script review.md shows (no new voice when they already do).
        if (folder / "words.json").exists() and not no_audited_script(run):
            try:
                _voice_if_needed(folder, run.draft["script"], voice_fn, settings, exact=True)
            except Exception as e:      # the stop for props still has to be written
                run.error = (f"the voice files on disk could not be remade for the script below, so they may "
                             f"belong to another script: {type(e).__name__}: {e}")
        write_needs_props(run)
        run.status = "needs_props"
        return finish(run, EXIT_NEEDS_PROPS)
    except llm.WaitingForReply as w:
        # files mode: say which file to write; nothing else is written (writer.json stays absent).
        print(f"WAITING: write the answer to {w.reply_path}\n         (the prompt is {w.prompt_path})\n"
              f"         then run the same command again.")
        return EXIT_WAITING
    except (BadReply, llm.LlmError, RuntimeError, OSError, ValueError, KeyError) as e:
        run.error = f"{type(e).__name__}: {e}"
        run.status = "failed"
        return finish(run, EXIT_FAILED)


def main(argv=None):
    ap = argparse.ArgumentParser(prog="python -m pipeline.writer", description="topic -> script -> voice -> storyboard -> show.json")
    ap.add_argument("--topic", required=True)
    ap.add_argument("--slug", required=True)
    ap.add_argument("--mode", choices=["api", "files"])
    try:
        args = ap.parse_args(argv)
    except SystemExit as e:
        return EXIT_USAGE if e.code else EXIT_OK
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,60}", args.slug):
        print("--slug: use a-z, 0-9 and dashes (e.g. moon-gone)")
        return EXIT_USAGE
    code = write(args.topic, args.slug, mode=args.mode)
    folder = REPO / "shows" / args.slug
    if code != EXIT_WAITING:
        print(f"writer: exit {code}; see {folder / 'review.md'} and {folder / 'writer.json'}")
    return code


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.exit(main())
