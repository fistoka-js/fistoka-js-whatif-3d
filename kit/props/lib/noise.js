// Seeded smooth noise for procedural textures (planet surfaces, clouds, terrain). Pure functions, work in Node.
// Exports: hash(n) -> 0..1, noise3(seed, x, y, z) -> 0..1, fbm(seed, x, y, z, octaves) -> about 0..1,
//          ridged(seed, x, y, z, octaves) -> 0..1 (thin bright lines: cracks, ridges), smoothstep(a, b, x).

export const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
export const smoothstep = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };

// Smooth 3-D value noise (0..1): seeded random values on a grid, blended smoothly. Seam-free on a sphere.
export function noise3(seed, x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const g = (a, b, c) => hash(seed * 977 + (ix + a) + (iy + b) * 57 + (iz + c) * 131);
  const x00 = g(0, 0, 0) + (g(1, 0, 0) - g(0, 0, 0)) * u, x10 = g(0, 1, 0) + (g(1, 1, 0) - g(0, 1, 0)) * u;
  const x01 = g(0, 0, 1) + (g(1, 0, 1) - g(0, 0, 1)) * u, x11 = g(0, 1, 1) + (g(1, 1, 1) - g(0, 1, 1)) * u;
  const y0 = x00 + (x10 - x00) * v, y1 = x01 + (x11 - x01) * v;
  return y0 + (y1 - y0) * w;
}

// Fractal noise: `octaves` layers of noise3, each twice as fine and half as strong.
export function fbm(seed, x, y, z, octaves = 4) {
  let sum = 0, amp = 0.5, norm = 0, f = 1;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise3(seed + i * 13, x * f, y * f, z * f); norm += amp; amp *= 0.5; f *= 2.03;
  }
  return sum / norm;
}

// Ridged noise: high (near 1) along thin winding lines. Good for cracks and ridges.
export function ridged(seed, x, y, z, octaves = 3) {
  let sum = 0, amp = 0.5, norm = 0, f = 1;
  for (let i = 0; i < octaves; i++) {
    const n = 1 - Math.abs(noise3(seed + i * 17, x * f, y * f, z * f) * 2 - 1);
    sum += amp * n * n; norm += amp; amp *= 0.5; f *= 2.1;
  }
  return sum / norm;
}
