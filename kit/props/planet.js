// Prop: planet. A lit planet or moon with a procedural surface, optional rings, an animatable air glow
// and an animatable ocean bump (a raised patch of see-through blue water that can move around the surface).
// Exports: meta, build(params, ctx).
// Parts: body (lit sphere with a painted texture), clouds (earth only), air skin + air halo (glow shells, excluded from
// the prop's size), ocean bump (raised blue water that tints the land beneath it and turns with the surface),
// rings (part of the size, so a ringed planet is drawn smaller to fit its unit box).

import * as THREE from 'three';
import { LOOKS, surfaceBytes, cloudBytes } from './lib/surfaces.js';
import { makeOceanBump, makeCloudHole, BODY_R, CLOUD_R, HALO_R } from './lib/oceanBump.js';

export const meta = {
  name: 'planet',
  summary: 'A planet or moon: earth, moon, mars, gas, ice, lava. Optional rings, air glow, a movable ocean bump.',
  tags: ['space'],
  floats: true,
  params: {
    look: { type: 'enum', values: LOOKS, default: 'earth', doc: 'surface style' },
    color: { type: 'color', default: null, doc: 'tint the surface (default: natural colours)' },
    rings: { type: 'bool', default: false, doc: 'Saturn-style rings' },
    turn: { type: 'number', min: -1, max: 1, default: 0.02, doc: 'turns per second: the planet turns by itself at this rate. When the story stops or starts its rotation, place it with "turn": 0 and drive all turning with the "spin" action' },
    ocean_color: {
      type: 'color', default: '#0f56e6',
      doc: 'colour of the ocean bump water (deep blue by default): it tints the land beneath it, so the ' +
        'continents show through, lighter teal toward the edge',
    },
    seed: { type: 'int', min: 0, max: 999, default: 1, doc: 'which variant of the surface' },
  },
  animatable: {
    atmosphere: { min: 0, max: 1.5, default: 0.6, doc: 'glow of the air around it (the moon look has none)' },
    ocean: {
      min: 0, max: 1, default: 0,
      doc: 'raised water bump on the surface: 0 = none; it grows smoothly from a speck to 1 = a big gentle swell ' +
        '(the water tints the land beneath it, and clouds still show over it). Any look, made for earth. ' +
        'Move it with ocean_lon and ocean_lat',
    },
    ocean_lon: {
      min: -180, max: 180, default: 0,
      doc: 'longitude of the ocean bump centre in degrees (0 = the side facing the camera while the planet is not ' +
        'turned; east is positive). A move between two longitudes more than 180 degrees apart goes the long way ' +
        'round, and the value never wraps from 180 to -180, so use steps of less than 180 degrees',
    },
    ocean_lat: {
      min: -90, max: 90, default: 0,
      doc: 'latitude of the ocean bump centre in degrees (0 = equator, 90 = north pole, -90 = south pole)',
    },
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
  const body = new THREE.Mesh(keep(new THREE.SphereGeometry(BODY_R, 64, 48)), bodyMat);
  spinner.add(body);

  let clouds = null;
  if (params.look === 'earth') {
    const cb = cloudBytes(params.seed, 512);
    const cmat = keep(new THREE.MeshStandardMaterial({
      map: keep(dataTexture(cb.color, cb.width, cb.height)), transparent: true, depthWrite: false, roughness: 0.9,
    }));
    clouds = new THREE.Mesh(keep(new THREE.SphereGeometry(CLOUD_R, 64, 48)), cmat);
    ctx.mat.noBounds(clouds);
    group.add(clouds);
  }

  // Air: a thin bright skin on the edge, and a soft halo ring outside the body.
  const skinMat = keep(ctx.mat.fresnelShell(look.air, { power: 3, strength: 0 }));
  const skin = ctx.mat.noBounds(new THREE.Mesh(keep(new THREE.SphereGeometry(0.506, 64, 48)), skinMat));
  const haloMat = keep(ctx.mat.fresnelShell(look.air, {
    power: 2.5, strength: 0, center: true, inside: true, limb: Math.sqrt(1 - (BODY_R / HALO_R) ** 2),
  }));
  const halo = ctx.mat.noBounds(new THREE.Mesh(keep(new THREE.SphereGeometry(HALO_R, 64, 48)), haloMat));
  group.add(skin, halo);

  // Ocean bump: lives in the spinner so it turns with the surface. Nothing is drawn while ocean is 0.
  const bump = makeOceanBump(ctx, ctx.color(params.ocean_color), bodyMat, clouds && clouds.material);
  made.push(bump.geo, bump.mat);
  spinner.add(bump.mesh);
  const hole = clouds && makeCloudHole(clouds.material); // fades this planet's own clouds out over the water

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
      bump.set(state.params.ocean, state.params.ocean_lon, state.params.ocean_lat);
      if (hole) hole.set(bump, spinner.rotation.y - clouds.rotation.y);
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
