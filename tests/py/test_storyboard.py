"""The storyboard step (pipeline/writer.py, between the voice and the show) with the fake LLM, fake voice and
the REAL node validator from test_writer.py. Nothing here calls a paid service or the network."""
import json
from pathlib import Path

import pytest

from pipeline import writer
from test_writer import (GOOD_CLAIM, OLD_DEFAULTS, QA_PASS, SCRIPT, FakeLLM, audit_reply, fake_voice, good_show,
                         pytestmark, result, script_reply)   # pytestmark: skip when node is missing

assert pytestmark  # used by pytest for this module too

ON = {"storyboard": True}
REVIEW_PASS = json.dumps({"verdict": "pass", "problems": []})
REVIEW_BAD = json.dumps({"verdict": "problems", "problems": [
    {"sentence": 2, "kind": "story", "what": 'S2 "The tides would shrink": the tides are not shown',
     "fix": "show the oceans pulling back"}]})


def words_of(folder):
    return json.loads((Path(folder) / "words.json").read_text(encoding="utf-8"))


class Board:
    """A storyboard reply built once the voice exists: one planet entry per sentence. edit(board, words) changes it."""

    def __init__(self, edit=None):
        self.edit = edit

    def __call__(self, folder):
        words = words_of(folder)
        n = len(writer.sentences(words))
        b = {"hook": "What if the Moon vanished tonight?", "answer": "The tides shrink and the nights get darker.",
             "hero": "planet", "summary": "Earth loses its Moon; its oceans settle and its nights darken.",
             "scenes": [{"scene": 1, "env": "studio", "idea": "Earth without its Moon"}],
             "sentences": [{"scene": 1, "objects": [{"prop": "planet", "look": "blue Earth", "place": "centre, big",
                                                     "stands_for": "Earth"}],
                            "change": "the oceans pull back", "camera": "slow orbit", "texts": [], "flows": []}
                           for _ in range(n)],
             "ending": {"closing_question": "What would you miss most?", "comment_line": "Comment your answer below.",
                        "tail": "Earth keeps turning, darker"}}
        if self.edit:
            self.edit(b, words)
        return b


def gap(central):
    def edit(b, words):
        b["sentences"][1]["objects"].append({"missing": "an ocean with a tide line that can rise and fall",
                                             "stand_in": "planet", "central": central, "look": "deep blue",
                                             "place": "behind", "stands_for": "the oceans"})
    return edit


def run_sb(tmp_path, replies, settings=None):
    folder = tmp_path / "moon"
    fake = FakeLLM(folder, dict({"script": [script_reply()], "audit": [audit_reply(GOOD_CLAIM)]}, **replies))
    s = dict(OLD_DEFAULTS, **ON)
    s.update(settings or {})
    code = writer.write("What if the Moon vanished?", "moon", mode="api", settings=s, complete=fake,
                        voice_fn=fake_voice, qa_fn=QA_PASS, shows_dir=tmp_path)
    return code, folder, fake


# ---------------------------------------------------------------- settings and prompts

def test_storyboard_is_on_by_default_and_settings_can_turn_it_off(tmp_path):
    assert writer.DEFAULTS["storyboard"] is True and writer.DEFAULTS["storyboard_repairs"] == 1
    f = tmp_path / "settings.yaml"
    f.write_text("writer:\n  storyboard: false\n  storyboard_repairs: 1\n", encoding="utf-8")
    s = writer.load_settings(f)
    assert s["storyboard"] is False and s["storyboard_repairs"] == 1


def test_storyboard_prompts_take_their_numbers_from_the_code():
    assert writer.TEXT_MIN_SECONDS == 2.5 and writer.TAIL_SECONDS == 2.5
    for name in ("storyboard_system.md", "storyboard_review_system.md"):
        raw = writer.read_prompt(name)
        # The seconds are filled from the constants, never written by hand, so they cannot drift.
        key = "{{CATALOG}}" if name == "storyboard_system.md" else "{{CATALOG_NAMES}}"   # the planner sees the full prop lines
        assert "{{TEXT_SECONDS}}" in raw and "{{TAIL}}" in raw and key in raw, name
        assert "2.5" not in raw, name
    show = writer.read_prompt("show_system.md")
    assert "2 to 4 main scenes" in writer.read_prompt("storyboard_system.md") and "2 to 4 main scenes" in show


def test_planning_facts_are_the_same_in_the_storyboard_and_show_prompts():
    # Copied on purpose (the prompt templating has no includes); this keeps the copies in sync.
    board, show = writer.read_prompt("storyboard_system.md"), writer.read_prompt("show_system.md")
    for fact in ('+x is right, +y is up, +z is toward the viewer.',
                 'A wire\'s charge dots run from its "from" end to its "to" end; an arrow points at its "to".',
                 '"planet" turns by itself (its "turn" param, default 0.02 turns/s, clouds faster); to show it '
                 'stopping or starting, place it with "turn": 0 and drive all turning with "spin" (speed 0 stops it).'):
        assert fact in board and fact in show, fact


def test_show_prompt_without_a_storyboard_is_unchanged(tmp_path):
    fake_voice(SCRIPT, tmp_path, None)
    words = words_of(tmp_path)
    plain = writer.show_user_prompt("t", words, SCRIPT, None)
    assert "STORYBOARD" not in plain and "{{" not in plain
    board = Board()(tmp_path)
    withsb = writer.show_user_prompt("t", words, SCRIPT, None, writer.normalise_storyboard(board))
    assert "THE APPROVED STORYBOARD" in withsb and "{{" not in withsb and "What if the Moon vanished tonight?" in withsb
    # The repair prompt hands this text back as "your previous storyboard", so it must stay valid JSON.
    gapped = writer.normalise_storyboard(Board(gap(False))(tmp_path))
    back = json.loads(writer.storyboard_text(gapped))
    assert back["sentences"][0]["objects"][0] == {"prop": "planet", "look": "blue Earth", "place": "centre, big",
                                                  "stands_for": "Earth"}            # no empty gap fields
    assert back["sentences"][1]["objects"][1]["missing"].startswith("an ocean")


# ---------------------------------------------------------------- the step in a run

