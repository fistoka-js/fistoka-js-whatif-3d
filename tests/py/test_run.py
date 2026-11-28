"""Runner tests: every external command and the upload are faked."""
import json

import pytest

from pipeline import run, upload
from pipeline.queue import Queue


@pytest.fixture
def env(tmp_path, monkeypatch):
    (tmp_path / "settings.yaml").write_text('channel_id: "UCgood"\nllm_mode: files\ncritic: false\n')   # the critic has its own tests (test_critic.py)
    q = Queue(tmp_path / "queue")
    calls = []
    behaviour = {"writer": 0, "render": 0, "status": "ok"}

    def fake(cmd, log, cwd=None):
        cmd = [str(c) for c in cmd]
        calls.append(cmd)
        joined = " ".join(cmd)
        slug = cmd[cmd.index("--slug") + 1] if "--slug" in cmd else None
        if "pipeline.writer" in joined:
            if behaviour["writer"] == 0:
                d = tmp_path / "shows" / slug
                d.mkdir(parents=True, exist_ok=True)
                for n in ("voice.mp3", "words.json", "show.json"):
                    (d / n).write_text("x")
                w = {"title": "Title " + slug, "description": "d", "tags": ["t"], "status": behaviour["status"]}
                if behaviour["status"] == "fallback":
                    w["fallback_note"] = "fallback: not good enough to publish"
                (d / "writer.json").write_text(json.dumps(w))
            return behaviour["writer"]
        if "validate.mjs" in joined:
            return 0
        out_slug = cmd[-1].replace("shows/", "") if "timeline.mjs" in joined else cmd[2] if "render.mjs" in joined or "qa.mjs" in joined else None
        if "timeline.mjs" in joined:
            (tmp_path / "shows" / out_slug / "out").mkdir(parents=True, exist_ok=True)
            (tmp_path / "shows" / out_slug / "out" / "timeline.json").write_text("{}")
        elif "render.mjs" in joined:
            if behaviour["render"]:
                return behaviour["render"]
            (tmp_path / "shows" / out_slug / "out" / f"{out_slug}.mp4").write_text("v")
        elif "pipeline.mix" in joined:
            open(cmd[cmd.index("--out") + 1], "w").write("final")
        elif "qa.mjs" in joined:
            if behaviour.get("qa_crash"):
                return 1                 # like a crash of qa.mjs: exit 1 and no qa.json written
            (tmp_path / "shows" / out_slug / "out" / "qa.json").write_text(json.dumps(
                {"result": "pass", "findings": [], "measured": {"video": {"videoSeconds": 50.0, "lufs": -16.0, "file": cmd[cmd.index("--video") + 1]}}}))
        return 0

    uploads = []

    def fake_upload(video, title, desc, tags, settings, **kw):
        uploads.append(title)
        return upload_result.pop(0) if upload_result else "VID"

    upload_result = []
    monkeypatch.setattr(run, "run_cmd", fake)
    monkeypatch.setattr(upload, "upload_video", fake_upload)
    return tmp_path, q, calls, behaviour, uploads


def go(tmp_path, *args):
    return run.main(list(args), root=tmp_path)


def count(calls, word):
    return sum(1 for c in calls if any(word in x for x in c))


def test_happy_path_and_resume(env):
    root, q, calls, beh, uploads = env
    q.add("Topic one")
    assert go(root, "--no-upload") == run.EXIT_OK
    assert q.count("done") == 1 and q.count("pending") == 0
    final = root / "shows" / "topic-one" / "out" / "topic-one-final.mp4"
    assert final.exists()
    assert "Pipeline run" in (root / "shows" / "topic-one" / "review.md").read_text()
    assert uploads == []
    # run again for the same slug: every step is skipped, nothing is re-run
    n = len(calls)
    assert go(root, "--topic", "Topic one", "--slug", "topic-one", "--no-upload") == run.EXIT_OK
    assert len(calls) == n


def test_failure_resumes_at_failed_step(env):
    root, q, calls, beh, uploads = env
    q.add("Topic one")
    beh["render"] = 1
    assert go(root, "--no-upload") == run.EXIT_FAILED
    failed = json.loads(q.path("failed", "topic-one").read_text())
    assert "render" in failed["reason"] and "log_tail" in failed
    beh["render"] = 0
    writer_calls = count(calls, "pipeline.writer")
    assert go(root, "--topic", "Topic one", "--slug", "topic-one", "--no-upload") == run.EXIT_OK
    assert count(calls, "pipeline.writer") == writer_calls       # writer not run again


