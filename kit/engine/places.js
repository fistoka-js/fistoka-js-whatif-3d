// Named places on the stage ("slots") and turning a place into [x, y, z].
// Exports: SLOTS, resolvePlace(place) -> [x, y, z] (or null if the place is not valid).
// Stage space: +x right, +y up, +z toward the viewer; one unit is about half the frame width at medium framing.

export const SLOTS = {
  center: [0, 0, 0],
  left: [-0.8, 0, 0], right: [0.8, 0, 0],
  top: [0, 0.9, 0], bottom: [0, -0.9, 0],
  'top-left': [-0.8, 0.9, 0], 'top-right': [0.8, 0.9, 0],
  'bottom-left': [-0.8, -0.9, 0], 'bottom-right': [0.8, -0.9, 0],
  front: [0, 0, 0.8], back: [0, 0, -1.2],
  'far-left': [-1.6, 0, 0], 'far-right': [1.6, 0, 0],
};

export function resolvePlace(place) {
  if (typeof place === 'string') return SLOTS[place] ? SLOTS[place].slice() : null;
  if (Array.isArray(place) && place.length === 3 && place.every(n => typeof n === 'number' && Number.isFinite(n))) return place.slice();
  return null;
}