def test_storyboard_pass_runs_in_order_and_is_written(tmp_path):
    code, folder, fake = run_sb(tmp_path, {"storyboard": [Board()], "storyboard-review": [REVIEW_PASS],
                                           "show": [good_show]})
    assert code == 0
    assert fake.purposes == ["script", "audit", "storyboard", "storyboard-review", "show"]
    show_prompt = fake.calls[-1].user
    assert "THE APPROVED STORYBOARD" in show_prompt and "Earth loses its Moon" in show_prompt
    review_prompt = fake.calls[3].user
    assert "S1 [" in review_prompt and '"hero": "planet"' in review_prompt
    assert "Assume the storyboard has problems" in fake.calls[3].system
    sb = json.loads((folder / "storyboard.json").read_text(encoding="utf-8"))
    assert sb["hero"] == "planet" and sb["review"]["verdict"] == "pass"
    md = (folder / "storyboard.md").read_text(encoding="utf-8")
    assert "## Scene 1 (studio)" in md and "**S1**" in md and "## Ending" in md
    r = result(folder)
    assert r["status"] == "ok" and r["storyboard"] == {"verdict": "pass", "repairs": 0, "notes": []}
    assert r["props_wanted"] == []
    review = (folder / "review.md").read_text(encoding="utf-8")
    assert "## Storyboard (see storyboard.md)" in review and "Reviewer verdict: pass" in review
    assert "storyboard.json" in review and "storyboard.md" in review


def test_review_problems_then_repair_then_pass(tmp_path):
    code, folder, fake = run_sb(tmp_path, {"storyboard": [Board()], "storyboard-repair": [Board()],
                                           "storyboard-review": [REVIEW_BAD, REVIEW_PASS], "show": [good_show]})
    assert code == 0
    assert fake.purposes == ["script", "audit", "storyboard", "storyboard-review", "storyboard-repair1",
                             "storyboard-review", "show"]
    repair = fake.calls[4].user
    assert "YOUR PREVIOUS STORYBOARD" in repair and "the tides are not shown" in repair
    assert result(folder)["storyboard"]["repairs"] == 1


def test_still_failing_after_two_repairs_fails_cleanly(tmp_path):
    code, folder, fake = run_sb(tmp_path, {"storyboard": [Board()], "storyboard-repair": [Board(), Board()],
                                           "storyboard-review": [REVIEW_BAD] * 3},
                                   settings={"storyboard_repairs": 2})
    assert code == 1
    assert fake.purposes == ["script", "audit", "storyboard", "storyboard-review", "storyboard-repair1",
                             "storyboard-review", "storyboard-repair2", "storyboard-review"]
    r = result(folder)
    assert r["status"] == "failed" and "after 2 repair round(s)" in r["error"] and "the tides are not shown" in r["error"]
    assert r["storyboard"]["verdict"] == "problems"
    assert "## Problems left" in (folder / "storyboard.md").read_text(encoding="utf-8")


def test_code_check_problems_go_straight_to_a_repair(tmp_path):
    def bad(b, words):
        b["sentences"][0]["objects"][0]["prop"] = "rockett"
    code, folder, fake = run_sb(tmp_path, {"storyboard": [Board(bad)], "storyboard-repair": [Board()],
                                           "storyboard-review": [REVIEW_PASS], "show": [good_show]})
    assert code == 0
    assert fake.purposes == ["script", "audit", "storyboard", "storyboard-repair1", "storyboard-review", "show"]
    assert '"rockett" is not a catalogue prop' in fake.calls[3].user


def test_central_gap_stops_for_props(tmp_path):
    code, folder, fake = run_sb(tmp_path, {"storyboard": [Board(gap(True))], "storyboard-review": [REVIEW_PASS]})
    assert code == 3 and "show" not in fake.purposes
    text = (folder / "NEEDS-PROPS.md").read_text(encoding="utf-8")
    assert "- an ocean with a tide line that can rise and fall" in text
    assert result(folder)["status"] == "needs_props"
    review = (folder / "review.md").read_text(encoding="utf-8")
    assert "central gap" in review and not (folder / "show.json").exists()


def test_a_hero_that_is_a_central_gap_stops_for_props_without_repairs(tmp_path):
    def hero_gap(b, words):
        b["hero"] = "none"
        for s in b["sentences"]:
            s["objects"] = [{"missing": "a marshmallow that puffs up", "stand_in": "none", "central": True,
                             "look": "white, soft", "place": "centre", "stands_for": "the marshmallow"}]
    code, folder, fake = run_sb(tmp_path, {"storyboard": [Board(hero_gap)], "storyboard-review": [REVIEW_PASS]})
    assert code == 3 and fake.purposes == ["script", "audit", "storyboard", "storyboard-review"]
    assert "- a marshmallow that puffs up" in (folder / "NEEDS-PROPS.md").read_text(encoding="utf-8")


def test_a_central_gap_still_criticised_after_the_repairs_stops_for_props(tmp_path):
    code, folder, fake = run_sb(tmp_path, {"storyboard": [Board(gap(True))],
                                           "storyboard-repair": [Board(gap(True)), Board(gap(True))],
                                           "storyboard-review": [REVIEW_BAD] * 3})
    assert code == 3 and fake.purposes[-1] == "storyboard-review" and "show" not in fake.purposes
    assert result(folder)["status"] == "needs_props"


def test_non_central_gap_goes_to_props_wanted(tmp_path):
    code, folder, fake = run_sb(tmp_path, {"storyboard": [Board(gap(False))], "storyboard-review": [REVIEW_PASS],
                                           "show": [good_show]})
    assert code == 0
    assert result(folder)["props_wanted"] == [{"missing": "an ocean with a tide line that can rise and fall",
                                               "stand_in": "planet", "sentence": 2}]
    review = (folder / "review.md").read_text(encoding="utf-8")
    assert "### Props wanted" in review and "- an ocean with a tide line that can rise and fall (stand-in: planet" in review


def test_show_missing_a_storyboard_text_is_sent_to_the_repair(tmp_path):
    def text(b, words):
        b["sentences"][1]["texts"] = [{"words": "TIDES", "starts": "The tides would shrink", "ends": 4}]

    def with_label(folder):
        show = good_show(folder)
        s2 = writer.sentences(words_of(folder))[1][0]["start"]
        show["shots"][0]["actions"].append({"at": {"time": s2}, "do": "label", "prop": "hero", "text": "TIDES"})
        return show
    code, folder, fake = run_sb(tmp_path, {"storyboard": [Board(text)], "storyboard-review": [REVIEW_PASS],
                                           "show": [good_show], "repair": [with_label]})
    assert code == 0 and fake.purposes[-2:] == ["show", "repair1"]
    assert "storyboard.text" in fake.calls[-1].user and '"TIDES"' in fake.calls[-1].user


