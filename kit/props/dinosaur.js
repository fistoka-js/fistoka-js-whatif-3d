// Prop: dinosaur. A chunky T-rex-like dinosaur: big head with teeth, thick body and tail, strong legs, tiny arms.
// Exports: meta, build(params, ctx). Faces +x. The head, neck, body and tail are one smooth lofted surface;
// the jaw opens and closes slowly and the whole body sways a little (pure functions of t).

import * as THREE from 'three';

export const meta = {
  name: 'dinosaur',
  summary: 'A chunky cartoon T-rex with a big head and tiny arms. Good for extinction, fossils, "what if" dinosaurs lived.',
  tags: ['animal', 'prehistoric'],
  floats: false,
  params: {
    color: { type: 'color', default: '#6fbf4a', doc: 'skin colour' },
  },
  animatable: {},
};

// Spine (x, y) from the snout back to the tail tip, and half-height / half-width of the body along it (t = 0..1 of its length).
const SPINE = [[0.64, 0.64], [0.54, 0.66], [0.42, 0.66], [0.31, 0.6], [0.2, 0.5], [0.05, 0.43], [-0.1, 0.42], [-0.28, 0.4], [-0.45, 0.35], [-0.62, 0.29], [-0.8, 0.24]];
const PROF = [[0, 0.03, 0.025], [0.015, 0.05, 0.045], [0.07, 0.078, 0.075], [0.14, 0.115, 0.098], [0.19, 0.085, 0.078], [0.26, 0.095, 0.085], [0.36, 0.165, 0.125], [0.44, 0.215, 0.155], [0.55, 0.205, 0.155], [0.66, 0.15, 0.11], [0.78, 0.1, 0.075], [0.9, 0.05, 0.04], [1, 0.008, 0.008]];
const lerp = (a, b, t) => a + (b - a) * t, sm = x => x * x * (3 - 2 * x);
function radii(t) {
  let i = 0; while (i < PROF.length - 2 && t > PROF[i + 1][0]) i++;
  const a = PROF[i], b = PROF[i + 1], u = sm(Math.min(1, Math.max(0, (t - a[0]) / (b[0] - a[0]))));
  return [lerp(a[1], b[1], u), lerp(a[2], b[2], u)];
}

