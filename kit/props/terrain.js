// Prop: terrain. A square diorama slab of ground with gentle hills and a visible soil cross-section edge.
// Exports: meta, build(params, ctx). Styles: grass, desert, ice, rock, ocean (waves over a seabed). A base to stand props on.
// The top is a grid of faces painted by height; the four sides are coloured layers (topsoil, subsoil, rock).

import * as THREE from 'three';
import { facetMat, paint } from './lib/facets.js';
import { fbm, hash } from './lib/noise.js';

export const meta = {
  name: 'terrain',
  summary: 'A square slab of land with hills and a soil cross-section: grass, desert, ice, rock or ocean. A base for other props.',
  tags: ['nature', 'earth', 'place'],
  floats: false,
  params: {
    style: { type: 'enum', values: ['grass', 'desert', 'ice', 'rock', 'ocean'], default: 'grass', doc: 'surface; ocean = waves over a seabed' },
    seed: { type: 'int', min: 0, max: 999, default: 1, doc: 'which landscape' },
  },
  animatable: {},
};

const N = 20, BOTTOM = -0.3, WATER = 0.1;
// Per style: top colours (low, high), layer colours (topsoil, subsoil, rock), hill height, base level, rough.
const STYLE = {
  grass: { low: 0x4fae45, high: 0x86cf55, layers: [0x6b4a32, 0x8a6444, 0x78746f], amp: 0.1, base: 0.06, oct: 3 },
  desert: { low: 0xe0b76a, high: 0xf3d792, layers: [0xd9a85f, 0xc4894a, 0x9a6a3d], amp: 0.12, base: 0.05, oct: 2 },
  ice: { low: 0xdcecf8, high: 0xffffff, layers: [0xeaf6ff, 0xbfe0f4, 0x8ec3e6], amp: 0.09, base: 0.06, oct: 3 },
  rock: { low: 0x77726d, high: 0xa09b94, layers: [0x6c6762, 0x57534f, 0x45423f], amp: 0.2, base: 0.06, oct: 4 },
  ocean: { low: 0xd8bd86, high: 0xeed7a0, layers: [0xc9a76c, 0x9a7a52, 0x6b5a48], amp: 0.07, base: -0.12, oct: 3 },
};

