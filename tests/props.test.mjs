// Every prop and environment builds in Node (no browser), runs its update, and props are normalised to the unit box.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { catalog } from '../kit/engine/registry.js';
import { buildProp, measure, propEndpoint } from '../kit/engine/stage.js';
import { arrange } from '../kit/props/lattice.js';
import { makeShotState } from '../kit/engine/state.js';
import * as mat from '../kit/engine/materials.js';
import { makeRng } from '../kit/engine/rng.js';
import fs from 'node:fs';
import path from 'node:path';
import { resolve, WORDS, REPO } from './helpers.mjs';

const words = WORDS.slice(0, 24);

// A one-shot show with this prop (and a helper ball for props that point at another prop).
function showWith(type, extra = {}) {
  return { format: 1, title: 't', voice: { audio: 'voice.mp3', words: 'words.json' }, shots: [{
    id: 'only', env: 'space',
    props: [{ id: 'it', type, ...extra }, { id: 'other', type: 'ball', at: 'right' }],
  }] };
}

for (const [name, mod] of Object.entries(catalog.props)) {
  test(`prop ${name}: meta is complete`, () => {
    const m = mod.meta;
    assert.equal(m.name, name);
    assert.ok(m.summary && m.summary.length < 140, 'one-line summary');
    for (const [k, spec] of Object.entries(m.params)) {
      assert.ok(spec.doc, `${name}.${k} has a doc`);
      assert.ok('default' in spec, `${name}.${k} has a default`);
    }
    for (const [k, a] of Object.entries(m.animatable || {})) assert.ok(a.min <= a.default && a.default <= a.max && a.doc, `${name}.${k}`);
  });

  test(`prop ${name}: builds in Node, updates, and fits the unit box`, () => {
    const extra = mod.meta.stageSpace ? { from: 'left', to: 'other' } : {};
    const { show, errors } = resolve(showWith(name, extra), words);
    assert.deepEqual(errors, []);
    const shot = show.shots[0];
    const pr = buildProp(shot.props[0], shot, catalog, '#ffe14d');
    if (!mod.meta.stageSpace) {
      // Measured with its normaliser (before any update turns it), the largest side is 1 and it is centred.
      pr.wrapper.updateWorldMatrix(true, true);
      const box = measure(pr.inst);
      const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
      assert.ok(Math.abs(Math.max(size.x, size.y, size.z) - 1) < 1e-3, `${name} largest side ${Math.max(size.x, size.y, size.z)}`);
      assert.ok(c.length() < 1e-3, `${name} centred, got ${c.toArray()}`);
    }
    const state = makeShotState(shot, catalog);
    for (const t of [0, 1.5, 3]) {
      const st = state.propAt('it', t);
      if (pr.inst.update) pr.inst.update(t, st);
    }
    if (pr.inst.dispose) pr.inst.dispose();
  });
}

test('prop variants build: planet looks, rings, particle shapes and looks, box finishes, iceberg tank, hex lattice, lightning from/to', () => {
  const cases = [
    ...['earth', 'moon', 'mars', 'gas', 'ice', 'lava'].map(look => ['planet', { look, rings: look === 'gas' }]),
    ...['sphere', 'box', 'ring', 'stream'].map(shape => ['particles', { shape, look: shape === 'ring' ? 'dots' : 'balls', count: 40 }]),
    ['iceberg', { tank: true }], ['lattice', { arrangement: 'hex' }], ['lattice', { arrangement: 'hex', count: 5 }], ['lightning', { from: 'left', to: 'other' }],
    ['box', { finish: 'metal', width: 0.3 }], ['ball', { finish: 'facets' }], ['sun', { rays: false }],
  ];
  for (const [type, extra] of cases) {
    const { show, errors } = resolve(showWith(type, extra), words);
    assert.deepEqual(errors, [], `${type} ${JSON.stringify(extra)}`);
    const shot = show.shots[0];
    const pr = buildProp(shot.props[0], shot, catalog, '#ffe14d');
    if (pr.inst.update) pr.inst.update(1, makeShotState(shot, catalog).propAt('it', 1));
  }
});

