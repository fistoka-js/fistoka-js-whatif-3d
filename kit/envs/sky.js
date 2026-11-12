// Environment: sky. An outdoor sky dome (day, sunset or night) with a sun or moon disc, soft clouds at several
// distances, horizon haze, and a ground (grass, ocean, desert, ice, or none). Props stand on the ground at y = 0.
// Exports: meta, build(params, ctx).

import * as THREE from 'three';
import { gradientDome, pointLayer, motes, lightRig } from './lib/parts.js';
import { glowSprite, glowTexture } from '../engine/materials.js';

export const meta = {
  name: 'sky',
  summary: 'Outdoors under a sky (day, sunset or night) above grass, ocean, desert or ice. For anything on Earth.',
  ground: params => params.ground !== 'none',
  params: {
    time: { type: 'enum', values: ['day', 'sunset', 'night'], default: 'day', doc: 'time of day' },
    ground: { type: 'enum', values: ['grass', 'ocean', 'desert', 'ice', 'none'], default: 'grass', doc: 'what is below' },
    clouds: { type: 'number', min: 0, max: 1, default: 0.5, doc: 'how cloudy' },
  },
};

// Per time of day: dome stops (bottom..top), haze colour, sun direction and colour, lights.
const TIMES = {
  day: {
    dome: [[-1, 0x9ec9ee], [0, 0xd2ecff], [0.12, 0x8cc4f5], [0.5, 0x3f8ee6], [1, 0x1f5fc4]],
    haze: 0xc8e4fa, sun: [-0.45, 0.62, -0.65], sunColor: 0xfff6d8, sunSize: 26,
    key: [0xfff2dc, 3.2], rim: [0xcfe8ff, 2.0], fill: [0x9fc8ff, 0.7], sky: 0xa8d4ff, gnd: 0x6a7a50, hemi: 1.0, cloud: 0xffffff,
  },
  sunset: {
    dome: [[-1, 0x4a2a3a], [0, 0xffb878], [0.06, 0xff8a5a], [0.2, 0xb0507a], [0.45, 0x4a3a8a], [1, 0x1a1c4a]],
    haze: 0xe89a80, sun: [0.12, 0.07, -0.99], sunColor: 0xffb060, sunSize: 34,
    key: [0xffbb88, 2.8], rim: [0xff8a6a, 2.6], fill: [0x8a7aff, 1.0], sky: 0xb890d0, gnd: 0x4a3040, hemi: 0.8, cloud: 0xffb090,
  },
  night: {
    dome: [[-1, 0x05070f], [0, 0x1a2a4a], [0.15, 0x0e1a36], [1, 0x03060f]],
    haze: 0x16223c, sun: [-0.12, 0.35, -0.93], sunColor: 0xdfe8ff, sunSize: 12,
    key: [0xb8ccff, 1.8], rim: [0x7fa8ff, 2.2], fill: [0x4a5a9a, 0.6], sky: 0x3a4a7a, gnd: 0x101420, hemi: 0.7, cloud: 0x4a5a7a,
  },
};
const GROUND = { grass: [0x4f8a3a, 0x3a6e2c], ocean: [0x1d6aa5, 0x0f3f70], desert: [0xd8b47a, 0xb88a52], ice: [0xe8f4fb, 0xbcd8ea] };

// Ground: a big disc with gentle colour patches (vertex colours). The ocean gets waves in update().
// dim: 0..1 multiplier on the ground colours (night ground is much darker).
function makeGround(kind, s, rng, dim = 1) {
  const geo = new THREE.CircleGeometry(80 * s, 96, 0, Math.PI * 2);
  // Extra rings near the middle so ocean waves and dunes have vertices to move.
  const plane = new THREE.PlaneGeometry(40 * s, 40 * s, 80, 80);
  const g = kind === 'ocean' || kind === 'desert' ? plane : geo;
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position, cols = new Float32Array(pos.count * 3);
  const [c0, c1] = GROUND[kind].map(h => new THREE.Color(h).multiplyScalar(dim));
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) / s, z = pos.getZ(i) / s;
    const n = 0.5 + 0.25 * Math.sin(x * 0.7 + Math.sin(z * 0.5) * 2) + 0.25 * Math.sin(z * 0.9 + x * 0.3);
    c.copy(c0).lerp(c1, n);
    c.toArray(cols, i * 3);
    // Dunes: gentle ridges, flat near the stage so props stand level.
    if (kind === 'desert') pos.setY(i, s * 0.55 * (Math.sin(x * 0.32 + z * 0.15) + 0.6 * Math.sin(z * 0.5 - x * 0.22) + 0.6) * Math.min(1, Math.max(0, Math.hypot(x, z) - 2.5) / 4));
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  g.computeVertexNormals();
  const mat = kind === 'ocean' || kind === 'ice'
    ? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: kind === 'ocean' ? 0.18 : 0.35, metalness: 0.05 })
    : new THREE.MeshLambertMaterial({ vertexColors: true });
  const mesh = new THREE.Mesh(g, mat);
  mesh.renderOrder = -5;
  const group = new THREE.Group();
  group.add(mesh);
  // Beyond the detailed plane, a flat far disc so the ground reaches the horizon haze.
  if (g === plane) {
    const far = new THREE.Mesh(new THREE.RingGeometry(19 * s, 300 * s, 64, 1).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: c0.clone().lerp(c1, 0.5) }));
    far.position.y = -0.02 * s;
    group.add(far);
  }
  const base = pos.array.slice();
  const colAttr = g.attributes.color, crest = new THREE.Color(0x8fd0ff);
  return {
    object: group,
    update(t) {
      if (kind !== 'ocean') return;
      // Waves: a few travelling sine waves; crests are lighter so the swell reads from any angle.
      for (let i = 0; i < pos.count; i++) {
        const x = base[i * 3] / s, z = base[i * 3 + 2] / s;
        const h = 0.035 * Math.sin(x * 1.3 + t * 1.1) + 0.025 * Math.sin(z * 1.7 - t * 0.8 + x * 0.4) + 0.012 * Math.sin((x + z) * 3.1 + t * 1.9);
        pos.setY(i, s * h);
        c.copy(c0).lerp(c1, 0.5 - h * 6).lerp(crest, Math.max(0, h - 0.025) * 9);
        colAttr.setXYZ(i, c.r, c.g, c.b);
      }
      pos.needsUpdate = true;
      colAttr.needsUpdate = true;
      g.computeVertexNormals();
    },
  };
}

