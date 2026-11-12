"""Mix tests on synthetic inputs made with ffmpeg (no network)."""
import json
import subprocess
from pathlib import Path

import numpy as np
import pytest

from pipeline import mix as mixmod
from pipeline.audio_util import ffmpeg_bin, ffprobe_bin, measure, probe_duration

FIX = Path(__file__).parent / "fixtures"


def ff(*args):
    subprocess.run([ffmpeg_bin(), "-y", "-hide_banner", "-v", "error", *args], check=True)


def packets(path):
    out = subprocess.run([ffprobe_bin(), "-v", "error", "-select_streams", "v:0", "-count_packets",
                          "-show_entries", "stream=codec_name,nb_read_packets", "-of", "json",
                          str(path)], capture_output=True, text=True, check=True).stdout
    s = json.loads(out)["streams"][0]
    return s["codec_name"], int(s["nb_read_packets"])


def pcm(path, start, end):
    raw = subprocess.run([ffmpeg_bin(), "-v", "error", "-ss", str(start), "-t", str(end - start),
                          "-i", str(path), "-vn", "-ac", "1", "-ar", "48000", "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32)


def rms(x):
    return float(np.sqrt(np.mean(x.astype(float) ** 2)))


@pytest.fixture(scope="module")
def work(tmp_path_factory):
    d = tmp_path_factory.mktemp("mix")
    ff("-f", "lavfi", "-i", "smptebars=duration=5:size=320x240:rate=25", "-c:v", "libx264",
       "-pix_fmt", "yuv420p", str(d / "video.mp4"))
    # "voice": 2 s of 220 Hz tone then silence, 5 s long
    ff("-f", "lavfi", "-i", "sine=f=220:d=2:r=44100", "-af", "apad=whole_dur=5,volume=-20dB",
       str(d / "voice.wav"))
    # long video for the music test: 8 s, voice 440 Hz the whole time, music 100 Hz
    ff("-f", "lavfi", "-i", "smptebars=duration=8:size=320x240:rate=25", "-c:v", "libx264",
       "-pix_fmt", "yuv420p", str(d / "video8.mp4"))
    ff("-f", "lavfi", "-i", "sine=f=2000:d=8:r=44100", "-af", "volume=-25dB", str(d / "voice8.wav"))
    ff("-f", "lavfi", "-i", "sine=f=150:d=3:r=44100", "-af", "volume=-10dB", str(d / "music.wav"))
    (d / "timeline8.json").write_text('{"duration": 8, "shots": [], "events": []}')
    return d


@pytest.fixture(scope="module")
def outputs(work):
    tl = FIX / "timeline.json"
    with_sfx = mixmod.mix(work / "video.mp4", work / "voice.wav", tl, work / "with.mp4")
    no_sfx = mixmod.mix(work / "video.mp4", work / "voice.wav", tl, work / "without.mp4",
                        settings={"sfx": False})
    return work / "with.mp4", work / "without.mp4", with_sfx


def test_duration_equals_video(work, outputs):
    out, _, _ = outputs
    assert abs(probe_duration(out) - probe_duration(work / "video.mp4")) < 0.05


def test_loudness_and_peak(outputs):
    out, _, _ = outputs
    m = measure(out)
    assert abs(m["lufs"] - (-16)) <= 1.0, m
    assert m["true_peak"] <= -1.0, m


def test_video_is_copied(work, outputs):
    out, _, _ = outputs
    assert packets(out) == packets(work / "video.mp4")
    assert packets(out)[0] == "h264"


def test_audio_format(outputs):
    out, _, _ = outputs
    info = subprocess.run([ffprobe_bin(), "-v", "error", "-select_streams", "a:0", "-show_entries",
                           "stream=codec_name,sample_rate,channels", "-of", "json", str(out)],
                          capture_output=True, text=True, check=True).stdout
    a = json.loads(info)["streams"][0]
    assert (a["codec_name"], a["sample_rate"], a["channels"]) == ("aac", "48000", 2)


def test_density_rules(outputs):
    _, _, rep = outputs
    kept = [(e["t"], e["sfx"]) for e in rep["events_kept"]]
    dropped = [(e["t"], e["sfx"]) for e in rep["events_dropped"]]
    assert kept == [(2.5, "whoosh"), (3.2, "pop"), (4.5, "chime")]
    assert (3.3, "tick") in dropped and (3.8, "pop") in dropped


def test_sfx_present(outputs):
    with_out, without_out, _ = outputs
    # whoosh at 2.5 s lands in the silent part after the voice
    a = rms(pcm(with_out, 2.55, 2.95))
    b = rms(pcm(without_out, 2.55, 2.95))
    assert a > 5 * b and a > 1e-4, (a, b)


def test_sfx_quieter_over_a_word(work):
    words = work / "words.json"
    words.write_text(json.dumps([{"text": "hi", "start": 0.0, "end": 2.0}]))
    tl = work / "tl_word.json"
    tl.write_text(json.dumps({"duration": 5, "shots": [],
                              "events": [{"t": 1.0, "sfx": "pop"}, {"t": 3.0, "sfx": "pop2"}]}))
    # second event has no wav -> skipped; first is over a word
    rep = mixmod.mix(work / "video.mp4", work / "voice.wav", tl, work / "w.mp4",
                     words_path=words)
    rep2 = mixmod.mix(work / "video.mp4", work / "voice.wav", tl, work / "w2.mp4")
    assert rep["events_kept"][0]["gain_db"] == pytest.approx(rep2["events_kept"][0]["gain_db"] - 3, abs=0.01)
    assert [e["sfx"] for e in rep["events_skipped"]] == ["pop2"]


def test_music_level_gap(work):
    out = work / "music.mp4"
    mixmod.mix(work / "video8.mp4", work / "voice8.wav", work / "timeline8.json", out,
               music_path=work / "music.wav")          # 3 s music file must loop to 8 s
    music = measure(out, afilter=",".join(["lowpass=f=400"] * 3))["lufs"]
    voice = measure(out, afilter=",".join(["highpass=f=800"] * 3))["lufs"]
    assert abs(voice - music - 19) <= 2.0, (voice, music)
    assert abs(probe_duration(out) - 8) < 0.05
    # fades: start and end of the bed are quiet
    low = lambda a, b: rms(pcm(out, a, b))
    assert low(0.0, 0.1) < low(3.0, 3.5)


def test_command_logged(outputs):
    out, _, _ = outputs
    log = Path(str(out) + ".ffmpeg.log").read_text()
    assert "-/filter_complex" in log and "loudnorm" in log and "-c:v copy" in log