for (const [name, mod] of Object.entries(catalog.envs)) {
  test(`env ${name}: builds in Node with key/fill/rim lights, fog and a background colour`, () => {
    const params = Object.fromEntries(Object.entries(mod.meta.params).map(([k, s]) => [k, s.default]));
    const variants = [params];
    for (const [k, s] of Object.entries(mod.meta.params)) if (s.type === 'enum') for (const v of s.values) variants.push({ ...params, [k]: v });
    for (const p of variants) {
      const env = mod.build(p, { THREE, mat, scale: 1.5, rng: makeRng(1), color: () => 0x2ec4b6 });
      assert.ok(env.object.isObject3D);
      assert.ok(env.lights.length >= 3, 'key, fill and rim');
      assert.ok(env.lights.filter(l => l.isDirectionalLight).length >= 3);
      assert.ok(env.fog, 'haze');
      assert.equal(typeof env.background, 'number');
      env.update(1.2, { position: [0, 1, 8], target: [0, 0, 0], distance: 8 });
    }
  });
}

test('every three/addons import in kit/ has its file in kit/vendor/addons (else the page 404s while Node passes)', () => {
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? (e.name === 'vendor' ? [] : walk(path.join(d, e.name))) : [path.join(d, e.name)]));
  for (const file of walk(path.join(REPO, 'kit')).filter(f => f.endsWith('.js'))) {
    for (const m of fs.readFileSync(file, 'utf8').matchAll(/from 'three\/addons\/([^']+)'/g)) {
      assert.ok(fs.existsSync(path.join(REPO, 'kit', 'vendor', 'addons', m[1])), `${path.relative(REPO, file)} imports three/addons/${m[1]}: copy it into kit/vendor/addons/`);
    }
  }
});

test('iceberg: no water box unless tank is set', () => {
  const count = extra => {
    const { show } = resolve(showWith('iceberg', extra), words), shot = show.shots[0];
    const pr = buildProp(shot.props[0], shot, catalog, '#ffe14d');
    let boxes = 0;
    pr.inst.object.traverse(o => { if (o.geometry && o.geometry.type === 'BoxGeometry') boxes++; });
    return boxes;
  };
  assert.equal(count({}), 0);
  assert.equal(count({ tank: true }), 1);
});

const degrees = (atoms, pairs) => { const d = atoms.map(() => 0); for (const [a, b] of pairs) { d[a]++; d[b]++; } return d; };
const tally = d => d.reduce((m, x) => (m[x] = (m[x] || 0) + 1, m), {});

test('lattice: cubic atoms and pairs equal the old algorithm; hex bonds are 1 to 4 per atom, mostly 3 to 4', () => {
  // cubic, count 3 (the old grid, centred): 27 atoms in i, j, k order; each links on to +i, +j, +k
  const c = arrange('cubic', 3);
  assert.equal(c.atoms.length, 27); assert.equal(c.pairs.length, 54);
  assert.deepEqual(c.atoms.slice(0, 4), [[-1, -1, -1], [-1, -1, 0], [-1, -1, 1], [-1, 0, -1]]);
  assert.deepEqual(c.atoms[13], [0, 0, 0]); assert.deepEqual(c.atoms[26], [1, 1, 1]);
  assert.deepEqual(c.pairs.slice(0, 6), [[0, 9], [0, 3], [0, 1], [1, 10], [1, 4], [1, 2]]);
  assert.deepEqual(c.pairs.at(-1), [25, 26]);
  assert.deepEqual(tally(degrees(c.atoms, c.pairs)), { 3: 8, 4: 12, 5: 6, 6: 1 });
  // hex: a finite flake, so the 2 corner atoms have 1 bond and edge atoms 2; none is loose and none has more than 4
  for (const [N, atoms, pairs, want] of [[3, 16, 20, { 1: 2, 2: 6, 3: 6, 4: 2 }], [4, 36, 51, { 1: 2, 2: 10, 3: 16, 4: 8 }], [5, 64, 96, { 1: 2, 2: 14, 3: 30, 4: 18 }]]) {
    const h = arrange('hex', N), d = degrees(h.atoms, h.pairs);
    assert.equal(h.atoms.length, atoms); assert.equal(h.pairs.length, pairs);
    assert.deepEqual(tally(d), want);
    assert.ok(Math.min(...d) >= 1 && Math.max(...d) <= 4);
    assert.ok(d.filter(x => x >= 3).length >= atoms / 2, `hex ${N}: at least half the atoms have 3 to 4 bonds`);
  }
});

