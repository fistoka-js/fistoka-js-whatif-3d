// The planet's ocean bump, built for real in Node: hidden at 0, stays between body and halo shells, frees its GPU parts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { catalog } from '../kit/engine/registry.js';
import { buildProp } from '../kit/engine/stage.js';
import { resolve, WORDS } from './helpers.mjs';
import { BODY_R, HALO_R } from '../kit/props/lib/oceanBump.js';

test('ocean bump: hidden at 0, inside the shells and finite when on, freed on dispose', () => {
  const raw = { format: 1, title: 't', voice: { audio: 'voice.mp3', words: 'words.json' },
    shots: [{ id: 'only', env: 'space', props: [{ id: 'it', type: 'planet', look: 'earth' }] }] };
  const { show, errors } = resolve(raw, WORDS.slice(0, 24));
  assert.deepEqual(errors, []);
  const pr = buildProp(show.shots[0].props[0], show.shots[0], catalog, '#ffe14d');
  let water = null;   // the only mesh with the water's edge attribute
  pr.inst.object.traverse(o => { if (o.geometry && o.geometry.getAttribute('aT')) water = o; });
  assert.ok(water, 'water mesh exists');
  const go = (ocean, ocean_lon = 0, ocean_lat = 0) =>
    pr.inst.update(0, { params: { atmosphere: 0.6, ocean, ocean_lon, ocean_lat } });

  go(0);
  assert.equal(water.visible, false, 'ocean 0 draws nothing');

  for (const [lon, lat] of [[0, 0], [180, 0], [0, 90], [-90, -60]]) {
    go(1, lon, lat);
    assert.equal(water.visible, true);
    const p = water.geometry.getAttribute('position').array;
    for (let i = 0; i < p.length; i += 3) {
      const r = Math.hypot(p[i], p[i + 1], p[i + 2]);
      assert.ok(Number.isFinite(r), `finite at ${lon}/${lat}`);
      assert.ok(r >= BODY_R && r <= HALO_R, `radius ${r} at ${lon}/${lat}`);
    }
  }

  let freed = 0;
  water.geometry.addEventListener('dispose', () => freed++);
  water.material.addEventListener('dispose', () => freed++);
  pr.inst.dispose();
  assert.equal(freed, 2, 'water geometry and material disposed');
});
