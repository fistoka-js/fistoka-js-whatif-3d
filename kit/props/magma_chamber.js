// Prop: magma_chamber. Cutaway volcano: layered rock, glowing chamber deep inside, conduit up to the crater.
// The mountain is a half cone cut on a vertical plane, so the front face shows the inside. Pure function of t.
// Rock vertex colours are shades relative to the rock colour; the material colour (engine "color" hook) carries the hue.

import * as THREE from 'three';

export const meta = {
  name: 'magma_chamber',
  summary: 'Cutaway volcano: rock layers, glowing magma chamber and vent pipe. Good for what lies under a volcano.',
  tags: ['nature', 'earth'],
  floats: false,
  params: {
    color: { type: 'color', default: '#8a6248', doc: 'base rock colour; the strata bands are tinted red, ash and ochre around it, so grey or white still gives a slightly warm banded mountain' },
    chamber_color: { type: 'color', default: '#ff4a12', doc: 'magma colour at heat 0.5; low heat is a darker shade of it, high heat a hotter shade, and eruption lava follows it. Chamber centre is 0.15 up: label beside it' },
  },
  animatable: {
    fill: { min: 0, max: 1, default: 0.5, doc: '0 = dim chamber, 1 = magma fills the vent to the crater' },
    heat: { min: 0, max: 1, default: 0.5, doc: '0 = dull dark red, 1 = near-white yellow core' },
    eruption: { min: 0, max: 1, default: 0, doc: 'lava spurts from the crater (needs fill near 1)' },
  },
};

const R = 0.5; // base radius
const TOP = 0.2; // outer radius at the rim
const YT = 0.6; // rim height
const YF = 0.46; // crater floor height (top of the conduit)
const RT = 0.12; // crater radius at the rim
const CR = 0.05; // crater radius at the floor
const NB = 8; // strata count
const WRAP = 0.6; // the shell wraps this many radians past the cut plane, so the flanks stand in front of the face
const DZ = R * (1 - Math.sin(WRAP)) / 2; // shift that centres the wrapped cone on the prop origin
const CY = 0.15; // chamber centre height
const CX = 0.26; // chamber half width at fill 1
const CH = 0.11; // chamber half height at fill 1
const CZ = 0.13; // chamber dome depth in front of the cut face at fill 1
const VX = 0.03; // conduit magma half width
const V0 = 0.2; // conduit bottom: inside the chamber (its top is never below CY + 0.6 * CH = 0.216)
const BLOBS = 8;
const SPARKS = 8;
const BUBBLES = 6; // bubbles rising in the conduit
const CLEAR_PAD_V = 0.04; // cracks and speckles keep this far from the conduit
const CLEAR_PAD_C = 0.06; // and this far from the chamber
// Default look of the magma colours. Other chamber_color values keep the same relative shades.
const DEF_MAGMA = new THREE.Color(0xff4a12);
const DEF_DARK = new THREE.Color(0x6a1208);
const DEF_HOT = new THREE.Color(0xffb020);
const DEF_BLOB = new THREE.Color(0xff5a18);
const DEF_SPARK = new THREE.Color(0xffc040);
const TINTS = [[1, 0.5, 0.4], [0.75, 0.8, 0.85], [1, 0.9, 0.5]]; // red, ash, ochre drift for the strata
const LOBES = [[-0.17, -0.035, 0.11, 0.07, 0.09], [0.19, 0.045, 0.1, 0.065, 0.085]]; // x, y, rx, ry, rz of side pockets
const FLANK_DARK_LOW = 0.3; // shell rows at the base are darkest
const FLANK_DARK = 0.7; // the rest of the flank is darker than the cut face
const CHAMBER_MIN = 0.6; // chamber size at fill 0, as a share of its fill 1 size
const RING_PAD_X = 0.025; // dark rock ring sticks out past its pocket by this much in x
const RING_PAD_Y = 0.02; // and in y
const CORE_XY = 0.42; // glow core width and height, as a share of the chamber
const CORE_Z = 1.15; // glow core depth, as a share of the chamber dome depth
// base plus the offset that turns the default magma colour into `to`, kept in range (exact for the default colour).
const shade = (base, to) => new THREE.Color(
  Math.min(1, Math.max(0, base.r + to.r - DEF_MAGMA.r)),
  Math.min(1, Math.max(0, base.g + to.g - DEF_MAGMA.g)),
  Math.min(1, Math.max(0, base.b + to.b - DEF_MAGMA.b)));
