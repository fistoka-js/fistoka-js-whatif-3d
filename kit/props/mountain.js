// Prop: mountain. A chunky faceted peak (optionally a small range) with a snow cap, rock or desert colouring.
// Exports: meta, build(params, ctx). Each peak is a cone with a concave, jittered profile; faces are painted by height.

import * as THREE from 'three';
import { jitter, paint, facetMat, tint } from './lib/facets.js';
import { hash } from './lib/noise.js';

export const meta = {
  name: 'mountain',
  summary: 'A chunky low-poly mountain with a snow cap; styles rock, snow, desert; 1 to 3 peaks. Good for places.',
  tags: ['nature', 'earth'],
  floats: false,
  params: {
    style: { type: 'enum', values: ['rock', 'snow', 'desert'], default: 'rock', doc: 'rock = grey with snow cap, snow = mostly white, desert = orange sandstone' },
    peaks: { type: 'int', min: 1, max: 3, default: 1, doc: 'how many peaks (1 = a single mountain)' },
    seed: { type: 'int', min: 0, max: 999, default: 1, doc: 'which variant of the shape' },
  },
  animatable: {},
};

// Per style: snow line (fraction of height; >1 = none), colours low/high rock, snow colour.
const STYLE = {
  rock: { line: 0.56, low: 0x8a7e5a, mid: 0x8c8076, high: 0x9a9aa6, snow: 0xf4f8ff },
  snow: { line: 0.3, low: 0x7a8a96, mid: 0x93a2b4, high: 0xa9b8cc, snow: 0xffffff },
  desert: { line: 9, low: 0xc9733c, mid: 0xe08e4a, high: 0xf0b070, snow: 0xffffff },
};

function peak(R, H, seed, st, rng) {
  const geo = new THREE.ConeGeometry(R, H, 9, 5, true);
  geo.translate(0, H / 2, 0);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) { // concave profile: steeper near the top
    const k = Math.pow(Math.max(0, 1 - pos.getY(i) / H), 0.12);
    const ridge = 1 + 0.16 * Math.sin(Math.atan2(pos.getZ(i), pos.getX(i)) * 3 + seed);
    pos.setX(i, pos.getX(i) * k * ridge); pos.setZ(i, pos.getZ(i) * k * ridge);
  }
  jitter(geo, rng, R * 0.07, H * 0.025);
  for (let i = 0; i < pos.count; i++) if (pos.getY(i) < H * 0.06) pos.setY(i, 0); // flat base
  return paint(geo, f => {
    const yn = f.y / H, h = hash(f.i * 3.7 + seed);
    let c;
    if (yn > st.line + (h - 0.5) * 0.14) c = new THREE.Color(st.snow).lerp(new THREE.Color(0xc4d6f2), (1 - f.ny) * 0.5 + h * 0.08);
    else {
      c = new THREE.Color(yn < 0.18 ? st.low : yn < 0.5 ? st.mid : st.high);
      if (st.line > 5) c = new THREE.Color(st.low).lerp(new THREE.Color(st.high), (Math.sin(yn * 18 + h) * 0.5 + 0.5) * 0.7 + yn * 0.3); // sandstone bands
      c.lerp(new THREE.Color(0x000000), h * 0.18);
    }
    return c;
  });
}

export function build(params, ctx) {
  const st = STYLE[params.style], group = new THREE.Group(), mat = facetMat(ctx, { rim: 0.2 }); mat.side = THREE.DoubleSide;
  const list = [[0, 0, 0.5, 0.85], [-0.42, 0.12, 0.34, 0.55], [0.42, -0.1, 0.32, 0.45]].slice(0, params.peaks);
  const geos = list.map(([x, z, R, H], i) => {
    const g = peak(R, H, params.seed * 7 + i, st, ctx.rng);
    const m = new THREE.Mesh(g, mat);
    m.position.set(x, 0, z);
    group.add(m);
    return g;
  });
  return { object: group, dispose() { geos.forEach(g => g.dispose()); mat.dispose(); } };
}
