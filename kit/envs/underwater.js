// Environment: underwater. A blue-green depth gradient, soft light shafts from above, rising bubbles and drifting
// specks at several depths, distant rocks and kelp, and an optional sandy seabed. Props rest on the seabed at y = 0.
// Exports: meta, build(params, ctx).

import * as THREE from 'three';
import { gradientDome, motes, lightRig } from './lib/parts.js';

export const meta = {
  name: 'underwater',
  summary: 'Under the sea: blue-green water, light shafts, bubbles, optional sandy seabed. For ocean life, subs, pressure.',
  ground: params => params.seabed,
  params: {
    seabed: { type: 'bool', default: true, doc: 'show a sandy seabed (props stand on it); false = props float' },
    depth: { type: 'enum', values: ['shallow', 'deep'], default: 'shallow', doc: 'shallow = bright turquoise, deep = dark blue' },
  },
};

const LOOK = {
  shallow: {
    dome: [[-1, 0x0a5a80], [-0.05, 0x1b94b0], [0.3, 0x32b4c8], [1, 0x8fe4e6]],
    haze: 0x1b94b0, key: [0xe2fbff, 2.8], fill: [0x4aa6e0, 0.9], rim: [0xa8f4ff, 2.4], sky: 0x7fe0e8, gnd: 0x2a6a80, hemi: 1.0,
    sand: [0xa89a6c, 0x7f7656], shaft: 0xc6f6ff, shaftA: 0.3,
  },
  deep: {
    dome: [[-1, 0x010a1c], [-0.05, 0x05355c], [0.3, 0x083f68], [1, 0x14618a]],
    haze: 0x05355c, key: [0xa8dcff, 2.5], fill: [0x2a5ab0, 0.7], rim: [0x5ac0e8, 2.0], sky: 0x3a8ab8, gnd: 0x061c34, hemi: 0.7,
    sand: [0x5a5e58, 0x434a48], shaft: 0x7ac8ff, shaftA: 0.22,
  },
};

// A bubble: a soft ring with a small highlight. Made once from bytes, so it works in Node.
let BUBBLE = null;
function bubbleTexture() {
  if (BUBBLE) return BUBBLE;
  const n = 64, data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const dx = (x + 0.5) / n * 2 - 1, dy = (y + 0.5) / n * 2 - 1, r = Math.hypot(dx, dy);
    const ring = Math.exp(-Math.pow((r - 0.86) / 0.09, 2)), fill = r < 0.9 ? 0.1 : 0;
    const spot = Math.exp(-(Math.pow(dx + 0.38, 2) + Math.pow(dy - 0.4, 2)) / 0.012);
    const a = r > 1 ? 0 : Math.min(1, ring * 0.85 + fill + spot * 0.9);
    const i = 4 * (y * n + x);
    data[i] = data[i + 1] = data[i + 2] = 255; data[i + 3] = Math.round(a * 255);
  }
  BUBBLE = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
  BUBBLE.magFilter = THREE.LinearFilter; BUBBLE.minFilter = THREE.LinearFilter; BUBBLE.needsUpdate = true;
  return BUBBLE;
}

// Soft light shaft: bright at the top of the plane, fading down, soft at both sides.
function shaftMaterial(color, strength) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uStrength: { value: strength } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 uColor; uniform float uStrength; varying vec2 vUv;\n' +
      'void main() { float side = 1.0 - abs(vUv.x * 2.0 - 1.0); side = side * side * (3.0 - 2.0 * side);\n' +
      'float down = pow(vUv.y, 1.6); gl_FragColor = vec4(uColor * side * down * uStrength, 1.0);\n#include <colorspace_fragment>\n}',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false, toneMapped: false,
  });
}