const num = (v, d, lo, hi) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
const sstep = (a, b, x) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};
const half = y => TOP + (R - TOP) * Math.pow(1 - y / YT, 1.25); // concave flank: wide skirt, steeper near the top

// Strata: uneven thickness, light and dark bands with colour drift, a few very dark ash bands.
function makeStrata(ctx) {
  const weights = Array.from({ length: NB }, () => 0.35 + 1.3 * ctx.rng());
  const wsum = weights.reduce((a, b) => a + b, 0);
  const edges = [0];
  const cols = [];
  for (let i = 0; i < NB; i++) {
    edges.push(edges[i] + weights[i] / wsum * YF);
    const ashRoll = ctx.rng(); // drawn first: the random order is part of the look
    const depthFade = 0.75 + 0.25 * i / NB; // upper bands are lighter
    const band = i % 2 ? 0.7 : 1.35; // alternate dark and light so neighbours stand apart
    const jitter = 0.8 + 0.4 * ctx.rng(); // each band a little different
    const ash = ashRoll < 0.2 ? 0.55 : 1; // one band in five is a very dark ash layer
    const lum = depthFade * band * jitter * ash;
    const t = TINTS[Math.floor(ctx.rng() * TINTS.length) % TINTS.length];
    const c = new THREE.Color(lum, lum, lum);
    c.lerp(new THREE.Color(t[0] * lum, t[1] * lum, t[2] * lum), 0.35 + 0.65 * ctx.rng());
    cols.push(c);
  }
  const at = y => {
    let i = 0;
    while (i < NB - 1 && y >= edges[i + 1]) i++;
    return cols[i];
  };
  return { edges, cols, at };
}

// Outer shell: half lathe wrapped past the cut plane, strata colour baked into vertex colours.
function makeShell(strata) {
  const prof = [new THREE.Vector2(0, 0.004), new THREE.Vector2(R, 0.004)]; // base lifted a hair so it never fights the floor
  for (let i = 1; i <= 48; i++) prof.push(new THREE.Vector2(half(i / 48 * YT), i / 48 * YT));
  const rimIdx = prof.length; // the rim top (keeps the flank colour); the crater wall and floor after it are dark
  prof.push(new THREE.Vector2(RT, YT), new THREE.Vector2(RT - 0.003, YT - 0.01));
  prof.push(new THREE.Vector2(CR, YF), new THREE.Vector2(0, YF));
  const dark = new THREE.Color(0.3, 0.3, 0.3);
  const shell = new THREE.LatheGeometry(prof, 28, Math.PI / 2 - WRAP, Math.PI + 2 * WRAP);
  const sp = shell.attributes.position;
  const sc = new Float32Array(sp.count * 3);
  for (let i = 0; i < sp.count; i++) {
    const j = i % prof.length;
    const flank = strata.at(Math.min(sp.getY(i), YF)).clone().multiplyScalar(j < 2 ? FLANK_DARK_LOW : FLANK_DARK); // flanks darker than face
    const c = j > rimIdx ? dark : flank;
    sc.set([c.r, c.g, c.b], i * 3);
  }
  shell.setAttribute('color', new THREE.BufferAttribute(sc, 3));
  return shell;
}