def test_files_mode_numbers_the_storyboard_calls_and_replays(tmp_path):
    folder, llm_dir = tmp_path / "moon", tmp_path / "moon" / "llm"
    s = dict(OLD_DEFAULTS, **ON)

    def go():
        return writer.write("What if the Moon vanished?", "moon", mode="files", settings=s,
                            voice_fn=fake_voice, qa_fn=QA_PASS, shows_dir=tmp_path)
    assert go() == 4
    (llm_dir / "01-script.reply.md").write_text(script_reply(), encoding="utf-8")
    assert go() == 4
    (llm_dir / "02-audit.reply.md").write_text(audit_reply(GOOD_CLAIM), encoding="utf-8")
    assert go() == 4
    assert "=== SYSTEM ===" in (llm_dir / "03-storyboard.prompt.md").read_text(encoding="utf-8")
    (llm_dir / "03-storyboard.reply.md").write_text(json.dumps(Board()(folder)), encoding="utf-8")
    assert go() == 4
    (llm_dir / "04-storyboard-review.reply.md").write_text(REVIEW_BAD, encoding="utf-8")
    assert go() == 4
    (llm_dir / "05-storyboard-repair1.reply.md").write_text(json.dumps(Board()(folder)), encoding="utf-8")
    assert go() == 4
    (llm_dir / "06-storyboard-review.reply.md").write_text(REVIEW_PASS, encoding="utf-8")
    assert go() == 4
    assert "THE APPROVED STORYBOARD" in (llm_dir / "07-show.prompt.md").read_text(encoding="utf-8")
    (llm_dir / "07-show.reply.md").write_text(json.dumps(good_show(folder)), encoding="utf-8")
    assert go() == 0
    assert [c["purpose"] for c in result(folder)["calls"]] == [
        "script", "audit", "storyboard", "storyboard-review", "storyboard-repair1", "storyboard-review", "show"]
    # Restart from the review: delete that reply and every later one; a pass now skips the repair.
    for p in llm_dir.glob("*.reply.md"):
        if int(p.name[:2]) >= 4:
            p.unlink()
    for p in llm_dir.glob("*.prompt.md"):
        if int(p.name[:2]) >= 4:
            p.unlink()
    assert go() == 4
    (llm_dir / "04-storyboard-review.reply.md").write_text(REVIEW_PASS, encoding="utf-8")
    assert go() == 4 and (llm_dir / "05-show.prompt.md").exists()


def test_storyboard_off_makes_no_storyboard_calls_or_files(tmp_path):
    code, folder, fake = run_sb(tmp_path, {"show": [good_show]}, settings={"storyboard": False})
    assert code == 0 and fake.purposes == ["script", "audit", "show"]
    assert "STORYBOARD" not in fake.calls[-1].user
    assert not (folder / "storyboard.json").exists() and result(folder)["storyboard"] is None


# ---------------------------------------------------------------- the pieces

def test_review_parsing():
    assert writer.parse_review(REVIEW_PASS) == ("pass", [])
    verdict, notes = writer.parse_review(json.dumps({"verdict": "pass", "problems": [
        {"sentence": 1, "kind": "text", "what": "could be bigger", "fix": ""}]}))
    assert verdict == "pass" and notes == ["S1 (text): could be bigger"]
    assert writer.parse_review(REVIEW_BAD)[0] == "problems"
    with pytest.raises(writer.BadReply):
        writer.parse_review(json.dumps({"verdict": "maybe"}))


def test_code_check_on_text_timing_and_names(tmp_path):
    fake_voice(SCRIPT, tmp_path, None)
    words = words_of(tmp_path)
    cat = writer.catalog_text.load_catalog()
    ok = writer.normalise_storyboard(Board()(tmp_path))
    assert writer.storyboard_problems(ok, words, cat) == []
    short = writer.normalise_storyboard(Board(lambda b, w: b["sentences"][1].update(
        texts=[{"words": "1/3", "starts": "a third", "ends": 3}]))(tmp_path))
    assert any("on screen only" in p for p in writer.storyboard_problems(short, words, cat))
    wrong = writer.normalise_storyboard(Board(lambda b, w: b["sentences"][1].update(
        texts=[{"words": "TIDES", "starts": "the oceans", "ends": "later"}]))(tmp_path))
    found = writer.storyboard_problems(wrong, words, cat)
    assert any("not words of this sentence" in p for p in found) and any('use a later sentence number' in p for p in found)
    junk = writer.normalise_storyboard({"sentences": "nope", "ending": [1], "hero": {"x": 1}})
    assert junk["sentences"] == [] and writer.storyboard_problems(junk, words, cat)


CIRCUIT_WORDS = [{"text": t, "start": i * 0.5, "end": i * 0.5 + 0.4} for i, t in enumerate(
    "The battery pushes current around. The bulb lights up hot. It glows for hours. Comment your answer below.".split())]


def circuit_board(flows, texts=None, objects=("battery", "lightbulb", "wire")):
    n = len(writer.sentences(CIRCUIT_WORDS))
    sents = [{"scene": "1", "objects": [{"prop": p, "look": "", "place": "", "stands_for": "", "missing": "",
                                         "stand_in": "", "central": False} for p in objects],
              "change": "x", "camera": "", "texts": [], "flows": []} for _ in range(n)]
    sents[0]["flows"] = [{"what": "current", "by": "wire", "from": a, "to": b} for a, b in flows]
    sents[1]["texts"] = texts or []
    return {"hook": "h", "answer": "a", "hero": "battery", "summary": "", "scenes": [], "sentences": sents,
            "ending": {"closing_question": "q", "comment_line": "c", "tail": "t"}}


def circuit_show(second_from, second_to):
    return {"shots": [{"id": "s0", "env": "studio", "props": [
        {"id": "bat", "type": "battery", "at": [-1, 0, 0]}, {"id": "bulb", "type": "lightbulb", "at": [1, 0, 0]},
        {"id": "w1", "type": "wire", "from": [-1, 0.95, 0], "to": [1, 1.0, 0]},
        {"id": "w2", "type": "wire", "from": second_from, "to": second_to}], "actions": []}]}


def test_coverage_flow_direction():
    board = circuit_board([("battery", "lightbulb"), ("lightbulb", "battery")])
    assert writer.coverage_problems(board, circuit_show("bulb", "bat"), CIRCUIT_WORDS, {}) == []
    wrong = writer.coverage_problems(board, circuit_show("bat", "bulb"), CIRCUIT_WORDS, {})
    assert [p["path"] for p in wrong] == ["storyboard.flow"]
    assert "from the lightbulb to the battery" in wrong[0]["message"]


def test_coverage_missing_prop():
    board = circuit_board([], objects=("battery", "lightbulb", "thermometer"))
    found = writer.coverage_problems(board, circuit_show("bulb", "bat"), CIRCUIT_WORDS, {})
    assert [p["path"] for p in found] == ["storyboard.props"] and '"thermometer"' in found[0]["message"]


