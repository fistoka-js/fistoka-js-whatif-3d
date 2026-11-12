// Prop: lattice. A 3D grid of crystal balls joined by faint lines (the chameleon's nanocrystal skin, a salt crystal, a metal).
// Exports: meta, build(params, ctx). Ported from the approved chameleon video (old scenes/lattice.js): same crystal
// shape, glow, joining lines and spacing range. Spacing 0 = tight block, 1 = spread wide; the box is sized for 1.

import * as THREE from 'three';

export const meta = {
  name: 'lattice',
  summary: '3D grid of glowing balls joined by faint lines. Animate spacing, shake, tilt. Crystals, solids.',
  tags: ['science', 'mechanism'],
  floats: true,
  params: {
    count: { type: 'int', min: 3, max: 5, default: 4, doc: 'balls per side' },
    color: { type: 'color', default: '#35c6e8', doc: 'ball colour' },
  },
  animatable: {
    spacing: { min: 0, max: 1, default: 0.1, doc: 'gap: 0 tight block, 1 spread wide' },
    shake: { min: 0, max: 1, default: 0, doc: 'vibration (0 = still)' },
    tilt: { min: 0, max: 1, default: 0, doc: 'view: 0 three-quarter, 1 square-on' },
  },
};

const R = 0.2, SP_TIGHT = 0.52, SP_WIDE = 1.18;   // ball radius and spacing range, from the approved video
const hash = x => { const s = Math.sin(x * 12.9898) * 43758.5453; return s - Math.floor(s); };   // pure 0..1 noise

export function build(params, ctx) {
  const N = params.count, half = (N - 1) / 2;
  const ballGeo = new THREE.IcosahedronGeometry(R, 1);
  const ballMat = ctx.mat.solid(ctx.color(params.color), { rough: 0.4, metal: 0.2, flat: true, emissive: 0.4, rim: 0.4 });
  const lineMat = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.45, toneMapped: false });
  const group = new THREE.Group(), turn = new THREE.Group();   // turn = the whole grid, turned by "tilt"
  group.add(turn);
  const balls = [];
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) for (let k = 0; k < N; k++) {
    const m = new THREE.Mesh(ballGeo, ballMat); turn.add(m); balls.push({ m, i, j, k, idx: balls.length });
  }
  const id = (i, j, k) => (i * N + j) * N + k, pairs = [];
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) for (let k = 0; k < N; k++) {
    if (i < N - 1) pairs.push([id(i, j, k), id(i + 1, j, k)]);
    if (j < N - 1) pairs.push([id(i, j, k), id(i, j + 1, k)]);
    if (k < N - 1) pairs.push([id(i, j, k), id(i, j, k + 1)]);
  }
  const arr = new Float32Array(pairs.length * 6), lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  const lines = new THREE.LineSegments(lineGeo, lineMat); lines.frustumCulled = false; turn.add(lines);
  const glow = ctx.mat.glowSprite(ctx.color(params.color), half * SP_WIDE * 2.6, 0.18);
  group.add(glow);

  // Fixed box big enough for the widest, most turned state, so a tight lattice is a smaller block (as in the video).
  const e = half * SP_WIDE + R + 0.1, ex = e * 1.2;
  const bounds = new THREE.Box3(new THREE.Vector3(-ex, -e * 1.05, -ex), new THREE.Vector3(ex, e * 1.05, ex));
  const tint = new THREE.Color(), white = new THREE.Color(1, 1, 1);
  const pos = [];

  return {
    object: group,
    bounds,
    update(t, state) {
      const sp = SP_TIGHT + (SP_WIDE - SP_TIGHT) * state.params.spacing, sh = state.params.shake;
      turn.rotation.set(0.32 - 0.12 * state.params.tilt, 0.75 * (1 - state.params.tilt), 0);
      pos.length = 0;
      balls.forEach(b => {
        const jx = sh * 0.11 * (hash(b.idx + Math.floor(t * 24) * 1.7) - 0.5), jy = sh * 0.11 * (hash(b.idx + 70 + Math.floor(t * 24) * 1.3) - 0.5);
        const x = (b.i - half) * sp + 0.03 * Math.sin(t * 2 + b.i * 1.3 + b.j) + jx;
        const y = (b.j - half) * sp + 0.03 * Math.sin(t * 2.2 + b.j * 1.1 + b.k) + jy;
        const z = (b.k - half) * sp + 0.03 * Math.sin(t * 1.9 + b.k * 1.7 + b.i);
        b.m.position.set(x, y, z);
        b.m.scale.setScalar(1 + 0.1 * Math.sin(t * 3 + b.idx));
        pos.push(x, y, z);
      });
      pairs.forEach(([a, b], n) => { for (let q = 0; q < 3; q++) { arr[n * 6 + q] = pos[a * 3 + q]; arr[n * 6 + 3 + q] = pos[b * 3 + q]; } });
      lineGeo.attributes.position.needsUpdate = true;
      glow.material.opacity = 0.18 * state.opacity;
    },
    // The colour hook: balls and glow take the colour, the joining lines a lighter version of it.
    setColor(hex) {
      ballMat.color.setHex(hex); ballMat.emissive.setHex(hex);
      ballMat.userData.rimColor.value.setHex(hex).lerp(white, 0.6);
      tint.setHex(hex).lerp(white, 0.55); lineMat.color.copy(tint);
      glow.material.color.setHex(hex);
    },
    dispose() { ballGeo.dispose(); ballMat.dispose(); lineGeo.dispose(); lineMat.dispose(); glow.material.dispose(); },
  };
}
