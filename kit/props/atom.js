// Prop: atom. A nucleus of clustered red and blue balls with glowing electrons racing round 2 or 3 tilted orbit rings.
// Exports: meta, build(params, ctx). Electron positions are a pure function of t.

import * as THREE from 'three';
import { makeRng } from '../engine/rng.js';

export const meta = {
  name: 'atom',
  summary: 'An atom: clustered nucleus and electrons orbiting on tilted rings. Param "electrons" 1..8.',
  tags: ['science'],
  floats: true,
  params: {
    electrons: { type: 'int', min: 1, max: 8, default: 3, doc: 'how many electrons (the nucleus grows to match)' },
    color: { type: 'color', default: 'cyan', doc: 'electron and ring colour' },
    seed: { type: 'int', min: 0, max: 999, default: 4, doc: 'how the nucleus balls are packed' },
  },
  animatable: {},
};

const R = 0.5;   // orbit radius

export function build(params, ctx) {
  const rng = makeRng(params.seed * 313 + 5);
  const made = [], keep = x => { made.push(x); return x; };
  const col = new THREE.Color(ctx.color(params.color));
  const group = new THREE.Group();
  const n = params.electrons;

  // Nucleus: 2n balls, alternating red (protons) and blue-grey (neutrons), pressed together near the middle.
  const nb = Math.max(3, Math.min(14, n * 2 + 1));
  const pg = keep(new THREE.SphereGeometry(1, 20, 14));
  const red = keep(ctx.mat.solid(0xff4b4b, { rough: 0.35, main: false })), blue = keep(ctx.mat.solid(0x6f8cff, { rough: 0.35, main: false }));
  const ballR = 0.065, spread = 0.045 + 0.02 * Math.cbrt(nb);
  for (let i = 0; i < nb; i++) {
    const d = new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize().multiplyScalar(spread * (0.4 + 0.6 * rng()) * (i === 0 ? 0 : 1) * 2.2);
    const m = new THREE.Mesh(pg, i % 2 ? blue : red);
    m.position.copy(d); m.scale.setScalar(ballR); group.add(m);
  }
  group.add(ctx.mat.glowSprite(0xffb090, 0.5, 0.35));

  // Orbit rings (2 or 3): thin tubes tilted at different angles. Each electron sits on one ring.
  const nr = n <= 2 ? 2 : 3;
  const tilts = [[1.15, 0], [-1.0, 1.1], [0.2, -1.1]];
  const ringMat = keep(new THREE.MeshBasicMaterial({ color: col, toneMapped: false, transparent: true, opacity: 0.55 }));
  ringMat.userData.main = false;
  const rg = keep(new THREE.TorusGeometry(R, 0.007, 8, 96));
  const eg = keep(new THREE.SphereGeometry(0.052, 20, 14));
  const eMat = keep(ctx.mat.solid(col, { rough: 0.2, emissive: 0.8, rim: 0.5 }));
  const rings = [];
  for (let r = 0; r < nr; r++) {
    const tilt = new THREE.Group();
    tilt.rotation.set(tilts[r][0], tilts[r][1], 0);
    tilt.add(new THREE.Mesh(rg, ringMat));
    group.add(tilt);
    rings.push({ tilt, e: [] });
  }
  const electrons = [];
  for (let i = 0; i < n; i++) {
    const ring = rings[i % nr];
    const m = new THREE.Mesh(eg, eMat);
    const glow = ctx.mat.glowSprite(col, 0.28, 0.7);
    m.add(glow);
    ring.tilt.add(m);
    const k = ring.e.length; ring.e.push(m);
    electrons.push({ m, glow, ring: i % nr, k });
  }
  for (const e of electrons) {   // spread electrons evenly round each ring
    const total = rings[e.ring].e.length;
    e.phase = (e.k / total) * Math.PI * 2 + e.ring * 0.9;
    e.speed = 1.3 - e.ring * 0.25;
  }

  const bounds = new THREE.Box3(new THREE.Vector3(-R * 1.05, -R * 1.05, -R * 1.05), new THREE.Vector3(R * 1.05, R * 1.05, R * 1.05));
  return {
    object: group,
    bounds,
    update(t, state) {
      for (const e of electrons) {
        const a = e.phase + t * e.speed * 2.2;
        e.m.position.set(Math.cos(a) * R, Math.sin(a) * R, 0);
        e.glow.material.opacity = 0.7 * state.opacity;
      }
      for (let i = 0; i < nr; i++) rings[i].tilt.rotation.z = t * 0.05 * (i + 1);
    },
    setColor(hex) { col.setHex(hex); },
    dispose() { for (const x of made) x.dispose(); for (const e of electrons) e.glow.material.dispose(); },
  };
}