def test_needs_props_then_next_topic(env):
    root, q, calls, beh, uploads = env
    q.add("Topic one", today=__import__("datetime").date(2026, 1, 1))
    q.add("Topic two", today=__import__("datetime").date(2026, 1, 2))
    orig = run.run_cmd

    def writer_3_first(cmd, log, cwd=None):
        if "pipeline.writer" in " ".join(map(str, cmd)) and "topic-one" in map(str, cmd):
            return 3
        return orig(cmd, log, cwd)
    run.run_cmd = writer_3_first
    try:
        assert go(root, "--no-upload") == run.EXIT_OK
    finally:
        run.run_cmd = orig
    assert q.count("needs-props") == 1 and q.count("done") == 1


def test_at_most_three_topics(env):
    root, q, calls, beh, uploads = env
    for i in range(5):
        q.add(f"Topic {i}")
    assert go(root, "--no-upload") == run.EXIT_OK
    assert q.count("done") == 3 and q.count("pending") == 2


def test_files_mode_waits_and_resumes(env):
    root, q, calls, beh, uploads = env
    q.add("Topic one")
    beh["writer"] = 4
    assert go(root, "--no-upload") == run.EXIT_WAITING
    assert q.count("in-progress") == 1 and q.count("failed") == 0
    beh["writer"] = 0
    assert go(root, "--no-upload") == run.EXIT_OK                  # same command resumes the in-progress topic
    assert q.count("done") == 1


def test_empty_queue(env):
    root, *_ = env
    assert go(root) == run.EXIT_EMPTY


def test_upload_happens_once(env):
    root, q, calls, beh, uploads = env
    q.add("Topic one")
    assert go(root) == run.EXIT_OK
    assert uploads == ["Title topic-one"]
    assert (root / "shows" / "topic-one" / "upload.json").exists()
    assert go(root, "--topic", "Topic one", "--slug", "topic-one") == run.EXIT_OK
    assert len(uploads) == 1


def test_guard_refusal_puts_topic_back(env, monkeypatch):
    root, q, calls, beh, uploads = env

    def refuse(*a, **k):
        raise upload.ChannelGuardError("wrong channel")
    monkeypatch.setattr(upload, "upload_video", refuse)
    q.add("Topic one")
    assert go(root) == run.EXIT_GUARD
    assert q.count("pending") == 1 and q.count("failed") == 0


def test_fallback_show_fails_the_topic_and_is_never_rendered(env):
    root, q, calls, beh, uploads = env
    beh["status"] = "fallback"
    q.add("Topic one")
    assert go(root) == run.EXIT_FAILED
    failed = json.loads(q.path("failed", "topic-one").read_text())
    assert "fallback: not good enough to publish" in failed["reason"]
    assert count(calls, "render.mjs") == 0 and uploads == []
    # A later run (writer.json already says fallback, so the writer step is skipped) still refuses it.
    assert go(root, "--topic", "Topic one", "--slug", "topic-one") == run.EXIT_FAILED
    assert count(calls, "render.mjs") == 0 and uploads == []


def test_allow_fallback_renders_but_upload_still_refuses(env):
    root, q, calls, beh, uploads = env
    beh["status"] = "fallback"
    q.add("Topic one")
    assert go(root, "--allow-fallback", "--no-upload") == run.EXIT_OK      # local test: rendered
    assert count(calls, "render.mjs") == 1
    assert go(root, "--topic", "Topic one", "--slug", "topic-one", "--allow-fallback") == run.EXIT_FAILED
    assert uploads == []
    assert not (root / "shows" / "topic-one" / "upload.json").exists()


def test_upload_refuses_a_writer_json_with_a_fallback_note(env):
    root, q, calls, beh, uploads = env
    q.add("Topic one")
    assert go(root, "--no-upload") == run.EXIT_OK
    w = root / "shows" / "topic-one" / "writer.json"
    w.write_text(json.dumps(dict(json.loads(w.read_text()), fallback_note="fallback: not good enough to publish")))
    assert go(root, "--topic", "Topic one", "--slug", "topic-one") == run.EXIT_FAILED
    assert uploads == []


def test_writer_qa_not_run_needs_a_fresh_passing_final_check(env):
    import os
    root, q, calls, beh, uploads = env
    q.add("Topic one")
    assert go(root, "--no-upload") == run.EXIT_OK
    d = root / "shows" / "topic-one"
    w = d / "writer.json"
    w.write_text(json.dumps(dict(json.loads(w.read_text()), qa_not_run=True)))
    # The final check of this video crashes (no new qa.json): the old passing qa.json is older than the video.
    qa_json, final = d / "out" / "qa.json", d / "out" / "topic-one-final.mp4"
    os.utime(qa_json, (final.stat().st_mtime - 100, final.stat().st_mtime - 100))
    beh["qa_crash"] = True
    assert go(root, "--topic", "Topic one", "--slug", "topic-one") == run.EXIT_FAILED
    assert uploads == []
    # A fresh, passing final check lets it out.
    beh["qa_crash"] = False
    assert go(root, "--topic", "Topic one", "--slug", "topic-one") == run.EXIT_OK
    assert uploads == ["Title topic-one"]


