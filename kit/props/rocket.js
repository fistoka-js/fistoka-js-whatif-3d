// Prop: rocket. A chunky toy rocket: white body, coloured nose and fins, round window, engine with a flickering flame.
// Exports: meta, build(params, ctx). Stands upright (nose up). Animate "thrust" 0..1 to light the engine.

import * as THREE from 'three';

export const meta = {
  name: 'rocket',
  summary: 'A chunky cartoon rocket with fins and a window. Animate "thrust" 0..1 to light the flame.',
  tags: ['space', 'vehicle'],
  floats: true,
  params: {
    color: { type: 'color', default: 'red', doc: 'colour of the nose and fins' },
    body: { type: 'color', default: '#f2f5fa', doc: 'colour of the body' },
  },
  animatable: {
    thrust: { min: 0, max: 1, default: 0.6, doc: 'engine flame (0 = off, 1 = full blast)' },
  },
};

// A fin: a swept triangle slab, thick enough to look solid. Sticks out along +x from the body.
function finGeometry() {
  const s = new THREE.Shape();
  s.moveTo(0, 0.28); s.lineTo(0.3, -0.05); s.lineTo(0.3, -0.28); s.lineTo(0, -0.18); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: false });
  g.translate(0, 0, -0.03);
  return g;
}

export function build(params, ctx) {
  const made = [], keep = x => { made.push(x); return x; };
  const group = new THREE.Group();
  const accent = keep(ctx.mat.solid(ctx.color(params.color), { rough: 0.4 }));
  const bodyMat = keep(ctx.mat.solid(ctx.color(params.body), { rough: 0.3, rim: 0.3, main: false }));
  const dark = keep(ctx.mat.solid(0x3a4150, { rough: 0.5, main: false }));

  // Body: a short fat cylinder (lathe profile, so the nose is one smooth piece).
  const profile = [[0, -0.5], [0.17, -0.5], [0.3, -0.4], [0.31, -0.2], [0.31, 0.12], [0.27, 0.28], [0.18, 0.43], [0.08, 0.53], [0, 0.57]];
  const bodyGeo = keep(new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 40));
  group.add(new THREE.Mesh(bodyGeo, bodyMat));
  // Coloured nose cap: the top part of the same shape, slightly bigger so it wraps the nose.
  const noseProfile = [[0, 0.3], [0.265, 0.3], [0.19, 0.42], [0.09, 0.52], [0, 0.585]].map(([r, y]) => new THREE.Vector2(r * 1.03, y));
  group.add(new THREE.Mesh(keep(new THREE.LatheGeometry(noseProfile, 40)), accent));
  // Stripe round the middle.
  const stripe = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.318, 0.318, 0.06, 40, 1, true)), accent);
  stripe.position.y = -0.22; group.add(stripe);

  // Window: dark rim ring with a blue glass ball.
  const rim = new THREE.Mesh(keep(new THREE.TorusGeometry(0.115, 0.03, 12, 32)), dark);
  rim.position.set(0, 0.08, 0.3); group.add(rim);
  const glass = new THREE.Mesh(keep(new THREE.SphereGeometry(0.105, 24, 16)), keep(ctx.mat.solid(0x6fd0ff, { rough: 0.1, emissive: 0.5, main: false })));
  glass.position.set(0, 0.08, 0.29); glass.scale.z = 0.45; group.add(glass);

  // Three fins around the base, plus the engine nozzle.
  const fg = keep(finGeometry());
  for (let i = 0; i < 3; i++) {
    const pivot = new THREE.Group();
    pivot.rotation.y = i * Math.PI * 2 / 3 + Math.PI / 2;
    const f = new THREE.Mesh(fg, accent);
    f.position.set(0.27, -0.28, 0); pivot.add(f); group.add(pivot);
  }
  const nozzle = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.1, 0.16, 0.14, 24)), dark);
  nozzle.position.y = -0.56; group.add(nozzle);

  // Flame: bright inner cone and a bigger orange one, pointing down. Excluded from the size (moves with thrust).
  const flame = new THREE.Group(); flame.position.y = -0.62;
  const outerMat = keep(new THREE.MeshBasicMaterial({ color: 0xff8a2a, toneMapped: false, transparent: true, opacity: 0.9 }));
  const innerMat = keep(new THREE.MeshBasicMaterial({ color: 0xfff0a0, toneMapped: false }));
  outerMat.userData.main = false; innerMat.userData.main = false;
  const cg = keep(new THREE.ConeGeometry(1, 1, 24)); cg.translate(0, -0.5, 0); cg.rotateX(Math.PI); cg.translate(0, 0, 0);
  const outer = new THREE.Mesh(cg, outerMat), inner = new THREE.Mesh(cg, innerMat);
  flame.add(outer, inner);
  const fglow = ctx.mat.glowSprite(0xffa040, 1, 0.6); fglow.position.y = -0.2; flame.add(fglow);
  group.add(ctx.mat.noBounds(flame));

  return {
    object: group,
    update(t, state) {
      const th = state.params.thrust;
      flame.visible = th > 0.01;
      const flick = 1 + 0.12 * Math.sin(t * 38) + 0.08 * Math.sin(t * 23 + 1);
      const len = (0.15 + 0.75 * th) * flick;
      outer.scale.set(0.2 + 0.08 * th, len, 0.2 + 0.08 * th);
      inner.scale.set(0.11 + 0.04 * th, len * 0.6, 0.11 + 0.04 * th);
      fglow.scale.setScalar(0.5 + 0.9 * th); fglow.material.opacity = 0.6 * state.opacity;
      group.position.y = 0.012 * Math.sin(t * 2.2) * (0.3 + th);   // engine rumble bob
    },
    dispose() { for (const x of made) x.dispose(); fglow.material.dispose(); },
  };
}
