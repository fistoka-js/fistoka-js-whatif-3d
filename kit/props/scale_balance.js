// Prop: scale_balance. A classic two-pan balance on a pillar. Animate "tilt" -1..1 (+1 = right pan down).
// Exports: meta, build(params, ctx). The colour is the metal of beam and pans (default gold).

import * as THREE from 'three';
import { rbox, kit } from './lib/machines.js';

export const meta = {
  name: 'scale_balance',
  summary: 'A two-pan balance that tips left or right. For comparing, fairness, trade-offs, weighing, justice.',
  tags: ['info', 'machine'],
  floats: false,
  params: { color: { type: 'color', default: 'gold', doc: 'beam and pan colour' } },
  animatable: { tilt: { min: -1, max: 1, default: 0, doc: 'tilt (-1 = left pan down, 0 = level, 1 = right pan down)' } },
};

const PY = 0.82, ARM = 0.44, HANG = 0.32, MAXA = 0.28;

// A thin cylinder from point a to point b.
function line(a, b, r = 0.007) {
  const d = new THREE.Vector3().subVectors(b, a), g = new THREE.CylinderGeometry(r, r, d.length(), 5);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return g;
}

export function build(params, ctx) {
  const k = kit(ctx), group = new THREE.Group();
  const metal = k.main(ctx.color(params.color), { rough: 0.3, metal: 0.7, rim: 0.3 });
  const base = k.mat(0x5a4636, { rough: 0.6 });
  const rope = k.mat(0x3a3a44, { rough: 0.6 });
  const m = (g, mt, x, y, z, p = group) => k.mesh(g, mt, x, y, z, p);
  m(new THREE.CylinderGeometry(0.34, 0.4, 0.08, 36), base, 0, 0.04, 0);
  m(new THREE.CylinderGeometry(0.05, 0.07, PY, 20), metal, 0, PY / 2, 0);
  m(new THREE.SphereGeometry(0.075, 20, 14), metal, 0, PY + 0.02, 0);
  const beam = new THREE.Group(); beam.position.y = PY + 0.02; group.add(beam);
  m(rbox(ARM * 2 + 0.06, 0.05, 0.05, 0.02), metal, 0, 0, 0, beam);
  const pans = [];
  for (const s of [-1, 1]) {
    const hang = new THREE.Group(); hang.position.set(s * ARM, 0, 0); beam.add(hang);
    m(new THREE.SphereGeometry(0.03, 10, 8), metal, 0, 0, 0, hang);
    const rim = new THREE.Vector3(), top = new THREE.Vector3();
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI * 2 / 3 + Math.PI / 2;
      rim.set(Math.cos(a) * 0.19, -HANG, Math.sin(a) * 0.19);
      m(line(top, rim), rope, 0, 0, 0, hang);
    }
    const dish = m(new THREE.SphereGeometry(0.2, 28, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), metal, 0, -HANG, 0, hang);
    dish.scale.y = 0.35;
    m(new THREE.TorusGeometry(0.2, 0.012, 8, 32), metal, 0, -HANG, 0, hang).rotation.x = Math.PI / 2;
    pans.push(hang);
  }
  return {
    object: group,
    update(t, state) {
      const a = -Math.min(1, Math.max(-1, state.params.tilt)) * MAXA + 0.012 * Math.sin(t * 1.7);   // slight wobble
      beam.rotation.z = a;
      for (const p of pans) p.rotation.z = -a;   // pans keep hanging straight down
    },
    dispose() { k.dispose(); },
  };
}
