# Known problems

Moved from `STATUS.md` on 2026-11-17. When you fix one, delete it here and say so in `STATUS.md`.

## Writer

- `tools/lib/story-rules.mjs` lines 11-12 have an out-of-date comment about how `writer.py` calls the validator (it says no flag, and mentions two prompt examples). Fix: update the comment.
- Words per second do not agree. `docs/AUDIO.md` says aim for 2.6 to 3.0, the writer prompt plans at 3.3, and the chameleon worked example's voice runs at about 2.7 (165 words, 60.6 s); the script target is now 180 to 195 words (aim 186). Real voiced scripts may run longer than planned. Fix: pick one number and use it in both places.
- No paid LLM call has been made. The cost per video (about $0.18 typical, about $0.70 worst case) is an estimate (see `docs/WRITER.md`).
- `pipeline/prompts/qa_repair_user.md` does not mention the story rules or the dial rule, so a picture-check repair that breaks them is thrown away and the earlier show is kept. Fix: add those rules to the prompt.
- In `pipeline/run.py` the writer step checks a fallback by `status`, while upload checks `fallback_note`. It works today, but it is two different fields.
- Out of scope from round 8: `pipeline/prompts/show_system.md` line 40 says label text up to 32 characters and line 77 says under 22 characters (older lines). Fix: make them agree.
- Sample videos (`shows/moon-gone`, `shows/sky-blue`) are first-pass quality.

## Engine and props

- `tools/validate.mjs` runs the story rules only once there are no other errors, so story problems reach the model one repair round late. This matters because a run gets only three repairs.
- `tools/qa.mjs` exits 1 when it crashes (for example "QA ERROR: only 0.8 GB of memory is free") and then writes no `qa.json`. The runner counts exit 1 as a normal step and carries on with the QA result "unknown". Fix: have the runner tell a crash (no `qa.json`) from a failed picture check.
- Weak props (from the contact sheets): heart looks like a valentine, bird flock, plant cell, bomb blast, magnet field lines (dotted), palm tree, plain rocks, asteroid cluster. Fix: rebuild with `docs/ASKING-CLAUDE.md` (Opus).
- Props that float (plane, submarine, blast) sink half into the ground on ground environments unless the show lifts them. The writer's prompt must say so, or the engine should handle it.
- A changing heart rate mid-shot makes the beat skip once.
- Out of scope from round 8: `tools/lib/story-rules.mjs` line 36 splits sentences differently from Python `sentences()` (curly closing quotes and "..." are not sentence ends in the JS split), so S numbers and story-rules sentence indexes can disagree.
- Added 17 Nov, wire: a width 0.2 wire shows a small dark wedge inside its bends when zoomed in (cause not found).
- Added 17 Nov, wire: the label side-choice change in `overlay.js` has no automated test.
- A colour dial from blue to orange passes through grey in the middle (seen on the microwave ball at 4.5 s, 30.5 s and 48.5 s), so the change reads as "gets dull".

## Picture checks

- The writer's picture check is skipped when memory is low, instead of waiting.
- Picture checks cannot tell when a prop is hidden behind the ground or another object.
- Picture checks cannot see fading (a half-faded label counts as visible) and use boxes larger than the real shapes.
- The microwave sheet frame at 40.5 s is almost black with faint marbles. Nobody has checked whether this is a dip transition or a bug.

## Audio

- Nobody has listened to the sound effects.
- Music loops with a hard cut if the track is shorter than the video.

## Workflow

- `.github/workflows/produce.yml` treats exit code 3 (needs props) as a red run, so a run where every topic needs props shows as a failure.
- (superseded 17 Nov) `npm test`'s "2-chunk render" test is skipped (not run, so not tested) when Chrome is missing or less than 2 GB of memory is free (machine memory, not code). Close other programs and run it again.
- With less than 2 GB of memory free (machine memory, not code), the full `npm test` fails 2 browser tests: the gallery test and the 2-chunk render test (a RAM guard stops them). Both pass when run alone with more free RAM. Check free RAM first, close other programs and run again. If Chrome is missing the render test also cannot run.
- Both this repo and the old 3D repo exist only on this PC (`DECISIONS-FOR-JACOB.md` items 1 and 2).
