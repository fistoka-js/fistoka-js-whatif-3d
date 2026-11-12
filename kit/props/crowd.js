// Prop: crowd. Many tiny simplified people (instanced capsule bodies + round heads) scattered on a disc.
// Exports: meta, build(params, ctx). Animate "count_shown" 0..1 so people pop in (or vanish) one by one in a fixed random order.

import * as THREE from 'three';
import { makeRng } from '../engine/rng.js';

export const meta = {
  name: 'crowd',
  summary: 'A crowd of tiny people on a disc (10..300). Animate count_shown 0..1 to make them appear or vanish.',
  tags: ['people', 'body', 'scale'],
  floats: false,
  params: {
    count: { type: 'int', min: 10, max: 300, default: 80, doc: 'how many people' },
    color: { type: 'color', default: null, doc: 'one shirt colour for everyone; default = a mix of colours' },
    seed: { type: 'int', min: 0, max: 999, default: 3, doc: 'which random arrangement' },
  },
  animatable: {
    count_shown: { min: 0, max: 1, default: 1, doc: 'share of the crowd that is present (0 = nobody, 1 = everyone)' },
  },
};

const MIX = [0xff4b4b, 0xff9a3c, 0xffd84a, 0x4fd36b, 0x2ec4b6, 0x3d8bff, 0xa35bff, 0xff6fb5, 0xf4f4f4];
const SKIN = [0xf0b98d, 0xd9a07a, 0xb97a56, 0x8a5a3c, 0xf6d2b0, 0x6b4430];

export function build(params, ctx) {
  const n = params.count, rng = makeRng(params.seed * 977 + 11);
  const spacing = Math.sqrt(0.785 / n), h = Math.min(0.2, 1.5 * spacing);   // person height
  // Seeded dart throwing on the disc: keep a point only if it is not too close to the earlier ones.
  const pts = []; let minD = 1.0 * spacing;
  while (pts.length < n) {
    let ok = false;
    for (let tries = 0; tries < 60 && !ok; tries++) {
      const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * (0.5 - h * 0.15);
      const p = [Math.cos(a) * r, Math.sin(a) * r];
      if (pts.every(q => Math.hypot(q[0] - p[0], q[1] - p[1]) >= minD)) { pts.push(p); ok = true; }
    }
    if (!ok) minD *= 0.9;   // too crowded: relax the spacing a little
  }
  const people = pts.map(p => ({ x: p[0], z: p[1], yaw: rng() * 6.28, phase: rng() * 6.28, hs: 0.88 + rng() * 0.24 }));

  const bodyGeo = new THREE.CapsuleGeometry(0.17, 0.42, 4, 10); bodyGeo.translate(0, 0.38, 0);   // ~0..0.76 tall
  const headGeo = new THREE.SphereGeometry(0.15, 14, 10); headGeo.translate(0, 0.9, 0);
  const bodyMat = ctx.mat.solid(0xffffff, { rough: 0.65, rim: 0.3, main: false });   // colours come from the instances
  const headMat = ctx.mat.solid(0xffffff, { rough: 0.6, main: false });
  const bodies = new THREE.InstancedMesh(bodyGeo, bodyMat, n), heads = new THREE.InstancedMesh(headGeo, headMat, n);
  bodies.frustumCulled = heads.frustumCulled = false;
  const mixed = people.map((_, i) => new THREE.Color(MIX[Math.floor(rng() * MIX.length)]));
  const skins = people.map(() => new THREE.Color(SKIN[Math.floor(rng() * SKIN.length)]));
  // Body colours: a mix when the colour is white (no colour asked for), else everyone in that colour.
  let painted = -1;
  const paint = hex => {
    if (hex === painted) return;
    painted = hex;
    const one = new THREE.Color(hex);
    for (let i = 0; i < n; i++) bodies.setColorAt(i, hex === 0xffffff ? mixed[i] : one);
    bodies.instanceColor.needsUpdate = true;
  };
  for (let i = 0; i < n; i++) heads.setColorAt(i, skins[i]);
  heads.instanceColor.needsUpdate = true;
  paint(params.color !== null ? ctx.color(params.color) : 0xffffff);

  const group = new THREE.Group(); group.add(bodies, heads);
  const dummy = new THREE.Object3D();
  function place(shown, t) {
    for (let i = 0; i < n; i++) {
      const u = Math.min(1, Math.max(0, shown * (n + 8) - i));          // each person's own 0..1 grow-in
      const k = u * u * (3 - 2 * u);
      const p = people[i];
      const sway = 1 + 0.025 * Math.sin(t * 2.4 + p.phase);
      dummy.position.set(p.x, 0, p.z); dummy.rotation.set(0, p.yaw, 0);
      dummy.scale.set(h * k, h * p.hs * k * sway, h * k);
      dummy.updateMatrix();
      bodies.setMatrixAt(i, dummy.matrix); heads.setMatrixAt(i, dummy.matrix);
    }
    bodies.instanceMatrix.needsUpdate = heads.instanceMatrix.needsUpdate = true;
  }
  place(1, 0);
  const bounds = new THREE.Box3(new THREE.Vector3(-0.5, 0, -0.5), new THREE.Vector3(0.5, h * 1.15, 0.5));
  return {
    object: group,
    bounds,
    setColor(hex) { paint(hex); },
    update(t, state) { place(state.params.count_shown, t); },
    dispose() { bodyGeo.dispose(); headGeo.dispose(); bodyMat.dispose(); headMat.dispose(); bodies.dispose(); heads.dispose(); },
  };
}
