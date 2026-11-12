// Procedural planet surfaces, painted as bytes (no canvas), so planets build in Node and in the page alike.
// Exports: LOOKS (names), surfaceBytes(look, seed, width) -> { color, glow, width, height }, cloudBytes(seed, width).
// Textures are equirectangular (x = longitude, y = latitude) and computed from points on the unit sphere, so no seam.
// Results are cached: the same (look, seed, width) is painted once per page.
// The earth look is ported from the previous kit's approved earth (continents, shallows, beaches, highlands, ice caps).

import { hash, noise3, fbm, ridged, smoothstep } from './noise.js';

export const LOOKS = ['earth', 'moon', 'mars', 'gas', 'ice', 'lava'];
const CACHE = new Map();
const mix = (a, b, k) => a + (b - a) * k;
const mix3 = (a, b, k) => [mix(a[0], b[0], k), mix(a[1], b[1], k), mix(a[2], b[2], k)];

// ---- earth: land field (sea level chosen so about 32% is land) ----
function earthField(seed) {
  const raw = (x, y, z) => {
    const wx = (noise3(seed + 71, x * 1.1, y * 1.1, z * 1.1) - 0.5) * 0.5;
    const wy = (noise3(seed + 72, x * 1.1, y * 1.1, z * 1.1) - 0.5) * 0.5;
    const wz = (noise3(seed + 73, x * 1.1, y * 1.1, z * 1.1) - 0.5) * 0.5;
    const f = 1.35;
    return fbm(seed, (x + wx) * f + 5, (y + wy) * f + 5, (z + wz) * f + 5, 5);
  };
  const sample = [];
  for (let i = 0; i < 1500; i++) {
    const th = hash(seed * 31 + i * 2 + 0.5) * 2 * Math.PI, cp = 2 * hash(seed * 31 + i * 2 + 1.5) - 1, sp = Math.sqrt(1 - cp * cp);
    sample.push(raw(sp * Math.cos(th), cp, sp * Math.sin(th)));
  }
  sample.sort((a, b) => a - b);
  const level = sample[Math.floor(sample.length * 0.68)];
  const spread = Math.max(1e-3, sample[sample.length - 1] - sample[0]);
  return (x, y, z) => ((raw(x, y, z) - level) / spread) * 2.2;
}

function earthColour(seed, height) {
  const SEA = [26, 110, 168], LAND = [127, 160, 78], SHALLOW = [64, 182, 176], BEACH = [221, 205, 150], HIGH = [102, 88, 58], ICE = [236, 244, 250];
  return (x, y, z) => {
    const h = height(x, y, z);
    let c;
    if (h <= 0) {
      const deep = Math.min(1, -h / 0.35), shallow = Math.exp(h / 0.055) * 0.75;
      c = mix3(SEA.map(v => v * (1 - 0.3 * deep)), SHALLOW, shallow);
    } else {
      const vary = 1 + (noise3(seed + 91, x * 9, y * 9, z * 9) - 0.5) * 0.22 + (noise3(seed + 92, x * 5, y * 5, z * 5) - 0.5) * 0.3;
      const hi = Math.min(1, Math.max(0, (h - 0.08) / 0.16));
      c = mix3(LAND, HIGH, hi * 0.75).map(v => v * vary);
      c = mix3(c, BEACH, 1 - Math.min(1, h / 0.018));
    }
    const edge = Math.abs(y) + (noise3(seed + 93, x * 6, y * 6, z * 6) - 0.5) * 0.09;
    return mix3(c, ICE, smoothstep(0.84, 0.93, edge));
  };
}

// ---- other looks: colour (and glow for lava) at a point on the unit sphere ----
function moonColour(seed) {
  const craters = [];
  for (let i = 0; i < 70; i++) {
    const th = hash(seed + i * 3.1) * 2 * Math.PI, cp = 2 * hash(seed + i * 5.7) - 1, sp = Math.sqrt(1 - cp * cp);
    craters.push({ c: [sp * Math.cos(th), cp, sp * Math.sin(th)], r: 0.03 + 0.16 * Math.pow(hash(seed + i * 9.3), 3) });
  }
  return (x, y, z) => {
    const maria = smoothstep(0.52, 0.6, fbm(seed + 5, x * 1.6 + 3, y * 1.6 + 3, z * 1.6 + 3, 4));
    let v = mix(168, 98, maria) * (0.88 + 0.24 * fbm(seed + 9, x * 8, y * 8, z * 8, 3));
    for (const k of craters) {
      const d = Math.acos(Math.min(1, x * k.c[0] + y * k.c[1] + z * k.c[2])) / k.r;
      if (d < 1.25) v *= d < 0.85 ? 0.82 + 0.1 * d : 1 + 0.25 * (1 - Math.abs(d - 1.02) / 0.23) * (d < 1.25 ? 1 : 0);
    }
    return [v, v * 0.98, v * 0.95];
  };
}