def test_coverage_text_missing_late_and_removed_early():
    # S2 "The bulb lights up hot." starts at 2.5 s; "hot" at 4.5 s; S4 starts at 7.0 s.
    board = circuit_board([], texts=[{"words": "2000 °C", "starts": "hot", "ends": 4}])
    show = circuit_show("bulb", "bat")
    assert [p["message"] for p in writer.coverage_problems(board, show, CIRCUIT_WORDS, {"overlays": []})] == [
        'S2: the storyboard text "2000 °C" on "hot" is not in the show.']
    count = {"do": "count", "to": 2000, "unit": "°C", "decimals": 0, "t0": 4.5, "until": 7.0}
    assert writer.coverage_problems(board, show, CIRCUIT_WORDS, {"overlays": [count]}) == []
    early = dict(count, until=5.0)
    msg = writer.coverage_problems(board, show, CIRCUIT_WORDS, {"overlays": [early]})
    assert len(msg) == 1 and "goes away at 5.00 s" in msg[0]["message"] and "again at the start of the next" in msg[0]["hint"]
    # The same text given again in the next shot counts as one text kept up.
    again = {"do": "text", "text": "2000 °C", "t0": 5.0, "until": 7.0}
    assert writer.coverage_problems(board, show, CIRCUIT_WORDS, {"overlays": [early, again]}) == []
    late = dict(count, t0=6.5)
    assert "starts at 6.50 s" in writer.coverage_problems(board, show, CIRCUIT_WORDS, {"overlays": [late]})[0]["message"]


def test_validator_lists_overlay_times(tmp_path):
    fake_voice(SCRIPT, tmp_path, None)
    show = good_show(tmp_path)
    show["shots"][0]["actions"].append({"at": {"time": 1.0}, "do": "label", "prop": "hero", "text": "TIDES"})
    (tmp_path / "show.json").write_text(json.dumps(show), encoding="utf-8")
    check = writer.validate_show(tmp_path)
    assert check["ok"] and check["overlays"][0]["text"] == "TIDES" and check["overlays"][0]["t0"] == 1.0


# ---------------------------------------------------------------- text matching, the tail, unusable replies

def covers(planned, shown):
    return writer.text_covers(writer._tokens(planned), writer._tokens(shown))


def test_text_matching_is_not_fooled_by_fragments_or_units():
    assert not covers("2000 °C", "0")                      # a tiny fragment never covers
    assert not covers("hotter", "hot") and not covers("hot", "hotter")
    assert covers("2000 °C", "2000 degrees") and covers("2000 °C", "2000°C") and covers("2000 °C", "2000 C")
    assert covers("2000 °C", "2000")                       # the number is the key fact: a number-only match counts
    assert not covers("2000 °C", "2001 °C") and not covers("50 %", "5 percent")
    assert covers("50 %", "50 percent") and covers("1,000 km/h", "1000 kph")
    assert covers("The tides shrink", "tides shrink") and not covers("The tides shrink", "tides")


def test_coverage_accepts_a_count_with_a_unit_word_and_rejects_a_fragment_label():
    board = circuit_board([("battery", "lightbulb")], texts=[{"words": "2000 °C", "starts": "lights up",
                                                              "ends": 3}])
    show = circuit_show("bulb", "bat")
    show["shots"][0]["actions"] = [{"at": {"time": 1.0}, "do": "count", "prop": "bulb", "from": 0, "to": 2000,
                                    "unit": " degrees"}]
    assert writer.coverage_problems(board, show, CIRCUIT_WORDS, {}) == []
    show["shots"][0]["actions"] = [{"at": {"time": 1.0}, "do": "label", "prop": "bulb", "text": "0"}]
    msg = [p["message"] for p in writer.coverage_problems(board, show, CIRCUIT_WORDS, {})]
    assert any("is not in the show" in m for m in msg)


def test_a_text_in_the_last_sentence_may_use_the_tail():
    board = circuit_board([])
    board["sentences"][-1]["texts"] = [{"words": "Comment your answer below.", "starts": "Comment your answer",
                                        "ends": "end"}]
    found = writer.storyboard_problems(writer.normalise_storyboard(board), CIRCUIT_WORDS,
                                       writer.catalog_text.load_catalog())
    assert not any("on screen only" in p for p in found)


def test_a_flow_end_must_be_a_prop():
    cat = writer.catalog_text.load_catalog()
    def found(flows):
        return writer.storyboard_problems(writer.normalise_storyboard(circuit_board(flows)), CIRCUIT_WORDS, cat)
    assert not any("flow" in p for p in found([("battery", "lightbulb")]))
    assert any("'nowhere' is not a prop" in p for p in found([("battery", "nowhere")]))


def test_overlay_tokens_survive_bad_decimals_and_huge_counts():
    for bad in (-1, "x", 1e400, 10**30, True):
        writer._overlay_tokens({"do": "count", "to": 5, "decimals": bad})
    writer._overlay_tokens({"do": "count", "to": 10**400, "decimals": 0})
    assert writer._overlay_tokens({"do": "count", "to": 5, "decimals": -1}) == writer._tokens("5")


def test_a_non_integer_storyboard_repairs_uses_the_default(tmp_path):
    for bad in ("3", True, 1.0):
        code, folder, fake = run_sb(tmp_path / str(bad), {"storyboard": ["not json"], "storyboard-repair": ["not json"] * 2},
                                    settings={"storyboard_repairs": bad})
        assert code == 1 and sum(p.startswith("storyboard") for p in fake.purposes) == 2   # 1 + the default 1


def test_an_unusable_review_reply_costs_a_repair_instead_of_crashing(tmp_path):
    code, folder, fake = run_sb(tmp_path, {"storyboard": [Board()], "storyboard-repair": [Board()],
                                           "storyboard-review": ["not json at all", REVIEW_PASS],
                                           "show": [good_show]})
    assert code == 0 and result(folder)["storyboard"]["repairs"] == 1
    assert fake.purposes[2:7] == ["storyboard", "storyboard-review", "storyboard-repair1", "storyboard-review", "show"]


def test_unusable_reviews_to_the_end_fail_cleanly_and_write_the_files(tmp_path):
    code, folder, fake = run_sb(tmp_path, {"storyboard": [Board()], "storyboard-repair": [Board(), Board()],
                                           "storyboard-review": ["no"] * 3})
    assert code == 1 and "could not be read" in result(folder)["error"]
    assert (folder / "storyboard.json").exists() and (folder / "storyboard.md").exists()


