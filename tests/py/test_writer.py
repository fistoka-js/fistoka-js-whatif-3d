"""The writer (pipeline/writer.py) with a fake LLM, a fake voice, a fake picture check and the REAL
node validator. Nothing here calls a paid service or the network."""
import itertools
import json
import math
import re
import shutil
from pathlib import Path
from types import SimpleNamespace

import pytest

from pipeline import fallback, llm, writer

pytestmark = pytest.mark.skipif(shutil.which("node") is None, reason="node is not installed")

SCRIPT = ("What if the Moon vanished tonight? The tides would shrink to a third of their size. "
          "Earth's tilt would start to wobble over millions of years. Nights would be much darker. "
          "Comment your answer below.")
GOOD_CLAIM = {"claim": "Tides would shrink to a third.", "quote": "tides would shrink to a third",
              "verdict": "supported", "note": "ok"}
BAD_CLAIM = {"claim": "Earth's tilt would wobble.", "quote": "tilt would start to wobble",
             "verdict": "unsupported", "note": "needs a source"}


def beats_for(script, change="the oceans pull back"):
    """A usable beat list: one beat per sentence of the script."""
    return [{"sentence": s, "subject": "planet", "change": change, "dial": "tide"}
            for s in writer.script_sentences(script)]


def script_reply(script=SCRIPT, **extra):
    d = {"title": "What if the Moon vanished?", "script": script, "beats": beats_for(script),
         "description": "A short what if.", "tags": ["moon", "space"], "feasible": True, "missing": [],
         "claims": ["Tides would shrink to a third", "Nights would be darker"]}
    d.update(extra)
    return json.dumps(d)


def audit_reply(*claims):
    return json.dumps({"claims": list(claims)})


def fake_voice(script, folder, settings):
    """words.json with 0.29 s per word, an empty voice.mp3, and the stats make_voice returns."""
    folder = Path(folder)
    words, t = [], 0.1
    for tok in script.split():
        words.append({"text": tok, "start": round(t, 3), "end": round(t + 0.24, 3)})
        t += 0.29 + (0.12 if tok[-1] in ".?!" else 0)
    (folder / "words.json").write_text(json.dumps(words), encoding="utf-8")
    (folder / "voice.mp3").write_bytes(b"")
    return {"duration": round(words[-1]["end"] + 0.2, 3), "word_count": len(words),
            "words_per_second": 3.3, "longest_pause": 0.5}


