// Prop: debris. Jagged low-poly rock chunks: a heap that can fly apart and land scattered.
// Exports: meta, build(params, ctx). Animate "fly" 0..1: 0 = piled up, 0.5 = chunks in mid-air, 1 = landed spread out.
// Positions are a pure function of fly (seeded directions and heights), so scrubbing is safe.

import * as THREE from 'three';
import { jitter } from './lib/facets.js';

export const meta = {
  name: 'debris',
  summary: 'Jagged rock chunks: a heap that flies apart and lands scattered. Animate "fly" 0..1. Impacts, blasts, rubble.',
  notes: 'Use for rock bits, rubble and fragments after an impact or blast (particles are for tiny things). It stands on the ground in ground envs (studio and sky have one; at = where its base rests) and floats at "at" only in envs without a ground (e.g. space). fly 0 is a low heap, 0.5 chunks in the air above the heap area, 1 landed scattered around it.',
  tags: ['nature', 'earth', 'effect'],
  floats: false,
  params: {
    count: { type: 'int', min: 3, max: 120, default: 28, doc: 'how many chunks' },
    color: { type: 'color', default: '#6e5f52', doc: 'rock colour (each chunk is a little lighter or darker)' },
    chunk: { type: 'number', min: 0.02, max: 0.3, default: 0.12, doc: 'typical chunk size (fraction of the whole spread); the prop "size" scales the whole heap' },
  },
  animatable: {
    fly: { min: 0, max: 1, default: 0, doc: '0 = heap at rest, 0.5 = flying, 1 = landed scattered' },
    spread: { min: 0.2, max: 2, default: 1, doc: 'how far they scatter (1 = to the edge of its box)' },
  },
};

export function build(params, ctx) {
  const n = params.count, rng = ctx.rng, S = params.chunk;
  // One jagged chunk shape (a jittered 8-sided blob); the instances differ by scale, turn and shade.
  const geo = new THREE.IcosahedronGeometry(1, 0);
  jitter(geo, rng, 0.25, 0.25);
  geo.computeVertexNormals();
  const mat = ctx.mat.solid(0xffffff, { rough: 0.9, flat: true, rim: 0.5 });
  const mesh = new THREE.InstancedMesh(geo, mat, n);
  mesh.frustumCulled = false;
  const base = new THREE.Color(ctx.color(params.color)), tmp = new THREE.Color();
  const shade = [], chunks = [];
  for (let i = 0; i < n; i++) {
    const a = rng() * Math.PI * 2, dist = 0.12 + 0.33 * Math.sqrt(rng());   // landing place
    const heap = 0.2 * Math.sqrt(rng()), ha = rng() * Math.PI * 2;           // spot in the heap
    const k = 0.5 + rng() * 1.1;
    chunks.push({
      dir: [Math.cos(a), Math.sin(a)], dist, hx: Math.cos(ha) * heap, hz: Math.sin(ha) * heap, hy: rng() * 0.12 * (1 - heap * 4.5),
      rise: 0.25 + 0.4 * rng(), s: [S * k * (0.6 + 0.5 * rng()), S * k * (0.75 + 0.45 * rng()), S * k * (0.6 + 0.5 * rng())],
      ax: [rng() * 3, rng() * 3, rng() * 3], spin: [(rng() - 0.5) * 12, (rng() - 0.5) * 12, (rng() - 0.5) * 12],
    });
    shade.push(0.55 + 0.8 * rng());
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), pos = new THREE.Vector3(), sc = new THREE.Vector3();
  const paint = () => { for (let i = 0; i < n; i++) mesh.setColorAt(i, tmp.copy(base).multiplyScalar(shade[i])); mesh.instanceColor.needsUpdate = true; };
  paint();
  function update(t, state) {
    const f = Math.max(0, Math.min(1, state.params.fly)), spread = state.params.spread;
    chunks.forEach((c, i) => {
      // x/z glide out with an ease-out; height is a parabola that starts and ends on the ground
      const out = 1 - (1 - f) * (1 - f), arc = 4 * f * (1 - f) * c.rise * (0.6 + 0.4 * Math.min(spread, 1.5));
      pos.set(c.hx + c.dir[0] * c.dist * spread * out, -0.5 + c.s[1] + c.hy + arc, c.hz + c.dir[1] * c.dist * spread * out);
      e.set(c.ax[0] + c.spin[0] * f, c.ax[1] + c.spin[1] * f, c.ax[2] + c.spin[2] * f);
      q.setFromEuler(e); sc.set(c.s[0], c.s[1], c.s[2]);
      m4.compose(pos, q, sc); mesh.setMatrixAt(i, m4);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }
  update(0, { params: { fly: 0, spread: 1 } });
  return {
    object: mesh,
    bounds: new THREE.Box3(new THREE.Vector3(-0.5, -0.5, -0.5), new THREE.Vector3(0.5, 0.5, 0.5)),
    update,
    setColor(hex) { base.setHex(hex); paint(); },
    dispose() { geo.dispose(); mat.dispose(); },
  };
}
