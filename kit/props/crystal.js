// Prop: crystal. A cluster of faceted, translucent, softly glowing crystals on a small rock, with a twinkling glint.
// Exports: meta, build(params, ctx). The glint hops between tips as a pure function of t.

import * as THREE from 'three';
import { hash } from './lib/noise.js';
import { jitter, paint, facetMat } from './lib/facets.js';

export const meta = {
  name: 'crystal',
  summary: 'A cluster of faceted translucent crystals with a twinkling glint (any colour). For minerals, gems, energy.',
  tags: ['nature', 'earth', 'mineral'],
  floats: false,
  params: {
    color: { type: 'color', default: '#a35bff', doc: 'crystal colour' },
    seed: { type: 'int', min: 0, max: 999, default: 1, doc: 'which variant of the cluster' },
  },
  animatable: {},
};

// One crystal: a six-sided prism with a pointed tip. Faces get slightly different shades of white (the material tints them).
function crystalGeo(r, h, seed) {
  const pts = [[0.0005, 0], [r, 0], [r * 1.02, h * 0.62], [r * 0.5, h * 0.9], [0.0005, h]].map(p => new THREE.Vector2(p[0], p[1]));
  return paint(new THREE.LatheGeometry(pts, 6), f => new THREE.Color(0xffffff).multiplyScalar(Math.min(1, 0.7 + 0.3 * hash(f.i * 2.1 + seed) + Math.max(0, f.ny) * 0.15)));
}

export function build(params, ctx) {
  const group = new THREE.Group(), geos = [], rng = ctx.rng;
  const mat = facetMat(ctx, { rough: 0.12, metal: 0.1, rim: 0.7, transparent: true, opacity: 0.88 });
  mat.emissive = new THREE.Color(0xffffff); mat.emissiveIntensity = 0.3; // soft inner glow; setColor keeps the tint
  const rockGeo = jitter(new THREE.CylinderGeometry(0.34, 0.42, 0.1, 7, 1), rng, 0.03, 0.01); geos.push(rockGeo);
  const rockMat = ctx.mat.solid(0x5e5a63, { flat: true, main: false });
  const rock = new THREE.Mesh(rockGeo, rockMat); rock.position.y = 0.05; group.add(rock);
  const tips = [];
  // x, z, radius, height, tilt, yaw
  const list = [[0, 0, 0.09, 0.78, 0.04, 0], [0.16, 0.06, 0.07, 0.5, 0.45, 0.8], [-0.17, 0.03, 0.075, 0.58, -0.4, 2.2], [0.04, -0.17, 0.06, 0.42, 0.1, 3.4], [-0.07, 0.18, 0.06, 0.4, 0.5, 4.6], [0.27, -0.1, 0.045, 0.3, 0.6, 5.5], [-0.3, -0.08, 0.05, 0.32, -0.6, 1.5]];
  list.forEach(([x, z, r, h, tilt, yaw], i) => {
    const g = crystalGeo(r, h, params.seed + i * 5); geos.push(g);
    const m = new THREE.Mesh(g, mat), pivot = new THREE.Group();
    pivot.position.set(x, 0.09, z); pivot.rotation.y = yaw; m.rotation.z = tilt * 0.6; m.rotation.x = i % 2 ? 0.2 * tilt : -0.15 * tilt;
    pivot.add(m); group.add(pivot);
    tips.push(new THREE.Vector3(0, h, 0).applyEuler(m.rotation).applyEuler(pivot.rotation).add(pivot.position));
  });
  const glint = ctx.mat.glowSprite(0xffffff, 0.22, 0); group.add(glint);
  const glint2 = ctx.mat.glowSprite(0xffffff, 0.1, 0); group.add(glint2);
  return {
    object: group,
    update(t, state) {
      const cycle = t / 1.6, i = Math.floor(cycle), u = cycle - i;
      const flash = Math.pow(Math.max(0, Math.sin(Math.PI * Math.min(1, u * 1.6))), 3);
      glint.position.copy(tips[(i * 3) % tips.length]); glint.position.z += 0.05;
      glint.material.opacity = flash * state.opacity; glint.scale.setScalar(0.1 + 0.2 * flash);
      glint2.position.copy(tips[(i * 3 + 2) % tips.length]); glint2.position.z += 0.05;
      glint2.material.opacity = Math.pow(Math.max(0, Math.sin(Math.PI * ((u + 0.5) % 1))), 6) * 0.8 * state.opacity;
    },
    dispose() { geos.forEach(g => g.dispose()); mat.dispose(); rockMat.dispose(); },
  };
}