export function build(params, ctx) {
  const made = [], keep = x => { made.push(x); return x; };
  const group = new THREE.Group(), dino = new THREE.Group(); group.add(dino);
  const skin = keep(ctx.mat.solid(ctx.color(params.color), { rough: 0.5, rim: 0.3 })); skin.vertexColors = true;
  const limb = keep(ctx.mat.solid(ctx.color(params.color), { rough: 0.5, rim: 0.3 }));
  const white = keep(ctx.mat.solid(0xf6f1e0, { rough: 0.4, main: false })), black = keep(ctx.mat.solid(0x0b0c10, { rough: 0.2, main: false, rim: 0 }));
  const eyeM = keep(ctx.mat.solid(0xffd84a, { rough: 0.2, main: false })), mouthM = keep(ctx.mat.solid(0xc9475a, { rough: 0.5, main: false }));
  const sph = keep(new THREE.SphereGeometry(1, 20, 14)), cone = keep(new THREE.ConeGeometry(1, 1, 8));
  const put = (parent, geo, mat, x, y, z, sx, sy = sx, sz = sx) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); parent.add(m); return m; };

  // Lofted body: rings of points around the spine, a bit flatter underneath, darker on the back with bands.
  const spine = new THREE.CatmullRomCurve3(SPINE.map(p => new THREE.Vector3(p[0], p[1], 0)), false, 'catmullrom', 0.5);
  const NR = 90, NA = 24, pos = [], col = [], idx = [], Tn = new THREE.Vector3();
  for (let i = 0; i <= NR; i++) {
    const t = i / NR, p = spine.getPointAt(t); spine.getTangentAt(t, Tn);
    const N = new THREE.Vector3(Tn.y, -Tn.x, 0).normalize(), [rv, rl] = radii(t);
    for (let j = 0; j <= NA; j++) {
      const a = (j / NA) * Math.PI * 2, s = Math.sin(a), c = Math.cos(a);
      const v = rv * (s > 0 ? 1 : (t < 0.17 ? 0.55 : 0.8)) * s;       // under the head only a thin lip: the jaw is separate
      pos.push(p.x + N.x * v, p.y + N.y * v, c * rl);
      const dors = Math.max(0, s), bel = Math.max(0, -s);
      let k = 1 - 0.28 * dors * dors + 0.3 * bel;
      if (t > 0.3 && t < 0.92 && dors > 0.3 && Math.sin(t * 70) > 0.45) k *= 0.8;
      col.push(k, k, k);
    }
  }
  for (let i = 0; i < NR; i++) for (let j = 0; j < NA; j++) { const a = i * (NA + 1) + j, b = a + 1, c = a + NA + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
  const geo = keep(new THREE.BufferGeometry());
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx); geo.computeVertexNormals();
  dino.add(new THREE.Mesh(geo, skin));

  // Head details: eyes, brow, nostrils, upper teeth. Jaw hangs from a hinge under the back of the skull.
  for (const s of [-1, 1]) {
    put(dino, sph, limb, 0.455, 0.715, s * 0.07, 0.05, 0.028, 0.04);              // brow ridge
    put(dino, sph, eyeM, 0.445, 0.69, s * 0.088, 0.03); put(dino, sph, black, 0.455, 0.69, s * 0.112, 0.014, 0.022, 0.01);
    put(dino, sph, black, 0.625, 0.67, s * 0.03, 0.01);                            // nostril
    for (let k = 0; k < 6; k++) { const t = put(dino, cone, white, 0.37 + k * 0.045, 0.585, s * (0.06 - k * 0.003), 0.012, 0.04, 0.012); t.rotation.x = Math.PI; t.position.y = 0.565; }
  }
  const jaw = new THREE.Group(); jaw.position.set(0.36, 0.585, 0); dino.add(jaw);
  put(jaw, sph, limb, 0.14, -0.012, 0, 0.16, 0.03, 0.062);
  put(jaw, sph, mouthM, 0.14, 0.016, 0, 0.13, 0.012, 0.045);                       // tongue
  for (const s of [-1, 1]) for (let k = 0; k < 4; k++) put(jaw, cone, white, 0.1 + k * 0.05, 0.018, s * 0.045, 0.01, 0.036, 0.01);

  // Legs: big thigh, shin back to the ankle, flat foot with three toes. Tiny two-clawed arms.
  for (const s of [-1, 1]) {
    put(dino, sph, limb, -0.08, 0.3, s * 0.14, 0.15, 0.19, 0.085);                  // thigh
    const shin = put(dino, new THREE.CapsuleGeometry(0.05, 0.1, 6, 12), limb, 0.0, 0.15, s * 0.135, 1); shin.rotation.z = 0.5; keep(shin.geometry);
    put(dino, sph, limb, -0.075, 0.035, s * 0.13, 0.115, 0.04, 0.06);               // foot
    for (let k = -1; k <= 1; k++) { const c = put(dino, cone, white, 0.06, 0.02, s * 0.13 + k * 0.04, 0.016, 0.06, 0.016); c.rotation.z = -Math.PI / 2; }
    const arm = put(dino, new THREE.CapsuleGeometry(0.022, 0.07, 5, 8), limb, 0.25, 0.345, s * 0.158, 1); arm.rotation.z = -0.64; keep(arm.geometry);
    for (let k = -1; k <= 1; k += 2) { const c = put(dino, cone, white, 0.318, 0.262, s * 0.158 + k * 0.012, 0.008, 0.038, 0.008); c.rotation.z = -2.5; }
  }
  dino.position.y = 0; dino.rotation.y = 0;
  return {
    object: group,
    update(t) {
      const roar = Math.pow(0.5 + 0.5 * Math.sin(t * 1.1), 3);
      jaw.rotation.z = -(0.06 + 0.3 * roar);                       // negative = jaw drops (it points forward along +x)
      dino.rotation.y = 0.06 * Math.sin(t * 0.5); dino.rotation.z = 0.012 * Math.sin(t * 1.3);
    },
    bounds: new THREE.Box3(new THREE.Vector3(-0.82, 0, -0.17), new THREE.Vector3(0.68, 0.8, 0.17)),
    dispose() { for (const x of made) x.dispose(); },
  };
}
