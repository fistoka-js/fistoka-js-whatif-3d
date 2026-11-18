# Authoring guide: add a prop, add an environment, write a show by hand

All commands run in PowerShell at the repo root (`E:\Youtube Project\whatif-3d`). Read `docs/HELPER-RULES.md` first if you are an AI helper. For what a good prop looks like, read `docs/PROP-BRIEF.md`. For the exact module shapes, read `docs/SPEC.md` section 9.

## Add a prop

This recipe was checked by the helper that built the engine (it added a throwaway cone prop this way, then removed it). It has not yet been followed by a second, fresh model.

1. Copy `kit/props/ball.js` to `kit/props/<name>.js`. Edit every `meta` field, because `ball.js` values are wrong for most props: `name` (must equal the file name without `.js`); a one-line `summary` (the writer model reads it; it must be under 140 characters or `npm test` fails); `tags` (for example `['space']`); `floats` (`false` = the prop rests on the ground in environments that have one; `true` = it hovers or flies, like a planet or satellite, and is not placed on the ground; `catalog_text.py` marks these `[floats]` for the writer); `params` (each with a default and a `doc`); `animatable` (params that can change during a shot, each with min, max, default, doc; the default must lie between min and max; `{}` if none); and optionally `sounds` (sfx hints; leave out if unsure). SPEC section 9 shows all of them.
2. In `build(params, ctx)`, make lit parts with `ctx.mat.solid(ctx.color(params.color))` and return `{ object }`. Wrap glows in `ctx.mat.noBounds(...)` so they do not count toward the prop's size. Use `update(t, state)` if anything moves; it must depend only on `t` and `state`. Do not call `ctx.rng` in `update`: it is a stateful generator, so each frame would depend on how many calls came before. Do not use random numbers or clocks. For noise that varies over time, use the pure helpers from `kit/engine/rng.js`: `hash01(n)` returns 0..1 for a number `n` (for example `hash01(Math.floor(t * 16))` for a flicker step), and `smoothNoise(seed, x)` returns -1..1 and is smooth in `x` (for example `smoothNoise(7, t * 2)`). `ctx.rng` is for `build` only. `state` holds `visible`, `opacity` (multiply your own glow or dot opacity by it), `position`, `scale`, `rotation`, `color`, `glow`, `params` and `points`. `build(params, ctx)` gets all the params: the static ones, plus each animatable one at its start value. In `update`, read animatable values every frame from `state.params` (they change over time), never from the `params` that `build` got (those stay at the start value). `state.points` is set for every prop but is only useful for stage-space props (below).
   A stage-space prop (`stageSpace: true` in `meta`, like `arrow`, `beam`, `wire`) is drawn between its own `point` params, usually `from` and `to`. A point is a slot name, `[x, y, z]` or a prop id (that prop's centre), all in world coordinates; y 0 is the floor, and props stand on it in environments with a ground. Slot points are not all at floor height: `bottom`, `bottom-left` and `bottom-right` sit at y -0.9, below the floor, so give `[x, y, z]` when you need floor height. In `update`, read `state.points.from.at` (`[x, y, z]`) and `.radius` (0 for a slot or `[x, y, z]`; for a point that names a solid prop, about half its size); a point may not name a stage-space prop, because the validator rejects it. Do not read `params.from`. See `kit/props/wire.js`.
3. Textures must be a `DataTexture` (no canvas, no DOM), so the prop also builds in Node for the checker and tests. If the prop imports `three/addons/X`, copy X into `kit/vendor/addons/`; a test fails if you forget.
4. Add an import line and an entry in `kit/props/index.js`. Add only your own two lines; do not reorder the file.
5. Regenerate the catalogue and run the tests:

```powershell
node tools/catalog.mjs
npm test
```

`node tools/catalog.mjs` rewrites `docs/CATALOG.md` (for people) and `kit/catalog.json` (the list the script-writing model sees). Never edit those two by hand. `npm test` runs the same tool again and checks that every registered prop builds in Node and fits the unit box. Also run `.\.venv\Scripts\python.exe -m pytest tests/py -q`.

6. Look at it. Make a scratch show `shows/zz-<name>/` (the `zz-` prefix is git-ignored, so scratch shows are never committed; delete the folder when you are done): copy `voice.mp3` and `words.json` from `shows/demo-sky/`, and write a `show.json` with a few shots that each show your prop, none longer than 12 s. The shots must cover the whole voice (54.7 s), so you need at least 5 shots; if you have fewer than 5 props, repeat a prop in the extra shots. Follow the 5-shot example in "Write a show by hand" below. Then:

```powershell
node tools/validate.mjs zz-<name>
node tools/still.mjs zz-<name> --sheet
node tools/still.mjs zz-<name> --at 1.5,4
```

Open `shows/zz-<name>/out/stills/sheet.jpg` and look at it. Is the prop recognisable in one second at phone size? Is it lit and solid, not flat? Fix and repeat (expect 2 to 4 rounds). Show each animatable param at two values.

Check new files for stray control characters (non-printing bytes): `git grep --untracked -nP "[\x00-\x08\x0B\x0C\x0E-\x1F]" -- '*.js' '*.mjs' '*.json' '*.md' '*.py'` must print nothing (no output, exit code 1, means clean; a NUL byte shows as "Binary file ... matches"). No test checks this.

Check free memory before a browser job (`docs/HELPER-RULES.md`).

## Add an environment

1. Copy `kit/envs/studio.js` to `kit/envs/<name>.js`. Set `meta.name`, `summary`, `params` (each with a default and a `doc`) and `ground`. `ground` says whether props stand on a floor: `true`, `false`, or `params => params.floor`. If a param may follow a dial, list it in `meta.dialParams` and return a `setColors` function (see SPEC section 12).
2. `build(params, ctx)` must return `{ object, lights, fog, background, update(t, cam) }`. There must be at least three directional lights (key first, then fill, rim), a `fog`, and `background` must be a number such as `0x2ec4b6`. Build in Node (no canvas, no DOM). The env test checks all of this, and builds every `enum` value too.
3. Add an import line and an entry to `ENVS` in `kit/envs/index.js`.
4. Add one line for it to `ENV_GROUND` in `pipeline/catalog_text.py`, saying in words what the ground is (for example `"studio": "ground (floor), unless floor: false"`). A Python test fails if you forget. The writer's prompt uses this line so the model knows whether props float.
5. Run `node tools/catalog.mjs`, then `npm test`, then `.\.venv\Scripts\python.exe -m pytest tests/py -q`.
6. Look at it: put it in a scratch show (`shows/zz-<name>/`; the `zz-` prefix is git-ignored; delete it afterwards) with a prop on it, with `env` written as an object to set its params, and run `node tools/still.mjs zz-<name> --sheet`. Check the light, the horizon, and that the prop is not buried in the floor.

## Write a show by hand

A show is a folder `shows/<slug>/` with `voice.mp3`, `words.json` (every spoken word with start and end seconds) and `show.json`. A shot may last 1.5 to 12 seconds (`validate` reports a shot over 12 s as an error, and shots over 9 s as a warning), so a show needs enough shots to cover the whole voice. A shot's camera `move` is one of `drift` (default), `push_in`, `pull_out`, `orbit`, `rise`, `pan`, `still`. This one works with the 54.7 s voice copied from `shows/demo-sky/` (it passes `validate` with warnings about long shots):

```json
{
  "format": 1,
  "title": "my test",
  "voice": { "audio": "voice.mp3", "words": "words.json" },
  "shots": [
    { "id": "s1", "env": "studio", "props": [ { "id": "a", "type": "ball", "at": "center", "size": 1.2 } ], "camera": { "move": "drift", "framing": "medium", "angle": "three-quarter" }, "actions": [] },
    { "id": "s2", "start": { "time": 11 }, "env": "studio", "props": [ { "id": "b", "type": "ball", "at": "center", "size": 1.2 } ], "camera": { "move": "drift", "framing": "medium", "angle": "front" }, "actions": [] },
    { "id": "s3", "start": { "time": 22 }, "env": "studio", "props": [ { "id": "c", "type": "ball", "at": "center", "size": 1.2 } ], "camera": { "move": "drift", "framing": "medium", "angle": "front" }, "actions": [] },
    { "id": "s4", "start": { "time": 33 }, "env": "studio", "props": [ { "id": "d", "type": "ball", "at": "center", "size": 1.2 } ], "camera": { "move": "drift", "framing": "medium", "angle": "front" }, "actions": [] },
    { "id": "s5", "start": { "time": 44 }, "env": "studio", "props": [ { "id": "e", "type": "ball", "at": "center", "size": 1.2 } ], "camera": { "move": "drift", "framing": "medium", "angle": "front" }, "actions": [] }
  ]
}
```

Change `"type": "ball"` to your prop to see it.

To try a prop's animatable param (listed in its `meta.animatable` and in `docs/CATALOG.md`), give the param a starting value flat on the prop and animate it with a `set` action (SPEC sections 5 and 7). To give an environment its params, write `env` as an object (SPEC section 3). This first shot starts the `bars` prop flat and grows it to full height at 2 seconds (checked with `validate`):

```json
{ "id": "s1", "env": { "type": "sky", "clouds": 0.6 }, "props": [ { "id": "a", "type": "bars", "at": "center", "size": 1.2, "grow": 0 } ], "camera": { "move": "drift", "framing": "medium", "angle": "three-quarter" }, "actions": [ { "at": { "time": 2 }, "do": "set", "prop": "a", "param": "grow", "to": 1, "over": 1.5 } ] }
```

Replace shot `s1` above with this one. To compare a param at a low and a high value, make two such shots, one with `"grow": 0` and one with `"grow": 1`. A shot's `"start"` is a time (`{ "time": 11 }`) or a spoken word (an anchor, see SPEC section 4). Every field, anchor, action and camera option is in `docs/SPEC.md`; every prop and environment with its params is in `docs/CATALOG.md`. Then:

```powershell
node tools/validate.mjs <slug>
node tools/still.mjs <slug> --sheet
```

For a real story, also run `node tools/validate.mjs <slug> --story-rules`. A test show like the one above fails the story rules on purpose (nothing changes while words are spoken). Unknown fields are errors and the message suggests the right name. The story rules (SPEC section 14) want the picture to change with every spoken sentence, so give each sentence an action or a dial change. A good worked example is `shows/chameleon/show.json`.

To go on to a video: `node tools/timeline.mjs <slug>`, `node tools/render.mjs <slug>`, then mix and check: `.\.venv\Scripts\python.exe -m pipeline.mix --video V --voice A --timeline T --out O` (all flags in `docs/AUDIO.md`) and `node tools/qa.mjs <slug>` (`docs/QA.md`). Rendering takes minutes and needs Chrome and free memory.
