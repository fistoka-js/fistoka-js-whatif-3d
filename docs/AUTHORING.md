# Authoring guide (first part: adding a prop)

More sections (adding an environment, writing a show by hand) are still to be written; see STATUS.md.

## Add a prop

This recipe was checked by the helper that built the engine (it added a throwaway cone prop this way, then removed it). It has not yet been followed by a second, fresh model.

1. Copy `kit/props/ball.js` to `kit/props/<name>.js`. Set `meta.name`, a one-line `summary`, `params` (each with a default and a `doc`) and `animatable`.
2. In `build(params, ctx)`, make lit parts with `ctx.mat.solid(ctx.color(params.color))` and return `{ object }`. Wrap glows in `ctx.mat.noBounds(...)` so they do not count toward the prop's size. Use `update(t, state)` if anything moves; it must depend only on `t` and `state` (no random numbers, no clocks; use `ctx.rng`).
3. Textures must be a `DataTexture` (no canvas, no DOM), so the prop also builds in Node for the checker and tests. If the prop imports `three/addons/X`, copy X into `kit/vendor/addons/`; a test fails if you forget.
4. Add an import line and an entry in `kit/props/index.js`.
5. Run `node tools/catalog.mjs`, then `npm test`. The prop tests check that it builds and fits the unit box.
6. Put it in a show, run `node tools/still.mjs <slug> --sheet`, and look at the picture.
