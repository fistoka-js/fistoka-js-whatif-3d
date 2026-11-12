// Prop: wave. A thick 3D sine tube with a soft glow that travels along its length. Light, sound, radio, any wave.
// Exports: meta, build(params, ctx). The tube's points are recomputed from t each frame (pure function of t).

import * as THREE from 'three';

export const meta = {
  name: 'wave',
  summary: 'A thick glowing sine wave that travels. Animate "wavelength" and "amplitude" (light, sound, radio).',
  tags: ['science', 'light'],
  floats: true,
  params: {
    color: { type: 'color', default: 'cyan', doc: 'wave colour' },
    speed: { type: 'number', min: -3, max: 3, default: 0.6, doc: 'how fast it travels (cycles per second; negative = leftward)' },
    thickness: { type: 'number', min: 0.02, max: 0.12, default: 0.05, doc: 'tube radius' },
  },
  animatable: {
    wavelength: { min: 0.1, max: 1.5, default: 0.4, doc: 'length of one wave as a fraction of the prop width (small = tight, many humps)' },
    amplitude: { min: 0, max: 0.5, default: 0.2, doc: 'height of the humps' },
  },
};

const SEG = 140, RAD = 12;

// A tube whose centre line is y = f(x). Positions are rewritten each frame by fill().
function makeTube(radius) {
  const geo = new THREE.BufferGeometry();
  const count = (SEG + 1) * RAD;
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  const idx = [];
  for (let i = 0; i < SEG; i++) for (let j = 0; j < RAD; j++) {
    const a = i * RAD + j, b = i * RAD + (j + 1) % RAD, c = (i + 1) * RAD + j, d = (i + 1) * RAD + (j + 1) % RAD;
    idx.push(a, c, b, b, c, d);
  }
  geo.setIndex(idx);
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 2);   // fixed, so it is never culled by stale bounds
  return { geo, radius };
}

function fill(tube, f, scale) {
  const p = tube.geo.attributes.position, n = tube.geo.attributes.normal, r = tube.radius * scale;
  for (let i = 0; i <= SEG; i++) {
    const u = i / SEG, x = u - 0.5, e = 0.002;
    const y = f(u), dy = (f(Math.min(1, u + e)) - f(Math.max(0, u - e))) / (Math.min(1, u + e) - Math.max(0, u - e));
    const tl = Math.hypot(1, dy), nx = -dy / tl, ny = 1 / tl;      // normal in the x-y plane
    const taper = Math.min(1, Math.sqrt(Math.min(u, 1 - u) * 14));  // rounded ends
    for (let j = 0; j < RAD; j++) {
      const a = (j / RAD) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      const vx = nx * c, vy = ny * c, vz = s;
      const k = i * RAD + j;
      p.setXYZ(k, x + vx * r * taper, y + vy * r * taper, vz * r * taper);
      n.setXYZ(k, vx, vy, vz);
    }
  }
  p.needsUpdate = true; n.needsUpdate = true;
}

export function build(params, ctx) {
  const made = [], keep = x => { made.push(x); return x; };
  const col = new THREE.Color(ctx.color(params.color));
  const group = new THREE.Group();
  const core = makeTube(params.thickness), halo = makeTube(params.thickness * 2.3);
  made.push(core.geo, halo.geo);
  const coreMat = keep(ctx.mat.solid(col, { rough: 0.25, emissive: 0.55, rim: 0.5 }));
  const haloMat = keep(new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  haloMat.userData.main = false;
  group.add(new THREE.Mesh(core.geo, coreMat));
  group.add(ctx.mat.noBounds(new THREE.Mesh(halo.geo, haloMat)));
  for (const mesh of group.children) mesh.frustumCulled = false;

  // Fixed bounds (the wave moves and breathes), so animating amplitude never changes the prop's size on screen.
  const bounds = new THREE.Box3(new THREE.Vector3(-0.5, -0.3, -0.08), new THREE.Vector3(0.5, 0.3, 0.08));
  return {
    object: group,
    bounds,
    update(t, state) {
      const wl = Math.max(0.05, state.params.wavelength), amp = state.params.amplitude;
      const phase = t * params.speed * Math.PI * 2;
      const f = u => {
        const env = Math.min(1, Math.sqrt(Math.min(u, 1 - u) * 6));       // calm near the ends
        return amp * env * Math.sin((u / wl) * Math.PI * 2 - phase);
      };
      fill(core, f, 1); fill(halo, f, 1);
      haloMat.opacity = 0.2 * state.opacity;
    },
    setColor(hex) { col.setHex(hex); haloMat.color.setHex(hex); },
    dispose() { for (const x of made) x.dispose(); },
  };
}
