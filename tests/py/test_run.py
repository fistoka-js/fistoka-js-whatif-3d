"""Runner tests: every external command and the upload are faked."""
import json

import pytest

from pipeline import run, upload
from pipeline.queue import Queue


@pytest.fixture
def env(tmp_path, monkeypatch):
    (tmp_path / "settings.yaml").write_text('channel_id: "UCgood"\nllm_mode: files\n')
    q = Queue(tmp_path / "queue")
    calls = []
    behaviour = {"writer": 0, "render": 0}

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
                (d / "writer.json").write_text(json.dumps({"title": "Title " + slug, "description": "d", "tags": ["t"], "status": "ok"}))
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
            (tmp_path / "shows" / out_slug / "out" / "qa.json").write_text(json.dumps(
                {"result": "pass", "findings": [], "measured": {"video": {"videoSeconds": 50.0, "lufs": -16.0}}}))
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