export function build(params, ctx) {
  const L = LOOK[params.depth], s = ctx.scale, rng = ctx.rng;
  const group = new THREE.Group(), far = new THREE.Group();   // far: follows the camera
  const dome = gradientDome(L.dome); far.add(dome);
  group.add(far);

  // Light shafts, slanted, at several depths behind the subject. They sway slowly.
  const shafts = [];
  for (let i = 0; i < 9; i++) {
    const w = (3 + rng() * 4) * s, h = 24 * s;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), shaftMaterial(L.shaft, L.shaftA * (0.5 + rng())));
    const depth = -(5 + rng() * 22) * s;
    m.position.set((rng() - 0.5) * 24 * s * (1 + Math.abs(depth) / (14 * s)), h / 2 - 3 * s, depth);
    m.rotation.z = -0.28 + (rng() - 0.5) * 0.14; m.renderOrder = -6;
    shafts.push({ m, base: m.rotation.z, ph: rng() * 6.28 });
    group.add(m);
  }

  // Bubbles: rise at their own speeds, wrap round, wobble sideways. Four depth bands (near ones are bigger and faster).
  const bubbles = [];
  const bands = [[-3.5, 0.5, 26, 0.2, 0.7], [-7, -3, 36, 0.14, 0.55], [-14, -7, 50, 0.12, 0.4], [0.5, 2.5, 6, 0.26, 0.5]];
  for (const [z0, z1, count, size, op] of bands) {
    const pos = new Float32Array(count * 3), base = [];
    for (let i = 0; i < count; i++) { base.push({ x: (rng() - 0.5) * 12 * s, y: rng() * 14 * s, z: (z0 + rng() * (z1 - z0)) * s, sp: 0.25 + rng() * 0.45, ph: rng() * 6.28 }); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: size * s * (1 + 0.6 * rng()), map: bubbleTexture(), transparent: true, opacity: op, depthWrite: false, color: 0xd8f8ff, fog: true }));
    pts.frustumCulled = false; group.add(pts);
    bubbles.push({ pts, base });
  }
  const specks = motes(rng, { scale: s, count: 120, colors: [0xcff4ff, 0xffffff, 0x9fe0f0], size: 0.03, opacity: 0.5 });
  group.add(specks.object);

  // Seabed: a big disc of sand with soft ripples painted in the colours. Level near the subject.
  let kelp = [];
  if (params.seabed) {
    const geo = new THREE.CircleGeometry(70 * s, 64, 0, Math.PI * 2); geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position, cols = new Float32Array(p.count * 3), c0 = new THREE.Color(L.sand[0]), c1 = new THREE.Color(L.sand[1]), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) / s, z = p.getZ(i) / s;
      const rip = 0.5 + 0.5 * Math.sin(x * 2.4 + Math.sin(z * 0.8) * 2.2 + Math.sin(x * 0.4) * 3);
      c.copy(c0).lerp(c1, rip * 0.7 + 0.15 * Math.sin(z * 0.6)).toArray(cols, i * 3);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    const floor = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true })); floor.renderOrder = -5; group.add(floor);
    // Distant rocks (dark, faceted) and kelp strands swaying, for depth layers behind the subject.
    const rockMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(L.sand[1]).multiplyScalar(0.55), roughness: 0.9, flatShading: true });
    for (let i = 0; i < 10; i++) {
      const r = new THREE.Mesh(new THREE.IcosahedronGeometry((0.6 + rng() * 1.6) * s, 0), rockMat);
      r.position.set((rng() - 0.5) * 30 * s, 0.2 * s, -(6 + rng() * 16) * s); r.scale.y = 0.6 + rng() * 0.6; r.rotation.set(rng() * 3, rng() * 3, rng() * 3);
      group.add(r);
    }
    const kelpMat = new THREE.MeshLambertMaterial({ color: params.depth === 'deep' ? 0x1e5a4a : 0x3aa070, side: THREE.DoubleSide });
    for (let i = 0; i < 9; i++) {
      const h = (3 + rng() * 4) * s, g = new THREE.PlaneGeometry(0.32 * s, h, 1, 8); g.translate(0, h / 2, 0);
      const m = new THREE.Mesh(g, kelpMat); m.position.set((rng() - 0.5) * 26 * s, 0, -(4 + rng() * 14) * s);
      kelp.push({ m, base: g.attributes.position.array.slice(), h, ph: rng() * 6.28 }); group.add(m);
    }
  }

  const lights = lightRig({
    key: [L.key[0], L.key[1], [-2, 6, 3]], fill: [L.fill[0], L.fill[1], [5, 0, 3]], rim: [L.rim[0], L.rim[1], [2, 3, -5]],
    sky: L.sky, ground: L.gnd, hemi: L.hemi,
  });
  const fog = new THREE.Fog(L.haze, 6 * s, 30 * s);
  return {
    object: group, lights, fog, background: L.haze,
    update(t, cam) {
      far.position.fromArray(cam.position);
      fog.near = cam.distance * 0.6; fog.far = cam.distance * 3.2;
      for (const q of shafts) q.m.rotation.z = q.base + 0.05 * Math.sin(t * 0.25 + q.ph);
      for (const b of bubbles) {
        const arr = b.pts.geometry.attributes.position.array, H = 14 * s;
        b.base.forEach((q, i) => {
          arr[i * 3] = q.x + Math.sin(t * 0.9 * q.sp + q.ph) * 0.15 * s;
          arr[i * 3 + 1] = ((q.y + t * q.sp * s) % H) - 2 * s;
          arr[i * 3 + 2] = q.z;
        });
        b.pts.geometry.attributes.position.needsUpdate = true;
      }
      for (const k of kelp) {
        const pos = k.m.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) pos.setX(i, k.base[i * 3] + Math.sin(t * 0.8 + k.ph + k.base[i * 3 + 1] * 0.5) * 0.12 * k.base[i * 3 + 1] * 0.5);
        pos.needsUpdate = true;
      }
      specks.update(t);
    },
  };
}
