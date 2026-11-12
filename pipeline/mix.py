"""Final audio: voice + optional music + sound effects -> loudness-normalised AAC, muxed
onto the finished video without touching the video stream.

Steps (all logged to <out>.ffmpeg.log):
  1. pre-mix  voice (reference) + music bed + sfx  ->  premix.wav (float)
  2. loudnorm pass 1 (measure premix)
  3. loudnorm pass 2 (linear, to target) + AAC + mux with `-c:v copy`

CLI: python -m pipeline.mix --video V --voice A --timeline T --out O
                            [--music M] [--words W] [--no-sfx]
"""
import argparse
import json
import math
import sys
import wave
from pathlib import Path

import numpy as np

from . import audio_util
from .audio_util import ffmpeg_bin, measure, probe_duration, run  # noqa: F401 (measure re-exported)

STEREO = "aformat=channel_layouts=stereo"
SFX_DIR = Path(__file__).resolve().parent.parent / "assets" / "sfx"

DEFAULTS = {
    "sfx": True,                    # False = no sound effects at all
    "music_below_voice_db": 19,     # music loudness (LUFS) this far under the voice
    "sfx_below_voice_db": 16,       # sfx loudness this far under the voice
    "sfx_over_word_extra_db": 3,    # extra quieting for an sfx that lands on a spoken word
    "sfx_min_gap": 0.25,            # seconds: drop an event closer than this to the last kept one
    "sfx_same_name_gap": 1.0,       # seconds: drop an event repeating the same sfx within this time
    "music_start": 0.0,             # seconds into the music file where the bed starts (skips quiet intros)
    "music_fade_in": 1.0,           # seconds
    "music_fade_out": 2.0,          # seconds
    "target_lufs": -16.0,           # final integrated loudness
    "loudness_range": 50,           # LRA target; high so loudnorm stays linear (never squashes dynamics)
    "true_peak": -1.5,              # final true-peak ceiling in dBTP
    "audio_bitrate": "192k",        # AAC bitrate
    "sample_rate": 48000,           # Hz
}


# ------------------------------------------------------------------ helpers

def _db_rms(samples):
    rms = math.sqrt(float(np.mean(samples.astype(float) ** 2)))
    return 20 * math.log10(max(rms, 1e-9))


def sfx_level_db(wav_path):
    """RMS level of an sfx file in dB re full scale (stands in for its LUFS)."""
    with wave.open(str(wav_path), "rb") as w:
        data = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16) / 32768.0
    return _db_rms(data)


def choose_events(events, s):
    """Apply the density rules. Returns (kept, dropped) lists of event dicts.

    Rules, in time order: drop an event closer than sfx_min_gap to the last kept one;
    drop an event whose sfx name was already kept within sfx_same_name_gap seconds.
    Different names more than sfx_min_gap apart may therefore share a second.
    """
    kept, dropped = [], []
    for ev in sorted(events, key=lambda e: e["t"]):
        if kept and ev["t"] - kept[-1]["t"] < s["sfx_min_gap"]:
            dropped.append(ev)
            continue
        same = [k for k in kept if k["sfx"] == ev["sfx"]]
        if same and ev["t"] - same[-1]["t"] < s["sfx_same_name_gap"]:
            dropped.append(ev)
            continue
        kept.append(ev)
    return kept, dropped


def _on_word(t, words):
    return any(w["start"] <= t <= w["end"] for w in words)


def _fmt(x):
    return f"{x:.3f}"


# ------------------------------------------------------------------ main

