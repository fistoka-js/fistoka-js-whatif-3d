"""The picture critic: after the final video exists, one frame per spoken sentence (and one just after each shot
start) is judged against the words. If a sentence fails, one repair call rewrites show.json, then the caller
renders again and the critic looks once more. The result never blocks an upload by itself: the owner reads it
in review.md. Settings (settings.yaml): critic (false = off), critic_repairs (default 1).

State lives in shows/<slug>/out/critic/critic.json so a files-mode run can stop for a reply and resume:
  {"before": {...}, "repaired": bool, "repair_note": str, "after": {...}|null, "calls": n, "done": bool}
"""
import json
import os
import shutil
import subprocess
from pathlib import Path

from . import audio_util, catalog_text, writer

PROMPTS = writer.PROMPTS
CRITIC_MAX_TOKENS = 8000
FRAME_WIDTH = 540
SHOT_OFFSET = 0.15                      # seconds after a shot starts (the cut itself may still blend)


# ---------------------------------------------------------------- frames

def split_sentences(words):
    """[{n, text, start, end, mid}] one per spoken sentence (the writer's own split: words ending . ? !)."""
    out = []
    for n, sent in enumerate(writer.sentences(words), 1):
        start, end = sent[0]["start"], sent[-1]["end"]
        out.append({"n": n, "text": " ".join(w["text"] for w in sent), "start": round(start, 3),
                    "end": round(end, 3), "mid": round((start + end) / 2, 3)})
    return out


def _grab(video, t, dest):
    """One frame at time t, 540 wide. Raises RuntimeError when ffmpeg makes no file."""
    dest = Path(dest)
    cmd = [audio_util.ffmpeg_bin(), "-hide_banner", "-loglevel", "error", "-y", "-ss", f"{t:.3f}", "-i", str(video),
           "-frames:v", "1", "-vf", f"scale={FRAME_WIDTH}:-2", "-q:v", "3", str(dest)]
    p = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if p.returncode != 0 or not dest.exists():
        raise RuntimeError(f"could not grab a frame at {t:.2f} s: {p.stderr.strip()[-200:]}")


def grab_frames(video, words, timeline, out_dir, grab=None):
    """Write s01.jpg ... (sentence middles) and t01.jpg ... (shot starts + 0.15 s) into out_dir.
    Returns {"sentences": [{n, text, start, end, mid, shot, image}], "transitions": [{n, shot, t, image}]}."""
    grab = grab or _grab                 # looked up now, so tests can replace _grab
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    for old in out_dir.glob("*.jpg"):
        old.unlink()
    shots = timeline.get("shots", [])
    duration = timeline.get("duration", 1e9)
    shot_at = lambda t: next((s["id"] for s in shots if s["start"] <= t < s["end"]), "")
    sents = split_sentences(words)
    for s in sents:
        s["shot"], s["image"] = shot_at(s["mid"]), f"s{s['n']:02d}.jpg"
        grab(video, min(s["mid"], duration - 0.05), out_dir / s["image"])
    trans = []
    for n, shot in enumerate(shots, 1):
        t = shot["start"] + SHOT_OFFSET
        if t >= duration:
            continue
        trans.append({"n": n, "shot": shot["id"], "t": round(t, 3), "image": f"t{n:02d}.jpg"})
        grab(video, t, out_dir / trans[-1]["image"])
    return {"sentences": sents, "transitions": trans}


# ---------------------------------------------------------------- the call

def system_prompt():
    return writer.fill(writer.read_prompt("critic_system.md"), NOTES=writer.read_prompt("critic_rubric_notes.md").strip())


def user_prompt(frames, out_dir):
    """The text half of the call; the images follow it in the same order (IMAGE 1, 2, ...)."""
    out_dir, k = Path(out_dir), 0
    lines = ["SENTENCES (image k shows the picture in the middle of that sentence):", ""]
    for s in frames["sentences"]:
        k += 1
        lines.append(f"IMAGE {k} = sentence {s['n']} [{s['start']:.2f}-{s['end']:.2f} s, shot \"{s['shot']}\"]: {s['text']}")
    lines += ["", "TRANSITIONS (image k shows the picture 0.15 s after that shot starts; look for leftovers of the shot before):", ""]
    for t in frames["transitions"]:
        k += 1
        lines.append(f"IMAGE {k} = transition {t['n']}: shot \"{t['shot']}\" starts at {t['t'] - SHOT_OFFSET:.2f} s")
    lines += ["", "Judge every sentence and every transition. Reply with the JSON object only."]
    return "\n".join(lines)


