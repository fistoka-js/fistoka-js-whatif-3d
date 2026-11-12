// Prop: brain. Two folded hemispheres, a cerebellum and a stem. Animate "activity" 0..1 for glowing pulses.
// Exports: meta, build(params, ctx). Folds are real bumps in the surface plus darker grooves (vertex colours).

import * as THREE from 'three';
import { ridged } from './lib/noise.js';

export const meta = {
  name: 'brain',
  summary: 'A stylised brain with folds. Animate "activity" 0..1 for glowing pulses. Good for thinking, memory, sleep.',
  tags: ['body', 'science'],
  floats: true,
  params: {
    color: { type: 'color', default: '#f4a0b5', doc: 'brain colour' },
    glow: { type: 'color', default: 'gold', doc: 'colour of the activity pulses' },
  },
  animatable: {
    activity: { min: 0, max: 1, default: 0.4, doc: 'brain activity: 0 = calm, 1 = pulses firing everywhere' },
  },
};

// A bumpy ellipsoid: unit-sphere points pushed in along winding grooves. Returns the geometry and a surface-point finder.
function folded(seed, radii, fold, flipX, w = 60, h = 44) {
  const geo = new THREE.SphereGeometry(1, w, h), pos = geo.attributes.position, col = [];
  const surf = new THREE.Vector3();
  const at = (x, y, z) => {
    const g = ridged(seed, x * 3.3 + 9, y * 3.3 + 9, z * 3.3 + 9, 2);          // 0..1, high on thin lines
    const r = 1 - fold * Math.pow(g, 1.5);
    surf.set(x * r * radii[0], y * r * radii[1], z * r * radii[2]);
    if (flipX) surf.x = Math.max(surf.x * flipX, 0.012) * flipX;                 // flat inner face next to the gap
    return { v: surf.clone(), g };
  };
  for (let i = 0; i < pos.count; i++) {
    const { v, g } = at(pos.getX(i), pos.getY(i), pos.getZ(i));
    pos.setXYZ(i, v.x, v.y, v.z);
    const k = 1 - 0.5 * Math.pow(g, 1.2);
    col.push(k, k, k);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return { geo, at };
}

export function build(params, ctx) {
  const made = [], keep = x => { made.push(x); return x; };
  const group = new THREE.Group();
  const mat = keep(ctx.mat.solid(ctx.color(params.color), { rough: 0.5, rim: 0.3 }));
  mat.vertexColors = true;
  const lobes = [];
  for (const s of [-1, 1]) {
    const { geo, at } = folded(3 + (s > 0 ? 1 : 0) * 0.01, [0.215, 0.3, 0.5], 0.16, s);
    keep(geo);
    const m = new THREE.Mesh(geo, mat); m.position.set(s * 0.012, 0.0, 0); group.add(m);
    lobes.push({ at, s });
  }
  // Cerebellum (ridged back-bottom ball) and the stem.
  const cb = folded(11, [0.2, 0.12, 0.15], 0.1, 0, 36, 24); keep(cb.geo);
  const cer = new THREE.Mesh(cb.geo, mat); cer.position.set(0, -0.2, -0.3); group.add(cer);
  const mat2 = keep(ctx.mat.solid(ctx.color(params.color), { rough: 0.5, rim: 0.3 }));   // the stem has no vertex colours
  const stem = new THREE.Mesh(keep(new THREE.CapsuleGeometry(0.05, 0.16, 6, 12)), mat2);
  stem.position.set(0, -0.3, -0.08); stem.rotation.x = -0.35; group.add(stem);

  // Pulse lights: soft glow dots resting on the folded surface, seeded.
  const gcol = new THREE.Color(ctx.color(params.glow));
  const dots = [];
  for (let i = 0; i < 18; i++) {
    const lobe = lobes[i % 2];
    let x, y, z;
    do { x = ctx.rng() * 2 - 1; y = ctx.rng() * 2 - 1; z = ctx.rng() * 2 - 1; } while (x * x + y * y + z * z > 1 || y < -0.1);
    const l = Math.hypot(x, y, z) || 1;
    const p = lobe.at(x / l, y / l, z / l).v;
    const sp = ctx.mat.glowSprite(gcol, 0.2, 0);
    sp.position.copy(p).multiplyScalar(1.03).add(new THREE.Vector3(lobe.s * 0.012, 0, 0));
    group.add(sp);
    dots.push({ sp, phase: ctx.rng() * 6.28, speed: 1.6 + ctx.rng() * 1.6, min: ctx.rng() });
  }
  return {
    object: group,
    update(t, state) {
      const a = state.params.activity;
      group.scale.setScalar(1 + 0.012 * Math.sin(t * 1.4));
      for (const d of dots) {
        const wave = Math.pow(Math.max(0, Math.sin(t * d.speed + d.phase)), 3);
        const live = a > d.min * 0.8 ? 1 : 0.0;          // busier brain lights more of the spots
        d.sp.material.opacity = Math.min(1, a * (0.15 + 0.95 * wave) * live * 1.4) * state.opacity;
        d.sp.scale.setScalar(0.12 + 0.16 * wave * a);
      }
    },
    dispose() { for (const x of made) x.dispose(); for (const d of dots) d.sp.material.dispose(); },
  };
}
