"""The writer: topic -> script -> voice -> show.json, with checks and repairs.

    python -m pipeline.writer --topic "What if the Moon disappeared?" --slug moon-gone [--mode api|files]

Steps (docs/WRITER.md explains each in plain words):
  1. Script call (title, script, description, tags, feasible, missing, claims). Not feasible ->
     shows/<slug>/NEEDS-PROPS.md and exit 3.
  2. Fact check (pipeline/fact_check.py): flagged claims -> one redraft -> anything still flagged is
     listed under NEEDS FACT CHECK in review.md.
  3. Voice (pipeline.voice.make_voice, free Edge TTS). Longer than the limit -> one "shorten" call,
     then voice again.
  4. Show call -> shows/<slug>/show.json -> node tools/validate.mjs. Errors -> up to 3 repair rounds.
  5. Picture check (node tools/qa.mjs). fail -> one repair round, then check again; keep the best.
  6. No valid show at all -> pipeline/fallback.py builds a plain one.
  7. review.md (for the human) and writer.json (for the pipeline runner).

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
from datetime import datetime, timezone
from pathlib import Path

from . import catalog_text, fact_check, fallback, llm

REPO = Path(__file__).resolve().parents[1]
PROMPTS = Path(__file__).resolve().parent / "prompts"
EXAMPLES = PROMPTS / "examples"
EXAMPLE_ORDER = ["rings", "ice"]

# Settings and their defaults. settings.yaml (optional, at the repo root) can override them under
# a "writer:" section, e.g.  writer:\n  model: claude-haiku-5-5
DEFAULTS = {
    "mode": "files",              # files (free, a person/agent answers) or api (paid)
    "model": llm.DEFAULT_MODEL,   # claude-sonnet-5-5; claude-haiku-5-5 is the cheap option
    "effort": "medium",           # api only: low | medium | high
    "max_repairs": 3,             # validator repair rounds
    "qa_repair": True,            # one repair round when the picture check fails
    "qa": True,                   # run the picture check at all (needs Chrome and 2 GB free RAM)
    "max_seconds": 58.0,          # the voice must end before this
    "voice": "en-US-AndrewNeural",
    "rate": "+12%",
    "fallback_seed": 0,
}
SCRIPT_MAX_TOKENS = 16000          # a cap, not a cost: thinking (always on) plus the JSON must fit
SHOW_MAX_TOKENS = 16000

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


def sentences(words):
    """Group words.json entries into sentences (lists of words)."""
    out, cur = [], []
    for w in words:
        cur.append(w)
        if re.search(r"[.!?][\"')\]]*$", w["text"]):
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


def show_duration(words, tail=0.4):
    return round(words[-1]["end"] + tail, 2)


def suggested_shots(duration):
    return max(7, min(10, round(duration / 5.0)))


def compact_json(show):
    """show.json with one prop or action per line: readable and about half the tokens of indent=2."""
    def j(v):
        return json.dumps(v, ensure_ascii=False)
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
    """For the script prompt: prop and environment names with their one-line summaries."""
    lines = ["Props:"]
    lines += [f"- {n}: {p['summary']}" for n, p in cat["props"].items()]
    lines += ["Environments:"]
    lines += [f"- {n}: {e['summary']}" for n, e in cat["envs"].items()]
    return "\n".join(lines)


def examples_text():
    """The worked examples for the show prompt: input words, the plan, the output show."""
    out = []
    for n, name in enumerate(EXAMPLE_ORDER, 1):
        d = EXAMPLES / name
        show = json.loads((d / "show.json").read_text(encoding="utf-8"))
        words = json.loads((d / "words.json").read_text(encoding="utf-8"))
        plan = (d / "plan.md").read_text(encoding="utf-8").strip()
        out.append(f"## Example {n}: {show['title']}\n\nINPUT (the words, as you will get them):\n"
                   f"{words_block(words)}\n\nTHE BEAT PLAN (your thinking, not part of the reply):\n{plan}\n\n"
                   f"OUTPUT (the reply):\n{compact_json(show)}")
    return "\n\n".join(out)


def show_system_prompt(cat=None):
    cat = cat or catalog_text.load_catalog()
    return fill(read_prompt("show_system.md"), CATALOG=catalog_text.catalog_text(cat).strip(),
                EXAMPLES=examples_text())


def script_system_prompt(cat=None):
    cat = cat or catalog_text.load_catalog()
    return fill(read_prompt("script_system.md"), CATALOG_NAMES=catalog_names(cat))


def show_user_prompt(title, words):
    dur = show_duration(words)
    return fill(read_prompt("show_user.md"), TITLE=title, WORDS=words_block(words),
                LAST_END=f"{words[-1]['end']:.2f}", DURATION=f"{dur:.2f}", SHOTS=suggested_shots(dur))


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
    except json.JSONDecodeError as e:
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
    except json.JSONDecodeError as e:
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


def validate_show(folder):
    """{"ok", "errors": [{path, message, hint}], "warnings"} from node tools/validate.mjs."""
    code, data, err = node_json(["tools/validate.mjs", str(folder)])
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
        self.fact = {"first_audit": None, "final_audit": None, "redrafted": False,
                     "redraft_error": None, "needs_fact_check": False}
        self.voice_stats = None
        self.voice_note = ""
        self.show_source = "none"        # llm | fallback | none
        self.repairs = 0
        self.history = []                # one line per show attempt
        self.qa = {"result": "not_run", "reason": "no show", "findings": []}
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


def write_script_step(run, complete, cat):
    """Script call + fact check (+ one redraft). Returns the draft dict or None (not feasible)."""
    system = script_system_prompt(cat)
    user = fill(read_prompt("script_user.md"), TOPIC=run.topic)
    draft = parse_loose_json(_ask(run, complete, system, user, "script", SCRIPT_MAX_TOKENS))
    draft["script"] = clean_script(draft.get("script"))
    run.draft = draft
    if draft.get("feasible") is False:
        return None
    if not draft["script"]:
        raise BadReply("the script reply had no script text")

    def audit_call(purpose):
        return lambda prompt: _ask(run, complete, "", prompt, purpose, SCRIPT_MAX_TOKENS)

    first = fact_check.audit_script(draft["script"], "", run.topic, llm_call=audit_call("audit"))
    run.fact["first_audit"] = run.fact["final_audit"] = first
    if first["available"] and not first["ok"]:
        flagged = fact_check.flagged_claims(first)
        try:
            redraft = parse_loose_json(_ask(run, complete, system, user + fact_check.build_corrections_block(flagged),
                                            "script-redraft", SCRIPT_MAX_TOKENS))
            script = clean_script(redraft.get("script"))
            if not script:
                raise BadReply("the redraft had no script text")
            for k, v in draft.items():
                redraft.setdefault(k, v)
            redraft["script"] = script
            final = fact_check.audit_script(script, "", run.topic, llm_call=audit_call("audit-redraft"))
            run.draft = draft = redraft
            run.fact["redrafted"] = True
            run.fact["final_audit"] = final
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
    if stats["duration"] > limit:
        wps = stats["word_count"] / max(stats["duration"], 1)
        cut = math.ceil((stats["duration"] - limit) * wps) + 6
        target = max(60, stats["word_count"] - cut)
        user = fill(read_prompt("shorten_user.md"), TOPIC=run.topic, SCRIPT=script,
                    SECONDS=f"{stats['duration']:.1f}", LIMIT=f"{limit:.0f}", WORDS=cut, TARGET=target)
        try:
            short = parse_loose_json(_ask(run, complete, script_system_prompt(cat), user, "shorten",
                                          SCRIPT_MAX_TOKENS))
            new_script = clean_script(short.get("script"))
            if new_script:
                run.draft["script"] = new_script
                if as_list(short.get("claims")):
                    run.draft["claims"] = short["claims"]
                stats = _voice_if_needed(folder, new_script, voice_fn, run.settings,
                                         shortened_from={"sha256": _fingerprint(script), "stats": stats})
                run.voice_note = f"shortened once ({cut} words asked)"
        except (BadReply, llm.LlmError) as e:
            run.voice_note = f"shorten failed: {e}"
        if stats["duration"] > limit:
            run.voice_note += f"; STILL TOO LONG: {stats['duration']:.1f} s"
    run.voice_stats = stats
    return stats


def _fingerprint(script):
    return hashlib.sha256(script.encode("utf-8")).hexdigest()


def _voice_if_needed(folder, script, voice_fn, settings, shortened_from=None):
    """Voice only when the script differs from the one last voiced, so a resumed run keeps the word
    times that an earlier show reply was written against. voice.stats.json remembers the last voiced
    script and, after a shorten, the long script it replaced (that one is never voiced again)."""
    digest = _fingerprint(script)
    marker = folder / "voice.stats.json"
    (folder / "script.txt").write_text(script + "\n", encoding="utf-8")
    if marker.exists() and (folder / "words.json").exists():
        saved = json.loads(marker.read_text(encoding="utf-8"))
        if saved.get("sha256") == digest:
            return saved["stats"]
        before = saved.get("shortened_from") or {}
        if before.get("sha256") == digest:
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


def show_step(run, complete, validate_fn, cat, words):
    """Show call + validator repairs. Returns the valid show dict, or None."""
    folder = run.folder
    title = run.draft.get("title") or run.topic
    system = show_system_prompt(cat)
    original = show_user_prompt(title, words)
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
            if result.get("ok"):
                run.history.append(f"{purpose}: valid ({len(result.get('warnings', []))} warning(s))")
                return show
            run.history.append(f"{purpose}: {len(result['errors'])} validator error(s)")
            errors_text = _error_lines(result["errors"])
            previous = compact_json(show)
        user = fill(read_prompt("repair_user.md"), ORIGINAL=original, PREVIOUS=previous, ERRORS=errors_text)
        purpose = f"repair{attempt + 1}"
    return None


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
    user = fill(read_prompt("qa_repair_user.md"), ORIGINAL=show_user_prompt(title, words),
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
    if not validate_fn(folder).get("ok"):
        keep_old("the repaired show did not validate")
        return show
    qa2 = qa_fn(run.slug)
    fails2 = _count_fails(qa2)
    if qa2.get("result") == "not_run" or fails2 > fails:
        keep_old(f"picture check after repair: {qa2.get('result')} ({fails2} fails)")
        run.qa = qa
        return show
    run.history.append(f"qa-repair: picture check now {qa2.get('result')} ({fails2} fails, was {fails})")
    run.qa = qa2
    return new


def write_needs_props(run):
    missing = as_list(run.draft.get("missing")) or ["(the model did not say)"]
    text = (f"# Needs props: {run.topic}\n\nThe writer stopped: this topic needs things the 3D catalogue "
            f"does not have.\n\nMissing:\n" + "\n".join(f"- {m}" for m in missing) + "\n\n"
            "Add the props (see docs/AUTHORING.md), or pick another topic.\n")
    (run.folder / "NEEDS-PROPS.md").write_text(text, encoding="utf-8")


def _claims_md(run):
    claims = as_list(run.draft.get("claims"))
    return "\n".join(f"- [ ] {c}" for c in claims) or "- (the model listed none)"


def _audit_md(audit):
    if not audit:
        return "- not run"
    if not audit.get("available"):
        return f"- unavailable: {audit.get('error')}"
    return "\n".join(f"- {c['verdict']}: {c['claim']}" + (f" (Note: {c['note']})" if c.get("note") else "")
                     for c in audit["claims"])


def review_text(run):
    t = run.totals()
    d = run.draft
    made = {"llm": "first try" if run.repairs == 0 else f"repaired {run.repairs} time(s)",
            "fallback": "FALLBACK (plain automatic show: the LLM's show never validated)",
            "none": "no show"}[run.show_source]
    lines = []
    if run.fact["needs_fact_check"]:
        lines += ["NEEDS FACT CHECK", ""]
    lines += [f"# Review: {d.get('title') or run.topic}", "",
              f"- Topic: {run.topic}", f"- Slug: {run.slug}", f"- Status: {run.status}",
              f"- Show: {made}", f"- Picture check (QA): {run.qa.get('result')}"
              + (f" ({run.qa.get('reason')})" if run.qa.get("reason") else ""),
              f"- Voice: {run.voice_stats['duration']:.1f} s, {run.voice_stats['word_count']} words"
              + (f" ({run.voice_note})" if run.voice_note else "") if run.voice_stats else "- Voice: not made",
              f"- Mode: {run.mode}; model priced as {run.price_model()}",
              f"- Written: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}", ""]
    if run.error:
        lines += ["## Error", run.error, ""]
    lines += ["## Script", d.get("script", ""), "",
              "## Claims to check (tick each one you have verified)", _claims_md(run), ""]
    if run.fact["needs_fact_check"]:
        fa = run.fact["final_audit"] or {}
        flagged = fact_check.flagged_claims(fa) if fa.get("available") else []
        lines += ["## NEEDS FACT CHECK",
                  ("The automatic fact check could not run: " + str(fa.get("error"))) if not fa.get("available")
                  else "Still flagged after one redraft:" if run.fact["redrafted"] else "Flagged:",
                  "\n".join(f"- {c['verdict']}: {c['claim']} (Note: {c['note']})" for c in flagged), ""]
    lines += ["## Automatic fact check (final audit)", _audit_md(run.fact["final_audit"]),
              f"- Redrafted: {'yes' if run.fact['redrafted'] else 'no'}"
              + (f" (redraft failed: {run.fact['redraft_error']})" if run.fact["redraft_error"] else ""), "",
              "## Description", d.get("description", ""), "",
              "## Tags", ", ".join(as_list(d.get("tags"))), "",
              "## How the show was made"]
    lines += [f"- {h}" for h in run.history] or ["- (no show attempts)"]
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
    files = sorted({p.name for p in run.folder.iterdir() if p.is_file()} | {"review.md", "writer.json"})
    if (run.folder / "llm").is_dir():
        files.append("llm/ (every prompt and reply)")
    lines += ["", "## Files", ", ".join(files), ""]
    return "\n".join(lines)


def writer_json(run):
    d = run.draft
    t = run.totals()
    return {
        "slug": run.slug, "topic": run.topic, "status": run.status,
        "title": d.get("title", ""), "description": d.get("description", ""), "tags": as_list(d.get("tags")),
        "show": run.show_source, "repairs": run.repairs,
        "qa": run.qa.get("result"),
        "needs_fact_check": run.fact["needs_fact_check"],
        "voice_seconds": run.voice_stats["duration"] if run.voice_stats else None,
        "mode": run.mode, "model": run.price_model(),
        "tokens": {k: t[k] for k in ("input_tokens", "output_tokens", "cache_read_tokens", "cache_write_tokens")},
        "cost_usd": t["cost_usd"], "cost_is_estimate": t["estimated"],
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
    stale = folder / "writer.json"
    if stale.exists():
        stale.unlink()                   # never leave an old result readable while this run is unfinished
    complete = complete or llm.make_complete(mode, folder, model=settings["model"], effort=settings["effort"])
    voice_fn = voice_fn or default_voice
    validate_fn = validate_fn or validate_show
    qa_fn = qa_fn or run_qa
    run = Run(topic, slug, folder, settings, mode)
    cat = catalog_text.load_catalog()
    try:
        draft = write_script_step(run, complete, cat)
        if draft is None:
            write_needs_props(run)
            run.status = "needs_props"
            return finish(run, EXIT_NEEDS_PROPS)
        voice_step(run, complete, voice_fn, cat)
        words = json.loads((folder / "words.json").read_text(encoding="utf-8"))
        show = show_step(run, complete, validate_fn, cat, words)
        if show is not None:
            run.show_source = "llm"
        else:
            show = fallback.build_fallback_show(words, run.draft.get("title") or topic,
                                                seed=int(settings["fallback_seed"]))
            (folder / "show.json").write_text(json.dumps(show, indent=1, ensure_ascii=False), encoding="utf-8")
            if not validate_fn(folder).get("ok"):
                raise RuntimeError("the fallback show did not validate (a bug in pipeline/fallback.py)")
            run.show_source = "fallback"
            run.history.append("fallback show used")
        qa_step(run, complete, validate_fn, qa_fn, cat, words, show)
        run.status = "ok" if run.show_source == "llm" else "fallback"
        return finish(run, EXIT_OK)
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
    ap = argparse.ArgumentParser(prog="python -m pipeline.writer", description="topic -> script -> voice -> show.json")
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
