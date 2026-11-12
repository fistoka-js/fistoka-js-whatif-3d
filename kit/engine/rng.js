// Seeded random numbers and smooth noise. Use these instead of Math.random so every frame is a pure function of t.
// Exports: hashString(text) -> 32-bit int, makeRng(seed) -> rng(), hash01(n) -> 0..1, smoothNoise(seed, x) -> -1..1.

// A stable 32-bit hash of a string (FNV-1a). Used to give each prop its own seed from its id.
export function hashString(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// mulberry32: a small, fast seeded generator. rng() returns 0..1; rng.range(a, b) and rng.int(a, b) are helpers.
export function makeRng(seed) {
  let s = (seed >>> 0) || 1;
  const rng = () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rng.range = (a, b) => a + (b - a) * rng();
  rng.int = (a, b) => a + Math.floor(rng() * (b - a + 1));
  rng.pick = list => list[Math.floor(rng() * list.length)];
  return rng;
}

// A random-looking but fixed number 0..1 for any number n (same n, same answer).
export function hash01(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

// Smooth 1-D value noise, -1..1. Used for camera and prop shake so shaking is a smooth function of time.
export function smoothNoise(seed, x) {
  const i = Math.floor(x), f = x - i;
  const u = f * f * (3 - 2 * f);
  const a = hash01(i + seed * 101.3), b = hash01(i + 1 + seed * 101.3);
  return (a + (b - a) * u) * 2 - 1;
}
