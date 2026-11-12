// The channel's named colours. A show may write "blue" instead of "#3d8bff".
// Exports: PALETTE (name -> '#rrggbb'), parseColor(text) -> 0xRRGGBB number or null, DEFAULT_ACCENT,
//          wavelengthColor(v) -> '#rrggbb' (v 0 = blue/violet ... 1 = red; the named colour ramp "spectrum" in bindings).

export const DEFAULT_ACCENT = '#ffe14d';

// Saturated but not neon: these read well on both dark (space) and coloured (studio) backgrounds.
export const PALETTE = {
  red: '#ff4b4b', orange: '#ff9a3c', yellow: '#ffd84a', green: '#4fd36b', teal: '#2ec4b6',
  cyan: '#5ce1ff', blue: '#3d8bff', indigo: '#5b5bff', purple: '#a35bff', pink: '#ff6fb5',
  white: '#ffffff', grey: '#9aa3ad', black: '#15171c', brown: '#9a6b45', gold: '#ffc44d',
  accent: DEFAULT_ACCENT,
};

// '#rgb', '#rrggbb' or a palette name -> 0xRRGGBB. Anything else -> null (types.js reports it).
export function parseColor(text) {
  if (typeof text !== 'string') return null;
  const s = text.trim().toLowerCase();
  if (PALETTE[s]) return parseInt(PALETTE[s].slice(1), 16);
  if (/^#[0-9a-f]{6}$/.test(s)) return parseInt(s.slice(1), 16);
  if (/^#[0-9a-f]{3}$/.test(s)) return parseInt(s[1] + s[1] + s[2] + s[2] + s[3] + s[3], 16);
  return null;
}

// The wavelength colour rule of the approved chameleon video (old kit engine/colors.js): v 0 = short wave (blue/violet)
// ... v 1 = long wave (red). Rows are [v, hue 0..1]; saturation 0.95, lightness 0.47, as in the old page.
const WL = [[0, 0.62], [0.3, 0.38], [0.55, 0.15], [0.78, 0.07], [1, 0]];

// Returns '#rrggbb'. The old page set these HSL values with three.js setHSL, which treats them as linear light, so the
// screen showed them sRGB-encoded; we encode the same way so the colours match the approved video.
export function wavelengthColor(v) {
  v = Math.min(1, Math.max(0, Number(v) || 0));
  let h = 0;
  for (let i = 1; i < WL.length; i++) {
    if (v <= WL[i][0]) { const [a, ha] = WL[i - 1], [b, hb] = WL[i]; h = ha + (hb - ha) * (v - a) / (b - a); break; }
  }
  const s = 0.95, l = 0.47;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const hue = t => {
    t = (t + 1) % 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * 6 * (2 / 3 - t);
    return p;
  };
  const enc = c => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
  return '#' + [hue(h + 1 / 3), hue(h), hue(h - 1 / 3)].map(c => Math.round(255 * Math.min(1, Math.max(0, enc(c)))).toString(16).padStart(2, '0')).join('');
}
