// Prop: layer_stack. See-through slabs stacked up with dark name plates, pigment granules on one layer.
// Exports: meta, build(params, ctx). Ported from the approved chameleon video (old scenes/layer_stack.js): same slab size,
// colours, granule pads and name plates. Plates are drawn from a built-in 5x7 capital-letter font (lib/bitmapText.js).
// Layers are given as parallel lists (names, colors) because the show format has no list-of-objects type.

import * as THREE from 'three';
import { plateTexture } from './lib/bitmapText.js';

export const meta = {
  name: 'layer_stack',
  summary: 'Stacked see-through slabs with name plates; they slide in, granules spread, layers shade and glow. Skin, rock layers.',
  tags: ['science', 'mechanism'],
  floats: true,
  params: {
    names: { type: 'list', of: { type: 'string', max: 24 }, min: 2, max: 5, default: ['EPIDERMIS', 'PIGMENT CELLS', 'NANOCRYSTAL LAYER', 'DARK PIGMENT'], doc: 'layer names, top to bottom (plate text)' },
    colors: { type: 'list', of: { type: 'color' }, min: 2, max: 5, default: ['#8ee59a', '#e0a030', '#3fb5d6', '#3a2a22'], doc: 'layer colours, top to bottom' },
    pigment_layer: { type: 'int', min: 0, max: 4, default: 1, doc: 'layer (0 = top) with the granules' },
    crystal_layer: { type: 'int', min: -1, max: 4, default: 2, doc: 'layer with glowing crystal blocks (-1 = none)' },
  },
  animatable: {
    reveal: { min: 0, max: 1, default: 1, doc: 'slabs slide in one by one (0 = none, 1 = all)' },
    granules: { min: 0, max: 1, default: 0.3, doc: 'granules: 0 = together, 1 = spread' },
    shade: { min: 0, max: 1, default: 0, doc: 'pigment and top layers: 0 = light, 1 = dark' },
    focus: { min: -1, max: 4, default: -1, doc: 'layer (0 = top) that brightens while others dim; -1 = none' },
  },
};

const W = 3.4, GAP = 0.19, SLIDE = 5;   // slab width/depth, space between slabs, how far slabs slide in from
const clamp01 = x => Math.min(1, Math.max(0, x));
const hash = x => { const s = Math.sin(x * 12.9898) * 43758.5453; return s - Math.floor(s); };

