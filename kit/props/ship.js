// Prop: ship. A chunky cargo ship (containers, bridge, funnel) or a sailing ship (masts and sails) on a slab of water.
// Exports: meta, build(params, ctx). Bow points +x. The hull rocks gently on the water. Colour = upper hull.

import * as THREE from 'three';
import { rbox, kit } from './lib/machines.js';

export const meta = {
  name: 'ship',
  summary: 'A toy cargo ship or sailing ship rocking on the water. For trade, oceans, shipping, exploration, sinking.',
  tags: ['machine', 'vehicle', 'sea'],
  floats: false,
  params: {
    color: { type: 'color', default: 'blue', doc: 'upper hull colour' },
    style: { type: 'enum', values: ['cargo', 'sail'], default: 'cargo', doc: 'cargo ship or sailing ship' },
  },
  animatable: {},
};

// Plan outline of the hull (x along the ship, y = side), pointed at the bow (+x).
function hullGeo(depth, grow = 1) {
  const s = new THREE.Shape(), w = 0.17 * grow, L = 0.5 * grow;
  s.moveTo(-L, -w); s.lineTo(0.15, -w); s.bezierCurveTo(0.35, -w, 0.48, -0.07, 0.56, 0);
  s.bezierCurveTo(0.48, 0.07, 0.35, w, 0.15, w); s.lineTo(-L, w); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2, curveSegments: 10 });
  g.translate(0, 0, depth / 2); g.rotateX(-Math.PI / 2);   // plan -> floor plan, extrusion -> up
  return g;
}

export function build(params, ctx) {
  const k = kit(ctx), group = new THREE.Group(), boat = new THREE.Group();
  group.add(boat);
  const upper = k.main(ctx.color(params.color), { rough: 0.45 });
  const lower = k.mat(0x8c2f2f, { rough: 0.6 });
  const white = k.mat(0xf1f3f6, { rough: 0.5 });
  const dark = k.mat(0x2a3140, { rough: 0.4 });
  const wood = k.mat(0x8a5a36, { rough: 0.7 });
  const m = (g, mt, x, y, z) => k.mesh(g, mt, x, y, z, boat);

  // Water: a slab of translucent blue under the ship, so the hull sits in something.
  const water = k.mat(0x2f9be0, { rough: 0.15, rim: 0.5, transparent: true, opacity: 0.9 });
  k.mesh(new THREE.CylinderGeometry(0.66, 0.66, 0.1, 48), water, 0.03, 0.0, 0, group);

  m(hullGeo(0.09, 0.95), lower, 0, 0.0, 0);
  m(hullGeo(0.1, 1), upper, 0, 0.09, 0);
  m(rbox(0.9, 0.012, 0.3, 0.005), white, -0.02, 0.2, 0).scale.set(1, 1, 1);   // deck line
  if (params.style === 'cargo') {
    const cols = [0xe2552f, 0x2f7fd6, 0xf2b630, 0x3aa86a, 0xd9dde3];
    for (let i = 0; i < 5; i++) for (const s of [-1, 1]) {
      const h = (i + (s > 0 ? 1 : 0)) % 3 === 0 ? 2 : 1;
      for (let j = 0; j < h; j++) m(rbox(0.13, 0.07, 0.115, 0.012), k.mat(cols[Math.floor(ctx.rng() * cols.length)], { rough: 0.6 }), -0.14 + i * 0.145, 0.24 + j * 0.075, s * 0.063);
    }
    m(rbox(0.15, 0.2, 0.27, 0.03), white, -0.38, 0.31, 0);
    m(rbox(0.16, 0.03, 0.29, 0.015), upper, -0.38, 0.43, 0);
    m(rbox(0.01, 0.045, 0.21, 0.01), dark, -0.3, 0.37, 0);
    const f = m(new THREE.CylinderGeometry(0.035, 0.04, 0.12, 16), upper, -0.42, 0.5, 0);
    m(new THREE.CylinderGeometry(0.037, 0.037, 0.03, 16), dark, -0.42, 0.55, 0);
    f.rotation.z = 0.0;
  } else {
    m(rbox(0.2, 0.08, 0.3, 0.03), wood, -0.35, 0.25, 0);
    const cloth = k.raw(new THREE.MeshStandardMaterial({ color: 0xf6ead0, roughness: 0.8, side: THREE.DoubleSide }));
    for (const [x, h, sw] of [[0.2, 0.78, 0.34], [-0.12, 0.9, 0.38]]) {
      m(new THREE.CylinderGeometry(0.014, 0.018, h, 8), wood, x, 0.2 + h / 2, 0);
      m(new THREE.CylinderGeometry(0.01, 0.01, sw + 0.04, 8), wood, x + 0.01, 0.2 + h * 0.9, 0).rotation.x = Math.PI / 2;
      const sail = new THREE.PlaneGeometry(sw, h * 0.7, 8, 8);
      const p = sail.attributes.position;
      for (let i = 0; i < p.count; i++) { const u = p.getX(i) / (sw / 2), v = (p.getY(i) / (h * 0.35) + 1) / 2; p.setZ(i, 0.07 * (1 - u * u) * Math.sin(Math.PI * Math.min(1, v * 0.9 + 0.1))); }
      sail.computeVertexNormals(); sail.rotateY(Math.PI / 2);
      m(sail, cloth, x + 0.015, 0.2 + h * 0.5 - 0.0, 0);
    }
    const flag = new THREE.Shape(); flag.moveTo(0, 0); flag.lineTo(-0.12, 0.03); flag.lineTo(0, 0.06); flag.closePath();
    m(new THREE.ShapeGeometry(flag), k.raw(new THREE.MeshStandardMaterial({ color: 0xe84a3a, side: THREE.DoubleSide })), -0.12, 1.07, 0);
    const bow = m(new THREE.CylinderGeometry(0.01, 0.014, 0.25, 8), wood, 0.58, 0.28, 0); bow.rotation.z = -1.2;
  }
  return {
    object: group,
    update(t) {
      boat.rotation.x = 0.05 * Math.sin(t * 1.2);
      boat.rotation.z = 0.035 * Math.sin(t * 0.9 + 1.3);
      boat.position.y = 0.012 * Math.sin(t * 1.5);
    },
    dispose() { k.dispose(); },
  };
}
