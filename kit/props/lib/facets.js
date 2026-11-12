// Shared helpers for chunky low-poly "nature" props (mountain, rock, iceberg, island, terrain, ...).
// Exports: jitter(geo, rng, amt) pushes shared corners around together (no cracks);
//          paint(geo, fn) makes the mesh flat-faced and colours every face with fn(info) -> THREE.Color | hex;
//          facetMat(ctx, opts) lit flat material that shows the face colours;
//          tint(hex, k) lighter (k>0) or darker (k<0) copy of a colour as a THREE.Color.
// All plain three.js, so it builds in Node.

import * as THREE from 'three';

// Moves every corner by a random amount up to amt (x, y, z). Corners that share a place move together.
// amtY (optional) overrides the up/down amount.
export function jitter(geo, rng, amt, amtY = amt) {
  const pos = geo.attributes.position, seen = new Map();
  for (let i = 0; i < pos.count; i++) {
    const key = `${Math.round(pos.getX(i) * 1e4) + 0},${Math.round(pos.getY(i) * 1e4) + 0},${Math.round(pos.getZ(i) * 1e4) + 0}`;
    let d = seen.get(key);
    if (!d) { d = [(rng() - 0.5) * 2 * amt, (rng() - 0.5) * 2 * amtY, (rng() - 0.5) * 2 * amt]; seen.set(key, d); }
    pos.setXYZ(i, pos.getX(i) + d[0], pos.getY(i) + d[1], pos.getZ(i) + d[2]);
  }
  pos.needsUpdate = true;
  return geo;
}

// Flat-faced copy with one colour per face. fn gets { x, y, z (face centre), nx, ny, nz (face normal), i (face number) }.
export function paint(geo, fn) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.computeVertexNormals();
  const pos = g.attributes.position, nor = g.attributes.normal;
  const cols = new Float32Array(pos.count * 3), c = new THREE.Color();
  for (let f = 0; f < pos.count / 3; f++) {
    const a = f * 3;
    const info = {
      x: (pos.getX(a) + pos.getX(a + 1) + pos.getX(a + 2)) / 3, y: (pos.getY(a) + pos.getY(a + 1) + pos.getY(a + 2)) / 3,
      z: (pos.getZ(a) + pos.getZ(a + 1) + pos.getZ(a + 2)) / 3, nx: nor.getX(a), ny: nor.getY(a), nz: nor.getZ(a), i: f,
    };
    c.set(fn(info));
    for (let k = 0; k < 3; k++) c.toArray(cols, (a + k) * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  if (g !== geo) geo.dispose();
  return g;
}

// Lit material that shows the face colours. opts as ctx.mat.solid (rough, metal, rim, transparent, opacity ...).
export function facetMat(ctx, opts = {}) {
  const m = ctx.mat.solid(0xffffff, { rough: 0.8, flat: true, ...opts });
  m.vertexColors = true;
  return m;
}

// A colour made lighter (k > 0, towards white) or darker (k < 0, towards black).
export function tint(hex, k) {
  return new THREE.Color(hex).lerp(new THREE.Color(k >= 0 ? 0xffffff : 0x000000), Math.abs(k));
}
