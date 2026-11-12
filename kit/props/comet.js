// Prop: comet. A lumpy icy head with a soft glowing tail and a trail of dust specks. Tail points in a chosen direction.
// Exports: meta, build(params, ctx). Animate "tail" to grow or shrink the tail (a comet nearing the Sun grows one).

import * as THREE from 'three';
import { makeRng } from '../engine/rng.js';

export const meta = {
  name: 'comet',
  summary: 'An icy comet head with a long glowing tail. Param "angle" sets the tail direction; animate "tail" length.',
  tags: ['space'],
  floats: true,
  params: {
    angle: { type: 'number', min: -180, max: 180, default: 160, doc: 'tail direction on screen in degrees (0 = right, 90 = up, 180 = left)' },
    color: { type: 'color', default: '#7fd8ff', doc: 'tail glow colour' },
    seed: { type: 'int', min: 0, max: 999, default: 5, doc: 'which lumpy head' },
  },
  animatable: {
    tail: { min: 0, max: 1.5, default: 1, doc: 'tail length (0 = none, 1 = normal)' },
  },
};

const TAIL = 1.7;   // tail length at tail = 1 (head diameter is about 0.5)

export function build(params, ctx) {
  const rng = makeRng(params.seed * 131 + 7);
  const made = [], keep = x => { made.push(x); return x; };
  const tailColor = new THREE.Color(ctx.color(params.color));
  const group = new THREE.Group();
  const head = new THREE.Group();
  group.add(head);

  // Head: a lumpy icy ball with a few darker rock chunks stuck on.
  const hg = keep(new THREE.IcosahedronGeometry(0.26, 2));
  const p = hg.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const k = 1 + 0.10 * Math.sin(v.x * 21 + params.seed) * Math.sin(v.y * 17) + 0.06 * Math.sin(v.z * 29 + 1);
    p.setXYZ(i, v.x * k, v.y * k, v.z * k);
  }
  hg.computeVertexNormals();
  head.add(new THREE.Mesh(hg, keep(ctx.mat.solid(0xe8f6ff, { rough: 0.35, rim: 0.4, emissive: 0.15 }))));
  const rockMat = keep(ctx.mat.solid(0x6d7a8c, { rough: 0.9, flat: true, main: false }));
  for (let i = 0; i < 4; i++) {
    const d = new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.2).normalize();
    const c = new THREE.Mesh(keep(new THREE.IcosahedronGeometry(0.05 + rng() * 0.03, 0)), rockMat);
    c.position.copy(d.multiplyScalar(0.25)); head.add(c);
  }
  head.add(ctx.mat.glowSprite(tailColor, 1.2, 0.5));

  // Tail: three nested soft cones along +x (wide end at the head), turned to the chosen angle.
  const tail = new THREE.Group();
  tail.rotation.z = THREE.MathUtils.degToRad(params.angle);
  const tailMats = [];
  [[0.2, 1.0, 1.6], [0.14, 0.85, 2.2], [0.075, 0.6, 3]].forEach(([r, len, pw], i) => {
    const g = keep(new THREE.ConeGeometry(r, TAIL * len, 32, 1, true));
    g.rotateZ(-Math.PI / 2); g.translate(TAIL * len / 2 + 0.1, 0, 0);   // apex now at +x, wide end near the head
    const m = keep(ctx.mat.fresnelShell(tailColor, { power: pw, strength: 0.6 - i * 0.05, center: true }));
    tailMats.push(m);
    tail.add(ctx.mat.noBounds(new THREE.Mesh(g, m)));
  });
  // Dust specks along the tail (small solid dots, so the tail still reads at phone size).
  const specks = [];
  const sg = keep(new THREE.SphereGeometry(1, 10, 8));
  const sm = keep(new THREE.MeshBasicMaterial({ color: 0xcfeeff, toneMapped: false, transparent: true, opacity: 0.8 }));
  sm.userData.main = false;
  const span = TAIL * 0.95 - 0.25;
  for (let i = 0; i < 26; i++) {
    const s = new THREE.Mesh(sg, sm), d0 = rng() * rng() * span;
    const spread = 0.04 + d0 * 0.1;
    s.position.set(0, (rng() - 0.5) * spread * 2, (rng() - 0.5) * spread * 2);
    s.scale.setScalar(0.012 + rng() * 0.018);
    tail.add(ctx.mat.noBounds(s)); specks.push({ s, d0 });
  }
  group.add(tail);

  // Bounds: head at one end, full-length tail at the other, so the engine sizes the comet as a whole.
  const a = tail.rotation.z, end = new THREE.Vector3(Math.cos(a) * TAIL * 0.9, Math.sin(a) * TAIL * 0.9, 0);
  const bounds = new THREE.Box3().setFromPoints([new THREE.Vector3(-0.3, -0.3, -0.3), new THREE.Vector3(0.3, 0.3, 0.3), end]);

  return {
    object: group,
    bounds,
    update(t, state) {
      const L = state.params.tail;
      tail.scale.set(Math.max(0.001, L), 1, 1);
      tail.visible = L > 0.01;
      head.rotation.set(t * 0.3, t * 0.2, 0);
      const flick = 1 + 0.05 * Math.sin(t * 5);
      for (const m of tailMats) m.uniforms.uOpacity.value = state.opacity * flick;
      for (const k of specks) k.s.position.x = 0.25 + (k.d0 + t * 0.12) % span;
    },
    setColor(hex) { tailColor.setHex(hex); for (const m of tailMats) m.uniforms.uColor.value.setHex(hex); },
    dispose() { for (const x of made) x.dispose(); },
  };
}
