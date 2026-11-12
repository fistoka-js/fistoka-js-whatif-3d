// Every prop and environment builds in Node (no browser), runs its update, and props are normalised to the unit box.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { catalog } from '../kit/engine/registry.js';
import { buildProp, measure } from '../kit/engine/stage.js';
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

test('prop variants build: every planet look, rings, particle shapes and looks, box finishes', () => {
  const cases = [
    ...['earth', 'moon', 'mars', 'gas', 'ice', 'lava'].map(look => ['planet', { look, rings: look === 'gas' }]),
    ...['sphere', 'box', 'ring', 'stream'].map(shape => ['particles', { shape, look: shape === 'ring' ? 'dots' : 'balls', count: 40 }]),
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