def image_paths(frames, out_dir):
    out_dir = Path(out_dir)
    return [out_dir / f["image"] for f in frames["sentences"] + frames["transitions"]]


def parse_reply(text, frames):
    """{"sentences": [{n, verdict, problems}], "transitions": [...]}: every sentence and transition present, verdict
    pass or fail. A bad reply raises writer.BadReply."""
    obj = writer.parse_loose_json(text)

    def rows(key, wanted):
        got = {}
        for r in obj.get(key) or []:
            if isinstance(r, dict) and isinstance(r.get("n"), int):
                problems = writer.as_list(r.get("problems"))
                fail = str(r.get("verdict", "")).strip().lower() == "fail"
                got[r["n"]] = {"n": r["n"], "verdict": "fail" if fail else "pass",
                               "problems": (problems or ["(no reason given)"]) if fail else problems}
        return [got.get(n, {"n": n, "verdict": "pass", "problems": []}) for n in wanted]

    if not isinstance(obj.get("sentences"), list):
        raise writer.BadReply('the reply has no "sentences" list')
    return {"sentences": rows("sentences", [s["n"] for s in frames["sentences"]]),
            "transitions": rows("transitions", [t["n"] for t in frames["transitions"]])}


def failed(result):
    return [r for r in (result or {}).get("sentences", []) if r["verdict"] == "fail"]


def failed_transitions(result):
    return [r for r in (result or {}).get("transitions", []) if r["verdict"] == "fail"]


# ---------------------------------------------------------------- repair

def repair_show(folder, complete, validate_fn, before, frames, words):
    """One repair call (the show prompt's catalogue, the show, the failing sentences). Writes the new show.json when
    it passes the validator and the story checks. Returns None when applied, else the reason it was not."""
    folder = Path(folder)
    old_text = (folder / "show.json").read_text(encoding="utf-8")
    sents = {s["n"]: s["text"] for s in frames["sentences"]}
    bad = "\n".join(f"- S{r['n']} \"{sents.get(r['n'], '')}\": " + " ".join(r["problems"]) for r in failed(before))
    trans = "\n".join(f"- shot {r['n']}: " + " ".join(r["problems"]) for r in before.get("transitions", [])
                      if r["verdict"] == "fail") or "(none)"
    user = writer.fill(writer.read_prompt("critic_repair_user.md"), WORDS=writer.words_block(words),
                       PREVIOUS=writer.compact_json(json.loads(old_text)), FAILED=bad, TRANSITIONS=trans,
                       NOTES=writer.read_prompt("critic_rubric_notes.md").strip())
    try:
        reply = complete(writer.show_system_prompt(catalog_text.load_catalog()), user, purpose="critic-repair",
                         max_tokens=writer.SHOW_MAX_TOKENS)
        show = writer.normalise_show(writer.parse_show_reply(reply.text), json.loads(old_text).get("title", ""))
    except (writer.BadReply, writer.llm.LlmError) as e:
        return f"no usable repair answer ({str(e)[:100]})"
    cdir = folder / "out" / "critic"
    cdir.mkdir(parents=True, exist_ok=True)
    keep = cdir / "show.before.json"                        # the owner's original: never overwritten
    if not keep.exists():
        keep.write_text(old_text, encoding="utf-8")
    (cdir / "show.prev.json").write_text(old_text, encoding="utf-8")   # this run's pre-repair show, for rollback
    st = (folder / "show.json").stat()
    (folder / "show.json").write_text(json.dumps(show, indent=1, ensure_ascii=False), encoding="utf-8")
    check = validate_fn(folder)
    if check.get("ok") and not writer.story_problems(show, check, None, words):
        return None
    (folder / "show.json").write_text(old_text, encoding="utf-8")     # keep the video the owner would have had
    os.utime(folder / "show.json", ns=(st.st_atime_ns, st.st_mtime_ns))   # same mtime: nothing turns stale
    return "the repaired show did not pass the checker and story checks; kept the earlier show"


# ---------------------------------------------------------------- the step

def _skip_calls(complete, n):
    """files mode names replies by call number: after a resume, step the counter over the calls already done."""
    owner = getattr(complete, "__self__", None)
    if n and hasattr(owner, "count"):
        owner.count += n


