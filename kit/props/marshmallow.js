// Prop: marshmallow. Plump barrel-sided cylinder, rounded edges, dimpled top, warm off-white, toastable and squishable.
// One lit mesh, painted per vertex: toast goes golden to brown on the sides and top rim first; the flat ends stay paler.
// Squish flattens and widens the body, bulges the sides and slumps the top. Flat bottom stays on the floor.

import * as THREE from 'three';

export const meta = {
  name: 'marshmallow',
  summary: 'Toastable, squishable marshmallow: for s\'mores, campfire, food and soft-versus-hard gags.',
  tags: ['food', 'basic'],
  floats: false,
  params: {
    color: { type: 'color', default: '#faf1e2', doc: 'untoasted colour' },
    style: { type: 'enum', values: ['plain', 'toasted', 'charred'], default: 'plain', doc: 'starting toast level' },
  },
  animatable: {
    toast: { min: 0, max: 1, default: 0, doc: 'adds to style level; 0.5 golden, 1 dark brown, black patches' },
    squish: { min: 0, max: 1, default: 0, doc: '0 plump, 1 pressed wide, sides bulging' },
  },
};

const H = 0.4;                           // half height
const RM = 0.53;                         // widest radius (middle of the side)
const CX = 0.33;                         // radius of the flat end faces
const Q = 0.6;                           // barrel squareness: lower is boxier, 1 is a plain ellipse
const SQ = 0.35;                         // how much squish 1 lowers the body
const NU = 96;                           // segments around
const NCURVE = 45;                       // rows on the curved side (odd, so no row sits exactly on the equator)
const NFLAT = 6;

