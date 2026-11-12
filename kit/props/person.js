// Prop: person. A friendly stylised figure (round head, chunky body, simple arms and legs) for scale and "what if" stories.
// Exports: meta, build(params, ctx). Poses: stand, walk (in place), wave, sit (on the ground), float (astronaut drift).
// Every pose is a pure function of t. Only the shirt takes the "color" tint; skin, hair, trousers and shoes keep their own.

import * as THREE from 'three';
import { sampledBounds } from './lib/sampled-bounds.js';

export const meta = {
  name: 'person',
  summary: 'A friendly cartoon person for scale. Poses: stand, walk, wave, sit, float. Param color = shirt.',
  tags: ['body', 'people', 'scale'],
  floats: false,
  params: {
    color: { type: 'color', default: 'blue', doc: 'shirt colour' },
    skin: { type: 'color', default: '#f0b98d', doc: 'skin colour (hands, face, arms)' },
    pose: { type: 'enum', values: ['stand', 'walk', 'wave', 'sit', 'float'], default: 'stand', doc: 'stand, walk (in place), wave, sit on the ground, or float like an astronaut (use in space or with no floor)' },
  },
  animatable: {},
};

export function build(params, ctx) {
  const made = [], keep = x => { made.push(x); return x; };
  const shirt = keep(ctx.mat.solid(ctx.color(params.color), { rough: 0.6 }));
  const skin = keep(ctx.mat.solid(ctx.color(params.skin), { rough: 0.55, main: false }));
  const hairM = keep(ctx.mat.solid(0x3b2a20, { rough: 0.7, main: false }));
  const pants = keep(ctx.mat.solid(0x34425f, { rough: 0.65, main: false }));
  const shoeM = keep(ctx.mat.solid(0xf4f4f4, { rough: 0.5, main: false }));
  const dark = keep(ctx.mat.solid(0x14161c, { rough: 0.3, main: false, rim: 0.1 }));

  const sphere = keep(new THREE.SphereGeometry(1, 28, 20));
  const part = (geo, mat, x, y, z, parent) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
  const blob = (mat, rx, ry, rz, x, y, z, parent) => { const m = part(sphere, mat, x, y, z, parent); m.scale.set(rx, ry, rz); return m; };
  // A limb piece hanging down from its pivot: a capsule of total length L and radius r.
  const capsule = (r, L, mat, parent) => { const m = part(keep(new THREE.CapsuleGeometry(r, L - 2 * r, 6, 16)), mat, 0, -L / 2, 0, parent); return m; };

  const root = new THREE.Group();   // figure space: feet at y = 0, facing +z
  const outer = new THREE.Group();  // identity wrapper: bounds are measured in its space
  const pivot = new THREE.Group();  // centre of the body, so floating tilts turn it about its middle
  pivot.position.y = 0.5; root.position.y = -0.5; pivot.add(root); outer.add(pivot);

  // Legs: pivot at the hip, thigh, knee, shin, shoe.
  const legs = [-1, 1].map(s => {
    const hip = new THREE.Group(); hip.position.set(s * 0.062, 0.465, 0); root.add(hip);
    capsule(0.055, 0.23, pants, hip);
    const knee = new THREE.Group(); knee.position.y = -0.21; hip.add(knee);
    capsule(0.049, 0.22, pants, knee);
    blob(shoeM, 0.052, 0.042, 0.082, 0, -0.205, 0.03, knee);
    return { hip, knee };
  });
  // Body: pelvis, torso (shirt), upper group that can twist.
  blob(pants, 0.108, 0.07, 0.085, 0, 0.47, 0, root);
  const upper = new THREE.Group(); upper.position.y = 0.46; root.add(upper);   // pivot at the waist; children use waist-relative y
  const torso = part(keep(new THREE.CapsuleGeometry(0.104, 0.15, 8, 20)), shirt, 0, 0.145, 0, upper);
  torso.scale.z = 0.78;
  // Neck, head, hair, eyes.
  part(keep(new THREE.CylinderGeometry(0.036, 0.04, 0.06, 14)), skin, 0, 0.31, 0, upper);
  const head = new THREE.Group(); head.position.y = 0.4; upper.add(head);
  blob(skin, 0.127, 0.133, 0.122, 0, 0, 0, head);
  const hair = new THREE.Mesh(keep(new THREE.SphereGeometry(0.133, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.52)), hairM);
  hair.rotation.x = -0.45; hair.position.set(0, 0.012, -0.012); head.add(hair);
  for (const s of [-1, 1]) blob(dark, 0.014, 0.019, 0.01, s * 0.045, 0.0, 0.115, head);
  blob(skin, 0.012, 0.012, 0.012, 0, -0.022, 0.125, head);   // tiny nose bump
  // Arms: pivot at the shoulder, sleeve (shirt), elbow, bare forearm, hand.
  const arms = [-1, 1].map(s => {
    const sh = new THREE.Group(); sh.position.set(s * 0.128, 0.25, 0); upper.add(sh);
    blob(shirt, 0.041, 0.041, 0.041, 0, 0, 0, sh);
    capsule(0.042, 0.15, shirt, sh);
    const el = new THREE.Group(); el.position.y = -0.135; sh.add(el);
    capsule(0.035, 0.15, skin, el);
    blob(skin, 0.036, 0.04, 0.032, 0, -0.15, 0, el);
    return { sh, el, s };
  });

  // One function turns every joint for time t. Angles in radians; rotation.x < 0 swings a limb forward.
  function pose(t) {
    const L = legs, A = arms;
    for (const p of [...L, ...A]) for (const g of [p.hip, p.knee, p.sh, p.el]) if (g) g.rotation.set(0, 0, 0);
    root.position.set(0, -0.5, 0); root.rotation.set(0, 0, 0); pivot.position.set(0, 0.5, 0); pivot.rotation.set(0, 0, 0);
    upper.rotation.set(0, 0, 0); head.rotation.set(0, 0, 0); upper.scale.set(1, 1, 1);
    for (const a of A) a.sh.rotation.z = a.s * 0.1;           // arms hang slightly out
    const breathe = Math.sin(t * 1.9);
    upper.scale.set(1 + 0.008 * breathe, 1 + 0.01 * breathe, 1);
    switch (params.pose) {
      case 'walk': {
        const w = t * 5.2;
        for (const [i, s] of [[0, 1], [1, -1]]) {
          L[i].hip.rotation.x = -0.55 * Math.sin(w) * s;
          L[i].knee.rotation.x = 0.1 + 0.8 * Math.max(0, Math.cos(w) * s);
          A[i].sh.rotation.x = 0.5 * Math.sin(w) * s;
          A[i].el.rotation.x = -0.35 - 0.2 * Math.max(0, -Math.sin(w) * s);
        }
        root.position.y += 0.02 * Math.cos(2 * w) - 0.012;
        upper.rotation.y = 0.14 * Math.sin(w); upper.rotation.x = -0.07; upper.rotation.z = 0.025 * Math.sin(w);
        head.rotation.y = -0.1 * Math.sin(w);
        break;
      }
      case 'wave': {
        const a = A[1];   // the arm on the viewer's right goes up and waves
        a.sh.rotation.z = 2.55 + 0.04 * Math.sin(t * 2); a.sh.rotation.x = 0;
        a.el.rotation.z = 0.35 + 0.5 * Math.sin(t * 7.5); a.el.rotation.x = -0.25;
        upper.rotation.z = -0.04 + 0.015 * Math.sin(t * 2); head.rotation.z = 0.09 + 0.03 * Math.sin(t * 2); head.rotation.y = -0.1;
        A[0].sh.rotation.x = 0.05 * Math.sin(t * 1.5);
        legs[1].hip.rotation.z = 0.04; root.position.y += 0.008 * Math.abs(Math.sin(t * 3.75));
        break;
      }
      case 'sit': {
        for (const l of L) { l.hip.rotation.x = -Math.PI / 2 + 0.06; l.knee.rotation.x = 0.12; l.hip.rotation.z = 0; }
        L[0].hip.rotation.z = 0.12; L[1].hip.rotation.z = -0.12;
        root.position.y = -0.5 - 0.395;
        upper.rotation.x = 0.04;
        for (const a of A) { a.sh.rotation.x = -0.55; a.sh.rotation.z = a.s * 0.12; a.el.rotation.x = -0.75; }
        head.rotation.y = 0.18 * Math.sin(t * 0.6); head.rotation.x = 0.05 * breathe;
        break;
      }
      case 'float': {
        pivot.position.y = 0.5 + 0.03 * Math.sin(t * 0.9);
        pivot.rotation.set(0.35 + 0.12 * Math.sin(t * 0.55), 0.7 * Math.sin(t * 0.3), 0.18 * Math.sin(t * 0.45 + 1));
        for (const [i, s] of [[0, -1], [1, 1]]) {
          L[i].hip.rotation.x = -0.35 + 0.1 * Math.sin(t * 0.8 + i); L[i].hip.rotation.z = s * 0.28;
          L[i].knee.rotation.x = 0.55 + 0.1 * Math.sin(t * 0.7 + i * 2);
          A[i].sh.rotation.z = s * (1.0 + 0.12 * Math.sin(t * 0.9 + i)); A[i].sh.rotation.x = -0.35;
          A[i].el.rotation.x = -0.5 - 0.15 * Math.sin(t * 0.8 + i);
        }
        head.rotation.x = -0.15; head.rotation.y = 0.2 * Math.sin(t * 0.5);
        break;
      }
      default: {   // stand: breathing, small weight shift, head turns now and then
        root.rotation.z = 0.012 * Math.sin(t * 0.8);
        head.rotation.y = 0.2 * Math.sin(t * 0.5) * Math.sin(t * 0.23); head.rotation.z = 0.02 * Math.sin(t * 0.7);
        for (const a of A) a.sh.rotation.x = 0.04 * Math.sin(t * 1.1 + a.s);
        for (const a of A) a.el.rotation.x = -0.1;
      }
    }
  }
  pose(0);
  const times = []; for (let i = 0; i < 80; i++) times.push(i * 0.17);
  const bounds = sampledBounds(THREE, outer, pose, times, 0.01);

  return {
    object: outer,
    bounds,
    update(t) { pose(t); },
    dispose() { for (const x of made) x.dispose(); },
  };
}
