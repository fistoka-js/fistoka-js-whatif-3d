// Prop: iceberg. Faceted ice with the bigger part under a translucent block of water. Animate "melt" 0..1 to shrink it.
// Exports: meta, build(params, ctx). The waterline is y = 0; the ice shrinks about the waterline.

import * as THREE from 'three';
import { jitter, paint, facetMat } from './lib/facets.js';
import { hash } from './lib/noise.js';

export const meta = {
  name: 'iceberg',
  summary: 'An iceberg: small white tip above water, big blue bulk below. Animate "melt" to shrink it. Climate stories.',
  tags: ['nature', 'earth', 'ice'],
  floats: false,
  params: {
    water: { type: 'color', default: '#2f9be0', doc: 'colour of the water block' },
    seed: { type: 'int', min: 0, max: 999, default: 1, doc: 'which variant of the shape' },
  },
  animatable: { melt: { min: 0, max: 1, default: 0, doc: '0 = full size, 1 = almost melted away' } },
};

const DEPTH = 0.8;

function iceShape(rng, sx, sy, sz, dy, seed) {
  const g = new THREE.IcosahedronGeometry(1, 1), pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i) * sx, y = pos.getY(i) * sy + dy, z = pos.getZ(i) * sz;
    if (y < 0) { const k = 1 + -y * 0.5; x *= k; z *= k; } // wider below the water
    pos.setXYZ(i, x, y, z);
  }
  jitter(g, rng, 0.04, 0.05);
  return paint(g, f => {
    const k = hash(f.i * 1.9 + seed);
    if (f.y > -0.02) return new THREE.Color(0xffffff).lerp(new THREE.Color(0xb8dcf5), Math.max(0, 0.55 - f.ny) * 0.9 + k * 0.1);
    return new THREE.Color(0x9be6f5).lerp(new THREE.Color(0x2f8fd6), Math.min(1, -f.y * 1.4)).multiplyScalar(0.85 + 0.25 * k);
  });
}

export function build(params, ctx) {
  const group = new THREE.Group(), rng = ctx.rng, geos = [], mats = [];
  const ice = new THREE.Group(); group.add(ice);
  const iceMat = facetMat(ctx, { rough: 0.35, rim: 0.3, emissive: 0.15 }); mats.push(iceMat);
  const parts = [[0, 0, 0, 0.3, 0.45, 0.27, -0.22], [0.2, 0.02, 0.05, 0.16, 0.3, 0.15, -0.14], [-0.18, -0.03, -0.04, 0.14, 0.22, 0.13, -0.1]];
  parts.forEach(([x, , z, sx, sy, sz, dy], i) => {
    const g = iceShape(rng, sx, sy, sz, dy, params.seed + i * 3); geos.push(g);
    const m = new THREE.Mesh(g, iceMat); m.position.set(x, 0, z); ice.add(m);
  });
  // The water: a translucent block drawn after the ice so the submerged part shows through it.
  const waterMat = new THREE.MeshStandardMaterial({ color: ctx.color(params.water), transparent: true, opacity: 0.4, roughness: 0.1, depthWrite: false });
  waterMat.userData.main = false; mats.push(waterMat);
  const water = new THREE.Mesh(new THREE.BoxGeometry(0.96, DEPTH, 0.8), waterMat);
  water.position.y = -DEPTH / 2; water.renderOrder = 3; geos.push(water.geometry); group.add(water);
  const skin = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.8), new THREE.MeshBasicMaterial({ color: 0xbfeaff, transparent: true, opacity: 0.22, depthWrite: false, toneMapped: false }));
  skin.rotation.x = -Math.PI / 2; skin.position.y = 0.002; skin.renderOrder = 4; group.add(skin); geos.push(skin.geometry); mats.push(skin.material);
  return {
    object: group,
    bounds: new THREE.Box3(new THREE.Vector3(-0.48, -DEPTH, -0.4), new THREE.Vector3(0.48, 0.32, 0.4)),
    update(t, state) {
      const k = 1 - 0.6 * state.params.melt;
      ice.scale.set(k, k, k);
      ice.position.y = 0.008 * Math.sin(t * 0.9) - 0.03 * state.params.melt; // bobs a little, sinks as it melts
      ice.rotation.y = 0.04 * Math.sin(t * 0.4);
    },
    dispose() { geos.forEach(g => g.dispose()); mats.forEach(m => m.dispose()); },
  };
}
