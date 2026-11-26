// Prop: hail. Icy, glassy blue-white pellets falling (or hanging) in a box: irregular, translucent, each tumbling, with a bright glint and an optional falling streak.
// Exports: meta, build(params, ctx). Positions are a pure function of t (seeded start places, wrap-around fall).

import * as THREE from 'three';
import { jitter } from './lib/facets.js';

export const meta = {
  name: 'hail',
  summary: 'Falling glassy blue-white hailstones. Animate "amount" 0..1 to start or stop it. Hailstorms, ice falling.',
  notes: 'Use for hail and icy pellets (not particles). Put it under a storm cloud: set at.y about half its size below the cloud underside, so the top of its box meets the cloud; it falls from the top of its box to the bottom, over and over. Animate amount 0 -> 1 when the hail starts. Stones start at the top of the box. In an env with a ground they fall to the ground (even below the box) and then start again at the top; in an env without a ground (space, empty) they stop at the bottom of the box and start again at the top.',
  tags: ['nature', 'weather', 'ice'],
  floats: true,
  params: {
    count: { type: 'int', min: 5, max: 300, default: 90, doc: 'how many hailstones' },
    stone: { type: 'number', min: 0.01, max: 0.15, default: 0.03, doc: 'size of one stone (fraction of the box); the prop "size" scales the whole hailstorm' },
    speed: { type: 'number', min: 0, max: 3, default: 1, doc: 'fall speed (0 = hanging in the air)' },
    slant: { type: 'number', min: -1, max: 1, default: 0.15, doc: 'sideways lean of the fall (wind): 0 straight down' },
    color: { type: 'color', default: '#a9d2f5', doc: 'colour of the ice (pale glassy blue by default)' },
    streak: { type: 'number', min: 0, max: 1, default: 0.6, doc: 'length of the faint falling streak behind each stone (0 = none; only while it falls, speed above 0)' },
  },
  animatable: {
    amount: { min: 0, max: 1, default: 1, doc: 'share of the stones showing (0 = none, 1 = all)' },
  },
};

export function build(params, ctx) {
  const n = params.count, rng = ctx.rng, S = params.stone;
  // Lumpy ball: a jittered 80-face shape, flat shaded so it catches light like a frozen pellet.
  const geo = new THREE.IcosahedronGeometry(1, 1);
  jitter(geo, rng, 0.28, 0.25);   // irregular, not round
  geo.computeVertexNormals();
  const mat = ctx.mat.solid(0xdfeeff, { rough: 0.05, metal: 0.05, flat: true, emissive: 0.12, rim: 1.2, transparent: true, opacity: 0.72 });
  mat.userData.main = false;   // keep the ice tint (setColor repaints the stones, not the material)
  const mesh = new THREE.InstancedMesh(geo, mat, n);
  mesh.frustumCulled = false;
  // faint streak above each stone (thin cone, wide at the stone), and a small white glint on each stone's upper side
  const sGeo = new THREE.CylinderGeometry(0.0, 1, 1, 5).translate(0, 0.5, 0);
  const sMat = new THREE.MeshBasicMaterial({ color: 0xcfe6ff, transparent: true, opacity: 0.1, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  sMat.userData.main = false;
  const trail = new THREE.InstancedMesh(sGeo, sMat, n); trail.frustumCulled = false;
  const gGeo = new THREE.BufferGeometry(), gPos = new Float32Array(n * 3);
  gGeo.setAttribute('position', new THREE.BufferAttribute(gPos, 3));
  const gMat = new THREE.PointsMaterial({ size: 0.022, map: ctx.mat.glowTexture(), color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  gMat.userData.main = false;
  const glints = new THREE.Points(gGeo, gMat); glints.frustumCulled = false;
  const group = new THREE.Group(); group.add(mesh, trail, glints);
  const base = new THREE.Color(ctx.color(params.color)), tmp = new THREE.Color(), st = [], shade = [];
  for (let i = 0; i < n; i++) {
    st.push({ x: rng() - 0.5, z: (rng() - 0.5) * 0.8, ph: rng(), v: 0.75 + 0.5 * rng(), s: S * (0.6 + 0.8 * rng()),
      sx: 0.75 + 0.5 * rng(), sz: 0.75 + 0.5 * rng(), r: [rng() * 3, rng() * 3, rng() * 3], w: [rng() * 4 - 2, rng() * 4 - 2, rng() * 4 - 2], order: rng() });
    shade.push(0.9 + 0.1 * rng());
  }
  const qid = new THREE.Quaternion(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), pos = new THREE.Vector3(), sc = new THREE.Vector3();
  const paint = () => { for (let i = 0; i < n; i++) mesh.setColorAt(i, tmp.copy(base).multiplyScalar(shade[i])); mesh.instanceColor.needsUpdate = true; };
  paint();
  function update(t, state) {
    const amount = state.params.amount;
    // On a ground the stones fall all the way to it (state.floor, in box units from the centre), not just to the box bottom.
    const low = typeof state.floor === 'number' && state.floor < 0.3 ? state.floor : -0.5, drop = 0.5 - low;
    st.forEach((h, i) => {
      const u = (((t * params.speed * h.v * 0.5 / drop + h.ph) % 1) + 1) % 1;   // 0 = top .. 1 = bottom (the ground, or the box bottom)
      pos.set(h.x + params.slant * (u - 0.5) * 0.5, 0.5 - u * drop + (u * h.s * 0.9), h.z);   // the stone's lowest point lands on the ground
      e.set(h.r[0] + h.w[0] * t, h.r[1] + h.w[1] * t, h.r[2] + h.w[2] * t);
      const on = h.order < amount, sz = on ? h.s : 0;
      q.setFromEuler(e); sc.set(sz * h.sx, sz, sz * h.sz);   // each stone a little squashed or stretched
      m4.compose(pos, q, sc); mesh.setMatrixAt(i, m4);
      pos.toArray(gPos, i * 3); gPos[i * 3] -= sz * 0.35; gPos[i * 3 + 1] += sz * 0.4; gPos[i * 3 + 2] += sz * 0.7;   // glint toward the camera, upper left
      const tl = on ? params.streak * 0.12 * Math.min(1, params.speed) * h.v : 0;
      m4.compose(pos, qid, sc.set(sz * 0.35, tl, sz * 0.35)); trail.setMatrixAt(i, m4);
    });
    mesh.instanceMatrix.needsUpdate = true; trail.instanceMatrix.needsUpdate = true; gGeo.attributes.position.needsUpdate = true;
  }
  update(0, { params: { amount: 1 } });
  return {
    object: group,
    bounds: new THREE.Box3(new THREE.Vector3(-0.5, -0.5, -0.4), new THREE.Vector3(0.5, 0.5, 0.4)),
    update,
    setColor(hex) { base.setHex(hex); paint(); },
    dispose() { geo.dispose(); mat.dispose(); sGeo.dispose(); sMat.dispose(); gGeo.dispose(); gMat.dispose(); },
  };
}
