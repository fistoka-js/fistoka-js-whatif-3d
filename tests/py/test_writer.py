"""The writer (pipeline/writer.py) with a fake LLM, a fake voice, a fake picture check and the REAL
node validator. Nothing here calls a paid service or the network."""
import json
import shutil
from pathlib import Path
from types import SimpleNamespace

import pytest

from pipeline import fallback, llm, writer

pytestmark = pytest.mark.skipif(shutil.which("node") is None, reason="node is not installed")

SCRIPT = ("What if the Moon vanished tonight? The tides would shrink to a third of their size. "
          "Earth's tilt would start to wobble over millions of years. Nights would be much darker. "
          "Follow for more what ifs.")
GOOD_CLAIM = {"claim": "Tides would shrink to a third.", "quote": "tides would shrink to a third",
              "verdict": "supported", "note": "ok"}
BAD_CLAIM = {"claim": "Earth's tilt would wobble.", "quote": "tilt would start to wobble",
             "verdict": "unsupported", "note": "needs a source"}


def script_reply(script=SCRIPT, **extra):
    d = {"title": "What if the Moon vanished?", "script": script, "description": "A short what if.",
         "tags": ["moon", "space"], "feasible": True, "missing": [],
         "claims": ["Tides would shrink to a third", "Nights would be darker"]}
    d.update(extra)
    return json.dumps(d)


def audit_reply(*claims):
    return json.dumps({"claims": list(claims)})


def fake_voice(script, folder, settings):
    """words.json with 0.3 s per word, an empty voice.mp3, and the stats make_voice returns."""
    folder = Path(folder)
    words, t = [], 0.1
    for tok in script.split():
        words.append({"text": tok, "start": round(t, 3), "end": round(t + 0.25, 3)})
        t += 0.3 + (0.25 if tok[-1] in ".?!" else 0)
    (folder / "words.json").write_text(json.dumps(words), encoding="utf-8")
    (folder / "voice.mp3").write_bytes(b"")
    return {"duration": round(words[-1]["end"] + 0.2, 3), "word_count": len(words),
            "words_per_second": 3.3, "longest_pause": 0.5}


def good_show(folder):
    """A valid show for the voiced words (the fallback builder makes one)."""
    words = json.loads((Path(folder) / "words.json").read_text(encoding="utf-8"))
    return fallback.build_fallback_show(words, "What if the Moon vanished?", seed=5)


def broken_show(folder):
    """A show with exactly two validator errors: an unknown prop type and an unknown camera move."""
    show = good_show(folder)
    show["shots"][0]["props"][0]["type"] = "rockett"
    show["shots"][1]["camera"]["move"] = "zoomies"
    return show


class Raise:
    """A reply that is an API failure (refusal, cut-off or outage)."""

    def __call__(self, folder):
        raise llm.LlmError("the model declined to answer")


class FakeLLM:
    """Answers by purpose. Each value is a list of replies (str, or a callable(folder) -> show dict)."""

    def __init__(self, folder, replies):
        self.folder = Path(folder)
        self.replies = {k: list(v) for k, v in replies.items()}
        self.calls = []

    def __call__(self, system, user, *, purpose, max_tokens):
        self.calls.append(SimpleNamespace(purpose=purpose, system=system, user=user))
        key = purpose if purpose in self.replies else purpose.rstrip("0123456789")
        queue = self.replies.get(key) or self.replies.get("show-any")
        assert queue, f"unexpected call {purpose}"
        r = queue.pop(0)
        text = r(self.folder) if callable(r) else r          # Raise() raises here
        if not isinstance(text, str):
            text = json.dumps(text)
        return llm.LlmReply(text=text, input_tokens=1000, output_tokens=200, model="claude-sonnet-5-5",
                            purpose=purpose)

    @property
    def purposes(self):
        return [c.purpose for c in self.calls]


QA_PASS = lambda slug: {"result": "pass", "findings": []}


def run_writer(tmp_path, replies, qa=QA_PASS, settings=None, slug="moon"):
    folder = tmp_path / slug
    fake = FakeLLM(folder, replies)
    s = dict(writer.DEFAULTS, **(settings or {}))
    code = writer.write("What if the Moon vanished?", slug, mode="api", settings=s, complete=fake,
                        voice_fn=fake_voice, qa_fn=qa, shows_dir=tmp_path)
    return code, folder, fake


