# whatif-3d

A kit that turns a one-line science topic into a 3D vertical video (1080x1920; writer-made videos keep the voice under 55 seconds, the hand-built chameleon reference runs 61 s).
A script and a voice are made first. Then a "show file" says which 3D props appear and when. The kit draws the show in a headless browser, adds sound and checks the result.

Read `docs/HELPER-RULES.md` first if you are an AI helper. It is binding.

## Money and uploads (read this)

- `--llm api` and `--mode api` call the paid Anthropic API. They cost money. Only Jacob runs them.
- The upload step sends a video to YouTube (always as private). Only Jacob runs it.
- Everything below uses the free "files" mode (a person or Claude Code writes the model's replies into files) and `--no-upload`.

## Folder map

| Folder or file | What is in it |
|---|---|
| `kit/` | The 3D engine, `kit/props/` (65 props), `kit/envs/` (7 environments), `kit/catalog.json` |
| `shows/<slug>/` | One video: `script.txt`, `voice.mp3`, `words.json`, `show.json`, and `out/` (results) |
| `pipeline/` | Python: writer, voice, mix, runner (`run.py`), upload, prompts in `pipeline/prompts/` |
| `tools/` | Node scripts: `validate`, `timeline`, `render`, `qa`, `still`, `catalog`, `gallery` |
| `tests/` | `tests/*.test.mjs` (kit) and `tests/py/` (Python) |
| `queue/` | Topic folders: pending, in-progress, done, failed, needs-props |
| `docs/` | The manuals (see "Read next") |
| `settings.yaml` | Non-secret settings (channel ID, writer settings) |

## Setup (once, PowerShell, repo root)

Open PowerShell in the repo folder (the folder that holds this README), then run:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r pipeline\requirements.txt
npm install
```

The `.venv` folder is git-ignored, so a fresh clone needs the first line; skip it if `.venv` already exists. Chrome and ffmpeg must be installed (see `docs/RENDERING.md`). Jacob's copy is in `E:\Youtube Project\whatif-3d`.

## Main commands (repo root, PowerShell)

Make a show from a topic, free, no upload. It stops with exit code 4 and prints only that the writer is waiting for a reply file in `shows/<slug>/llm/`. Open that folder, find the `.prompt.md` file with no matching `.reply.md` (the newest one; `shows/<slug>/out/run.log` also shows it), and write the reply file. Then run the same command again. Repeat until it finishes.

```powershell
.\.venv\Scripts\python.exe -m pipeline.run --topic "Why is the sky blue?" --slug sky-blue-2 --llm files --no-upload
```

Run only the writer (script, voice, show file; no video), in free files mode. It also stops with exit code 4; here the console itself prints "write the answer to" the reply file path and the prompt path. Write it and run the same command again:

```powershell
.\.venv\Scripts\python.exe -m pipeline.writer --topic "Why is the sky blue?" --slug sky-blue-2 --mode files
```

Check a show against the catalogue and the story rules (no browser; exit 0 means OK):

```powershell
node tools/validate.mjs chameleon --story-rules
```

Look at a show as a contact sheet of pictures (needs Chrome and 2 GB free memory), then open the file:

```powershell
node tools/still.mjs chameleon --sheet
```

The sheet is `shows/chameleon/out/stills/sheet.jpg`.

Run the tests (always these two; never `node --test tests/`):

```powershell
.\.venv\Scripts\python.exe -m pytest tests/py -q
npm test
```

`npm test` also rewrites `docs/CATALOG.md` and `kit/catalog.json` from the props and environments (the same as running `node tools/catalog.mjs`). Never edit those two files by hand.

## Read next

1. `docs/HOW-IT-WORKS.md` - the steps in one page.
2. `docs/AUTHORING.md` - add a prop, an environment, or a show by hand.
3. `docs/ASKING-CLAUDE.md` - how to ask Sonnet or Opus to change something.
4. `docs/KNOWN-PROBLEMS.md` - what is weak or unfinished.
5. `docs/WRITER.md`, `docs/SPEC.md`, `docs/RENDERING.md`, `docs/AUDIO.md`, `docs/QA.md` - details.
6. `STATUS.md` - where work stopped last time.