test('lattice: spacing opens it smoothly (cubic and hex)', () => {
  for (const arrangement of ['cubic', 'hex']) {
    const { show } = resolve(showWith('lattice', { arrangement }), words), shot = show.shots[0];
    const pr = buildProp(shot.props[0], shot, catalog, '#ffe14d'), state = makeShotState(shot, catalog);
    const size = sp => {
      const st = state.propAt('it', 0); st.params = { ...st.params, spacing: sp }; pr.inst.update(0, st);
      return new THREE.Box3().setFromObject(pr.inst.object.children[0]).getSize(new THREE.Vector3()).length();
    };
    const a = size(0.1), b = size(0.5), c = size(1);
    assert.ok(a < b && b < c, `${arrangement} opens with spacing: ${a} ${b} ${c}`);
  }
  const { show } = resolve(showWith('lattice', { arrangement: 'hex', count: 4 }), words), shot = show.shots[0];
  const pr = buildProp(shot.props[0], shot, catalog, '#ffe14d');
  assert.equal(pr.inst.object.children[0].children.filter(o => o.isMesh).length, 36);   // 2 layers x 3x3 cells x 2 atoms
});

test('lightning with only one of from/to is a clear error', () => {
  for (const extra of [{ from: 'left' }, { to: 'left' }]) {
    const { errors } = resolve(showWith('lightning', extra), words);
    assert.ok(errors.some(e => /needs both "from" and "to"/.test(e.message)), JSON.stringify(extra));
  }
  assert.deepEqual(resolve(showWith('lightning', { from: 'left', to: 'other' }), words).errors, []);
});

test('lightning from/to: the drawn bolt reaches both stage points, whatever the prop placement', () => {
  const { show, errors } = resolve(showWith('lightning', { from: [-1, 2, 0], to: [1.5, -1, 0], at: 'left', size: 0.4 }), words);
  assert.deepEqual(errors, []);
  const shot = show.shots[0], pr = buildProp(shot.props[0], shot, catalog, '#ffe14d'), state = makeShotState(shot, catalog);
  const st = state.propAt('it', 1);
  pr.wrapper.position.set(...st.position); pr.wrapper.scale.setScalar(shot.props[0].size);
  pr.inst.update(1, st);
  pr.wrapper.updateWorldMatrix(true, true);
  const box = new THREE.Box3();
  pr.inst.object.traverseVisible(o => { if (o.isMesh && o.material.opacity > 0.9 && !o.userData.noBounds) box.expandByObject(o); });
  for (const p of [[-1, 2, 0], [1.5, -1, 0]]) assert.ok(box.distanceToPoint(new THREE.Vector3(...p)) < 0.15, `bolt reaches ${p}: box ${box.min.toArray()} ${box.max.toArray()}`);
});

test('hail, debris and brain: no param is named like a prop field, so "size" and "glow" scale and glow the whole prop', () => {
  const fields = ['id', 'type', 'at', 'size', 'rotate', 'hidden', 'glow', 'startsHidden', 'floats', 'stageSpace'];
  for (const [name, mod] of Object.entries(catalog.props)) {
    for (const k of Object.keys({ ...mod.meta.params, ...(mod.meta.animatable || {}) })) assert.ok(!fields.includes(k) || (name === 'fire' && k === 'size')  /* fire.size is approved and documented in show_system.md */, `${name} has a param named "${k}", the same as a prop field`);
  }
  for (const [type, param, def] of [['hail', 'stone', 0.03], ['debris', 'chunk', 0.12]]) {
    const { show, errors } = resolve(showWith(type, { size: 1.2 }), words);
    assert.deepEqual(errors, [], `${type} accepts size 1.2`);
    const p = show.shots[0].props[0];
    assert.equal(p.size, 1.2);                       // the whole prop is scaled up ...
    assert.equal(p.params[param], def);              // ... and the single stone or chunk keeps its own size
    assert.ok(resolve(showWith(type, { [param]: 0.5 }), words).errors.length > 0, `${type}.${param} still has its own range`);
    const shot = show.shots[0], pr = buildProp(p, shot, catalog, '#ffe14d');
    assert.ok(pr.inst.object && pr.halfHeight > 0);
  }
  const { errors } = resolve(showWith('brain', { glow: 0.5, pulse: 'red' }), words);
  assert.deepEqual(errors, []);
});