def test_no_usable_storyboard_at_all_still_writes_the_files(tmp_path):
    code, folder, fake = run_sb(tmp_path, {"storyboard": ["x"], "storyboard-repair": ["y", "z"]})
    assert code == 1 and result(folder)["status"] == "failed"
    saved = json.loads((folder / "storyboard.json").read_text(encoding="utf-8"))
    assert saved["review"]["last_reply_unusable"] is True and "hook" not in saved
    assert "No usable storyboard" in (folder / "storyboard.md").read_text(encoding="utf-8")


def test_a_failed_last_repair_never_lets_an_older_central_gap_decide(tmp_path):
    code, folder, fake = run_sb(tmp_path, {"storyboard": [Board(gap(True))],
                                           "storyboard-repair": [Board(gap(True)), "not json"],
                                           "storyboard-review": [REVIEW_BAD] * 2}, settings={"storyboard_repairs": 2})
    assert code == 1 and result(folder)["status"] == "failed"      # not 3: the central gap is from an older reply
    saved = json.loads((folder / "storyboard.json").read_text(encoding="utf-8"))
    assert saved["review"]["last_reply_unusable"] is True and saved["hook"]
    assert "older version" in (folder / "storyboard.md").read_text(encoding="utf-8")


# ---------------------------------------------------------------- review fixes round

def test_review_problems_are_never_silently_a_pass():
    one = writer.parse_review(json.dumps({"verdict": "problems", "problems": ["S3 shows wrong thing"]}))
    assert one[0] == "problems" and "S3 shows wrong thing" in one[1][0]
    assert writer.parse_review(json.dumps({"verdict": "problems", "problems": "S3 is wrong"}))[0] == "problems"
    for bad in ({"verdict": "problems", "problems": []}, {"verdict": "problems"},
                {"verdict": "problems", "problems": [""]}):
        with pytest.raises(writer.BadReply):
            writer.parse_review(json.dumps(bad))
    notes = writer.parse_review(json.dumps({"verdict": "pass", "problems": ["just a note"]}))
    assert notes[0] == "pass"                                  # pass still wins


def test_review_sentence_label_has_no_double_s():
    for label in ("S3", "s3", 3, "3", "sentence 3", "Sentence S3"):
        lines = writer.parse_review(json.dumps({"verdict": "problems", "problems": [
            {"sentence": label, "kind": "x", "what": "bad"}]}))[1]
        assert lines == ["S3 (x): bad"], label


def test_hero_must_be_a_prop_the_board_uses(tmp_path):
    fake_voice(SCRIPT, tmp_path, None)
    words = words_of(tmp_path)
    cat = writer.catalog_text.load_catalog()
    def check(edit):
        return writer.storyboard_problems(writer.normalise_storyboard(Board(edit)(tmp_path)), words, cat)
    assert not any("hero" in p for p in check(None))
    assert any('"hero"' in p for p in check(lambda b, w: b.update(hero="banana")))
    assert any('"hero"' in p for p in check(lambda b, w: b.update(hero="")))
    both = lambda b, w: (gap(True)(b, w), b.update(hero="banana"))       # a central gap does not excuse it
    assert any('"hero"' in p for p in check(both))
    emptied = lambda b, w: (b["sentences"][1]["objects"].append({"missing": "x", "stand_in": "", "central": False}),
                            b.update(hero=""))
    assert any('"hero"' in p for p in check(emptied))                # "" is not an empty stand-in
    assert not any('"hero"' in p for p in check(lambda b, w: (gap(True)(b, w), b.update(hero="none"))))


class FailingReview:
    """Wraps the fake LLM; the first review call raises like a dead network."""
    def __init__(self, fake, exc):
        self.fake, self.exc = fake, exc

    def __call__(self, system, user, *, purpose, max_tokens):
        if purpose == "storyboard-review":
            raise self.exc
        return self.fake(system, user, purpose=purpose, max_tokens=max_tokens)

    def __getattr__(self, name):
        return getattr(self.fake, name)


@pytest.mark.parametrize("exc", [writer.llm.LlmError("network down"), OSError("disk")])
def test_files_are_written_when_a_later_call_dies(tmp_path, exc):
    folder = tmp_path / "moon"
    fake = FakeLLM(folder, {"script": [script_reply()], "audit": [audit_reply(GOOD_CLAIM)], "storyboard": [Board()],
                                 "storyboard-repair": [Board(), Board()]})   # a dead review costs repairs, then fails
    code = writer.write("What if the Moon vanished?", "moon", mode="api", settings=dict(OLD_DEFAULTS, **ON),
                        complete=FailingReview(fake, exc), voice_fn=fake_voice, qa_fn=QA_PASS, shows_dir=tmp_path)
    assert code == 1
    assert (folder / "storyboard.json").exists() and (folder / "storyboard.md").exists()


def test_gaps_of_no_board_is_empty():
    assert writer.storyboard_gaps(None) == []


def test_negative_repairs_runs_the_storyboard_once(tmp_path):
    code, folder, fake = run_sb(tmp_path, {"storyboard": [Board()], "storyboard-review": [REVIEW_PASS],
                                           "show": [good_show]}, settings={"storyboard_repairs": -1})
    assert code == 0 and fake.purposes[2:4] == ["storyboard", "storyboard-review"]
    code, folder, fake = run_sb(tmp_path / "b", {"storyboard": ["not json"]}, settings={"storyboard_repairs": -1})
    assert code == 1 and (folder / "storyboard.md").exists()


def test_tokens_unicode_numbers_and_single_digits():
    assert covers("Café", "Cafe") and covers("Cafe", "Café")
    assert writer._tokens("Δt λ") == ["δt", "λ"]
    assert covers("3.5 m", "3.50 m") and covers("2,000", "2000") and covers("3.5", "3.50")
    assert covers("9", "9") and not covers("9", "10")
    assert not covers("hotter", "hot")


def test_coverage_keeps_a_single_digit_and_accepts_a_split_text():
    board = circuit_board([], texts=[{"words": "9", "starts": "lights up", "ends": 3}])
    show = circuit_show("bulb", "bat")
    show["shots"][0]["actions"] = [{"at": {"time": 1.0}, "do": "label", "prop": "bulb", "text": "8"}]
    assert any("is not in the show" in p["message"] for p in writer.coverage_problems(board, show, CIRCUIT_WORDS, {}))
    show["shots"][0]["actions"][0]["text"] = "9"
    assert writer.coverage_problems(board, show, CIRCUIT_WORDS, {}) == []
    board = circuit_board([], texts=[{"words": "Magma chamber", "starts": "lights up", "ends": 3}])
    show["shots"][0]["actions"] = [{"at": {"time": 1.0}, "do": "label", "prop": "bulb", "text": "Magma"},
                                   {"at": {"time": 1.0}, "do": "label", "prop": "bat", "text": "chamber"}]
    assert writer.coverage_problems(board, show, CIRCUIT_WORDS, {}) == []
    show["shots"][0]["actions"][1]["text"] = "volcano"           # a part that is not in the plan: not a cover
    assert writer.coverage_problems(board, show, CIRCUIT_WORDS, {})


