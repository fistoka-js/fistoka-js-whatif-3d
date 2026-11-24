// Prop: rock. One or several chiselled boulders: big flat facets, chipped edges, cracks, strata, dark crevices, flat base.
// Exports: meta, build(params, ctx).
// Shape = noisy ellipsoid, then cut by random planes (each cut flattens a face), then a flat base.
// Colour is painted per face.

import * as THREE from 'three';
import { paint, facetMat } from './lib/facets.js';
import { hash, noise3, fbm, ridged, smoothstep } from './lib/noise.js';

export const meta = {
  name: 'rock',
  summary: 'A chiselled boulder or group of rocks with cracks, strata and a flat base. For geology, erosion, mining.',
  tags: ['nature', 'earth'],
  floats: false,
  params: {
    color: { type: 'color', default: '#8d8a86', doc: 'rock colour; strata, crevices and lighter tops are shades of it' },
    count: { type: 'int', min: 1, max: 6, default: 1, doc: 'how many boulders (1 = one big rock)' },
    seed: { type: 'int', min: 0, max: 999, default: 1, doc: 'which variant of the shape' },
  },
  animatable: {},
};

const LIFT = 0.1; // share of the rock colour added as glow
const GLOW_GAIN = 0.5; // glow action: extra brightness of the shaded surface at v = 2 (0 = none; raise = brighter, can clip)
const GLOW_TINT = 0.1; // glow action: how far the glow colour moves from the rock colour toward white (0 = own colour)
const GLOW_PEAK = 0.1; // glow action: extra emissive at v = 2 as a share of the tint (raise = brighter, flatter rock)
const GLOW_WARM = 0.035; // glow action: extra warm-grey emissive at v = 2, so black rocks brighten too (0 = none)
const DETAIL_ALONE = 14, DETAIL_BIG = 11, DETAIL_SMALL = 6; // mesh fineness (icosphere subdivisions): a lone rock,
// the big rock of a group, a small rock of a group. Raise = smoother, more faces, slower; lower = coarser, flatter faces.
const SATELLITE_X = 0.38, SATELLITE_Z = 0.3; // how far the small rocks sit from the big one (oval ring; raise = wider apart)
const MAX_TURN = 6; // random turn of each rock, in radians; just under a full circle (6.28), kept so seeds look the same

const unit = (s, k) => { // random unit vector from a seed and index
  const v = new THREE.Vector3(hash(s + k * 1.7) - 0.5, hash(s + k * 3.1 + 9) - 0.5, hash(s + k * 5.3 + 21) - 0.5);
  return v.lengthSq() < 1e-4 ? v.set(0, 1, 0) : v.normalize();
};

