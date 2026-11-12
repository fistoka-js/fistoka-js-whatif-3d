# Brief: pipeline runner, private upload with channel guard, GitHub workflow

For a helper agent. Read `docs/HELPER-RULES.md` first and obey it exactly. Then read `docs/SPEC.md` §9, `docs/AUDIO.md`, `docs/RENDERING.md`, `docs/QA.md`, `docs/WRITER.md`.

Reference, read-only (a clean copy of the old repo's committed files, no secrets in it): `E:\Youtube Project\_fable_work\ref-head\verticals\upload.py`, `retry.py`, `state.py`, `queue_add.py`, `ref-head\scripts\setup_youtube_oauth.py`, `ref-head\.github\workflows\produce.yml`. Reuse their approach to the YouTube upload, the retry helper, how secrets are named and passed in the workflow, and how queue state is committed back. NEVER open any real token, secret or config file anywhere; you only need the code.

You own: `pipeline/run.py`, `pipeline/upload.py`, `pipeline/queue.py`, `pipeline/settings.py`, `settings.yaml` (non-secret settings only), `queue/**`, `scripts/setup_youtube_oauth.py`, `tests/py/test_run*.py`, `tests/py/test_upload*.py`, `tests/py/test_queue*.py`, `.github/workflows/produce.yml`, `docs/CHANNEL_SETUP.md`, `docs/PIPELINE.md`. Do not edit anything else. No uploads, no paid API calls, no pushes in your session.

## Runner: `python -m pipeline.run [--topic "..."] [--slug s] [--from-step name] [--no-upload] [--llm api|files]`

Steps, each a small function, each skipped if its output already exists and inputs have not changed (so a failed run resumes): pick topic (from `queue/pending/*.json`, oldest first, unless `--topic`) → writer (script, voice, show; see WRITER.md) → `node tools/timeline.mjs` → `node tools/render.mjs` → `python -m pipeline.mix` (music: a track picked from `assets/music/` by a seeded choice from the slug if any files with a ledger entry exist, else none) → `node tools/qa.mjs --video` on the final file → write/extend `shows/<slug>/review.md` → upload (private) unless `--no-upload` → move the topic file to `queue/done/` (or `queue/failed/` with the reason and log tail, or `queue/needs-props/` when the writer says the catalogue cannot show it; then try the next pending topic, at most 3 per run).
One log file per run in `shows/<slug>/out/run.log`. Clear one-line status per step on the console. Exit codes documented.

## Upload: `pipeline/upload.py`

- Always `privacyStatus: private`. There is no setting to change this; a test asserts the request body.
- **Channel guard**: before uploading, call `channels.list(mine=true)` and compare the channel ID with `channel_id` in `settings.yaml`. If `channel_id` is empty or different: do not upload; fail with a message that shows both IDs and the channel title. Unit tests with a fake YouTube client: match → uploads; mismatch → refuses; empty setting → refuses.
- Credentials come only from environment variables / files named exactly as in the old workflow, read at upload time, never logged.
- Title, description, tags from the writer's output; add the synthetic-voice note line to the description only if `settings.yaml` says so (default off).
- Retries with backoff on transient errors (resumable upload).

## Workflow `.github/workflows/produce.yml`

Manual trigger only (`workflow_dispatch`, inputs: `upload` true/false default false, `topic` optional). No schedule. Concurrency group `produce-whatif`, `cancel-in-progress: false`. Ubuntu 24.04, Python 3.12, Node 20, Chromium via Playwright with system libraries, ffmpeg (check the version the mix step needs: see AUDIO.md; install a newer static build if the runner's is too old, or note the problem), `timeout-minutes: 60`. Steps: checkout, setups, `npm ci`, `pip install -r pipeline/requirements.txt`, tests (fast ones), run the pipeline, upload the MP4 + review.md + qa-sheet as artifacts (7 days), commit queue state back (staging the queue files by name only). Secrets used only in the run step. Say clearly in the docs that it is untested until the repo is pushed.

## Docs

- `docs/CHANNEL_SETUP.md`: step-by-step for Jacob (no coding background): create the second channel (he does it), run the OAuth setup locally while signed into the NEW channel, store the result as GitHub secrets (exact names, where to click), put the channel ID in `settings.yaml`, how to confirm the guard works with `--no-upload` first. Say whether the same Google Cloud project can be reused (check the setup script before saying so).
- `docs/PIPELINE.md`: one page: the steps, where each file lands, how to resume, what each failure folder means.

## Tests

Runner with every external step faked (resume behaviour, failure routing, at most 3 topics); upload tests above; queue tests. All pytest tests pass; paste the summary line. Report under 400 words.
