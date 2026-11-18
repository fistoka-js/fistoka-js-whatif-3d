# Brief for helpers adding props or environments

Read, in this order: `docs/HELPER-RULES.md` (safety, obey exactly), `docs/SPEC.md` (the contract), `docs/AUTHORING.md` (the add-a-prop recipe), then the example files `kit/props/ball.js`, `kit/props/planet.js`, `kit/props/sun.js`, `kit/props/particles.js`, `kit/engine/materials.js`, and for environments `kit/envs/studio.js`.

## What a good prop is

- **Recognisable in one second** at phone size, from the default camera angle and from three-quarter view. Stylised, chunky, slightly toy-like; clean shapes, saturated colours, no fine detail that turns to noise. Think "premium low-poly explainer", consistent with the planet and sun props.
- **Solid and lit**: real 3D volumes using `ctx.mat` helpers, so the environment's key/fill/rim lights shade it. No flat cards, no thin lines as the main shape. Glows are extras wrapped in `ctx.mat.noBounds(...)`.
- **A little life**: a subtle idle motion in `update(t, state)` where it makes sense (flame flicker, propeller, slow bob), as a pure function of `t`. No `Math.random`, no clocks; use `ctx.rng` at build time.
- **A few useful params** (2 to 5): main colour(s), a style/variant enum if natural, and one or two `animatable` numbers that tell a story (for example volcano `eruption` 0..1, thermometer `level` 0..1, battery `charge` 0..1). Every param has a default and a one-line `doc`. The `summary` line is what the script-writing LLM sees: say what it is and what it is good for, in under 110 characters.
- **Cheap**: aim under about 15,000 triangles per prop, no real-time shadows, no post-processing, textures only as small `DataTexture`s. It must build in Node (no canvas, no DOM).
- **Small file**: one prop per file, aim under 200 lines, short header comment. Shared helpers go in `kit/props/lib/` only if two of your props really share them.

## How to work

1. For each prop: write it (stage-space props such as arrow, beam, wire have `from`/`to` points in world coordinates, y 0 = floor, and read `state.points` in `update`; `state.params` holds only the animatable values; see `docs/AUTHORING.md` step 2), add it to `kit/props/index.js` (other helpers edit that file at the same time: add ONLY your own import line and entry, with a small targeted edit, and re-read the file right before each edit; never rewrite or reorder it).
2. Make your own scratch show in `shows/zz-<batch>/`. Copy `voice.mp3` and `words.json` from `shows/demo-sky/` (a real tracked show). Give it at least one shot per prop, and make each shot 1.5 to 12 s long. The shots must tile the whole 54.7 s voice, so you need at least 5 shots. If the batch has fewer than 5 props, repeat a prop in the extra shots; see "Write a show by hand" in `docs/AUTHORING.md` for a 5-shot example. Each shot's camera `move` is one of: drift, push_in, pull_out, orbit, rise, pan or still. Use a suitable environment so you can see each prop. Then run `node tools/validate.mjs shows/zz-<batch>` and `node tools/still.mjs zz-<batch> --sheet`, plus full-size stills (`--at`) for close inspection. Also show each animatable param at two values.
3. **Look at the pictures** (read the image files). Be your own harsh art director: if it is not recognisable, is ugly, is too dark, or looks flat, fix it. Expect 2 to 4 rounds per prop. Drop a prop rather than ship a bad one, and say so.
4. Run `npm test` (all must pass; the prop tests automatically cover every registered prop). Run `node tools/catalog.mjs` (it rewrites `docs/CATALOG.md` and `kit/catalog.json`; `npm test` rewrites them too) and never edit those two by hand. If other helpers are working at the same time, the lead commits them once and you only report that they changed. These two files are generated, so another helper's run may overwrite yours; that is fine.
5. Do not edit engine files, other people's props or tools. Do not hand-edit docs (running the generator in step 4 is allowed). If the engine blocks you, work around it and report it.
6. Check free RAM before each browser job (HELPER-RULES); other helpers are running browsers too. One browser job at a time; if RAM is under 2 GB, wait a minute and re-check.
7. Do not commit.

## Report (under 350 words)

A table: prop, params, animatables, your honest look score 1-10, one-line note. Then: test result line, the path of your contact sheet, anything you dropped, any engine limits you hit.
