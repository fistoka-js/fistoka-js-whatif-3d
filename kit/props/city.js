// Prop: city. A square block of varied buildings on a base plate with windows that light up. Animate "lights" 0..1.
// Exports: meta, build(params, ctx). Windows are one InstancedMesh; each has a fixed random switch-on level.

import * as THREE from 'three';
import { hash } from './lib/noise.js';

export const meta = {
  name: 'city',
  summary: 'A city block of buildings with lit windows; styles modern or old. Animate "lights" for night falling.',
  tags: ['place', 'earth'],
  floats: false,
  params: {
    style: { type: 'enum', values: ['modern', 'old'], default: 'modern', doc: 'modern glass towers or old brick houses with pitched roofs' },
    seed: { type: 'int', min: 0, max: 999, default: 1, doc: 'which arrangement of buildings' },
  },
  animatable: { lights: { min: 0, max: 1, default: 0.7, doc: 'how many windows are lit (0 = none, 1 = most)' } },
};

const MODERN = [0x5f87b8, 0x7a8fa6, 0x4f6f94, 0x8aa0b8, 0x6a7a8c, 0x9aa8b8];
const OLD = [0xb5654a, 0xc98a5a, 0xa8794f, 0xd2a870, 0x9c5a48, 0xc0a080];

export function build(params, ctx) {
  const modern = params.style === 'modern', pal = modern ? MODERN : OLD, rng = ctx.rng;
  const group = new THREE.Group(), geos = [], mats = [];
  const solid = (c, o = {}) => { const m = ctx.mat.solid(c, { main: false, rough: 0.7, ...o }); mats.push(m); return m; };
  const add = (g, m, x, y, z) => { geos.push(g); const o = new THREE.Mesh(g, m); o.position.set(x, y, z); group.add(o); return o; };

  add(new THREE.BoxGeometry(1, 0.05, 1), solid(0x6e747c), 0, 0.025, 0);
  // Roads: dark strips in a cross, lots in four quadrants (2x2 buildings each).
  const road = solid(0x30343a);
  add(new THREE.BoxGeometry(1, 0.006, 0.07), road, 0, 0.052, 0); add(new THREE.BoxGeometry(0.07, 0.006, 1), road, 0, 0.052, 0);

  const wins = []; // { x, y, z, ry, th }
  const cell = 0.5 / 2;
  for (let qx = 0; qx < 4; qx++) for (let qz = 0; qz < 4; qz++) {
    const cx = (qx - 1.5) * cell * 1.0 * 1.0, cz = (qz - 1.5) * cell * 1.0;
    const r = hash(qx * 9 + qz * 31 + params.seed * 7);
    const w = 0.15 + 0.05 * hash(r * 50), d = 0.15 + 0.05 * hash(r * 70);
    const tall = (qx === 1 || qx === 2) && (qz === 1 || qz === 2);
    const h = modern ? 0.18 + r * (tall ? 0.62 : 0.34) : 0.12 + r * 0.2;
    const col = pal[Math.floor(hash(r * 90) * pal.length)];
    const x = cx + (qx < 2 ? -0.025 : 0.025), z = cz + (qz < 2 ? -0.025 : 0.025);
    add(new THREE.BoxGeometry(w, h, d), solid(col, { rough: modern ? 0.35 : 0.85, metal: modern ? 0.2 : 0 }), x, 0.05 + h / 2, z);
    let top = 0.05 + h;
    if (modern) {
      if (r > 0.6) { add(new THREE.BoxGeometry(w * 0.6, 0.06, d * 0.6), solid(0x56667a), x, top + 0.03, z); top += 0.06; }
      if (r > 0.82) add(new THREE.CylinderGeometry(0.004, 0.004, 0.14, 4), solid(0xd0d4da), x, top + 0.07, z);
    } else {
      const roof = new THREE.ConeGeometry(Math.max(w, d) * 0.78, 0.09, 4); roof.rotateY(Math.PI / 4);
      add(roof, solid(r > 0.5 ? 0x7a3b32 : 0x50565e, { flat: true }), x, top + 0.045, z);
    }
    // windows on all four walls: columns x rows
    const cols = 3, rows = Math.max(2, Math.floor(h / 0.055));
    for (let side = 0; side < 4; side++) {
      const ry = side * Math.PI / 2, span = side % 2 ? d : w, nx = Math.sin(ry), nz = Math.cos(ry), off = (side % 2 ? w : d) / 2 + 0.002;
      for (let c = 0; c < cols; c++) for (let rr = 0; rr < rows; rr++) {
        const u = ((c + 0.5) / cols - 0.5) * span * 0.8, y = 0.05 + (rr + 0.7) / (rows + 0.2) * h * 0.92;
        wins.push({ x: x + nx * off + Math.cos(ry) * u, y, z: z + nz * off - Math.sin(ry) * u, ry, th: hash(wins.length * 1.7 + params.seed), s: span });
      }
    }
  }
  const winGeo = new THREE.PlaneGeometry(0.03, 0.026), winMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const inst = new THREE.InstancedMesh(winGeo, winMat, wins.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1);
  wins.forEach((w, i) => { q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), w.ry); m4.compose(new THREE.Vector3(w.x, w.y, w.z), q, one); inst.setMatrixAt(i, m4); });
  group.add(inst);
  const lit = new THREE.Color(0xffd27a), dark = new THREE.Color(modern ? 0x1f2c44 : 0x3a2c28), c = new THREE.Color();
  let last = -1;
  function update(t, state) {
    const L = state.params.lights;
    if (L === last) return; // colours only change with "lights"
    last = L;
    wins.forEach((w, i) => { c.copy(dark); if (w.th < L * 0.85) c.copy(lit).multiplyScalar(0.85 + 0.3 * hash(i)); inst.setColorAt(i, c); });
    inst.instanceColor.needsUpdate = true;
  }
  update(0, { params: { lights: meta.animatable.lights.default } });
  return { object: group, update, dispose() { geos.forEach(g => g.dispose()); mats.forEach(m => m.dispose()); winGeo.dispose(); winMat.dispose(); inst.dispose(); } };
}