def test_upload_needs_a_fresh_passing_final_check_even_without_the_qa_not_run_flag(env):
    import os
    root, q, calls, beh, uploads = env
    q.add("Topic one")
    assert go(root, "--no-upload") == run.EXIT_OK
    d = root / "shows" / "topic-one"
    assert not json.loads((d / "writer.json").read_text()).get("qa_not_run")     # the writer's own check is not flagged
    qa_json, final = d / "out" / "qa.json", d / "out" / "topic-one-final.mp4"
    beh["qa_crash"] = True                                                          # qa.mjs crashes: exit 1, writes nothing
    os.utime(qa_json, (final.stat().st_mtime - 100, final.stat().st_mtime - 100))   # stale passing qa.json
    assert go(root, "--topic", "Topic one", "--slug", "topic-one") == run.EXIT_FAILED
    qa_json.unlink()                                                                # and no qa.json at all
    assert go(root, "--topic", "Topic one", "--slug", "topic-one") == run.EXIT_FAILED
    assert uploads == []
    beh["qa_crash"] = False
    assert go(root, "--topic", "Topic one", "--slug", "topic-one") == run.EXIT_OK   # a new, passing check lets it out
    assert uploads == ["Title topic-one"]


def _gate_show(tmp_path, monkeypatch, qa, age=0):
    """A Show with a final video, writer.json and (optionally) a qa.json `qa`; upload is faked. age > 0 makes qa.json older."""
    import os
    from types import SimpleNamespace
    d = tmp_path / "shows" / "s"
    (d / "out").mkdir(parents=True)
    (d / "writer.json").write_text(json.dumps({"title": "T", "qa_not_run": True}))
    sh = run.Show("s", "topic", SimpleNamespace(no_upload=False), {}, root=tmp_path)
    sh.final.write_text("v")
    if qa is not None:
        sh.qa_json.write_text(json.dumps(qa))
        t = sh.final.stat().st_mtime + (5 if not age else -age)
        os.utime(sh.qa_json, (t, t))
    sent = []
    monkeypatch.setattr(upload, "upload_video", lambda *a, **k: sent.append(a[0]) or "VID")
    return sh, sent


def test_step_upload_gate_refuses_stale_missing_and_wrong_video_qa(tmp_path, monkeypatch):
    for qa, age in [({"result": "pass", "measured": {"video": {"file": "x"}}}, 100), (None, 0)]:     # stale / missing
        sh, sent = _gate_show(tmp_path / f"a{age}", monkeypatch, qa, age)
        with pytest.raises(run.StepFailed):
            sh.step_upload()
        assert sent == []
    # fresh and passing, but it never looked at the final video (no video file, or another one)
    for measured in ({}, {"video": {"file": str(tmp_path / "other.mp4")}}):
        sh, sent = _gate_show(tmp_path / f"b{len(measured)}", monkeypatch, {"result": "pass", "measured": measured})
        with pytest.raises(run.StepFailed):
            sh.step_upload()
        assert sent == []


def test_step_upload_gate_lets_a_fresh_pass_on_the_final_video_out(tmp_path, monkeypatch):
    sh, sent = _gate_show(tmp_path, monkeypatch, None)
    sh.qa_json.write_text(json.dumps({"result": "warn", "measured": {"video": {"file": str(sh.final)}}}))
    assert sh.step_upload() == "done" and len(sent) == 1


def test_review_reports_qa_not_run(tmp_path, monkeypatch):
    sh, _ = _gate_show(tmp_path, monkeypatch, {"result": "pass", "measured": {}})
    sh.step_review()
    assert "could not run" in sh.review.read_text(encoding="utf-8")


def test_from_step_forces_rerun(env):
    root, q, calls, beh, uploads = env
    q.add("Topic one")
    go(root, "--no-upload")
    n = count(calls, "render.mjs")
    go(root, "--topic", "Topic one", "--slug", "topic-one", "--no-upload", "--from-step", "render")
    assert count(calls, "render.mjs") == n + 1


def test_music_pick_needs_ledger(tmp_path):
    (tmp_path / "a.mp3").write_text("x")
    assert run.pick_music("s", tmp_path) is None
    (tmp_path / "LEDGER.csv").write_text("file,title\nb.mp3,x\n")
    assert run.pick_music("s", tmp_path) is None            # a.mp3 has no row
    (tmp_path / "LEDGER.csv").write_text("file,title\na.mp3,x\n")
    assert run.pick_music("s", tmp_path).name == "a.mp3"
