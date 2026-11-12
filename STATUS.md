# STATUS

Last updated: 2026-11-12, about 11:15 UTC. Task numbers match PLAN.md.
Paused because the 5-hour Claude usage window is near its limit (85% at last reading; weekly 37%). It resets at 15:20 UTC on 12 Nov.

## Done (all committed; nothing pushed)
- Audit, plan, contract: `AUDIT.md`, `PLAN.md`, `docs/SPEC.md`. Items for Jacob: `DECISIONS-FOR-JACOB.md`.
- **Task 1, engine.** Plays any show file: shots, phrase anchors, 18 actions, self-framing camera, captions, labels that avoid each other, text, counters, icons, a checker with readable errors.
- **Task 2, audio.** Edge voice with exact word times, 9 own-made sound effects, mix to -16 LUFS.
- **Task 3, render.** `node tools/render.mjs <slug>` makes a 1080x1920 MP4 with voice. Gallery tool makes picture sheets of every prop.
- **Task 4, catalogue.** 61 props and 7 environments. I looked at every batch's picture sheet.
- **Task 5, picture checks.** `node tools/qa.mjs <slug>`: black or frozen picture, things out of frame, subject too small, text collisions, pacing, video size/length/loudness. Gives pass, warn or fail with a fix hint per finding.
- VERIFIED by me with nothing else running: 227 of 227 kit tests pass; 28 of 28 audio tests pass; the demo show passes the checker; picture checks on the demo give "warn" with 0 fails.

## Measured
- Render of the 54.7 s demo at 1080x1920: 76 s on this PC. Limited to 2 CPUs (a stand-in for a private-repo GitHub runner): about 126 s. Limited to 4 CPUs: about 92 s. Helper's measurements; the CPU limit leaked slightly, so a real runner may be a bit slower. The old kit's figure was about 24 minutes.
- Not measured: anything on a real GitHub runner (needs a push).

## Not started
- **Task 6, the writer** (topic → script → voice → show file, with repair loop and a free "files" mode that needs no API key). Brief ready: `docs/briefs/writer.md`. **Next step.**
- **Task 7, runner + private upload with wrong-channel guard + workflow.** Brief ready: `docs/briefs/runner-upload.md`.
- **Task 8, finished sample videos** with music and sound effects. None exists yet.
- **Task 9, docs** for a weaker model: README, the rest of AUTHORING, one-page HOW-IT-WORKS, ASKING-CLAUDE, KNOWN-PROBLEMS.

## What you can look at now
- Every prop and environment as pictures: `docs\gallery\props-1.jpg` (and -2, -3, ...) and `docs\gallery\envs.jpg`. These were made before the last framing change; regenerate with `node tools/gallery.mjs`.
- Larger views of each batch: `shows\zz-a\out\stills\sheet.jpg` (space, physics), `zz-b` (nature, places), `zz-c` (people, body, animals, the chameleon), `zz-d` (machines, charts, new environments).
- A real video from the new kit: `shows\demo-sky\out\demo-sky.mp4`. Caveats: it is a feature test, not a finished explainer; it was rendered before the framing polish; it has voice only (no music or effects) and the voice is the quiet -32 LUFS file, so it plays quietly.
- The list of everything the kit can show: `docs\CATALOG.md`.

## Known problems
- **No finished, mixed sample video yet.**
- No show has yet been written by an LLM from a topic; the writer is not built.
- Weak props (my view from the sheets): heart looks like a valentine, bird flock, plant cell, bomb blast, magnet field lines (dotted), palm tree, plain rocks, asteroid cluster.
- Props that float (plane, submarine, blast) sink half into the ground on ground environments unless the show lifts them. The writer's prompt must say so, or the engine should handle it.
- Picture checks cannot see fading (a half-faded label counts as visible) and use boxes larger than the real shapes.
- A changing heart rate mid-shot makes the beat skip once.
- Nobody has listened to the sound effects.
- `pipeline/mix.py` needs ffmpeg 7 or newer; GitHub's Ubuntu runners may ship an older one (unchecked).
- Music loops with a hard cut if the track is shorter than the video.
- No paid LLM call has been made; cost per video ($0.05-0.12) is an estimate.
- Both this repo and the old 3D repo exist only on this PC (DECISIONS-FOR-JACOB.md items 1 and 2).

## How to continue
Say: "Continue PLAN.md from task 6. Read STATUS.md, docs/SPEC.md and docs/HELPER-RULES.md first."
Tasks 6 and 7 can run in parallel (briefs are in `docs/briefs/`). Task 8 needs task 6.