def result(folder):
    return json.loads((folder / "writer.json").read_text(encoding="utf-8"))


# ---------------------------------------------------------------- the main paths

def test_happy_path_writes_every_file(tmp_path):
    code, folder, fake = run_writer(tmp_path, {"script": [script_reply()], "audit": [audit_reply(GOOD_CLAIM)],
                                               "show": [good_show]})
    assert code == 0
    assert fake.purposes == ["script", "audit", "show"]
    for name in ("script.txt", "words.json", "voice.mp3", "show.json", "review.md", "writer.json"):
        assert (folder / name).exists(), name
    review = (folder / "review.md").read_text(encoding="utf-8")
    assert "- [ ] Tides would shrink to a third" in review and "- [ ] Nights would be darker" in review
    assert "first try" in review and "NEEDS FACT CHECK" not in review
    r = result(folder)
    assert r["status"] == "ok" and r["show"] == "llm" and r["repairs"] == 0 and r["qa"] == "pass"
    assert r["title"] == "What if the Moon vanished?" and r["tags"] == ["moon", "space"]
    assert r["tokens"]["input_tokens"] == 3000 and r["tokens"]["output_tokens"] == 600
    assert r["cost_usd"] == pytest.approx(3 * (1000 * 2 + 200 * 10) / 1e6, abs=1e-4)


def test_one_repair_round_sends_the_validator_messages(tmp_path):
    code, folder, fake = run_writer(tmp_path, {"script": [script_reply()], "audit": [audit_reply(GOOD_CLAIM)],
                                               "show": [broken_show], "repair": [good_show]})
    assert code == 0
    assert fake.purposes == ["script", "audit", "show", "repair1"]
    repair_prompt = fake.calls[-1].user
    assert '"rockett" is not a prop' in repair_prompt
    assert '"zoomies" is not allowed here' in repair_prompt
    assert "YOUR PREVIOUS REPLY" in repair_prompt
    r = result(folder)
    assert r["repairs"] == 1 and r["status"] == "ok"
    assert "repaired 1 time(s)" in (folder / "review.md").read_text(encoding="utf-8")


def test_reply_that_is_not_json_counts_as_a_failed_round(tmp_path):
    code, folder, fake = run_writer(tmp_path, {"script": [script_reply()], "audit": [audit_reply(GOOD_CLAIM)],
                                               "show": ["Here is your show! {oops"], "repair": [good_show]})
    assert code == 0 and result(folder)["repairs"] == 1
    assert "not valid JSON" in fake.calls[-1].user


class Fenced:
    """A show reply wrapped in one ```json code fence (built once the voice exists)."""

    def __call__(self, folder):
        return "```json\n" + json.dumps(good_show(folder)) + "\n```"


def test_one_code_fence_is_stripped(tmp_path):
    code, folder, fake = run_writer(tmp_path, {"script": [script_reply()], "audit": [audit_reply(GOOD_CLAIM)],
                                               "show": [Fenced()]})
    assert code == 0 and result(folder)["repairs"] == 0


def test_every_show_reply_bad_uses_the_fallback(tmp_path):
    bad = [broken_show] * 4                      # the first try and 3 repair rounds
    code, folder, fake = run_writer(tmp_path, {"script": [script_reply()], "audit": [audit_reply(GOOD_CLAIM)],
                                               "show": bad[:1], "repair": bad[1:]})
    assert code == 0
    assert fake.purposes == ["script", "audit", "show", "repair1", "repair2", "repair3"]
    r = result(folder)
    assert r["status"] == "fallback" and r["show"] == "fallback" and r["repairs"] == 3
    assert writer.validate_show(folder)["ok"]
    assert "FALLBACK" in (folder / "review.md").read_text(encoding="utf-8")


def test_not_feasible_writes_needs_props_and_exits_3(tmp_path):
    reply = script_reply(feasible=False, missing=["a map of France", "the Eiffel Tower"])
    code, folder, fake = run_writer(tmp_path, {"script": [reply]})
    assert code == 3
    text = (folder / "NEEDS-PROPS.md").read_text(encoding="utf-8")
    assert "- a map of France" in text and "- the Eiffel Tower" in text
    assert result(folder)["status"] == "needs_props"
    assert not (folder / "show.json").exists()


