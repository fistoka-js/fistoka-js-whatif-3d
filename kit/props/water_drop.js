// Prop: water_drop. A glossy teardrop with a bright highlight, optionally with a splash ripple and small droplets below.
// Exports: meta, build(params, ctx). Ripples and droplets loop as pure functions of t.

import * as THREE from 'three';

export const meta = {
  name: 'water_drop',
  summary: 'A glossy teardrop of water (any colour), optionally with a splash ripple. For rain, water, liquids.',
  tags: ['nature', 'water'],
  floats: false,
  params: {
    color: { type: 'color', default: '#3da5ff', doc: 'colour of the liquid' },
    splash: { type: 'bool', default: false, doc: 'show a pool, ripple rings and small droplets under the drop' },
  },
  animatable: {},
};

// Teardrop outline: round at the bottom, pointed at the top.
function dropGeo(h, w) {
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const s = i / 24;
    pts.push(new THREE.Vector2(Math.max(0.0005, w * Math.pow(Math.sin(Math.PI * Math.pow(s, 0.62)), 0.8) * (1 - 0.35 * s * s)), s * h));
  }
  return new THREE.LatheGeometry(pts, 32);
}

export function build(params, ctx) {
  const group = new THREE.Group(), geos = [], mats = [];
  const base = params.splash ? 0.16 : 0;
  const body = dropGeo(0.78, 0.24); geos.push(body);
  const mat = ctx.mat.solid(ctx.color(params.color), { rough: 0.06, rim: 0.7, transparent: true, opacity: 0.92 }); mats.push(mat);
  const drop = new THREE.Mesh(body, mat); drop.position.y = base; group.add(drop);
  const hiMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, toneMapped: false }); mats.push(hiMat);
  const hi = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), hiMat); geos.push(hi.geometry);
  hi.scale.set(0.8, 1.6, 0.5); hi.position.set(-0.1, base + 0.24, 0.17); hi.rotation.z = 0.25; group.add(hi);
  const hi2 = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), hiMat); hi2.position.set(0.1, base + 0.12, 0.17); group.add(hi2); geos.push(hi2.geometry);

  const rings = [], drops = [];
  if (params.splash) {
    const tint = new THREE.MeshStandardMaterial({ color: ctx.color(params.color), transparent: true, opacity: 0.7, roughness: 0.1 }); mats.push(tint);
    const pool = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.03, 40), tint); pool.position.y = 0.015; group.add(pool); geos.push(pool.geometry);
    for (let i = 0; i < 2; i++) {
      const g = new THREE.TorusGeometry(0.2, 0.012, 6, 40); geos.push(g);
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, toneMapped: false, depthWrite: false }));
      m.rotation.x = Math.PI / 2; m.position.y = 0.032; group.add(m); mats.push(m.material); rings.push({ m, ph: i * 0.5 });
    }
    const dg = new THREE.SphereGeometry(0.03, 10, 8); geos.push(dg);
    for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(dg, mat); group.add(m); drops.push({ m, a: i * 1.26 + 0.4 }); }
  }
  return {
    object: group,
    update(t, state) {
      drop.scale.set(1 - 0.015 * Math.sin(t * 2.2), 1 + 0.02 * Math.sin(t * 2.2), 1 - 0.015 * Math.sin(t * 2.2));
      for (const r of rings) {
        const u = (t * 0.45 + r.ph) % 1;
        r.m.scale.setScalar(0.4 + 1.9 * u); r.m.material.opacity = 0.7 * (1 - u) * state.opacity;
      }
      drops.forEach((d, i) => {
        const u = (t * 0.6 + i * 0.13) % 1, r = 0.12 + 0.2 * u;
        d.m.position.set(Math.cos(d.a) * r, 0.04 + 0.2 * Math.sin(Math.PI * u), Math.sin(d.a) * r);
        d.m.scale.setScalar(1 - 0.5 * u);
      });
    },
    bounds: params.splash ? new THREE.Box3(new THREE.Vector3(-0.42, 0, -0.42), new THREE.Vector3(0.42, 0.95, 0.42)) : undefined,
    dispose() { geos.forEach(g => g.dispose()); mats.forEach(m => m.dispose()); },
  };
}
