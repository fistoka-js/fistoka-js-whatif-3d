// Environment: micro. An "inside the body / under a microscope" look: a soft tinted gradient with big out-of-focus
// translucent blobs (bokeh) drifting at several depths, plus tiny specks. No ground; props float.
// Exports: meta, build(params, ctx).

import * as THREE from 'three';
import { gradientDome, motes, lightRig } from './lib/parts.js';

export const meta = {
  name: 'micro',
  summary: 'Inside the body or under a microscope: soft glowing gradient with drifting out-of-focus blobs. Props float.',
  ground: false,
  params: {
    tint: { type: 'enum', values: ['warm', 'cool', 'green'], default: 'warm', doc: 'warm pink-orange (blood, tissue), cool blue (fluid), green (plants, bacteria)' },
  },
};

const LOOK = {
  warm: { dome: [[-1, 0x4a1226], [-0.1, 0x9a2e3e], [0.25, 0xd8584c], [0.7, 0xe88a5a], [1, 0x9a3a3a]], blobs: [0xff7a6a, 0xffb07a, 0xd8404f, 0xffd0a0], key: 0xfff0e0, fill: 0xff8a7a, rim: 0xffd0b0, sky: 0xffb0a0, gnd: 0x5a1a2a },
  cool: { dome: [[-1, 0x08143a], [-0.1, 0x1a3a8a], [0.25, 0x2f78c8], [0.7, 0x4aa8d8], [1, 0x1a4a8a]], blobs: [0x5ac8ff, 0x8aa0ff, 0x3a78e0, 0xa8f0ff], key: 0xe8f4ff, fill: 0x6aa8ff, rim: 0xb0f0ff, sky: 0x9ad0ff, gnd: 0x10204a },
  green: { dome: [[-1, 0x08281a], [-0.1, 0x1a6a3a], [0.25, 0x3aa84a], [0.7, 0x78c85a], [1, 0x2a7a3a]], blobs: [0x8aff7a, 0xd0ff7a, 0x3ad88a, 0xb0ffd0], key: 0xf4ffe8, fill: 0x7aff9a, rim: 0xd8ffb0, sky: 0xb0ffa0, gnd: 0x103a1a },
};

// A bokeh disc: soft inside, a slightly brighter rim, clear outside.
let DISC = null;
function discTexture() {
  if (DISC) return DISC;
  const n = 64, data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const r = Math.hypot((x + 0.5) / n * 2 - 1, (y + 0.5) / n * 2 - 1);
    const edge = 1 - Math.min(1, Math.max(0, (r - 0.8) / 0.2));
    const a = r > 1 ? 0 : edge * (0.55 + 0.45 * Math.exp(-Math.pow((r - 0.78) / 0.14, 2)) + 0.0);
    const i = 4 * (y * n + x);
    data[i] = data[i + 1] = data[i + 2] = 255; data[i + 3] = Math.round(Math.min(1, a) * 255);
  }
  DISC = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
  DISC.magFilter = THREE.LinearFilter; DISC.minFilter = THREE.LinearFilter; DISC.needsUpdate = true;
  return DISC;
}

export function build(params, ctx) {
  const L = LOOK[params.tint], s = ctx.scale, rng = ctx.rng;
  const group = new THREE.Group(), far = new THREE.Group();
  far.add(gradientDome(L.dome)); group.add(far);

  // Blobs in four depth bands: far ones big and faint, near ones large, blurred and very faint.
  // [z from, z to, count, size, opacity]
  const bands = [[-34, -26, 14, 11, 0.2], [-18, -10, 14, 5, 0.22], [-8, -2, 9, 2.6, 0.2], [1.5, 3.5, 4, 1.8, 0.1]];
  const blobs = [], mats = [];
  for (const [z0, z1, count, size, op] of bands) {
    for (let i = 0; i < count; i++) {
      const mat = new THREE.SpriteMaterial({ map: discTexture(), color: L.blobs[Math.floor(rng() * L.blobs.length)], transparent: true, opacity: op * (0.6 + 0.8 * rng()), depthWrite: false, fog: false, blending: rng() < 0.3 ? THREE.AdditiveBlending : THREE.NormalBlending });
      mats.push(mat);
      const sp = new THREE.Sprite(mat), z = (z0 + rng() * (z1 - z0)) * s, w = size * (0.6 + 0.8 * rng()) * s;
      sp.scale.set(w, w, 1);
      const spread = (Math.abs(z) / s + 6) * 0.55;
      blobs.push({ sp, x: (rng() - 0.5) * 2 * spread * s, y: (rng() - 0.45) * 2 * spread * 0.9 * s, z, ph: rng() * 6.28, v: 0.15 + rng() * 0.3, amp: (0.3 + rng()) * s * (1 + Math.abs(z) / (10 * s)) });
      group.add(sp);
    }
  }
  const specks = motes(rng, { scale: s, count: 110, colors: [0xffffff, L.blobs[0], L.blobs[3]], size: 0.04, opacity: 0.55 });
  group.add(specks.object);
  const lights = lightRig({
    key: [L.key, 2.6, [-3, 4, 5]], fill: [L.fill, 1.0, [5, 0, 3]], rim: [L.rim, 2.6, [2, 3, -5]], sky: L.sky, ground: L.gnd, hemi: 1.0,
  });
  const bg = L.dome[2][1];
  return {
    object: group, lights, fog: new THREE.Fog(bg, 40 * s, 200 * s), background: bg,
    update(t, cam) {
      far.position.fromArray(cam.position);
      for (const b of blobs) b.sp.position.set(b.x + Math.sin(t * b.v + b.ph) * b.amp, b.y + Math.cos(t * b.v * 0.8 + b.ph) * b.amp * 0.7 + t * 0.03 * s, b.z);
      specks.update(t);
    },
    dispose() { mats.forEach(m => m.dispose()); },
  };
}
