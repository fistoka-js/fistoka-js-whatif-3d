"""The pipeline runner: topic -> show -> video -> checks -> private upload.

    python -m pipeline.run [--topic "..."] [--slug s] [--from-step name] [--no-upload] [--llm api|files]

Steps (in order): writer, timeline, render, mix, qa, review, upload.
Each step is skipped when its output file exists and is newer than its inputs, so a failed run
resumes where it stopped. --from-step NAME forces NAME and every step after it to run again.

Exit codes:
  0  at least one video was finished and nothing needs attention
  1  every topic tried failed (see queue/failed/ and shows/<slug>/out/run.log)
  2  bad command line
  3  every topic tried needed props the catalogue does not have (queue/needs-props/)
  4  files mode: the writer waits for a reply file; run the same command again afterwards
  5  nothing to do: the queue is empty
  6  upload refused by the channel guard or the login (topic put back in pending; fix settings, run again)
"""
import argparse
import datetime
import hashlib
import json
import shutil
import subprocess
import sys
import time
from pathlib import Path

from . import queue as queue_mod
from .settings import ROOT, load_settings

STEPS = ["writer", "timeline", "render", "mix", "qa", "review", "upload"]
EXIT_OK, EXIT_FAILED, EXIT_USAGE, EXIT_NEEDS_PROPS, EXIT_WAITING, EXIT_EMPTY, EXIT_GUARD = 0, 1, 2, 3, 4, 5, 6
REVIEW_MARK = ("<!-- pipeline-run:start -->", "<!-- pipeline-run:end -->")


class StepFailed(Exception):
    pass


class NeedsProps(Exception):
    pass


class WaitingForReply(Exception):
    pass


class Stop(Exception):
    """Upload refused for a reason that is not the topic's fault."""


# ---------- small helpers ----------

