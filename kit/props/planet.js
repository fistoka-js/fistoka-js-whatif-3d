// Prop: planet. A lit planet or moon with a procedural surface, optional rings and an animatable air glow.
// Exports: meta, build(params, ctx).
// Parts: body (lit sphere with a painted texture), clouds (earth only), air skin + air halo (glow shells, excluded from
// the prop's size), rings (part of the size, so a ringed planet is drawn smaller to fit its unit box).

import * as THREE from 'three';
import { LOOKS, surfaceBytes, cloudBytes } from './lib/surfaces.js';

export const meta = {
  name: 'planet',
  summary: 'A lit planet or moon. Looks: earth, moon, mars, gas (giant), ice, lava. Optional rings and air glow.',
  tags: ['space'],
  floats: true,
  params: {
    look: { type: 'enum', values: LOOKS, default: 'earth', doc: 'surface style' },
    color: { type: 'color', default: null, doc: 'tint the surface (default: natural colours)' },
    rings: { type: 'bool', default: false, doc: 'Saturn-style rings' },
    turn: { type: 'number', min: -1, max: 1, default: 0.02, doc: 'turns per second of its own spin' },
    seed: { type: 'int', min: 0, max: 999, default: 1, doc: 'which variant of the surface' },
  },
  animatable: {
    atmosphere: { min: 0, max: 1.5, default: 0.6, doc: 'glow of the air around it (the moon look has none)' },
  },
};

// Per look: air colour, how much air it has, roughness, texture width.
const LOOK = {
  earth: { air: 0x6fc8ff, airK: 1, rough: 0.62, tex: 768 },
  moon: { air: 0xffffff, airK: 0, rough: 0.95, tex: 512 },
  mars: { air: 0xffb08a, airK: 0.6, rough: 0.9, tex: 512 },
  gas: { air: 0xffe2b8, airK: 0.7, rough: 0.8, tex: 512 },
  ice: { air: 0xc4ecff, airK: 0.6, rough: 0.35, tex: 512 },
  lava: { air: 0xff7a3a, airK: 0.8, rough: 0.8, tex: 512 },
};

function dataTexture(bytes, w, h) {
  const tex = new THREE.DataTexture(bytes, w, h, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = true;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

// Ring texture: soft bands, more see-through toward the edges. u runs from the inner to the outer edge.
function ringTexture(seed) {
  const n = 256, data = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    const band = 0.55 + 0.45 * Math.sin(u * 38 + seed) * Math.sin(u * 11 + 1.3);
    const edge = Math.min(1, u * 8) * Math.min(1, (1 - u) * 5);
    data[4 * i] = 230; data[4 * i + 1] = 205; data[4 * i + 2] = 165; data[4 * i + 3] = Math.round(255 * edge * (0.35 + 0.55 * band));
  }
  const tex = new THREE.DataTexture(data, n, 1, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace; tex.magFilter = THREE.LinearFilter; tex.needsUpdate = true;
  return tex;
}

export function build(params, ctx) {
  const look = LOOK[params.look];
  const made = [];
  const keep = x => { made.push(x); return x; };
  const group = new THREE.Group();
  const spinner = new THREE.Group();   // the parts that turn with the planet
  group.add(spinner);

  const surf = surfaceBytes(params.look, params.seed, look.tex);
  const map = keep(dataTexture(surf.color, surf.width, surf.height));
  const bodyMat = keep(ctx.mat.solid(0xffffff, { rough: look.rough, rim: 0.12, map }));
  if (surf.glow) {
    bodyMat.emissiveMap = keep(dataTexture(surf.glow, surf.width, surf.height));
    bodyMat.emissive = new THREE.Color(0xffffff);
    bodyMat.emissiveIntensity = 1.4;
  }
  const body = new THREE.Mesh(keep(new THREE.SphereGeometry(0.5, 64, 48)), bodyMat);
  spinner.add(body);

  let clouds = null;
  if (params.look === 'earth') {
    const cb = cloudBytes(params.seed, 512);
    const cmat = keep(new THREE.MeshStandardMaterial({ map: keep(dataTexture(cb.color, cb.width, cb.height)), transparent: true, depthWrite: false, roughness: 0.9 }));
    clouds = new THREE.Mesh(keep(new THREE.SphereGeometry(0.508, 64, 48)), cmat);
    ctx.mat.noBounds(clouds);
    group.add(clouds);
  }

  // Air: a thin bright skin on the edge, and a soft halo ring outside the body.
  const skinMat = keep(ctx.mat.fresnelShell(look.air, { power: 3, strength: 0 }));
  const skin = ctx.mat.noBounds(new THREE.Mesh(keep(new THREE.SphereGeometry(0.506, 64, 48)), skinMat));
  const haloMat = keep(ctx.mat.fresnelShell(look.air, { power: 2.5, strength: 0, center: true, inside: true, limb: Math.sqrt(1 - (0.5 / 0.57) ** 2) }));
  const halo = ctx.mat.noBounds(new THREE.Mesh(keep(new THREE.SphereGeometry(0.57, 64, 48)), haloMat));
  group.add(skin, halo);

  if (params.rings) {
    const geo = keep(new THREE.RingGeometry(0.68, 1.1, 128, 1));
    // Re-map u to run from the inner edge (0) to the outer edge (1), so the band texture wraps around.
    const pos = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, (Math.hypot(pos.getX(i), pos.getY(i)) - 0.68) / 0.42, 0.5);
    const ringMat = keep(new THREE.MeshStandardMaterial({ map: keep(ringTexture(params.seed)), transparent: true, side: THREE.DoubleSide, roughness: 0.8, depthWrite: false }));
    const ring = new THREE.Mesh(geo, ringMat);
    ring.rotation.x = -Math.PI / 2 + 0.38;
    ring.rotation.y = 0.2;
    group.add(ring);
  }

  return {
    object: group,
    update(t, state) {
      spinner.rotation.y = t * params.turn * Math.PI * 2;
      if (clouds) clouds.rotation.y = t * params.turn * Math.PI * 2.6;
      const air = state.params.atmosphere * look.airK;
      skin.visible = halo.visible = air > 0.01;
      skinMat.uniforms.uStrength.value = 0.9 * air;
      haloMat.uniforms.uStrength.value = 1.5 * air;
    },
    // Tint: the colour multiplies the painted surface (white = natural colours).
    setColor(hex) { bodyMat.color.setHex(hex); },
    dispose() { for (const x of made) x.dispose(); },
  };
}
