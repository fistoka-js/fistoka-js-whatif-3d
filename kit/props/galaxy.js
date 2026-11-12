// Prop: galaxy. A spiral of thousands of glowing points with a bright core, tipped toward the camera. Turns slowly.
// Exports: meta, build(params, ctx). Seeded, so the same seed is always the same galaxy.

import * as THREE from 'three';
import { makeRng } from '../engine/rng.js';

export const meta = {
  name: 'galaxy',
  summary: 'A spiral galaxy of glowing points with a bright core. Params: arms, colours, seed. Turns slowly.',
  tags: ['space'],
  floats: true,
  params: {
    arms: { type: 'int', min: 1, max: 6, default: 3, doc: 'number of spiral arms' },
    color: { type: 'color', default: '#6aa8ff', doc: 'colour of the outer arms' },
    core: { type: 'color', default: '#ffd9a0', doc: 'colour of the bright core' },
    seed: { type: 'int', min: 0, max: 999, default: 2, doc: 'which random arrangement' },
    turn: { type: 'number', min: -1, max: 1, default: 0.03, doc: 'turns per second' },
  },
  animatable: {},
};

const N = 4200;

export function build(params, ctx) {
  const rng = makeRng(params.seed * 977 + 13);
  const made = [], keep = x => { made.push(x); return x; };
  const outer = new THREE.Color(ctx.color(params.color)), inner = new THREE.Color(ctx.color(params.core));
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), c = new THREE.Color();
  for (let i = 0; i < N; i++) {
    const r = Math.pow(rng(), 0.7) * 0.5;               // more points near the middle
    const arm = i % params.arms;
    const twist = r * 9;                                // how tightly the arms wind
    const scatter = (rng() + rng() + rng() - 1.5) * (0.07 + r * 0.22);   // fuzzy arms, wider outward
    const a = arm * (Math.PI * 2 / params.arms) + twist + scatter / Math.max(0.08, r);
    const thick = (rng() - 0.5) * 0.05 * (1 - r * 1.2);
    pos[3 * i] = Math.cos(a) * r; pos[3 * i + 1] = thick; pos[3 * i + 2] = Math.sin(a) * r;
    c.copy(inner).lerp(outer, Math.min(1, r * 2.4));
    c.multiplyScalar(1.0 + rng() * 0.7);
    col[3 * i] = c.r; col[3 * i + 1] = c.g; col[3 * i + 2] = c.b;
  }
  const geo = keep(new THREE.BufferGeometry());
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = keep(new THREE.PointsMaterial({ size: 0.07, map: ctx.mat.glowTexture(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, sizeAttenuation: true }));
  mat.userData.main = false;
  const disc = new THREE.Points(geo, mat);

  const spinner = new THREE.Group();
  spinner.add(disc);
  // A soft dim disc of light under the points, so the arms read as one shape and not as dust.
  const haze = ctx.mat.glowSprite(outer, 1.25, 0.18);
  haze.scale.setScalar(1.25);
  const coreGlow = ctx.mat.glowSprite(inner, 0.5, 0.95);
  const coreGlow2 = ctx.mat.glowSprite(0xffffff, 0.16, 1);
  const tilt = new THREE.Group();
  tilt.rotation.x = 0.95;                      // tipped so the spiral is seen at an angle
  tilt.rotation.z = -0.25;
  tilt.add(spinner);
  const group = new THREE.Group();
  group.add(tilt, coreGlow, coreGlow2, haze);
  const bounds = new THREE.Box3(new THREE.Vector3(-0.5, -0.3, -0.5), new THREE.Vector3(0.5, 0.3, 0.5));

  return {
    object: group,
    bounds,
    update(t, state) {
      spinner.rotation.y = t * params.turn * Math.PI * 2;
      mat.opacity = state.opacity;
      for (const s of [haze, coreGlow, coreGlow2]) s.material.opacity = (s === haze ? 0.18 : s === coreGlow ? 0.95 : 1) * state.opacity;
    },
    setColor(hex) { outer.setHex(hex); },
    dispose() { for (const x of made) x.dispose(); for (const s of [haze, coreGlow, coreGlow2]) s.material.dispose(); },
  };
}
