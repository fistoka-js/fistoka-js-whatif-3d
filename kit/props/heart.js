// Prop: heart. A plump, tilted, anatomy-flavoured heart with an aorta, a pulmonary artery and a vena cava. Beats as a function of t.
// Exports: meta, build(params, ctx). Animate "rate" 0..1 (about 40 to 180 beats a minute).
// Note: the beat phase is t * beats-per-second, so changing "rate" mid-shot makes the beat skip once. That is fine for a heartbeat.

import * as THREE from 'three';

export const meta = {
  name: 'heart',
  summary: 'A stylised anatomical heart with vessels that beats (lub-dub). Animate "rate" 0..1 for a faster pulse.',
  tags: ['body', 'science'],
  floats: true,
  params: {
    color: { type: 'color', default: '#e8404f', doc: 'heart colour' },
  },
  animatable: {
    rate: { min: 0, max: 1, default: 0.3, doc: 'heart rate: 0 = about 40 beats a minute, 1 = about 180' },
  },
};

// Heart outline from the classic parametric curve, as radius-by-angle about a centre point (so a sphere can be bent to it).
function outlineTable() {
  const N = 360, tab = new Array(N).fill(0), cy = 2.5;
  for (let i = 0; i < 2000; i++) {
    const t = (i / 2000) * Math.PI * 2;
    const x = 16 * Math.pow(Math.sin(t), 3) / 34, y = (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t) - cy) / 34;
    const a = Math.atan2(y, x), r = Math.hypot(x, y), k = Math.floor(((a + Math.PI) / (Math.PI * 2)) * N) % N;
    tab[k] = Math.max(tab[k], r);
  }
  for (let k = 0; k < N; k++) if (!tab[k]) tab[k] = tab[(k + N - 1) % N];
  return a => tab[Math.floor(((a + Math.PI) / (Math.PI * 2)) * N) % N];
}

export function build(params, ctx) {
  const made = [], keep = x => { made.push(x); return x; };
  const group = new THREE.Group(), beatGroup = new THREE.Group(); group.add(beatGroup);
  const radius = outlineTable();
  const geo = keep(new THREE.SphereGeometry(1, 72, 56)), pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), q = Math.hypot(x, y);
    const a = Math.atan2(y, x), r = radius(a) * q;
    const bulge = 0.62 + 0.18 * Math.max(0, y);                  // fatter toward the top (the atria), slimmer at the tip
    pos.setXYZ(i, Math.cos(a) * r, Math.sin(a) * r + 0.03, z * 0.2 * bulge * (q > 0.01 ? 1 : 1) * 1.6);
  }
  geo.computeVertexNormals();
  const body = new THREE.Mesh(geo, keep(ctx.mat.solid(ctx.color(params.color), { rough: 0.35, rim: 0.35 })));
  beatGroup.add(body);

  // Vessels: tubes leaving the top. Fixed red/blue (not tinted by the colour param).
  const red = keep(ctx.mat.solid(0xd2323f, { rough: 0.4, main: false })), blue = keep(ctx.mat.solid(0x4b6fd8, { rough: 0.4, main: false }));
  const tube = (pts, r, mat) => {
    const m = new THREE.Mesh(keep(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))), 32, r, 14)), mat);
    beatGroup.add(m); return m;
  };
  tube([[0.02, 0.2, 0.0], [0.04, 0.42, 0.02], [-0.04, 0.6, 0.0], [-0.2, 0.62, -0.04], [-0.3, 0.45, -0.06]], 0.07, red);       // aorta arch
  tube([[0.08, 0.25, 0.12], [0.16, 0.45, 0.14], [0.3, 0.6, 0.1]], 0.058, blue);                                                // pulmonary artery
  tube([[0.22, 0.2, -0.05], [0.28, 0.4, -0.08], [0.3, 0.62, -0.08]], 0.05, blue);                                             // vena cava (up)
  tube([[0.24, -0.05, -0.05], [0.3, -0.3, -0.08], [0.28, -0.45, -0.08]], 0.045, blue);                                          // vena cava (down)
  beatGroup.rotation.z = 0.35;      // the apex points down and to the side, like a real heart

  const bounds = new THREE.Box3(new THREE.Vector3(-0.5, -0.5, -0.25), new THREE.Vector3(0.5, 0.55, 0.25));
  const pulse = p => Math.exp(-(((p - 0.08) / 0.055) ** 2)) + 0.65 * Math.exp(-(((p - 0.3) / 0.07) ** 2));   // lub, then dub
  return {
    object: group,
    bounds,
    update(t, state) {
      const bps = (40 + 140 * state.params.rate) / 60, ph = (t * bps) % 1;
      const s = 1 + 0.085 * pulse(ph);
      beatGroup.scale.set(s, s, s * (1 + 0.5 * (s - 1)));
    },
    dispose() { for (const x of made) x.dispose(); },
  };
}
