// Prop: haze. A soft, see-through cloud of dust, smoke or ash: overlapping fuzzy puffs that slowly swirl and thin out.
// Exports: meta, build(params, ctx). Positions are a pure function of t (seeded start places + slow swirl).
// For things you see as a cloud, not as dots: dust after an impact, smoke, ash, fog, steam. (Tiny things: use particles.)

import * as THREE from 'three';

export const meta = {
  name: 'haze',
  summary: 'A soft translucent puff cloud: dust, smoke, ash, fog. Animate density to thicken or thin it, spread to billow out.',
  notes: 'Use this for dust, smoke, ash, steam and fog (shaded puffs); particles are for tiny things only. Place it at the thing that is dusty or smoking (at = the cloud centre, size about 1.5-2.5 covers a house or planet; it floats there and hides what it covers at high density). Animate density 0 -> 0.7 for it to build up, back to 0 to clear.',
  tags: ['nature', 'weather', 'effect'],
  floats: true,
  params: {
    count: { type: 'int', min: 4, max: 120, default: 36, doc: 'how many overlapping puffs' },
    color: { type: 'color', default: '#b9ad9a', doc: 'colour of the dust or smoke (light grey-brown dust by default; dark grey for smoke, white for steam)' },
    puff: { type: 'number', min: 0.1, max: 0.8, default: 0.4, doc: 'size of one puff (fraction of the cloud)' },
    rise: { type: 'number', min: 0, max: 1, default: 0.15, doc: 'how much the cloud drifts upward (0 = hangs, 1 = billows up)' },
  },
  animatable: {
    density: { min: 0, max: 1, default: 0.6, doc: 'how thick (0 = clear, 1 = nearly opaque)' },
    spread: { min: 0.1, max: 3, default: 1, doc: 'how widely the cloud is spread (1 = fills its box)' },
    drift: { min: 0, max: 2, default: 0.3, doc: 'how fast it swirls' },
  },
};

// Three puff pictures: a soft, wispy blob (round falloff broken up by smooth noise, feathered to nothing at the rim) with a
// faint top-left light, so overlapping puffs blend into one dust or smoke cloud instead of reading as separate balls.
const TEX = [];
function puffTexture(k) {
  if (TEX[k]) return TEX[k];
  const n = 128, data = new Uint8Array(n * n * 4);
  const h = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7 + k * 17.3) * 43758.5453; return s - Math.floor(s); };
  const noise = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    return (h(xi, yi) * (1 - u) + h(xi + 1, yi) * u) * (1 - v) + (h(xi, yi + 1) * (1 - u) + h(xi + 1, yi + 1) * u) * v;
  };
  const fbm = (x, y) => 0.55 * noise(x * 2.2, y * 2.2) + 0.3 * noise(x * 4.7 + 9, y * 4.7 + 3) + 0.15 * noise(x * 10 + 5, y * 10 + 1);
  // density of the puff at a point: a round falloff times noise, so the edge is ragged and feathered
  const field = (x, y) => {
    const d = Math.hypot(x, y), f = Math.max(0, 1 - d / 0.98), body = f * f * (3 - 2 * f);
    return body * (0.35 + 1.1 * fbm(x, y));
  };
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const px = (x + 0.5) / n * 2 - 1, py = 1 - (y + 0.5) / n * 2, e = 0.03;
    const f = field(px, py), gx = (field(px + e, py) - field(px - e, py)) / (2 * e), gy = (field(px, py + e) - field(px, py - e)) / (2 * e);
    const lit = Math.max(-1, Math.min(1, -0.4 * gx + 0.4 * gy));   // light from the top left
    const shade = Math.max(0.6, Math.min(1, 0.85 + 0.15 * lit));
    const a = Math.min(1, f * 2.2);
    const i = 4 * (y * n + x);
    data[i] = data[i + 1] = data[i + 2] = Math.round(shade * 255); data[i + 3] = Math.round(a * 255);
  }
  const t = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.needsUpdate = true;
  return (TEX[k] = t);
}

export function build(params, ctx) {
  const n = params.count, rng = ctx.rng, base = new THREE.Color(ctx.color(params.color));
  // Three materials (one per puff picture) shared by all puffs: variety without 100 materials.
  const mats = [0, 1, 2].map(i => new THREE.SpriteMaterial({ map: puffTexture(i), color: base.clone(), transparent: true, depthWrite: false, toneMapped: false }));
  mats.forEach(m => { m.userData.main = false; });
  const group = new THREE.Group(), puffs = [];
  for (let i = 0; i < n; i++) {
    // start place: inside a soft ball (denser in the middle), a little flat so it reads as a ground cloud
    const d = [rng() - 0.5, rng() - 0.5, rng() - 0.5], len = Math.hypot(...d) || 1, r = Math.pow(rng(), 0.6) * 0.45;
    const s = new THREE.Sprite(mats[i % 3]);
    group.add(s);
    puffs.push({ s, p: [d[0] / len * r, d[1] / len * r * 0.8, d[2] / len * r], ph: rng() * 6.28, size: 0.6 + 0.8 * rng(), sp: 0.6 + 0.8 * rng() });
  }
  const bound = 0.5 + params.puff * 0.3;   // fixed box: the cloud at spread 1 plus its puffs' soft edges
  function update(t, state) {
    const { density, spread, drift } = state.params, k = state.opacity;
    group.visible = density > 0.005 && k > 0.005;
    for (const m of mats) m.opacity = Math.min(1, density) * 0.95 * k;
    for (const { s, p, ph, size, sp } of puffs) {
      const a = t * drift * sp * 0.8 + ph;
      const up = params.rise * (0.1 * (0.5 + 0.5 * Math.sin(a * 0.5 + ph)) + 0.03 * Math.min(t, 6));
      s.position.set(p[0] * spread + 0.05 * Math.sin(a), p[1] * spread + 0.04 * Math.sin(a * 1.3 + 1) + up, p[2] * spread + 0.05 * Math.cos(a * 0.9));
      s.scale.setScalar(1.35 * params.puff * size * (0.9 + 0.1 * Math.sin(a * 1.7)) * (0.7 + 0.3 * Math.min(spread, 1.5)));
    }
  }
  update(0, { opacity: 1, params: { density: 0.6, spread: 1, drift: 0 } });
  return {
    object: group,
    bounds: new THREE.Box3(new THREE.Vector3(-bound, -bound, -bound), new THREE.Vector3(bound, bound, bound)),
    update,
    // "color" action: the whole cloud takes the colour
    setColor(hex) { base.setHex(hex); mats.forEach(m => m.color.copy(base)); },
    dispose() { mats.forEach(m => m.dispose()); },
  };
}