def critic_step(folder, final, complete, validate_fn, rebuild, repairs=1, grab=None, qa_ok=None):
    """Judge, repair once, rebuild the video (rebuild() runs timeline, render, mix, qa), judge again; roll the
    repair back when qa fails or more sentences fail. qa_ok() says whether the picture check passes now.
    Returns the state dict (also written to out/critic/critic.json). WaitingForReply passes through.
    A reply that cannot be read leaves done False with state["error"]: fix the reply file, run again."""
    grab = grab or grab_frames
    qa_ok = qa_ok or (lambda: True)
    folder = Path(folder)
    cdir = folder / "out" / "critic"
    words = json.loads((folder / "words.json").read_text(encoding="utf-8"))
    path = cdir / "critic.json"
    try:
        state = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        state = {}
    if state.get("done"):
        state = {}                                          # a stale finished run: start again
    cdir.mkdir(parents=True, exist_ok=True)
    save = lambda: path.write_text(json.dumps(state, indent=1, ensure_ascii=False), encoding="utf-8")
    state.pop("error", None)
    _skip_calls(complete, state.get("calls", 0))

    def judge(purpose):
        """The verdict, or None when the reply cannot be read (then state["error"] is set and saved)."""
        timeline = json.loads((folder / "out" / "timeline.json").read_text(encoding="utf-8"))
        frames = grab(final, words, timeline, cdir)
        reply = complete(system_prompt(), user_prompt(frames, cdir), purpose=purpose, max_tokens=CRITIC_MAX_TOKENS,
                         images=image_paths(frames, cdir))
        try:
            result = dict(parse_reply(reply.text, frames), frames=frames)
        except writer.BadReply as e:
            state["error"] = str(e)      # not counted: the rerun asks for the same call number again
            save()
            return None
        state["calls"] = state.get("calls", 0) + 1
        return result

    if "before" not in state:
        if not qa_ok():                  # no point judging a video the picture check already rejects
            state.update(skipped="the picture check failed before the critic ran", done=True)
            save()
            return state
        before = judge("critic")
        if before is None:
            return state
        state.update(before=before, repaired=False, after=None)
        save()
    before = state["before"]
    if (failed(before) or failed_transitions(before)) and repairs > 0 and not state["repaired"] \
            and "repair_note" not in state:
        note = repair_show(folder, complete, validate_fn, before, before["frames"], words)
        state["calls"] += 1
        if note:
            state["repair_note"] = note
        else:
            state["repaired"] = True
        save()
    if state["repaired"] and state["after"] is None:
        from .run import StepFailed     # lazy: run imports this module
        reason = None
        if not state.get("rebuilt"):
            try:
                rebuild()
                state["rebuilt"] = True
            except StepFailed as e:
                reason = f"the rebuild after the repair failed: {e}"
            save()
        if reason is None:
            after = judge("critic-after")
            if after is None:
                return state
            state["after"] = after
            worse = (len(failed(after)) + len(failed_transitions(after))
                     > len(failed(before)) + len(failed_transitions(before)))
            if worse or not qa_ok():
                reason = "the picture check failed" if not qa_ok() else "more sentences failed than before"
        if reason:
            shutil.copyfile(cdir / "show.prev.json", folder / "show.json")
            state.update(rollback_reason=reason, rebuilt=False)
            save()
            rebuild()                   # if this fails too, StepFailed escapes and rolled_back stays unset
            state["rolled_back"] = reason
    state["done"] = True
    save()
    return state


# ---------------------------------------------------------------- for review.md

def review_lines(state):
    """The "Picture critic" lines of review.md: failed sentences before and after the repair."""
    if not state:
        return ["- Picture critic: not run"]

    def fails(r):
        return "; ".join(f"S{x['n']}: " + " ".join(x["problems"]) for x in failed(r)) or "none"

    if state.get("skipped"):
        return [f"- Picture critic: skipped ({state['skipped']})"]
    if state.get("error"):
        return [f"- Picture critic: the reply could not be read ({state['error']}); fix the reply file and run again"]
    b = state.get("before") or {}
    out = [f"- Picture critic, before repair: {len(failed(b))} of {len(b.get('sentences', []))} sentences failed: {fails(b)}"]
    bt = [t for t in b.get("transitions", []) if t["verdict"] == "fail"]
    if bt:
        out.append("  - Transition problems: " + "; ".join(f"shot {t['n']}: " + " ".join(t["problems"]) for t in bt))
    if state.get("repaired"):
        a = state.get("after") or {}
        out.append(f"- Picture critic, after one repair: {len(failed(a))} of {len(a.get('sentences', []))} sentences failed: {fails(a)}")
        if state.get("rolled_back"):
            out.append(f"- Picture critic: repair rolled back and the video rebuilt from the earlier show ({state['rolled_back']})")
    elif state.get("repair_note"):
        out.append(f"- Picture critic repair: not applied ({state['repair_note']})")
    elif failed(b):
        out.append("- Picture critic repair: off (critic_repairs is 0)")
    return out
