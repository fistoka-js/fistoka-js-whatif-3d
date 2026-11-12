// The camera: catalogue fields, auto-framing into the caption-safe rectangle, and the named moves and angles.
// Pure maths (no three.js, no DOM), so tools and tests use the same code as the page.
// Exports: CAMERA_FIELDS, CAMERA_DOCS, SAFE, FOV, ASPECT, VIEW_OFFSET_Y, HEIGHT_TO_WIDTH, angleBasis(angle),
//   effectiveRadius(radius, framing), distanceFor(radius, framing), cameraPoseAt(base, focus, shot, t, shake)
//   -> { position: [x,y,z], target: [x,y,z], fov, viewOffsetY }.
// "base" is the shot's camera fields (defaults filled); "focus" is { center, radius, depth } of what to frame at time t.

export const CAMERA_FIELDS = {
  focus: { type: 'list', of: { type: 'propId' }, min: 1, default: null, doc: 'prop ids to frame (default: all props)' },
  framing: { type: 'enum', values: ['close', 'medium', 'wide'], default: 'medium', doc: 'how tight the shot is' },
  angle: { type: 'enum', values: ['front', 'high', 'low', 'top', 'side', 'three-quarter'], default: 'front', doc: 'where the camera looks from' },
  move: { type: 'enum', values: ['drift', 'push_in', 'pull_out', 'orbit', 'rise', 'pan', 'still'], default: 'drift', doc: 'camera motion during the shot' },
  amount: { type: 'number', min: 0, max: 1, default: 0.5, doc: 'strength of the move' },
};

// Doc lines for the catalogue (one per option value).
export const CAMERA_DOCS = {
  move: {
    drift: 'slow small sideways float (default; never fully still)', push_in: 'moves closer during the shot',
    pull_out: 'moves away during the shot', orbit: 'circles around the subject', rise: 'cranes up, looking down more and more',
    pan: 'slides sideways past the subject', still: 'almost still (a tiny breathing motion)',
  },
  angle: {
    front: 'straight on, a little above', high: 'from above, looking down', low: 'from below, looking up (heroic)',
    top: 'almost straight down', side: 'from the right side', 'three-quarter': 'from the front-right, a little above',
  },
};

// Safe rectangle (fractions of the frame): captions own the bottom 24%, 7% top margin, 6% side margins.
export const SAFE = { top: 0.07, bottom: 0.24, side: 0.06 };
export const FOV = 40;            // vertical field of view, degrees
export const ASPECT = 9 / 16;     // the video is always vertical 1080x1920

// Half-size of the safe rectangle as tangents of the view angle (horizontal and vertical).
const TAN_V = Math.tan((FOV / 2) * Math.PI / 180);
const SAFE_HALF_W = TAN_V * ASPECT * (1 - 2 * SAFE.side);
const SAFE_HALF_H = TAN_V * (1 - SAFE.top - SAFE.bottom);
// The safe rectangle's centre sits above the frame centre; the camera lens is shifted by this fraction of the frame height.
export const VIEW_OFFSET_Y = (SAFE.bottom - SAFE.top) / 2;

// How much of the safe rectangle the subject fills.
const FILL = { close: 1.1, medium: 0.9, wide: 0.65 };
const MIN_RADIUS = 0.7;

// The radius a subject "looks like" at medium framing: close makes it bigger, wide smaller. Focus actions tween this,
// so a change of framing eases smoothly too.
export function effectiveRadius(radius, framing = 'medium') {
  return Math.max(MIN_RADIUS, radius) * FILL.medium / (FILL[framing] || FILL.medium);
}

// Distance from the subject's centre so a subject of this (horizontal-equivalent) radius fits the safe rectangle.
// "radius" is half the subject's width on screen, or its half-height scaled to the same terms (see frameOf in state.js).
export function distanceFor(radius, framing = 'medium') {
  return effectiveRadius(radius, framing) / (SAFE_HALF_W * FILL.medium);
}
// Height half-extents count less than width ones by this factor (the safe rectangle is taller than wide).
export const HEIGHT_TO_WIDTH = SAFE_HALF_W / SAFE_HALF_H;

// Angles: [azimuth degrees (0 = front, + = to the right), elevation degrees (+ = above)].
const ANGLES = { front: [0, 8], high: [0, 32], low: [0, -12], top: [0, 78], side: [80, 6], 'three-quarter': [35, 16] };

// The camera's screen axes for an angle: dir (from the subject toward the camera), right and up (unit vectors).
export function angleBasis(angle) {
  const [az, el] = ANGLES[angle] || ANGLES.front;
  const a = (az * Math.PI) / 180, e = (el * Math.PI) / 180;
  const dir = [Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)];
  const right = [Math.cos(a), 0, -Math.sin(a)];
  const up = [dir[1] * right[2] - dir[2] * right[1], dir[2] * right[0] - dir[0] * right[2], dir[0] * right[1] - dir[1] * right[0]];
  return { dir, right, up };
}

// The camera pose at time t. shot: { start, end }; shake: [x,y,z] extra offset (camera shake effects).
export function cameraPoseAt(base, focus, shot, t, shake = [0, 0, 0]) {
  const dur = Math.max(0.01, shot.end - shot.start);
  const s = t - shot.start;
  const u = Math.min(1, Math.max(0, s / dur));
  const smooth = u * u * (3 - 2 * u);
  const amt = base.amount;
  let [az, el] = ANGLES[base.angle] || ANGLES.front;
  // The front of a deep subject is nearer the camera, so step back by part of its depth.
  let dist = distanceFor(focus.radius, base.framing) + 0.7 * (focus.depth || 0);
  const target = focus.center.slice();
  let side = 0; // sideways slide of camera and target (pan)

  // A slow wander shared by every move so the picture always breathes a little.
  const wander = Math.sin(s * 0.45) * 2.2 + Math.sin(s * 0.23 + 1.3) * 1.4;
  switch (base.move) {
    case 'drift': az += (smooth - 0.5) * 14 * amt + wander * amt; el += Math.sin(s * 0.31) * 1.5 * amt; break;
    case 'push_in': dist *= 1.18 - 0.4 * amt * smooth; az += wander * 0.3; break;
    case 'pull_out': dist *= 0.82 + 0.45 * amt * smooth; az += wander * 0.3; break;
    case 'orbit': az += (smooth - 0.5) * 90 * amt; break;
    case 'rise': el += (smooth - 0.4) * 40 * amt; break;
    case 'pan': side = (smooth - 0.5) * focus.radius * 0.9 * amt; az += wander * 0.2; break;
    case 'still': az += wander * 0.12; break;
  }
  el = Math.max(-60, Math.min(85, el));
  const a = (az * Math.PI) / 180, e = (el * Math.PI) / 180;
  const dir = [Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)];
  // Sideways direction (screen right) for pan.
  const right = [Math.cos(a), 0, -Math.sin(a)];
  target[0] += right[0] * side + shake[0]; target[1] += shake[1]; target[2] += right[2] * side + shake[2];
  const position = [target[0] + dir[0] * dist, target[1] + dir[1] * dist, target[2] + dir[2] * dist];
  return { position, target, fov: FOV, viewOffsetY: VIEW_OFFSET_Y, distance: dist };
}
