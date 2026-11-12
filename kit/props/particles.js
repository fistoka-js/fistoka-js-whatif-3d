// Prop: particles. A cloud of small lit balls (or glowing dots) in a box, sphere, ring or stream.
// Exports: meta, build(params, ctx). Positions are a pure function of t (seeded start places + smooth drift).
// Air molecules, dust, a crowd of atoms, a flowing stream of anything small.

import * as THREE from 'three';

export const meta = {
  name: 'particles',
  summary: 'A cloud of small balls or glowing dots in a box, sphere, ring or stream (molecules, dust, atoms).',
  tags: ['basic', 'science'],
  floats: true,
  params: {
    shape: { type: 'enum', values: ['sphere', 'box', 'ring', 'stream'], default: 'sphere', doc: 'shape of the cloud (stream flows left to right)' },
    count: { type: 'int', min: 1, max: 1500, default: 150, doc: 'how many' },
    color: { type: 'color', default: 'cyan', doc: 'main colour' },
    color2: { type: 'color', default: null, doc: 'optional second colour, mixed in' },
    mix: { type: 'number', min: 0, max: 1, default: 0.3, doc: 'share of particles in color2' },
    look: { type: 'enum', values: ['balls', 'dots'], default: 'balls', doc: 'lit balls (solid) or glowing dots' },
    dot: { type: 'number', min: 0.01, max: 0.3, default: 0.06, doc: 'size of each particle (prop units)' },
    seed: { type: 'int', min: 0, max: 999, default: 1, doc: 'which random arrangement' },
  },
  animatable: {
    spread: { min: 0, max: 3, default: 1, doc: 'how spread out the cloud is (1 = fills its box)' },
    speed: { min: 0, max: 5, default: 0.3, doc: 'drift speed' },
  },
};

// A random start place inside the shape (all within -0.5..0.5).
function startPlace(shape, rng) {
  if (shape === 'box') return [rng() - 0.5, rng() - 0.5, rng() - 0.5];
  if (shape === 'ring') {
    const a = rng() * Math.PI * 2, r = 0.38 + rng() * 0.1;
    return [Math.cos(a) * r, (rng() - 0.5) * 0.08, Math.sin(a) * r];
  }
  if (shape === 'stream') return [rng() - 0.5, (rng() - 0.5) * 0.3, (rng() - 0.5) * 0.3];
  // sphere: uniform inside the ball of radius 0.5
  for (;;) {
    const p = [rng() - 0.5, rng() - 0.5, rng() - 0.5];
    if (Math.hypot(...p) <= 0.5) return p;
  }
}

export function build(params, ctx) {
  const n = params.count, rng = ctx.rng;
  const base = [], phase = [], group = [];
  for (let i = 0; i < n; i++) {
    base.push(startPlace(params.shape, rng));
    phase.push([rng() * 6.28, rng() * 6.28, rng() * 6.28, 0.6 + rng() * 0.8]);
    group.push(params.color2 !== null && rng() < params.mix ? 1 : 0);
  }
  const c1 = new THREE.Color(ctx.color(params.color));
  const c2 = new THREE.Color(params.color2 !== null ? ctx.color(params.color2) : ctx.color(params.color));
  const dot = params.dot;
  let mesh, mat, geo;
  if (params.look === 'balls') {
    geo = new THREE.IcosahedronGeometry(dot / 2, 2);
    mat = ctx.mat.solid(0xffffff, { rough: 0.35, rim: 0.4 });
    mesh = new THREE.InstancedMesh(geo, mat, n);
    for (let i = 0; i < n; i++) mesh.setColorAt(i, group[i] ? c2 : c1);
  } else {
    geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
    const cols = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) (group[i] ? c2 : c1).toArray(cols, i * 3);
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    mat = new THREE.PointsMaterial({ size: dot * 2.2, map: ctx.mat.glowTexture(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    mesh = new THREE.Points(geo, mat);
  }
  mesh.frustumCulled = false;
  const m4 = new THREE.Matrix4();

  // Where particle i is at time t (seconds since the shot started).
  function place(i, t, spread, speed, out) {
    const b = base[i], ph = phase[i], s = speed * ph[3];
    let x = b[0] * spread, y = b[1] * spread, z = b[2] * spread;
    if (params.shape === 'stream') {
      // Flow to the right and wrap around, with a small wobble.
      x = ((((b[0] + 0.5 + t * s * 0.25) % 1) + 1) % 1 - 0.5) * Math.max(spread, 0.001);
    }
    const w = 0.04 * Math.min(1, speed * 3);
    out[0] = x + w * Math.sin(t * s * 2 + ph[0]);
    out[1] = y + w * Math.sin(t * s * 2.3 + ph[1]);
    out[2] = z + w * Math.sin(t * s * 1.7 + ph[2]);
  }

  const p = [0, 0, 0];
  function update(t, state) {
    const spread = state.params.spread, speed = state.params.speed;
    if (params.look === 'balls') {
      for (let i = 0; i < n; i++) { place(i, t, spread, speed, p); m4.makeTranslation(p[0], p[1], p[2]); mesh.setMatrixAt(i, m4); }
      mesh.instanceMatrix.needsUpdate = true;
    } else {
      const arr = geo.attributes.position.array;
      for (let i = 0; i < n; i++) { place(i, t, spread, speed, p); arr[i * 3] = p[0]; arr[i * 3 + 1] = p[1]; arr[i * 3 + 2] = p[2]; }
      geo.attributes.position.needsUpdate = true;
    }
  }
  update(0, { params: { spread: 1, speed: 0 } });

  return {
    object: mesh,
    // The cloud's size is its shape's box (particles move inside it), not the measured meshes.
    bounds: new THREE.Box3(new THREE.Vector3(-0.5 - dot, -0.5 - dot, -0.5 - dot), new THREE.Vector3(0.5 + dot, 0.5 + dot, 0.5 + dot)),
    update,
    // "color" action: recolours the main group of particles (color2 ones keep their colour).
    setColor(hex) {
      if (c1.getHex() === hex) return; // nothing to change (the result only depends on hex)
      c1.setHex(hex);
      if (params.look === 'balls') { for (let i = 0; i < n; i++) if (!group[i]) mesh.setColorAt(i, c1); mesh.instanceColor.needsUpdate = true; }
      else { const cols = geo.attributes.color.array; for (let i = 0; i < n; i++) if (!group[i]) c1.toArray(cols, i * 3); geo.attributes.color.needsUpdate = true; }
    },
    dispose() { geo.dispose(); mat.dispose(); },
  };
}