// Chiselled boulder, sitting on y = 0. Measured over seeds 0..999 (count 1, built through build() so the random turn is in,
// rng seeded 'a', numbers rounded outward): height 0.90 to 1.43 r, widest side (x or z) 2.39 to 3.40 r.
// detail = mesh fineness (see DETAIL_* above).
function boulder(r, s, detail, base) {
  // Stretch of the rock along x, y, z. Raising a number makes it longer or taller; sy is low, so the rock is squat.
  const sx = 1 + 0.35 * hash(s + 1), sy = 0.62 + 0.25 * hash(s + 2), sz = 1 + 0.3 * hash(s + 3);
  const cuts = []; // [normal, offset]: 8 big cuts make the main faces, 11 small ones chip the edges
  for (let k = 0; k < 19; k++) { // the +63.3 keeps the offset's random draw apart from the normal's draws in unit()
    const h = hash(s + k * 7 + 63.3);
    // Cut offset = how far from the centre the plane cuts. Lower = deeper cut, bigger flat face (big cuts 0.66..0.81,
    // small 0.86..0.96). Raise the small ones toward 1 and the chips fade away.
    cuts.push([unit(s, k), k < 8 ? 0.66 + 0.15 * h : 0.86 + 0.1 * h]);
  }
  const baseY = -0.5 * sy;
  const g = new THREE.IcosahedronGeometry(1, detail), pos = g.attributes.position;
  const p = new THREE.Vector3(), d = new THREE.Vector3(), cut = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    d.fromBufferAttribute(pos, i).normalize();
    // Lump size: 0.82 + 0.4 * noise is 0.82..1.22 of the radius. A bigger 0.4 = lumpier outline, smaller = rounder rock.
    // Lump noise: 1.6/1.4 = lumps per unit across the rock (lower = broader lumps); +4 picks another noise patch.
    const lump = 0.82 + 0.4 * fbm(s, d.x * 1.6 + 4, d.y * 1.4, d.z * 1.4, 3); // broad lumps
    p.set(d.x * sx, d.y * sy, d.z * sz).multiplyScalar(lump);
    for (const [n, o] of cuts) { const k = p.dot(n) - o; if (k > 0) p.addScaledVector(n, -k); }
    // Cracks: 2.6 = how many crack lines per unit (higher = more, thinner); the 0.7..0.85 window is what counts as a crack
    // (move it up for fewer). 0.03 = groove depth, 0.01 = grain roughness (raise either for a rougher surface).
    const crack = smoothstep(0.7, 0.85, ridged(s + 5, p.x * 2.6, p.y * 2.6, p.z * 2.6, 2));
    p.addScaledVector(d, -0.03 * crack + 0.01 * (noise3(s + 9, p.x * 6, p.y * 6, p.z * 6) - 0.5)); // grooves and grain
    if (p.y < baseY) p.y = baseY; // flat base
    pos.setXYZ(i, p.x * r, (p.y - baseY) * r, p.z * r);
  }
  // top = warm off-white that upward faces lerp toward; bandDir = the direction the strata stack along.
  const bandDir = unit(s, 40), c = new THREE.Color(), top = new THREE.Color(0xf2ece4);
  // dark = crevice colour: near-black, with 0.25 of the rock colour mixed in so crevices keep a hint of it.
  const dark = new THREE.Color(0x14110f).lerp(base, 0.25);
  // light colours (0 = grey/brown/dark, 1 = white): start darker so strata have room to show, fewer white tops,
  // wider strata steps, stronger cracks. Grey and brown have light = 0, so these four settings do not change for them.
  // vertexGain scales the vertex colours (not GLOW_GAIN, the glow). 0.5 (0.4 for light rocks) is deliberate headroom: the
  // lit render brightens vertex colours, and the stage keeps the material white, so full-strength colours would wash out.
  const light = smoothstep(0.6, 0.95, base.getHSL({}).l), vertexGain = 0.5 - 0.1 * light, topAmt = 0.7 - 0.4 * light;
  const strataStep = 0.2 + 0.1 * light, crackMax = 0.28 + 0.15 * light;
  return paint(g, f => {
    const x = f.x / r, y = f.y / r + baseY, z = f.z / r, sd = s + 11;
    const warp = fbm(sd, x * 2, y * 2, z * 2, 2) * 0.5;
    // 5 = strata bands per unit across the rock (raise for thinner, more numerous bands); 3 = how wavy the bands are.
    const band = (x * bandDir.x + y * bandDir.y + z * bandDir.z) * 5 + warp * 3;
    const row = Math.floor(band), inRow = band - row; // which flat band this face is in, and how far up it
    // each band gets its own brightness (-0.5..0.5); the +50.5 keeps it apart from the sx/sy/sz draws
    const rowBright = hash(row + s + 50.5) - 0.5;
    // Edge line: the lowest 0.1 of a band (raise = wider line) gets 0.1 less brightness (more negative = darker line).
    const edgeLine = inRow < 0.1 ? -0.1 : 0; // thin dark line at the lower edge of each band
    const strata = 0.9 + 2 * strataStep * rowBright + edgeLine;
    // 0.9 + 0.2 * fbm = 0.9..1.1 patchy brightness per face (raise the 0.2 for more mottling, 0 for none); 3 = patch size.
    c.copy(base).multiplyScalar(vertexGain * strata * (0.9 + 0.2 * fbm(sd + 3, x * 3, y * 3, z * 3, 2)));
    // Hue drift: 0.04 = largest hue shift (share of the colour wheel, +-0.02). Raise for more varied tints, 0 for one hue.
    c.offsetHSL((noise3(sd + 7, x * 1.5, y * 1.5, z * 1.5) - 0.5) * 0.04, 0, 0); // slow hue drift
    // Top lightening: 0.22 on all upward faces plus 0.18 extra on steep-up ones (ny > 0.5). Raise for snowier tops.
    c.lerp(top, topAmt * (Math.max(0, f.ny) * 0.22 + 0.18 * Math.max(0, f.ny - 0.5))); // lighter tops
    const len = Math.hypot(x, y * 1.4, z); // distance from the middle; y * 1.4 counts height more, since the rock is squat
    // Hollow: faces nearer the middle than 0.8 darken, fully by 0.5 (move the window up for more dark area); 0.2 = strength.
    const hollow = 0.2 * smoothstep(0.8, 0.5, len); // inward spots are darker
    // Foot: faces below 0.35 r above the base darken, most at the base (f.y / r is 0 there; the window starts at -0.1 r,
    // so the base gets about 0.87 of the 0.08 strength). Raise 0.35 for a taller foot.
    const foot = 0.08 * (1 - smoothstep(-0.1, 0.35, f.y / r)); // the foot is darker
    // dark where the cracks run (same noise as the cut grooves)
    const crackDark = crackMax * smoothstep(0.72, 0.86, ridged(s + 5, x * 2.6, y * 2.6, z * 2.6, 2));
    // All darkening together is capped at 0.35 (0.5 for light rocks) of the way to the crevice colour; raise = deeper.
    c.lerp(dark, Math.min(0.35 + 0.15 * light, hollow + foot + crackDark));
    return c;
  });
}

