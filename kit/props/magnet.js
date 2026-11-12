// Prop: magnet. A red/blue bar or horseshoe magnet with curved field lines made of small glowing beads that flow
// from the red pole to the blue one. Animate "field" 0..1 to switch the field on. Exports: meta, build(params, ctx).

import * as THREE from 'three';

export const meta = {
  name: 'magnet',
  summary: 'A red and blue bar or horseshoe magnet with flowing bead field lines. Animate "field" 0..1.',
  tags: ['science', 'physics'],
  floats: true,
  params: {
    shape: { type: 'enum', values: ['bar', 'horseshoe'], default: 'bar', doc: 'bar magnet or horseshoe (U) magnet' },
  },
  animatable: {
    field: { min: 0, max: 1, default: 1, doc: 'strength of the field lines (0 = hidden)' },
  },
};

const BEADS = 18;   // beads per field line

// Field lines as lists of points, each running from the red pole to the blue pole.
function bar() {
  // Bar lies along x: red (N) on the left, blue (S) on the right. Lines leave the red end, swing out and come back in.
  const lines = [];
  const L = 0.5;
  for (const reach of [0.5, 0.8, 1.15]) for (let k = 0; k < (reach > 1 ? 2 : 3); k++) {
    const roll = (k / 3) * Math.PI + (reach > 1 ? 0.5 : 0) + 0.4;
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const a = Math.PI - (i / 40) * Math.PI;                       // angle round the loop, left pole to right pole
      const x = Math.cos(a) * (L + reach * 0.45) * 1.0 , r = Math.sin(a) * reach * 0.55 + 0.001;
      pts.push(new THREE.Vector3(x, r * Math.cos(roll), r * Math.sin(roll)));
    }
    lines.push(pts);
  }
  return lines;
}
function horseshoe() {
  // Horseshoe stands as a U opening upward: red pole top-left (x = -0.25), blue pole top-right (x = 0.25).
  const lines = [];
  for (const [h, z] of [[0.3, 0], [0.55, 0], [0.8, 0], [0.45, 0.1], [0.45, -0.1]]) {
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const a = Math.PI - (i / 40) * Math.PI;
      pts.push(new THREE.Vector3(Math.cos(a) * (0.25 + Math.abs(z) * 0.5 + h * 0.1), 0.34 + Math.sin(a) * h, z * 1.5 * Math.sin(a)));
    }
    lines.push(pts);
  }
  return lines;
}

export function build(params, ctx) {
  const made = [], keep = x => { made.push(x); return x; };
  const group = new THREE.Group();
  const red = keep(ctx.mat.solid(0xe63b3b, { rough: 0.35, main: false })), blue = keep(ctx.mat.solid(0x2f6bf0, { rough: 0.35, main: false }));
  const steel = keep(ctx.mat.solid(0xcfd5df, { rough: 0.25, metal: 0.7, main: false }));
  let lines, bounds;

  if (params.shape === 'bar') {
    const a = new THREE.Mesh(keep(new THREE.BoxGeometry(0.5, 0.26, 0.26)), red); a.position.x = -0.25;
    const b = new THREE.Mesh(keep(new THREE.BoxGeometry(0.5, 0.26, 0.26)), blue); b.position.x = 0.25;
    group.add(a, b);
    lines = bar();
    bounds = new THREE.Box3(new THREE.Vector3(-0.75, -0.4, -0.4), new THREE.Vector3(0.75, 0.4, 0.4));
  } else {
    // U shape: half ring (red left half, blue right half) plus two straight legs ending in steel tips.
    const R = 0.25, tube = 0.11;
    const ring = (c, from) => {
      const g = keep(new THREE.TorusGeometry(R, tube, 20, 24, Math.PI / 2));
      const m = new THREE.Mesh(g, c); m.rotation.z = from; m.position.y = 0.0; return m;
    };
    group.add(ring(red, Math.PI), ring(blue, Math.PI * 1.5));
    const leg = (x, c) => {
      const m = new THREE.Mesh(keep(new THREE.BoxGeometry(tube * 2, 0.3, tube * 2)), c); m.position.set(x, 0.15, 0);
      const tip = new THREE.Mesh(keep(new THREE.BoxGeometry(tube * 2.1, 0.07, tube * 2.1)), steel); tip.position.set(x, 0.31, 0);
      group.add(m, tip);
    };
    group.position.y = -0.05;
    leg(-R, red); leg(R, blue);
    lines = horseshoe();
    bounds = new THREE.Box3(new THREE.Vector3(-0.45, -0.4, -0.3), new THREE.Vector3(0.45, 0.95, 0.3));
  }

  // Beads: one shared set of small balls, moved along each line every frame.
  const bg = keep(new THREE.SphereGeometry(1, 12, 8));
  const beadMat = keep(ctx.mat.solid(0xfff3b0, { rough: 0.3, emissive: 0.9, rim: 0.4, main: false }));
  const beads = new THREE.InstancedMesh(bg, beadMat, lines.length * BEADS);
  beads.frustumCulled = false;
  const field = ctx.mat.noBounds(new THREE.Group());
  field.add(beads);
  group.add(field);
  // Pre-measure each line so beads move at an even pace along it.
  const meta2 = lines.map(pts => {
    const len = [0]; for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + pts[i].distanceTo(pts[i - 1]));
    return { pts, len, total: len[len.length - 1] };
  });
  const at = (m, s, out) => {         // point at distance s along line m
    let i = 1; while (i < m.len.length - 1 && m.len[i] < s) i++;
    const k = (s - m.len[i - 1]) / Math.max(1e-6, m.len[i] - m.len[i - 1]);
    return out.copy(m.pts[i - 1]).lerp(m.pts[i], Math.min(1, Math.max(0, k)));
  };
  const dummy = new THREE.Object3D(), v = new THREE.Vector3(), tint = new THREE.Color();
  const redC = new THREE.Color(0xff7a5a), blueC = new THREE.Color(0x6ab4ff);
  const tmp = { s: 0 };
  // Per-bead colour runs red -> blue along the line (field points from north to south).
  meta2.forEach((m, li) => { for (let b = 0; b < BEADS; b++) beads.setColorAt(li * BEADS + b, tint.copy(redC).lerp(blueC, b / (BEADS - 1))); });
  beads.instanceColor.needsUpdate = true;

  return {
    object: group,
    bounds,
    update(t, state) {
      const f = state.params.field;
      field.visible = f > 0.01;
      meta2.forEach((m, li) => {
        for (let b = 0; b < BEADS; b++) {
          const u = ((b / BEADS) + t * 0.12 + li * 0.13) % 1;
          at(m, u * m.total, v);
          dummy.position.copy(v);
          const edge = Math.sin(u * Math.PI);                                      // beads shrink at the poles
          dummy.scale.setScalar(0.017 * f * (0.5 + 0.7 * edge) * state.opacity);
          dummy.updateMatrix();
          beads.setMatrixAt(li * BEADS + b, dummy.matrix);
        }
      });
      beads.instanceMatrix.needsUpdate = true;
    },
    dispose() { for (const x of made) x.dispose(); beads.dispose(); },
  };
}
