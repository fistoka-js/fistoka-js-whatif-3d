# PIPELINE: from topic to private upload

```
python -m pipeline.run [--topic "..."] [--slug s] [--from-step name] [--no-upload] [--llm api|files]
```

Takes the oldest topic in `queue/pending/` (or `--topic`), makes a video, optionally uploads it as **private**. Does at most 3 topics per run (`max_topics_per_run` in `settings.yaml`); a topic that fails or cannot be shown does not stop the next one.

## Steps and where files land (`shows/<slug>/`)

| # | step | command behind it | output |
|---|---|---|---|
| 1 | writer | `python -m pipeline.writer` (docs/WRITER.md) | `script.txt`, `voice.mp3`, `words.json`, `show.json`, `review.md`, `writer.json` |
| 2 | timeline | `tools/validate.mjs`, `tools/timeline.mjs` | `out/timeline.json` |
| 3 | render | `tools/render.mjs` | `out/<slug>.mp4` (picture + raw voice) |
| 4 | mix | `python -m pipeline.mix` | `out/<slug>-final.mp4` (sound effects, optional music, loudness) |
| 5 | qa | `tools/qa.mjs --video` | `out/qa.json`, `out/qa-sheet.jpg` |
| 6 | review | the runner | a "Pipeline run" block in `review.md` (length, loudness, QA, upload) |
| 7 | upload | `pipeline/upload.py` | `upload.json` (private video id) |

Music: if `assets/music/LEDGER.csv` lists mp3 files that exist, one is picked by a fixed choice from the slug; otherwise no music.
A picture check of `fail` stops the upload (the video is kept). `warn` is allowed; look at `out/qa-sheet.jpg`.
One log per show: `out/run.log`. The console shows one line per step.

## Resuming

A step is skipped when its output exists and is newer than its inputs. So after a failure, fix the cause and run again; it continues at the step that failed. To redo a step and everything after it: `--from-step render` (names: writer, timeline, render, mix, qa, review, upload). Upload is never repeated once `upload.json` exists; delete that file only if you deleted the video on YouTube.

## Queue folders (`queue/`)

| folder | meaning |
|---|---|
| `pending/` | waiting, oldest `added` date first |
| `in-progress/` | being made now, or stopped half way (files mode waiting for a reply, or the run was cut off). The next run resumes these first |
| `done/` | video made (and uploaded unless `--no-upload`) |
| `failed/` | a step failed; the file holds `reason` and `log_tail`. To try again, move it back to `pending/` |
| `needs-props/` | the writer says the catalogue cannot show it; `shows/<slug>/NEEDS-PROPS.md` lists what is missing |

With `--topic` the queue is not touched.

## Exit codes

0 a video was finished. 1 every topic tried failed. 2 bad command. 3 every topic tried needed props. 4 files mode is waiting for a reply file (run the same command again after adding it). 5 queue empty. 6 upload refused by the channel guard or the login (topic goes back to `pending/`; fix `settings.yaml` or the login, then run again).

## Upload rules

Always private. Before uploading it asks YouTube which channel the saved login belongs to and refuses unless that equals `channel_id` in `settings.yaml` (empty = refuse). Setup: docs/CHANNEL_SETUP.md.

## GitHub workflow (`.github/workflows/produce.yml`)

Manual only (Actions tab, Run workflow; inputs `upload` and `topic`). **Untested until the repo is pushed and run once.** It installs the standard Ubuntu ffmpeg, runs tests, runs the pipeline, saves the final video, `review.md`, QA sheet and log as a downloadable artifact for 7 days, and commits only the `queue/` changes back. It does not commit `shows/` (generated scripts and voices live only in the artifact unless you decide otherwise).
