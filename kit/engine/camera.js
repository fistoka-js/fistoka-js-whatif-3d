// The camera: catalogue fields, auto-framing into the caption-safe rectangle, and the named moves and angles.
// Pure maths (no three.js, no DOM), so tools and tests use the same code as the page.
// Exports: CAMERA_FIELDS, CAMERA_DOCS, SAFE, FOV, ASPECT, VIEW_OFFSET_Y, HEIGHT_TO_WIDTH, angleBasis(angle),
//   effectiveRadius(radius, framing, fill), distanceFor(radius, framing), cameraPoseAt(base, focus, shot, t, shake)
//   -> { position: [x,y,z], target: [x,y,z], fov, viewOffsetY, distance }, blendPose(a, b, k) (a glide between two
//   poses: the same fields plus its own blended "up": [x,y,z]), cameraUp(pose) (the camera's up vector for a pose).
// "base" is the shot's camera fields (defaults filled); "focus" is { center, radius, depth } of what to frame at time t.

export const CAMERA_FIELDS = {
  focus: { type: 'list', of: { type: 'propId' }, min: 1, default: null, doc: 'prop ids to frame (default: all props)' },
  framing: { type: 'enum', values: ['close', 'medium', 'wide'], default: 'medium', doc: 'how tight the shot is' },
  angle: { type: 'enum', values: ['front', 'high', 'low', 'top', 'side', 'three-quarter'], default: 'front', doc: 'where the camera looks from' },
  move: { type: 'enum', values: ['drift', 'push_in', 'pull_out', 'orbit', 'rise', 'pan', 'still'], default: 'drift', doc: 'camera motion during the shot' },
  amount: { type: 'number', min: 0, max: 1, default: 0.5, doc: 'strength of the move' },
  // Both default to null, so a shot without them frames and cuts exactly as before.
  fill: { type: 'number', min: 0.5, max: 1.3, default: null, doc: 'how much of the safe area the focus props fill (default: by framing; close 1.02, medium 0.8, wide 0.51); above 1 runs past the safe area' },
  glide: { type: 'number', min: 0.2, max: 6, default: null, doc: 'continuing shots only: seconds to glide from the previous shot\'s camera instead of cutting' },
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
// The subject's centre sits at 43% of the frame height: a little above the middle, clear of the captions.
export const CENTER_Y = 0.43;
// The lens is shifted by this fraction of the frame height so the framed centre lands on CENTER_Y.
export const VIEW_OFFSET_Y = 0.5 - CENTER_Y;
// Tall subjects may use the space between the top margin and the caption zone, kept symmetric around CENTER_Y.
const SAFE_HALF_H = TAN_V * 2 * Math.min(CENTER_Y - SAFE.top, 1 - SAFE.bottom - CENTER_Y);

// How much of the safe width (88% of the frame) the subject fills: about 90% / 70% / 45% of the frame width.
export const FILL = { close: 1.02, medium: 0.8, wide: 0.51 };
const MIN_RADIUS = 0.3;
// Sideways travel of the drift move, as a fraction of the camera distance at amount 1 (0.05 -> the subject slides 6% of the frame width over a shot at amount 0.5).
export const DRIFT_TRUCK = 0.05;

// The radius a subject "looks like" at medium framing: close makes it bigger, wide smaller. Focus actions tween this,
// so a change of framing eases smoothly too. fill (a number, optional) replaces the framing's own share (FILL).
export function effectiveRadius(radius, framing = 'medium', fill = null) {
  const share = typeof fill === 'number' ? fill : (FILL[framing] || FILL.medium);
  return Math.max(MIN_RADIUS, radius) * FILL.medium / share;
}

// A pose part way (k 0..1) from pose a to pose b: the target slides, and the camera swings around it (direction and
// distance are blended separately), so a glide never cuts through the subject.
// The camera's facing (where it looks, and its screen up) turns from a's to b's along the shortest turn, at an even
// rate in k, so the eased k alone sets the pace and no pair of views makes it rush. (Blending the direction vectors
// themselves made nearly opposite views swing fast through the middle.)
// Exactly opposite facings (a half turn, both ways equally short): the turn goes round the axis whose y is positive
// (else x, else z), e.g. front to back swings counter-clockwise seen from above. The angles and moves never come
// that close (the largest swing, side + orbit to front + orbit at amount 1, is about 170 degrees), so the way round
// cannot flip between frames in a real show.
export function blendPose(a, b, k) {
  k = Math.min(1, Math.max(0, k));
  const lerp = (x, y) => x + (y - x) * k;
  const target = [0, 1, 2].map(i => lerp(a.target[i], b.target[i]));
  const off = p => [p.position[0] - p.target[0], p.position[1] - p.target[1], p.position[2] - p.target[2]];
  const la = Math.hypot(...off(a)), lb = Math.hypot(...off(b));
  const fa = facing(a), fb = facing(b);
  // The turn from a's facing to b's, as a quaternion [x, y, z, w] (w = cos of half the angle).
  let r = quatMul(quatOf(fb), quatConj(quatOf(fa)));
  const tie = Math.abs(r[3]) < 1e-9;
  const axisSign = Math.abs(r[1]) > 1e-9 ? r[1] : Math.abs(r[0]) > 1e-9 ? r[0] : r[2];
  if (tie ? axisSign < 0 : r[3] < 0) r = r.map(v => -v);
  const half = Math.acos(Math.min(1, r[3]));
  const s = Math.sin(half);
  // Almost no turn: keep a's facing (nothing to divide by).
  const turn = v => (s < 1e-9 ? v : rotate(v, [r[0] / s, r[1] / s, r[2] / s], 2 * half * k));
  const back = turn(fa.back), up = turn(fa.up);
  const dist = lerp(la, lb);
  const position = [0, 1, 2].map(i => target[i] + back[i] * dist);
  // The blended screen "up" goes out with the pose. Otherwise the up rule (cameraUp) would flip from world-up to -z
  // half way through a side -> top glide and the picture would spin in one frame.
  return { position, target, fov: lerp(a.fov, b.fov), viewOffsetY: lerp(a.viewOffsetY, b.viewOffsetY), distance: lerp(a.distance, b.distance), up };
}

// A pose's facing: back (unit, from the target toward the camera), its screen up, and right (up x back).
function facing(p) {
  const o = [0, 1, 2].map(i => p.position[i] - p.target[i]);
  const l = Math.hypot(...o);
  const back = l > 1e-9 ? o.map(v => v / l) : [0, 0, 1];
  const up = screenUp(p);
  return { back, up, right: cross(up, back) };
}
const cross = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
// Turn v about the unit axis by angle (radians), Rodrigues' formula.
function rotate(v, axis, angle) {
  const c = Math.cos(angle), sn = Math.sin(angle), d = axis[0] * v[0] + axis[1] * v[1] + axis[2] * v[2];
  const x = cross(axis, v);
  return [0, 1, 2].map(i => v[i] * c + x[i] * sn + axis[i] * d * (1 - c));
}
// The quaternion of a facing: the rotation whose columns are right, up, back (standard matrix-to-quaternion steps).
function quatOf({ right: X, up: Y, back: Z }) {
  const tr = X[0] + Y[1] + Z[2];
  let q;
  if (tr > 0) { const s = 0.5 / Math.sqrt(tr + 1); q = [(Y[2] - Z[1]) * s, (Z[0] - X[2]) * s, (X[1] - Y[0]) * s, 0.25 / s]; }
  else if (X[0] > Y[1] && X[0] > Z[2]) { const s = 2 * Math.sqrt(1 + X[0] - Y[1] - Z[2]); q = [0.25 * s, (Y[0] + X[1]) / s, (Z[0] + X[2]) / s, (Y[2] - Z[1]) / s]; }
  else if (Y[1] > Z[2]) { const s = 2 * Math.sqrt(1 + Y[1] - X[0] - Z[2]); q = [(Y[0] + X[1]) / s, 0.25 * s, (Z[1] + Y[2]) / s, (Z[0] - X[2]) / s]; }
  else { const s = 2 * Math.sqrt(1 + Z[2] - X[0] - Y[1]); q = [(Z[0] + X[2]) / s, (Z[1] + Y[2]) / s, 0.25 * s, (X[1] - Y[0]) / s]; }
  const l = Math.hypot(...q);
  return q.map(v => v / l);
}
const quatConj = q => [-q[0], -q[1], -q[2], q[3]];
function quatMul(p, q) {
  return [
    p[3] * q[0] + p[0] * q[3] + p[1] * q[2] - p[2] * q[1],
    p[3] * q[1] - p[0] * q[2] + p[1] * q[3] + p[2] * q[0],
    p[3] * q[2] + p[0] * q[1] - p[1] * q[0] + p[2] * q[3],
    p[3] * q[3] - p[0] * q[0] - p[1] * q[1] - p[2] * q[2],
  ];
}

// Which way is "up" for the camera of a pose. A pose without its own "up" (every pose except mid-glide) uses the
// fixed rule: world up, or -z when looking almost straight down, so a top view does not spin.
export function cameraUp(pose) {
  if (pose.up) return pose.up;
  return Math.abs(pose.position[1] - pose.target[1]) > 0.97 * pose.distance ? [0, 0, -1] : [0, 1, 0];
}

// v with its part along the unit vector "look" removed, made unit length; null if almost nothing is left.
function flatten(v, look) {
  const d = v[0] * look[0] + v[1] * look[1] + v[2] * look[2];
  const w = v.map((x, i) => x - d * look[i]);
  const l = Math.hypot(...w);
  return l < 1e-3 ? null : w.map(x => x / l);
}

// The pose's real on-screen up direction (cameraUp turned square to the view direction).
function screenUp(p) {
  const off = [0, 1, 2].map(i => p.target[i] - p.position[i]);
  const l = Math.hypot(...off) || 1e-6;
  const look = off.map(x => x / l);
  return flatten(cameraUp(p), look) || [0, 1, 0];
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
    // drift: a slow truck sideways (the subject slides about 6% of the frame width, edge to edge, over a shot at the default amount;
    // far layers move less, near ones more) plus a small turn, so the 3D depth shows without distracting.
    case 'drift': side = (smooth - 0.5) * DRIFT_TRUCK * dist * amt; az += (smooth - 0.5) * 14 * amt + wander * amt; el += Math.sin(s * 0.31) * 1.5 * amt; break;
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