def test_flagged_claim_triggers_one_redraft_and_still_flagged_is_marked(tmp_path):
    redraft = SCRIPT.replace("Earth's tilt would start to wobble over millions of years.",
                             "Earth's tilt would probably wobble more.")
    still_bad = dict(BAD_CLAIM, quote="tilt would probably wobble more")
    code, folder, fake = run_writer(tmp_path, {
        "script": [script_reply()], "script-redraft": [script_reply(redraft)],
        "audit": [audit_reply(GOOD_CLAIM, BAD_CLAIM)], "audit-redraft": [audit_reply(GOOD_CLAIM, still_bad)],
        "show": [good_show]})
    assert code == 0
    assert fake.purposes == ["script", "audit", "script-redraft", "audit-redraft", "show"]
    assert "CORRECTIONS" in fake.calls[2].user and BAD_CLAIM["claim"] in fake.calls[2].user
    assert (folder / "script.txt").read_text(encoding="utf-8").strip() == redraft
    review = (folder / "review.md").read_text(encoding="utf-8")
    assert review.startswith("NEEDS FACT CHECK")
    assert "unsupported: Earth's tilt would wobble." in review
    assert result(folder)["needs_fact_check"] is True


def test_audit_prompt_says_no_research_was_collected(tmp_path):
    code, folder, fake = run_writer(tmp_path, {"script": [script_reply()], "audit": [audit_reply(GOOD_CLAIM)],
                                               "show": [good_show]})
    assert "No research data was collected" in fake.calls[1].user


def test_too_long_voice_asks_once_to_shorten(tmp_path):
    long_script = " ".join(["The Moon pulls the oceans every single day."] * 26)   # 208 words, about 64 s
    short = "The Moon pulls the oceans. " * 10
    code, folder, fake = run_writer(tmp_path, {
        "script": [script_reply(long_script)], "audit": [json.dumps({"claims": [
            {"claim": "c", "quote": "The Moon pulls the oceans", "verdict": "supported", "note": ""}]})],
        "shorten": [json.dumps({"script": short, "claims": ["The Moon pulls the oceans"]})],
        "show": [good_show]})
    assert code == 0
    assert fake.purposes == ["script", "audit", "shorten", "show"]
    assert "words shorter" in fake.calls[2].user
    assert (folder / "script.txt").read_text(encoding="utf-8").strip() == short.strip()
    assert result(folder)["voice_seconds"] < 58


def test_picture_check_fail_gets_one_repair_round(tmp_path):
    answers = iter([{"result": "fail", "findings": [{"level": "FAIL", "code": "prop-outside", "shot": "shot-2",
                                                    "time": 5.1, "what": "prop is 70% outside", "fix": "move it"}]},
                    {"result": "warn", "findings": []}])
    code, folder, fake = run_writer(tmp_path, {"script": [script_reply()], "audit": [audit_reply(GOOD_CLAIM)],
                                               "show": [good_show], "qa-repair": [good_show]},
                                    qa=lambda slug: next(answers))
    assert code == 0
    assert fake.purposes[-1] == "qa-repair"
    assert "prop is 70% outside" in fake.calls[-1].user
    assert result(folder)["qa"] == "warn"


def test_picture_check_still_failing_is_recorded(tmp_path):
    fail = {"result": "fail", "findings": [{"level": "FAIL", "shot": "a", "time": 1, "what": "x", "fix": "y"}]}
    code, folder, fake = run_writer(tmp_path, {"script": [script_reply()], "audit": [audit_reply(GOOD_CLAIM)],
                                               "show": [good_show], "qa-repair": [good_show]},
                                    qa=lambda slug: fail)
    assert code == 0 and result(folder)["qa"] == "fail"
    assert "Picture check (QA): fail" in (folder / "review.md").read_text(encoding="utf-8")


# ---------------------------------------------------------------- files mode

