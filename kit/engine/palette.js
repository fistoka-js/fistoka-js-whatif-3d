// The channel's named colours. A show may write "blue" instead of "#3d8bff".
// Exports: PALETTE (name -> '#rrggbb'), parseColor(text) -> 0xRRGGBB number or null, DEFAULT_ACCENT.

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
