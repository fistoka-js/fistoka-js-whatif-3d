// Prop: cloud. A puffy cloud of merged spheres, fair-weather white or dark storm grey. Animate "rain" 0..1 for falling drops.
// Exports: meta, build(params, ctx). Drops are a pure function of t (seeded start places).

import * as THREE from 'three';
import { hash } from './lib/noise.js';

export const meta = {
  name: 'cloud',
  summary: 'A puffy low-poly cloud, fair or storm. Animate "rain" 0..1 to make it rain. For weather and water cycle.',
  tags: ['nature', 'earth', 'weather'],
  floats: true,
  params: {
    style: { type: 'enum', values: ['fair', 'storm'], default: 'fair', doc: 'white fair-weather cloud or dark storm cloud' },
    color: { type: 'color', default: null, doc: 'override the cloud colour' },
    seed: { type: 'int', min: 0, max: 999, default: 1, doc: 'which variant of the puffs' },
  },
  animatable: { rain: { min: 0, max: 1, default: 0, doc: 'how hard it rains (0 = dry)' } },
};

// Puffs: x, y, z, radius. A flat-bottomed heap, widest at the base.
const PUFFS = [[-0.3, 0.1, 0, 0.17], [-0.12, 0.2, 0.02, 0.22], [0.12, 0.22, -0.02, 0.24], [0.32, 0.12, 0.02, 0.18],
  [0, 0.1, 0.12, 0.2], [0.02, 0.12, -0.12, 0.2], [-0.2, 0.08, 0.1, 0.14], [0.22, 0.08, 0.12, 0.14], [-0.02, 0.32, 0.0, 0.15]];
const DROPS = 36, TOP_Y = 0.02, BOTTOM_Y = -0.3;

export function build(params, ctx) {
  const storm = params.style === 'storm';
  // The engine tints with white when no colour is set, so the style colour is multiplied by the tint.
  const base = new THREE.Color(params.color !== null ? 0xffffff : storm ? 0x5d6784 : 0xffffff);
  const group = new THREE.Group(), mat = ctx.mat.solid(0xffffff, { rough: 0.9, rim: storm ? 0.12 : 0.3, main: false });
  const geo = new THREE.SphereGeometry(1, 20, 14), jit = ctx.rng;
  for (const [x, y, z, r] of PUFFS) {
    const m = new THREE.Mesh(geo, mat), k = 0.95 + 0.1 * jit();
    m.position.set(x, y, z); m.scale.set(r * k, r * 0.9 * k, r * k);
    group.add(m);
  }
  // Rain: thin tall drops under the cloud.
  const dropGeo = new THREE.CapsuleGeometry(0.008, 0.04, 2, 6), dropMat = new THREE.MeshBasicMaterial({ color: 0x7fc4ff, transparent: true, toneMapped: false });
  const drops = [];
  for (let i = 0; i < DROPS; i++) {
    const m = new THREE.Mesh(dropGeo, dropMat);
    m.userData.noBounds = true;
    group.add(m);
    drops.push({ m, x: (hash(i * 1.3 + params.seed) - 0.5) * 0.7, z: (hash(i * 2.7 + params.seed) - 0.5) * 0.3, ph: hash(i * 4.1), sp: 0.8 + 0.5 * hash(i * 6.3) });
  }
  function update(t, state) {
    const rain = state.params.rain;
    group.position.y = 0.012 * Math.sin(t * 0.8); // slow drift of the whole cloud
    dropMat.opacity = 0.85 * state.opacity;
    drops.forEach((d, i) => {
      const u = (t * d.sp * (0.8 + rain * 0.6) + d.ph) % 1;
      d.m.visible = i < Math.ceil(rain * DROPS) && rain > 0.01;
      d.m.position.set(d.x * (1 - 0.15 * u), TOP_Y + (BOTTOM_Y - TOP_Y) * u, d.z);
      d.m.scale.y = 0.8 + rain * 0.8;
    });
  }
  update(0, { opacity: 1, params: { rain: 0 } });
  return {
    object: group, update,
    setColor(hex) { mat.color.copy(base).multiply(new THREE.Color(hex)); },
    bounds: new THREE.Box3(new THREE.Vector3(-0.5, BOTTOM_Y, -0.3), new THREE.Vector3(0.5, 0.45, 0.3)),
    dispose() { geo.dispose(); mat.dispose(); dropGeo.dispose(); dropMat.dispose(); },
  };
}
