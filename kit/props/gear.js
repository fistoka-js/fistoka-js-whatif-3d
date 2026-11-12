// Prop: gear. A chain of 1 to 3 interlocking toothed gears that turn together. Face looks toward +z.
// Exports: meta, build(params, ctx). The colour is the first gear; the others are shifted hues of it.

import * as THREE from 'three';
import { kit } from './lib/machines.js';

export const meta = {
  name: 'gear',
  summary: 'Interlocking turning gears (1-3). For machines, mechanisms, systems, cause and effect, engineering.',
  tags: ['machine', 'info'],
  floats: false,
  params: {
    color: { type: 'color', default: 'orange', doc: 'colour of the first gear' },
    count: { type: 'int', min: 1, max: 3, default: 2, doc: 'how many gears in the chain' },
  },
  animatable: {},
};

const MOD = 0.05, TOOTH = 0.045;                 // tooth size: pitch radius = teeth * MOD / 2
const TEETH = [16, 11, 13], DIRS = [0, 0.55, -0.45];   // teeth per gear; direction from each gear to the next (rad)
const SPEED = 0.9;                               // radians per second of the first gear

function gearGeometry(n) {
  const pitch = n * MOD / 2, ro = pitch + TOOTH * 0.45, rr = pitch - TOOTH * 0.55, step = Math.PI * 2 / n;
  const s = new THREE.Shape();
  for (let i = 0; i < n; i++) {
    const a = i * step;
    for (const [r, o] of [[rr, -0.3], [ro, -0.14], [ro, 0.14], [rr, 0.3]]) {
      const x = Math.cos(a + o * step) * r, y = Math.sin(a + o * step) * r;
      if (i === 0 && o === -0.3) s.moveTo(x, y); else s.lineTo(x, y);
    }
  }
  s.closePath();
  for (let h = 0; h < 5; h++) {   // lightening holes
    const a = h * Math.PI * 2 / 5, p = new THREE.Path(), cx = Math.cos(a) * rr * 0.58, cy = Math.sin(a) * rr * 0.58;
    p.absarc(cx, cy, rr * 0.17, 0, Math.PI * 2, true); s.holes.push(p);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2, curveSegments: 10 });
  g.translate(0, 0, -0.05);
  return { geo: g, pitch, n };
}

export function build(params, ctx) {
  const k = kit(ctx), group = new THREE.Group();
  const base = new THREE.Color(ctx.color(params.color));
  const hubGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.2, 16); hubGeo.rotateX(Math.PI / 2);
  const hubMat = k.mat(0xaeb8c6, { rough: 0.35, metal: 0.15 });
  const gears = [];
  let pos = new THREE.Vector2(), prev = null;
  for (let i = 0; i < params.count; i++) {
    const { geo, pitch, n } = gearGeometry(TEETH[i]);
    let r0 = 0, w = 1;
    if (prev) {
      const phi = DIRS[i - 1];
      pos = pos.clone().add(new THREE.Vector2(Math.cos(phi), Math.sin(phi)).multiplyScalar(prev.pitch + pitch));
      // Start angle so the teeth fall into the neighbour's gaps, and the speed that keeps them meshed.
      r0 = phi + Math.PI + ((phi - prev.r0) * prev.n - Math.PI) / n;
      w = -prev.w * prev.n / n;
    }
    const col = base.clone().offsetHSL(i * 0.13, 0, i * 0.02);
    const g = new THREE.Group(); g.position.set(pos.x, pos.y, 0); group.add(g);
    k.mesh(geo, i === 0 ? k.main(col.getHex(), { rough: 0.4, metal: 0.25, flat: true }) : k.mat(col.getHex(), { rough: 0.4, metal: 0.25, flat: true }), 0, 0, 0, g);
    k.mesh(hubGeo, hubMat, 0, 0, 0, g);
    prev = { pitch, n, r0, w };
    gears.push({ g, r0, w });
  }
  // Centre the chain on the origin so it sits in the middle of its box.
  return {
    object: group,
    update(t) { for (const q of gears) q.g.rotation.z = q.r0 + q.w * SPEED * t; },
    dispose() { hubGeo.dispose(); k.dispose(); },
  };
}