test('a point param naming a prop gets that prop\'s drawn centre and half-height: a bolt runs from the cloud underside to the target top', () => {
  const show = { format: 1, title: 't', voice: { audio: 'voice.mp3', words: 'words.json' }, shots: [{
    id: 'only', env: 'sky',
    props: [{ id: 'cl', type: 'cloud', at: [0, 1.6, 0], size: 1.2 }, { id: 'gnd', type: 'terrain', at: [0, 0, 0], size: 2.5 },
            { id: 'it', type: 'lightning', from: 'cl', to: 'gnd' }],
  }] };
  const { show: s, errors } = resolve(show, words);
  assert.deepEqual(errors, []);
  const shot = s.shots[0], ground = shot.env.ground;
  assert.ok(ground, 'the sky env has a ground');
  const [cl, gnd, bolt] = shot.props.map(p => buildProp(p, shot, catalog, '#ffe14d'));
  const state = makeShotState(shot, catalog), t = 1;
  const sc = state.propAt('cl', t), sg = state.propAt('gnd', t);
  const from = propEndpoint(cl, sc, ground), to = propEndpoint(gnd, sg, ground);
  // the terrain stands on the ground: its drawn centre is half its own height above y = 0 (not half a unit box)
  assert.ok(Math.abs(to.at[1] - to.half) < 1e-6 && to.half > 0 && to.half < 0.5 * 2.5, `terrain centre ${to.at[1]}, half ${to.half}`);
  assert.deepEqual(from.at, sc.position);          // a floating cloud is where its state says
  const st = state.propAt('it', t);
  st.points = { from: { ...st.points.from, ...from }, to: { ...st.points.to, ...to } };
  bolt.wrapper.position.set(...st.position); bolt.wrapper.scale.setScalar(shot.props[2].size);
  bolt.inst.update(t, st);
  bolt.wrapper.updateWorldMatrix(true, true);
  const box = new THREE.Box3();
  bolt.inst.object.traverseVisible(o => { if (o.isMesh && o.material.opacity > 0.9 && !o.userData.noBounds) box.expandByObject(o); });
  const top = from.at[1] - from.half * 0.35, bottom = to.at[1] + to.half * 0.75;   // lightning.js: belly of the cloud, top of the target
  assert.ok(Math.abs(box.max.y - top) < 0.15, `bolt starts at the cloud underside ${top}, box top ${box.max.y}`);
  assert.ok(Math.abs(box.min.y - bottom) < 0.15, `bolt ends on the target top ${bottom}, box bottom ${box.min.y}`);
});

test('lattice: a hex block stands on a ground (never clipped by the floor); cubic still floats as approved', () => {
  const floats = extra => resolve(showWith('lattice', extra), words).show.shots[0].props[0].floats;
  assert.equal(floats({}), true);
  assert.equal(floats({ arrangement: 'cubic' }), true);
  assert.equal(floats({ arrangement: 'hex' }), false);
});

test('lightning from cloud to tree: framing, measured box and QA box follow the drawn bolt, not the unit box at "at"', () => {
  const show = { format: 1, title: 't', voice: { audio: 'voice.mp3', words: 'words.json' }, shots: [{
    id: 'only', env: 'sky', camera: { focus: ['bolt'] },
    props: [{ id: 'cl', type: 'cloud', at: [-1, 2.2, 0] }, { id: 'tr', type: 'tree', at: [1.2, 0, 0] }, { id: 'bolt', type: 'lightning', from: 'cl', to: 'tr', at: [5, 5, 0] }],
  }] };
  const { show: s, errors } = resolve(show, words);
  assert.deepEqual(errors, []);
  const shot = s.shots[0], ground = shot.env.ground;
  const [cl, tr, bolt] = shot.props.map(p => buildProp(p, shot, catalog, '#ffe14d'));
  const state = makeShotState(shot, catalog), t = 1;
  // camera focus on the bolt frames both ends (the same sphere as framing cloud + tree), not the empty point "at"
  const fb = state.frameOf(['bolt'], 0, 2), fp = state.frameOf(['cl', 'tr'], 0, 2);
  assert.ok(Math.abs(fb.radius - fp.radius) < 1e-6 && fb.center.every((c, i) => Math.abs(c - fp.center[i]) < 1e-6), JSON.stringify({ fb, fp }));
  // measured box contains the drawn endpoints (cloud belly, tree top)
  const sc = state.propAt('cl', t), st3 = state.propAt('tr', t), st = state.propAt('bolt', t);
  const from = propEndpoint(cl, sc, ground), to = propEndpoint(tr, st3, ground);
  st.points = { from: { ...st.points.from, ...from }, to: { ...st.points.to, ...to } };
  bolt.wrapper.position.set(...st.position); bolt.wrapper.scale.setScalar(shot.props[2].size);
  bolt.inst.update(t, st);
  const box = measure(bolt.inst);
  for (const p of [[from.at[0], from.at[1] - from.half * 0.35, 0], [to.at[0], to.at[1] + to.half * 0.75, 0]]) {
    assert.ok(box.distanceToPoint(new THREE.Vector3(...p)) < 0.3, `box ${box.min.toArray()} ${box.max.toArray()} contains ${p}`);
  }
  assert.ok(box.min.x < -0.5 && box.max.x > 1, 'box spans the cloud-to-tree width, not the unit box');
  assert.ok(!box.containsPoint(new THREE.Vector3(5, 5, 0)), 'box is not at "at"');
});

