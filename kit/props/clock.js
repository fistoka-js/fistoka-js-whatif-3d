// Prop: clock. A round alarm-style clock with bells, feet and hour/minute hands. Animate "hours" (0..24) to move the hands.
// Exports: meta, build(params, ctx). Face looks toward +z. Param "spin" runs the hands fast as time passes.

import * as THREE from 'three';
import { rbox, kit } from './lib/machines.js';

export const meta = {
  name: 'clock',
  summary: 'A round clock with hour and minute hands. For time, deadlines, ageing, speed, "how long".',
  tags: ['machine', 'everyday', 'info'],
  floats: false,
  params: {
    color: { type: 'color', default: 'red', doc: 'case colour' },
    spin: { type: 'number', min: 0, max: 40, default: 0, doc: 'extra hours per second the hands run (fast time passing)' },
  },
  animatable: { hours: { min: 0, max: 24, default: 10.1, doc: 'time shown, in hours (0..24); hands follow' } },
};

export function build(params, ctx) {
  const k = kit(ctx), group = new THREE.Group();
  const m = (g, mt, x, y, z) => k.mesh(g, mt, x, y, z, group);
  const body = k.main(ctx.color(params.color), { rough: 0.35, rim: 0.3 });
  const metal = k.mat(0xd8dee6, { rough: 0.3, metal: 0.8 });
  const dark = k.mat(0x262b36, { rough: 0.5 });
  const face = k.mat(0xfbf6e8, { rough: 0.7 });
  const cyl = (r, h) => { const g = new THREE.CylinderGeometry(r, r, h, 48); g.rotateX(Math.PI / 2); return g; };
  m(cyl(0.5, 0.14), body, 0, 0, 0);
  const rim = m(new THREE.TorusGeometry(0.46, 0.05, 12, 56), body, 0, 0, 0.05);
  m(cyl(0.44, 0.03), face, 0, 0, 0.06);
  // Bells, hammer and feet make it read as a clock, not a plate.
  for (const s of [-1, 1]) {
    const b = m(new THREE.SphereGeometry(0.13, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), metal, s * 0.34, 0.4, -0.02);
    b.rotation.z = -s * 0.75;
    m(rbox(0.12, 0.15, 0.12, 0.04), body, s * 0.28, -0.5, 0).rotation.z = s * 0.3;
  }
  m(new THREE.SphereGeometry(0.03, 10, 8), dark, 0, 0.55, -0.02);
  // Hour marks.
  for (let i = 0; i < 12; i++) {
    const big = i % 3 === 0, a = i * Math.PI / 6;
    const t = m(rbox(big ? 0.04 : 0.022, big ? 0.1 : 0.06, 0.012, 0.006), dark, Math.sin(a) * 0.35, Math.cos(a) * 0.35, 0.082);
    t.rotation.z = -a;
  }
  // Hands: boxes that start at the centre and point up; turned each frame.
  const hand = (len, w, mt, z) => {
    const g = rbox(w, len, 0.02, w / 2.2); g.translate(0, len / 2 - 0.03, 0);
    const pivot = new THREE.Group(); pivot.position.z = z; group.add(pivot);
    k.mesh(g, mt, 0, 0, 0, pivot); return pivot;
  };
  const hh = hand(0.25, 0.05, dark, 0.1), mh = hand(0.36, 0.034, dark, 0.118);
  m(new THREE.SphereGeometry(0.045, 14, 10), k.mat(0xffc44d, { metal: 0.6, rough: 0.3 }), 0, 0, 0.13);
  return {
    object: group,
    update(t, state) {
      const h = state.params.hours + t * params.spin;
      hh.rotation.z = -h / 12 * Math.PI * 2;
      mh.rotation.z = -h * Math.PI * 2;
    },
    dispose() { k.dispose(); },
  };
}
