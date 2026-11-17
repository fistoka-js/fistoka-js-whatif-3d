# STATUS

Last updated: 2026-11-17 (three round 2 samples recorded: volcano-erupt, earth-stops-spinning, battery-bulb; task 9 docs written (README, AUTHORING, HOW-IT-WORKS, ASKING-CLAUDE, KNOWN-PROBLEMS); files-mode re-test done; microwave show step redone after full prompt read; doc note added to WRITER.md. Earlier, 16 Nov: round 2 part 5, the writer, built; review hit the 8-round cap with 0 clean; round 8's 7 problems fixed in one last unreviewed pass; committed at the cap with Jacob's approval; beat word checks cut to a short exact-phrase list, new review loop started; second review loop hit the cap, final 2 fixes applied). Task numbers match PLAN.md.

## Where work stopped (read this first)
- **Round 2 part 3b is committed** as `36b2c0a` (pushed). It added the crash fix, camera `fill` and `glide`, icon `size` / colour / longer `until`, studio `haze`, a smoother camera "up" during glides, the picture check using each prop's real outline, and a much closer chameleon rebuild. It hit the 8-round review cap with no clean pass; Jacob approved committing at the cap on 13 Nov. Remaining visual gaps against the approved video: no leaf backdrop, a smaller tuner, darker middle backgrounds, fewer hearts and no red backdrop in the "emotions" part, and a gold end chameleon where the original is light green. Nobody has listened to the audio yet. Notes: `docs/briefs/part3b-open-review.md`.
- **Round 2 part 5 (the writer) is built, committed and pushed** (commits `4c4a93e`, `dd51869`, `84ce279` are on origin/main). See the part 5 section below; the round-5 problems in `docs/briefs/part5-open-review.md` were fixed on 16 Nov. Review hit the 8-round cap on 16 Nov; round 8's 7 problems were fixed in one last unreviewed pass (list in `docs/briefs/part5-open-review.md`).
- Checks on 16 Nov after the last part 5 fix: pytest 199 passed; `npm test` 293 pass, 0 fail (browser tests skip when less than 2 GB memory is free); `validate chameleon --story-rules` OK with 1 warning (the 10.12 s "emotions" shot).
- **Outputs are fresh** (made 13 Nov after the last change to `show.json` and the code): `shows\chameleon\out\timeline.json`, `chameleon.mp4`, `chameleon-final.mp4` (no music, -16.0 LUFS, true peak -1.5 dBFS), `qa.json` and `compare\remake-sheet-1..4.jpg`.
- Usage reset on 16 Nov (weekly resets again 23 Nov 09:00 UTC).
- Pushed: commits up to `84ce279` are on GitHub at `fistoka-js/fistoka-js-whatif-3d` (private). Commits `28eb48c` and later are local only. Every later push needs a new yes from Jacob.
- The approved chameleon video for side-by-side comparison: `E:\Youtube Project\youtube-3d-pipeline\kit\render\chameleon-1080-stage2-final.mp4` (61 s, 1080x1920, Andrew +12% voice at about -32 LUFS). Read only; never write in that folder.

