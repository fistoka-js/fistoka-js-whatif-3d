// Prop: volcano. A faceted cone with a glowing crater. Animate "eruption" 0..1: lava fountain blobs, smoke puffs, lava streaks.
// Exports: meta, build(params, ctx). Every moving bit is a pure function of t and eruption (no state, no random at run time).

import * as THREE from 'three';
import { jitter, paint, facetMat } from './lib/facets.js';
import { hash } from './lib/noise.js';

export const meta = {
  name: 'volcano',
  summary: 'A volcano cone with a glowing crater. Animate "eruption" for a lava fountain, smoke and lava streaks.',
  tags: ['nature', 'earth'],
  floats: false,
  params: {
    color: { type: 'color', default: '#9a6448', doc: 'rock colour of the cone' },
    seed: { type: 'int', min: 0, max: 999, default: 1, doc: 'which variant of the shape' },
  },
  animatable: { eruption: { min: 0, max: 1, default: 0.3, doc: '0 = sleeping (glowing crater), 1 = full eruption' } },
};

const R = 0.5, H = 0.5, TOP = 0.17, STREAKS = 6, BLOBS = 16, PUFFS = 9;
const LAVA = 0xff6a1a, LAVA2 = 0xffc23a;

export function build(params, ctx) {
  const group = new THREE.Group(), rock = new THREE.Color(ctx.color(params.color));
  const geo = new THREE.CylinderGeometry(TOP, R, H, 11, 4, false);
  geo.translate(0, H / 2, 0);
  jitter(geo, ctx.rng, 0.025, 0.012);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) if (pos.getY(i) < H * 0.1) pos.setY(i, 0);
  const cone = new THREE.Mesh(paint(geo, f => {
    const h = hash(f.i * 2.3 + params.seed);
    return rock.clone().lerp(new THREE.Color(0x3a2620), f.y / H * 0.35 + h * 0.2).lerp(new THREE.Color(0xa87a50), Math.max(0, 0.25 - f.y / H) * 0.6);
  }), facetMat(ctx, { rim: 0.15 }));
  group.add(cone);

  // Crater: dark lip ring and a glowing lava pool.
  const lipMat = ctx.mat.solid(0x3a2824, { main: false, flat: true });
  const lip = new THREE.Mesh(new THREE.TorusGeometry(TOP * 0.95, 0.032, 6, 11), lipMat);
  lip.rotation.x = Math.PI / 2; lip.position.y = H + 0.004;
  const poolMat = new THREE.MeshBasicMaterial({ color: LAVA2, toneMapped: false });
  const pool = new THREE.Mesh(new THREE.CircleGeometry(TOP * 0.9, 14), poolMat);
  pool.rotation.x = -Math.PI / 2; pool.position.y = H + 0.012;
  const glow = ctx.mat.glowSprite(0xff7a2a, 0.9, 0.6);
  glow.position.y = H + 0.06;
  group.add(lip, pool, glow);

  // Lava streaks down the slope: thin flat bars that grow from the rim downwards.
  const slope = Math.atan((R - TOP) / H), slopeLen = Math.hypot(R - TOP, H);
  const streakMat = new THREE.MeshBasicMaterial({ color: LAVA, toneMapped: false });
  const streakGeo = new THREE.BoxGeometry(0.05, 1, 0.012);
  const streaks = [];
  for (let i = 0; i < STREAKS; i++) {
    const g = new THREE.Group(), m = new THREE.Mesh(streakGeo, streakMat);
    g.rotation.y = -(i / STREAKS) * Math.PI * 2 - 0.4 + ctx.rng() * 0.3; // local +x points outward
    m.rotation.z = slope; // lies along the slope
    g.add(m); group.add(g);
    streaks.push({ g, m, len: 0.55 + 0.4 * hash(i + params.seed * 5) });
  }

  // Fountain blobs and smoke puffs (effects: not part of the prop's size).
  const fx = ctx.mat.noBounds(new THREE.Group());
  const blobGeo = new THREE.IcosahedronGeometry(0.035, 0), blobMat = new THREE.MeshBasicMaterial({ color: LAVA2, toneMapped: false });
  const blobs = [];
  for (let i = 0; i < BLOBS; i++) {
    const m = new THREE.Mesh(blobGeo, blobMat), a = hash(i * 1.7) * 6.283;
    fx.add(m); blobs.push({ m, a, v: 0.6 + 0.5 * hash(i * 3.1), ph: i / BLOBS, s: 0.7 + 0.8 * hash(i * 5.3) });
  }
  const puffGeo = new THREE.IcosahedronGeometry(0.1, 1), puffs = [];
  for (let i = 0; i < PUFFS; i++) {
    const mat = new THREE.MeshStandardMaterial({ color: 0x8a8380, emissive: 0x2a2624, roughness: 1, transparent: true, flatShading: true });
    const m = new THREE.Mesh(puffGeo, mat);
    fx.add(m); puffs.push({ m, ph: i / PUFFS, dx: (hash(i * 2.9) - 0.5) * 0.3, dz: (hash(i * 4.1) - 0.5) * 0.2 });
  }
  group.add(fx);

  function update(t, state) {
    const e = state.params.eruption;
    poolMat.color.setHex(LAVA2).lerp(new THREE.Color(0xffefa0), 0.3 + 0.2 * Math.sin(t * 5) * (0.3 + e));
    glow.material.opacity = state.opacity * (0.35 + 0.5 * e + 0.08 * Math.sin(t * 4));
    glow.scale.setScalar(0.7 + 0.8 * e);
    for (let i = 0; i < STREAKS; i++) {
      const s = streaks[i], k = Math.min(1, Math.max(0, (e - 0.12 - i * 0.05) / 0.5)) * s.len * slopeLen;
      s.g.visible = k > 0.01;
      s.m.scale.y = Math.max(k, 0.001);
      // bar's top end sits at the rim; centre is half its length down the slope
      const sn = Math.sin(slope), cs = Math.cos(slope);
      s.m.position.set(TOP + sn * k / 2 + cs * 0.012, H - cs * k / 2 + sn * 0.012, 0);
    }
    for (const b of blobs) {
      const u = (t * 0.55 * b.s + b.ph) % 1, v = b.v * (0.4 + e);
      const r = Math.sin(u * Math.PI) * 0.0 + u * 0.28 * v, y = H + 0.03 + (v * 1.1 * u - 1.6 * u * u * 0.9) * 0.9 * e + 0.02;
      b.m.position.set(Math.cos(b.a) * r, Math.max(y, H), Math.sin(b.a) * r);
      b.m.visible = e > 0.04 && y > H;
      b.m.scale.setScalar((0.5 + e) * (1 - 0.4 * u));
    }
    for (const p of puffs) {
      const u = (t * 0.22 + p.ph) % 1;
      p.m.visible = e > 0.04;
      p.m.position.set(p.dx * u * 2 + 0.1 * u, H + 0.1 + u * (0.25 + 0.55 * e), p.dz * u * 2);
      p.m.scale.setScalar((0.5 + 1.6 * u) * (0.4 + e));
      p.m.material.opacity = state.opacity * 0.9 * Math.min(1, u * 5) * (1 - u) * Math.min(1, e * 3);
    }
  }
  update(0, { opacity: 1, params: { eruption: 0 } });

  return {
    object: group, update,
    // Headroom above the cone for the plume, so the camera and the ground placement leave room for it.
    bounds: new THREE.Box3(new THREE.Vector3(-R, 0, -R), new THREE.Vector3(R, 0.95, R)),
    dispose() { geo.dispose(); cone.geometry.dispose(); cone.material.dispose(); lipMat.dispose(); poolMat.dispose(); streakMat.dispose(); streakGeo.dispose(); blobGeo.dispose(); blobMat.dispose(); puffGeo.dispose(); puffs.forEach(p => p.m.material.dispose()); },
  };
}
