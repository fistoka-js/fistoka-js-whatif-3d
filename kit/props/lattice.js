// Prop: lattice. A 3D grid of crystal balls joined by faint lines (the chameleon's nanocrystal skin, a salt crystal, a metal).
// Exports: meta, build(params, ctx). Ported from the approved chameleon video (old scenes/lattice.js): same crystal
// shape, glow, joining lines and spacing range. Spacing 0 = tight block, 1 = spread wide; the box is sized for 1 (hex: its content rests on the bottom of the box).

import * as THREE from 'three';

export const meta = {
  name: 'lattice',
  summary: 'Glowing balls joined by faint lines, cubic grid or hexagonal rings. Animate spacing, shake, tilt. Crystals, solids, ice.',
  notes: 'arrangement "cubic" (default) is a square grid: salt, metals. Use "hex" for ice, snow, graphite and other hexagonal crystals (hexagon rings facing the camera, 2 layers, rods between the balls); on a ground the hex block stands on it at any spacing (cubic floats; put it up with "at").',
  tags: ['science', 'mechanism'],
  floatsNote: 'cubic floats; hex stands on the ground',
  floats: p => p.arrangement !== 'hex',   // a hex block stands on a ground (its box bottom rests on it, so it never dips into the floor); cubic floats as approved
  params: {
    arrangement: { type: 'enum', values: ['cubic', 'hex'], default: 'cubic', doc: 'cubic = square grid (salt, metal); hex = layered hexagon rings (ice, snow, graphite)' },
    count: { type: 'int', min: 3, max: 5, default: 4, doc: 'balls per side' },
    color: { type: 'color', default: '#35c6e8', doc: 'ball colour' },
  },
  animatable: {
    spacing: { min: 0, max: 1, default: 0.1, doc: 'gap: 0 tight block, 1 spread wide' },
    shake: { min: 0, max: 1, default: 0, doc: 'vibration (0 = still)' },
    tilt: { min: 0, max: 1, default: 0, doc: 'view: 0 three-quarter, 1 square-on' },
  },
};

const R = 0.2, SP_TIGHT = 0.52, SP_WIDE = 1.18;   // ball radius and spacing range, from the approved video
const HEX_TIGHT = 0.8, HEX_WIDE = 1.2;   // hex bond length (model units) at spacing 0 and 1: long enough that rods and rings read
const HEX_X0 = 1.4;   // hex layer axis points at the camera (1.57 = rings exactly face it), a little tilted
const hash = x => { const s = Math.sin(x * 12.9898) * 43758.5453; return s - Math.floor(s); };   // pure 0..1 noise

// Atom places in units of one bond/grid step, plus the pairs joined by a line. cubic: N x N x N grid.
// hex: 2 layers of puckered honeycomb (each ring has atoms alternately up and down); odd layers are flipped so every
// atom also bonds straight up or down to the next layer (the eclipsed ring stacking of ordinary ice).
export function arrange(arrangement, N) {
  const atoms = [], pairs = [], at = new Map();
  const add = (key, x, y, z) => { at.set(key, atoms.length); atoms.push([x, y, z]); };
  const link = (ka, kb) => { if (at.has(ka) && at.has(kb)) pairs.push([at.get(ka), at.get(kb)]); };
  if (arrangement === 'hex') {
    const M = N - 1, L = 2, A = Math.sqrt(3), P = 0.16, H = 1 + 2 * P;   // cells per side; layers (2 keeps the rings readable); ring lattice constant; pucker; layer height
    for (let l = 0; l < L; l++) for (let i = 0; i < M; i++) for (let j = 0; j < M; j++) {
      const x = A * (i + 0.5 * j), z = A * 0.5 * Math.sqrt(3) * j, up = l % 2 ? -1 : 1;   // lattice point of cell (i, j)
      add(`a${l},${i},${j}`, x, l * H + up * P, z);
      add(`b${l},${i},${j}`, x + A * 0.5, l * H - up * P, z + 0.5);
    }
    for (let l = 0; l < L; l++) for (let i = 0; i < M; i++) for (let j = 0; j < M; j++) {
      const a = `a${l},${i},${j}`;
      link(a, `b${l},${i},${j}`); link(a, `b${l},${i - 1},${j}`); link(a, `b${l},${i},${j - 1}`);
      if (l + 1 < L) link(l % 2 ? `b${l},${i},${j}` : a, l % 2 ? `b${l + 1},${i},${j}` : `a${l + 1},${i},${j}`);
    }
  } else {
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) for (let k = 0; k < N; k++) add(`${i},${j},${k}`, i, j, k);
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) for (let k = 0; k < N; k++) {
      link(`${i},${j},${k}`, `${i + 1},${j},${k}`); link(`${i},${j},${k}`, `${i},${j + 1},${k}`); link(`${i},${j},${k}`, `${i},${j},${k + 1}`);
    }
  }
  // centre on the middle of the box so tilt turns it about its own centre
  const lo = [0, 1, 2].map(q => Math.min(...atoms.map(a => a[q]))), hi = [0, 1, 2].map(q => Math.max(...atoms.map(a => a[q])));
  for (const a of atoms) for (let q = 0; q < 3; q++) a[q] -= (lo[q] + hi[q]) / 2;
  return { atoms, pairs };
}