def story_show(words):
    """A show that passes validate.mjs --story-rules for any fake_voice words: one hero planet in one
    scene of continuing shots, and one dial bound to two things (its atmosphere and its colour) plus
    the background, keyed at the start of every sentence so it is always moving. Keys use {"time"}
    anchors so repeated words in the test scripts cannot trip the anchor search."""
    starts = [s[0]["start"] for s in writer.sentences(words)]
    keys = [{"at": {"time": t}, "to": 1 - i % 2} for i, t in enumerate(starts)]
    shots = [{"id": "s0", "env": {"type": "studio", "color": {"dial": "tide", "colors": ["#203a60", "#7a2a20"]}},
              "props": [{"id": "hero", "type": "planet", "look": "earth",
                         "atmosphere": {"dial": "tide", "to": [0, 1.5]},
                         "color": {"dial": "tide", "colors": "spectrum"}}],
              "camera": {"move": "orbit"}, "actions": []}]
    end, last, n = words[-1]["end"] + writer.TAIL_SECONDS, 0.0, 1
    for s in starts[1:]:
        if s - last >= 6 and end - s >= 3:          # a continuing shot every 6+ s keeps shots under 12 s
            shots.append({"id": f"s{n}", "start": {"time": s}, "continue": True, "actions": [],
                          "camera": {"move": "push_in" if n % 2 else "drift",
                                     "framing": "close" if n % 2 else "medium"}})
            last, n = s, n + 1
    if len(shots) == 1:                              # broken_show needs a second shot
        mid = starts[len(starts) // 2]
        shots.append({"id": "s1", "start": {"time": mid}, "continue": True, "actions": [],
                      "camera": {"move": "push_in", "framing": "close"}})
    return {"format": 1, "title": "What if the Moon vanished?", "voice": {"audio": "voice.mp3", "words": "words.json"},
            "dials": {"tide": {"start": 0, "keys": keys}}, "shots": shots}


def good_show(folder):
    """A valid show (story rules on) for the voiced words."""
    words = json.loads((Path(folder) / "words.json").read_text(encoding="utf-8"))
    return story_show(words)


def slideshow(folder):
    """The fallback builder's plain slideshow: valid without the story rules, rejected with them."""
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
# The tests written before the storyboard step run with it off: they test the other steps, and they also
# prove that `"storyboard": false` keeps the old calls, numbering and prompts. Storyboard tests turn it on.
OLD_DEFAULTS = dict(writer.DEFAULTS, storyboard=False)


def run_writer(tmp_path, replies, qa=QA_PASS, settings=None, slug="moon"):
    folder = tmp_path / slug
    fake = FakeLLM(folder, replies)
    s = dict(OLD_DEFAULTS, **(settings or {}))
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
    # The fallback is a slideshow: valid without the story rules, and clearly marked as not publishable.
    assert writer.validate_show(folder, story_rules=False)["ok"]
    assert not writer.validate_show(folder, story_rules=True)["ok"]
    assert r["fallback_note"] == "fallback: not good enough to publish"
    review = (folder / "review.md").read_text(encoding="utf-8")
    assert review.startswith("FALLBACK: NOT GOOD ENOUGH TO PUBLISH")
    assert "- Show: fallback: not good enough to publish" in review


def test_a_show_with_non_object_shots_is_repaired_then_falls_back(tmp_path):
    junk = {"format": 1, "shots": ["x"]}
    code, folder, fake = run_writer(tmp_path, {"script": [script_reply()], "audit": [audit_reply(GOOD_CLAIM)],
                                               "show": [junk], "repair": [junk, {"shots": [None]}, junk]})
    assert code == 0
    assert fake.purposes == ["script", "audit", "show", "repair1", "repair2", "repair3"]
    assert result(folder)["status"] == "fallback"
    assert (folder / "review.md").exists()
    for bad in ({"shots": [None]}, {"shots": "abc"}, {"a": 1}, {"shots": [[1]]}, {"shots": 5}):
        assert writer.dial_reach(bad) == 0


def test_an_llm_show_is_not_marked_as_fallback(tmp_path):
    code, folder, fake = run_writer(tmp_path, {"script": [script_reply()], "audit": [audit_reply(GOOD_CLAIM)],
                                               "show": [good_show]})
    assert code == 0 and result(folder)["fallback_note"] is None
    assert "not good enough to publish" not in (folder / "review.md").read_text(encoding="utf-8")


MECHANISM = ("A cross-section of a butterfly wing scale: rows of tiny ridges with gaps between them. "
             "The gap width varies from 100 to 300 nanometres, and the reflected light's colour follows it.")


def test_not_feasible_writes_needs_props_and_exits_3(tmp_path):
    reply = script_reply(script="", beats=[], feasible=False, mechanism_prop=MECHANISM,
                         missing=["a wing scale with ridges", "a gap that can vary"])
    code, folder, fake = run_writer(tmp_path, {"script": [reply]})
    assert code == 3
    assert fake.purposes == ["script"]                    # no rewrite, no fact check, no voice
    text = (folder / "NEEDS-PROPS.md").read_text(encoding="utf-8")
    assert "## The mechanism prop that is needed" in text and MECHANISM in text
    assert "- a wing scale with ridges" in text and "- a gap that can vary" in text
    assert result(folder)["status"] == "needs_props"
    assert not (folder / "show.json").exists() and not (folder / "voice.mp3").exists()


def test_first_call_not_feasible_ignores_its_script_and_review_says_nothing_was_accepted(tmp_path):
    reply = script_reply(feasible=False, mechanism_prop=MECHANISM, missing=["a wing scale"])
    code, folder, fake = run_writer(tmp_path, {"script": [reply]})
    assert code == 3 and fake.purposes == ["script"]
    assert not (folder / "voice.mp3").exists()
    review = (folder / "review.md").read_text(encoding="utf-8")
    assert "No script was accepted" in review
    assert review.startswith("# Review: " + folder.name + "\n")
    for gone in ("## Script", "## Claims to check", "## Description", "## Tags", "last one the run accepted",
                 "Automatic fact check"):
        assert gone not in review


def test_not_feasible_topic_goes_to_the_needs_props_queue(tmp_path, monkeypatch):
    """The runner (pipeline/run.py) runs the real writer with a mocked reply; exit 3 moves the topic."""
    from pipeline import run
    from pipeline.queue import Queue
    (tmp_path / "settings.yaml").write_text('channel_id: "UCgood"\nllm_mode: files\n')
    q = Queue(tmp_path / "queue")
    q.add("Why are butterfly wings blue?", today=__import__("datetime").date(2026, 1, 1))
    reply = script_reply(script="", beats=[], feasible=False, mechanism_prop=MECHANISM, missing=["wing scale"])

    def fake_cmd(cmd, log, cwd=None):
        cmd = [str(c) for c in cmd]
        assert "pipeline.writer" in " ".join(cmd), cmd          # nothing after the writer may run
        slug = cmd[cmd.index("--slug") + 1]
        fake = FakeLLM(tmp_path / "shows" / slug, {"script": [reply]})
        return writer.write(cmd[cmd.index("--topic") + 1], slug, mode="api", settings=dict(OLD_DEFAULTS),
                            complete=fake, voice_fn=fake_voice, qa_fn=QA_PASS, shows_dir=tmp_path / "shows")

    monkeypatch.setattr(run, "run_cmd", fake_cmd)
    run.main(["--no-upload"], root=tmp_path)
    assert q.count("needs-props") == 1 and q.count("pending") == 0
    needs = list((tmp_path / "shows").glob("*/NEEDS-PROPS.md"))
    assert len(needs) == 1 and MECHANISM in needs[0].read_text(encoding="utf-8")


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
    long_script = LONG_SCRIPT
    short = _one_sentence(writer.WORD_FLOOR)
    code, folder, fake = run_writer(tmp_path, {
        "script": [script_reply(long_script)], "audit": [json.dumps({"claims": [
            {"claim": "c", "quote": "The Moon pulls the oceans", "verdict": "supported", "note": ""}]})],
        "shorten": [json.dumps({"script": short, "beats": beats_for(short), "claims": ["The Moon pulls the oceans"]})],
        "audit-shorten": [json.dumps({"claims": [
            {"claim": "c", "quote": "The Moon pulls the oceans", "verdict": "supported", "note": ""}]})],
        "show": [good_show]})
    assert code == 0
    # A plain shorten (no beat rewrite) is fact-checked too: new words may carry new claims.
    assert fake.purposes == ["script", "audit", "shorten", "audit-shorten", "show"]
    assert "words shorter" in fake.calls[2].user
    assert short.strip() in fake.calls[3].user and long_script not in fake.calls[3].user
    assert (folder / "script.txt").read_text(encoding="utf-8").strip() == short.strip()
    assert result(folder)["voice_seconds"] < 60


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


# ---------------------------------------------------------------- beat list and story rules

def test_beat_list_is_parsed_and_passed_to_the_show_call(tmp_path):
    beats = beats_for(SCRIPT)
    beats[1] = dict(beats[1], subject="ocean", change="the tide line shrinks", dial="tide")
    code, folder, fake = run_writer(tmp_path, {"script": [script_reply(beats=beats)],
                                               "audit": [audit_reply(GOOD_CLAIM)], "show": [good_show]})
    assert code == 0 and fake.purposes == ["script", "audit", "show"]
    show_user = fake.calls[-1].user
    assert "THE PICTURE PLAN" in show_user
    assert "S2 subject: ocean | change: the tide line shrinks | dial: tide" in show_user
    assert "S5 subject: planet" in show_user
    r = result(folder)
    assert r["beats"][1]["change"] == "the tide line shrinks" and r["beat_rewrite"] is False
    assert "S2: ocean | the tide line shrinks | dial: tide" in (folder / "review.md").read_text(encoding="utf-8")


def test_unshowable_sentence_triggers_one_rewrite_before_the_voice(tmp_path):
    bad = beats_for(SCRIPT)
    bad[3] = dict(bad[3], change="none")                  # "Nights would be much darker." shows nothing
    rewritten = SCRIPT.replace("Nights would be much darker.", "The night sky turns black.")
    voiced = []

    def voice(script, folder_, settings):
        voiced.append(script)
        return fake_voice(script, folder_, settings)

    folder = tmp_path / "moon"
    fake = FakeLLM(folder, {"script": [script_reply(beats=bad)], "script-rewrite": [script_reply(rewritten)],
                            "audit": [audit_reply(GOOD_CLAIM)], "show": [good_show]})
    code = writer.write("What if the Moon vanished?", "moon", mode="api", settings=dict(OLD_DEFAULTS),
                        complete=fake, voice_fn=voice, qa_fn=QA_PASS, shows_dir=tmp_path)
    assert code == 0
    assert fake.purposes == ["script", "script-rewrite", "audit", "show"]   # rewrite comes before any voice
    assert 'S4 "Nights would be much darker.": nothing visibly changes' in fake.calls[1].user
    assert voiced == [rewritten]                          # only the rewritten script was ever voiced
    assert result(folder)["beat_rewrite"] is True
    assert "Sent back once for a rewrite" in (folder / "review.md").read_text(encoding="utf-8")


def test_a_rewrite_that_is_still_unshowable_is_not_sent_back_again(tmp_path):
    bad = beats_for(SCRIPT, change="nothing")
    code, folder, fake = run_writer(tmp_path, {"script": [script_reply(beats=bad)],
                                               "script-rewrite": [script_reply(beats=bad)],
                                               "audit": [audit_reply(GOOD_CLAIM)], "show": [good_show]})
    assert code == 0
    assert fake.purposes == ["script", "script-rewrite", "audit", "show"]
    assert "no usable picture plan" in fake.calls[-1].user           # a wrong plan is not passed on
    assert "STILL WRONG" in (folder / "review.md").read_text(encoding="utf-8")


def test_beat_problems_finds_missing_wrong_length_and_no_change():
    assert writer.beat_problems(SCRIPT, []) == ["there is no beat list: give one beat per sentence"]
    short = writer.beat_problems(SCRIPT, writer.normalise_beats(beats_for(SCRIPT)[:3]))
    assert "the beat list has 3 entries but the script has 5 sentences" in short[0]
    assert writer.beat_problems(SCRIPT, writer.normalise_beats(beats_for(SCRIPT))) == []
    assert writer.script_sentences("No paint. No dye. Just physics.") == ["No paint.", "No dye.", "Just physics."]
    # A camera move or a label named exactly as in the list is flagged.
    camera = writer.normalise_beats(beats_for(SCRIPT))
    camera[0]["change"] = "the camera pushes in"
    camera[2]["change"] = "a label appears"
    found = writer.beat_problems(SCRIPT, camera)
    assert len(found) == 2 and "S1" in found[0] and "nothing visibly changes" in found[0]
    assert "S3" in found[1]


def test_a_beat_list_that_does_not_match_the_voiced_sentences_is_not_passed_on():
    words = [{"text": t, "start": i * 0.3, "end": i * 0.3 + 0.2} for i, t in enumerate(SCRIPT.split())]
    beats = writer.normalise_beats(beats_for(SCRIPT))
    assert "S1 subject: planet" in writer.show_user_prompt("t", words, SCRIPT, beats)
    assert "no usable picture plan" in writer.show_user_prompt("t", words[:-5], SCRIPT, beats)


def test_beat_problems_names_the_flagged_beats_only():
    beats = writer.normalise_beats(beats_for(SCRIPT))
    beats[0]["change"] = "shown"
    beats[1]["change"] = "is shown"
    beats[2]["change"] = "a pan of water starts to boil"          # "pan" is a thing here
    beats[3]["change"] = "counter-rotating gears speed up"
    found = writer.beat_problems(SCRIPT, beats)
    assert len(found) == 2 and "S1" in found[0] and "S2" in found[1]
    assert all("nothing visibly changes" in p for p in found)


def test_a_dash_dial_is_not_printed_in_review(tmp_path):
    beats = [dict(b, dial="-") for b in beats_for(SCRIPT)]
    code, folder, fake = run_writer(tmp_path, {"script": [script_reply(beats=beats)],
                                               "audit": [audit_reply(GOOD_CLAIM)], "show": [good_show]})
    review = (folder / "review.md").read_text(encoding="utf-8")
    assert code == 0 and "- S1: planet | the oceans pull back\n" in review and "dial: -" not in review


def test_redraft_gets_the_current_script_and_its_beats_are_checked(tmp_path):
    redraft = SCRIPT.replace("Nights would be much darker.", "Nights would get darker.")
    bad = beats_for(redraft)
    bad[3]["change"] = "none"
    fixed = SCRIPT.replace("Nights would be much darker.", "The night side turns black.")
    code, folder, fake = run_writer(tmp_path, {
        "script": [script_reply()], "audit": [audit_reply(GOOD_CLAIM, BAD_CLAIM)],
        "script-redraft": [script_reply(redraft, beats=bad)], "script-rewrite": [script_reply(fixed)],
        "audit-redraft": [audit_reply(GOOD_CLAIM)], "show": [good_show]})
    assert code == 0
    assert fake.purposes == ["script", "audit", "script-redraft", "script-rewrite", "audit-redraft", "show"]
    redraft_prompt = fake.calls[2].user
    assert SCRIPT in redraft_prompt and "the oceans pull back" in redraft_prompt    # current script + beats
    assert "CORRECTIONS" in redraft_prompt and BAD_CLAIM["claim"] in redraft_prompt
    assert 'S4 "Nights would get darker.": nothing visibly changes' in fake.calls[3].user
    assert (folder / "script.txt").read_text(encoding="utf-8").strip() == fixed
    r = result(folder)
    assert r["beat_rewrite"] is True and r["beats_note"] is None and r["needs_fact_check"] is False
    assert "after the redraft step" in (folder / "review.md").read_text(encoding="utf-8")


def test_the_one_rewrite_is_shared_and_what_is_left_is_reported(tmp_path):
    first_bad = beats_for(SCRIPT)
    first_bad[0]["change"] = "nothing"
    redraft = SCRIPT.replace("Nights would be much darker.", "Nights would get darker.")
    redraft_bad = beats_for(redraft)
    redraft_bad[3]["change"] = "none"
    code, folder, fake = run_writer(tmp_path, {
        "script": [script_reply(beats=first_bad)], "script-rewrite": [script_reply()],
        "audit": [audit_reply(GOOD_CLAIM, BAD_CLAIM)], "script-redraft": [script_reply(redraft, beats=redraft_bad)],
        "audit-redraft": [audit_reply(GOOD_CLAIM)], "show": [good_show]})
    assert code == 0
    # One rewrite for the first script; the redraft's problem is not sent back a second time.
    assert fake.purposes == ["script", "script-rewrite", "audit", "script-redraft", "audit-redraft", "show"]
    assert "no usable picture plan" in fake.calls[-1].user
    r = result(folder)
    assert r["beats_note"] == "script has sentences with no visible change"
    assert any("S4" in p for p in r["beat_problems"])
    review = (folder / "review.md").read_text(encoding="utf-8")
    assert "SCRIPT HAS SENTENCES WITH NO VISIBLE CHANGE" in review and "STILL WRONG" in review


def test_a_redraft_answering_not_feasible_goes_to_needs_props(tmp_path):
    reply = script_reply(script="", beats=[], feasible=False, mechanism_prop=MECHANISM, missing=["wing scale"])
    code, folder, fake = run_writer(tmp_path, {"script": [script_reply()],
                                               "audit": [audit_reply(GOOD_CLAIM, BAD_CLAIM)],
                                               "script-redraft": [reply]})
    assert code == 3
    assert fake.purposes == ["script", "audit", "script-redraft"]
    assert MECHANISM in (folder / "NEEDS-PROPS.md").read_text(encoding="utf-8")
    assert result(folder)["status"] == "needs_props" and not (folder / "voice.mp3").exists()


def test_a_shortened_script_gets_the_beat_check_before_it_is_voiced(tmp_path):
    long_script = LONG_SCRIPT
    short = _one_sentence(writer.WORD_FLOOR)
    shorter = ("The Moon drags the oceans. " * 35 + "Please comment your answer below.")
    voiced = []

    def voice(script, folder_, settings):
        voiced.append(script)
        return fake_voice(script, folder_, settings)

    folder = tmp_path / "moon"
    fake = FakeLLM(folder, {
        "script": [script_reply(long_script)], "audit": [json.dumps({"claims": [
            {"claim": "c", "quote": "The Moon pulls the oceans", "verdict": "supported", "note": ""}]})],
        "shorten": [json.dumps({"script": short, "beats": beats_for(short, change="stays")})],
        "script-rewrite": [script_reply(shorter)], "show": [good_show],
        # the rewritten words get their own audit, and it flags a claim
        "audit-shorten": [json.dumps({"claims": [
            {"claim": "The Moon drags the oceans.", "quote": "The Moon drags the oceans",
             "verdict": "unsupported", "note": "needs a source"}]})]})
    code = writer.write("What if the Moon vanished?", "moon", mode="api", settings=dict(OLD_DEFAULTS),
                        complete=fake, voice_fn=voice, qa_fn=QA_PASS, shows_dir=tmp_path)
    assert code == 0
    assert fake.purposes == ["script", "audit", "shorten", "script-rewrite", "audit-shorten", "show"]
    assert voiced == [long_script, shorter.strip()]          # the unshowable short script is never voiced
    assert "The Moon drags the oceans" in fake.calls[4].user  # the audit saw the words that get voiced
    review = (folder / "review.md").read_text(encoding="utf-8")
    assert "after the shorten step" in review
    assert review.startswith("NEEDS FACT CHECK")             # the earlier "fine" audit no longer applies
    assert result(folder)["needs_fact_check"] is True


def test_an_old_needs_props_file_is_removed_at_the_start(tmp_path):
    (tmp_path / "moon").mkdir()
    (tmp_path / "moon" / "NEEDS-PROPS.md").write_text("old", encoding="utf-8")
    code, folder, fake = run_writer(tmp_path, {"script": [script_reply()], "audit": [audit_reply(GOOD_CLAIM)],
                                               "show": [good_show]})
    assert code == 0 and not (folder / "NEEDS-PROPS.md").exists()
    assert "NEEDS-PROPS.md" not in (folder / "review.md").read_text(encoding="utf-8")


# Ten short sentences (5 words each, 1.75 s with fake_voice), for a one-shot-per-sentence slideshow.
TEN = " ".join([f"The {w} slowly glows now." for w in
                ("moon", "sea", "sky", "rock", "tide", "wave", "sand", "star", "wind")] + ["Please comment your answer below."])
TEN_CLAIM = {"claim": "c", "quote": "The moon slowly glows now", "verdict": "supported", "note": ""}


def scale_slideshow(folder):
    """A new scene for every sentence, each with a planet that scales up on the sentence: every sentence has
    a change, so the checker finds no error, but it is a slideshow with no dial. (The change is a scale: a
    pulse is emphasis only and no longer counts as a change.)"""
    words = json.loads((Path(folder) / "words.json").read_text(encoding="utf-8"))
    shots = []
    for i, t in enumerate(s[0]["start"] for s in writer.sentences(words)):
        shot = {"id": f"s{i}", "env": "studio", "props": [{"id": "hero", "type": "planet"}],
                "camera": {"move": "drift"}, "actions": [{"at": {"time": t}, "do": "scale", "prop": "hero", "to": 1.2, "over": 1}]}
        if i:
            shot["start"] = {"time": t}
        shots.append(shot)
    return {"format": 1, "title": "Ten", "voice": {"audio": "voice.mp3", "words": "words.json"}, "shots": shots}


def test_a_ten_scene_scale_slideshow_is_not_accepted(tmp_path):
    # The checker alone accepts it (no errors, only warnings) ...
    alone = tmp_path / "alone"
    alone.mkdir()
    fake_voice(TEN, alone, {})
    (alone / "show.json").write_text(json.dumps(scale_slideshow(alone)), encoding="utf-8")
    check = writer.validate_show(alone, story_rules=True)
    assert check["ok"], check["errors"][:3]
    assert {"story.scenes", "story.subject"} <= {w["path"] for w in check["warnings"]}
    # ... but the writer does not: the warnings and the missing dial go to the repair, then the fallback.
    bad = [scale_slideshow] * 4
    code, folder, fake = run_writer(tmp_path, {"script": [script_reply(TEN, beats=beats_for(TEN, "it scales up"))],
                                               "audit": [audit_reply(TEN_CLAIM)], "show": bad[:1], "repair": bad[1:]})
    assert fake.purposes == ["script", "audit", "show", "repair1", "repair2", "repair3"]
    repair_prompt = fake.calls[3].user
    for path in ("- story.scenes:", "- story.subject:", "- story.dial:"):
        assert path in repair_prompt, path
    r = result(folder)
    assert code == 0 and r["status"] == "fallback" and r["show"] == "fallback"
    assert "show: 0 validator error(s), 3 story problem(s)" in (folder / "review.md").read_text(encoding="utf-8")


def test_dial_reach_counts_bindings_in_one_scene():
    words = [{"text": t, "start": i * 0.3, "end": i * 0.3 + 0.2} for i, t in enumerate(SCRIPT.split())]
    assert writer.dial_reach(story_show(words)) == 3          # atmosphere, colour and the background
    one = {"shots": [{"env": "studio", "props": [{"id": "a", "type": "planet", "color": {"dial": "d", "colors": "spectrum"}}]},
                     {"env": "studio", "props": [{"id": "b", "type": "planet", "color": {"dial": "d", "colors": "spectrum"}}]}]}
    assert writer.dial_reach(one) == 1                        # the same dial in two separate scenes is not enough


def test_other_warnings_are_listed_in_review_and_blocking_ones_repaired(tmp_path):
    still = {"path": "story.stillness", "message": "nothing changes for 2.8 s", "hint": "add a change"}
    scenes = {"path": "story.scenes", "message": "this show has 7 separate scenes", "hint": "join shots"}
    answers = iter([{"ok": True, "errors": [], "warnings": [scenes]},
                    {"ok": True, "errors": [], "warnings": [still]}])
    folder = tmp_path / "moon"
    fake = FakeLLM(folder, {"script": [script_reply()], "audit": [audit_reply(GOOD_CLAIM)],
                            "show": [good_show], "repair": [good_show]})
    code = writer.write("What if the Moon vanished?", "moon", mode="api", settings=dict(OLD_DEFAULTS),
                        complete=fake, voice_fn=fake_voice, validate_fn=lambda f, **k: next(answers),
                        qa_fn=QA_PASS, shows_dir=tmp_path)
    assert code == 0 and fake.purposes == ["script", "audit", "show", "repair1"]
    assert "- story.scenes: this show has 7 separate scenes" in fake.calls[-1].user
    review = (folder / "review.md").read_text(encoding="utf-8")
    assert "## Checker warnings on the accepted show" in review
    assert "- story.stillness: nothing changes for 2.8 s add a change" in review
    assert result(folder)["status"] == "ok"


def test_story_rules_are_used_and_their_errors_go_to_the_repair(tmp_path):
    # A slideshow is valid without the story rules; the writer validates with them, so it is repaired.
    code, folder, fake = run_writer(tmp_path, {"script": [script_reply()], "audit": [audit_reply(GOOD_CLAIM)],
                                               "show": [slideshow], "repair": [good_show]})
    assert code == 0 and fake.purposes == ["script", "audit", "show", "repair1"]
    repair_prompt = fake.calls[-1].user
    assert "- story." in repair_prompt                     # e.g. "- story.sentences[2]: ..." from validate.mjs
    assert 'path starts with "story."' in repair_prompt
    r = result(folder)
    assert r["status"] == "ok" and r["show"] == "llm" and r["repairs"] == 1
    assert writer.validate_show(folder, story_rules=True)["ok"]


def test_validate_show_passes_the_story_flag(monkeypatch):
    seen = []
    monkeypatch.setattr(writer, "node_json", lambda args, timeout=600: (seen.append(args), (0, {"ok": True}, ""))[1])
    writer.validate_show("x")
    writer.validate_show("x", story_rules=False)
    assert seen == [["tools/validate.mjs", "x", "--story-rules"], ["tools/validate.mjs", "x", "--no-story-rules"]]


def test_script_prompt_has_the_shape_beats_and_mechanism_rules():
    text = writer.script_system_prompt()
    for must in ("SCRIPT SHAPE", "HOOK", "ONE mechanism", "2 or 3 zoom levels", "ONE ANALOGY", "WHY IT MATTERS",
                 "closing question", "180 to 195 words", "3.3 words per second", "before 60 seconds", '"beats"', '"subject"', '"change"',
                 '"dial"', '"mechanism_prop"', "icons, bar charts", "[can vary: spacing"):
        assert must in text, must
    assert "{{" not in text


# ---------------------------------------------------------------- files mode

def test_files_mode_waits_for_each_reply_and_continues(tmp_path, capsys):
    folder = tmp_path / "moon"
    s = dict(OLD_DEFAULTS)

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
    check = writer.validate_show(tmp_path, story_rules=True)     # examples must teach the story style
    assert check["ok"], check["errors"][:3]
    assert check["warnings"] == []
    show = json.loads((src / "show.json").read_text(encoding="utf-8"))
    assert json.loads(writer.compact_json(show)) == show
    script = (src / "script.txt").read_text(encoding="utf-8").split()
    words = json.loads((src / "words.json").read_text(encoding="utf-8"))
    assert [w["text"] for w in words] == script          # the words really are this script's voice
    assert (src / "plan.md").exists() and (src / "notes.md").exists()


def test_show_prompt_contains_rules_catalogue_and_examples():
    text = writer.show_system_prompt()
    assert "THE PICTURE PLAN from the script writer" in text and "S1 subject: chameleon | change:" in text
    for must in ("# 2. How to think", "BACKDROP", "[floats]", "## Example 1", "CHECKLIST", "- rocket [floats]",
                 "2 to 4 main scenes", "TWO OR MORE things", "3.5 seconds", "Labels only name parts",
                 "DIALS: ", "BINDINGS: ", "CONTINUE (scenes): ", "- fill 0.5..1.3", "- glide 0.2..6", '"until"',
                 "Story rules", "S7 [22.46-28.68] When a chameleon is relaxed"):
        assert must in text, must
    assert 'place it with "turn": 0' in text and 'drive all turning with "spin"' in text   # the planet turns by itself
    assert '"wire" is a stage-space cable' in text   # how to draw a circuit
    assert "## Example 2" not in text                     # the old slideshow examples are out
    assert "7 to 10" not in text and "fresh stage" not in text
    assert "{{" not in text


def test_old_slideshow_examples_fail_the_story_rules(tmp_path):
    # Why "rings" and "ice" are not in EXAMPLE_ORDER. If this ever fails, they could be used again.
    for name in ("rings", "ice"):
        assert name not in writer.EXAMPLE_ORDER
        d = tmp_path / name
        d.mkdir()
        for f in ("show.json", "words.json"):
            shutil.copy(writer.EXAMPLES / name / f, d / f)
        (d / "voice.mp3").write_bytes(b"")
        assert not writer.validate_show(d, story_rules=True)["ok"], name


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
    s = dict(OLD_DEFAULTS)
    voiced = []

    def counting_voice(script, folder_, settings):
        voiced.append(len(script.split()))
        return fake_voice(script, folder_, settings)

    def go():
        return writer.write("Moon", "moon", mode="files", settings=s, voice_fn=counting_voice,
                            qa_fn=QA_PASS, shows_dir=tmp_path)

    long_script = LONG_SCRIPT
    short = _one_sentence(writer.WORD_FLOOR)
    llm_dir = folder / "llm"
    assert go() == 4
    (llm_dir / "01-script.reply.md").write_text(script_reply(long_script), encoding="utf-8")
    assert go() == 4
    (llm_dir / "02-audit.reply.md").write_text(json.dumps({"claims": [
        {"claim": "c", "quote": "The Moon pulls the oceans", "verdict": "supported", "note": ""}]}), encoding="utf-8")
    assert go() == 4                                   # voiced (long), now waiting for the shorten reply
    assert voiced == [208]
    (llm_dir / "03-shorten.reply.md").write_text(json.dumps({"script": short, "beats": beats_for(short)}),
                                                 encoding="utf-8")
    assert go() == 4                                   # the short script is fact-checked before it is voiced
    assert voiced == [208]
    assert (llm_dir / "04-audit-shorten.prompt.md").exists()
    (llm_dir / "04-audit-shorten.reply.md").write_text(json.dumps({"claims": [
        {"claim": "c", "quote": "The Moon pulls the oceans", "verdict": "supported", "note": ""}]}),
        encoding="utf-8")
    assert go() == 4                                   # voiced (short), waiting for the show reply
    assert voiced == [208, 180]
    words_before = (folder / "words.json").read_text(encoding="utf-8")
    (llm_dir / "05-show.reply.md").write_text(json.dumps(good_show(folder)), encoding="utf-8")
    assert go() == 0
    assert voiced == [208, 180]                         # nothing voiced again on the resumes
    assert (folder / "words.json").read_text(encoding="utf-8") == words_before


# ---------------------------------------------------------------- the examples follow the prompt's own rules

@pytest.mark.parametrize("name", writer.EXAMPLE_ORDER)
def test_example_plan_has_one_row_per_sentence(name):
    src = writer.EXAMPLES / name
    sents = writer.script_sentences((src / "script.txt").read_text(encoding="utf-8"))
    plan = (src / "plan.md").read_text(encoding="utf-8")
    rows = [line.split(" ", 1)[0] for line in plan.splitlines() if line[:1] == "S" and line[1:2].isdigit()]
    assert rows == [f"S{n}" for n in range(1, len(sents) + 1)]
    # The plan reads like a real call's beat list, and no row counts an icon or label as the change.
    beats = [dict(zip(("subject", "change", "dial"), [p.split(": ", 1)[1] for p in line.split(" | ")] + [""]))
             for line in (l.split(" ", 1)[1] for l in plan.splitlines() if l[:1] == "S")]
    beats = [dict(b, sentence="") for b in beats]
    assert writer.beats_block(" ".join(sents), beats).splitlines() == [l for l in plan.splitlines() if l.strip()]
    assert not writer.beat_problems(" ".join(sents), beats)
    for line in plan.splitlines():
        assert not re.search(r"\b(icons?|signs?|labels?)\b", line, re.I), line


@pytest.mark.parametrize("name", writer.EXAMPLE_ORDER)
def test_examples_follow_the_prompt_rules(name):
    show = json.loads((writer.EXAMPLES / name / "show.json").read_text(encoding="utf-8"))
    shots = show["shots"]
    # Scenes: 2-4 main scenes plus at most an opening and a closing one (the prompt's rule), so 6 at most.
    scenes = [s for s in shots if not s.get("continue")]
    assert 2 <= len(scenes) <= 6, len(scenes)
    assert any(s.get("continue") for s in shots), "no continuing shots"
    assert any("glide" in s["camera"] for s in shots), "no glide"
    for s in shots:
        if s.get("continue"):
            assert "env" not in s, f"continuing shot {s['id']} gives an env"

    # At least one dial bound to two or more things inside one scene.
    def dials_in(obj):
        if isinstance(obj, dict):
            return ([obj["dial"]] if "dial" in obj else []) + [d for v in obj.values() for d in dials_in(v)]
        if isinstance(obj, list):
            return [d for v in obj for d in dials_in(v)]
        return []
    best = 0
    for sc in scenes:
        i = shots.index(sc)
        scene = [sc] + list(itertools.takewhile(lambda s: s.get("continue"), shots[i + 1:]))
        found = dials_in([sc.get("env")] + [p for s in scene for p in s.get("props", [])])
        best = max([best] + [found.count(d) for d in set(found)])
    assert best >= 2, "no dial drives two or more things"
    assert set(show.get("dials", {})), "no dials"

    # Labels name parts: short, in capitals; text in capitals.
    for s in shots:
        for a in s.get("actions", []):
            if a["do"] == "label":
                assert len(a["text"]) < 22 and a["text"] == a["text"].upper(), a["text"]
            if a["do"] == "text":
                assert a["text"] == a["text"].upper()


def test_beat_sentence_must_be_this_sentence_but_small_differences_pass():
    sents = writer.script_sentences(SCRIPT)
    def check(mutate):
        beats = beats_for(SCRIPT)
        mutate(beats)
        return writer.beat_problems(SCRIPT, writer.normalise_beats(beats))
    # Harmless: quotes, case, spacing, punctuation, cut short, empty.
    assert check(lambda b: b[0].update(sentence='  "' + sents[0].upper() + '"  ')) == []
    assert check(lambda b: b[1].update(sentence=sents[1].replace(",", "").replace(".", " ... "))) == []
    assert check(lambda b: b[2].update(sentence=" ".join(sents[2].split()[:3]) + "...")) == []
    assert check(lambda b: b[3].update(sentence="")) == []
    assert check(lambda b: b[0].update(sentence="1")) == []                 # its own number
    # Wrong: a shifted or swapped sentence, or another beat's number.
    swapped = check(lambda b: (b[0].update(sentence=sents[1]), b[1].update(sentence=sents[0])))
    assert len(swapped) == 2 and "S1" in swapped[0] and "not this sentence" in swapped[0]
    assert check(lambda b: b[2].update(sentence="Something else entirely happens here"))
    assert check(lambda b: b[2].update(sentence="S4"))
    assert writer.beats_note(swapped) == "the picture plan does not fit the script"


def test_a_rewrite_without_claims_does_not_keep_the_old_claims(tmp_path):
    first_bad = beats_for(SCRIPT)
    first_bad[0]["change"] = "nothing"
    code, folder, fake = run_writer(tmp_path, {
        "script": [script_reply(beats=first_bad)], "script-rewrite": [script_reply(claims=[])],
        "audit": [audit_reply(GOOD_CLAIM)], "show": [good_show]})
    review = (folder / "review.md").read_text(encoding="utf-8")
    claims = review.split("## Claims to check")[1].split("##")[0]
    assert code == 0 and "Tides would shrink" not in claims and "gave no claims list" in claims
    # A rewrite that does list claims: those, and no note.
    code, folder, fake = run_writer(tmp_path / "b", {
        "script": [script_reply(beats=first_bad)], "script-rewrite": [script_reply(claims=["New claim"])],
        "audit": [audit_reply(GOOD_CLAIM)], "show": [good_show]})
    claims = (folder / "review.md").read_text(encoding="utf-8").split("## Claims to check")[1].split("##")[0]
    assert "- [ ] New claim" in claims and "Tides would shrink" not in claims and "gave no claims" not in claims


def test_a_shorten_without_claims_does_not_keep_the_old_claims():
    old = {"script": "A. B.", "claims": ["old claim"], "title": "T"}
    new = writer.carry_over({"script": "A.", "beats": [], "claims": None}, old)
    assert new["claims"] == [] and new["claims_missing"] is True and new["title"] == "T"
    again = writer.carry_over({"script": "A.", "claims": ["x"]}, dict(old, claims_missing=True))
    assert again["claims"] == ["x"] and "claims_missing" not in again


def test_beats_note_names_the_real_problem():
    assert writer.beats_note([]) is None
    assert writer.beats_note(['S4 "x": nothing visibly changes. Rewrite']) == "script has sentences with no visible change"
    wrong_count = ["the beat list has 4 entries but the script has 5 sentences (a sentence ends at . ? or !)"]
    assert writer.beats_note(wrong_count) == "the picture plan does not fit the script"


# ---------------------------------------------------------------- round-5 review fixes

LONG_SCRIPT = " ".join(["The Moon pulls the oceans every single day."] * 25 + ["Please comment your answer below every single day."])   # 208 words, about 66 s
MOON_CLAIM = {"claim": "c", "quote": "The Moon pulls the oceans", "verdict": "supported", "note": ""}
MOON_BAD = dict(MOON_CLAIM, verdict="unsupported", note="needs a source")


def test_a_rewrite_after_a_shorten_is_told_the_word_limit_and_a_longer_one_is_not_voiced(tmp_path):
    short = _one_sentence(writer.WORD_FLOOR)
    voiced = []

    def voice(script, folder_, settings):
        voiced.append(script)
        return fake_voice(script, folder_, settings)

    folder = tmp_path / "moon"
    fake = FakeLLM(folder, {
        "script": [script_reply(LONG_SCRIPT)], "audit": [audit_reply(MOON_CLAIM)],
        "shorten": [json.dumps({"script": short, "beats": beats_for(short, change="stays the same")})],
        "script-rewrite": [script_reply(LONG_SCRIPT)],            # grows back to 208 words
        "audit-shorten": [audit_reply(MOON_CLAIM)], "show": [good_show]})
    code = writer.write("What if the Moon vanished?", "moon", mode="api", settings=dict(OLD_DEFAULTS),
                        complete=fake, voice_fn=voice, qa_fn=QA_PASS, shows_dir=tmp_path)
    assert code == 0
    assert fake.purposes == ["script", "audit", "shorten", "script-rewrite", "audit-shorten", "show"]
    limit = int(re.search(r"at most (\d+) words", fake.calls[3].user).group(1))
    assert limit < 208 and "wins over the 180 to 195 word length" in fake.calls[3].user
    assert f"never go below {writer.WORD_FLOOR} words" in fake.calls[3].user
    assert voiced == [LONG_SCRIPT, short.strip()]               # the too-long rewrite was never voiced
    review = (folder / "review.md").read_text(encoding="utf-8")
    assert "so it was NOT used; kept the shortened script" in review
    assert "## Picture plan (the beat list that goes with the script above)" in review
    # A rewrite that is not after a shorten still asks for about the same length.
    code, folder2, fake2 = run_writer(tmp_path / "b", {
        "script": [script_reply(beats=beats_for(SCRIPT, change="nothing"))], "script-rewrite": [script_reply()],
        "audit": [audit_reply(GOOD_CLAIM)], "show": [good_show]})
    assert "about the same number of words" in fake2.calls[1].user and "at most" not in fake2.calls[1].user


def test_a_shorten_with_no_script_is_named_in_the_voice_line(tmp_path):
    code, folder, fake = run_writer(tmp_path, {
        "script": [script_reply(LONG_SCRIPT)], "audit": [audit_reply(MOON_CLAIM)],
        "shorten": [json.dumps({"script": "", "beats": []})], "show": [good_show]})
    voice = [l for l in (folder / "review.md").read_text(encoding="utf-8").splitlines() if l.startswith("- Voice:")][0]
    assert code == 1 and "shorten gave no script text" in voice and "(;" not in voice
    assert "voice is too long" in result(folder)["error"]     # 64 s is more than 2 s over the 60 s limit


def test_flagged_claims_after_a_shorten_are_not_called_flagged_after_a_redraft(tmp_path):
    short = _one_sentence(writer.WORD_FLOOR)
    code, folder, fake = run_writer(tmp_path, {
        "script": [script_reply(LONG_SCRIPT)], "audit": [audit_reply(MOON_BAD)],
        "script-redraft": [script_reply(LONG_SCRIPT)], "audit-redraft": [audit_reply(MOON_CLAIM)],
        "shorten": [json.dumps({"script": short, "beats": beats_for(short)})],
        "audit-shorten": [audit_reply(MOON_BAD)], "show": [good_show]})
    assert code == 0
    review = (folder / "review.md").read_text(encoding="utf-8")
    assert "Flagged in the shortened script (its words were never redrafted):" in review
    assert "Still flagged after one redraft" not in review


# The beat check flags only an empty change or one exact phrase from the list (case, apostrophes and end
# punctuation ignored). Everything else passes on purpose: a false alarm costs the run's one rewrite.
FLAGGED = (
    "none", "n/a", "nothing", "no change", "no visible change", "nothing happens", "nothing changes",
    "nothing moves", "stays", "it stays", "stays the same", "it stays the same", "remains the same",
    "unchanged", "same as before", "static", "idle", "is shown", "it is shown", "shown", "spins", "it spins",
    "bobs", "it bobs", "orbits", "it orbits", "camera move", "zoom in", "zoom out",
    "zooms in", "zooms out", "pan", "pans", "pan left", "pan right", "pan across", "the camera zooms in",
    "the camera zooms out", "the camera pans", "the camera pulls back", "the camera pushes in",
    "a label appears", "the label appears", "text appears", "a number counts up", "the number counts up",
    "the counter counts up")
PASSES = (
    "tilts up", "pulls back", "the orbit widens", "the moon orbits closer", "the lizard stays green",
    "the skin turns red", "zoom in as the crystals spread apart", "nothing moves except the lattice",
    "the lattice spreads", "the oceans pull back", "the lizard spins", "a pan of water starts to boil", "drifts", "it drifts", "drifts apart")


def test_the_beat_check_flags_only_an_empty_change_or_an_exact_phrase():
    for phrase in FLAGGED:
        for variant in (phrase, phrase.upper(), f"  {phrase.capitalize()}. ", f"({phrase})", phrase.replace(" ", "  ")):
            assert writer.is_no_change(variant), variant
    for empty in ("", "   ", "-", "—", "...", "(none)"):
        assert writer.is_no_change(empty), empty
    assert writer.is_no_change("Same as before!") and writer.is_no_change("No change?")
    for odd in ("Nothing happens…", "“none”", "none —", "[none]", "Zoom in…", "Spins!", "none;",
                "_", "none_", "stays_", "_none_", "__"):
        assert writer.is_no_change(odd), odd
    for real in PASSES:
        assert not writer.is_no_change(real), real
        assert writer.beat_problems(SCRIPT, writer.normalise_beats(beats_for(SCRIPT, change=real))) == [], real
    found = writer.beat_problems(SCRIPT, writer.normalise_beats(beats_for(SCRIPT, change="zoom in")))
    assert found and all("nothing visibly changes" in p and '"zoom in"' in p for p in found)


def test_beat_sentences_match_whole_words_and_short_sentences_must_be_copied():
    match = writer.sentence_matches
    assert not match("Ice.", "Notice how it melts.", 1)
    assert not match("No dye.", "No paint.", 1)
    assert not match("It is light.", "It is not paint.", 1)
    assert match("No dye.", "No dye.", 2) and match('"NO  DYE"', "No dye.", 2)
    assert match("2", "No dye.", 2) and match("S2", "No dye.", 2) and not match("S1", "No dye.", 2)
    assert match("2 moons collide.", "2 moons collide.", 2)
    assert match("Earths tilt would wobble.", "Earth's tilt would wobble.", 1)
    # The chameleon script with every beat shifted by one is caught.
    script = "No paint. No dye. Comment below."
    sents = writer.script_sentences(script)
    shifted = [{"sentence": s, "subject": "skin", "change": "the lattice spreads", "dial": ""}
               for s in sents[1:] + sents[:1]]
    found = writer.beat_problems(script, shifted)
    assert len(found) == 3 and all("not this sentence" in p for p in found)
    straight = [dict(b, sentence=s) for b, s in zip(shifted, sents)]
    assert writer.beat_problems(script, straight) == []


def test_thousands_separators_and_any_apostrophe_do_not_make_a_different_sentence():
    match = writer.sentence_matches
    assert match("It takes about 1000 years for the crystals to form.",
                 "It takes about 1,000 years for the crystals to form.", 1)
    for apostrophe in ("\u2018", "\u2019", "\u02bc", "\u201b", "`"):
        assert match(f"That{apostrophe}s the thing.", "That's the thing.", 2), apostrophe
    assert match("\u201cNo dye.\u201d", "No dye.", 1)
    assert not match("It takes about 1000 years.", "It takes about 100 years.", 1)


def test_curly_closing_quotes_end_a_sentence():
    assert writer.script_sentences("It said \u201cstop.\u201d Then it fell.") == ["It said \u201cstop.\u201d", "Then it fell."]
    assert writer.script_sentences("He asked (why?) Then left.") == ["He asked (why?)", "Then left."]


def test_a_number_only_sentence_is_not_a_label_and_one_changed_word_fails():
    match = writer.sentence_matches
    assert match("42.", "42.", 3) and match("3", "Look at it.", 3) and not match("2", "Look at it.", 3)
    assert not match("In the dark it turns black.", "In the dark it turns white.", 1)
    assert match("in the DARK, it turns white", "In the dark it turns white.", 1)
    assert match("It said \u201cstop\u201d", "It said \"stop.\"", 1)


def test_a_failed_redraft_with_a_clean_shortened_audit_is_not_flagged_with_an_empty_list(tmp_path):
    short = _one_sentence(writer.WORD_FLOOR)
    code, folder, fake = run_writer(tmp_path, {
        "script": [script_reply(LONG_SCRIPT)], "audit": [audit_reply(MOON_BAD)], "script-redraft": [Raise()],
        "shorten": [json.dumps({"script": short, "beats": beats_for(short)})],
        "audit-shorten": [audit_reply(MOON_CLAIM)], "show": [good_show]})
    review = (folder / "review.md").read_text(encoding="utf-8")
    assert code == 0 and result(folder)["needs_fact_check"] is False
    assert "NEEDS FACT CHECK" not in review and "Flagged in the shortened script" not in review
    assert "redraft failed" in review          # still told, in the fact-check section


def test_rewrite_and_redraft_prompts_ask_for_claims():
    for name in ("script_rewrite_user.md", "script_redraft_user.md", "shorten_user.md"):
        assert '"claims"' in (writer.REPO / "pipeline" / "prompts" / name).read_text(encoding="utf-8"), name


def test_files_mode_reset_shorten_failure_voices_the_long_script_again(tmp_path):
    """A resumed run whose shorten reply was removed and then answered badly keeps the long script: the
    voice files on disk must be the long script's, not the shortened one's from before."""
    folder = tmp_path / "moon"
    s = dict(OLD_DEFAULTS)
    voiced = []

    def counting_voice(script, folder_, settings):
        voiced.append(len(script.split()))
        stats = fake_voice(script, folder_, settings)
        return dict(stats, duration=min(stats["duration"], 61.5))   # a little over 60 s is accepted

    def go():
        return writer.write("Moon", "moon", mode="files", settings=s, voice_fn=counting_voice,
                            qa_fn=QA_PASS, shows_dir=tmp_path)

    short = _one_sentence(writer.WORD_FLOOR)
    llm_dir = folder / "llm"
    supported = json.dumps({"claims": [MOON_CLAIM]})
    assert go() == 4
    (llm_dir / "01-script.reply.md").write_text(script_reply(LONG_SCRIPT), encoding="utf-8")
    assert go() == 4
    (llm_dir / "02-audit.reply.md").write_text(supported, encoding="utf-8")
    assert go() == 4
    (llm_dir / "03-shorten.reply.md").write_text(json.dumps({"script": short, "beats": beats_for(short)}),
                                                 encoding="utf-8")
    assert go() == 4
    (llm_dir / "04-audit-shorten.reply.md").write_text(supported, encoding="utf-8")
    assert go() == 4                                   # the short script is voiced; waiting for the show
    assert voiced == [208, 180]
    # Reset: remove the shorten reply and every later one, then answer the shorten with non-JSON.
    for p in llm_dir.glob("0[3-9]-*"):
        p.unlink()
    assert go() == 4                                   # waiting for the shorten reply again
    (llm_dir / "03-shorten.reply.md").write_text("not json", encoding="utf-8")
    assert go() == 4                                   # shorten failed, long script kept, now waiting for the show
    assert voiced == [208, 180, 208]                    # voiced again: the files on disk were the short script's
    script_words = len((folder / "script.txt").read_text(encoding="utf-8").split())
    words = json.loads((folder / "words.json").read_text(encoding="utf-8"))
    assert script_words == len(words) == 208
    (llm_dir / "04-show.reply.md").write_text(json.dumps(good_show(folder)), encoding="utf-8")
    assert go() == 0
    assert voiced == [208, 180, 208]                    # the resume does not voice again
    review = (folder / "review.md").read_text(encoding="utf-8")
    assert ", 208 words (shorten failed" in review


NOT_FEASIBLE = script_reply(script="", beats=[], feasible=False, mechanism_prop=MECHANISM, missing=["wing scale"])


def test_not_feasible_rewrite_after_a_redraft_reports_the_audited_script_only(tmp_path):
    contradicted = dict(BAD_CLAIM, verdict="contradicted")
    redraft = SCRIPT.replace("Nights would be much darker.", "Nights would get darker.")
    bad = beats_for(redraft)
    bad[3]["change"] = "none"
    code, folder, fake = run_writer(tmp_path, {
        "script": [script_reply()], "audit": [audit_reply(GOOD_CLAIM, contradicted)],
        "script-redraft": [script_reply(redraft, beats=bad, claims=["g"])], "script-rewrite": [NOT_FEASIBLE]})
    assert code == 3
    assert fake.purposes == ["script", "audit", "script-redraft", "script-rewrite"]
    review = (folder / "review.md").read_text(encoding="utf-8")
    # The script shown is the one the audit on file checked (the first), with its own claims.
    assert SCRIPT in review and redraft not in review and "- [ ] g\n" not in review
    assert "Tides would shrink to a third" in review
    assert "## Stopped for props" in review and "The beat rewrite after the redraft step answered" in review
    assert "NEEDS FACT CHECK" in review and f"contradicted: {BAD_CLAIM['claim']}" in review
    assert "STILL WRONG" not in review and "show call" not in review and "Voice: none used" in review
    assert "The redraft step's script (not shown: its rewrite answered" in review
    assert "Sent back once" not in review
    assert "Redrafted: a redraft was written but not used (the run stopped for props)" in review
    r = result(folder)
    assert r["status"] == "needs_props" and r["beats_note"] is None and r["beat_problems"] == []
    assert r["needs_fact_check"] is True and r["voice_seconds"] is None


def test_not_feasible_rewrite_after_a_shorten_does_not_report_a_voice_or_show(tmp_path):
    short = _one_sentence(writer.WORD_FLOOR)
    code, folder, fake = run_writer(tmp_path, {
        "script": [script_reply(LONG_SCRIPT)], "audit": [audit_reply(MOON_CLAIM)],
        "shorten": [json.dumps({"script": short, "beats": beats_for(short, change="stays the same")})],
        "script-rewrite": [NOT_FEASIBLE]})
    assert code == 3
    assert fake.purposes == ["script", "audit", "shorten", "script-rewrite"]
    review = (folder / "review.md").read_text(encoding="utf-8")
    assert LONG_SCRIPT in review and "The beat rewrite after the shorten step answered" in review
    assert "the beat rewrite after the shorten step answered" not in review
    assert "STILL WRONG" not in review and "show call" not in review and "Voice: none used" not in review
    assert "Voice: a voice was made for the script below, but no show was built" in review
    assert "NEEDS FACT CHECK" not in review and "Redrafted: no" in review
    assert "The shorten step's script (not shown: its rewrite answered" in review and "Sent back once" not in review
    r = result(folder)
    assert r["beats_note"] is None and r["beat_problems"] == [] and r["needs_fact_check"] is False


def test_not_feasible_rewrite_of_the_first_script_says_nothing_was_accepted(tmp_path):
    bad = beats_for(SCRIPT)
    bad[3]["change"] = "none"
    code, folder, fake = run_writer(tmp_path, {
        "script": [script_reply(beats=bad)], "script-rewrite": [NOT_FEASIBLE]})
    assert code == 3 and fake.purposes == ["script", "script-rewrite"]
    review = (folder / "review.md").read_text(encoding="utf-8")
    assert "No script was accepted" in review and "Voice: none used" in review
    for gone in ("## Script", "## Claims to check", "## Description", "last one the run accepted",
                 "Automatic fact check"):
        assert gone not in review
    r = result(folder)
    assert r["status"] == "needs_props" and r["beat_rewrite"] is True
    for gone in ("title", "description", "tags", "beats"):
        assert gone not in r


def test_not_feasible_rewrite_of_the_first_script_does_not_voice_or_list_old_voice_files(tmp_path):
    folder = tmp_path / "moon"
    folder.mkdir()
    for name in ("script.txt", "words.json", "voice.mp3", "voice.stats.json"):
        (folder / name).write_text("[]", encoding="utf-8")        # an earlier run's voice
    voiced = []
    bad = beats_for(SCRIPT)
    bad[3]["change"] = "none"
    fake = FakeLLM(folder, {"script": [script_reply(beats=bad)], "script-rewrite": [NOT_FEASIBLE]})
    code = writer.write("What if the Moon vanished?", "moon", mode="api", settings=dict(OLD_DEFAULTS),
                        complete=fake, voice_fn=lambda *a: voiced.append(a), qa_fn=QA_PASS, shows_dir=tmp_path)
    assert code == 3 and voiced == []
    assert (folder / "script.txt").read_text(encoding="utf-8") == "[]"      # not rewritten with the unaudited draft
    files = (folder / "review.md").read_text(encoding="utf-8").split("## Files")[1]
    for gone in ("script.txt", "words.json", "voice.mp3", "voice.stats.json"):
        assert gone not in files
    assert "review.md" in files and "writer.json" in files


def test_the_dial_tag_in_the_script_prompt_is_the_one_the_code_prints():
    tag = "[can follow a dial (dialParams):"
    assert tag in (writer.PROMPTS / "script_system.md").read_text(encoding="utf-8")
    assert "[can follow a dial:" not in (writer.PROMPTS / "script_system.md").read_text(encoding="utf-8")
    from pipeline import catalog_text
    assert tag in writer.catalog_names(catalog_text.load_catalog())


def test_common_abbreviations_do_not_end_a_sentence():
    assert writer.script_sentences("Dr. Lee says U.S. scientists agree! Mr. Smith, e.g. the vet, nods.") == [
        "Dr. Lee says U.S. scientists agree!", "Mr. Smith, e.g. the vet, nods."]
    assert writer.script_sentences("No paint. No dye. Just physics.") == ["No paint.", "No dye.", "Just physics."]
    # Known cost: a real sentence that ends in an abbreviation joins the next one (the prompt asks for none).
    assert writer.script_sentences("Salt, sugar, etc. Then it melts.") == ["Salt, sugar, etc. Then it melts."]
    words = [{"text": t} for t in "It came from the U.S. Then it fell.".split()]
    assert [len(s) for s in writer.sentences(words)] == [8]
    assert "No abbreviations with full stops" in (writer.PROMPTS / "script_system.md").read_text(encoding="utf-8")


def _shorten_target(tmp_path, script):
    """The word target the writer gives the shorten step for this script (same arithmetic as voice_step)."""
    d = tmp_path / "target"
    d.mkdir()
    stats = fake_voice(script, d, None)
    wps = stats["word_count"] / max(stats["duration"], 1)
    cut = math.ceil((stats["duration"] - float(writer.DEFAULTS["max_seconds"])) * wps) + 6
    return min(stats["word_count"], max(writer.WORD_FLOOR, stats["word_count"] - cut))


def _one_sentence(n):
    """A script of exactly n words, in short sentences (so the test show's shots stay short)."""
    whole, rest = divmod(n - 2, 5)           # the last 2 words are the comment line every script must end with
    return " ".join(["The Moon pulls the oceans."] * whole + ([" ".join(["Tides"] * (rest - 1) + ["fall."])]
                                                               if rest else []) + ["Comment below."])


def test_a_shortened_script_over_the_target_is_named_and_a_rewrite_no_longer_than_it_is_used(tmp_path):
    target = _shorten_target(tmp_path, LONG_SCRIPT)
    over = _one_sentence(target + 9)
    # Over the target, no rewrite: review.md says so plainly.
    code, folder, fake = run_writer(tmp_path / "a", {
        "script": [script_reply(LONG_SCRIPT)], "audit": [audit_reply(MOON_CLAIM)],
        "shorten": [json.dumps({"script": over, "beats": beats_for(over)})],
        "audit-shorten": [audit_reply(MOON_CLAIM)], "show": [good_show]})
    voice = [l for l in (folder / "review.md").read_text(encoding="utf-8").splitlines() if l.startswith("- Voice:")][0]
    assert f"the shortened script had {target + 9} words, over the {target}-word target" in voice
    # On target: no such line.
    on = _one_sentence(target)
    code, folder, fake = run_writer(tmp_path / "b", {
        "script": [script_reply(LONG_SCRIPT)], "audit": [audit_reply(MOON_CLAIM)],
        "shorten": [json.dumps({"script": on, "beats": beats_for(on)})],
        "audit-shorten": [audit_reply(MOON_CLAIM)], "show": [good_show]})
    assert "-word target" not in (folder / "review.md").read_text(encoding="utf-8")
    # A rewrite over the target but shorter than the over-target shortened script is used (and named).
    rewrite = _one_sentence(target + 4)
    voiced = []

    def voice_fn(script, folder_, settings):
        voiced.append(len(script.split()))
        return fake_voice(script, folder_, settings)

    folder = tmp_path / "c" / "moon"
    fake = FakeLLM(folder, {
        "script": [script_reply(LONG_SCRIPT)], "audit": [audit_reply(MOON_CLAIM)],
        "shorten": [json.dumps({"script": over, "beats": beats_for(over, change="stays the same")})],
        "script-rewrite": [script_reply(rewrite)], "audit-shorten": [audit_reply(MOON_CLAIM)], "show": [good_show]})
    assert writer.write("Moon", "moon", mode="api", settings=dict(OLD_DEFAULTS), complete=fake,
                        voice_fn=voice_fn, qa_fn=QA_PASS, shows_dir=tmp_path / "c") == 0
    assert voiced == [208, target + 4]
    review = (folder / "review.md").read_text(encoding="utf-8")
    assert f"The rewrite had {target + 4} words, over the {target}-word target" in review and "so it was used" in review
    assert f"at most {target} words" in fake.calls[3].user
    # A rewrite longer than the shortened script is still not used.
    folder = tmp_path / "d" / "moon"
    voiced.clear()
    fake = FakeLLM(folder, {
        "script": [script_reply(LONG_SCRIPT)], "audit": [audit_reply(MOON_CLAIM)],
        "shorten": [json.dumps({"script": over, "beats": beats_for(over, change="stays the same")})],
        "script-rewrite": [script_reply(_one_sentence(target + 12))], "audit-shorten": [audit_reply(MOON_CLAIM)],
        "show": [good_show]})
    writer.write("Moon", "moon", mode="api", settings=dict(OLD_DEFAULTS), complete=fake,
                 voice_fn=voice_fn, qa_fn=QA_PASS, shows_dir=tmp_path / "d")
    assert voiced == [208, target + 9]
    assert "so it was NOT used; kept the shortened script" in (folder / "review.md").read_text(encoding="utf-8")


def test_files_mode_reset_then_not_feasible_after_a_shorten_leaves_matching_voice_and_no_old_show(tmp_path):
    """A shortened run that made a show is reset; the shorten's beat rewrite then answers not feasible. The
    voice files must be the long script's (the one review.md shows) and the old show.json is not listed."""
    folder = tmp_path / "moon"
    s = dict(OLD_DEFAULTS)
    voiced = []

    def counting_voice(script, folder_, settings):
        voiced.append(len(script.split()))
        stats = fake_voice(script, folder_, settings)
        return dict(stats, duration=min(stats["duration"], 61.5))   # a little over 60 s is accepted

    def go():
        return writer.write("Moon", "moon", mode="files", settings=s, voice_fn=counting_voice,
                            qa_fn=QA_PASS, shows_dir=tmp_path)

    short = _one_sentence(writer.WORD_FLOOR)
    llm_dir = folder / "llm"
    supported = json.dumps({"claims": [MOON_CLAIM]})
    assert go() == 4
    (llm_dir / "01-script.reply.md").write_text(script_reply(LONG_SCRIPT), encoding="utf-8")
    assert go() == 4
    (llm_dir / "02-audit.reply.md").write_text(supported, encoding="utf-8")
    assert go() == 4
    (llm_dir / "03-shorten.reply.md").write_text(json.dumps({"script": short, "beats": beats_for(short)}),
                                                 encoding="utf-8")
    assert go() == 4
    (llm_dir / "04-audit-shorten.reply.md").write_text(supported, encoding="utf-8")
    assert go() == 4
    (llm_dir / "05-show.reply.md").write_text(json.dumps(good_show(folder)), encoding="utf-8")
    assert go() == 0 and (folder / "show.json").exists()
    assert voiced == [208, 180]
    # Reset: remove the shorten reply and every later one; the new shorten needs a beat rewrite.
    for p in llm_dir.glob("0[3-9]-*"):
        p.unlink()
    assert go() == 4
    (llm_dir / "03-shorten.reply.md").write_text(
        json.dumps({"script": short, "beats": beats_for(short, change="stays the same")}), encoding="utf-8")
    assert go() == 4                                   # waiting for the beat rewrite
    assert (llm_dir / "04-script-rewrite.prompt.md").exists()
    (llm_dir / "04-script-rewrite.reply.md").write_text(NOT_FEASIBLE, encoding="utf-8")
    assert go() == 3
    assert voiced == [208, 180, 208]                    # voiced again to match the script review.md shows
    script_words = len((folder / "script.txt").read_text(encoding="utf-8").split())
    words = json.loads((folder / "words.json").read_text(encoding="utf-8"))
    assert script_words == len(words) == 208
    review = (folder / "review.md").read_text(encoding="utf-8")
    assert LONG_SCRIPT in review and "The beat rewrite after the shorten step answered" in review
    files = review.split("## Files")[1]
    assert "show.json" not in files and "words.json" in files and "script.txt" in files
    # A stop for props with nothing voiced before does not voice (the first test's case).
    assert go() == 3 and voiced == [208, 180, 208]


def test_dotted_initialisms_match_their_plain_form_and_never_end_a_sentence():
    match = writer.sentence_matches
    assert match("US scientists found it.", "U.S. scientists found it.", 1)
    # a label for another beat in front of the sentence is a mismatch; the right label is fine
    assert not match("S2 The sun is hot today.", "The sun is hot today.", 3) and not match("2 The sun is hot today.", "The sun is hot today.", 3)
    assert match("S3 The sun is hot today.", "The sun is hot today.", 3) and match("3 The sun is hot today.", "The sun is hot today.", 3)
    # a leading number that is part of the sentence is kept; a real label is still dropped
    assert match("3 grains", "3 grains fall down now", 3) and match("3 grains fall down now", "3 grains fall down now", 3)
    assert match("S3: 3 grains fall down now", "3 grains fall down now", 3) and match("S2: No dye here at all.", "No dye here at all.", 2)
    assert match("S3 grains fall down fast", "Grains fall down fast and far", 3)
    assert match("U.S.A. scientists found it.", "USA scientists found it.", 1)
    assert not match("UK scientists found it.", "U.S. scientists found it.", 1)
    # a dropped final dot is the same word, on either side
    assert match("The U.S is a big country with many people.", "The U.S. is a big country with many people.", 1)
    assert match("The U.S. is a big country with many people.", "The U.S is a big country with many people.", 1)
    assert match("Meet at 5 p.m", "Meet at 5 p.m.", 1) and match("Meet at 5 p.m.", "Meet at 5 p.m", 1)
    assert writer.script_sentences("The U.S.A. is big. Yes. Dr. Lee agrees.") == ["The U.S.A. is big.", "Yes.", "Dr. Lee agrees."]


def test_the_voice_note_counts_the_voiced_rewrite_not_the_shorten_reply(tmp_path):
    target = _shorten_target(tmp_path, LONG_SCRIPT)
    over, rewrite = _one_sentence(target + 9), _one_sentence(target)
    code, folder, fake = run_writer(tmp_path / "a", {
        "script": [script_reply(LONG_SCRIPT)], "audit": [audit_reply(MOON_CLAIM)],
        "shorten": [json.dumps({"script": over, "beats": beats_for(over, change="stays the same")})],
        "script-rewrite": [script_reply(rewrite)], "audit-shorten": [audit_reply(MOON_CLAIM)], "show": [good_show]})
    voice = [l for l in (folder / "review.md").read_text(encoding="utf-8").splitlines() if l.startswith("- Voice:")][0]
    assert code == 0 and "shortened once" in voice and "-word target" not in voice, voice


def test_an_old_review_is_removed_while_a_files_mode_run_waits(tmp_path):
    (tmp_path / "moon").mkdir()
    (tmp_path / "moon" / "review.md").write_text("- Status: needs_props", encoding="utf-8")
    code = writer.write("Moon", "moon", mode="files", settings=dict(OLD_DEFAULTS), voice_fn=fake_voice,
                        qa_fn=QA_PASS, shows_dir=tmp_path)
    assert code == writer.EXIT_WAITING and not (tmp_path / "moon" / "review.md").exists()


# ---------------------------------------------------------------- length limits and the closing comment line

def _run_with_voice_seconds(tmp_path, script, seconds, extra=None):
    """Run the writer with a voice that always lasts `seconds`, whatever the script."""
    def voice(text, folder_, settings):
        stats = fake_voice(text, folder_, settings)
        return dict(stats, duration=seconds)

    folder = tmp_path / "moon"
    replies = {"script": [script_reply(script)], "audit": [audit_reply(MOON_CLAIM)], "show": [good_show]}
    replies.update(extra or {})
    fake = FakeLLM(folder, replies)
    code = writer.write("Moon", "moon", mode="api", settings=dict(OLD_DEFAULTS), complete=fake,
                        voice_fn=voice, qa_fn=QA_PASS, shows_dir=tmp_path)
    return code, folder, fake


def test_a_script_at_the_floor_is_not_shortened_and_a_little_over_60_s_is_accepted(tmp_path):
    script = _one_sentence(writer.WORD_FLOOR)
    code, folder, fake = _run_with_voice_seconds(tmp_path, script, 61.7)
    assert code == 0 and "shorten" not in fake.purposes
    note = result(folder)["voice_note"]
    assert "ACCEPTED, a little over the limit" in note and "61.7" in note
    assert "ACCEPTED" in (folder / "review.md").read_text(encoding="utf-8")


def test_a_script_at_the_floor_with_a_voice_over_62_s_fails_cleanly(tmp_path):
    code, folder, fake = _run_with_voice_seconds(tmp_path, _one_sentence(writer.WORD_FLOOR), 62.5)
    assert code == writer.EXIT_FAILED and "shorten" not in fake.purposes
    assert result(folder)["status"] == "failed" and "voice is too long" in result(folder)["error"]
    assert "voice is too long" in (folder / "review.md").read_text(encoding="utf-8")
    assert not (folder / "show.json").exists()


def test_a_voice_over_62_s_after_one_shorten_says_the_shorten_was_tried(tmp_path):
    short = _one_sentence(writer.WORD_FLOOR + 10)
    code, folder, fake = _run_with_voice_seconds(tmp_path, _one_sentence(writer.WORD_FLOOR + 15), 62.5, {
        "shorten": [json.dumps({"script": short, "beats": beats_for(short)})], "audit-shorten": [audit_reply(MOON_CLAIM)]})
    error = result(folder)["error"]
    assert code == writer.EXIT_FAILED and "shorten" in fake.purposes
    assert "voice is too long" in error and "Shortened once" in error and "62 s" in error
    assert "cannot be cut below" not in error and "not shortened" not in error


def test_the_shorten_target_is_never_above_the_script_nor_below_the_floor(tmp_path):
    n = writer.WORD_FLOOR + 5
    short = _one_sentence(writer.WORD_FLOOR)
    code, folder, fake = _run_with_voice_seconds(tmp_path, _one_sentence(n), 61.9, {
        "shorten": [json.dumps({"script": short, "beats": beats_for(short)})], "audit-shorten": [audit_reply(MOON_CLAIM)]})
    ask = fake.calls[fake.purposes.index("shorten")].user
    assert f"at most {writer.WORD_FLOOR} words" in ask and "about 5 words shorter" in ask
    assert code == 0            # the voice stays 61.9 s: within 62 s, so accepted with a note


def test_the_last_sentence_must_ask_for_a_comment(tmp_path):
    problems = writer.beat_problems("The tide rises. Follow for more.", beats_for("The tide rises. Follow for more."))
    assert len(problems) == 1 and "comment" in problems[0] and "Follow for more." in problems[0]
    assert writer.beat_problems("The tide rises. Comment below.", beats_for("The tide rises. Comment below.")) == []
    bad = "The Moon pulls the oceans. Follow for more science."
    good = "The Moon pulls the oceans. Comment your answer below."
    code, folder, fake = run_writer(tmp_path, {
        "script": [script_reply(bad)], "script-rewrite": [script_reply(good)],
        "audit": [audit_reply(MOON_CLAIM)], "show": [good_show]})
    assert fake.purposes[:3] == ["script", "script-rewrite", "audit"]
    assert "must ask viewers to answer in the comments" in fake.calls[1].user
    assert (folder / "script.txt").read_text(encoding="utf-8").strip() == good


def test_a_voice_of_62_04_s_fails_with_a_message_that_does_not_contradict_itself(tmp_path):
    code, folder, fake = _run_with_voice_seconds(tmp_path, _one_sentence(writer.WORD_FLOOR), 62.04)
    error = result(folder)["error"]
    assert code == 1 and "62.04 s is over the 60 s limit" in error and error.endswith("faster voice rate.")     # two decimals, not "62.0 s"


# ---------------------------------------------------------------- word floor check after a shorten

def _shorten_reply(text, **kw):
    return {"shorten": [json.dumps({"script": text, "beats": beats_for(text, **kw)})]}


def test_a_shortened_script_below_the_floor_minus_tolerance_is_rejected_and_the_first_kept(tmp_path):
    first = _one_sentence(writer.WORD_FLOOR + 10)
    too_short = _one_sentence(writer.WORD_FLOOR - writer.WORD_FLOOR_TOLERANCE - 1)
    code, folder, fake = _run_with_voice_seconds(tmp_path, first, 61.9, _shorten_reply(too_short))
    note = result(folder)["voice_note"]
    assert code == 0 and "shorten" in fake.purposes and "audit-shorten" not in fake.purposes
    assert f"the shortened script had {len(too_short.split())} words, below the {writer.WORD_FLOOR}-word floor, so the first script was kept" in note
    assert (folder / "script.txt").read_text(encoding="utf-8").strip() == first
    assert note in (folder / "review.md").read_text(encoding="utf-8")


def test_a_shortened_script_at_the_floor_minus_3_is_accepted(tmp_path):
    first = _one_sentence(writer.WORD_FLOOR + 10)
    ok = _one_sentence(writer.WORD_FLOOR - 3)
    code, folder, fake = _run_with_voice_seconds(tmp_path, first, 61.9, dict(_shorten_reply(ok), **{"audit-shorten": [audit_reply(MOON_CLAIM)]}))
    assert code == 0 and "audit-shorten" in fake.purposes
    assert (folder / "script.txt").read_text(encoding="utf-8").strip() == ok


def test_a_rewrite_after_a_shorten_below_the_floor_is_rejected_and_the_shortened_script_kept(tmp_path):
    first = _one_sentence(writer.WORD_FLOOR + 10)
    shortened = _one_sentence(writer.WORD_FLOOR + 2)
    rewrite = _one_sentence(150)
    extra = dict(_shorten_reply(shortened, change="stays the same"),
                 **{"script-rewrite": [script_reply(rewrite)], "audit-shorten": [audit_reply(MOON_CLAIM)]})
    code, folder, fake = _run_with_voice_seconds(tmp_path, first, 61.9, extra)
    assert "script-rewrite" in fake.purposes
    assert "below the 180-word floor, so it was NOT used" in (folder / "review.md").read_text(encoding="utf-8")
    assert (folder / "script.txt").read_text(encoding="utf-8").strip() == shortened


def test_a_voice_of_62_004_s_is_accepted_with_the_note(tmp_path):
    code, folder, fake = _run_with_voice_seconds(tmp_path, _one_sentence(writer.WORD_FLOOR), 62.004)
    assert code == 0 and "62.00 s is over the 60 s limit" in result(folder)["voice_note"]


# ---------------------------------------------------------------- picture check that cannot run

LOW_RAM = {"result": "not_run", "reason": "QA ERROR: only 1.1 GB of memory is free; browser jobs need 2 GB.", "findings": []}


class SeqQa:
    """Fake picture check: gives the listed results in order (the last one repeats)."""
    def __init__(self, *results):
        self.results, self.calls = list(results), 0

    def __call__(self, slug):
        self.calls += 1
        return self.results.pop(0) if len(self.results) > 1 else self.results[0]


def _run_qa(tmp_path, qa):
    waits = []
    folder = tmp_path / "moon"
    fake = FakeLLM(folder, {"script": [script_reply()], "audit": [audit_reply(GOOD_CLAIM)], "show": [good_show]})
    code = writer.write("What if the Moon vanished?", "moon", mode="api", settings=dict(OLD_DEFAULTS), complete=fake,
                        voice_fn=fake_voice, qa_fn=qa, shows_dir=tmp_path, sleep_fn=waits.append)
    return code, folder, waits


def test_low_memory_qa_is_tried_again_and_a_later_pass_counts(tmp_path):
    qa = SeqQa(LOW_RAM, {"result": "pass", "findings": []})
    code, folder, waits = _run_qa(tmp_path, qa)
    assert code == 0 and qa.calls == 2 and waits == [writer.QA_RETRY_WAIT]
    r = result(folder)
    assert r["qa"] == "pass" and r["qa_not_run"] is False


def test_qa_that_never_runs_is_flagged_not_passed(tmp_path):
    qa = SeqQa(LOW_RAM)
    code, folder, waits = _run_qa(tmp_path, qa)
    assert qa.calls == writer.QA_TRIES and waits == [writer.QA_RETRY_WAIT] * (writer.QA_TRIES - 1)
    r = result(folder)
    assert r["qa"] == "not_run" and r["qa_not_run"] is True


def test_qa_not_run_for_another_reason_is_flagged_without_waiting(tmp_path):
    qa = SeqQa({"result": "not_run", "reason": "no output", "findings": []})
    code, folder, waits = _run_qa(tmp_path, qa)
    assert qa.calls == 1 and waits == [] and result(folder)["qa_not_run"] is True


def test_low_memory_line_is_found_anywhere_in_a_long_stderr(monkeypatch):
    noise = "(node:1) ExperimentalWarning: something long\n" * 20
    err = "QA ERROR: only 1.1 GB of memory is free; browser jobs need 2 GB. Close something and try again.\n" + noise
    monkeypatch.setattr(writer, "node_json", lambda args, timeout=600: (1, None, err))
    qa = writer.run_qa("moon")
    assert qa["result"] == "not_run" and "of memory is free" in qa["reason"]
    waits = []
    seq = SeqQa(qa, {"result": "pass", "findings": []})
    assert writer._qa_with_retry(seq, "moon", waits.append)["result"] == "pass" and waits == [writer.QA_RETRY_WAIT]
    monkeypatch.setattr(writer, "node_json", lambda args, timeout=600: (1, None, "boom\n" * 100))
    assert "of memory is free" not in writer.run_qa("moon")["reason"]


def test_qa_off_in_settings_is_not_flagged(tmp_path):
    code, folder, fake = run_writer(tmp_path, {"script": [script_reply()], "audit": [audit_reply(GOOD_CLAIM)],
                                               "show": [good_show]}, settings={"qa": False})
    assert code == 0 and result(folder)["qa_not_run"] is False
