// Prop: dna. A tall double helix: two beaded backbones joined by coloured base-pair rungs, turning slowly.
// Exports: meta, build(params, ctx). Animate "unzip" 0..1: the helix opens from the top, the strands part and the rungs split.

import * as THREE from 'three';

export const meta = {
  name: 'dna',
  summary: 'A DNA double helix with coloured base pairs, turning slowly. Animate unzip 0..1 to open it from the top.',
  tags: ['body', 'science', 'life'],
  floats: true,
  params: {
    color: { type: 'color', default: '#dfe3ff', doc: 'backbone colour' },
  },
  animatable: {
    unzip: { min: 0, max: 1, default: 0, doc: 'how far the helix has unzipped, from the top down (0 = closed)' },
  },
};

const BEADS = 110, PAIRS = 22, R0 = 0.17, OPEN = 0.15, TURNS = 2.4, H = 1;
const BASES = [[0x4fd36b, 0xff4b4b], [0xff4b4b, 0x4fd36b], [0xffd84a, 0x3d8bff], [0x3d8bff, 0xffd84a]];   // A-T, T-A, G-C, C-G
const smooth = x => { const k = Math.min(1, Math.max(0, x)); return k * k * (3 - 2 * k); };

export function build(params, ctx) {
  const made = [], keep = x => { made.push(x); return x; };
  const group = new THREE.Group(), spin = new THREE.Group(); group.add(spin);
  const beadG = keep(new THREE.SphereGeometry(1, 14, 10)), rungG = keep(new THREE.CylinderGeometry(1, 1, 1, 8));
  const beadM = keep(ctx.mat.solid(ctx.color(params.color), { rough: 0.35, rim: 0.4 }));
  const rungM = keep(ctx.mat.solid(0xffffff, { rough: 0.4, main: false }));
  const beads = new THREE.InstancedMesh(beadG, beadM, BEADS * 2), halves = new THREE.InstancedMesh(rungG, rungM, PAIRS * 2);
  beads.frustumCulled = halves.frustumCulled = false;
  const c = new THREE.Color();
  for (let k = 0; k < PAIRS; k++) {
    const b = BASES[Math.floor(ctx.rng() * 4)];
    halves.setColorAt(2 * k, c.setHex(b[0])); halves.setColorAt(2 * k + 1, c.setHex(b[1]));
  }
  spin.add(beads, halves);

  const dummy = new THREE.Object3D(), up = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3(), q = new THREE.Quaternion();
  const a = new THREE.Vector3(), axis = new THREE.Vector3();
  const openAt = (y01, u) => smooth((u * 1.3 - (1 - y01)) * 3.5);   // y01 = 1 at the top, which opens first
  const strandPt = (s, y01, u, out) => {
    const ang = y01 * Math.PI * 2 * TURNS + s * Math.PI, R = R0 + OPEN * openAt(y01, u);
    return out.set(Math.cos(ang) * R, (y01 - 0.5) * H, Math.sin(ang) * R);
  };
  function pose(u) {
    for (let s = 0; s < 2; s++) for (let i = 0; i < BEADS; i++) {
      strandPt(s, i / (BEADS - 1), u, a);
      dummy.position.copy(a); dummy.quaternion.identity(); dummy.scale.setScalar(0.026); dummy.updateMatrix();
      beads.setMatrixAt(s * BEADS + i, dummy.matrix);
    }
    for (let k = 0; k < PAIRS; k++) {
      const y01 = (k + 0.5) / PAIRS, o = openAt(y01, u);
      for (let s = 0; s < 2; s++) {
        strandPt(s, y01, u, a);
        axis.set(0, a.y, 0);                                                 // the helix axis at this height
        const len = a.distanceTo(axis) * 0.5 * (1 - 0.5 * o);                // half a rung, shorter when open (a free base)
        dir.copy(axis).sub(a).normalize();
        dummy.position.copy(a).addScaledVector(dir, len / 2);
        dummy.quaternion.copy(q.setFromUnitVectors(up, dir)); dummy.scale.set(0.017, len, 0.017); dummy.updateMatrix();
        halves.setMatrixAt(2 * k + s, dummy.matrix);
      }
    }
    beads.instanceMatrix.needsUpdate = halves.instanceMatrix.needsUpdate = true;
  }
  pose(0);
  const E = R0 + OPEN + 0.03;
  return {
    object: group,
    bounds: new THREE.Box3(new THREE.Vector3(-E, -H / 2 - 0.03, -E), new THREE.Vector3(E, H / 2 + 0.03, E)),
    update(t, state) { pose(state.params.unzip); spin.rotation.y = t * 0.45; },
    dispose() { for (const x of made) x.dispose(); beads.dispose(); halves.dispose(); },
  };
}
