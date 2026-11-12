// Prop: plane. A stylised airliner: white body, swept wings, engines, tail fin. Nose points +x. Gently banks and bobs.
// Exports: meta, build(params, ctx). The colour is the tail, winglets and engine bands.

import * as THREE from 'three';
import { rbox, kit } from './lib/machines.js';

export const meta = {
  name: 'plane',
  summary: 'A stylised airliner that gently banks. For flying, travel, altitude, air pressure, jet lag.',
  tags: ['machine', 'vehicle'],
  floats: true,
  params: { color: { type: 'color', default: 'blue', doc: 'tail, winglet and engine colour' } },
  animatable: {},
};

// A swept slab lying flat in the x/z plane; the root is at z = 0 and the tip at z = +span.
function wingGeo(root, tip, sweep, span, thick) {
  const s = new THREE.Shape();
  s.moveTo(root / 2, 0); s.lineTo(root / 2 - sweep, -span); s.lineTo(root / 2 - sweep - tip, -span); s.lineTo(-root / 2, 0); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2 });
  g.translate(0, 0, -thick / 2); g.rotateX(-Math.PI / 2);
  return g;
}

export function build(params, ctx) {
  const k = kit(ctx), group = new THREE.Group(), fly = new THREE.Group();
  group.add(fly);
  const white = k.mat(0xf4f7fb, { rough: 0.3, rim: 0.3 });
  const accent = k.main(ctx.color(params.color), { rough: 0.4 });
  const grey = k.mat(0xb9c2cc, { rough: 0.4, metal: 0.3 });
  const dark = k.mat(0x27303c, { rough: 0.3 });
  const m = (g, mt, x, y, z) => k.mesh(g, mt, x, y, z, fly);
  const prof = [[0, -0.52], [0.03, -0.5], [0.1, -0.3], [0.13, -0.1], [0.14, 0.1], [0.135, 0.3], [0.1, 0.43], [0.05, 0.5], [0, 0.52]];
  const lathe = pts => { const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 32); g.rotateZ(-Math.PI / 2); return g; };
  m(lathe(prof), white, 0, 0, 0);
  m(lathe(prof.filter(p => p[1] <= -0.3).map(([r, y]) => [r * 1.015, y])), accent, 0, 0, 0);
  // Cockpit and cabin windows.
  m(new THREE.SphereGeometry(0.06, 14, 10), dark, 0.43, 0.05, 0).scale.set(0.9, 0.7, 1.1);
  const win = new THREE.SphereGeometry(0.02, 8, 6);
  for (let i = 0; i < 9; i++) for (const s of [-1, 1]) m(win, dark, -0.25 + i * 0.062, 0.04, s * 0.134).scale.z = 0.4;
  // Wings (both sides), winglets, engines.
  const wing = wingGeo(0.34, 0.12, 0.2, 0.62, 0.03), stab = wingGeo(0.18, 0.07, 0.1, 0.24, 0.02);
  const en = new THREE.CylinderGeometry(0.06, 0.055, 0.2, 18); en.rotateZ(Math.PI / 2);
  const band = new THREE.CylinderGeometry(0.064, 0.064, 0.03, 18); band.rotateZ(Math.PI / 2);
  for (const s of [-1, 1]) {
    m(wing, white, 0.05, -0.06, 0).scale.z = s;
    m(stab, white, -0.4, 0.02, 0).scale.z = s;
    m(rbox(0.1, 0.12, 0.02, 0.01), accent, -0.21, 0.0, s * 0.625).rotation.z = -0.2;
    m(en, grey, 0.05, -0.12, s * 0.27);
    m(new THREE.CircleGeometry(0.045, 14), dark, 0.152, -0.12, s * 0.27).rotation.y = Math.PI / 2;
    m(band, accent, 0.0, -0.12, s * 0.27);
  }
  // Tail fin.
  const fin = new THREE.Shape(); fin.moveTo(0.06, 0); fin.lineTo(-0.1, 0.34); fin.lineTo(-0.2, 0.34); fin.lineTo(-0.18, 0); fin.closePath();
  const fg = new THREE.ExtrudeGeometry(fin, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.005, bevelSize: 0.005, bevelSegments: 2 });
  fg.translate(0, 0, -0.015);
  m(fg, accent, -0.32, 0.06, 0);
  return {
    object: group,
    update(t) {
      fly.rotation.x = 0.12 * Math.sin(t * 0.7);
      fly.rotation.z = 0.04 * Math.sin(t * 0.9 + 1);
      fly.position.y = 0.025 * Math.sin(t * 1.1);
    },
    dispose() { en.dispose(); band.dispose(); k.dispose(); },
  };
}
