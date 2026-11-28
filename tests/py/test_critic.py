"""The picture critic: frame grabbing, prompt, judge/repair/re-judge flow, files-mode waiting. No network, no ffmpeg."""
import json
from types import SimpleNamespace

import pytest

from pipeline import critic, llm, run, writer

WORDS = [{"text": t, "start": 0.2 * i, "end": 0.2 * i + 0.15} for i, t in
         enumerate(["Why", "ice?", "It", "floats.", "Wow", "really!"])]       # three sentences
TIMELINE = {"duration": 1.4, "shots": [{"id": "a", "start": 0, "end": 0.7}, {"id": "b", "start": 0.7, "end": 1.2},
                                       {"id": "late", "start": 1.3, "end": 1.4}]}


def fake_grab(video, t, dest):
    dest.write_bytes(b"jpg")


@pytest.fixture(autouse=True)
def patched(monkeypatch):
    monkeypatch.setattr(critic, "_grab", fake_grab)
    monkeypatch.setattr(critic.writer, "story_problems", lambda *a, **k: [])


def make_show(tmp_path):
    d = tmp_path / "shows" / "zz-c"
    (d / "out").mkdir(parents=True)
    (d / "words.json").write_text(json.dumps(WORDS))
    (d / "out" / "timeline.json").write_text(json.dumps(TIMELINE))
    (d / "show.json").write_text(json.dumps({"format": 1, "title": "T", "shots": ["old"]}))
    (d / "out" / "zz-c-final.mp4").write_text("v")
    return d


def reply(*fails):
    """A critic reply: sentences 1..3, those in fails fail; one failing transition when any sentence fails."""
    sents = [{"n": n, "verdict": "fail" if n in fails else "pass", "problems": ["the iceberg is a sphere"] if n in fails else []}
             for n in (1, 2, 3)]
    return json.dumps({"sentences": sents, "transitions": [{"n": 2, "verdict": "fail" if fails else "pass",
                                                             "problems": ["old label left over"] if fails else []}]})


class Fake:
    """complete(): answers from a queue by purpose and records every call."""

    def __init__(self, **answers):
        self.answers, self.calls = answers, []

    def __call__(self, system, user, *, purpose, max_tokens, images=()):
        self.calls.append(SimpleNamespace(system=system, user=user, purpose=purpose, images=list(images)))
        return SimpleNamespace(text=self.answers[purpose])


NEW_SHOW = json.dumps({"title": "T", "shots": ["new"]})
OK = lambda folder: {"ok": True, "errors": [], "warnings": []}


def test_sentences_split_on_end_marks_and_get_a_middle():
    s = critic.split_sentences(WORDS)
    assert [x["text"] for x in s] == ["Why ice?", "It floats.", "Wow really!"]
    assert s[0]["mid"] == round((0.0 + 0.35) / 2, 3) and s[1]["start"] == 0.4


def test_frames_one_per_sentence_and_one_per_shot_start(tmp_path):
    f = critic.grab_frames("v.mp4", WORDS, TIMELINE, tmp_path / "c")
    assert [x["image"] for x in f["sentences"]] == ["s01.jpg", "s02.jpg", "s03.jpg"]
    assert [(x["shot"], x["image"]) for x in f["sentences"]] == [("a", "s01.jpg"), ("a", "s02.jpg"), ("b", "s03.jpg")]
    # shot 3 starts at 1.3 s, +0.15 s is past the 1.4 s end of the video: no frame
    assert [(t["shot"], t["t"]) for t in f["transitions"]] == [("a", 0.15), ("b", 0.85)]
    assert sorted(p.name for p in (tmp_path / "c").glob("*.jpg")) == ["s01.jpg", "s02.jpg", "s03.jpg", "t01.jpg", "t02.jpg"]


def test_prompt_has_the_six_rules_and_the_owner_notes():
    system = critic.system_prompt()
    for rule in ("1. MATCH", "2. REAL THING", "3. CHANGE", "4. PHYSICAL", "5. SIZE", "6. CLEAN", "TRANSITION"):
        assert rule in system
    assert "{{" not in system
    for note in writer.read_prompt("critic_rubric_notes.md").strip().splitlines():
        assert note in system
    assert "thermometer" in system and "orbiting camera" in system and "water box or cube" in system


