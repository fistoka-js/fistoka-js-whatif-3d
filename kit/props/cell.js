// Prop: cell. A see-through membrane with the parts inside: animal (round, nucleus, mitochondria, golgi),
// plant (boxy wall, big vacuole, chloroplasts) or bacteria (rod, loose DNA loop, tail). Slowly drifting parts.
// Exports: meta, build(params, ctx).

import * as THREE from 'three';

export const meta = {
  name: 'cell',
  summary: 'A see-through cell with organelles inside. kind: animal, plant or bacteria. Good for biology, disease, growth.',
  tags: ['body', 'science', 'life'],
  floats: true,
  params: {
    kind: { type: 'enum', values: ['animal', 'plant', 'bacteria'], default: 'animal', doc: 'which kind of cell' },
    color: { type: 'color', default: null, doc: 'membrane colour; default depends on kind' },
  },
  animatable: {},
};

const DEFAULT = { animal: '#ff9ec7', plant: '#7be08a', bacteria: '#8ad0ff' };

export function build(params, ctx) {
  const made = [], keep = x => { made.push(x); return x; };
  const kind = params.kind, group = new THREE.Group(), parts = [];
  const solid = (hex, o = {}) => keep(ctx.mat.solid(hex, { rough: 0.4, rim: 0.3, main: false, ...o }));
  const add = (geo, mat, x, y, z, sx = 1, sy = sx, sz = sx, drift = 0.015) => {
    const m = new THREE.Mesh(keep(geo), mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); group.add(m);
    parts.push({ m, home: m.position.clone(), ph: ctx.rng() * 6.28, drift }); return m;
  };
  // A seeded point inside the cell, away from the parts already placed.
  const spot = (r, avoid = []) => {
    for (let i = 0; i < 40; i++) {
      const p = new THREE.Vector3(ctx.rng() * 2 - 1, ctx.rng() * 2 - 1, ctx.rng() * 2 - 1).multiplyScalar(r);
      if (p.length() < r && avoid.every(a => p.distanceTo(a.p) > a.r)) return p;
    }
    return new THREE.Vector3(r * 0.5, 0, 0);
  };

  // Membrane: a translucent shell (shape depends on kind). The "color" action tints it.
  const tint = ctx.color(params.color !== null ? params.color : DEFAULT[kind]);
  const memM = keep(ctx.mat.solid(tint, { rough: 0.15, rim: 0.5, transparent: true, opacity: 0.36 }));
  memM.depthWrite = false;
  let memGeo, scale = [1, 1, 1];
  if (kind === 'plant') {
    // A box with softened corners.
    memGeo = new THREE.BoxGeometry(1, 1, 1, 8, 8, 8);
    const q = memGeo.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < q.count; i++) { v.set(q.getX(i), q.getY(i), q.getZ(i)); v.lerp(v.clone().normalize().multiplyScalar(0.5), 0.28); q.setXYZ(i, v.x, v.y, v.z); }
    memGeo.computeVertexNormals(); scale = [1.05, 0.8, 0.85];
  } else if (kind === 'bacteria') memGeo = new THREE.CapsuleGeometry(0.2, 0.55, 12, 28);
  else memGeo = new THREE.SphereGeometry(0.5, 48, 32);
  const mem = new THREE.Mesh(keep(memGeo), memM); mem.scale.set(...scale); mem.renderOrder = 2; group.add(mem);
  if (kind === 'bacteria') mem.rotation.z = Math.PI / 2;

  const avoid = [];
  if (kind === 'animal') {
    add(new THREE.SphereGeometry(1, 32, 24), solid(0x8f5bd6, { rough: 0.5 }), -0.06, 0.04, 0, 0.19); avoid.push({ p: new THREE.Vector3(-0.06, 0.04, 0), r: 0.3 });
    add(new THREE.SphereGeometry(1, 20, 14), solid(0x5a2f9e), -0.02, 0.0, 0.1, 0.07, 0.07, 0.07, 0);   // nucleolus
    for (let i = 0; i < 4; i++) {   // mitochondria
      const p = spot(0.36, avoid); avoid.push({ p, r: 0.17 });
      const m = add(new THREE.CapsuleGeometry(0.045, 0.09, 6, 12), solid(0xff9a3c), p.x, p.y, p.z); m.rotation.set(ctx.rng() * 3, ctx.rng() * 3, 0);
    }
    for (let i = 0; i < 3; i++) { const p = spot(0.36, avoid); avoid.push({ p, r: 0.12 }); add(new THREE.SphereGeometry(1, 16, 12), solid(0xfff09a), p.x, p.y, p.z, 0.05); }
    const g = spot(0.28, avoid);   // golgi: a small stack of curved plates
    for (let i = 0; i < 3; i++) { const m = add(new THREE.TorusGeometry(0.06 - i * 0.008, 0.012, 8, 20, Math.PI * 1.3), solid(0x3dc7c0), g.x, g.y + i * 0.03, g.z, 1, 1, 1, 0.006); m.rotation.x = Math.PI / 2; }
  } else if (kind === 'plant') {
    add(new THREE.SphereGeometry(1, 28, 20), solid(0x9ad8ff, { transparent: true, opacity: 0.55, rough: 0.2 }), 0.12, 0.0, 0.0, 0.22, 0.18, 0.2, 0.006);   // big vacuole
    add(new THREE.SphereGeometry(1, 24, 18), solid(0x8f5bd6, { rough: 0.5 }), -0.3, 0.06, 0.04, 0.09, 0.09, 0.09, 0.008);                          // nucleus
    for (let i = 0; i < 6; i++) {   // chloroplasts
      const a = i / 6 * 6.28 + 0.4;
      const m = add(new THREE.SphereGeometry(1, 16, 12), solid(0x2fae43), Math.cos(a) * 0.3, (ctx.rng() - 0.5) * 0.22, Math.sin(a) * 0.25, 0.07, 0.035, 0.045); m.rotation.y = a;
    }
    for (let i = 0; i < 2; i++) add(new THREE.CapsuleGeometry(0.03, 0.05, 6, 10), solid(0xff9a3c), -0.12 + i * 0.1, -0.22 + i * 0.02, 0.1);
  } else {
    // Bacteria: a loose DNA loop, ribosome dots and a wavy tail. The rod lies along x.
    add(new THREE.TorusKnotGeometry(0.1, 0.012, 80, 8, 2, 3), solid(0xffe14d, { rough: 0.35 }), 0, 0, 0, 1, 1, 1, 0.004);
    for (let i = 0; i < 14; i++) add(new THREE.SphereGeometry(1, 10, 8), solid(0x5a7fb0), (ctx.rng() - 0.5) * 0.7, (ctx.rng() - 0.5) * 0.25, (ctx.rng() - 0.5) * 0.25, 0.018, 0.018, 0.018, 0.01);
    const pts = []; for (let i = 0; i <= 24; i++) pts.push(new THREE.Vector3(0.48 + i * 0.03, 0.05 * Math.sin(i * 0.8), 0.05 * Math.cos(i * 0.8)));
    group.add(new THREE.Mesh(keep(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.012, 6)), solid(0x7aa8d0)));
  }
  return {
    object: group,
    update(t) {
      for (const p of parts) { const a = t * 0.7 + p.ph; p.m.position.set(p.home.x + p.drift * Math.sin(a), p.home.y + p.drift * Math.sin(a * 1.3 + 1), p.home.z + p.drift * Math.cos(a * 0.9)); }
      const s = 1 + 0.012 * Math.sin(t * 1.6); mem.scale.set(scale[0] * s, scale[1] * s, scale[2] * s);
      group.rotation.y = 0.35 * Math.sin(t * 0.4);
    },
    dispose() { for (const x of made) x.dispose(); },
  };
}
