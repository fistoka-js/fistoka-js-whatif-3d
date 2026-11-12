// Shared helpers for the machine / everyday-object props (car, plane, ship, clock, ...).
// Exports: rbox(w,h,d,r) rounded box geometry; kit(ctx) a tiny bookkeeping helper (materials, meshes, dispose).
import * as THREE from 'three';

// A box with rounded edges, centred on the origin: width w (x), height h (y), depth d (z), corner radius r.
export function rbox(w, h, d, r = 0.04) {
  const b = Math.max(0.002, Math.min(r * 0.6, w / 2.6, h / 2.6, d / 2.6));
  const iw = w - 2 * b, ih = h - 2 * b, x = iw / 2, y = ih / 2;
  const rr = Math.max(0.001, Math.min(r - b, iw / 2, ih / 2));
  const s = new THREE.Shape(), P = Math.PI;
  s.moveTo(-x + rr, -y); s.lineTo(x - rr, -y); s.absarc(x - rr, -y + rr, rr, -P / 2, 0);
  s.lineTo(x, y - rr); s.absarc(x - rr, y - rr, rr, 0, P / 2);
  s.lineTo(-x + rr, y); s.absarc(-x + rr, y - rr, rr, P / 2, P);
  s.lineTo(-x, -y + rr); s.absarc(-x + rr, -y + rr, rr, P, 1.5 * P);
  const depth = Math.max(0.001, d - 2 * b);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 3, curveSegments: 6 });
  g.translate(0, 0, -depth / 2);
  return g;
}

// Bookkeeping so a prop can create things and free them all in dispose().
//   mat(color, opts)  lit material that keeps its own colour (not tinted by the colour action)
//   main(color, opts) lit material that IS the prop's main colour (tinted by the colour action)
//   raw(material)     register any other material for disposal
//   mesh(geo, material, x, y, z, parent) make a mesh, place it, add it to parent
export function kit(ctx) {
  const geos = [], mats = [];
  return {
    mat(c, o = {}) { const m = ctx.mat.solid(c, { main: false, ...o }); mats.push(m); return m; },
    main(c, o = {}) { const m = ctx.mat.solid(c, o); mats.push(m); return m; },
    raw(m) { mats.push(m); return m; },
    mesh(g, m, x = 0, y = 0, z = 0, parent = null) {
      geos.push(g);
      const o = new THREE.Mesh(g, m); o.position.set(x, y, z);
      if (parent) parent.add(o);
      return o;
    },
    dispose() { geos.forEach(g => g.dispose()); mats.forEach(m => m.dispose()); },
  };
}