def test_flow_message_does_not_claim_there_is_no_wire():
    board = circuit_board([("battery", "lightbulb")])
    show = circuit_show("bulb", "bat")
    for w in show["shots"][0]["props"][2:]:
        w.update({"from": "slot1", "to": "slot2"})
    msg = [p["message"] for p in writer.coverage_problems(board, show, CIRCUIT_WORDS, {})]
    assert len(msg) == 1 and "could be matched" in msg[0] and "has no" not in msg[0]


# ---------------------------------------------------------------- second review fixes round

class RaiseOnce:
    """Wraps the fake LLM; the first call with this purpose raises exc, later calls pass through."""
    def __init__(self, fake, purpose, exc):
        self.fake, self.purpose, self.exc, self.done = fake, purpose, exc, False

    def __call__(self, system, user, *, purpose, max_tokens):
        if purpose == self.purpose and not self.done:
            self.done = True
            raise self.exc
        return self.fake(system, user, purpose=purpose, max_tokens=max_tokens)

    def __getattr__(self, name):
        return getattr(self.fake, name)


@pytest.mark.parametrize("first,exc,replies", [
    ("storyboard", writer.llm.LlmError("the answer was cut off at max_tokens=1"),
     {"storyboard-repair": [Board()], "storyboard-review": [REVIEW_PASS]}),
    ("storyboard-review", writer.llm.LlmError("the answer was cut off at max_tokens=1"),
     {"storyboard": [Board()], "storyboard-repair": [Board()], "storyboard-review": [REVIEW_PASS]}),
])
def test_a_cut_off_storyboard_or_review_costs_a_repair_like_in_the_show_step(tmp_path, first, exc, replies):
    folder = tmp_path / "moon"
    fake = FakeLLM(folder, dict({"script": [script_reply()], "audit": [audit_reply(GOOD_CLAIM)], "show": [good_show]},
                                **replies))
    code = writer.write("What if the Moon vanished?", "moon", mode="api", settings=dict(OLD_DEFAULTS, **ON),
                        complete=RaiseOnce(fake, first, exc), voice_fn=fake_voice, qa_fn=QA_PASS, shows_dir=tmp_path)
    assert code == 0 and result(folder)["storyboard"]["repairs"] == 1


def test_other_errors_in_the_storyboard_call_still_end_the_run(tmp_path):
    folder = tmp_path / "moon"
    fake = FakeLLM(folder, {"script": [script_reply()], "audit": [audit_reply(GOOD_CLAIM)], "storyboard": [Board()]})
    code = writer.write("What if the Moon vanished?", "moon", mode="api", settings=dict(OLD_DEFAULTS, **ON),
                        complete=RaiseOnce(fake, "storyboard", OSError("disk")), voice_fn=fake_voice, qa_fn=QA_PASS,
                        shows_dir=tmp_path)
    assert code == 1 and fake.purposes.count("storyboard-repair1") == 0


def test_files_are_written_even_when_no_board_ever_parsed(tmp_path):
    folder = tmp_path / "moon"
    fake = FakeLLM(folder, {"script": [script_reply()], "audit": [audit_reply(GOOD_CLAIM)]})
    code = writer.write("What if the Moon vanished?", "moon", mode="api", settings=dict(OLD_DEFAULTS, **ON),
                        complete=RaiseOnce(fake, "storyboard", OSError("disk")), voice_fn=fake_voice, qa_fn=QA_PASS,
                        shows_dir=tmp_path)
    assert code == 1
    assert (folder / "storyboard.json").exists() and (folder / "storyboard.md").exists()


FIRST_SHOT_RULE = 'one clear subject, big (close framing or "fill"), with at most one other small prop'


def test_first_shot_limit_is_in_planner_reviewer_and_show_prompts():
    for name in ("storyboard_system.md", "storyboard_review_system.md", "show_system.md"):
        assert FIRST_SHOT_RULE in writer.read_prompt(name), name


def test_first_shot_with_three_objects_is_a_code_problem(tmp_path):
    fake_voice(SCRIPT, tmp_path, None)
    words = words_of(tmp_path)
    cat = writer.catalog_text.load_catalog()

    def problems(extra):
        def edit(b, w):
            b["sentences"][0]["objects"] += [dict(b["sentences"][0]["objects"][0]) for _ in range(extra)]
        return writer.storyboard_problems(writer.normalise_storyboard(Board(edit)(tmp_path)), words, cat)
    assert problems(1) == []                                  # hero plus one small prop is allowed
    assert any("first shot" in p for p in problems(2))


def test_empty_review_problems_are_unreadable_and_labels_are_shown_as_written():
    for bad in ([{}], [{"sentence": "sentence 4", "kind": "flow"}], [{"what": " ", "fix": ""}]):
        with pytest.raises(writer.BadReply):
            writer.parse_review(json.dumps({"verdict": "problems", "problems": bad}))
    lines = writer.parse_review(json.dumps({"verdict": "problems", "problems": [
        {}, {"sentence": "whole video", "what": "a"}, {"sentence": "all", "what": "b"},
        {"sentence": "ending", "kind": "end", "what": "c", "fix": "d"}, {"sentence": 0, "what": "e"},
        {"sentence": "sentence 4", "what": "f"}]}))[1]
    assert lines == ["whole video (problem): a", "all (problem): b", "ending (end): c Fix: d",
                     "whole video (problem): e", "S4 (problem): f"]


def test_hero_none_does_not_pass_without_a_central_gap(tmp_path):
    fake_voice(SCRIPT, tmp_path, None)
    words = words_of(tmp_path)
    cat = writer.catalog_text.load_catalog()
    def check(edit):
        return writer.storyboard_problems(writer.normalise_storyboard(Board(edit)(tmp_path)), words, cat)
    def none_gap(b, w):
        b["sentences"][1]["objects"].append({"missing": "x", "stand_in": "none", "central": False})
        b.update(hero="none")
    assert any('"hero"' in p for p in check(none_gap))
    assert any('"hero"' in p for p in check(lambda b, w: (none_gap(b, w), b.update(hero="NONE"))))


