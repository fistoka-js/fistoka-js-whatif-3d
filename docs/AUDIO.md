# AUDIO

Code: `pipeline/voice.py`, `sfx.py`, `mix.py`, `audio_util.py`. Tests: `tests/py/` (run `.venv\Scripts\python -m pytest tests/py -m "not network"`; add `-m network` for the real Edge test).

## Voice and word timings (`voice.py`)
- `python -m pipeline.voice shows/<slug>` reads `script.txt`, writes `voice.mp3` and `words.json` in that folder.
- Code: `make_voice(text, out_dir, voice="en-US-AndrewNeural", rate="+12%")` returns `{duration, word_count, words_per_second, longest_pause}`.
- Timings come from Edge's own WordBoundary events (no Whisper). Edge's words have no punctuation, so each one is matched back to the script's whitespace tokens, which keep their punctuation (`ocean.`, `That's`). Pure-punctuation tokens (`—`) join the previous word (`first —`). Edge splitting `10,000` or `two-thirds` into pieces, or merging words, is handled. Any other mismatch raises `AlignmentError` showing both word lists around the problem; nothing is guessed.
- `words.json`: `[{"text","start","end"}]`, seconds, 3 decimals.
- Retries: 3 attempts, waiting 1 s then 2 s.

Script rules: pauses come from punctuation (comma short, full stop longer, `...` and `—` give a beat). Aim for 2.6 to 3.0 words per second. One idea per sentence. Write numbers the way you want them read.

### Swapping the TTS provider
Write a function `my_tts(text, voice, rate, mp3_path)` that writes the mp3 and returns `[{"text","start","end"}]` (seconds, one entry per spoken word). Add it to the `PROVIDERS` dict at the bottom of `voice.py`, then call `make_voice(..., provider="name")`. Alignment and stats are shared. If the new engine has no word times, you must derive them yourself.

## Sound effects (`sfx.py`)
Nine sounds made with numpy only: whoosh, pop, tick, chime, shimmer, rumble, buzz, rise, thud. 48 kHz mono 16-bit, 5 ms fade in, 20 ms fade out, peak -3 dBFS. Fixed seeds, so output is identical every run. Regenerate with `python -m pipeline.sfx` (rewrites `assets/sfx/*.wav` and `SOURCES.csv` with sha256). Licence: own work.

## Music
Optional. See `assets/music/README.md`. Looped or trimmed to the video length, starts `music_start` seconds into the file, fades in 1 s and out 2 s, sits 19 LUFS under the voice.

## Mix and loudness (`mix.py`)
`python -m pipeline.mix --video V --voice A --timeline T --out O [--music M] [--words W] [--no-sfx]`

Inputs: `timeline.json` = `{"duration", "shots": [{id,start,end}], "events": [{"t": 3.21, "sfx": "pop"}]}`.
1. The voice is the reference (its LUFS is measured).
2. Music and each sfx are set relative to it. Sfx level is its RMS (stand-in for LUFS, since clips are too short to gate).
3. Sfx rules, in time order: drop an event less than 0.25 s after the last kept one; drop an event whose name was already kept within 1.0 s. Events on a spoken word (needs `--words`) get 3 dB less. Unknown sfx names are skipped and listed in the report.
4. Everything is summed, padded or trimmed to the video length, then two-pass `loudnorm` to the target (linear, no squashing), AAC 192k 48 kHz stereo, muxed with `-c:v copy` (video never re-encoded).
5. Next to the output: `<out>.ffmpeg.log` (all commands) and `<out>.filter.txt` (the filter graph).

### Settings (top of `mix.py`, pass a dict to override)
| key | default | meaning |
|---|---|---|
| sfx | True | False = no effects |
| music_below_voice_db | 19 | music under voice, LUFS |
| sfx_below_voice_db | 16 | sfx under voice |
| sfx_over_word_extra_db | 3 | extra quieting over a spoken word |
| sfx_min_gap | 0.25 | min seconds between kept events |
| sfx_same_name_gap | 1.0 | min seconds between the same sfx |
| music_start | 0.0 | seconds into the music file |
| music_fade_in / out | 1.0 / 2.0 | seconds |
| target_lufs | -16 | final loudness |
| loudness_range | 50 | LRA target (high keeps loudnorm linear) |
| true_peak | -1.5 | ceiling, dBTP |
| audio_bitrate | 192k | AAC |
| sample_rate | 48000 | Hz |

`measure(path)` returns `{"lufs","true_peak","duration"}`.

## Known limits
- Music loops with a hard cut at the seam (use a track longer than the video).
- Sfx RMS, not true LUFS; very short sounds are approximate.
- `loudnorm` linear mode needs headroom; very peaky mixes fall back to dynamic mode.
- Edge TTS needs internet and is an unofficial service; it can change.
- Needs ffmpeg 7+ (uses `-/filter_complex`).