// Round 6 prop fixes.
function built(type, extra, env = 'space') {
  const show = showWith(type, extra); show.shots[0].env = env;
  const { show: s, errors } = resolve(show, words); assert.deepEqual(errors, []);
  const shot = s.shots[0];
  return { shot, pr: buildProp(shot.props[0], shot, catalog, '#ffe14d'), state: makeShotState(shot, catalog) };
}
const frame = (pr, params, extra = {}) => pr.inst.update(1, { params, opacity: 1, points: {}, ...extra });

test('iceberg without tank melts down onto the water: its base stays at the waterline', () => {
  const { pr } = built('iceberg', {});
  assert.ok(Math.abs(pr.inst.bounds.min.y) < 1e-6, 'the base of the ice is y 0');
  frame(pr, { melt: 1 });
  const box = new THREE.Box3().setFromObject(pr.inst.object.children[0]);
  assert.ok(Math.abs(box.min.y) < 0.01, `base at ${box.min.y}`);
  assert.ok(box.max.y > 0.1 && box.max.y < 0.7, 'smaller but still there');
});

test('lattice hex: the block rests on the bottom of its box at any spacing (stands on the floor)', () => {
  const { pr } = built('lattice', { arrangement: 'hex' });
  for (const spacing of [0, 0.1, 1]) {
    frame(pr, { spacing, shake: 0, tilt: 0 });
    pr.inst.object.updateWorldMatrix(true, true);
    let low = Infinity; const v = new THREE.Vector3();
    pr.inst.object.traverse(o => { if (o.isMesh && o.geometry.type === 'IcosahedronGeometry') low = Math.min(low, pr.inst.object.worldToLocal(v.setFromMatrixPosition(o.matrixWorld)).y - o.geometry.parameters.radius * o.scale.x); });
    assert.ok(Math.abs(low - pr.inst.bounds.min.y) < 0.08, `spacing ${spacing}: lowest ball ${low}, box bottom ${pr.inst.bounds.min.y}`);
  }
  assert.ok(arrange('hex', 3).pairs.length > 0);
});

test('hail on a ground falls all the way to it (state.floor), not just to the box bottom', () => {
  const { pr, state, shot } = built('hail', { at: [0, 1.5, 0], size: 1 }, 'sky');
  const st = state.propAt('it', 1);
  assert.ok(typeof st.floor === 'number' && st.floor < -1, `floor ${st.floor}`);
  let lowest = Infinity; const m4 = new THREE.Matrix4(), v = new THREE.Vector3();
  for (const t of [0.3, 1, 2.2, 3.7, 5]) {
    pr.inst.update(t, { ...st, params: { amount: 1 } });
    const mesh = pr.inst.object.children[0];
    for (let i = 0; i < mesh.count; i++) { mesh.getMatrixAt(i, m4); lowest = Math.min(lowest, v.setFromMatrixPosition(m4).y); }
  }
  assert.ok(lowest < -1.2 && lowest > st.floor - 0.01, `lowest stone ${lowest}, floor ${st.floor}`);
  assert.equal(shot.env.ground !== false, true);
  assert.equal(state.propAt('it', 1).floor, st.floor);
});

test('lightning without from/to is the approved bolt: default colour and no end-bolt meshes shown', () => {
  assert.equal(catalog.props.lightning.meta.params.color.default, '#9fd0ff');
  const { pr } = built('lightning', {});
  frame(pr, { flash: 1 });
  let shown = 0; pr.inst.object.traverseVisible(o => { if (o.isMesh) shown++; });
  assert.equal(shown, 66, 'the approved bolt: 18 joints x 2 balls + 15 segments x 2 cylinders');
});