def test_articles_do_not_stop_a_short_text_from_matching():
    assert covers("The bulb", "Bulb") and covers("A bulb", "the bulb")
    assert covers("The", "The") and not covers("The", "bulb") and not covers("The bulb", "The")
    assert not covers("The bulb", "battery")
    assert covers("the tides of the moon", "tides moon")


def test_a_minus_sign_stays_with_its_number():
    assert writer._tokens("-40 °C") == ["-40", "deg"] and writer._tokens("\u221240") == ["-40"]
    assert writer._tokens("3-5") == ["3", "5"]
    assert covers("-40 °C", "-40 degrees") and not covers("-40 °C", "40 °C") and not covers("40 °C", "-40 °C")


def test_last_sentence_hint_has_no_backwards_range(tmp_path):
    fake_voice(SCRIPT, tmp_path, None)
    words = words_of(tmp_path)
    cat = writer.catalog_text.load_catalog()
    n = len(writer.sentences(words))
    def bad_end(b, w):
        s = b["sentences"][-1]
        s["texts"] = [{"words": "Bye", "starts": " ".join(x["text"] for x in writer.sentences(w)[-1][:2]),
                       "ends": "later"}]
    found = [p for p in writer.storyboard_problems(writer.normalise_storyboard(Board(bad_end)(tmp_path)), words, cat)
             if '"ends"' in p]
    assert found and f"({n + 1} to {n})" not in found[0] and "later sentence number" not in found[0]
    assert '"end"' in found[0]
    mid = [p for p in writer.storyboard_problems(writer.normalise_storyboard(Board(
        lambda b, w: b["sentences"][0].update(texts=[{"words": "Bye", "starts": writer.sentences(w)[0][0]["text"],
                                                      "ends": "later"}]))(tmp_path)), words, cat) if '"ends"' in p]
    assert mid and "later sentence number (2 to" in mid[0]


def test_show_prompt_explains_gaps_and_text_ends():
    system = writer.show_system_prompt()
    for phrase in ('draw the "stand_in" prop instead (if "stand_in" is none, draw nothing for it)',
                   'until the START of that sentence', 'the word "end"'):
        assert phrase in system, phrase


def test_review_sentence_label_odd_values_and_empty_what():
    def one(**p):
        return writer.parse_review(json.dumps({"verdict": "problems", "problems": [p]}))[1][0]
    assert one(sentence=3.0, what="bad") == "S3 (problem): bad"
    assert one(sentence=True, what="bad") == "whole video (problem): bad"
    assert one(what="", fix="do x") == "whole video (problem): Fix: do x"
    assert one(sentence="2", what="a", fix="b") == "S2 (problem): a Fix: b"


def test_text_of_only_filler_words_can_be_covered():
    assert covers("is", "is") and not covers("is", "bulb")


# ---------------------------------------------------------------- review round 2 fixes

def test_tokens_never_raise_on_odd_characters():
    import random
    assert writer._tokens("\u278a Battery") == ["\u278a", "battery"]
    writer._tokens("Step \u2776")
    writer._tokens("\u24ff")
    chars = [chr(c) for c in range(0x2776, 0x2794)] + ["\u24ea", "\u24ff", "\u00b2", "\u2082", "\u0663", "\u2163"]
    rng = random.Random(7)
    chars += [chr(rng.randrange(0x20, 0x3000)) for _ in range(3000)]
    chars = [c for c in chars if not 0xD800 <= ord(c) <= 0xDFFF]
    for c in chars:
        for text in (c, "5" + c, c + "5 " + c, "x " + c + " 2.5"):
            toks = writer._tokens(text)
            writer.text_covers(toks, writer._tokens("a 5 b"))
            writer.text_covers(writer._tokens("a 5 b"), toks)
            writer.split_hits(toks, [{"shot": 1, "text": text}])
    assert writer._tokens("\u00b2") is not None and writer._tokens("3.50") == ["3.5"]


def test_celsius_sign_folds_like_degrees():
    assert writer._tokens("20 \u2103") == writer._tokens("20 \u00b0C") == ["20", "deg"]


def test_scene_heading_for_a_sentence_with_no_scene(tmp_path):
    def edit(b, words):
        b["sentences"][0]["scene"] = ""
        b["sentences"][2]["scene"] = ""
    code, folder, fake = run_sb(tmp_path, {"storyboard": [Board(edit)], "storyboard-review": [REVIEW_PASS],
                                           "show": [good_show]})
    md = (folder / "storyboard.md").read_text(encoding="utf-8")
    assert code == 0 and "## Scene (not named)" in md and "## Scene \n" not in md and "## Scene 1" in md


def test_negative_or_zero_sentence_number_means_whole_video():
    def one(**p):
        return writer.parse_review(json.dumps({"verdict": "problems", "problems": [p]}))[1][0]
    assert one(sentence=-2, what="w") == "whole video (problem): w"
    assert one(sentence="-2", what="w") == "whole video (problem): w"
    assert one(sentence=0, what="w") == "whole video (problem): w"


def test_repair_after_an_unreadable_reply_shows_the_last_good_board(tmp_path):
    code, folder, fake = run_sb(tmp_path, {"storyboard": [Board()], "storyboard-review": [REVIEW_BAD, REVIEW_PASS],
                                           "storyboard-repair": ["BROKEN-REPLY-XYZ", Board()], "show": [good_show]},
                                  settings={"storyboard_repairs": 2})
    assert code == 0
    assert fake.purposes[4:6] == ["storyboard-repair1", "storyboard-repair2"]
    second = fake.calls[5].user
    assert "YOUR PREVIOUS STORYBOARD" in second and "BROKEN-REPLY-XYZ" not in second
    assert "What if the Moon vanished tonight?" in second


def test_null_storyboard_repairs_uses_the_default(tmp_path):
    code, folder, fake = run_sb(tmp_path, {"storyboard": [Board()], "storyboard-review": [REVIEW_PASS],
                                           "show": [good_show]}, settings={"storyboard_repairs": None})
    assert code == 0


def test_unreadable_repair_keeps_the_real_problems(tmp_path):
    code, folder, fake = run_sb(tmp_path, {"storyboard": [Board()], "storyboard-review": [REVIEW_BAD, REVIEW_PASS],
                                           "storyboard-repair": ["BROKEN", Board()], "show": [good_show]},
                                  settings={"storyboard_repairs": 2})
    second = fake.calls[5].user
    assert code == 0 and "the tides are not shown" in second and "your last reply could not be read" in second
    assert second.count("the reply is not valid JSON") == 1