## Jacob's priority order (13 Nov; work stops about 16 Nov)
1. Keep this file up to date.
2. Finish round 2 until the chameleon rebuilt in the new kit is about as good as the approved video (stills and frame grids side by side, and measure voice and loudness). This comes before extra props.
3. DONE 17 Nov (listening to the audio and Jacob's verdict still open): three new sample videos on different topics, each made by the pipeline from a one-line topic. Paths are in the "Round 2 samples" section.
4. DONE 17 Nov (acceptance test with a fresh Sonnet helper still open): task 9 docs for a weaker model: README, how the pipeline works, how to add a prop or environment, how to ask Sonnet or Opus to change something, known problems.
5. Leftovers from his decisions: music logistics, the -16 / -20 loudness comparison files, a Kokoro voice sample, prepared paid-test commands (see DECISIONS-FOR-JACOB.md, "Jacob's answers").
At about 90% usage: finish what is in flight, update this file and DECISIONS-FOR-JACOB.md, end cleanly.

## Done (committed; pushed to GitHub up to commit 84ce279)
- Audit, plan, contract: `AUDIT.md`, `PLAN.md`, `docs/SPEC.md`. Items for Jacob: `DECISIONS-FOR-JACOB.md`.
- Task 1 engine, task 2 audio, task 3 render, task 4 catalogue (65 props, 7 environments), task 5 picture checks.
- **Task 6, the writer.** Topic → script → fact check → voice → show file, with repair loop, fallback and a free "files" mode. The script prompt and the fact-check module reuse the existing pipeline's.
- **Task 7, runner + upload + workflow.** `python -m pipeline.run` runs every step and resumes after a failure. Upload is always private and refuses unless the channel ID matches `settings.yaml`. Workflow is manual-only.
- VERIFIED by me: 150 Python tests and 227 kit tests pass.
- **First end-to-end test (task 8, first pass).** Two topics went from a one-line topic to a finished, mixed video with no hand editing. A fresh Sonnet helper played the paid model and saw only the prompt files. "Moon" needed 0 repair rounds, "sky" needed 1. Each run took about 2.5 minutes of machine time.
- 2026-11-17, task 9 docs written (committed together with this line): `README.md` (new), `docs/HOW-IT-WORKS.md` (new), `docs/ASKING-CLAUDE.md` (new, includes the "build a missing mechanism" prompt), `docs/KNOWN-PROBLEMS.md` (new, the list moved out of this file), `docs/AUTHORING.md` (added "Add an environment" and "Write a show by hand"), `docs/SPEC.md` (one pointer fixed: the `qa.mjs` line now points to `docs/QA.md`). Not yet followed by a fresh Sonnet helper (the acceptance test).

## Sample videos (first pass: they work, quality is middling)
In `E:\Youtube Project\whatif-3d\shows\`:
- `moon-gone\out\moon-gone-final-music.mp4` (39 s, -16 LUFS, with music) and `moon-gone-final.mp4` (no music).
- `sky-blue\out\sky-blue-final-music.mp4` (38 s, -16 LUFS, with music) and `sky-blue-final.mp4`.
- Frame grids: `moon-gone\out\stills\sheet.jpg`, `sky-blue\out\stills\sheet.jpg`. Review notes with the claims to fact-check: `review.md` in each folder.
- My honest view (OPINION): about 6 out of 10. Good: varied environments, solid 3D objects, clean labels, correct narration. Weak: both are under 40 s; some shots do not show what is being said (no picture of light scattering in the sky; Earth's tilt is not visible); the short blue wave is ugly; the big white sun is a blob; the last Moon shot hides the person behind the ground. Nobody has listened to the audio; only the levels were measured.
- The old kit's sky-blue for comparison: `E:\Youtube Project\_fable_work\out\sky-blue-head.mp4`.

### 2026-11-17: Round 2 samples (made by the writer in files mode, a fresh Sonnet helper playing the model, no hand edits)
All three: story-rules OK with 0 warnings, picture check (`out\qa.json`) pass with 0 findings, 0 repair rounds, no music (sound effects only: no music file in `out`, none in the filter file). Each has a frame grid at `shows\<slug>\out\stills\sheet.jpg`. The `review.md` of each still says "not_run" (low memory) in an older line and "pass" in a later one; `qa.json` says pass. The volcano first render failed once on joining chunks and was simply re-run (a re-run, not a repair).
The writer's own picture check did not run for any of the three (low memory; `writer.json` says `"qa": "not_run"`), so "0 repair rounds" includes no picture-check repair. The later runner picture check passed.
- `shows\volcano-erupt\out\volcano-erupt-final.mp4` ("Why do volcanoes erupt?"): voice 51.1 s, 14 shots.
- `shows\earth-stops-spinning\out\earth-stops-spinning-final.mp4` ("What if Earth stopped spinning?"): voice 45.8 s, 8 shots.
- `shows\battery-bulb\out\battery-bulb-final.mp4` ("How does a battery light a bulb?"): voice 51.4 s, 11 shots.
- "How does a black hole bend light?" stopped at the script step with code 3 (no prop can show light bending); `shows\black-hole-light\NEEDS-PROPS.md` describes the missing prop. It was swapped for the battery topic.
- Lead's view from the sheets (OPINION, frames only, nobody has listened). Volcano is the best of the three: the volcano stays on screen throughout, bubbles grow inside and it erupts on the spoken words. Weak: the bubbles sit in front of the cone (the prop has no see-through chamber), the fizzy-drink analogy is only loose particles, and at 26.5-28.5 s the cone is a tiny shape in the corner beside a big particle cloud (the weakest stretch); it is also small at 44-46 s.
- Earth: the planet stays and the arrows work, but the planet is never seen to stop spinning (the prop cannot); from 36 s a small planet sits between two thermometers with little movement; a hot and a frozen side cannot be shown (one colour for the whole planet).
- Battery: the electron ring reads as a loop; the bulb is large and lit at 0.5 s and about 4.5 s of the hook but dims on purpose around 2.5 s (it follows the battery, which drains at "runs out" and returns at "Not quite"), then small and dim at the edge from 6.5 s on (unlit-looking until about 20 s, glowing at the edge from 22.5 s, brighter at 38.5 s), there is no wire, and the last 7 s (44.5-50.5 s) are a gears-and-chain analogy with no battery or bulb (3 of the 16 picture-plan lines).

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
  - 16 Nov: fresh-agent files-mode re-test, 2 topics, 0 repair rounds each. `zz-rt-cat` (cats) ended with code 3 (no cat prop; feasible false, NEEDS-PROPS.md written). `zz-rt-microwave` ended with code 0 (show valid first try, `--story-rules` OK, 0 warnings; picture check not run, only 1.3 GB RAM free; no stills). Folders: `shows/zz-rt-cat/`, `shows/zz-rt-microwave/`.
  - 17 Nov: the first re-test agent skipped the worked example (long reads were summarised), and its microwave show hopped from object to object. A fresh agent redid only the show step after reading every line: 14 shots, 2 repair files (`04-repair1` stillness, `05-qa-repair` picture check), `--story-rules` OK with 1 warning (a label `until` past its shot end). The sheet `shows/zz-rt-microwave/out/stills/sheet.jpg` now keeps the wave and molecule together from about 12.5 s to 26 s and shows the outer and inner ball at 30 to 35 s. Conclusion: the prompt works when fully read; WRITER.md now says so.

## Not done
- **Next step: the three samples are made** (see "Round 2 samples" above). What remains for them: listen to the audio, and Jacob's verdict. The second worked example for the prompt should come from the volcano sample if Jacob agrees it passes by eye. (Round 2 part 3b is committed as `36b2c0a`, at the review cap with Jacob's approval.)
- Still visibly different from the approved video after 3b (lead's opinion from frames): no leaf backdrop, no section headings at the top, smaller tuner, darker middle backgrounds, smaller chameleons in the "emotions" part.
- A real paid run (needs Jacob), a real GitHub run (needs a push), a real upload (needs the second channel).
- Work from Jacob's answers, none started: music files for GitHub runs, loudness as one named setting plus a -16 and a -20 comparison file, the paid-test commands, committing `shows/<slug>/` from the workflow, checking `docs/CHANNEL_SETUP.md`, a Kokoro sample.
- Check `E:\Youtube Project\notes\project-notes-3d-and-animation.md` against AUDIT.md. The lead read a summary only. It may change the Audio Library redistribution concern and the note about the 2D track decision. Not done.

## Known problems
The list now lives in `docs/KNOWN-PROBLEMS.md` (grouped: writer, engine and props, picture checks, audio, workflow).

## How to continue
Say: "Round 2 part 3b is committed as 36b2c0a. The three samples are made (volcano-erupt, earth-stops-spinning, battery-bulb); next is listening to the audio and Jacob's verdict. Read STATUS.md first."
