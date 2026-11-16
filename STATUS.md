# STATUS

Last updated: 2026-11-16 (round 2 part 5, the writer, built; review hit the 8-round cap with 0 clean; round 8's 7 problems fixed in one last unreviewed pass; committed at the cap with Jacob's approval; beat word checks cut to a short exact-phrase list, new review loop started; second review loop hit the cap, final 2 fixes applied). Task numbers match PLAN.md.

## Where work stopped (read this first)
- **Round 2 part 3b is committed** as `36b2c0a` (not pushed). It added the crash fix, camera `fill` and `glide`, icon `size` / colour / longer `until`, studio `haze`, a smoother camera "up" during glides, the picture check using each prop's real outline, and a much closer chameleon rebuild. It hit the 8-round review cap with no clean pass; Jacob approved committing at the cap on 13 Nov. Remaining visual gaps against the approved video: no leaf backdrop, a smaller tuner, darker middle backgrounds, fewer hearts and no red backdrop in the "emotions" part, and a gold end chameleon where the original is light green. Nobody has listened to the audio yet. Notes: `docs/briefs/part3b-open-review.md`.
- **Round 2 part 5 (the writer) is built and committed** (not pushed). See the part 5 section below; the round-5 problems in `docs/briefs/part5-open-review.md` were fixed on 16 Nov. Review hit the 8-round cap on 16 Nov; round 8's 7 problems were fixed in one last unreviewed pass (list in `docs/briefs/part5-open-review.md`).
- Checks on 16 Nov after the last part 5 fix: pytest 199 passed; `npm test` 293 pass, 0 fail (browser tests skip when less than 2 GB memory is free); `validate chameleon --story-rules` OK with 1 warning (the 10.12 s "emotions" shot).
- **Outputs are fresh** (made 13 Nov after the last change to `show.json` and the code): `shows\chameleon\out\timeline.json`, `chameleon.mp4`, `chameleon-final.mp4` (no music, -16.0 LUFS, true peak -1.5 dBFS), `qa.json` and `compare\remake-sheet-1..4.jpg`.
- Usage reset on 16 Nov (weekly resets again 23 Nov 09:00 UTC).
- Pushed: commits up to `bb86990` ("Status timestamp") are on GitHub at `fistoka-js/fistoka-js-whatif-3d` (private). Every later push needs a new yes from Jacob.
- The approved chameleon video for side-by-side comparison: `E:\Youtube Project\youtube-3d-pipeline\kit\render\chameleon-1080-stage2-final.mp4` (61 s, 1080x1920, Andrew +12% voice at about -32 LUFS). Read only; never write in that folder.

## Jacob's priority order (13 Nov; work stops about 16 Nov)
1. Keep this file up to date.
2. Finish round 2 until the chameleon rebuilt in the new kit is about as good as the approved video (stills and frame grids side by side, and measure voice and loudness). This comes before extra props.
3. Three new sample videos on different topics, each made by the pipeline from a one-line topic. Paths go in this file.
4. Task 9 docs for a weaker model: README, how the pipeline works, how to add a prop or environment, how to ask Sonnet or Opus to change something, known problems.
5. Leftovers from his decisions: music logistics, the -16 / -20 loudness comparison files, a Kokoro voice sample, prepared paid-test commands (see DECISIONS-FOR-JACOB.md, "Jacob's answers").
At about 90% usage: finish what is in flight, update this file and DECISIONS-FOR-JACOB.md, end cleanly.

## Done (all committed; pushed to GitHub up to commit bb86990)
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