export function build(params, ctx) {
  const T = TIMES[params.time], s = ctx.scale, rng = ctx.rng;
  const group = new THREE.Group();
  const far = new THREE.Group(); // things that follow the camera (dome, sun, far clouds): infinitely far away
  far.add(gradientDome(T.dome));
  group.add(far);

  const sunDir = new THREE.Vector3().fromArray(T.sun).normalize();
  const sun = glowSprite(T.sunColor, T.sunSize, 1);
  const sunCore = glowSprite(0xffffff, T.sunSize * 0.22, params.time === 'night' ? 0.9 : 1);
  sun.material.fog = sunCore.material.fog = false;
  sun.position.copy(sunDir).multiplyScalar(400); sunCore.position.copy(sun.position);
  far.add(sun, sunCore);

  if (params.time === 'night') {
    far.add(pointLayer({ rng, count: 900, size: 2.0, colors: [0xffffff, 0xcfe0ff], place: r => {
      const u = 0.05 + r() * 0.95, a = r() * Math.PI * 2, q = Math.sqrt(1 - u * u);
      return [Math.cos(a) * q * 380, u * 380, Math.sin(a) * q * 380];
    } }));
  }

  // Clouds: puffs of soft sprites in a few clusters at different distances (normal blending, lit by the sky colour).
  const cloudMat = new THREE.SpriteMaterial({ map: glowTexture(), color: T.cloud, transparent: true, opacity: 0.8, depthWrite: false, fog: true });
  const nClusters = Math.round(3 + 9 * params.clouds);
  for (let i = 0; i < nClusters; i++) {
    const a = -Math.PI / 2 + (rng() - 0.5) * Math.PI * 1.6, d = (40 + rng() * 90) * s, h = (6 + rng() * 22) * s;
    const cx = Math.cos(a) * d, cz = Math.sin(a) * d;
    for (let j = 0; j < 6; j++) {
      const puff = new THREE.Sprite(cloudMat);
      const w = (8 + rng() * 10) * s;
      puff.scale.set(w * 1.6, w * 0.8, 1);
      puff.position.set(cx + (rng() - 0.5) * 14 * s, h + (rng() - 0.5) * 3 * s, cz + (rng() - 0.5) * 6 * s);
      group.add(puff);
    }
  }

  let ground = null;
  if (params.ground !== 'none') { ground = makeGround(params.ground, s, rng, params.time === 'night' ? 0.35 : 1); group.add(ground.object); }

  const dust = motes(rng, { scale: s, count: 60, colors: [0xffffff, T.cloud], size: 0.035, opacity: params.time === 'night' ? 0.5 : 0.35 });
  group.add(dust.object);

  // Key light from the sun's side but in front of the subject (so the side facing the camera is lit);
  // rim light from behind on the other side.
  const sx = Math.sign(sunDir.x) || -1;
  const lights = lightRig({
    key: [T.key[0], T.key[1], [sx * 5, Math.max(3, sunDir.y * 8), 5]], fill: [T.fill[0], T.fill[1], [-sx * 5, 1, 4]],
    rim: [T.rim[0], T.rim[1], [-sx * 4, 4, -6]], sky: T.sky, ground: T.gnd, hemi: T.hemi,
  });
  const fog = new THREE.Fog(T.haze, 20 * s, 140 * s);

  return {
    object: group, lights, fog,
    background: T.haze,
    update(t, cam) {
      far.position.fromArray(cam.position);
      fog.near = cam.distance * 3; fog.far = cam.distance * 30;
      if (ground) ground.update(t);
      dust.update(t);
    },
  };
}