def test_files_mode_waits_for_each_reply_and_continues(tmp_path, capsys):
    folder = tmp_path / "moon"
    s = dict(writer.DEFAULTS)

    def go():
        return writer.write("What if the Moon vanished?", "moon", mode="files", settings=s,
                            voice_fn=fake_voice, qa_fn=QA_PASS, shows_dir=tmp_path)

    assert go() == 4
    prompt = folder / "llm" / "01-script.prompt.md"
    assert prompt.exists() and not (folder / "writer.json").exists()
    assert "01-script.reply.md" in capsys.readouterr().out
    assert "TOPIC: What if the Moon vanished?" in prompt.read_text(encoding="utf-8")
    (folder / "llm" / "01-script.reply.md").write_text(script_reply(), encoding="utf-8")

    assert go() == 4
    assert (folder / "llm" / "02-audit.prompt.md").exists()
    (folder / "llm" / "02-audit.reply.md").write_text(audit_reply(GOOD_CLAIM), encoding="utf-8")

    assert go() == 4
    show_prompt = (folder / "llm" / "03-show.prompt.md").read_text(encoding="utf-8")
    assert "=== SYSTEM ===" in show_prompt and "# 5. Catalogue" in show_prompt and "## Example 1" in show_prompt
    words_before = (folder / "words.json").read_text(encoding="utf-8")
    (folder / "llm" / "03-show.reply.md").write_text(json.dumps(good_show(folder)), encoding="utf-8")

    assert go() == 0
    assert (folder / "words.json").read_text(encoding="utf-8") == words_before   # not re-voiced
    r = result(folder)
    assert r["status"] == "ok" and r["mode"] == "files" and r["cost_is_estimate"] is True
    assert r["cost_usd"] > 0


# ---------------------------------------------------------------- pieces

def test_cost_arithmetic():
    assert llm.cost_usd("claude-sonnet-5-5", 1_000_000, 0) == pytest.approx(2.00)
    assert llm.cost_usd("claude-sonnet-5-5", 0, 1_000_000) == pytest.approx(10.00)
    assert llm.cost_usd("claude-sonnet-5-5", 0, 0, cache_read_tokens=1_000_000) == pytest.approx(0.10)
    assert llm.cost_usd("claude-sonnet-5-5", 0, 0, cache_write_tokens=1_000_000) == pytest.approx(2.50)
    assert llm.cost_usd("claude-haiku-5-5", 12_000, 4_000) == pytest.approx((12_000 * 0.10 + 4_000 * 0.50) / 1e6)
    reply = llm.LlmReply("x", 800, 4000, "files", cache_read_tokens=0, estimated=True)
    assert llm.reply_cost(reply, "claude-sonnet-5-5") == pytest.approx((800 * 2 + 4000 * 10) / 1e6)
    assert llm.estimate_tokens("abcd" * 100) == 100


def test_api_mode_caches_the_system_part_and_reads_usage():
    seen = {}

    class Messages:
        def create(self, **kw):
            seen.update(kw)
            usage = SimpleNamespace(input_tokens=900, output_tokens=300, cache_read_input_tokens=12000,
                                    cache_creation_input_tokens=0)
            return SimpleNamespace(stop_reason="end_turn", usage=usage,
                                   content=[SimpleNamespace(type="thinking", thinking=""),
                                            SimpleNamespace(type="text", text='{"a": 1}')])

    api = llm.ApiLlm(model="claude-sonnet-5-5", client=SimpleNamespace(messages=Messages()))
    reply = api.complete("SYSTEM TEXT", "USER TEXT", purpose="show", max_tokens=16000)
    assert reply.text == '{"a": 1}' and reply.cache_read_tokens == 12000 and reply.input_tokens == 900
    assert seen["system"][0]["cache_control"] == {"type": "ephemeral"}
    assert seen["messages"] == [{"role": "user", "content": "USER TEXT"}]
    assert "temperature" not in seen


def test_api_mode_refusal_and_cutoff_are_errors():
    def client(stop):
        usage = SimpleNamespace(input_tokens=1, output_tokens=1)
        msg = SimpleNamespace(stop_reason=stop, usage=usage, content=[])
        return SimpleNamespace(messages=SimpleNamespace(create=lambda **kw: msg))

    for stop in ("refusal", "max_tokens"):
        with pytest.raises(llm.LlmError):
            llm.ApiLlm(client=client(stop)).complete("s", "u", purpose="show", max_tokens=10)


