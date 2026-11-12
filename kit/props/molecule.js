// Prop: molecule. Ball-and-stick molecules in standard element colours (H white, O red, C dark grey, N blue,
// Na purple, Cl green). Param "formula" picks which. Wobbles gently. Exports: meta, build(params, ctx).

import * as THREE from 'three';

export const meta = {
  name: 'molecule',
  summary: 'A ball-and-stick molecule: h2o, co2, o2, n2, ch4, o3, or a nacl salt crystal chunk. Gentle wobble.',
  tags: ['science'],
  floats: true,
  params: {
    formula: { type: 'enum', values: ['h2o', 'co2', 'o2', 'n2', 'ch4', 'nacl', 'o3'], default: 'h2o', doc: 'which molecule' },
  },
  animatable: {},
};

// Element: colour and ball radius (chunky, toy-like).
const EL = {
  H: { color: 0xf4f4f4, r: 0.13 }, O: { color: 0xff4040, r: 0.2 }, C: { color: 0x4a4f5a, r: 0.19 },
  N: { color: 0x3d6dff, r: 0.19 }, Na: { color: 0xa35bff, r: 0.22 }, Cl: { color: 0x3fd35c, r: 0.27 },
};

const tet = v => new THREE.Vector3(...v).normalize().multiplyScalar(0.55);
// Each formula: atoms [element, [x,y,z]] and bonds [a, b, order].
function layout(formula) {
  if (formula === 'h2o') {
    const a = 52.25 * Math.PI / 180, L = 0.5;
    return { atoms: [['O', [0, 0.1, 0]], ['H', [-Math.sin(a) * L, 0.1 - Math.cos(a) * L, 0]], ['H', [Math.sin(a) * L, 0.1 - Math.cos(a) * L, 0]]], bonds: [[0, 1, 1], [0, 2, 1]] };
  }
  if (formula === 'co2') return { atoms: [['C', [0, 0, 0]], ['O', [-0.62, 0, 0]], ['O', [0.62, 0, 0]]], bonds: [[0, 1, 2], [0, 2, 2]] };
  if (formula === 'o2') return { atoms: [['O', [-0.3, 0, 0]], ['O', [0.3, 0, 0]]], bonds: [[0, 1, 2]] };
  if (formula === 'n2') return { atoms: [['N', [-0.28, 0, 0]], ['N', [0.28, 0, 0]]], bonds: [[0, 1, 3]] };
  if (formula === 'o3') {
    const a = 58.5 * Math.PI / 180, L = 0.55;
    return { atoms: [['O', [0, 0.15, 0]], ['O', [-Math.sin(a) * L, 0.15 - Math.cos(a) * L, 0]], ['O', [Math.sin(a) * L, 0.15 - Math.cos(a) * L, 0]]], bonds: [[0, 1, 2], [0, 2, 1]] };
  }
  if (formula === 'ch4') {
    const hs = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]].map(v => tet(v).toArray());
    return { atoms: [['C', [0, 0, 0]], ...hs.map(p => ['H', p])], bonds: [[0, 1, 1], [0, 2, 1], [0, 3, 1], [0, 4, 1]] };
  }
  // nacl: a 2x2x2 chunk of the salt lattice, ions alternate and touch (no sticks: ionic bonds are not drawn as sticks).
  const atoms = [], s = 0.5;
  for (let x = 0; x < 2; x++) for (let y = 0; y < 2; y++) for (let z = 0; z < 2; z++) {
    atoms.push([(x + y + z) % 2 ? 'Cl' : 'Na', [(x - 0.5) * s, (y - 0.5) * s, (z - 0.5) * s]]);
  }
  return { atoms, bonds: [] };
}

export function build(params, ctx) {
  const made = [], keep = x => { made.push(x); return x; };
  const group = new THREE.Group();
  const { atoms, bonds } = layout(params.formula);
  const sg = keep(new THREE.SphereGeometry(1, 32, 22));
  const mats = {};
  const matFor = e => mats[e] || (mats[e] = keep(ctx.mat.solid(EL[e].color, { rough: 0.3, rim: 0.3, main: false })));
  const P = atoms.map(([e, p]) => new THREE.Vector3(...p));
  atoms.forEach(([e], i) => {
    const m = new THREE.Mesh(sg, matFor(e));
    m.position.copy(P[i]); m.scale.setScalar(EL[e].r); group.add(m);
  });
  // Sticks: one cylinder per bond line; double and triple bonds are parallel sticks side by side.
  const stick = keep(new THREE.CylinderGeometry(1, 1, 1, 12));
  const stickMat = keep(ctx.mat.solid(0xd7dce6, { rough: 0.4, main: false }));
  for (const [a, b, order] of bonds) {
    const dir = P[b].clone().sub(P[a]), len = dir.length();
    const side = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 0, 1));
    if (side.lengthSq() < 1e-6) side.set(0, 1, 0);
    side.normalize();
    const r = order === 1 ? 0.045 : order === 2 ? 0.032 : 0.028, gap = order === 1 ? 0 : 0.085;
    for (let k = 0; k < order; k++) {
      const off = (k - (order - 1) / 2) * gap;
      const m = new THREE.Mesh(stick, stickMat);
      m.position.copy(P[a]).add(P[b]).multiplyScalar(0.5).addScaledVector(side, off);
      m.scale.set(r, len, r);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
      group.add(m);
    }
  }
  const root = new THREE.Group();
  root.add(group);
  return {
    object: root,
    update(t) {
      group.rotation.y = 0.45 * Math.sin(t * 0.7);
      group.rotation.x = 0.18 * Math.sin(t * 0.5 + 1);
      group.rotation.z = 0.06 * Math.sin(t * 0.9);
    },
    dispose() { for (const x of made) x.dispose(); },
  };
}
