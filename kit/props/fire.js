// Prop: fire. A campfire: layered teardrop flames on logs inside a ring of stones, with a warm glow and sparks.
// Exports: meta, build(params, ctx). Flicker, lean and sparks are pure functions of t. Animate "size" for bigger/smaller flames.

import * as THREE from 'three';
import { jitter } from './lib/facets.js';
import { hash } from './lib/noise.js';

export const meta = {
  name: 'fire',
  summary: 'A campfire with layered flickering flames, logs, stones and a glow. Animate "size". For heat, energy, combustion.',
  tags: ['nature', 'fire', 'energy'],
  floats: false,
  params: {
    color: { type: 'color', default: '#ff5a1f', doc: 'outer flame colour (inner layers are warmer)' },
  },
  animatable: { size: { min: 0.1, max: 1.8, default: 1, doc: 'flame size (0.1 = embers, 1 = campfire, 1.8 = blaze)' } },
};

// A teardrop flame: round at the bottom, pointed at the top, leaning to one side near the tip.
function flameGeo(w, h, lean) {
  const pts = [];
  for (let i = 0; i <= 16; i++) {
    const s = i / 16;
    pts.push(new THREE.Vector2(Math.max(0.0005, w * Math.pow(Math.sin(Math.PI * Math.pow(s, 0.7)), 0.85) * (1 - s * 0.25)), s * h));
  }
  const g = new THREE.LatheGeometry(pts, 12), pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setX(i, pos.getX(i) + lean * Math.pow(pos.getY(i) / h, 2.2));
  g.computeVertexNormals();
  return g;
}

export function build(params, ctx) {
  const group = new THREE.Group(), geos = [], mats = [], rng = ctx.rng;
  const solid = (c, o = {}) => { const m = ctx.mat.solid(c, { main: false, flat: true, ...o }); mats.push(m); return m; };
  // Logs: four crossed cylinders; stones in a ring.
  for (let i = 0; i < 4; i++) {
    const g = new THREE.CylinderGeometry(0.04, 0.045, 0.5, 7); geos.push(g);
    const m = new THREE.Mesh(g, solid(i % 2 ? 0x6b4328 : 0x82532f)); m.rotation.set(0, i * 0.8 + 0.3, 0); m.rotateX(Math.PI / 2 - 0.18); m.position.y = 0.05 + (i % 2) * 0.04;
    group.add(m);
  }
  for (let i = 0; i < 8; i++) {
    const g = jitter(new THREE.IcosahedronGeometry(0.07, 0), rng, 0.012); geos.push(g);
    const m = new THREE.Mesh(g, solid(i % 2 ? 0x8a8782 : 0x6f6c68)); const a = (i / 8) * 6.283;
    m.position.set(Math.cos(a) * 0.36, 0.04, Math.sin(a) * 0.36); m.scale.y = 0.7; group.add(m);
  }
  // Flames: three tongues, each three nested layers (outer see-through, so the inner colours show).
  const outer = new THREE.Color(ctx.color(params.color));
  const layerCols = [outer, new THREE.Color(0xff9d2a), new THREE.Color(0xffd84a)];
  const tongues = [{ x: 0, z: 0, h: 0.62, w: 0.15, lean: 0.06, f: 5.1 }, { x: -0.1, z: 0.05, h: 0.4, w: 0.1, lean: -0.05, f: 6.7 }, { x: 0.1, z: -0.04, h: 0.45, w: 0.11, lean: 0.07, f: 7.9 }];
  const flames = new THREE.Group(); group.add(flames);
  const layers = [];
  tongues.forEach((tg, ti) => layerCols.forEach((c, li) => {
    const k = [1, 0.72, 0.45][li], g = flameGeo(tg.w * k, tg.h * k * (li === 2 ? 0.8 : 1), tg.lean * k); geos.push(g);
    const m = new THREE.MeshBasicMaterial({ color: c, toneMapped: false, transparent: li < 2, opacity: li === 0 ? 0.88 : 0.95, depthWrite: li === 2 });
    mats.push(m);
    const o = new THREE.Mesh(g, m); o.position.set(tg.x, 0.06, tg.z + li * 0.012); o.renderOrder = li + 1; flames.add(o);
    layers.push({ o, tg, li, ph: ti * 2.1 + li * 0.5, m });
  }));
  const glow = ctx.mat.glowSprite(0xff8a2a, 1.6, 0.7); glow.position.y = 0.3; group.add(glow);
  const sparkGeo = new THREE.BoxGeometry(0.018, 0.018, 0.018), sparkMat = new THREE.MeshBasicMaterial({ color: 0xffd060, toneMapped: false });
  const fx = ctx.mat.noBounds(new THREE.Group()); group.add(fx);
  const sparks = [];
  for (let i = 0; i < 8; i++) { const m = new THREE.Mesh(sparkGeo, sparkMat); fx.add(m); sparks.push({ m, ph: hash(i * 3.3), a: hash(i * 5.1) * 6.283, v: 0.5 + 0.5 * hash(i * 7.7) }); }

  function update(t, state) {
    const s = state.params.size;
    flames.scale.set(0.55 + 0.45 * s, s, 0.55 + 0.45 * s);
    for (const L of layers) {
      const f = L.tg.f, flick = 1 + 0.1 * Math.sin(t * f + L.ph) + 0.06 * Math.sin(t * f * 2.3 + L.ph * 2);
      L.o.scale.set(1 - 0.05 * Math.sin(t * f * 1.4 + L.ph), flick, 1);
      L.o.rotation.z = 0.07 * Math.sin(t * f * 0.6 + L.ph) + 0.03 * Math.sin(t * 9 + L.ph);
    }
    glow.material.opacity = state.opacity * (0.35 + 0.35 * Math.min(1.5, s)) * (0.9 + 0.1 * Math.sin(t * 9));
    glow.scale.setScalar(1 + 0.8 * s);
    glow.position.y = 0.1 + 0.25 * s;
    for (const p of sparks) {
      const u = (t * 0.35 * p.v + p.ph) % 1;
      p.m.visible = s > 0.25;
      p.m.position.set(Math.cos(p.a) * 0.12 * u + 0.03 * Math.sin(t * 3 + p.a), 0.3 * s + u * (0.35 + 0.3 * s), Math.sin(p.a) * 0.12 * u);
      p.m.scale.setScalar(1 - u);
    }
  }
  update(0, { opacity: 1, params: { size: 1 } });
  return {
    object: group, update,
    bounds: new THREE.Box3(new THREE.Vector3(-0.43, 0, -0.43), new THREE.Vector3(0.43, 0.8, 0.43)),
    dispose() { geos.forEach(g => g.dispose()); mats.forEach(m => m.dispose()); sparkGeo.dispose(); sparkMat.dispose(); },
  };
}