function marsColour(seed) {
  const RUST = [196, 102, 58], DARK = [112, 58, 40], LIGHT = [226, 150, 96], CAP = [240, 236, 230];
  return (x, y, z) => {
    const n = fbm(seed, x * 2 + 4, y * 2 + 4, z * 2 + 4, 5);
    let c = mix3(RUST, DARK, smoothstep(0.5, 0.65, n));
    c = mix3(c, LIGHT, smoothstep(0.45, 0.32, n) * 0.6);
    c = c.map(v => v * (0.9 + 0.2 * noise3(seed + 3, x * 12, y * 12, z * 12)));
    return mix3(c, CAP, smoothstep(0.9, 0.95, Math.abs(y) + (noise3(seed + 8, x * 5, y * 5, z * 5) - 0.5) * 0.05));
  };
}

function gasColour(seed) {
  const BANDS = [[236, 220, 186], [206, 158, 108], [236, 206, 160], [160, 104, 70], [222, 190, 150], [190, 140, 96]];
  return (x, y, z) => {
    const turb = fbm(seed, x * 3, y * 3, z * 3, 4) - 0.5;
    const b = (y * 3.2 + turb * 0.9 + 4) * 1.0;
    const i = Math.floor(b * 2) % BANDS.length, f = smoothstep(0.3, 0.7, b * 2 - Math.floor(b * 2));
    let c = mix3(BANDS[(i + BANDS.length) % BANDS.length], BANDS[(i + 1) % BANDS.length], f);
    // One big storm spot.
    const d = Math.hypot(x - 0.75, (y + 0.32) * 1.8, z - 0.5);
    c = mix3(c, [196, 92, 62], smoothstep(0.24, 0.12, d + turb * 0.1));
    return c;
  };
}

function iceColour(seed) {
  return (x, y, z) => {
    const base = mix3([214, 236, 250], [170, 205, 232], fbm(seed, x * 2 + 1, y * 2 + 1, z * 2 + 1, 4));
    const crack = smoothstep(0.8, 0.95, ridged(seed + 4, x * 2.5 + 2, y * 2.5 + 2, z * 2.5 + 2, 3));
    return mix3(base, [96, 140, 186], crack * 0.8);
  };
}

function lavaColour(seed) {
  return (x, y, z) => {
    const rock = 38 + 30 * fbm(seed, x * 4, y * 4, z * 4, 4);
    const crack = smoothstep(0.72, 0.92, ridged(seed + 2, x * 2.2 + 3, y * 2.2 + 3, z * 2.2 + 3, 3));
    const c = mix3([rock, rock * 0.85, rock * 0.8], [255, 120, 30], crack);
    return { c, g: [255 * crack, 110 * crack, 20 * crack] };
  };
}

const PAINTERS = {
  earth: seed => { const f = earthColour(seed, earthField(seed)); return p => ({ c: f(...p), g: null }); },
  moon: seed => { const f = moonColour(seed); return p => ({ c: f(...p), g: null }); },
  mars: seed => { const f = marsColour(seed); return p => ({ c: f(...p), g: null }); },
  gas: seed => { const f = gasColour(seed); return p => ({ c: f(...p), g: null }); },
  ice: seed => { const f = iceColour(seed); return p => ({ c: f(...p), g: null }); },
  lava: seed => { const f = lavaColour(seed); return p => f(...p); },
};

// The point on the unit sphere for texture coordinates (u, v), matching three.js SphereGeometry.
function sphereAt(u, v) {
  const theta = (1 - v) * Math.PI, st = Math.sin(theta), lon = u * 2 * Math.PI;
  return [-Math.cos(lon) * st, Math.cos(theta), Math.sin(lon) * st];
}

export function surfaceBytes(look, seed, width) {
  const key = `${look}:${seed}:${width}`;
  if (CACHE.has(key)) return CACHE.get(key);
  const w = width, h = width / 2, paint = PAINTERS[look](seed);
  const color = new Uint8Array(w * h * 4);
  let glow = null;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const out = paint(sphereAt((i + 0.5) / w, (j + 0.5) / h));
    const p = 4 * (j * w + i);
    color[p] = Math.min(255, out.c[0]); color[p + 1] = Math.min(255, out.c[1]); color[p + 2] = Math.min(255, out.c[2]); color[p + 3] = 255;
    if (out.g) {
      glow = glow || new Uint8Array(w * h * 4);
      glow[p] = out.g[0]; glow[p + 1] = out.g[1]; glow[p + 2] = out.g[2]; glow[p + 3] = 255;
    }
  }
  const res = { color, glow, width: w, height: h };
  CACHE.set(key, res);
  return res;
}

// White clouds with soft alpha, for the earth's cloud shell.
export function cloudBytes(seed, width) {
  const key = `clouds:${seed}:${width}`;
  if (CACHE.has(key)) return CACHE.get(key);
  const w = width, h = width / 2, data = new Uint8Array(w * h * 4);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const [x, y, z] = sphereAt((i + 0.5) / w, (j + 0.5) / h);
    const n = fbm(seed + 50, x * 2.6 + 9, y * 4 + 9, z * 2.6 + 9, 4);
    const p = 4 * (j * w + i);
    data[p] = data[p + 1] = data[p + 2] = 255;
    data[p + 3] = Math.round(235 * smoothstep(0.5, 0.68, n));
  }
  const res = { color: data, width: w, height: h };
  CACHE.set(key, res);
  return res;
}
