# STATUS

Last updated: 2026-11-12, about 16:40 UTC. Task numbers match PLAN.md.
Paused near the 5-hour usage limit (84% at last reading; weekly 49%). It resets at 20:40 UTC on 12 Nov.

## Done (all committed; nothing pushed)
- Audit, plan, contract: `AUDIT.md`, `PLAN.md`, `docs/SPEC.md`. Items for Jacob: `DECISIONS-FOR-JACOB.md`.
- Task 1 engine, task 2 audio, task 3 render, task 4 catalogue (61 props, 7 environments), task 5 picture checks.
- **Task 6, the writer.** Topic → script → fact check → voice → show file, with repair loop, fallback and a free "files" mode. The script prompt and the fact-check module reuse the existing pipeline's.
- **Task 7, runner + upload + workflow.** `python -m pipeline.run` runs every step and resumes after a failure. Upload is always private and refuses unless the channel ID matches `settings.yaml`. Workflow is manual-only.
- VERIFIED by me: 150 Python tests and 227 kit tests pass.
- **First end-to-end test (task 8, first pass).** Two topics went from a one-line topic to a finished, mixed video with no hand editing. A fresh Sonnet helper played the paid model and saw only the prompt files. "Moon" needed 0 repair rounds, "sky" needed 1. Each run took about 2.5 minutes of machine time.

## Sample videos (first pass: they work, quality is middling)
In `E:\Youtube Project\whatif-3d\shows\`:
- `moon-gone\out\moon-gone-final-music.mp4` (39 s, -16 LUFS, with music) and `moon-gone-final.mp4` (no music).
- `sky-blue\out\sky-blue-final-music.mp4` (38 s, -16 LUFS, with music) and `sky-blue-final.mp4`.
- Frame grids: `moon-gone\out\stills\sheet.jpg`, `sky-blue\out\stills\sheet.jpg`. Review notes with the claims to fact-check: `review.md` in each folder.
- My honest view (OPINION): about 6 out of 10. Good: varied environments, solid 3D objects, clean labels, correct narration. Weak: both are under 40 s; some shots do not show what is being said (no picture of light scattering in the sky; Earth's tilt is not visible); the short blue wave is ugly; the big white sun is a blob; the last Moon shot hides the person behind the ground. Nobody has listened to the audio; only the levels were measured.
- The old kit's sky-blue for comparison: `E:\Youtube Project\_fable_work\out\sky-blue-head.mp4`.

## Jacob's verdict on the first samples, and what changes
- Jacob: the pictures do not match the script well; not as good as the chameleon video. I agree after comparing all three at one frame per second (frames only, no listening). The samples are slideshows of objects; the chameleon video follows one changing mechanism. Details: PLAN.md, "Round 2 finding".
- My earlier "6 out of 10" was too kind, and the automatic picture check's "pass" on sky-blue shows that check does not measure this.

## Not done
- **Round 2** (rewritten): engine additions (shared values, subjects that persist across shots, changes that run from word to word), the chameleon video's mechanisms ported in, the chameleon video rebuilt in the new kit as the acceptance test, checker rules that fail a slideshow, and a writer that plans script and pictures together. Brief: `docs/briefs/round2-improvements.md`. **Next step. Nothing of it is built yet.**
- Then three new sample videos, then task 9 docs.
- A real paid run (needs Jacob), a real GitHub run (needs a push), a real upload (needs the second channel).

## Known problems
- Sample videos are first-pass quality (see above).
- The writer's picture check is skipped when memory is low, instead of waiting.
- Picture checks cannot tell when a prop is hidden behind the ground or another object.
- Weak props (my view from the sheets): heart looks like a valentine, bird flock, plant cell, bomb blast, magnet field lines (dotted), palm tree, plain rocks, asteroid cluster.
- Props that float (plane, submarine, blast) sink half into the ground on ground environments unless the show lifts them. The writer's prompt must say so, or the engine should handle it.
- Picture checks cannot see fading (a half-faded label counts as visible) and use boxes larger than the real shapes.
- A changing heart rate mid-shot makes the beat skip once.
- Nobody has listened to the sound effects.
- Music loops with a hard cut if the track is shorter than the video.
- No paid LLM call has been made; cost per video ($0.05-0.12) is an estimate.
- Both this repo and the old 3D repo exist only on this PC (DECISIONS-FOR-JACOB.md items 1 and 2).

## How to continue
Say: "Continue with docs/briefs/round2-improvements.md (parts 1 to 5), then three samples, then task 9. Read STATUS.md, PLAN.md (Round 2 finding) and docs/HELPER-RULES.md first."
