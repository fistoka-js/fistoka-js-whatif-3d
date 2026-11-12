// Prop: asteroid. Lumpy, cratered, flat-shaded rock(s) that tumble slowly. count 1 = one big rock, up to 40 = a field.
// Exports: meta, build(params, ctx). Shape comes from the seed, so the same seed is always the same rocks.

import * as THREE from 'three';
import { makeRng } from '../engine/rng.js';

export const meta = {
  name: 'asteroid',
  summary: 'A lumpy cratered rock that tumbles; "count" up to 40 makes an asteroid field or cluster.',
  tags: ['space'],
  floats: true,
  params: {
    count: { type: 'int', min: 1, max: 40, default: 1, doc: 'how many rocks (1 = a single big asteroid)' },
    color: { type: 'color', default: '#8d7f72', doc: 'rock colour' },
    seed: { type: 'int', min: 0, max: 999, default: 3, doc: 'which lumpy shape / arrangement' },
  },
  animatable: {},
};

// One lumpy rock: a ball of triangles pushed in and out by a few random waves, with round dents (craters).
function rockGeometry(rng, craters) {
  const geo = new THREE.IcosahedronGeometry(0.5, 3);
  const waves = [];
  for (let i = 0; i < 4; i++) waves.push({ d: new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize(), f: 1.5 + rng() * 2.5, p: rng() * 6.28, a: 0.06 + rng() * 0.05 });
  const dents = [];
  for (let i = 0; i < craters; i++) dents.push({ d: new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize(), r: 0.28 + rng() * 0.25, depth: 0.05 + rng() * 0.04 });
  const stretch = new THREE.Vector3(0.85 + rng() * 0.3, 0.8 + rng() * 0.3, 0.85 + rng() * 0.3);
  const p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    let r = 0.5;
    for (const w of waves) r += w.a * Math.sin(v.dot(w.d) * w.f * 3 + w.p);
    for (const c of dents) {
      const k = 1 - Math.acos(Math.min(1, v.dot(c.d))) / c.r;
      if (k > 0) r -= c.depth * Math.sin(Math.min(1, k * 1.6) * Math.PI / 2);   // bowl with a soft rim
    }
    v.multiplyScalar(r).multiply(stretch);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  const flat = geo.toNonIndexed();    // flat shading needs separate triangles
  geo.dispose();
  flat.computeVertexNormals();
  return flat;
}

export function build(params, ctx) {
  const rng = makeRng(params.seed * 7919 + 11);
  const group = new THREE.Group();
  const base = new THREE.Color(ctx.color(params.color));
  const made = [];
  const geos = [rockGeometry(rng, 4), rockGeometry(rng, 3), rockGeometry(rng, 5)];
  made.push(...geos);
  const rocks = [];
  const n = params.count;
  const placed = [];
  for (let i = 0; i < n; i++) {
    const size = n === 1 ? 1 : (0.08 + rng() * 0.17) * (n > 12 ? 0.75 : 1);
    let pt = new THREE.Vector3();
    for (let tries = 0; tries < 120; tries++) {    // keep rocks from overlapping where we can
      const u = new THREE.Vector3(rng() * 2 - 1, (rng() * 2 - 1) * 0.55, (rng() * 2 - 1) * 0.8);
      if (u.length() > 1) continue;
      pt = u.multiplyScalar(0.5 * (1 - size * 0.5));
      if (placed.every(q => q.p.distanceTo(pt) > (q.s + size) * 0.62)) break;
    }
    placed.push({ p: pt.clone(), s: size });
    const tint = base.clone().offsetHSL(0, (rng() - 0.5) * 0.08, (rng() - 0.5) * 0.12);
    const mat = ctx.mat.solid(tint, { rough: 0.95, flat: true, rim: 0.18 });
    made.push(mat);
    const m = new THREE.Mesh(geos[i % 3], mat);
    m.position.copy(pt); m.scale.setScalar(size);
    m.rotation.set(rng() * 6, rng() * 6, rng() * 6);
    rocks.push({ m, axis: new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize(), speed: (0.15 + rng() * 0.25) * (rng() < 0.5 ? -1 : 1), q0: m.quaternion.clone() });
    group.add(m);
  }
  const q = new THREE.Quaternion();
  return {
    object: group,
    update(t) {
      for (const r of rocks) r.m.quaternion.copy(q.setFromAxisAngle(r.axis, t * r.speed)).multiply(r.q0);
    },
    dispose() { for (const x of made) x.dispose(); },
  };
}