// Cut face at z = 0: strips per stratum with hard colour edges, a crater notch, dark cracks and speckles.
function makeFace(strata, ctx) {
  const pos = [];
  const col = [];
  const idx = [];
  const quad = (pts, c, z) => {
    const o = pos.length / 3;
    for (const p of pts) {
      pos.push(p[0], p[1], z);
      col.push(c.r, c.g, c.b);
    }
    idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
  };
  const strip = (y0, y1, left, right, c) => {
    for (let k = 0; k < 4; k++) { // sub-rows so the curved flank edge matches the shell
      const a = y0 + (y1 - y0) * k / 4;
      const b = y0 + (y1 - y0) * (k + 1) / 4;
      quad([[left(a), a], [right(a), a], [right(b), b], [left(b), b]], c, 0);
    }
  };
  for (let i = 0; i < NB; i++) strip(strata.edges[i], strata.edges[i + 1], y => -half(y), half, strata.cols[i]);
  const rimL = y => -(CR + (RT - CR) * (y - YF) / (YT - YF));
  strip(YF, YT, y => -half(y), rimL, strata.cols[NB - 1]);
  strip(YF, YT, y => -rimL(y), half, strata.cols[NB - 1]);
  const seg = (a, b, w, c) => {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const nx = -(b[1] - a[1]) / len * w;
    const ny = (b[0] - a[0]) / len * w;
    quad([[a[0] - nx, a[1] - ny], [b[0] - nx, b[1] - ny], [b[0] + nx, b[1] + ny], [a[0] + nx, a[1] + ny]], c, 0.004);
  };
  const clear = (x, y) => Math.abs(x) < VX + CLEAR_PAD_V || Math.pow(x / (CX + CLEAR_PAD_C), 2) + Math.pow((y - CY) / (CH + CLEAR_PAD_C), 2) < 1; // chamber, conduit
  const crack = new THREE.Color(0.18, 0.16, 0.15);
  for (let n = 0; n < 6; n++) {
    let p = [(ctx.rng() * 2 - 1) * 0.35, 0.05 + ctx.rng() * (YF - 0.1)];
    for (let k = 0; k < 4; k++) {
      const q = [p[0] + (ctx.rng() - 0.5) * 0.08, p[1] - 0.02 - ctx.rng() * 0.05];
      const ok = !clear(p[0], p[1]) && !clear(q[0], q[1]) && Math.abs(q[0]) < half(q[1]) * 0.9 && q[1] > 0.01;
      if (ok) seg(p, q, 0.0022, crack);
      p = q;
    }
  }
  for (let n = 0; n < 70; n++) {
    const y = 0.02 + ctx.rng() * (YF - 0.03);
    const x = (ctx.rng() * 2 - 1) * half(y) * 0.92;
    const r = 0.005 + 0.008 * ctx.rng();
    const g = ctx.rng() < 0.55 ? 0.45 : 1.3;
    if (!clear(x, y)) quad([[x - r, y], [x, y - r], [x + r, y], [x, y + r]], new THREE.Color(g, g, g), 0.003);
  }
  const face = new THREE.BufferGeometry();
  face.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  face.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  face.setIndex(idx);
  face.computeVertexNormals();
  return face;
}