def test_reply_parsing_is_strict_about_shape_but_fills_gaps():
    f = {"sentences": [{"n": 1}, {"n": 2}], "transitions": [{"n": 1}]}
    r = critic.parse_reply('```json\n{"sentences": [{"n": 2, "verdict": "FAIL", "problems": []}]}\n```', f)
    assert [x["verdict"] for x in r["sentences"]] == ["pass", "fail"] and r["sentences"][1]["problems"] == ["(no reason given)"]
    assert r["transitions"] == [{"n": 1, "verdict": "pass", "problems": []}]
    with pytest.raises(writer.BadReply):
        critic.parse_reply('{"x": 1}', f)


def test_pass_means_one_call_and_no_repair(tmp_path):
    d, fake, rebuilt = make_show(tmp_path), Fake(critic=reply()), []
    state = critic.critic_step(d, d / "out" / "zz-c-final.mp4", fake, OK, lambda: rebuilt.append(1))
    assert [c.purpose for c in fake.calls] == ["critic"] and rebuilt == []
    assert len(fake.calls[0].images) == 5 and fake.calls[0].images[0].name == "s01.jpg"
    assert "IMAGE 1 = sentence 1" in fake.calls[0].user and "IMAGE 4 = transition 1" in fake.calls[0].user
    saved = json.loads((d / "out" / "critic" / "critic.json").read_text())
    assert saved["done"] and not saved["repaired"] and state["before"]["sentences"][0]["verdict"] == "pass"
    assert json.loads((d / "show.json").read_text())["shots"] == ["old"]


def test_fail_means_one_repair_a_rebuild_and_a_second_look(tmp_path):
    d, rebuilt = make_show(tmp_path), []
    fake = Fake(critic=reply(2), **{"critic-repair": NEW_SHOW, "critic-after": reply()})
    state = critic.critic_step(d, d / "out" / "zz-c-final.mp4", fake, OK, lambda: rebuilt.append(1))
    assert [c.purpose for c in fake.calls] == ["critic", "critic-repair", "critic-after"] and rebuilt == [1]
    repair = fake.calls[1]
    assert "S2 \"It floats.\": the iceberg is a sphere" in repair.user and "old label left over" in repair.user
    assert "thermometer" in repair.user and "PROPS" in repair.system                      # notes and the show catalogue
    assert json.loads((d / "show.json").read_text())["shots"] == ["new"]
    assert json.loads((d / "out" / "critic" / "show.before.json").read_text())["shots"] == ["old"]
    assert state["repaired"] and not critic.failed(state["after"])
    lines = "\n".join(critic.review_lines(state))
    assert "before repair: 1 of 3 sentences failed: S2: the iceberg is a sphere" in lines
    assert "after one repair: 0 of 3 sentences failed: none" in lines


def test_a_repair_the_checker_rejects_is_undone_and_nothing_is_rebuilt(tmp_path):
    d, rebuilt = make_show(tmp_path), []
    fake = Fake(critic=reply(1), **{"critic-repair": NEW_SHOW})
    state = critic.critic_step(d, d / "out" / "zz-c-final.mp4", fake, lambda f: {"ok": False, "errors": [{}]},
                               lambda: rebuilt.append(1))
    assert [c.purpose for c in fake.calls] == ["critic", "critic-repair"] and rebuilt == []
    assert json.loads((d / "show.json").read_text())["shots"] == ["old"] and "kept the earlier show" in state["repair_note"]
    assert "not applied" in "\n".join(critic.review_lines(state))


def test_repairs_zero_judges_only(tmp_path):
    d = make_show(tmp_path)
    fake = Fake(critic=reply(1))
    critic.critic_step(d, d / "out" / "zz-c-final.mp4", fake, OK, lambda: 1 / 0, repairs=0)
    assert [c.purpose for c in fake.calls] == ["critic"]


# ---- files mode: the critic waits for its reply files like the other steps

