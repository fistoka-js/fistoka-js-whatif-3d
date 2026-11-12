// Prop: bird. A chunky cartoon bird with flapping wings, or a small V-shaped flock (up to 20). Flies toward +x in place.
// Exports: meta, build(params, ctx). Flapping is a pure function of t; each bird has its own phase.

import * as THREE from 'three';

export const meta = {
  name: 'bird',
  summary: 'A cartoon bird with flapping wings; "count" 1..20 makes a flock. Good for migration, flight, nature.',
  tags: ['animal', 'sky', 'nature'],
  floats: true,
  params: {
    color: { type: 'color', default: 'blue', doc: 'body colour' },
    count: { type: 'int', min: 1, max: 20, default: 1, doc: 'how many birds (1 = one big bird, more = a flock)' },
    seed: { type: 'int', min: 0, max: 999, default: 2, doc: 'which flock arrangement' },
  },
  animatable: {},
};

// Wing outline: span along +z, front edge toward +x, feathery back edge. Extruded thin.
function wingGeometry() {
  const s = new THREE.Shape();
  s.moveTo(0, 0.1); s.bezierCurveTo(0.12, 0.16, 0.36, 0.14, 0.55, -0.02);
  s.lineTo(0.5, -0.1); s.lineTo(0.42, -0.04); s.lineTo(0.38, -0.14); s.lineTo(0.29, -0.06); s.lineTo(0.24, -0.16); s.lineTo(0.14, -0.07); s.lineTo(0, -0.1); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: false }); g.translate(0, 0, -0.02); g.scale(1.3, 1.3, 1.3);
  // Shape (x = span, y = chord) -> bird space (z = span, x = chord, y = thickness).
  g.applyMatrix4(new THREE.Matrix4().set(0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1));
  return g;
}

export function build(params, ctx) {
  const made = [], keep = x => { made.push(x); return x; };
  const bodyM = keep(ctx.mat.solid(ctx.color(params.color), { rough: 0.4, rim: 0.35 }));
  const wingM = keep(ctx.mat.solid(ctx.color(params.color), { rough: 0.45, rim: 0.3 })); wingM.side = THREE.DoubleSide;
  const beakM = keep(ctx.mat.solid(0xffa62b, { rough: 0.4, main: false })), white = keep(ctx.mat.solid(0xffffff, { rough: 0.2, main: false })), black = keep(ctx.mat.solid(0x0b0c10, { rough: 0.2, main: false, rim: 0 }));
  const belly = keep(ctx.mat.solid(0xf6f1e6, { rough: 0.5, main: false }));
  const sph = keep(new THREE.SphereGeometry(1, 18, 12)), wingG = keep(wingGeometry());
  const tailG = keep(new THREE.BoxGeometry(0.2, 0.025, 0.12)), beakG = keep(new THREE.ConeGeometry(0.045, 0.12, 12));

  const makeBird = () => {
    const g = new THREE.Group(), core = new THREE.Group(); g.add(core);
    const m = (geo, mat, x, y, z, sx, sy = sx, sz = sx) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.scale.set(sx, sy, sz); core.add(o); return o; };
    m(sph, bodyM, 0, 0, 0, 0.3, 0.2, 0.17);                   // body
    m(sph, belly, 0.05, -0.075, 0, 0.2, 0.1, 0.12);           // paler belly
    m(sph, bodyM, 0.27, 0.1, 0, 0.13);                         // head
    const beak = m(beakG, beakM, 0.42, 0.09, 0, 1); beak.rotation.z = -Math.PI / 2;
    for (const s of [-1, 1]) { m(sph, white, 0.34, 0.14, s * 0.08, 0.035); m(sph, black, 0.365, 0.145, s * 0.095, 0.02); }
    const t = m(tailG, bodyM, -0.37, 0.0, 0, 1); t.rotation.z = 0.15;
    const wings = [-1, 1].map(s => {   // wing pivots sit on the shoulders
      const piv = new THREE.Group(); piv.position.set(0.02, 0.06, s * 0.1); core.add(piv);
      const w = new THREE.Mesh(wingG, wingM); w.scale.z = s; piv.add(w); return { piv, s };
    });
    return { g, core, wings };
  };

  const n = params.count, rng = ctx.rng, group = new THREE.Group(), birds = [];
  const k = n === 1 ? 1 : 0.5 / Math.pow(n, 0.3) + 0.18;
  for (let i = 0; i < n; i++) {
    const b = makeBird(); b.g.scale.setScalar(k);
    const row = Math.ceil(i / 2), side = i === 0 ? 0 : (i % 2 ? 1 : -1);   // V formation, leader at the front
    b.home = n === 1 ? new THREE.Vector3() : new THREE.Vector3(0.4 - row * 0.2 + (rng() - 0.5) * 0.04, (rng() - 0.5) * 0.12, side * row * 0.27);
    b.ph = rng() * 2; b.sp = 7.5 + rng() * 1.5;
    birds.push(b); group.add(b.g);
  }
  const place = t => {
    for (const b of birds) {
      const up = 0.12 + 0.75 * Math.sin(t * b.sp + b.ph * 3);    // wing lift angle: up positive
      for (const w of b.wings) w.piv.rotation.x = -w.s * up;     // the right wing (+z) lifts with a negative turn about x, the left with a positive one
      b.core.position.y = 0.025 * Math.sin(t * b.sp + b.ph * 3 + 1.2);
      b.core.rotation.z = 0.04 * Math.sin(t * b.sp + b.ph * 3);
      b.g.position.set(b.home.x, b.home.y + 0.02 * Math.sin(t * 0.8 + b.ph * 4), b.home.z);
    }
  };
  place(0);
  group.rotation.y = -0.55;   // turned a little toward the camera so the near wing shows its full spread
  const bounds = new THREE.Box3(new THREE.Vector3(-0.5, -0.55, -0.85), new THREE.Vector3(0.55, 0.65, 0.85));
  if (n > 1) { bounds.min.set(-0.8, -0.5, -1.0); bounds.max.set(0.7, 0.5, 1.0); }
  return {
    object: group, bounds,
    update(t) { place(t); },
    dispose() { for (const x of made) x.dispose(); },
  };
}