export function build(params, ctx) {
  const n = Math.min(params.names.length, 5);
  const made = [], keep = x => { made.push(x); return x; };
  const group = new THREE.Group(), root = new THREE.Group();
  group.add(root);
  const col = i => ctx.color(params.colors[i % params.colors.length]);
  const th = () => 0.46, op = i => [0.3, 0.62, 0.55, 1, 1][i];   // slab height, and how see-through each is (top = glassy, bottom = solid)
  // Stack from the top; y is each slab's centre.
  const total = Array.from({ length: n }, (_, i) => th(i)).reduce((a, b) => a + b, 0) + GAP * (n - 1);
  let y = total / 2;
  const layers = [];
  for (let i = 0; i < n; i++) {
    const h = th(i); y -= h / 2;
    const geo = keep(new THREE.BoxGeometry(W, h, W));
    const base = new THREE.Color(col(i));
    const mat = keep(ctx.mat.solid(base, { rough: 0.4, rim: 0.3, main: false, transparent: op(i) < 1, opacity: op(i) }));
    mat.depthWrite = op(i) >= 1;
    const mesh = new THREE.Mesh(geo, mat); mesh.position.y = y; root.add(mesh);
    const edge = new THREE.LineSegments(keep(new THREE.EdgesGeometry(geo)), keep(new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 })));
    mesh.add(edge);
    const tex = keep(plateTexture(params.names[i]));
    const plate = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false })));
    plate.scale.set(1.5, 1.5 * 88 / 512, 1); plate.renderOrder = 21; plate.position.set(-0.7, y, W / 2 + 0.25); root.add(plate);
    layers.push({ i, h, y, base, mat, mesh, edge, plate, baseOp: op(i), edgeOp: 0.4, side: i % 2 ? -1 : 1 });
    y -= h / 2 + GAP;
  }

  // Pigment granules: nine round pads on the pigment layer, each with little dark and light grains.
  const pig = layers[Math.min(params.pigment_layer, n - 1)];
  const padMat = keep(ctx.mat.solid(0xb8741c, { rough: 0.6, main: false })), padGeo = keep(new THREE.CylinderGeometry(0.43, 0.43, 0.03, 28));
  const grainGeo = keep(new THREE.SphereGeometry(1, 12, 9));
  const grainMats = [keep(ctx.mat.solid(0x1c0f06, { rough: 0.5, main: false })), keep(ctx.mat.solid(0xf0cc40, { rough: 0.4, main: false }))];
  const topY = pig.h / 2 + 0.02, grains = [];
  for (let c = 0; c < 9; c++) {
    const cx = ((c % 3) - 1) * 1.05, cz = (Math.floor(c / 3) - 1) * 1.05;
    const pad = new THREE.Mesh(padGeo, padMat); pad.position.set(cx, topY - 0.005, cz); pig.mesh.add(pad);
    for (let g = 0; g < 22; g++) {
      const seed = c * 31 + g, rr = hash(seed + 0.5);
      const m = new THREE.Mesh(grainGeo, grainMats[hash(seed + 3) > 0.75 ? 1 : 0]); m.scale.setScalar(0.05); pig.mesh.add(m);
      grains.push({ m, ang: hash(seed) * 6.28, near: 0.04 + 0.07 * rr, far: 0.1 + 0.3 * Math.sqrt(rr), cx, cz, ph: hash(seed + 9) });
    }
  }
  // Small glowing crystal blocks inside the crystal layer.
  const cry = params.crystal_layer >= 0 ? layers[Math.min(params.crystal_layer, n - 1)] : null;
  const blocks = [];
  if (cry) {
    const bg = keep(new THREE.BoxGeometry(0.09, 0.09, 0.09)), bm = keep(new THREE.MeshStandardMaterial({ color: 0x8be8ff, emissive: 0x2fd0ff, emissiveIntensity: 0.9, roughness: 0.2 }));
    for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) {
      const m = new THREE.Mesh(bg, bm); m.position.set((i - 2.5) * 0.54, 0, (j - 2.5) * 0.54); cry.mesh.add(m); blocks.push(m);
    }
  }
  const dark = new THREE.Color(0x10281a), tmp = new THREE.Color();
  const bounds = new THREE.Box3(new THREE.Vector3(-W / 2, -total / 2, -W / 2), new THREE.Vector3(W / 2, total / 2, W / 2));

  return {
    object: group,
    bounds,
    update(t, state) {
      const p = state.params;
      root.rotation.y = 0.3 * Math.sin(t * 0.35);
      const dim = clamp01(p.focus + 1);   // 0 when no focus
      for (const L of layers) {
        // Slabs come in one after another: each gets its own slice of 0..1 reveal, with some overlap.
        const span = 1 / (1 + (n - 1) * 0.6), start = L.i * 0.6 * span;
        const u = clamp01((p.reveal - start) / span), e = u * u * (3 - 2 * u);
        L.mesh.visible = L.plate.visible = e > 0.001;
        L.mesh.position.x = (1 - e) * SLIDE * L.side; L.plate.position.x = L.mesh.position.x - 0.7;
        const w = clamp01(1 - Math.abs(p.focus - L.i)) * dim;   // how focused this layer is
        const k = e * state.opacity * (1 - 0.55 * dim * (1 - w));
        L.mat.opacity = L.baseOp * k; L.mat.transparent = L.baseOp < 1 || k < 0.999;
        L.edge.material.opacity = L.edgeOp * k;
        L.plate.material.opacity = e * (1 - 0.5 * dim * (1 - w)) * state.opacity;
        // Shade: the pigment and skin layers go darker; a focused layer glows in its own colour.
        const shadeAmt = L === pig ? 0.55 * p.shade : L.i === 0 ? 0.8 * p.shade : 0;
        tmp.copy(L.base).lerp(dark, shadeAmt); L.mat.color.copy(tmp);
        L.mat.emissive.copy(L.base).multiplyScalar(0.45 * w + (L === pig ? 0.08 * (0.7 + 0.3 * Math.sin(t * 5)) : 0));
        L.mat.emissiveIntensity = 1;
      }
      for (const g of grains) {
        const rad = g.near + (g.far - g.near) * p.granules + 0.012 * Math.sin(t * 3 + g.ph * 9);
        g.m.position.set(g.cx + Math.cos(g.ang) * rad, topY + 0.04, g.cz + Math.sin(g.ang) * rad);
      }
      blocks.forEach((m, i) => m.scale.setScalar(1 + 0.25 * Math.sin(t * 4 + i)));
    },
    dispose() { for (const x of made) x.dispose(); },
  };
}
