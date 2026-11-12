// Environment: space. Deep blue-black gradient with a faint tinted nebula wash, stars on three shells plus a few big soft
// stars of different sizes, distant dust at three depths (real parallax when the camera drifts), and a warm key / cool rim
// light. Props float (no ground).
// Exports: meta, build(params, ctx).

import * as THREE from 'three';
import { gradientDome, pointLayer, lightRig } from './lib/parts.js';
import { glowSprite } from '../engine/materials.js';

export const meta = {
  name: 'space',
  summary: 'Outer space: layered stars, soft nebula glow, floating dust. For planets, stars, anything cosmic.',
  ground: false,
  params: {
    nebula: { type: 'enum', values: ['blue', 'purple', 'teal', 'red', 'none'], default: 'blue', doc: 'colour of the soft background clouds' },
    stars: { type: 'number', min: 0, max: 2, default: 1, doc: 'how many stars' },
    tint: { type: 'color', default: null, doc: 'optional colour for the nebula wash (overrides the nebula colours)' },
  },
};

const NEBULA = { blue: [0x2a5cff, 0x6a3cff], purple: [0x8a3cff, 0xff4fa8], teal: [0x15b8a6, 0x2a6cff], red: [0xff4a3a, 0xff9a3c], none: [] };

const mix = (a, b, k) => new THREE.Color(a).lerp(new THREE.Color(b), k).getHex();

// Dust specks floating in a slab of depth (z0..z1, in stage units) around the stage: each is a pure function of t.
// Near slabs shift more when the camera moves, so a drift shows real parallax.
function floaters(rng, { s, count, z0, z1, size, opacity, colors, spread = 9 }) {
  const layer = pointLayer({
    rng, count, colors, size: size * s, opacity, fog: false,
    place: r => [(r() - 0.5) * spread * s, (r() - 0.4) * spread * 0.8 * s, (z0 + r() * (z1 - z0)) * s],
  });
  const base = layer.geometry.attributes.position.array.slice();
  return {
    object: layer,
    update(t) {
      const arr = layer.geometry.attributes.position.array;
      for (let i = 0; i < arr.length; i += 3) {
        const ph = i * 0.37;
        arr[i] = base[i] + Math.sin(t * 0.13 + ph) * 0.1 * s;
        arr[i + 1] = base[i + 1] + Math.sin(t * 0.09 + ph * 1.7) * 0.08 * s + t * 0.012 * s;
        arr[i + 2] = base[i + 2] + Math.cos(t * 0.11 + ph) * 0.08 * s;
      }
      layer.geometry.attributes.position.needsUpdate = true;
    },
  };
}

export function build(params, ctx) {
  const rng = ctx.rng, s = ctx.scale;
  const group = new THREE.Group();
  // The nebula wash: the lower and middle part of the backdrop leans toward the nebula colour (or `tint`).
  const neb = params.tint ? [ctx.color(params.tint), mix(ctx.color(params.tint), 0xffffff, 0.25)] : NEBULA[params.nebula];
  const wash = neb.length ? neb[0] : 0x0d1538;
  const dome = gradientDome([
    [-1, mix(0x03040c, wash, 0.015)], [-0.3, mix(0x070c22, wash, 0.03)], [0.0, mix(0x0d1538, wash, 0.045)],
    [0.45, mix(0x080d26, wash, 0.03)], [1, 0x03050e],
  ]);
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
  // A few larger soft stars in three sizes (point layers are one size each), so the sky is not all pinpricks.
  const big1 = pointLayer({ rng, count: Math.round(150 * params.stars), place: shell(200, 300), size: 7, colors: starColors, opacity: 0.8 });
  const big2 = pointLayer({ rng, count: Math.round(50 * params.stars), place: shell(200, 300), size: 11, colors: starColors, opacity: 0.7 });
  const big3 = pointLayer({ rng, count: Math.round(16 * params.stars), place: shell(200, 300), size: 17, colors: starColors, opacity: 0.55 });
  const sky = new THREE.Group();            // far layers follow the camera a little (they are "far away")
  sky.add(far, mid, big1, big2, big3);
  group.add(sky, near);

  // Nebula: large soft additive glows far away. Some fixed ones low in the sky (the lower half of the picture is never
  // empty black), plus scattered ones all around.
  for (let i = 0; i < neb.length * 9; i++) {
    const g = glowSprite(neb[i % neb.length], 130 + rng() * 170, 0.14 + rng() * 0.16);
    g.material.fog = false;
    const az = rng() * Math.PI * 2, el = (rng() - 0.5) * 1.1, d = 280 + rng() * 60;
    g.position.set(Math.sin(az) * Math.cos(el) * d, Math.sin(el) * d, Math.cos(az) * Math.cos(el) * d);
    sky.add(g);
  }
  if (neb.length) for (let i = 0; i < 6; i++) { // a band of colour below the horizon line, all the way round
    const g = glowSprite(neb[i % neb.length], 260 + rng() * 120, 0.07);
    g.material.fog = false;
    const az = (i / 6) * Math.PI * 2 + rng() * 0.4, el = -0.3 - rng() * 0.15, d = 300;
    g.position.set(Math.sin(az) * Math.cos(el) * d, Math.sin(el) * d, Math.cos(az) * Math.cos(el) * d);
    sky.add(g);
  }

  // Dust at three depths: behind the stage, around it, and in front of it.
  const dustColors = [0xbcd4ff, 0xffffff, 0xffe2b0];
  const dusts = [
    floaters(rng, { s, count: 70, z0: -14, z1: -6, size: 0.035, opacity: 0.45, colors: dustColors, spread: 14 }),
    floaters(rng, { s, count: 50, z0: -5, z1: 0.5, size: 0.06, opacity: 0.55, colors: dustColors }),
    floaters(rng, { s, count: 16, z0: 1.2, z1: 4, size: 0.1, opacity: 0.35, colors: dustColors, spread: 7 }),
  ];
  for (const d of dusts) group.add(d.object);

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
      for (const d of dusts) d.update(t);
    },
  };
}