export function build(params, ctx) {
  const group = new THREE.Group(), base = new THREE.Color(ctx.color(params.color)), rng = ctx.rng, n = params.count;
  const mat = facetMat(ctx, { rough: 0.92, rim: 0.2 }); // stays white: the rock colour is in the vertex colours
  // A faint rock-coloured glow so rocks do not go black in dark scenes. ctx.mat.solid's emissive option would be white
  // and wash the vertex colours out. The engine's default setGlow (run every frame) also copies the material's white
  // colour into emissive once emissive is non-black, so the rock supplies its own setGlow.
  // Glow action: v = 0 is exactly the idle lift, and the material colour is 1. By v = 2 the emissive has grown to idle lift
  // + GLOW_PEAK of a light tint of the rock's own colour + GLOW_WARM of a warm grey (the warm part is what lifts black),
  // and the material colour has grown to 1 + GLOW_GAIN, which brightens the shaded surface so facets and strata stay.
  // Emissive is flat, so it stays small. Intensity stays 1 so v = 0 matches idle.
  const lift = base.clone().multiplyScalar(LIFT);
  const peak = base.clone().lerp(new THREE.Color(0xffffff), GLOW_TINT).multiplyScalar(GLOW_PEAK)
    .add(new THREE.Color(0xffe6cc).multiplyScalar(GLOW_WARM)).add(lift);
  mat.emissive = lift.clone();
  const setGlow = v => {
    const k = Math.min(v / 2, 1);
    mat.emissive.copy(lift).lerp(peak, k); mat.emissiveIntensity = 1;
    mat.color.setScalar(1 + GLOW_GAIN * k); // brightens the shaded surface, so facets stay
  };
  const geos = [];
  for (let i = 0; i < n; i++) {
    // Radius: the big rock is 0.3; each small one is 0.1..0.22 (raise the 0.12 for a wider spread of small sizes).
    const r = i === 0 ? 0.3 : 0.1 + 0.12 * rng();
    const detail = i > 0 ? DETAIL_SMALL : n === 1 ? DETAIL_ALONE : DETAIL_BIG;
    const geo = boulder(r, params.seed * 31 + i * 7 + 1, detail, base);
    geos.push(geo);
    const m = new THREE.Mesh(geo, mat), a = i === 0 ? 0 : (i / n) * Math.PI * 2 + rng();
    m.position.set(i === 0 ? 0 : Math.cos(a) * SATELLITE_X, 0, i === 0 ? 0 : Math.sin(a) * SATELLITE_Z);
    m.rotation.y = rng() * MAX_TURN;
    group.add(m);
  }
  // setColor does nothing: else the engine paints the white material with the rock colour again (colour x colour).
  return { object: group, setColor() {}, setGlow, dispose() { geos.forEach(g => g.dispose()); mat.dispose(); } };
}
