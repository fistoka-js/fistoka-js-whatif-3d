// Environment: space. Deep blue-black gradient, three star layers at different depths, soft nebula clouds,
// drifting dust near the stage, and a warm key / cool rim light. Props float (no ground).
// Exports: meta, build(params, ctx).

import * as THREE from 'three';
import { gradientDome, pointLayer, motes, lightRig } from './lib/parts.js';
import { glowSprite } from '../engine/materials.js';

export const meta = {
  name: 'space',
  summary: 'Outer space: layered stars, soft nebula glow, floating dust. For planets, stars, anything cosmic.',
  ground: false,
  params: {
    nebula: { type: 'enum', values: ['blue', 'purple', 'teal', 'red', 'none'], default: 'blue', doc: 'colour of the soft background clouds' },
    stars: { type: 'number', min: 0, max: 2, default: 1, doc: 'how many stars' },
  },
};

const NEBULA = { blue: [0x2a5cff, 0x6a3cff], purple: [0x8a3cff, 0xff4fa8], teal: [0x15b8a6, 0x2a6cff], red: [0xff4a3a, 0xff9a3c], none: [] };

export function build(params, ctx) {
  const rng = ctx.rng, s = ctx.scale;
  const group = new THREE.Group();
  const dome = gradientDome([[-1, 0x03040c], [-0.25, 0x070c22], [0.1, 0x0d1538], [0.5, 0x080d26], [1, 0x03050e]]);
  group.add(dome);

  // Stars on three shells: far (tiny, many), middle, near (bigger, few). Near ones shift most when the camera moves.
  const shell = (r0, r1) => r => {
    const u = r() * 2 - 1, a = r() * Math.PI * 2, rr = r0 + (r1 - r0) * r(), q = Math.sqrt(1 - u * u);
    return [Math.cos(a) * q * rr, u * rr, Math.sin(a) * q * rr - 0.5 * rr * 0.2];
  };
  const starColors = [0xffffff, 0xcfe0ff, 0xfff1d6, 0xa9c4ff];
  const far = pointLayer({ rng, count: Math.round(1600 * params.stars), place: shell(300, 380), size: 2.2, colors: starColors });
  const mid = pointLayer({ rng, count: Math.round(500 * params.stars), place: shell(110, 160), size: 1.0, colors: starColors });
  const near = pointLayer({ rng, count: Math.round(140 * params.stars), place: shell(35 * s, 60 * s), size: 0.25 * s, colors: starColors });
  const sky = new THREE.Group();            // far layers follow the camera a little (they are "far away")
  sky.add(far, mid);
  group.add(sky, near);

  // Nebula: large soft additive glows far away, in two colours.
  const neb = NEBULA[params.nebula];
  // They sit all around (any camera angle sees some), mostly near the horizon band.
  for (let i = 0; i < neb.length * 9; i++) {
    const g = glowSprite(neb[i % neb.length], 130 + rng() * 170, 0.2 + rng() * 0.22);
    g.material.fog = false;
    const az = rng() * Math.PI * 2, el = (rng() - 0.5) * 1.1, d = 280 + rng() * 60;
    g.position.set(Math.sin(az) * Math.cos(el) * d, Math.sin(el) * d, Math.cos(az) * Math.cos(el) * d);
    sky.add(g);
  }

  const dust = motes(rng, { scale: s, count: 90, colors: [0xbcd4ff, 0xffffff, 0xffe2b0], size: 0.05, opacity: 0.6 });
  group.add(dust.object);

  const lights = lightRig({
    key: [0xfff1dc, 3.2, [-4, 3, 5]], fill: [0x8fb4ff, 0.6, [5, -1, 3]], rim: [0x7fb2ff, 3.0, [3, 4, -6]],
    sky: 0x334477, ground: 0x0a0a14, hemi: 0.5,
  });
  const fog = new THREE.Fog(0x060a1a, 30 * s, 120 * s);

  return {
    object: group, lights, fog,
    background: 0x05070f,
    update(t, cam) {
      dome.position.fromArray(cam.position);
      // Far stars move with 90% of the camera, so they shift only slightly: a sense of great distance.
      sky.position.set(cam.position[0] * 0.9, cam.position[1] * 0.9, cam.position[2] * 0.9);
      sky.rotation.y = t * 0.004;
      dust.update(t);
    },
  };
}
