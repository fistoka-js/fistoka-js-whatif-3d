// Prop: rock. One or several faceted boulders, seeded, with lighter tops. Good for geology, erosion, landscapes.
// Exports: meta, build(params, ctx).

import * as THREE from 'three';
import { jitter, paint, facetMat } from './lib/facets.js';
import { hash } from './lib/noise.js';

export const meta = {
  name: 'rock',
  summary: 'A chunky faceted boulder or a little group of rocks. For geology, erosion, mining, landscapes.',
  tags: ['nature', 'earth'],
  floats: false,
  params: {
    color: { type: 'color', default: '#8d8a86', doc: 'rock colour' },
    count: { type: 'int', min: 1, max: 6, default: 1, doc: 'how many boulders (1 = one big rock)' },
    seed: { type: 'int', min: 0, max: 999, default: 1, doc: 'which variant of the shape' },
  },
  animatable: {},
};

export function build(params, ctx) {
  const group = new THREE.Group(), base = new THREE.Color(ctx.color(params.color)), rng = ctx.rng, n = params.count;
  const mat = facetMat(ctx, { rough: 0.9, rim: 0.3, emissive: 0.22 });
  const geos = [];
  for (let i = 0; i < n; i++) {
    const r = i === 0 ? 0.3 : 0.1 + 0.12 * rng();
    const g = new THREE.IcosahedronGeometry(1, 1);
    g.scale(r * (1 + 0.25 * rng()), r * (0.65 + 0.2 * rng()), r * (1 + 0.25 * rng()));
    jitter(g, rng, r * 0.2, r * 0.12);
    const pos = g.attributes.position;
    for (let v = 0; v < pos.count; v++) if (pos.getY(v) < -r * 0.3) pos.setY(v, -r * 0.3); // flat bottom
    const geo = paint(g, f => {
      const k = hash(f.i * 1.3 + i * 17 + params.seed);
      return base.clone().lerp(new THREE.Color(0xffffff), Math.max(0, f.ny) * 0.28).multiplyScalar(0.8 + k * 0.3);
    });
    geos.push(geo);
    const m = new THREE.Mesh(geo, mat), a = i === 0 ? 0 : (i / n) * 6.283 + rng();
    m.position.set(i === 0 ? 0 : Math.cos(a) * 0.38, r * 0.3, i === 0 ? 0 : Math.sin(a) * 0.3);
    m.rotation.y = rng() * 6;
    group.add(m);
  }
  return { object: group, dispose() { geos.forEach(g => g.dispose()); mat.dispose(); } };
}