## Round 2 so far (committed)
- Engine: shared values ("dials") that several things follow, subjects that persist across shots, changes that run from one spoken word to another, a "dive" transition. VERIFIED by me on a demo sheet.
- The approved video's own mechanisms are now props: `lattice`, `layer_stack`, `light_wave`, `tuner`. I compared their sheet with the approved frames.
- New checker rules (`--story-rules`): every sentence needs a visible change, nothing may sit still over 3.5 s. Both first samples (moon-gone, sky-blue) FAIL them, as they should.
- **Acceptance test: the chameleon video rebuilt in the new kit** from a show file. `shows\chameleon\out\chameleon-final.mp4` (61 s, -16 LUFS, with sound effects, no music). Compare its frames `shows\chameleon\out\compare\remake-sheet-1..4.jpg` with the originals in `E:\Youtube Project\_fable_work\watch\cham\`. My view from 0-40 s (OPINION): same subject, same changes on the same words, same colour journey; visibly simpler: smaller hero chameleon, no leaf backdrop, camera cuts where the original glides, a haze band at the top of the background, small flat X and ? icons. 40-61 s I have not looked at myself; the helper calls it "close". Nobody has listened to it.
- VERIFIED: 271 kit tests and 150 Python tests pass.

## Round 2 part 5, the writer (built, committed)
- Review: all 8 review rounds used (the cap), 0 clean. Round 8's 7 problems were fixed in one last unreviewed pass on 16 Nov; Jacob approved committing at the cap.
  - The script call now asks for 150 to 175 words (about 3.3 words a second) and a beat list: for each sentence, the subject on screen, what visibly changes, and the dial that drives it. The voice is capped at 55 s.
  - A sentence with no visible change gets at most one rewrite per run. The same check also runs after a fact-check redraft and after a shorten (reworded text from a shorten is fact-checked again before it is voiced).
  - Model-written shows are checked with `--story-rules`. A show is "ok" only with no errors, no "too many scenes" warning, no "no persistent subject" warning, and at least one dial bound to two or more things.
  - If no prop can show the mechanism (`feasible: false`), the writer writes `NEEDS-PROPS.md`, exits with code 3, and the topic goes to `queue/needs-props/`.
  - A fallback (slideshow) show counts as a failed topic in `run.py` unless `--allow-fallback` is given, and upload refuses a fallback show.
  - Chameleon is the only worked example in the prompt. Files mode (no API) still works.
  - 16 Nov: an extra review after the commit found 6 problems, fixed in `dd51869`. Then the beat word checks were cut down to a short fixed list of exact phrases (Jacob's decision), because looser checks kept producing false alarms and misses; a new review loop was started.
  - 16 Nov: second review loop after the beat-check simplification ran 8 rounds (cap), round 7 clean, round 8 found 2 small problems, fixed in one last unreviewed pass; Jacob approved committing.

## Not done
- **Round 2 part 3b**: finish the 8 review items in `docs/briefs/part3b-open-review.md`, re-make the chameleon video and sheets, then get two clear reviews in a row and commit. **Next step.**
- Still visibly different from the approved video after 3b (lead's opinion from frames): no leaf backdrop, no section headings at the top, smaller tuner, darker middle backgrounds, smaller chameleons in the "emotions" part. Decide after 3b whether to close these before part 5.
- **Round 2 part 5, still to do**: the fresh-agent files-mode re-test on 2 topics; a second worked example (to come from the first sample that passes by eye); the three samples; then task 9 docs.
- Three new sample videos, then task 9 docs.
- A real paid run (needs Jacob), a real GitHub run (needs a push), a real upload (needs the second channel).
- Work from Jacob's answers, none started: music files for GitHub runs, loudness as one named setting plus a -16 and a -20 comparison file, the paid-test commands, the "build a missing mechanism" prompt, committing `shows/<slug>/` from the workflow, checking `docs/CHANNEL_SETUP.md`, a Kokoro sample.
- Check `E:\Youtube Project\notes\project-notes-3d-and-animation.md` against AUDIT.md. The lead read a summary only. It may change the Audio Library redistribution concern and the note about the 2D track decision. Not done.

## Known problems
- `tools/lib/story-rules.mjs` lines 11-12 have an out-of-date comment about how `writer.py` calls the validator (it says no flag, and mentions two prompt examples).
- `docs/AUDIO.md` says aim for 2.6 to 3.0 words a second, while the writer prompt plans at 3.3.
- `tools/validate.mjs` runs the story rules only once there are no other errors, so story problems reach the model one repair round late. This matters for the samples, since a run gets only two repairs.
- `.github/workflows/produce.yml` treats exit code 3 (needs props) as a red run, so a run where every topic needs props shows as a failure.
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
- The chameleon worked example's voice runs at about 2.7 words a second (165 words, 60.6 s) while the writer prompt plans at 3.3, so real voiced scripts may run longer than planned.
- `npm test`'s "2-chunk render" test fails when less than 2 GB of memory is free (machine memory, not code).
- Both this repo and the old 3D repo exist only on this PC (DECISIONS-FOR-JACOB.md items 1 and 2).
- `pipeline/prompts/qa_repair_user.md` does not mention the story rules or the dial rule, so a picture-check repair that breaks them is thrown away and the earlier show is kept.
- In `pipeline/run.py` the writer step checks a fallback by `status` while upload checks `fallback_note`. This works today, but it is two different fields.
- Out of scope from round 8: `pipeline/prompts/show_system.md` line 40 says label text up to 32 characters and line 77 says under 22 characters (older lines).
- Out of scope from round 8: `tools/lib/story-rules.mjs` line 36 splits sentences differently from Python `sentences()` (curly closing quotes and "…" are not sentence ends in the JS split), so S numbers and story-rules sentence indexes can disagree.

## How to continue
Say: "Continue round 2 part 3b from docs/briefs/part3b-open-review.md, then part 5, then three samples, then task 9. Read STATUS.md first."
