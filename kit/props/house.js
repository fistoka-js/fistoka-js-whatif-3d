// Prop: house. A simple cosy house: walls, pitched roof, chimney, door and two windows.
// Exports: meta, build(params, ctx). The "color" param is the wall colour (the colour action tints the walls).

import * as THREE from 'three';

export const meta = {
  name: 'house',
  summary: 'A simple low-poly house with roof, chimney, door and windows. For homes, energy, insulation, neighbourhoods.',
  tags: ['place', 'building'],
  floats: false,
  params: {
    color: { type: 'color', default: '#f4e3c3', doc: 'wall colour' },
    roof: { type: 'color', default: '#d6513f', doc: 'roof colour' },
  },
  animatable: { glow: { min: 0, max: 1, default: 0, doc: 'warm light in the windows (0 = off)' } },
};

export function build(params, ctx) {
  const group = new THREE.Group(), geos = [], mats = [];
  const solid = (c, o = {}) => { const m = ctx.mat.solid(c, { main: false, rough: 0.75, ...o }); mats.push(m); return m; };
  const add = (g, m, x, y, z) => { geos.push(g); const o = new THREE.Mesh(g, m); o.position.set(x, y, z); group.add(o); return o; };
  const W = 0.62, H = 0.38, D = 0.46;
  const wall = ctx.mat.solid(ctx.color(params.color), { rough: 0.85 }); mats.push(wall);
  add(new THREE.BoxGeometry(0.8, 0.04, 0.64), solid(0x9aa0a8), 0, 0.02, 0.02); // base slab
  add(new THREE.BoxGeometry(W, H, D), wall, 0, 0.04 + H / 2, 0);
  // Roof: a triangle prism, a bit wider than the walls, with a thin darker ridge cap.
  const shape = new THREE.Shape([new THREE.Vector2(-W / 2 - 0.06, 0), new THREE.Vector2(W / 2 + 0.06, 0), new THREE.Vector2(0, 0.27)]);
  const roofGeo = new THREE.ExtrudeGeometry(shape, { depth: D + 0.1, bevelEnabled: false });
  roofGeo.translate(0, 0, -(D + 0.1) / 2);
  add(roofGeo, solid(ctx.color(params.roof), { flat: true, rough: 0.7 }), 0, 0.04 + H, 0);
  add(new THREE.BoxGeometry(0.07, 0.17, 0.07), solid(0xa5593f), 0.17, 0.04 + H + 0.14, -0.08); // chimney
  add(new THREE.BoxGeometry(0.09, 0.02, 0.09), solid(0x5a4038), 0.17, 0.04 + H + 0.235, -0.08);
  // Door and windows on the front (+z).
  const front = D / 2;
  add(new THREE.BoxGeometry(0.11, 0.2, 0.02), solid(0x7a4a2e), -0.05, 0.04 + 0.1, front + 0.008);
  add(new THREE.SphereGeometry(0.009, 8, 6), solid(0xf2c04a, { metal: 0.6 }), -0.02, 0.04 + 0.1, front + 0.02);
  add(new THREE.BoxGeometry(0.16, 0.025, 0.1), solid(0xb0b6bc), -0.05, 0.05, front + 0.05); // step
  const glass = new THREE.MeshStandardMaterial({ color: 0x9fd4ff, emissive: 0xffc860, emissiveIntensity: 0, roughness: 0.15 });
  mats.push(glass);
  const frame = solid(0xffffff);
  for (const x of [-0.22, 0.17]) {
    add(new THREE.BoxGeometry(0.13, 0.12, 0.02), frame, x, 0.04 + 0.22, front + 0.004);
    add(new THREE.BoxGeometry(0.1, 0.09, 0.02), glass, x, 0.04 + 0.22, front + 0.012);
    add(new THREE.BoxGeometry(0.1, 0.012, 0.03), frame, x, 0.04 + 0.22, front + 0.016);
  }
  add(new THREE.BoxGeometry(0.012, 0.09, 0.03), frame, -0.22, 0.04 + 0.22, front + 0.016);
  add(new THREE.BoxGeometry(0.012, 0.09, 0.03), frame, 0.17, 0.04 + 0.22, front + 0.016);
  return {
    object: group,
    update(t, state) {
      const g = state.params.glow;
      glass.emissiveIntensity = g * (1.4 + 0.05 * Math.sin(t * 3));
      glass.color.setHex(0x9fd4ff).lerp(new THREE.Color(0xffd070), g);
    },
    dispose() { geos.forEach(g => g.dispose()); mats.forEach(m => m.dispose()); },
  };
}
