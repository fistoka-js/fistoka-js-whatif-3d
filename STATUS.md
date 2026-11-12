# STATUS

Last updated: 2026-11-11 (late evening). Kept short and honest. Task numbers match PLAN.md.

## Done
- Audit of both repos, both videos, policy and licences: `AUDIT.md`.
- Decision and plan: `PLAN.md`. Contract for the new kit: `docs/SPEC.md`.
- Items needing Jacob: `DECISIONS-FOR-JACOB.md`.
- New repo folder created with three.js and the browser driver installed.

- Task 2, audio (commit `ac00cac`): Edge voice with exact word times (no Whisper), 9 own-made sound effects, mix to -16 LUFS, mux without re-encoding video. VERIFIED: I re-ran the tests, 28 pass (plus 1 network test the helper ran). Nobody has listened to the sound effects yet.

## In progress (helpers running)
- Task 1: engine core (Opus helper).

## Not started
- Tasks 3-9: render tool, prop library, QA tool, writer, pipeline + upload + workflow, sample videos, docs.

## Sample videos
- None yet from the new kit.
- For comparison, from the OLD kit: `E:\Youtube Project\_fable_work\out\sky-blue-head.mp4` (current sky-blue, rendered by me from the committed state).

## Known problems
- Nothing in the new kit has been rendered yet.
- No paid LLM call has been made; cost per video is an estimate.
- GitHub runner render time is not re-measured.
- `pipeline/mix.py` uses an ffmpeg option that needs ffmpeg 7 or newer. GitHub's Ubuntu runners may ship an older one (unchecked). To settle when the workflow is built (task 7).
- Music loops with a hard cut if the track is shorter than the video.
