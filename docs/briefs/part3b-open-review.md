# Part 3b: open review items (saved 2026-11-13, about 04:00 UTC)
**Completed 2026-11-13:** all 8 items checked against the files and finished (item 3 by moving `g-bolt`, `g-heart`, `g-sun`); checks: `npm test` 302 pass, pytest 151 pass, `validate chameleon --story-rules` OK (1 warning), a mutation run of the new overlay test, stills at 51.5-53.5 s against cham-sheet-3, and `qa chameleon --video chameleon-final.mp4 --story-rules` pass (0 fail, 0 warn, -16.0 LUFS).

Part 3b (see `round2-improvements.md`) was built and reviewed twice. The second review found the 8 small problems below. A fixer started on them and was stopped partway. **Which of the 8 are finished is NOT verified.** The next fixer must check each one against the files, finish what is missing, then re-make the chameleon video and sheets, because `shows/chameleon/show.json` was edited after the last render.

State when work stopped: 302 kit tests pass (`npm test`), 151 Python tests pass, `validate chameleon --story-rules` is OK with 1 warning. Nothing from part 3b is committed. Files touched by the stopped fixer (by file time): `kit/engine/show.js`, `camera.js`, `player.js`, `overlay.js`, `tools/lib/qa-rules.mjs`, `docs/QA.md`, `tests/part3b.test.mjs`, `shows/chameleon/show.json`. Stale outputs: `shows/chameleon/out/chameleon-final.mp4`, `chameleon.mp4`, `qa.json`, `timeline.json`, `compare/remake-sheet-1..4.jpg`.

## The 8 problems, word for word from the reviewer

1. [NITPICK] docs\QA.md lines 32-33 are now out of date. They still describe `prop-outside` and `prop-in-captions` as measured on "its box". The framing rule now uses the prop's measured shape (qa-rules.mjs lines 196-209, SPEC §10).

2. [NITPICK] tools\lib\qa-rules.mjs lines 199-206: the `prop-outside` message mixes two measures. `inside` is the better of the box and the clipped shape. The coordinates printed ("box x..y") and `measured.box` come from `b`, which is the clipped shape whenever there is one. So the outside percentage and the reported box can describe different rectangles.

3. [NITPICK] shows\chameleon\show.json, around lines 1297-1308: the `g-bolt` icon (`place [0, -0.45, 0.6]`) sits on the back and crest of the lower chameleon from 51 to 54 s. In the original (cham-sheet-3, 51-54 s) the bolt sits in the gap between the two chameleons.

4. [NITPICK] shows\chameleon\show.json, around line 1040: the `emotions` start changed from "Chameleons shift" to `{phrase: "physics", edge: "end", offset: 0.1}`. None of the seven items required this. It makes the shot 10.12 s long (it was 9.64 s), which worsens the "shots over 9 s feel slow" warning. It also leaves about 0.4 s of near-black frames: qa.json `darkest` gives t 45.3 and 45.5 with lumaPct 2 and brightPct 0. The original is also dark there, so this may be deliberate, but it is outside the brief.

5. [NITPICK] kit\engine\show.js lines 177-182: a `color` action aimed at an icon that has already gone (its `until` has passed) does nothing and gives no warning. Only "before the icon appears" is checked. Probe: an icon with until "reflects" (2.40 s) plus a color action at "completely" (3.82 s) gives 0 errors and 0 warnings.

6. [NITPICK] tests\part3b.test.mjs: no test covers the overlay half of item 4. The overlay.js logic that keeps an icon up in a later shot (`here` around line 240, `kOut` around line 244, `sameShot` in `otherBoxes` around line 165) is never run, because the tests only check resolution and `iconColorAt`. Also, the test at lines 180-186 checks only the "after the scene ends" warning. It does not assert that `until` is clamped to the scene end.

7. [NITPICK] kit\engine\camera.js lines 4-6: this header was edited in this change but still says `cameraPoseAt` returns `{ position, target, fov, viewOffsetY }`. It also returns `distance` (line 159), and a blended pose adds `up` (line 79), which stage.js and the envs read.

8. [NITPICK] kit\engine\player.js lines 79-80 and 87: two comments a few lines apart say the same thing about the `shape` rectangle.

**Lead's ruling on problem 4:** the empty dark frame at about 45.2-45.7 s is deliberate. The lead asked for it because the original video is an empty dark frame at that second (`E:\Youtube Project\_fable_work\watch\cham\cham-sheet-3.jpg`). Keep it; do not revert the `emotions` start. When briefing later reviewers, include "45 s is an empty dark frame, as in the original" in the task description.

## Out-of-scope notes from the two reviewers (not fixed, not counted)

From review 1:
- `node --test tests/` (the form in PLAN.md) fails on Node 24.14.1 with MODULE_NOT_FOUND. `npm test` uses `"tests/*.test.mjs"`, which passes.
- `docs/SPEC.md` L200 points to `docs/HOW-IT-WORKS.md`, which does not exist yet (it is part of task 9).
- Cross-shot icon `until` is built and tested, but no icon in the chameleon `show.json` uses it. The original has no moment that needs it.
- Still different from the original: the antenna at 40-44 s is smaller, the red backdrop at 49-50 s is missing, and the section titles at the top of the frame are missing.

From review 2:
- In the skin shot (about 7.5-9.5 s) the layer_stack labels ("EPIDERMIS", "PIGMENT CELLS", "NANOCRYSTAL LAYER") are cut off at the left edge of the frame (see `out\stills\chameleon-8.50.png`).
- `--story-rules` fails for demo-dial, demo-sky, moon-gone, sky-blue, zz-a, zz-b, zz-c, zz-d, zz-ex-ice, zz-ex-rings and zz-mech. This comes from earlier work; story rules are off by default.
- The picture check is asymmetric: "in the captions" uses the clipped shape alone, while "outside" takes the better of box and shape. An existing show whose real shape sits low inside its box could get a new `prop-in-captions` warning. Documented in SPEC §10. The picture check was not re-run on other shows.
- The glides at 22.46, 28.68 and 34.84 s move the camera only about 2-5 degrees. Only the glide at 15.36 s is a real swing (44 degrees).

## What the lead saw in the frame sheets (opinion, frames only, before the second fix round)
Much closer than the first rebuild: large hero, no haze band, big prohibition sign and "?", front-on lattice columns. Still different: no leaf backdrop behind the hero, no small section heading at the top of the frame, smaller radio tuner, darker and less colourful backgrounds in the middle, slightly smaller chameleons and fewer hearts in the "emotions" section. Nobody has listened to the audio.

## Out-of-scope notes from a later review (13 Nov)
- In the "skin" shot (remake sheet 1 frames 8-9, still chameleon-7.50.png) the layer stack is mostly off the left edge; the "EPIDERMIS" and "PIGMENT CELLS" labels are clipped to "ERMIS" and "MENT CELLS". The original has an empty frame at that second. The picture check still says pass.
- At about 55 s ("It's one of the") the rebuild already shows the chameleon, while the original frame is empty.
- The "emotions" chameleons are smaller than in the original.

## Lead's rulings (13 Nov, later review)
- The original video has no moment where an icon carries into a later shot, so the rebuild does not use cross-shot `until`.
- The hero is matched by height; its narrower width comes from the model's pose and is accepted.

## Out-of-scope note (13 Nov, third later review)
- Myth shot, `surround` dial: at 5 s the rebuild's backdrop is still orange while the original is already green; the rebuild turns green by 6 s.