// Profile from the bottom pole to the top pole: [rho, y, isTopFlat, isBottomFlat].
// The whole side is one smooth curve: flat end radius CX at the poles, RM at the equator, one tangent all the way.
function profile() {
  const pts = [[0, -H, 0, 1]];
  for (let i = 1; i < NFLAT; i++) pts.push([CX * i / NFLAT, -H, 0, 1]);
  for (let i = 0; i <= NCURVE; i++) {
    const a = (-1 + 2 * i / NCURVE) * Math.PI / 2;
    const s = Math.sin(a);
    pts.push([CX + (RM - CX) * Math.cos(a), H * Math.sign(s) * Math.abs(s) ** Q, 0, 0]);
  }
  for (let i = 1; i <= NFLAT; i++) pts.push([CX * (1 - i / NFLAT), H, 1, 0]);
  return pts;
}
// Toast ramp: the last stop is reachable (see paint). Warm brown, never grey.
const ramp = [
  [0, null],
  [0.35, new THREE.Color('#f2c05e')],
  [0.55, new THREE.Color('#c97a26')],
  [1, new THREE.Color('#5c2e14')],
];
const SOOT = new THREE.Color('#150b05');
const STYLE = { plain: 0, toasted: 0.45, charred: 0.9 };
const num = (v, d, lo, hi) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);  // NaN or missing -> default
const smooth = (a, b, x) => {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
};
export function build(params, ctx) {
  const base = new THREE.Color(ctx.color(params.color));
  const prof = profile();
  const rows = prof.length - 2;                  // rings without the two poles
  const count = rows * NU + 2;
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const info = [];                               // per vertex: rest shape, patchiness and toast weight
  // Build-time noise for toast patches only: six sine waves with random directions and phases (the only use of ctx.rng).
  const dirs = Array.from({ length: 6 }, (_, i) => (
    [ctx.rng() - 0.5, ctx.rng() - 0.5, ctx.rng() - 0.5, ctx.rng() * 6.283, 3 + 1.3 * i]
  ));
  const wave = (x, y, z) => {
    const sum = dirs.reduce((s, [dx, dy, dz, p, f]) => s + Math.sin(f * (dx * x + dy * y + dz * z) * 2 + p), 0);
    return sum / 6;
  };
  const vert = (i, [rho, y, top, bottom], a) => {
    const px = rho * Math.cos(a);
    const pz = rho * Math.sin(a);
    const patch = 0.5 + 0.5 * wave(px * 2 + 3, y * 2, pz * 2);
    const e = (rho / RM) ** 3;                   // 0 at the centre of an end face, ~1 on the side wall
    // Toast weight: sides and top rim most, flat ends still toast at high values; underside lags.
    const under = 1 - 0.2 * smooth(-0.2, -0.4, y);
    const w = (0.6 + 0.4 * e) * (0.85 + 0.15 * y / H) * under * (0.9 + 0.2 * patch);
    info[i] = { px, y, pz, rho, top, bottom, patch, w, e };
  };
  vert(0, prof[0], 0);
  for (let r = 0; r < rows; r++) {
    for (let j = 0; j < NU; j++) {
      vert(1 + r * NU + j, prof[r + 1], (j / NU) * Math.PI * 2);
    }
  }
  vert(count - 1, prof[prof.length - 1], 0);
  const idx = [];                                // every quad uses the same diagonal: no shading zig-zag
  const at = (r, j) => 1 + r * NU + (j % NU);
  for (let j = 0; j < NU; j++) {
    idx.push(0, at(0, j), at(0, j + 1));
    idx.push(count - 1, at(rows - 1, j + 1), at(rows - 1, j));
  }
  for (let r = 0; r < rows - 1; r++) {
    for (let j = 0; j < NU; j++) {
      idx.push(at(r, j), at(r + 1, j), at(r, j + 1));
      idx.push(at(r, j + 1), at(r + 1, j), at(r + 1, j + 1));
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(idx);
  // Positions for a squish amount. Ends are pillowy, the top has a dimple that deepens, the sides bulge.
  const shape = sq => {
    for (let i = 0; i < count; i++) {
      const f = info[i];
      const u = Math.max(0, 1 - (f.rho / CX) ** 2);
      const dim = Math.max(0, 1 - (f.rho / (0.6 * CX)) ** 2) ** 1.5;
      const bulge = (1 + 0.1 * sq * Math.max(0, 1 - (f.y / H) ** 2));
      let y = f.y;
      if (f.y > 0) y -= 0.04 * sq * Math.cos(Math.PI / 2 * Math.min(1, f.rho / 0.5)) ** 2;
      if (f.top) y += 0.045 * u - (0.05 + 0.04 * sq) * dim;
      if (f.bottom) y += 0.03 * u;
      pos[3 * i] = f.px * bulge;
      pos[3 * i + 1] = y;
      pos[3 * i + 2] = f.pz * bulge;
    }
    geo.attributes.position.needsUpdate = true;
    geo.computeVertexNormals();
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
  };
  shape(0);
  let lastSq = 0;
  const tmp = new THREE.Color();
  const mat = ctx.mat.solid(0xffffff, { rough: 0.7, rim: 0.25 });
  mat.vertexColors = true;
  const paint = toast => {
    mat.userData.rim.value = 0.25 * (1 - 0.9 * toast);  // white rim light would grey the toasted edge
    const char = smooth(0.7, 1, toast);
    for (let i = 0; i < count; i++) {
      const f = info[i];
      const tv = Math.min(1, Math.max(0, 1.15 * toast ** 1.4 * f.w));
      let k = 1;
      while (k < ramp.length - 1 && tv > ramp[k][0]) k++;
      const [t0, c0] = ramp[k - 1];
      const [t1, c1] = ramp[k];
      const u = Math.min(1, Math.max(0, (tv - t0) / (t1 - t0)));
      tmp.copy(c0 || base).lerp(c1, u);
      tmp.multiplyScalar(1 - 0.12 * (1 - f.patch) * Math.min(1, toast * 3));
      tmp.lerp(SOOT, 0.95 * char * smooth(0.4, 0.8, f.e) * smooth(0.55, 0.75, f.patch));  // black patches, mostly at the rim
      col[3 * i] = tmp.r;
      col[3 * i + 1] = tmp.g;
      col[3 * i + 2] = tmp.b;
    }
    geo.attributes.color.needsUpdate = true;
  };
  const style = typeof params.style === 'string' && Object.hasOwn(STYLE, params.style) ? STYLE[params.style] : 0;
  const eff = t => style + (1 - style) * num(t, 0, 0, 1);  // style is the floor, toast fills the rest
  paint(eff(params.toast));
  const body = new THREE.Mesh(geo, mat);
  const group = new THREE.Group().add(body);
  const bounds = new THREE.Box3();
  // Bounds follow the real mesh (re-measured in update), so the bottom is exactly the floor.
  const pose = (t, sq) => {
    const sy = 1 - SQ * sq;
    const sxz = Math.pow(sy, -0.5);
    const br = 0.012 * Math.sin(t * 2.4);       // tiny breathing, volume kept
    body.scale.set(sxz * (1 - br * 0.5), sy * (1 + br), sxz * (1 - br * 0.5));
    body.position.y = -H * (1 - sy * (1 + br)); // bottom stays on the floor, breathing included
    body.updateMatrix();
    bounds.copy(geo.boundingBox).applyMatrix4(body.matrix);
  };
  pose(0, 0);
  let lastToast = eff(params.toast);
  return {
    object: group,
    bounds,
    update(t, state) {
      const sq = num(state.params.squish, 0, 0, 1);
      const toast = eff(state.params.toast);
      if (toast !== lastToast) {
        paint(lastToast = toast);
      }
      if (sq !== lastSq) {
        shape(lastSq = sq);
      }
      pose(t, sq);
    },
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}
