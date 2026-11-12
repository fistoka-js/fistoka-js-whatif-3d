// Prop: eye. A big glossy eyeball: white, coloured iris, black pupil, a shine. Animate "pupil" (size) and "look" (left/right).
// Exports: meta, build(params, ctx). Good for light, vision, darkness, "what do you see" stories.

import * as THREE from 'three';

export const meta = {
  name: 'eye',
  summary: 'A glossy eyeball with iris and pupil. Animate pupil 0..1 (size) and look -1..1 (left/right). Param color = iris.',
  tags: ['body', 'science'],
  floats: true,
  params: {
    color: { type: 'color', default: '#3d9be0', doc: 'iris colour' },
  },
  animatable: {
    pupil: { min: 0, max: 1, default: 0.5, doc: 'pupil size: 0 = tiny (bright light), 1 = wide open (dark)' },
    look: { min: -1, max: 1, default: 0, doc: 'where it looks: -1 = left, 0 = at you, 1 = right' },
  },
};

const R = 0.5;

export function build(params, ctx) {
  const made = [], keep = x => { made.push(x); return x; };
  const group = new THREE.Group(), ball = new THREE.Group(); group.add(ball);
  const white = keep(ctx.mat.solid(0xfaf6f4, { rough: 0.3, rim: 0.15, main: false }));
  ball.add(new THREE.Mesh(keep(new THREE.SphereGeometry(R, 48, 36)), white));
  // Faint red veins at the back/sides: a few thin tubes lying on the white.
  const veinM = keep(ctx.mat.solid(0xe8786f, { rough: 0.6, main: false }));
  for (let i = 0; i < 4; i++) {
    const a0 = ctx.rng() * 6.28, pts = [];
    for (let k = 0; k < 6; k++) {
      const th = 1.1 + k * 0.12, ph = a0 + (ctx.rng() - 0.5) * 0.25 * k;
      pts.push(new THREE.Vector3(Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)).multiplyScalar(R * 1.0));
    }
    ball.add(new THREE.Mesh(keep(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.006, 5)), veinM));
  }
  // Iris: a spherical cap facing +z, radial vertex colours (darker ring at the edge, paler round the pupil).
  const irisGeo = keep(new THREE.SphereGeometry(R * 1.004, 48, 12, 0, Math.PI * 2, 0, 0.62));
  irisGeo.rotateX(Math.PI / 2);
  const ip = irisGeo.attributes.position, col = [];
  for (let i = 0; i < ip.count; i++) {
    const r = Math.hypot(ip.getX(i), ip.getY(i)) / (R * Math.sin(0.62));
    const k = r > 0.88 ? 0.45 : 0.78 + 0.45 * (1 - r) * (0.6 + 0.4 * Math.sin(Math.atan2(ip.getY(i), ip.getX(i)) * 14));
    col.push(k, k, k);
  }
  irisGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const irisM = keep(ctx.mat.solid(ctx.color(params.color), { rough: 0.35, rim: 0.2 })); irisM.vertexColors = true;
  ball.add(new THREE.Mesh(irisGeo, irisM));
  // Pupil: a black cap, scaled in x/y to open and close.
  const pupGeo = keep(new THREE.SphereGeometry(R * 1.008, 40, 8, 0, Math.PI * 2, 0, 0.3)); pupGeo.rotateX(Math.PI / 2);
  const pupil = new THREE.Mesh(pupGeo, keep(ctx.mat.solid(0x08090c, { rough: 0.2, main: false, rim: 0 }))); ball.add(pupil);
  // Cornea: a clear glossy dome over the front, plus a shine dot (does not turn with the eye).
  const corGeo = keep(new THREE.SphereGeometry(R * 1.03, 40, 16, 0, Math.PI * 2, 0, 0.75)); corGeo.rotateX(Math.PI / 2);
  const corM = keep(ctx.mat.solid(0xffffff, { rough: 0.02, main: false, transparent: true, opacity: 0.16, rim: 0.4 }));
  corM.depthWrite = false;
  ball.add(new THREE.Mesh(corGeo, corM));
  const shine = ctx.mat.glowSprite(0xffffff, 0.16, 0.95); shine.position.set(-0.16, 0.17, R * 1.04); group.add(shine);

  return {
    object: group,
    bounds: new THREE.Box3(new THREE.Vector3(-R, -R, -R), new THREE.Vector3(R, R, R)),
    update(t, state) {
      const s = 0.55 + 1.1 * state.params.pupil;
      pupil.scale.set(s, s, 1);
      ball.rotation.y = state.params.look * 0.55 + 0.02 * Math.sin(t * 1.3);   // tiny drift so it feels alive
      ball.rotation.x = -0.03 + 0.015 * Math.sin(t * 0.9);
      shine.material.opacity = 0.95 * state.opacity;
    },
    dispose() { for (const x of made) x.dispose(); shine.material.dispose(); },
  };
}
