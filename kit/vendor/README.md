# Vendored libraries

- `three.module.js`: three.js **0.160.0** (copied from `node_modules/three/build/three.module.js`). MIT licence: see `LICENSE`.
- `addons/geometries/RoundedBoxGeometry.js`: from three.js 0.160.0 `examples/jsm/geometries/` (same licence). Used by `kit/props/box.js`.

The page maps the bare names `three` and `three/addons/...` to these files with the import map in `kit/index.html`.
Node resolves the same names from `node_modules` (the same pinned version), so prop files import identically in both.
To upgrade: change the version in package.json, `npm install`, copy the same files again, update this note, and render the demo stills to compare.