def test_run_ending_after_unreadable_replies_lists_the_real_problems(tmp_path):
    code, folder, fake = run_sb(tmp_path, {"storyboard": [Board()], "storyboard-review": [REVIEW_BAD],
                                           "storyboard-repair": ["BROKEN", "BROKEN"]})
    err = json.loads((folder / "writer.json").read_text(encoding="utf-8"))["error"]
    assert code == 1 and "the tides are not shown" in err and "could not be read" in err


def test_huge_digit_strings_are_a_failed_round_not_a_crash(tmp_path):
    big = "9" * 5000
    def ends(b, w):
        b["sentences"][0]["texts"] = [{"words": "x", "starts": "what", "ends": big}]
    for reply in ('{"hook": ' + big + '}', Board(ends)):
        code, folder, fake = run_sb(tmp_path, {"storyboard": [reply], "storyboard-repair": ["BROKEN", "BROKEN"]})
        assert code == 1 and (folder / "storyboard.json").exists() and (folder / "storyboard.md").exists()
    bad = json.dumps({"verdict": "problems", "problems": [{"sentence": big, "what": "w"}]})
    assert writer.parse_review(bad)[1] == ["whole video (problem): w"]
    assert writer._ends(3.0) == 3 and writer._ends("S" + big) == "S" + big


def test_show_prompt_carries_the_repeat_the_label_rule(tmp_path):
    fake_voice(SCRIPT, tmp_path, None)
    p = writer.show_user_prompt("t", words_of(tmp_path), SCRIPT, None, writer.normalise_storyboard(Board()(tmp_path)))
    assert "repeat the same label or text at the start of the next shot" in p


# ---------------------------------------------------------------- code fixes and the code-check budget

SHORT_TEXT = lambda b, w: b["sentences"][1].update(texts=[{"words": "1/3", "starts": "a third", "ends": 3}])


def test_a_too_short_text_gets_a_later_end_in_code(tmp_path):
    fake_voice(SCRIPT, tmp_path, None)
    words = words_of(tmp_path)
    cat = writer.catalog_text.load_catalog()
    board = writer.normalise_storyboard(Board(SHORT_TEXT)(tmp_path))
    fixed = writer.fix_text_ends(board, words)
    assert len(fixed) == 1 and fixed[0].startswith('S2 text "1/3": "ends" 3 -> ')
    new = board["sentences"][1]["texts"][0]["ends"]
    assert new == "end" or new > 3
    assert not any("on screen only" in p for p in writer.storyboard_problems(board, words, cat))
    assert writer.fix_text_ends(board, words) == []                     # long enough now: nothing more to fix
    ok = writer.normalise_storyboard(Board()(tmp_path))
    assert writer.fix_text_ends(ok, words) == []


def test_text_end_fix_never_crowds_the_screen_with_a_third_text(tmp_path):
    fake_voice(SCRIPT, tmp_path, None)
    words = words_of(tmp_path)
    cat = writer.catalog_text.load_catalog()
    def crowd(b, w):
        b["sentences"][1]["texts"] = [{"words": "1/3", "starts": "a third", "ends": 3}]
        b["sentences"][2]["texts"] = [{"words": "wobble", "starts": "tilt would", "ends": "end"},
                                      {"words": "tilt", "starts": "wobble", "ends": "end"}]
    board = writer.normalise_storyboard(Board(crowd)(tmp_path))
    assert writer.fix_text_ends(board, words) == []                       # extending it would make 3 texts at once
    assert board["sentences"][1]["texts"][0]["ends"] == 3                 # nothing shortened or changed silently
    assert any("on screen only" in p for p in writer.storyboard_problems(board, words, cat))   # left for the repair budget
    # the same board with a free screen is still fixed
    board["sentences"][2]["texts"] = board["sentences"][2]["texts"][:1]
    assert len(writer.fix_text_ends(board, words)) == 1
    # three long texts together are reported as a code-check problem
    board["sentences"][2]["texts"] = [{"words": w, "starts": "tilt would", "ends": "end"} for w in ("a", "b", "c")]
    assert any("at the same time" in p for p in writer.storyboard_problems(board, words, cat))


def test_a_too_short_text_costs_no_repair_call(tmp_path):
    code, folder, fake = run_sb(tmp_path, {"storyboard": [Board(SHORT_TEXT)], "storyboard-review": [REVIEW_PASS],
                                           "show": [good_show], "repair": [good_show] * 3})
    # (the show misses the board's text, so show repairs follow; only the storyboard calls matter here)
    assert fake.purposes[2:5] == ["storyboard", "storyboard-review", "show"]
    saved = json.loads((folder / "storyboard.json").read_text(encoding="utf-8"))
    assert saved["sentences"][1]["texts"][0]["ends"] != 3               # the saved board has the fixed end


def test_code_check_problems_do_not_use_the_review_repair(tmp_path):
    def bad(b, words):
        b["sentences"][0]["objects"][0]["prop"] = "rockett"
    # Default storyboard_repairs (1): the code-check repair is free, so the reviewer's problems still get their round.
    code, folder, fake = run_sb(tmp_path, {"storyboard": [Board(bad)], "storyboard-repair": [Board(), Board()],
                                           "storyboard-review": [REVIEW_BAD, REVIEW_PASS], "show": [good_show]})
    assert code == 0
    assert fake.purposes[2:8] == ["storyboard", "storyboard-repair1", "storyboard-review", "storyboard-repair2",
                                  "storyboard-review", "show"]
    assert result(folder)["storyboard"]["repairs"] == 2


def test_zero_repairs_means_no_code_check_repair_either(tmp_path):
    def bad(b, words):
        b["sentences"][0]["objects"][0]["prop"] = "rockett"
    code, folder, fake = run_sb(tmp_path, {"storyboard": [Board(bad)]}, settings={"storyboard_repairs": 0})
    assert code == 1 and not [p for p in fake.purposes if p.startswith("storyboard-repair")]


def test_code_check_problems_have_a_capped_budget_of_their_own(tmp_path):
    def bad(b, words):
        b["sentences"][0]["objects"][0]["prop"] = "rockett"
    n = writer.CODE_CHECK_REPAIRS + 1                                   # then the one review repair is used too
    code, folder, fake = run_sb(tmp_path, {"storyboard": [Board(bad)], "storyboard-repair": [Board(bad)] * n})
    assert code == 1 and fake.purposes.count("storyboard-review") == 0
    assert fake.purposes.count(f"storyboard-repair{n}") == 1 and f"storyboard-repair{n + 1}" not in fake.purposes
    assert f"after {n} repair round(s)" in result(folder)["error"]
