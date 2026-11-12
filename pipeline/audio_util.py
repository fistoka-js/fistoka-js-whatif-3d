"""Small helpers shared by voice.py and mix.py: find ffmpeg, run it, measure audio."""
import json
import os
import re
import shutil
import subprocess

# Fallback location if ffmpeg is not on PATH (this machine).
_FALLBACK_BIN = (r"E:\Youtube Project\ffmpeg-9.0.1-essentials_build"
                 r"\ffmpeg-9.0.1-essentials_build\bin")


def _find(tool):
    path = shutil.which(tool)
    if path:
        return path
    cand = os.path.join(_FALLBACK_BIN, tool + ".exe")
    if os.path.exists(cand):
        return cand
    raise RuntimeError(f"{tool} not found on PATH or in {_FALLBACK_BIN}")


def ffmpeg_bin():
    return _find("ffmpeg")


def ffprobe_bin():
    return _find("ffprobe")


def run(cmd):
    """Run a command, return (stdout, stderr). Raise with stderr tail on failure."""
    p = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if p.returncode != 0:
        tail = "\n".join(p.stderr.strip().splitlines()[-15:])
        raise RuntimeError(f"command failed ({p.returncode}): {' '.join(map(str, cmd))}\n{tail}")
    return p.stdout, p.stderr


def probe_duration(path, stream=None):
    """Duration in seconds. stream='v:0' or 'a:0' reads that stream, else the container."""
    cmd = [ffprobe_bin(), "-v", "error", "-of", "json"]
    if stream:
        cmd += ["-select_streams", stream, "-show_entries", "stream=duration"]
    else:
        cmd += ["-show_entries", "format=duration"]
    out, _ = run(cmd + [str(path)])
    data = json.loads(out)
    node = data["streams"][0] if stream else data["format"]
    return float(node["duration"])


def _num(x):
    x = str(x).strip()
    if x in ("-inf", "-Infinity"):
        return float("-inf")
    return float(x)


def loudnorm_stats(path, afilter=None, target=-16.0, tp=-1.5, lra=50):
    """Run loudnorm in measure mode; return its JSON dict (strings as printed)."""
    f = f"loudnorm=I={target}:TP={tp}:LRA={lra}:print_format=json"
    if afilter:
        f = afilter + "," + f
    _, err = run([ffmpeg_bin(), "-hide_banner", "-nostats", "-i", str(path),
                  "-vn", "-af", f, "-f", "null", "-"])
    m = re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", err, re.S)
    if not m:
        raise RuntimeError("could not read loudnorm output:\n" + err[-600:])
    return json.loads(m.group(0))


def measure(path, afilter=None):
    """Integrated loudness (LUFS), true peak (dBTP) and duration (s) of a file's audio."""
    st = loudnorm_stats(path, afilter)
    return {"lufs": _num(st["input_i"]), "true_peak": _num(st["input_tp"]),
            "duration": probe_duration(path)}