class Log:
    """Prints one status line and also appends to shows/<slug>/out/run.log."""

    def __init__(self, path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def say(self, msg, console=True):
        line = f"{datetime.datetime.now().strftime('%H:%M:%S')} {msg}"
        with open(self.path, "a", encoding="utf-8") as f:
            f.write(line + "\n")
        if console:
            print(msg, flush=True)

    def tail(self, n=20):
        try:
            return "\n".join(self.path.read_text(encoding="utf-8").splitlines()[-n:])
        except OSError:
            return ""


def run_cmd(cmd, log, cwd=ROOT):
    """Run a command, copy its output into the log file, return the exit code. Tests replace this."""
    log.say("$ " + " ".join(str(c) for c in cmd), console=False)
    p = subprocess.run([str(c) for c in cmd], cwd=str(cwd), capture_output=True, text=True, encoding="utf-8", errors="replace")
    for text in (p.stdout, p.stderr):
        if text.strip():
            log.say(text.rstrip(), console=False)
    return p.returncode


def fresh(output, inputs):
    """True when output exists and is not older than any existing input."""
    output = Path(output)
    if not output.exists():
        return False
    t = output.stat().st_mtime
    return all(Path(i).stat().st_mtime <= t for i in inputs if Path(i).exists())


def node():
    return shutil.which("node") or "node"


def read_json(p, default=None):
    try:
        return json.loads(Path(p).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return default


def pick_music(slug, music_dir):
    """A seeded choice among tracks that have a row in LEDGER.csv; None when there are none."""
    music_dir = Path(music_dir)
    ledger = music_dir / "LEDGER.csv"
    if not ledger.exists():
        return None
    listed = {ln.split(",")[0].strip() for ln in ledger.read_text(encoding="utf-8").splitlines()[1:] if ln.strip()}
    tracks = sorted(p for p in music_dir.glob("*.mp3") if p.name in listed)
    if not tracks:
        return None
    return tracks[int(hashlib.sha1(slug.encode()).hexdigest(), 16) % len(tracks)]


# ---------- one show ----------

class Show:
    def __init__(self, slug, topic, args, settings, root=ROOT):
        self.slug, self.topic, self.args, self.settings, self.root = slug, topic, args, settings, Path(root)
        self.dir = self.root / "shows" / slug
        self.out = self.dir / "out"
        self.out.mkdir(parents=True, exist_ok=True)
        self.log = Log(self.out / "run.log")
        self.mp4 = self.out / f"{slug}.mp4"
        self.final = self.out / f"{slug}-final.mp4"
        self.timeline = self.out / "timeline.json"
        self.qa_json = self.out / "qa.json"
        self.review = self.dir / "review.md"
        self.uploaded = self.dir / "upload.json"
        self.forced = False  # becomes True at --from-step

    # each step returns "skipped" or "done"
    def step_writer(self):
        w = read_json(self.dir / "writer.json", {})
        if w.get("status") in ("ok", "fallback") and (self.dir / "show.json").exists() and not self.forced:
            return "skipped"
        mode = self.args.llm or self.settings["llm_mode"]
        code = run_cmd([sys.executable, "-m", "pipeline.writer", "--topic", self.topic, "--slug", self.slug, "--mode", mode], self.log, self.root)
        if code == 3:
            raise NeedsProps("the catalogue cannot show this topic (see NEEDS-PROPS.md)")
        if code == 4:
            raise WaitingForReply("the writer is waiting for a reply file in shows/%s/llm/" % self.slug)
        if code != 0:
            raise StepFailed(f"writer exited with code {code}")
        return "done"

    def step_timeline(self):
        ins = [self.dir / "show.json", self.dir / "words.json"]
        if fresh(self.timeline, ins) and not self.forced:
            return "skipped"
        self._check(run_cmd([node(), "tools/validate.mjs", f"shows/{self.slug}"], self.log, self.root), "validate")
        self._check(run_cmd([node(), "tools/timeline.mjs", f"shows/{self.slug}"], self.log, self.root), "timeline")
        return "done"

    def step_render(self):
        ins = [self.dir / "show.json", self.dir / "words.json", self.dir / "voice.mp3"]
        if fresh(self.mp4, ins) and not self.forced:
            return "skipped"
        self._check(run_cmd([node(), "tools/render.mjs", self.slug], self.log, self.root), "render")
        return "done"

    def step_mix(self):
        ins = [self.mp4, self.timeline, self.dir / "voice.mp3", self.dir / "words.json"]
        if fresh(self.final, ins) and not self.forced:
            return "skipped"
        cmd = [sys.executable, "-m", "pipeline.mix", "--video", self.mp4, "--voice", self.dir / "voice.mp3",
               "--timeline", self.timeline, "--out", self.final, "--words", self.dir / "words.json"]
        music = pick_music(self.slug, self.root / "assets" / "music")
        if music:
            cmd += ["--music", music]
            self.log.say(f"music: {music.name}", console=False)
        self._check(run_cmd(cmd, self.log, self.root), "mix")
        return "done"

    def step_qa(self):
        if fresh(self.qa_json, [self.final]) and not self.forced:
            return "skipped"
        code = run_cmd([node(), "tools/qa.mjs", self.slug, "--video", self.final, "--json"], self.log, self.root)
        if code not in (0, 1):          # 1 = QA found a failure; the report is still written
            raise StepFailed(f"qa could not run (exit {code})")
        return "done"

    def qa_result(self):
        return (read_json(self.qa_json, {}) or {}).get("result", "unknown")

    def step_review(self):
        qa = read_json(self.qa_json, {}) or {}
        video = (qa.get("measured") or {}).get("video") or {}
        w = read_json(self.dir / "writer.json", {}) or {}
        up = read_json(self.uploaded)
        lines = [
            REVIEW_MARK[0], "## Pipeline run", "",
            f"- Topic: {self.topic}",
            f"- Final video: `{self.final.as_posix()}`",
            f"- Length: {video.get('videoSeconds', '?')} s, loudness: {video.get('lufs', '?')} LUFS",
            f"- Picture check: **{qa.get('result', 'not run')}** ({len(qa.get('findings') or [])} findings, see `out/qa.json` and `out/qa-sheet.jpg`)",
            f"- Writer status: {w.get('status', '?')}",
            f"- Upload: {('private, https://youtu.be/' + up['id']) if up else 'not uploaded'}",
            REVIEW_MARK[1], "",
        ]
        block = "\n".join(lines)
        old = self.review.read_text(encoding="utf-8") if self.review.exists() else f"# Review: {self.slug}\n\n"
        if REVIEW_MARK[0] in old and REVIEW_MARK[1] in old:
            a, rest = old.split(REVIEW_MARK[0], 1)
            _, b = rest.split(REVIEW_MARK[1], 1)
            new = a + block + b.lstrip("\n")
        else:
            new = old.rstrip("\n") + "\n\n" + block
        self.review.write_text(new, encoding="utf-8")
        return "done"

    def step_upload(self):
        if self.uploaded.exists():
            return "skipped"
        if self.args.no_upload:
            return "skipped (--no-upload)"
        if self.qa_result() == "fail":
            raise StepFailed("the picture check failed, so the video is not uploaded (see out/qa.json)")
        from . import upload
        w = read_json(self.dir / "writer.json", {}) or {}
        try:
            vid = upload.upload_video(self.final, w.get("title") or self.topic, w.get("description", ""), w.get("tags", []),
                                      self.settings, say=lambda m: self.log.say(m))
        except (upload.ChannelGuardError, upload.LoginError) as e:
            raise Stop(str(e))
        self.uploaded.write_text(json.dumps({"id": vid, "url": f"https://youtu.be/{vid}", "privacy": "private"}, indent=2), encoding="utf-8")
        self.log.say(f"uploaded (private): https://youtu.be/{vid}")
        return "done"

    def _check(self, code, name):
        if code != 0:
            raise StepFailed(f"{name} exited with code {code}")

    def run(self, from_step=None):
        for i, name in enumerate(STEPS, 1):
            if from_step and name == from_step:
                self.forced = True
            t0 = time.time()
            self.log.say(f"[{i}/{len(STEPS)}] {name} ...")
            result = getattr(self, "step_" + name)()
            self.log.say(f"[{i}/{len(STEPS)}] {name}: {result} ({time.time() - t0:.0f}s)")
        # the review is written before upload so it exists even if upload fails; refresh it once uploaded
        if self.uploaded.exists():
            self.step_review()


# ---------- the whole run ----------

def main(argv=None, root=ROOT):
    ap = argparse.ArgumentParser(prog="pipeline.run", description="Make a video from the next queued topic.")
    ap.add_argument("--topic")
    ap.add_argument("--slug")
    ap.add_argument("--from-step", choices=STEPS)
    ap.add_argument("--no-upload", action="store_true")
    ap.add_argument("--llm", choices=["api", "files"])
    try:
        args = ap.parse_args(argv)
    except SystemExit as e:
        return EXIT_USAGE if e.code else 0
    root = Path(root)
    settings = load_settings(root / "settings.yaml")
    q = queue_mod.Queue(root / "queue")

    # Work list: topics already in progress (resume) first, then pending, oldest first.
    if args.topic:
        work = [(args.slug or queue_mod.slugify(args.topic), args.topic, False)]
    else:
        work = [(s, d["topic"], True) for s, d in q.in_progress()] + [(s, d["topic"], True) for s, d in q.pending()]
        if args.slug:
            work = [w for w in work if w[0] == args.slug]
    if not work:
        print("Nothing to do: the queue is empty (queue/pending/).")
        return EXIT_EMPTY

    limit = 1 if args.topic else int(settings["max_topics_per_run"])
    made = failed = props = 0
    for slug, topic, queued in work[:limit]:
        print(f"== {slug}: {topic}")
        if queued and q.path("pending", slug).exists():
            q.claim(slug)
        show = Show(slug, topic, args, settings, root)
        try:
            show.run(args.from_step)
            if queued:
                q.finish(slug, "done")
            made += 1
            print(f"finished: {show.final}")
        except WaitingForReply as e:
            print(f"WAITING: {e}. Add the reply file, then run the same command again.")
            return EXIT_WAITING
        except NeedsProps as e:
            props += 1
            print(f"needs props: {e}")
            if queued:
                q.finish(slug, "needs-props", str(e))
        except Stop as e:
            print(f"STOPPED: {e}")
            if queued:
                q.release(slug)
            return EXIT_GUARD
        except Exception as e:
            failed += 1
            reason = f"{type(e).__name__}: {e}"
            show.log.say("FAILED " + reason)
            print(f"failed: {reason}\n  details: {show.log.path}")
            if queued:
                q.finish(slug, "failed", reason, show.log.tail())
    print(f"summary: {made} made, {props} need props, {failed} failed")
    if made:
        return EXIT_OK
    if failed:
        return EXIT_FAILED
    return EXIT_NEEDS_PROPS


if __name__ == "__main__":
    sys.exit(main())
