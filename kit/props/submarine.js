// Prop: submarine. A chunky yellow sub with conning tower, periscope, portholes and a turning propeller. Bow +x.
// Exports: meta, build(params, ctx). Colour = hull.

import * as THREE from 'three';
import { rbox, kit } from './lib/machines.js';

export const meta = {
  name: 'submarine',
  summary: 'A chunky submarine with periscope, portholes and a spinning propeller. For deep sea, pressure, exploration.',
  tags: ['machine', 'vehicle', 'sea'],
  floats: true,
  params: { color: { type: 'color', default: 'yellow', doc: 'hull colour' } },
  animatable: {},
};

export function build(params, ctx) {
  const k = kit(ctx), group = new THREE.Group(), sub = new THREE.Group();
  group.add(sub);
  const hull = k.main(ctx.color(params.color), { rough: 0.35, rim: 0.3 });
  const red = k.mat(0xd8483a, { rough: 0.45 });
  const metal = k.mat(0x9aa4b0, { rough: 0.35, metal: 0.5 });
  const dark = k.mat(0x2a3140, { rough: 0.4 });
  const glass = k.mat(0x8fe0ff, { rough: 0.1, emissive: 0.6 });
  const m = (g, mt, x, y, z) => k.mesh(g, mt, x, y, z, sub);
  const lathe = pts => { const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 36); g.rotateZ(-Math.PI / 2); return g; };
  const prof = [[0, -0.5], [0.08, -0.47], [0.17, -0.35], [0.21, -0.15], [0.22, 0.15], [0.2, 0.33], [0.14, 0.45], [0.06, 0.5], [0, 0.51]];
  m(lathe(prof), hull, 0, 0, 0);
  // Red stripe band near the stern.
  const band = new THREE.CylinderGeometry(0.207, 0.207, 0.05, 36, 1, true); band.rotateZ(Math.PI / 2);
  m(band, red, -0.2, 0, 0);
  // Conning tower, periscope.
  m(rbox(0.22, 0.17, 0.15, 0.06), hull, 0.03, 0.29, 0);
  m(new THREE.CylinderGeometry(0.012, 0.012, 0.2, 8), metal, 0.08, 0.45, 0);
  m(new THREE.CylinderGeometry(0.014, 0.014, 0.075, 8), metal, 0.115, 0.54, 0).rotation.z = Math.PI / 2;
  m(new THREE.CircleGeometry(0.012, 8), glass, 0.154, 0.54, 0).rotation.y = Math.PI / 2;
  // Portholes on both sides.
  const ring = new THREE.TorusGeometry(0.04, 0.013, 8, 20), pane = new THREE.SphereGeometry(0.036, 12, 8);
  for (const x of [-0.08, 0.06, 0.2]) for (const s of [-1, 1]) {
    m(ring, metal, x, 0.02, s * 0.213); m(pane, glass, x, 0.02, s * 0.206).scale.z = 0.35;
  }
  // Tail fins (cross) and the propeller.
  m(rbox(0.12, 0.014, 0.4, 0.006), hull, -0.4, 0, 0);
  m(rbox(0.12, 0.34, 0.014, 0.006), hull, -0.4, 0, 0);
  m(new THREE.CylinderGeometry(0.045, 0.06, 0.06, 14), dark, -0.51, 0, 0).rotation.z = Math.PI / 2;
  const prop = new THREE.Group(); prop.position.set(-0.56, 0, 0); sub.add(prop);
  k.mesh(new THREE.SphereGeometry(0.04, 12, 8), metal, 0, 0, 0, prop);
  const blade = rbox(0.02, 0.17, 0.06, 0.008);
  for (let i = 0; i < 3; i++) {
    const a = new THREE.Group(); a.rotation.x = i * Math.PI * 2 / 3; prop.add(a);
    const b = k.mesh(blade, metal, 0, 0.1, 0, a); b.rotation.y = 0.5;
  }
  return {
    object: group,
    update(t) {
      prop.rotation.x = -t * 9;
      sub.position.y = 0.02 * Math.sin(t * 1.0);
      sub.rotation.z = 0.025 * Math.sin(t * 0.8 + 1);
    },
    dispose() { ring.dispose(); pane.dispose(); blade.dispose(); k.dispose(); },
  };
}
