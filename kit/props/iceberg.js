// Prop: iceberg. Faceted ice, small tip above the waterline, big bulk below. Animate "melt" 0..1 to shrink it.
// By default only the ice (plus a faint ripple at the waterline); tank: true adds the see-through water block (cutaway).
// Exports: meta, build(params, ctx). Tank: the waterline is y = 0 and the ice shrinks about it. No tank: the base of the ice is y = 0
// (it sits on the surface) and the ice shrinks about its base, so it never lifts off the water.

import * as THREE from 'three';
import { jitter, paint, facetMat } from './lib/facets.js';
import { hash } from './lib/noise.js';

export const meta = {
  name: 'iceberg',
  summary: 'An iceberg: all ice above the surface without tank; tank true shows tip above, bulk below. "melt" shrinks it.',
  notes: 'Without tank, only the ice is drawn (an angular peak standing on the surface, all of it above the water) with a ripple round its base; melt shrinks it down onto the water. For "most of it is below" set tank true: a see-through water block shows the tip above the waterline and the big bulk below it (cutaway).',
  tags: ['nature', 'earth', 'ice'],
  floats: false,
  params: {
    tank: { type: 'bool', default: false, doc: 'true = a see-through water block round the ice: tip above the waterline, big bulk below it (a cutaway, to put particles in); false = just the ice, all of it above the surface' },
    water: { type: 'color', default: '#2f9be0', doc: 'colour of the water block (tank) or the ripple at the waterline' },
    seed: { type: 'int', min: 0, max: 999, default: 1, doc: 'which variant of the shape' },
  },
  animatable: { melt: { min: 0, max: 1, default: 0, doc: '0 = full size, 1 = almost melted away' } },
};

const DEPTH = 0.8;

// Without the tank: an angular shard standing on its base (y from 0 up): 20 flat faces, a pointed top, a flat foot.
function iceShard(rng, sx, sy, sz, seed) {
  const g = new THREE.IcosahedronGeometry(1, 0), pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i) * sx, y = (pos.getY(i) + 1) / 2 * sy, z = pos.getZ(i) * sz;
    if (pos.getY(i) > 0.5) { x *= 0.45; z *= 0.45; y *= 1.15; }   // the peak
    else if (pos.getY(i) < -0.9) y = 0;   // flat foot
    pos.setXYZ(i, x, y, z);
  }
  jitter(g, rng, 0.05, 0.06);
  for (let i = 0; i < pos.count; i++) pos.setY(i, Math.max(0, pos.getY(i)));   // never below the surface
  return paint(g, f => {
    const k = hash(f.i * 1.9 + seed);
    return new THREE.Color(0xffffff).lerp(new THREE.Color(0xa9d2f2), Math.max(0, 0.5 - f.ny) * 0.9 + k * 0.25);
  });
}

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
  const shards = [[0, 0, 0, 0.3, 0.85, 0.26], [0.24, 0, 0.06, 0.17, 0.5, 0.15], [-0.22, 0, -0.05, 0.15, 0.36, 0.13]];
  (params.tank ? parts : shards).forEach(([x, , z, sx, sy, sz, dy], i) => {
    const g = params.tank ? iceShape(rng, sx, sy, sz, dy, params.seed + i * 3) : iceShard(rng, sx, sy, sz, params.seed + i * 3); geos.push(g);
    const m = new THREE.Mesh(g, iceMat); m.position.set(x, 0, z); ice.add(m);
  });
  if (params.tank) {
    // The water: a translucent block drawn after the ice so the submerged part shows through it.
    const waterMat = new THREE.MeshStandardMaterial({ color: ctx.color(params.water), transparent: true, opacity: 0.4, roughness: 0.1, depthWrite: false });
    waterMat.userData.main = false; mats.push(waterMat);
    const water = new THREE.Mesh(new THREE.BoxGeometry(0.96, DEPTH, 0.8), waterMat);
    water.position.y = -DEPTH / 2; water.renderOrder = 3; geos.push(water.geometry); group.add(water);
    const skin = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.8), new THREE.MeshBasicMaterial({ color: 0xbfeaff, transparent: true, opacity: 0.22, depthWrite: false, toneMapped: false }));
    skin.rotation.x = -Math.PI / 2; skin.position.y = 0.002; skin.renderOrder = 4; group.add(skin); geos.push(skin.geometry); mats.push(skin.material);
  } else {
    // No box: just a soft ripple on the waterline so the ice does not look stuck on nothing.
    const ripple = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.1), new THREE.MeshBasicMaterial({ color: ctx.color(params.water), map: ctx.mat.glowTexture(), transparent: true, opacity: 0.5, depthWrite: false, toneMapped: false }));
    ripple.material.userData.main = false; ripple.rotation.x = -Math.PI / 2; ripple.position.y = 0.002;   // at the base of the ice, which is y = 0 ripple.renderOrder = 4;
    ctx.mat.noBounds(ripple); group.add(ripple); geos.push(ripple.geometry); mats.push(ripple.material);
  }
  // With the tank the size box is the water block; without it, just the ice (so the ice is not lifted off the ground).
  const bounds = params.tank ? new THREE.Box3(new THREE.Vector3(-0.48, -DEPTH, -0.4), new THREE.Vector3(0.48, 0.32, 0.4)) : new THREE.Box3().setFromObject(ice);
  return {
    object: group,
    bounds,
    update(t, state) {
      const k = 1 - 0.6 * state.params.melt;
      ice.scale.set(k, k, k);
      // Tank: bobs a little and sinks as it melts (about the waterline). No tank: shrinks about its base, which stays on the water.
      ice.position.y = params.tank ? 0.008 * Math.sin(t * 0.9) - 0.03 * state.params.melt : 0;
      ice.rotation.y = 0.04 * Math.sin(t * 0.4);
    },
    dispose() { geos.forEach(g => g.dispose()); mats.forEach(m => m.dispose()); },
  };
}