def test_files_mode_waits_then_resumes_through_repair_and_rebuild(tmp_path):
    d, rebuilt = make_show(tmp_path), []
    final = d / "out" / "zz-c-final.mp4"

    def go():                       # every run of the command makes a new FilesLlm, like a new process
        return critic.critic_step(d, final, llm.FilesLlm(d).complete, OK, lambda: rebuilt.append(1))

    def answer(name, text):
        (d / "llm" / f"{name}.reply.md").write_text(text, encoding="utf-8")

    with pytest.raises(llm.WaitingForReply):
        go()
    prompt = (d / "llm" / "01-critic.prompt.md").read_text(encoding="utf-8")
    assert "=== IMAGES" in prompt and "s01.jpg" in prompt and "t02.jpg" in prompt and "1. MATCH" in prompt
    answer("01-critic", reply(3))
    with pytest.raises(llm.WaitingForReply):
        go()
    assert (d / "llm" / "02-critic-repair.prompt.md").exists()
    answer("02-critic-repair", NEW_SHOW)
    with pytest.raises(llm.WaitingForReply):
        go()
    assert rebuilt == [1] and (d / "llm" / "03-critic-after.prompt.md").exists()
    answer("03-critic-after", reply())
    state = go()
    assert state["done"] and state["repaired"]       # rebuild() ran on each resume; the real steps skip when fresh


# ---- the run.py step

def settings(**kw):
    return dict({"llm_mode": "files", "critic": True, "critic_repairs": 1}, **kw)


def test_the_critic_step_sits_between_qa_and_review():
    assert run.STEPS[run.STEPS.index("qa") + 1: run.STEPS.index("review")] == ["critic"]


def test_critic_false_skips_the_step(tmp_path):
    s = run.Show("zz-c", "T", SimpleNamespace(llm=None), settings(critic=False), root=tmp_path)
    assert s.step_critic() == "skipped (critic: false)"
    assert s.step_review() == "done" and "Picture critic" not in s.review.read_text(encoding="utf-8")


def test_run_step_waits_with_exit_4_then_finishes_and_writes_the_review_block(tmp_path, monkeypatch):
    d = make_show(tmp_path)
    monkeypatch.setattr(run.Show, "step_qa", lambda self: "done")
    monkeypatch.setattr(writer, "validate_show", OK)
    s = run.Show("zz-c", "T", SimpleNamespace(llm=None), settings(), root=tmp_path)
    with pytest.raises(run.WaitingForReply):
        s.step_critic()
    (d / "llm" / "01-critic.reply.md").write_text(reply(1), encoding="utf-8")
    s2 = run.Show("zz-c", "T", SimpleNamespace(llm=None), settings(critic_repairs=0), root=tmp_path)
    assert s2.step_critic() == "done" and s2.step_critic() == "skipped"
    s2.step_review()
    text = s2.review.read_text(encoding="utf-8")
    assert "Picture critic, before repair: 1 of 3 sentences failed: S1: the iceberg is a sphere" in text


def test_from_step_critic_rerun_resumes_instead_of_starting_over(tmp_path, monkeypatch):
    d = make_show(tmp_path)
    for name in ("step_timeline", "step_render", "step_mix", "step_qa"):
        monkeypatch.setattr(run.Show, name, lambda self: "done")
    monkeypatch.setattr(writer, "validate_show", OK)

    def go():                       # the same command each time, with --from-step critic
        s = run.Show("zz-c", "T", SimpleNamespace(llm=None), settings(), root=tmp_path)
        s.forced = True
        return s.step_critic()

    def answer(name, text):
        (d / "llm" / f"{name}.reply.md").write_text(text, encoding="utf-8")

    for name, text in (("01-critic", reply(1)), ("02-critic-repair", NEW_SHOW)):
        with pytest.raises(run.WaitingForReply):
            go()
        answer(name, text)
    with pytest.raises(run.WaitingForReply):
        go()
    answer("03-critic-after", reply())
    assert go() == "done"
    cdir = d / "out" / "critic"
    assert json.loads((cdir / "show.before.json").read_text())["shots"] == ["old"]   # not the repaired show
    assert json.loads((d / "show.json").read_text())["shots"] == ["new"]
    assert json.loads((cdir / "critic.json").read_text())["calls"] == 3


def test_a_rejected_repair_keeps_the_show_mtime(tmp_path):
    d = make_show(tmp_path)
    before = (d / "show.json").stat().st_mtime_ns
    critic.critic_step(d, d / "out" / "zz-c-final.mp4", Fake(critic=reply(1), **{"critic-repair": NEW_SHOW}),
                       lambda f: {"ok": False, "errors": [{}]}, lambda: 1 / 0)
    assert (d / "show.json").stat().st_mtime_ns == before