export function build(params, ctx) {
  const N = params.count, half = (N - 1) / 2, hex = params.arrangement === 'hex';
  const { atoms, pairs } = arrange(params.arrangement, N);
  // hex: the honeycomb faces the camera (layers stack away from it), so the rings read from the front
  const unit = hex ? 0.9 : 1, rad = hex ? 0.7 : 1;   // smaller hex balls leave room for the rods
  const ballGeo = new THREE.IcosahedronGeometry(R, 1);
  const ballMat = ctx.mat.solid(ctx.color(params.color), { rough: 0.4, metal: 0.2, flat: true, emissive: 0.4, rim: 0.4 });
  const lineMat = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.45, toneMapped: false });
  // hex bonds are drawn as solid rods (a 1 px line vanishes at video size)
  const rodGeo = new THREE.CylinderGeometry(0.05, 0.05, 1, 6), rodMat = new THREE.MeshBasicMaterial({ toneMapped: false, transparent: true, opacity: 0.95 });
  const group = new THREE.Group(), turn = new THREE.Group();   // turn = the whole grid, turned by "tilt"
  group.add(turn);
  const balls = atoms.map((base, idx) => { const m = new THREE.Mesh(ballGeo, ballMat); turn.add(m); return { m, base, idx }; });
  const rods = new THREE.Group(); turn.add(rods);
  const rodList = hex ? pairs.map(([a, b]) => { const m = new THREE.Mesh(rodGeo, rodMat); rods.add(m); return { m, a, b }; }) : [];
  const arr = new Float32Array(pairs.length * 6), lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  const lines = new THREE.LineSegments(lineGeo, lineMat); lines.frustumCulled = false; if (!hex) turn.add(lines);
  // Fixed box big enough for the widest, most turned state, so a tight lattice is a smaller block (as in the video).
  const reach = Math.max(...atoms.map(a => Math.hypot(...a))) * (hex ? HEX_WIDE : SP_WIDE * unit);
  const e = hex ? reach + R + 0.1 : (N - 1) / 2 * SP_WIDE + R + 0.1, ex = hex ? e : e * 1.2;
  // hex: the turned block is flat, so the box height is the real height of its widest, most turned state (not a cube),
  // or the block would hover above its shadow when it stands on the ground.
  let ey = e * 1.05;
  if (hex) {
    const v = new THREE.Vector3(), eu = new THREE.Euler();
    ey = 0;
    for (const tilt of [0, 0.5, 1]) {
      eu.set(HEX_X0 + 0.15 * tilt, 0.3 * (1 - tilt), 0);
      for (const a of atoms) ey = Math.max(ey, Math.abs(v.set(...a).multiplyScalar(HEX_WIDE).applyEuler(eu).y));
    }
    ey += R * rad * (1 + 0.1 * 1) + 0.01;   // ball radius, with its small pulse
  }
  const bounds = new THREE.Box3(new THREE.Vector3(-ex, -ey, -ex), new THREE.Vector3(ex, ey, ex));
  const glow = ctx.mat.glowSprite(ctx.color(params.color), hex ? e * 2.2 : half * SP_WIDE * 2.6, 0.18);
  group.add(glow);
  const tint = new THREE.Color(), white = new THREE.Color(1, 1, 1);
  const pos = [], va = new THREE.Vector3(), vb = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);

  return {
    object: group,
    bounds,
    update(t, state) {
      const step = hex ? HEX_TIGHT + (HEX_WIDE - HEX_TIGHT) * state.params.spacing : (SP_TIGHT + (SP_WIDE - SP_TIGHT) * state.params.spacing) * unit, sh = state.params.shake;
      if (hex) turn.rotation.set(HEX_X0 + 0.15 * state.params.tilt, 0.3 * (1 - state.params.tilt), 0);
      else turn.rotation.set(0.32 - 0.12 * state.params.tilt, 0.75 * (1 - state.params.tilt), 0);
      pos.length = 0;
      balls.forEach(b => {
        const jx = sh * 0.11 * (hash(b.idx + Math.floor(t * 24) * 1.7) - 0.5), jy = sh * 0.11 * (hash(b.idx + 70 + Math.floor(t * 24) * 1.3) - 0.5);
        const [bx, by, bz] = b.base, i = bx + half, j = by + half, k = bz + half;   // (i, j, k) = grid number, as before
        const x = bx * step + 0.03 * Math.sin(t * 2 + i * 1.3 + j) + jx;
        const y = by * step + 0.03 * Math.sin(t * 2.2 + j * 1.1 + k) + jy;
        const z = bz * step + 0.03 * Math.sin(t * 1.9 + k * 1.7 + i);
        b.m.position.set(x, y, z);
        b.m.scale.setScalar(rad * (1 + 0.1 * Math.sin(t * 3 + b.idx)));
        pos.push(x, y, z);
      });
      pairs.forEach(([a, b], n) => { for (let q = 0; q < 3; q++) { arr[n * 6 + q] = pos[a * 3 + q]; arr[n * 6 + 3 + q] = pos[b * 3 + q]; } });
      lineGeo.attributes.position.needsUpdate = true;
      for (const { m, a, b } of rodList) {
        va.set(pos[a * 3], pos[a * 3 + 1], pos[a * 3 + 2]); vb.set(pos[b * 3], pos[b * 3 + 1], pos[b * 3 + 2]);
        vb.sub(va); const len = vb.length();
        m.position.copy(va).addScaledVector(vb, 0.5); m.quaternion.setFromUnitVectors(Y, vb.divideScalar(len || 1)); m.scale.set(1, len, 1);
      }
      if (hex) {
        // The box is sized for spacing 1; a tighter block rests on the bottom of the box, so on a ground it stands on it.
        let low = Infinity;
        for (const a of atoms) low = Math.min(low, va.set(...a).multiplyScalar(step).applyEuler(turn.rotation).y);
        turn.position.y = glow.position.y = -ey - (low - R * rad * 1.1 - 0.01);
      }
      glow.material.opacity = 0.18 * state.opacity;
    },
    // The colour hook: balls and glow take the colour, the joining lines a lighter version of it.
    setColor(hex) {
      ballMat.color.setHex(hex); ballMat.emissive.setHex(hex);
      ballMat.userData.rimColor.value.setHex(hex).lerp(white, 0.6);
      tint.setHex(hex).lerp(white, 0.55); lineMat.color.copy(tint); rodMat.color.setHex(hex).lerp(white, 0.25);
      glow.material.color.setHex(hex);
    },
    dispose() { ballGeo.dispose(); ballMat.dispose(); lineGeo.dispose(); lineMat.dispose(); rodGeo.dispose(); rodMat.dispose(); glow.material.dispose(); },
  };
}
