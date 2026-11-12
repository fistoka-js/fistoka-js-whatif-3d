// Prop: island. A little round island with a sandy beach and a palm, sitting on a disc of water: a "little world" diorama.
// Exports: meta, build(params, ctx). The foam ring and the palm move gently as functions of t.

import * as THREE from 'three';
import { jitter, paint, facetMat } from './lib/facets.js';
import { buildTree } from './lib/plants.js';
import { hash } from './lib/noise.js';

export const meta = {
  name: 'island',
  summary: 'A round island with a beach and optional palm on a disc of water. A "little world" base for other props.',
  tags: ['nature', 'earth', 'place'],
  floats: false,
  params: {
    color: { type: 'color', default: '#5cbf4a', doc: 'grass colour' },
    palm: { type: 'bool', default: true, doc: 'a palm tree on the island' },
    seed: { type: 'int', min: 0, max: 999, default: 1, doc: 'which variant of the shape' },
  },
  animatable: {},
};

export function build(params, ctx) {
  const group = new THREE.Group(), geos = [], mats = [], rng = ctx.rng;
  const solid = (c, o = {}) => { const m = ctx.mat.solid(c, { main: false, ...o }); mats.push(m); return m; };
  const add = (g, m, y = 0) => { geos.push(g); const o = new THREE.Mesh(g, m); o.position.y = y; group.add(o); return o; };

  add(new THREE.CylinderGeometry(0.5, 0.48, 0.16, 48), solid(0x1f7fc4, { rough: 0.35 }), 0.08); // deep water body
  const top = add(new THREE.CylinderGeometry(0.5, 0.5, 0.02, 48), solid(0x58cdee, { rough: 0.15, transparent: true, opacity: 0.85 }), 0.165);
  const sand = new THREE.CylinderGeometry(0.38, 0.44, 0.1, 14, 1);
  jitter(sand, rng, 0.02, 0.005);
  add(paint(sand, f => new THREE.Color(0xf0d58c).multiplyScalar(0.9 + 0.2 * hash(f.i + params.seed))), facetMat(ctx, { main: false, rough: 0.9 }), 0.19); mats.push(group.children.at(-1).material);
  const hill = new THREE.SphereGeometry(0.3, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2); // grassy mound
  hill.scale(1, 0.55, 1); jitter(hill, rng, 0.015, 0.012);
  const grass = ctx.mat.solid(ctx.color(params.color), { flat: true, rough: 0.85 }); mats.push(grass);
  add(hill, grass, 0.23);
  // shore foam: a thin white ring that breathes in and out
  const foamMat = solid(0xffffff, { transparent: true, opacity: 0.7, rough: 0.5 });
  const foam = add(new THREE.TorusGeometry(0.43, 0.012, 6, 48), foamMat, 0.178); foam.rotation.x = Math.PI / 2;
  // a few little stones
  for (let i = 0; i < 3; i++) {
    const a = 2 + i * 2.1 + params.seed, g = jitter(new THREE.IcosahedronGeometry(0.035 + 0.01 * i, 0), rng, 0.008);
    const o = add(g, solid(0x8d8a86, { flat: true }), 0.255); o.position.x = Math.cos(a) * 0.25; o.position.z = Math.sin(a) * 0.25; o.position.y = 0.2 + 0.02 * i;
  }
  let palm = null;
  if (params.palm) {
    palm = buildTree('palm', ctx, params.seed);
    palm.object.scale.setScalar(0.55); palm.object.position.set(-0.06, 0.37, 0.02);
    group.add(palm.object);
  }
  return {
    object: group,
    update(t) {
      foam.scale.setScalar(1 + 0.025 * Math.sin(t * 1.3)); foamMat.opacity = 0.55 + 0.2 * Math.sin(t * 1.3 + 1);
      top.position.y = 0.165 + 0.004 * Math.sin(t * 1.1);
      if (palm) palm.sway(t);
    },
    dispose() { geos.forEach(g => g.dispose()); mats.forEach(m => m.dispose()); if (palm) palm.dispose(); },
  };
}
