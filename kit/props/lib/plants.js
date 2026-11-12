// Shared low-poly trees for the tree and island props.
// Exports: buildTree(style, ctx, seed) -> { object, setTint(hex), sway(t), dispose() }
//   style: round | pine | palm | bare. The base of the trunk sits at y = 0, about 1 unit tall.
//   setTint(hex): multiplies the leaf colour (white = natural colours).

import * as THREE from 'three';
import { jitter, paint, facetMat } from './facets.js';
import { hash } from './noise.js';

const BROWN = 0x8a5a3a;
const LEAF = { round: 0x58b04a, pine: 0x23703f, palm: 0x1f8f3a, bare: 0xffffff };

// A cylinder from point a to point b (used for trunks and branches).
function stick(a, b, r0, r1, mat, sides = 7) {
  const len = a.distanceTo(b), geo = new THREE.CylinderGeometry(r1, r0, len, sides, 1);
  const m = new THREE.Mesh(geo, mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return m;
}

export function buildTree(style, ctx, seed = 1) {
  const group = new THREE.Group(), geos = [], rng = ctx.rng;
  const woodMat = ctx.mat.solid(BROWN, { rough: 0.9, flat: true, main: false });
  const leafMat = facetMat(ctx, { rough: 0.8, main: false, rim: style === 'palm' ? 0.05 : 0.3 });
  const mats = [woodMat, leafMat], leaf = new THREE.Color(LEAF[style]);
  const add = (g, m) => { geos.push(g); const o = new THREE.Mesh(g, m); group.add(o); return o; };
  // Face colours: the leaf colour, lighter on top faces, a little darker underneath, small random variation.
  const leafPaint = (g, light) => paint(g, f => leaf.clone().multiplyScalar(0.55 + 0.45 * Math.max(0, f.ny * 0.5 + 0.5) + hash(f.i + seed) * 0.12).lerp(new THREE.Color(0xffffff), Math.max(0, f.ny) * light));

  if (style === 'round') {
    add(new THREE.CylinderGeometry(0.05, 0.075, 0.42, 7), woodMat).position.y = 0.21;
    const spots = [[0, 0.64, 0, 0.28], [-0.2, 0.52, 0.04, 0.2], [0.2, 0.55, -0.03, 0.21], [0.02, 0.5, 0.2, 0.19], [0.02, 0.86, 0, 0.17]];
    for (const [x, y, z, r] of spots) {
      const g = leafPaint(jitter(new THREE.IcosahedronGeometry(r, 1), rng, r * 0.1), 0.18);
      add(g, leafMat).position.set(x, y, z);
    }
  } else if (style === 'pine') {
    add(new THREE.CylinderGeometry(0.045, 0.06, 0.25, 7), woodMat).position.y = 0.12;
    [[0.2, 0.36, 0.38], [0.4, 0.3, 0.34], [0.6, 0.24, 0.3], [0.8, 0.17, 0.27]].forEach(([y, r, h]) => {
      const g = leafPaint(jitter(new THREE.ConeGeometry(r, h, 8, 1), rng, r * 0.07, 0.01), 0.05);
      add(g, leafMat).position.y = y + h / 2 - 0.02;
    });
  } else if (style === 'palm') {
    const curve = new THREE.CatmullRomCurve3([[0, 0, 0], [0.05, 0.3, 0], [0.14, 0.6, 0], [0.12, 0.88, 0]].map(p => new THREE.Vector3(...p)));
    add(new THREE.TubeGeometry(curve, 10, 0.055, 7), woodMat);
    const top = curve.getPoint(1);
    for (let i = 0; i < 8; i++) { // fronds: bent flat leaves fanned around the top
      const g = new THREE.PlaneGeometry(0.38, 0.62, 1, 6), pos = g.attributes.position;
      for (let v = 0; v < pos.count; v++) {
        const u = (pos.getY(v) + 0.3) / 0.6; // 0 at the trunk .. 1 at the tip
        pos.setXYZ(v, pos.getX(v) * Math.sin(Math.PI * Math.min(1, u * 0.9 + 0.1)) * 1.1, 0.02 + u * 0.58, -0.55 * u * u);
      }
      g.computeVertexNormals();
      geos.push(leafPaint(g, 0));
      const m = new THREE.Mesh(geos[geos.length - 1], leafMat), holder = new THREE.Group();
      m.rotation.x = -Math.PI / 2 + 0.55; // lie along the ground direction, tipped up a little
      holder.position.copy(top); holder.rotation.y = (i / 8) * 6.283 + 0.3;
      holder.add(m); group.add(holder);
    }
    for (let i = 0; i < 3; i++) add(new THREE.IcosahedronGeometry(0.045, 0), woodMat).position.set(top.x + Math.cos(i * 2.1) * 0.06, top.y - 0.05, Math.sin(i * 2.1) * 0.06);
    leafMat.side = THREE.DoubleSide;
  } else { // bare: a trunk that forks three times
    const grow = (from, dir, len, r, depth) => {
      const to = from.clone().addScaledVector(dir, len);
      const s = stick(from, to, r, r * 0.68, woodMat, 6); group.add(s); geos.push(s.geometry);
      if (depth === 0) return;
      const n = depth === 3 ? 3 : 2;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * 6.283 + hash(depth * 7 + i + seed) * 2, tilt = 0.5 + 0.35 * hash(depth * 3 + i * 5 + seed);
        const d = dir.clone().applyAxisAngle(new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), tilt).normalize();
        grow(to, d, len * 0.72, r * 0.68, depth - 1);
      }
    };
    grow(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.05, 1, 0).normalize(), 0.36, 0.06, 3);
  }
  return {
    object: group,
    setTint(hex) { leafMat.color.set(0xffffff).multiply(new THREE.Color(hex)); if (style === 'bare') woodMat.color.set(BROWN).multiply(new THREE.Color(hex)); },
    sway(t) { group.rotation.z = 0.025 * Math.sin(t * 0.9); group.rotation.x = 0.015 * Math.sin(t * 0.7 + 1); },
    dispose() { geos.forEach(g => g.dispose()); mats.forEach(m => m.dispose()); },
  };
}
