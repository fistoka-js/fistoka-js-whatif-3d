# Brief: round 2 improvements (from the first two end-to-end test videos)

Read `docs/HELPER-RULES.md` first and obey it. Evidence to look at before changing anything: `shows/moon-gone/out/stills/sheet.jpg`, `shows/sky-blue/out/stills/sheet.jpg`, their `show.json`, `review.md` and `out/qa.json`. Both shows were written by a Sonnet model that saw only the writer's prompt files. Both validated (0 and 1 repair rounds) and both scored about 6/10 from their own author and from the lead. The goal of this round is to raise that to 8/10 without making the prompt much longer.

This brief has three independent parts. One helper may do all three, or they may be split (A+D, B, C); the file ownership is listed per part.

## A. The show prompt (owner of `pipeline/prompts/**`, `pipeline/catalog_text.py`, `tests/py/test_writer.py`, `docs/WRITER.md`)

Problems seen:
1. **Videos are too short**: 130 words came out at 38-39 s (about 3.4 words per second with Edge Andrew at +12%). Target 45-55 s. Raise the script length rule to 150-180 words and keep the 58 s cap with the existing shorten step. Fix the words-per-second assumption wherever it is written.
2. **No recipes for common ideas.** Add a compact "how to show it" table to the show prompt (one line each, tested by you with stills before you include it): light scattering in air (beam into `particles`, more beams leaving in other directions); a thing vanishing (keep a second prop on screen); tides (planet + moon + arrow, `terrain` ocean slab rising); day/night or spin (planet with `spin`); tilt (see part B's new param); comparing two amounts (`bars`, `count`); very long times (`clock` with spin, `count`); danger (`icon` warning, `shake`); heat/cold (`thermometer` large and alone, or colour change); scale (person next to the thing); inside the body (`micro` env).
3. **Sizes.** State minimums that worked in stills: a secondary prop is never under 0.6; a prop that carries the sentence is alone in its shot or at least 1.0; `sun` over about 1.0 in `space` turns into a white blob, so cap it and say so; `particles` need a size and count that read at phone size (give numbers).
4. **Beams and arrows must end inside the frame** (give safe coordinate ranges).
5. **Ground environments and big backdrop props**: a huge planet or moon placed low behind a ground gets cut by the ground and hides the subject (see moon-gone "companion"). Say how to do "big moon in the sky" properly (which env option or placement), or forbid it.
6. **Shot length wording is inconsistent** ("hook may be 1.5 s" versus "never shorter than 2 s"). Make it one rule that matches the checker, and say a closing "follow" line may share the last shot.
7. **`rotate` units** (degrees) and what `spin` axes do: one line each.
8. The fact-check prompt has an empty system section: move the role/instructions into it.
9. Checker hint: when `offset` (or `edge`) is given beside `at` instead of inside it, the error should say "put it inside at: {"phrase": ..., "offset": ...}". (This one line is in the validator: owner of part C.)

Re-test after the edits exactly as the first test was done: `files` mode, a fresh agent that reads only the prompt files, on two new topics from `queue/pending/`. Report repair rounds and look at the stills.

## B. Props (owner of the named prop files and `tests/`)

1. `wave`: at short wavelength it renders as a cluster of glassy shards; red looks pink with a purple halo. Make it a clean smooth tube at every wavelength in its range (resample by wavelength), true to its colour, with a subtle glow only.
2. `sun`: at sizes over about 1 the glow and rays wash out the whole frame. Keep the disc readable (limb darkening, visible surface texture), make glow scale sub-linearly, add a `rays` 0..1 param.
3. `planet`: add a `tilt` param (degrees) and an optional visible axis line (`axis: true`), plus an animatable `wobble` 0..1, so "Earth's tilt" can be shown. Check that the generic `spin` action turns it around its own (tilted) axis, not world z.
4. `particles`: make sure dots are readable at 1080x1920 at default settings (the "blue everywhere" cloud is a faint dust); add a `dot` size param if missing.
5. `heart` (valentine look), `bird` flock (reads as a red string), `bomb_blast`, `magnet` field (dotted): improve or mark as weak in their `summary` so the writer avoids them.
6. `thermometer` and other thin props: make sure the minimum on-screen width at size 0.6 is readable; thicken if needed.

Regenerate the catalogue and the gallery at the end (`node tools/catalog.mjs`, `node tools/gallery.mjs`).

## C. Pipeline robustness (owner of `pipeline/writer.py`, `pipeline/run.py`, `tools/validate.mjs`, `tools/qa.mjs` and their tests)

1. The writer's picture check silently became `not_run` when memory was low, so the picture-repair round was skipped. Wait and retry (for example up to 5 times, 60 s apart) before giving up, and write clearly in `review.md` when it was skipped.
2. QA cannot see a prop hidden behind another object or the ground (moon-gone "companion": the person is behind a slab; "dark-sky": person is tiny). Add a cheap occlusion check if `__boxes` allows it (for example render the shot midpoint twice, with and without the focus prop, and compare the pixels inside its box: under 2% difference = hidden). If the engine needs a small hook for that (hide one prop for a debug render), add it and document it in SPEC §10.
3. Validator hint from A9.
4. `--topic` runs leave the queue untouched; when the topic text matches a pending file, move it like a queue run.

## D. Finish line for this round

Three final videos with music for Jacob (paths in STATUS.md), each passing QA, each looked at by the lead: the two re-tested topics plus a re-run of "What if the Moon disappeared?".