def test_a_worse_repair_is_rolled_back_and_rebuilt_again(tmp_path):
    d, rebuilt = make_show(tmp_path), []
    fake = Fake(critic=reply(1), **{"critic-repair": NEW_SHOW, "critic-after": reply(1, 2)})
    state = critic.critic_step(d, d / "out" / "zz-c-final.mp4", fake, OK, lambda: rebuilt.append(1))
    assert rebuilt == [1, 1] and json.loads((d / "show.json").read_text())["shots"] == ["old"]
    assert "more sentences failed" in state["rolled_back"] and state["done"]
    assert "rolled back" in "\n".join(critic.review_lines(state))


def test_a_failing_qa_after_the_repair_rolls_it_back(tmp_path):
    d, rebuilt = make_show(tmp_path), []
    fake = Fake(critic=reply(1), **{"critic-repair": NEW_SHOW, "critic-after": reply()})
    state = critic.critic_step(d, d / "out" / "zz-c-final.mp4", fake, OK, lambda: rebuilt.append(1),
                               qa_ok=lambda: len(rebuilt) == 0)
    assert rebuilt == [1, 1] and state["rolled_back"] == "the picture check failed"
    assert json.loads((d / "show.json").read_text())["shots"] == ["old"]


def test_qa_fail_before_the_critic_skips_it_with_no_call(tmp_path):
    d = make_show(tmp_path)
    fake = Fake()
    state = critic.critic_step(d, d / "out" / "zz-c-final.mp4", fake, OK, lambda: 1 / 0, qa_ok=lambda: False)
    assert fake.calls == [] and state["done"] and "skipped" in "\n".join(critic.review_lines(state))


def test_a_failed_transition_alone_triggers_a_repair(tmp_path):
    d = make_show(tmp_path)
    only_transition = json.dumps({"sentences": [{"n": n, "verdict": "pass", "problems": []} for n in (1, 2, 3)],
                                  "transitions": [{"n": 1, "verdict": "fail", "problems": ["jump"]}]})
    fake = Fake(critic=only_transition, **{"critic-repair": NEW_SHOW, "critic-after": reply()})
    critic.critic_step(d, d / "out" / "zz-c-final.mp4", fake, OK, lambda: None)
    assert [c.purpose for c in fake.calls] == ["critic", "critic-repair", "critic-after"]


def test_a_failed_rebuild_after_repair_rolls_back_and_a_failed_rollback_rebuild_raises(tmp_path):
    d, n = make_show(tmp_path), []

    def flaky(fail_calls):
        def rb():
            n.append(1)
            if len(n) in fail_calls:
                raise run.StepFailed("render broke")
        return rb
    fake = Fake(critic=reply(1), **{"critic-repair": NEW_SHOW})
    state = critic.critic_step(d, d / "out" / "zz-c-final.mp4", fake, OK, flaky({1}))
    assert len(n) == 2 and "render broke" in state["rolled_back"] and state["done"]
    assert json.loads((d / "show.json").read_text())["shots"] == ["old"]
    d2, n[:] = make_show(tmp_path / "b"), []
    fake = Fake(critic=reply(1), **{"critic-repair": NEW_SHOW})
    with pytest.raises(run.StepFailed):
        critic.critic_step(d2, d2 / "out" / "zz-c-final.mp4", fake, OK, flaky({1, 2}))
    saved = json.loads((d2 / "out" / "critic" / "critic.json").read_text())
    assert "rolled_back" not in saved and "render broke" in saved["rollback_reason"]


def test_more_failed_transitions_count_as_worse(tmp_path):
    d, rebuilt = make_show(tmp_path), []
    after = json.dumps({"sentences": [{"n": n, "verdict": "fail" if n == 1 else "pass", "problems": ["x"] if n == 1 else []}
                                      for n in (1, 2, 3)],
                        "transitions": [{"n": k, "verdict": "fail", "problems": ["jump"]} for k in (1, 2)]})
    fake = Fake(critic=reply(1), **{"critic-repair": NEW_SHOW, "critic-after": after})
    state = critic.critic_step(d, d / "out" / "zz-c-final.mp4", fake, OK, lambda: rebuilt.append(1))
    assert "rolled_back" in state and json.loads((d / "show.json").read_text())["shots"] == ["old"]