def test_api_mode_needs_the_environment_key(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    with pytest.raises(llm.LlmError, match="ANTHROPIC_API_KEY"):
        llm.ApiLlm().complete("s", "u", purpose="script", max_tokens=10)


def test_settings_file_overrides_defaults(tmp_path):
    f = tmp_path / "settings.yaml"
    f.write_text("upload:\n  privacy: private\nwriter:\n  model: claude-haiku-5-5  # cheap\n  max_repairs: 2\n"
                 "  qa: false\n  unknown_key: 1\nother:\n  model: nope\n", encoding="utf-8")
    s = writer.load_settings(f)
    assert s["model"] == "claude-haiku-5-5" and s["max_repairs"] == 2 and s["qa"] is False
    assert s["mode"] == "files" and "unknown_key" not in s
    assert writer.load_settings(tmp_path / "missing.yaml") == writer.DEFAULTS


def test_bad_slug_is_a_usage_error():
    assert writer.main(["--topic", "x", "--slug", "Bad Slug!"]) == 2


@pytest.mark.parametrize("name", writer.EXAMPLE_ORDER)
def test_prompt_examples_are_valid_shows(tmp_path, name):
    src = writer.EXAMPLES / name
    for f in ("show.json", "words.json"):
        shutil.copy(src / f, tmp_path / f)
    (tmp_path / "voice.mp3").write_bytes(b"")
    check = writer.validate_show(tmp_path)
    assert check["ok"], check["errors"][:3]
    assert check["warnings"] == []
    show = json.loads((src / "show.json").read_text(encoding="utf-8"))
    assert json.loads(writer.compact_json(show)) == show
    script = (src / "script.txt").read_text(encoding="utf-8").split()
    words = json.loads((src / "words.json").read_text(encoding="utf-8"))
    assert [w["text"] for w in words] == script          # the words really are this script's voice
    assert (src / "plan.md").exists()


def test_show_prompt_contains_rules_catalogue_and_examples():
    text = writer.show_system_prompt()
    for must in ("# 2. How to think", "BACKDROP", "[floats]", "## Example 1", "## Example 2", "CHECKLIST",
                 "- rocket [floats]"):
        assert must in text
    assert "{{" not in text


def test_words_block_groups_sentences():
    words = [{"text": "Hi", "start": 0.1, "end": 0.2}, {"text": "there.", "start": 0.3, "end": 0.5},
             {"text": "Bye", "start": 1.0, "end": 1.2}]
    block = writer.words_block(words)
    assert block.splitlines()[0] == "S1 [0.10-0.50] Hi there."
    assert "S2 [1.00-1.20] Bye" in block


# ---------------------------------------------------------------- API failures and resumes

def test_api_failure_on_a_show_call_is_a_failed_round(tmp_path):
    code, folder, fake = run_writer(tmp_path, {"script": [script_reply()], "audit": [audit_reply(GOOD_CLAIM)],
                                               "show": [Raise()], "repair": [good_show]})
    assert code == 0 and fake.purposes == ["script", "audit", "show", "repair1"]
    r = result(folder)
    assert r["status"] == "ok" and r["repairs"] == 1
    assert "no answer" in (folder / "review.md").read_text(encoding="utf-8")


def test_api_failing_on_every_show_call_uses_the_fallback(tmp_path):
    code, folder, fake = run_writer(tmp_path, {"script": [script_reply()], "audit": [audit_reply(GOOD_CLAIM)],
                                               "show": [Raise()], "repair": [Raise(), Raise(), Raise()]})
    assert code == 0 and result(folder)["status"] == "fallback"


def test_api_failure_on_the_redraft_keeps_the_first_script(tmp_path):
    code, folder, fake = run_writer(tmp_path, {
        "script": [script_reply()], "script-redraft": [Raise()],
        "audit": [audit_reply(GOOD_CLAIM, BAD_CLAIM)], "show": [good_show]})
    assert code == 0
    assert (folder / "script.txt").read_text(encoding="utf-8").strip() == SCRIPT
    assert result(folder)["needs_fact_check"] is True
    assert "redraft failed" in (folder / "review.md").read_text(encoding="utf-8")


def test_api_failure_on_the_qa_repair_keeps_the_show(tmp_path):
    fail = {"result": "fail", "findings": [{"level": "FAIL", "shot": "a", "time": 1, "what": "x", "fix": "y"}]}
    code, folder, fake = run_writer(tmp_path, {"script": [script_reply()], "audit": [audit_reply(GOOD_CLAIM)],
                                               "show": [good_show], "qa-repair": [Raise()]},
                                    qa=lambda slug: fail)
    assert code == 0 and result(folder)["qa"] == "fail" and result(folder)["status"] == "ok"
    assert writer.validate_show(folder)["ok"]


def test_a_worse_qa_repair_is_not_kept(tmp_path):
    one = {"result": "fail", "findings": [{"level": "FAIL", "shot": "a", "time": 1, "what": "x", "fix": "y"}]}
    two = {"result": "fail", "findings": [dict(one["findings"][0]), dict(one["findings"][0], shot="b")]}
    answers = iter([one, two])
    first = {}

    def remember(folder):
        first["show"] = good_show(folder)
        return first["show"]

    def other(folder):
        show = good_show(folder)
        show["shots"][0]["camera"]["move"] = "still"
        return show

    code, folder, fake = run_writer(tmp_path, {"script": [script_reply()], "audit": [audit_reply(GOOD_CLAIM)],
                                               "show": [remember], "qa-repair": [other]},
                                    qa=lambda slug: next(answers))
    assert code == 0
    assert json.loads((folder / "show.json").read_text(encoding="utf-8")) == json.loads(
        json.dumps(writer.normalise_show(first["show"], "x")))
    assert "kept the earlier show" in (folder / "review.md").read_text(encoding="utf-8")


def test_files_mode_resume_after_a_shorten_does_not_voice_again(tmp_path):
    folder = tmp_path / "moon"
    s = dict(writer.DEFAULTS)
    voiced = []

    def counting_voice(script, folder_, settings):
        voiced.append(len(script.split()))
        return fake_voice(script, folder_, settings)

    def go():
        return writer.write("Moon", "moon", mode="files", settings=s, voice_fn=counting_voice,
                            qa_fn=QA_PASS, shows_dir=tmp_path)

    long_script = " ".join(["The Moon pulls the oceans every single day."] * 26)
    short = "The Moon pulls the oceans. " * 10
    llm_dir = folder / "llm"
    assert go() == 4
    (llm_dir / "01-script.reply.md").write_text(script_reply(long_script), encoding="utf-8")
    assert go() == 4
    (llm_dir / "02-audit.reply.md").write_text(json.dumps({"claims": [
        {"claim": "c", "quote": "The Moon pulls the oceans", "verdict": "supported", "note": ""}]}), encoding="utf-8")
    assert go() == 4                                   # voiced (long), now waiting for the shorten reply
    assert voiced == [208]
    (llm_dir / "03-shorten.reply.md").write_text(json.dumps({"script": short}), encoding="utf-8")
    assert go() == 4                                   # voiced (short), waiting for the show reply
    assert voiced == [208, 50]
    words_before = (folder / "words.json").read_text(encoding="utf-8")
    (llm_dir / "04-show.reply.md").write_text(json.dumps(good_show(folder)), encoding="utf-8")
    assert go() == 0
    assert voiced == [208, 50]                         # nothing voiced again on the resumes
    assert (folder / "words.json").read_text(encoding="utf-8") == words_before


# ---------------------------------------------------------------- the examples follow the prompt's own rules

@pytest.mark.parametrize("name", writer.EXAMPLE_ORDER)
def test_examples_follow_the_prompt_rules(name):
    show = json.loads((writer.EXAMPLES / name / "show.json").read_text(encoding="utf-8"))
    shots = show["shots"]
    assert 7 <= len(shots) <= 10
    moves = [s["camera"].get("move", "drift") for s in shots]
    assert all(a != b for a, b in zip(moves, moves[1:])), moves
    assert len(set(moves)) >= 4
    assert len({s["camera"].get("angle", "front") for s in shots}) >= 3
    envs = [json.dumps(s["env"], sort_keys=True) for s in shots]
    assert all(envs.count(e) <= 2 for e in envs), "same environment settings more than twice"
    for s in shots:
        assert 1 <= len(s["props"]) <= 3, s["id"]
        assert s["actions"], s["id"]
        focus = set(s["camera"].get("focus", []))
        for a in s["actions"]:
            if a["do"] == "label":
                assert len(a["text"]) <= 22 and a["text"] == a["text"].upper(), a["text"]
                assert a["prop"] not in {p["id"] for p in s["props"] if p.get("size", 1) >= 4}, "label on a backdrop"
            if a["do"] == "text":
                assert a["text"] == a["text"].upper()
            if focus and a.get("prop"):
                big = {p["id"] for p in s["props"] if p.get("size", 1) >= 4}
                assert a["prop"] not in big, f"action on backdrop prop in {s['id']}"
