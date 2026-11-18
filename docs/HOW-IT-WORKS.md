# How it works (one page)

One topic goes in. A private-ready vertical video comes out. `python -m pipeline.run` runs seven steps in order. A finished step is skipped, so a failed run resumes where it stopped. The rule differs by step: timeline, render, mix and qa are skipped when their output file is newer than their inputs; writer is skipped when `writer.json` says `ok` or `fallback` and `show.json` exists (editing `script.txt` does not re-run it); upload is skipped when `upload.json` exists; review always runs. `--from-step NAME` forces that step and all later ones to run again.

## The show file idea

A video is described by `shows/<slug>/show.json` (full contract: `docs/SPEC.md`). It holds:

- **Shots**: a time slice of the video. A shot starts at a spoken word (an "anchor") and lasts to the next shot. Each shot has an environment, props, a camera and actions (appear, move, label, change a value).
- **Scenes and persistent subjects**: a shot with `"continue": true` keeps the same environment and the same props as the shot before. One scene is one subject that stays on screen while the story changes it. A good show has 2 to 4 scenes. A slideshow of different objects is a bad show.
- **Dials**: a named number that changes when words are spoken (for example "red" going from 0 to 1). Several props and the background colour can follow one dial, so many things change together.
- The **story rules** check that the picture changes with every spoken sentence and does not sit still for more than 3.5 seconds (SPEC section 14).

## The steps

| Step | What it runs | Reads | Writes (in `shows/<slug>/`) |
|---|---|---|---|
| writer | `python -m pipeline.writer` (script, fact check, voice, storyboard, show file, repair loop, fallback; `docs/WRITER.md`) | the topic, `kit/catalog.json`, `pipeline/prompts/` | `script.txt`, `voice.mp3`, `words.json`, `storyboard.json`, `storyboard.md`, `show.json`, `review.md`, `writer.json`, and `llm/` in files mode |
| timeline | `tools/validate.mjs` then `tools/timeline.mjs` | `show.json`, `words.json` | `out/timeline.json` (shot times, sound events) |
| render | `tools/render.mjs` (`docs/RENDERING.md`) | `show.json`, `words.json`, `voice.mp3` | `out/<slug>.mp4` (picture and voice) |
| mix | `pipeline.mix` (`docs/AUDIO.md`) | the video, voice, timeline, optional music | `out/<slug>-final.mp4` (voice, effects, music, loudness) |
| qa | `tools/qa.mjs` (`docs/QA.md`) | the show and the final video | `out/qa.json`, `out/qa-sheet.jpg` |
| review | the runner | all of the above | `review.md` (a "Pipeline run" block) |
| upload | `pipeline/upload.py` | the final video, `settings.yaml` | `upload.json` |

Rules for the last steps:

- Upload is always private. It refuses unless the channel ID in `settings.yaml` matches. It refuses a fallback show and a picture check that says `fail`. Only Jacob runs it.
- A fallback show (a plain slideshow made when the model could not do better) fails the topic. `--allow-fallback` renders it for a local test only. It is never uploaded.
- `--llm api` costs money. Use `--llm files` (free) for tests.

## Exit codes

The runner (`python -m pipeline.run`):

| Code | Meaning |
|---|---|
| 0 | At least one video was finished |
| 1 | No video was made and at least one topic failed (see `queue/failed/` and `shows/<slug>/out/run.log`) |
| 2 | Bad command line |
| 3 | No video was made, none failed, and at least one topic needed props the catalogue lacks (`queue/needs-props/`) |
| 4 | Files mode: waiting for a reply file. Add it, run the same command again |
| 5 | Nothing to do: the queue is empty |
| 6 | Upload refused by the channel guard or the login. A queued topic goes back to pending (a `--topic` run: fix the cause, repeat the command) |

The writer on its own (`python -m pipeline.writer`) uses 0 (show written), 1 (failed), 2 (bad command), 3 (needs props), 4 (waiting for a reply). Details are in `docs/WRITER.md`.

The Node tools (`validate`, `timeline`, `render`, `qa`, `still`): 0 is OK, 1 is a problem with the show or the page (for `qa` it means the picture check failed or the show cannot play, or that `qa` crashed, for example low memory, in which case no `qa.json` is written; the runner treats all of these as a normal run and reports the QA result as "unknown" after a crash), 2 is a bad command. `render` also exits 130 when it is stopped by a termination signal (for example Ctrl+C); it cleans up its temporary files first.

## The needs-props path

If the writer decides no prop in the catalogue can show the topic's central mechanism, it sets `feasible: false`. It writes `shows/<slug>/NEEDS-PROPS.md` (what prop is needed and what is missing) and exits 3. For a queued topic the runner moves it to `queue/needs-props/` (with `--topic` the queue is not touched). Icons and bar charts are not allowed as stand-ins. Example: `shows/black-hole-light/NEEDS-PROPS.md`.

To go on: build the missing prop (`docs/AUTHORING.md`, and `docs/ASKING-CLAUDE.md` has a ready prompt), then run again. In files mode (the default) first delete the folder `shows/<slug>/llm/` (or at least the reply files from `01-script.reply.md` on), because the writer replays earlier replies without looking at the prompt and the old "feasible: false" answer would stop the run at exit 3 again; api mode asks the model again, so nothing needs deleting. A one-off `--topic` run: then repeat the same command. A queued topic: first move its file from `queue/needs-props/` back to `queue/pending/`.

## Read for details

- `docs/WRITER.md`: the writer, its prompts, files mode, settings, repair loop.
- `docs/SPEC.md`: the show file, anchors, camera, actions, dials, story rules.
- `docs/RENDERING.md`: how frames are drawn and joined.
- `docs/AUDIO.md`: voice, effects, music, loudness.
- `docs/QA.md`: the picture checks.
- `docs/PIPELINE.md`: the runner, the queue folders, the GitHub workflow.
