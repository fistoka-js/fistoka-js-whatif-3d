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

1. For each prop: write it, add it to `kit/props/index.js` (other helpers edit that file at the same time: add ONLY your own import line and entry, with a small targeted edit, and re-read the file right before each edit; never rewrite or reorder it).
2. Make your own scratch show `shows/zz-<batch>/` (copy `voice.mp3` and `words.json` from `shows/demo-sky/`) with one shot per prop, on a suitable environment, so you can see each prop: `node tools/validate.mjs shows/zz-<batch>` then `node tools/still.mjs zz-<batch> --sheet`, plus full-size stills (`--at`) for close inspection. Also show each animatable param at two values.
3. **Look at the pictures** (read the image files). Be your own harsh art director: if it is not recognisable, is ugly, is too dark, or looks flat, fix it. Expect 2 to 4 rounds per prop. Drop a prop rather than ship a bad one, and say so.
4. Run `npm test` (all must pass; the prop tests automatically cover every registered prop). Do NOT run `node tools/catalog.mjs` at the end and do not edit `docs/CATALOG.md` or `kit/catalog.json` (the lead regenerates them once, to avoid clashes).
5. Do not edit engine files, other people's props, tools or docs. If the engine blocks you, work around it and report it.
6. Check free RAM before each browser job (HELPER-RULES); other helpers are running browsers too. One browser job at a time; if RAM is under 2 GB, wait a minute and re-check.
7. Do not commit.

## Report (under 350 words)

A table: prop, params, animatables, your honest look score 1-10, one-line note. Then: test result line, the path of your contact sheet, anything you dropped, any engine limits you hit.