// Sphere with a vertex-colour gradient: 1 facing the viewer, darker at the rim.
function gradSphere(rim, pow) {
  const g = new THREE.SphereGeometry(1, 20, 12);
  const c = [];
  for (let i = 0; i < g.attributes.normal.count; i++) {
    const v = rim + (1 - rim) * Math.pow(Math.max(0, g.attributes.normal.getZ(i)), pow);
    c.push(v, v, v);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
  return g;
}

// Magma parts live in the solids (so bounds cover them): a lumpy chamber (main dome plus side pockets), core, bubbles,
// column and crater pool. Returns the pieces and a function that sizes them for the current fill and heat.
function makeMagma(ctx, solids, wallMat) {
  const box = new THREE.BoxGeometry(1, 1, 1);
  const magMat = new THREE.MeshBasicMaterial({ toneMapped: false }); // column and pool
  const bulbMat = new THREE.MeshBasicMaterial({ toneMapped: false, vertexColors: true });
  const coreMat = new THREE.MeshBasicMaterial({
    toneMapped: false, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const coreGeo = gradSphere(0, 3);
  const bulbGeo = gradSphere(0.1, 1.5);
  const ringGeo = new THREE.SphereGeometry(1, 28, 16);
  const pockets = [[0, 0, CX, CH, CZ], ...LOBES].map(([x, y, rx, ry, rz]) => {
    const ring = new THREE.Mesh(ringGeo, wallMat); // dark rock round each pocket
    const bulb = new THREE.Mesh(bulbGeo, bulbMat);
    solids.add(ring, bulb);
    return { x, y, rx, ry, rz, ring, bulb };
  });
  const core = new THREE.Mesh(coreGeo, coreMat);
  const column = new THREE.Mesh(box, magMat);
  column.position.z = -0.003;
  const wallPipe = new THREE.Mesh(box, wallMat); // dark inlay strip just proud of the face along the conduit
  wallPipe.scale.set(VX * 2.6, YF - V0, 0.012);
  wallPipe.position.set(0, (YF + V0) / 2, -0.003);
  const pool = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 14, 1, false, Math.PI / 2, Math.PI), magMat);
  solids.add(core, column, wallPipe, pool);
  const bubs = [];
  for (let i = 0; i < BUBBLES; i++) {
    const m = new THREE.Mesh(coreGeo, coreMat);
    solids.add(m);
    bubs.push({ m, ph: ctx.rng(), sp: 0.12 + 0.1 * ctx.rng(), dx: (ctx.rng() - 0.5) * VX });
  }
  const mats = [magMat, bulbMat, coreMat];
  function setGlowColor(t, color, fill) {
    magMat.color.copy(color).multiplyScalar((0.45 + 0.55 * fill) * (1 + 0.04 * Math.sin(t * 2.2)));
    bulbMat.color.copy(magMat.color);
    coreMat.color.copy(magMat.color);
  }
  // Pockets and their dark rings grow with fill; s is the chamber size factor.
  function placePockets(s) {
    for (const p of pockets) {
      p.bulb.scale.set(p.rx * s, p.ry * s, p.rz * s);
      p.ring.scale.set(p.rx * s + RING_PAD_X, p.ry * s + RING_PAD_Y, 0.05);
      p.bulb.position.set(p.x * s, CY + p.y * s, 0);
      p.ring.position.copy(p.bulb.position);
    }
  }
  function placeCore(s) {
    core.position.set(0, CY, 0.01);
    core.scale.set(CX * s * CORE_XY, CH * s * CORE_XY, CZ * s * CORE_Z);
  }
  // Column height is the fill level; it grows from zero, so nothing pops. Returns the height.
  function placeColumn(fill) {
    const rise = (YF - V0) * fill;
    column.scale.set(VX * 2, Math.max(rise, 1e-4), 0.03);
    column.position.y = V0 + rise / 2;
    return rise;
  }
  function placePool(full) {
    const f = Math.max(full, 1e-4);
    pool.scale.set(VX * 1.3 * f, 0.02 * f, VX * 1.3 * f);
    pool.position.set(0, YF + 0.01 * full, 0);
  }
  function placeBubbles(t, rise) {
    for (const q of bubs) {
      const u = (t * q.sp + q.ph) % 1;
      const y = V0 + u * (YF - V0);
      q.m.position.set(q.dx, y, 0.012);
      q.m.scale.setScalar((0.009 + 0.004 * Math.sin(u * 9)) * sstep(0, 0.04, V0 + rise - 0.02 - y));
    }
  }
  // Positions and scales every magma part for this fill. Returns how full the crater is (0..1) for the eruption.
  function placeParts(t, fill) {
    const s = CHAMBER_MIN + (1 - CHAMBER_MIN) * fill;
    placePockets(s);
    placeCore(s);
    const rise = placeColumn(fill);
    const full = sstep(0.85, 1, fill);
    placePool(full);
    placeBubbles(t, rise);
    return full;
  }
  return { mats, coreMat, setGlowColor, placeParts };
}

// Eruption: lit lava blobs of random sizes plus small bright sparks, thrown in a fan and stretched along their motion.
function makeEruption(ctx, fx, base) {
  const geo = new THREE.SphereGeometry(1, 12, 9);
  const blobMat = ctx.mat.solid(shade(base, DEF_BLOB), { emissive: 0.6, rim: 0.3, rough: 0.5, main: false });
  const sparkMat = ctx.mat.solid(shade(base, DEF_SPARK), { emissive: 1.4, rim: 0.1, rough: 0.5, main: false });
  const items = [];
  for (let i = 0; i < BLOBS + SPARKS; i++) {
    const spark = i >= BLOBS;
    const m = new THREE.Mesh(geo, spark ? sparkMat : blobMat);
    fx.add(m);
    items.push({
      m,
      // fan direction, -1 left to 1 right
      a: spark ? (ctx.rng() * 2 - 1) * 1.1 : ((i + 0.5) / BLOBS * 2 - 1) * (0.85 + 0.15 * ctx.rng()),
      z: (ctx.rng() - 0.5) * 0.16,
      ph: spark ? ctx.rng() : i / BLOBS,
      v: spark ? 0.9 + 0.6 * ctx.rng() : 0.6 + 0.6 * ctx.rng(),
      size: spark ? 0.007 + 0.007 * ctx.rng() : 0.018 + 0.026 * ctx.rng(),
    });
  }
  function update(t, e) {
    const grow = sstep(0, 0.2, e); // blobs swell in as the eruption starts
    for (const q of items) {
      const u = (t * 0.7 + q.ph) % 1;
      const peak = (0.14 + 0.2 * q.v) * e;
      const life = sstep(0, 0.08, u) * sstep(1, 0.88, u); // small at launch and landing
      const vx = q.a * 0.42 * e;
      const vy = 4 * peak * (1 - 2 * u);
      const s = Math.max(q.size * grow * life, 1e-4);
      q.m.position.set(vx * u, YF + 0.02 + 4 * peak * u * (1 - u), q.z * u * e);
      q.m.rotation.z = Math.atan2(vy, vx);
      q.m.scale.set(s * (1 + 0.8 * Math.min(1, Math.hypot(vx, vy) * 1.2)), s, s);
    }
  }
  return { mats: [blobMat, sparkMat], update };
}

export function build(params, ctx) {
  const rock = new THREE.Color(ctx.color(params.color));
  const base = new THREE.Color(ctx.color(params.chamber_color));
  const strata = makeStrata(ctx);
  // Main material: the engine colour hook tints the relative vertex shades.
  const rockMat = ctx.mat.solid(rock, { rough: 0.85, rim: 0.2 });
  rockMat.vertexColors = true;
  rockMat.side = THREE.DoubleSide;
  const wallMat = ctx.mat.solid(rock.clone().multiplyScalar(0.25), { rough: 0.9, rim: 0.05, main: false });
  const solids = new THREE.Group();
  solids.add(new THREE.Mesh(makeShell(strata), rockMat), new THREE.Mesh(makeFace(strata, ctx), rockMat));
  const magma = makeMagma(ctx, solids, wallMat);
  // Glows and eruption blobs are the only parts outside the bounds.
  const fx = ctx.mat.noBounds(new THREE.Group());
  const eruption = makeEruption(ctx, fx, base);
  const glow = ctx.mat.glowSprite(0xff6a1a, 1, 1);
  glow.position.set(0, CY + 0.06, 0.1);
  fx.add(glow);
  const group = new THREE.Group();
  group.add(solids, fx);
  solids.position.z = DZ; // centre the wrapped cone on the prop origin
  fx.position.z = DZ;
  const hot = shade(base, DEF_HOT);
  const dark = new THREE.Color(base.r * DEF_DARK.r / DEF_MAGMA.r, base.g * DEF_DARK.g / DEF_MAGMA.g, base.b * DEF_DARK.b / DEF_MAGMA.b);
  const whiteHot = new THREE.Color(0xfff4d0);
  const tmp = new THREE.Color();
  function update(t, state) {
    const p = state.params;
    const fill = num(p.fill, 0.5, 0, 1);
    const heat = num(p.heat, 0.5, 0, 1);
    // Colour steps dark red -> chamber colour -> hot orange; intensity is scaled at low fill, so low values look dim.
    tmp.copy(dark).lerp(base, sstep(0, 0.5, heat)).lerp(hot, sstep(0.5, 1, heat));
    glow.material.color.copy(tmp);
    magma.setGlowColor(t, tmp, fill);
    magma.coreMat.color.lerp(whiteHot, sstep(0.3, 1, heat) * 0.85).multiplyScalar(0.25 + 0.75 * heat);
    const full = magma.placeParts(t, fill);
    // Small glow, lifted off the floor plane so it cannot spill onto the ground at high camera angles.
    glow.material.opacity = state.opacity * 0.9 * (0.15 + 0.85 * heat) * (0.3 + 0.7 * fill);
    glow.scale.setScalar(0.3 + 0.3 * fill);
    eruption.update(t, num(p.eruption, 0, 0, 1) * full);
  }
  update(0, { opacity: 1, params: { fill: 1, heat: params.heat, eruption: 0 } });
  group.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(solids); // measured with the chamber at full size (the largest it gets)
  update(0, { opacity: 1, params: { fill: params.fill, heat: params.heat, eruption: params.eruption } });
  return {
    object: group, bounds, update,
    dispose() {
      group.traverse(o => {
        if (o.isMesh) o.geometry.dispose();
      });
      for (const m of [rockMat, wallMat, ...magma.mats, ...eruption.mats, glow.material]) m.dispose();
    },
  };
}
