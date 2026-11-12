"""The topic queue: plain JSON files moved between folders under queue/.

pending -> in-progress -> done | failed | needs-props.
A topic file is {"topic": "...", "added": "YYYY-MM-DD", "notes": ""}.
The file name is the show slug (shows/<slug>/), so it is also the resume key.
"""
import datetime
import json
import re
import unicodedata
from pathlib import Path

FOLDERS = ("pending", "in-progress", "done", "failed", "needs-props")
MAX_SLUG = 40


def slugify(topic):
    """ASCII words joined by hyphens, at most 40 chars, cut at a hyphen when possible."""
    text = unicodedata.normalize("NFKD", topic).encode("ascii", "ignore").decode().lower()
    slug = "-".join(re.findall(r"[a-z0-9]+", text))
    if len(slug) > MAX_SLUG:
        cut = slug[:MAX_SLUG]
        if slug[MAX_SLUG] != "-" and "-" in cut:
            cut = cut[: cut.rfind("-")]
        slug = cut.rstrip("-")
    return slug or "topic"


def _key(text):
    return " ".join(re.sub(r"[^\w\s]", "", text.lower()).split())


class Queue:
    def __init__(self, root):
        self.root = Path(root)
        for f in FOLDERS:
            (self.root / f).mkdir(parents=True, exist_ok=True)

    def path(self, folder, slug):
        return self.root / folder / f"{slug}.json"

    def _read(self, p):
        data = json.loads(p.read_text(encoding="utf-8"))
        if not isinstance(data, dict) or not str(data.get("topic", "")).strip():
            raise ValueError(f"{p.name}: no topic text")
        return data

    def add(self, topic, notes="", today=None):
        """Write a pending file. Returns its slug, or None if the topic is already anywhere in the queue."""
        topic = " ".join(topic.split())
        if not topic:
            raise ValueError("empty topic")
        for f in FOLDERS:
            for p in (self.root / f).glob("*.json"):
                try:
                    if _key(self._read(p)["topic"]) == _key(topic):
                        return None
                except (ValueError, OSError):
                    continue
        slug = slugify(topic)
        n, base = 2, slug
        while any(self.path(f, slug).exists() for f in FOLDERS):
            slug = f"{base}-{n}"
            n += 1
        data = {"topic": topic, "added": (today or datetime.date.today()).isoformat(), "notes": notes}
        self.path("pending", slug).write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        return slug

    def _list(self, folder):
        """[(slug, data)] oldest `added` first, then by name. Unreadable files are skipped."""
        out = []
        for p in sorted((self.root / folder).glob("*.json")):
            try:
                d = self._read(p)
            except (ValueError, OSError):
                continue
            out.append((str(d.get("added", "")), p.stem, d))
        out.sort(key=lambda x: (x[0], x[1]))
        return [(slug, d) for _, slug, d in out]

    def pending(self):
        return self._list("pending")

    def in_progress(self):
        return self._list("in-progress")

    def count(self, folder):
        return len(list((self.root / folder).glob("*.json")))

    def claim(self, slug):
        """pending -> in-progress."""
        self.path("pending", slug).replace(self.path("in-progress", slug))

    def release(self, slug):
        """in-progress -> pending (the topic was not at fault)."""
        self.path("in-progress", slug).replace(self.path("pending", slug))

    def finish(self, slug, folder, reason="", log_tail=""):
        """in-progress -> done | failed | needs-props, adding the reason and log tail to the file."""
        if folder not in ("done", "failed", "needs-props"):
            raise ValueError(folder)
        src = self.path("in-progress", slug)
        data = self._read(src)
        if reason:
            data["reason"] = reason
        if log_tail:
            data["log_tail"] = log_tail
        data["finished"] = datetime.date.today().isoformat()
        dst = self.path(folder, slug)
        dst.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        src.unlink()