def test_from_step_writer_clears_the_old_critic_state(tmp_path, monkeypatch):
    d = make_show(tmp_path)
    (d / "out" / "critic").mkdir()
    (d / "out" / "critic" / "show.before.json").write_text("{}")
    for name in run.STEPS:
        monkeypatch.setattr(run.Show, "step_" + name, lambda self: "done")
    run.Show("zz-c", "T", SimpleNamespace(llm=None), settings(), root=tmp_path).run("writer")
    assert not (d / "out" / "critic").exists()


def test_a_bad_critic_reply_is_not_done_and_the_fixed_reply_is_read_on_rerun(tmp_path):
    d = make_show(tmp_path)
    final = d / "out" / "zz-c-final.mp4"
    (d / "llm").mkdir()
    (d / "llm" / "01-critic.reply.md").write_text("not json", encoding="utf-8")
    state = critic.critic_step(d, final, llm.FilesLlm(d).complete, OK, lambda: 1 / 0)
    assert not state.get("done") and state["error"]
    assert "could not be read" in "\n".join(critic.review_lines(state))
    (d / "llm" / "01-critic.reply.md").write_text(reply(), encoding="utf-8")
    state = critic.critic_step(d, final, llm.FilesLlm(d).complete, OK, lambda: 1 / 0)
    assert state["done"] and "error" not in state and state["calls"] == 1


# ---- image support in the api call (mocked), the storyboard's catalogue lines, the needs-props build plan

def test_api_call_sends_images_as_base64_blocks_before_the_text(tmp_path):
    (tmp_path / "a.jpg").write_bytes(b"\xff\xd8abc")
    seen = {}

    class Client:
        class messages:
            @staticmethod
            def create(**kw):
                seen.update(kw)
                u = SimpleNamespace(input_tokens=5, output_tokens=2)
                return SimpleNamespace(stop_reason="end_turn", content=[SimpleNamespace(type="text", text="{}")], usage=u)

    llm.ApiLlm(client=Client).complete("sys", "look", purpose="critic", max_tokens=10, images=[tmp_path / "a.jpg"])
    blocks = seen["messages"][0]["content"]
    assert blocks[0]["type"] == "image" and blocks[0]["source"]["media_type"] == "image/jpeg"
    assert blocks[0]["source"]["data"] == "/9hhYmM=" and blocks[-1] == {"type": "text", "text": "look"}
    llm.ApiLlm(client=Client).complete("sys", "plain", purpose="show", max_tokens=10)
    assert seen["messages"][0]["content"] == "plain"                   # no images: unchanged


def test_storyboard_prompt_carries_the_full_prop_lines():
    from pipeline import catalog_text
    cat = catalog_text.load_catalog()
    text = catalog_text.props_text(cat)
    for name, p in cat["props"].items():
        line = next(l for l in text.splitlines() if l.startswith(f"- {name} "))
        assert "inside:" in line and (not p.get("animatable") or "anim:" in line), name
    assert any("notes:" in l for l in text.splitlines())
    system = writer.fill(writer.read_prompt("storyboard_system.md"), CATALOG=text, TEXT_SECONDS="2.5", TAIL="2.5")
    assert "{{" not in system and "inside:" in system and "ENVIRONMENTS" in system


def test_needs_props_has_a_build_plan_per_central_gap(tmp_path):
    gap = {"missing": "a tilting scale", "stand_in": "none", "central": True, "look": "brass pans on a beam",
           "stands_for": "the balance", "params": "tilt -30..30", "must_change": "the beam tilts as the left pan fills",
           "prop": "", "place": ""}
    gaps = [(2, gap), (4, dict(gap, look="")), (5, dict(gap, missing="side gadget", central=False))]
    words_ = [{"text": t, "start": float(i), "end": i + 0.5} for i, t in enumerate(["One.", "Two.", "Three.", "Four.", "Five."])]
    plans = writer.gap_plans(gaps, words_)
    assert len(plans) == 1 and plans[0]["sentences"] == [(2, "Two."), (4, "Four.")]
    r = writer.Run("topic", "zz", tmp_path, writer.DEFAULTS, "files")
    r.gap_plans = plans
    writer.write_needs_props(r)
    text = (tmp_path / "NEEDS-PROPS.md").read_text(encoding="utf-8")
    for need in ("### a tilting scale", "Must look like: brass pans on a beam", "Params it needs: tilt -30..30",
                 "Must be able to change: the beam tilts as the left pan fills", "S2: Two.", "S4: Four.", "owner approves"):
        assert need in text, need
    assert "side gadget" not in text
