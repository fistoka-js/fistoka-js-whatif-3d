import datetime
import json

from pipeline.queue import Queue, slugify


def test_slugify():
    assert slugify("What if the Moon disappeared?") == "what-if-the-moon-disappeared"
    assert slugify("???") == "topic"
    assert len(slugify("word " * 30)) <= 40


def test_add_and_duplicates(tmp_path):
    q = Queue(tmp_path)
    assert q.add("What if the Moon disappeared?") == "what-if-the-moon-disappeared"
    assert q.add("what if the moon disappeared") is None          # same topic, other punctuation
    data = json.loads(q.path("pending", "what-if-the-moon-disappeared").read_text())
    assert set(data) == {"topic", "added", "notes"}


def test_oldest_first(tmp_path):
    q = Queue(tmp_path)
    q.add("Newer topic", today=datetime.date(2026, 2, 1))
    q.add("Older topic", today=datetime.date(2026, 1, 1))
    assert [s for s, _ in q.pending()] == ["older-topic", "newer-topic"]


def test_move_through_folders(tmp_path):
    q = Queue(tmp_path)
    slug = q.add("A topic")
    q.claim(slug)
    assert q.count("pending") == 0 and q.count("in-progress") == 1
    q.release(slug)
    assert q.count("pending") == 1
    q.claim(slug)
    q.finish(slug, "failed", "boom", "last lines")
    data = json.loads(q.path("failed", slug).read_text())
    assert data["reason"] == "boom" and data["log_tail"] == "last lines"
    assert q.count("in-progress") == 0


def test_bad_file_is_skipped(tmp_path):
    q = Queue(tmp_path)
    (tmp_path / "pending" / "junk.json").write_text("{not json")
    q.add("Good one")
    assert [s for s, _ in q.pending()] == ["good-one"]