def mix(video_path, voice_path, timeline_path, out_path, music_path=None,
        settings=None, words_path=None):
    """Build the final mp4. Returns a report dict (kept/dropped events, gains, measured result)."""
    s = dict(DEFAULTS)
    s.update(settings or {})
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    stem = str(out_path)
    log_path = Path(stem + ".ffmpeg.log")
    premix = Path(stem + ".premix.wav")
    music_tmp = Path(stem + ".music.wav")
    script_path = Path(stem + ".filter.txt")
    sr = s["sample_rate"]

    timeline = json.loads(Path(timeline_path).read_text(encoding="utf-8"))
    words = json.loads(Path(words_path).read_text(encoding="utf-8")) if words_path else []
    dur = probe_duration(video_path, "v:0")           # output length = video length
    ff = ffmpeg_bin()
    log = []

    def logged(cmd):
        log.append(" ".join(f'"{c}"' if " " in str(c) else str(c) for c in cmd))
        return run(cmd)

    # Voice is the reference level.
    # Measured after the same mono->stereo conversion the mix uses, so the reference is exact.
    voice_lufs = measure(voice_path, afilter=STEREO)["lufs"]
    report = {"voice_lufs": voice_lufs, "events_kept": [], "events_dropped": [],
              "events_skipped": []}

    inputs = [["-i", str(voice_path)]]   # each entry = ffmpeg args for one input
    steps = [f"[0:a]aresample={sr},aformat=channel_layouts=stereo[voice]"]
    mix_labels = ["[voice]"]

    # --- music bed
    if music_path:
        # Cut the intro off first so looping repeats the part we want.
        logged([ff, "-y", "-hide_banner", "-v", "error", "-ss", _fmt(s["music_start"]),
                "-i", str(music_path), "-ar", str(sr), "-ac", "2", str(music_tmp)])
        gain = voice_lufs - s["music_below_voice_db"] - measure(music_tmp)["lufs"]
        report["music_gain_db"] = round(gain, 2)
        idx = len(inputs)
        inputs.append(["-stream_loop", "-1", "-i", str(music_tmp)])
        fo = max(dur - s["music_fade_out"], 0)
        steps.append(
            f"[{idx}:a]atrim=0:{_fmt(dur)},asetpts=PTS-STARTPTS,"
            f"afade=t=in:st=0:d={s['music_fade_in']},"
            f"afade=t=out:st={_fmt(fo)}:d={s['music_fade_out']},"
            f"volume={gain:.2f}dB[music]")
        mix_labels.append("[music]")

    # --- sfx bus
    if s["sfx"]:
        kept, dropped = choose_events(timeline.get("events", []), s)
        report["events_dropped"] = dropped
        for ev in kept:
            wav = SFX_DIR / f"{ev['sfx']}.wav"
            if not wav.exists():
                report["events_skipped"].append(ev)
                continue
            under = s["sfx_below_voice_db"]
            if _on_word(ev["t"], words):
                under += s["sfx_over_word_extra_db"]
            gain = voice_lufs - under - sfx_level_db(wav)
            idx = len(inputs)
            inputs.append(["-i", str(wav)])
            label = f"sfx{len(report['events_kept'])}"
            steps.append(
                f"[{idx}:a]aresample={sr},aformat=channel_layouts=stereo,"
                f"volume={gain:.2f}dB,adelay={int(round(ev['t'] * 1000))}:all=1[{label}]")
            mix_labels.append(f"[{label}]")
            report["events_kept"].append(dict(ev, gain_db=round(gain, 2)))

    # --- sum everything; pad/trim to exactly the video length
    steps.append(
        "".join(mix_labels)
        + f"amix=inputs={len(mix_labels)}:normalize=0:duration=longest,"
        + f"apad=whole_dur={_fmt(dur)},atrim=0:{_fmt(dur)}[out]")
    script_path.write_text(";\n".join(steps) + "\n", encoding="utf-8")

    cmd = [ff, "-y", "-hide_banner", "-v", "error"]
    for args in inputs:
        cmd += args
    # The filter text is passed inline (works on every ffmpeg version). The same text is also
    # saved in script_path above, only so a person can read it when debugging.
    cmd += ["-filter_complex", ";".join(steps), "-map", "[out]",
            "-c:a", "pcm_f32le", str(premix)]
    logged(cmd)

    # --- loudness: pass 1 measure, pass 2 apply
    st = audio_util.loudnorm_stats(premix, target=s["target_lufs"], tp=s["true_peak"],
                                  lra=s["loudness_range"])
    ln = (f"loudnorm=I={s['target_lufs']}:TP={s['true_peak']}:LRA={s['loudness_range']}"
          f":measured_I={st['input_i']}:measured_TP={st['input_tp']}"
          f":measured_LRA={st['input_lra']}:measured_thresh={st['input_thresh']}"
          f":offset={st['target_offset']}:linear=true,aresample={sr}")
    logged([ff, "-y", "-hide_banner", "-v", "error", "-i", str(video_path), "-i", str(premix),
            "-af", ln, "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy",
            "-c:a", "aac", "-b:a", s["audio_bitrate"], "-ar", str(sr), "-ac", "2",
            "-t", _fmt(dur), "-movflags", "+faststart", stem])

    log_path.write_text("\n\n".join(log) + "\n\nfilter script:\n" + script_path.read_text(),
                        encoding="utf-8")
    for p in (premix, music_tmp):
        p.unlink(missing_ok=True)
    report["final"] = measure(out_path)
    return report


def main(argv=None):
    ap = argparse.ArgumentParser(prog="python -m pipeline.mix")
    ap.add_argument("--video", required=True)
    ap.add_argument("--voice", required=True)
    ap.add_argument("--timeline", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--music")
    ap.add_argument("--words")
    ap.add_argument("--no-sfx", action="store_true")
    a = ap.parse_args(argv)
    rep = mix(a.video, a.voice, a.timeline, a.out, music_path=a.music,
              settings={"sfx": not a.no_sfx}, words_path=a.words)
    print(json.dumps(rep, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
