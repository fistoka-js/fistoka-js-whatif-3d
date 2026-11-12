// Small maths helpers for animation: clamp, lerp, easing curves, colour mixing.
// Exports: clamp, lerp, lerp3, progress, EASES, ease(name, k), mixColor(a, b, k).

export const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
export const lerp = (a, b, k) => a + (b - a) * k;
export const lerp3 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];

// How far (0..1) time t is through a window that starts at t0 and lasts `over` seconds.
export function progress(t, t0, over) {
  if (over <= 0) return t >= t0 ? 1 : 0;
  return clamp((t - t0) / over);
}

// Easing curves: k in 0..1 -> 0..1 (back and elastic overshoot a little above 1 on the way).
export const EASES = {
  linear: k => k,
  in: k => k * k * k,
  out: k => 1 - Math.pow(1 - k, 3),
  in_out: k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
  back: k => { const c = 1.70158; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); },
  bounce: k => {
    const n = 7.5625, d = 2.75;
    if (k < 1 / d) return n * k * k;
    if (k < 2 / d) return n * (k -= 1.5 / d) * k + 0.75;
    if (k < 2.5 / d) return n * (k -= 2.25 / d) * k + 0.9375;
    return n * (k -= 2.625 / d) * k + 0.984375;
  },
};
export const ease = (name, k) => (EASES[name] || EASES.in_out)(clamp(k));

// Mixes two 0xRRGGBB colours (k = 0 gives a, 1 gives b).
export function mixColor(a, b, k) {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (Math.round(lerp(ar, br, k)) << 16) | (Math.round(lerp(ag, bg, k)) << 8) | Math.round(lerp(ab, bb, k));
}