export function build(params, ctx) {
  const st = STYLE[params.style], ocean = params.style === 'ocean', seed = params.seed + 1;
  const group = new THREE.Group(), geos = [], mats = [];
  const h = (x, z) => { // height of the ground at (x, z)
    let v = (fbm(seed, x * 2.2 + 5, 0, z * 2.2 + 5, st.oct) - 0.5) * 2 * st.amp + st.base;
    if (params.style === 'desert') v += 0.03 * Math.sin(x * 9 + 3 * fbm(seed + 3, x * 2, 0, z * 2, 2));
    return v;
  };

  // Top surface.
  const top = new THREE.PlaneGeometry(1, 1, N, N); top.rotateX(-Math.PI / 2);
  const pos = top.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, h(pos.getX(i), pos.getZ(i)));
  const lo = st.base - st.amp, span = st.amp * 2, cLow = new THREE.Color(st.low), cHigh = new THREE.Color(st.high), rockC = new THREE.Color(st.layers[2]);
  const topMesh = new THREE.Mesh(paint(top, f => {
    const k = Math.min(1, Math.max(0, (f.y - lo) / span));
    const c = cLow.clone().lerp(cHigh, k).multiplyScalar(0.9 + 0.2 * hash(f.i * 1.3 + seed));
    if (params.style === 'grass' && f.ny < 0.9) c.lerp(new THREE.Color(0x8a6b4a), (0.9 - f.ny) * 2.5); // steep bits show soil
    if (params.style === 'rock' && f.ny < 0.8) c.lerp(rockC, 0.4);
    return c;
  }), facetMat(ctx, { rough: params.style === 'ice' ? 0.25 : 0.9, rim: 0.2 }));
  mats.push(topMesh.material); geos.push(topMesh.geometry); group.add(topMesh);

  // Sides: four walls, each a strip of quads per layer.
  const P = [], C = [], col = new THREE.Color();
  const edges = [[-0.5, -0.5, 1, 0, 0, -1], [0.5, -0.5, 0, 1, 1, 0], [0.5, 0.5, -1, 0, 0, 1], [-0.5, 0.5, 0, -1, -1, 0]]; // start, step, outward
  // y of each layer boundary for a column of height hh: topsoil, subsoil, rock, bottom
  const bounds = hh => { const b1 = hh - 0.06; return [hh, b1, Math.min(b1 - 0.02, ocean ? -0.2 : -0.1), BOTTOM]; };
  for (const [sx, sz, dx, dz, ox, oz] of edges) {
    for (let i = 0; i < N; i++) {
      const ax = sx + dx * i / N, az = sz + dz * i / N, bx = sx + dx * (i + 1) / N, bz = sz + dz * (i + 1) / N;
      const ya = bounds(h(ax, az)), yb = bounds(h(bx, bz));
      for (let l = 0; l < 3; l++) {
        const q = [[ax, ya[l], az], [bx, yb[l], bz], [bx, yb[l + 1], bz], [ax, ya[l + 1], az]];
        // order so the face looks outward: check the winding against the outward direction
        const e1 = [q[1][0] - q[0][0], q[1][1] - q[0][1], q[1][2] - q[0][2]], e2 = [q[3][0] - q[0][0], q[3][1] - q[0][1], q[3][2] - q[0][2]];
        const nx = e1[1] * e2[2] - e1[2] * e2[1], nz = e1[0] * e2[1] - e1[1] * e2[0];
        const tri = nx * ox + nz * oz >= 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
        col.set(st.layers[l]).multiplyScalar(0.92 + 0.16 * hash(i * 3 + l * 7 + sx * 11 + seed));
        for (const v of tri) { P.push(...q[v]); C.push(col.r, col.g, col.b); }
      }
    }
  }
  const side = new THREE.BufferGeometry();
  side.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); side.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  side.computeVertexNormals();
  const sideMat = facetMat(ctx, { rough: 0.95, main: false }); mats.push(sideMat); geos.push(side);
  group.add(new THREE.Mesh(side, sideMat));
  // Bottom cap so the slab is solid when seen from below.
  const bot = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), sideMat); bot.rotation.x = Math.PI / 2; bot.position.y = BOTTOM; group.add(bot);
  const botGeo = bot.geometry; botGeo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(12).fill(0.4), 3)); geos.push(botGeo);

  // Ocean: a see-through water block with a wavy top sheet.
  let sheet = null, sp = null;
  if (ocean) {
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x2f9be0, transparent: true, opacity: 0.45, roughness: 0.1, depthWrite: false });
    wallMat.userData.main = false; mats.push(wallMat);
    const block = new THREE.Mesh(new THREE.BoxGeometry(1, WATER + 0.2 - 0.01, 1), wallMat); block.position.y = (WATER - 0.2 - 0.01) / 2 + 0.0; block.renderOrder = 3; group.add(block); geos.push(block.geometry);
    const sheetMat = new THREE.MeshStandardMaterial({ color: 0x3aa8f0, transparent: true, opacity: 0.6, roughness: 0.12, metalness: 0.1, depthWrite: false });
    sheetMat.userData.main = false; mats.push(sheetMat);
    sheet = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 24, 24), sheetMat); sheet.geometry.rotateX(-Math.PI / 2); sheet.renderOrder = 4;
    group.add(sheet); geos.push(sheet.geometry); sp = sheet.geometry.attributes.position;
  }
  const wave = (x, z, t) => 0.014 * Math.sin(x * 14 + t * 1.6) + 0.012 * Math.sin(z * 11 - t * 1.3 + x * 4) + 0.006 * Math.sin((x + z) * 23 + t * 2.4);
  function update(t) {
    if (!sheet) return;
    for (let i = 0; i < sp.count; i++) sp.setY(i, WATER + wave(sp.getX(i), sp.getZ(i), t));
    sp.needsUpdate = true; sheet.geometry.computeVertexNormals();
  }
  update(0);
  return { object: group, update, dispose() { geos.forEach(g => g.dispose()); mats.forEach(m => m.dispose()); } };
}
