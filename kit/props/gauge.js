// Prop: gauge. A round dial with a coloured arc, tick marks and a needle. Animate "value" 0..1 to swing the needle.
// Exports: meta, build(params, ctx). Face looks toward +z. The colour is the bezel.

import * as THREE from 'three';
import { rbox, kit } from './lib/machines.js';

export const meta = {
  name: 'gauge',
  summary: 'A dial gauge with a coloured arc and a swinging needle. For speed, pressure, risk, levels, meters.',
  tags: ['machine', 'info'],
  floats: false,
  params: {
    color: { type: 'color', default: '#c9d0da', doc: 'bezel colour' },
    arc: { type: 'enum', values: ['green-red', 'red-green', 'blue-red'], default: 'green-red', doc: 'colours of the arc from left to right' },
  },
  animatable: { value: { min: 0, max: 1, default: 0.5, doc: 'needle position (0 = far left, 1 = far right)' } },
};

const SWEEP = 240 * Math.PI / 180;   // total swing of the needle

export function build(params, ctx) {
  const k = kit(ctx), group = new THREE.Group();
  const m = (g, mt, x, y, z, p = group) => k.mesh(g, mt, x, y, z, p);
  const dial = new THREE.Group(); dial.position.y = 0.1; group.add(dial);
  const cyl = (r, h) => { const g = new THREE.CylinderGeometry(r, r, h, 48); g.rotateX(Math.PI / 2); return g; };
  const dark = k.mat(0x262b36, { rough: 0.5 });
  m(cyl(0.5, 0.12), k.main(ctx.color(params.color), { rough: 0.3, metal: 0.5 }), 0, 0, 0, dial);
  m(new THREE.TorusGeometry(0.47, 0.04, 12, 56), k.mat(0xe6ebf2, { rough: 0.25, metal: 0.7 }), 0, 0, 0.06, dial);
  m(cyl(0.44, 0.03), k.mat(0x1c2230, { rough: 0.6 }), 0, 0, 0.06, dial);
  // Coloured arc: 24 small ring pieces, colour blended along the arc.
  const ends = { 'green-red': [0x38d46a, 0xff3b30], 'red-green': [0xff3b30, 0x38d46a], 'blue-red': [0x3d8bff, 0xff3b30] }[params.arc];
  const NSEG = 24, a0 = Math.PI / 2 + SWEEP / 2, c = new THREE.Color();
  for (let i = 0; i < NSEG; i++) {
    const u = (i + 0.5) / NSEG;
    c.setHex(ends[0]).lerp(new THREE.Color(ends[1]), u);
    const g = new THREE.RingGeometry(0.28, 0.37, 6, 1, a0 - SWEEP * (i + 1) / NSEG - 0.002, SWEEP / NSEG + 0.004);
    const mt = k.mat(c.getHex(), { rough: 0.4, emissive: 0.5 });
    m(g, mt, 0, 0, 0.077, dial);
  }
  // Tick marks around the outside of the arc.
  for (let i = 0; i <= 10; i++) {
    const a = SWEEP / 2 - SWEEP * i / 10;
    const tk = m(rbox(0.018, i % 5 === 0 ? 0.07 : 0.04, 0.012, 0.005), k.mat(0xf2f4f8, { rough: 0.4 }), -Math.sin(a) * 0.405, Math.cos(a) * 0.405, 0.08, dial);
    tk.rotation.z = a;
  }
  // Needle: a tapered dark-red blade pivoting round a hub.
  const needle = new THREE.Group(); needle.position.z = 0.1; dial.add(needle);
  const s = new THREE.Shape(); s.moveTo(-0.03, -0.08); s.lineTo(0.03, -0.08); s.lineTo(0.008, 0.36); s.lineTo(-0.008, 0.36); s.closePath();
  const ng = new THREE.ExtrudeGeometry(s, { depth: 0.015, bevelEnabled: true, bevelThickness: 0.005, bevelSize: 0.004, bevelSegments: 1 });
  m(ng, k.mat(0xff5a3c, { rough: 0.3, emissive: 0.35 }), 0, 0, 0, needle);
  const hub = m(new THREE.SphereGeometry(0.06, 16, 12), k.mat(0xdfe5ee, { metal: 0.8, rough: 0.25 }), 0, 0, 0.11, dial);
  hub.scale.z = 0.7;
  // Stand.
  m(rbox(0.5, 0.12, 0.3, 0.04), dark, 0, -0.5, 0);
  return {
    object: group,
    update(t, state) {
      const v = Math.min(1, Math.max(0, state.params.value));
      needle.rotation.z = SWEEP / 2 - SWEEP * v + 0.006 * Math.sin(t * 21) * (0.4 + v);   // tiny tremble
    },
    dispose() { k.dispose(); },
  };
}
