// Prop: lightning. A jagged glowing bolt with two side forks. Seeded shape.
// Exports: meta, build(params, ctx). Animate "flash" 0..1: at 1 the bolt strobes bright, at 0 it is gone.
// Without from/to it stands in its own box (top to bottom): the approved bolt, unchanged. With from and to (a prop id or a
// point, like beam) it is a different bolt drawn between those two stage points each frame, whatever the prop's own at/size:
// few wide zigzag joints of uneven length with a couple of sharp kinks, a thin white core, a soft pale-blue glow along the line
// (no beads at the joints) and two thin forks.

import * as THREE from 'three';
import { makeRng, hash01 } from '../engine/rng.js';

export const meta = {
  name: 'lightning',
  summary: 'A jagged glowing lightning bolt, alone or from one point/prop to another. Animate "flash" 0..1 for the strike.',
  notes: 'To strike from a cloud to the ground set from (the cloud id) and to (a prop id such as the house, or a point [x, 0, z] on the ground, or center/left/right; there is no "ground" slot and the bottom slots lie under the floor): the bolt runs from the underside of the cloud to the top of the target (a few wide zigzags with thin side forks). Points are never drawn below the ground. Without from/to it is a fixed bolt placed at "at" (it will float).',
  tags: ['science', 'light'],
  floats: true,
  spansPoints: true,   // its framing extent is its from/to points (state.js extentOf)
  params: {
    from: { type: 'point', default: null, doc: 'optional: where the bolt starts (slot, [x,y,z] or prop id, e.g. the cloud); use with to' },
    to: { type: 'point', default: null, doc: 'optional: where it strikes (a prop id, or [x, 0, z] on the ground, or center/left/right); use with from' },
    color: { type: 'color', default: '#9fd0ff', doc: 'glow colour (the core stays near white)' },
    seed: { type: 'int', min: 0, max: 999, default: 8, doc: 'which jagged shape' },
  },
  animatable: {
    flash: { min: 0, max: 1, default: 1, doc: 'strike brightness (0 = off, 1 = full flash with flicker)' },
  },
};

const UP = new THREE.Vector3(0, 1, 0);

// A zig-zag path from (x0, top) to (x1, bottom) in n steps (the default bolt).
function zigzag(rng, from, to, n, jag) {
  const pts = [from.clone()];
  for (let i = 1; i < n; i++) {
    const k = i / n;
    const p = from.clone().lerp(to, k);
    p.x += (rng() - 0.5) * jag * 2; p.z += (rng() - 0.5) * jag * 0.5;
    pts.push(p);
  }
  pts.push(to.clone());
  return pts;
}

const NJ = 6;                       // interior joints of the from/to bolt (7 segments)
const FORKS = [[2, 1], [4, -1]];    // [main joint the fork leaves from, side]
const SEGS = NJ + 1 + FORKS.length * 2;
// glow layers of the from/to bolt: [width over the core, opacity]; the first entry is the core itself
const LAYERS = [[1, 1], [2.6, 0.5], [5, 0.26], [9, 0.13], [15, 0.06]];
const CORE = 0.008;                // core radius as a share of the bolt length

export function build(params, ctx) {
  const rng = makeRng(params.seed * 421 + 9);
  const made = [], keep = x => { made.push(x); return x; };
  const glowCol = new THREE.Color(ctx.color(params.color));
  const group = new THREE.Group();
  const useEnds = params.from !== null && params.from !== undefined && params.to !== null && params.to !== undefined;
  const def = new THREE.Group(); group.add(def);   // the default bolt (HEAD): shown without from/to
  const main = zigzag(rng, new THREE.Vector3(0.05, 0.5, 0), new THREE.Vector3(-0.05, -0.5, 0), 9, 0.14);
  const forkA = zigzag(rng, main[3], main[3].clone().add(new THREE.Vector3(0.28, -0.3, 0)), 3, 0.05);
  const forkB = zigzag(rng, main[6], main[6].clone().add(new THREE.Vector3(-0.25, -0.25, 0)), 3, 0.05);

  const coreMat = keep(new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, transparent: true }));
  const midMat = keep(new THREE.MeshBasicMaterial({ color: glowCol, toneMapped: false, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
  coreMat.userData.main = false; midMat.userData.main = false;
  const cyl = keep(new THREE.CylinderGeometry(1, 1, 1, 8)), ball = keep(new THREE.SphereGeometry(1, 10, 8));
  const strands = [];   // { meshes, radius } so flash can scale thickness
  const addPath = (pts, r) => {
    for (let i = 0; i < pts.length; i++) {
      for (const [mat, k] of [[coreMat, 1], [midMat, 3.2]]) {
        const j = new THREE.Mesh(ball, mat); j.position.copy(pts[i]); j.scale.setScalar(r * k); def.add(j); strands.push({ m: j, r: r * k, ball: true });
        if (k > 1) ctx.mat.noBounds(j);
        if (i > 0) {
          const d = pts[i].clone().sub(pts[i - 1]), len = d.length();
          const c = new THREE.Mesh(cyl, mat); c.position.copy(pts[i]).add(pts[i - 1]).multiplyScalar(0.5);
          c.quaternion.setFromUnitVectors(UP, d.normalize()); c.scale.set(r * k, len, r * k);
          def.add(c); strands.push({ m: c, r: r * k, len });
          if (k > 1) ctx.mat.noBounds(c);
        }
      }
    }
  };
  addPath(main, 0.017); addPath(forkA, 0.011); addPath(forkB, 0.011);
  const glowBig = ctx.mat.glowSprite(glowCol, 1.4, 0.4);
  glowBig.scale.set(0.9, 1.5, 1);
  def.add(glowBig);
  const unitBounds = new THREE.Box3(new THREE.Vector3(-0.3, -0.52, -0.05), new THREE.Vector3(0.35, 0.52, 0.05));
  const bounds = unitBounds.clone();   // changes when from/to are set

  // ---- the from/to bolt ----
  // Draws are fixed at build, so the same seed always has the same shape at any length. Two joints are sharp kinks.
  const rng2 = makeRng(params.seed * 811 + 5);
  const dm = Array.from({ length: NJ }, () => [rng2(), rng2(), rng2()]);
  const kinks = new Set([1 + Math.floor(rng2() * 2), 3 + Math.floor(rng2() * 3)]);
  const dF = FORKS.map(() => [rng2(), rng2()]);
  // Points of the main path (a to b) and of each fork; len = bolt length; u, v = sideways axes.
  function layout(a, b, len, u, v) {
    const pts = [a.clone()];
    dm.forEach(([r1, r2, r3], i) => {
      const t = (i + 1 + (r1 - 0.5) * 0.7) / (NJ + 1);              // uneven spacing along the line
      const side = (i % 2 ? 1 : -1) * (kinks.has(i) ? 0.1 + 0.04 * r2 : 0.02 + 0.04 * r2) * len;
      pts.push(a.clone().lerp(b, t).addScaledVector(u, side).addScaledVector(v, (r3 - 0.5) * 0.03 * len));
    });
    pts.push(b.clone());
    const down = b.clone().sub(a).normalize();
    const forks = FORKS.map(([at, sd], i) => {
      const p0 = pts[at], r = dF[i];
      const p1 = p0.clone().addScaledVector(u, sd * (0.04 + 0.04 * r[0]) * len).addScaledVector(down, 0.07 * len);
      const p2 = p1.clone().addScaledVector(u, sd * (0.02 + 0.05 * r[1]) * len).addScaledVector(down, (0.08 + 0.05 * r[0]) * len);
      return [p0, p1, p2];
    });
    return [pts, ...forks];
  }
  const endGroup = new THREE.Group(); group.add(endGroup); endGroup.visible = false;
  const endCol = new THREE.Color(), blue = new THREE.Color('#8fb0ff');
  const tintEnd = () => endCol.copy(glowCol).lerp(blue, 0.4);   // keeps the glow blue-violet, so it does not turn mint on grass
  tintEnd();
  const layerMats = LAYERS.map(([, op], i) => keep(i === 0 ? new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, transparent: true })
    : new THREE.MeshBasicMaterial({ color: endCol.clone(), toneMapped: false, transparent: true, opacity: op, depthWrite: false })));
  layerMats.forEach(m => { m.userData.main = false; });
  const segs = [];   // { layer meshes, cap }
  for (let s = 0; s < SEGS; s++) {
    const ms = LAYERS.map((_, i) => { const c = new THREE.Mesh(cyl, layerMats[i]); endGroup.add(c); if (i) ctx.mat.noBounds(c); return c; });
    const cap = new THREE.Mesh(ball, layerMats[0]); endGroup.add(cap);   // a core-sized cap that rounds the kink
    segs.push({ ms, cap });
  }

  let cur = null, rScale = 1, haveEnds = false;   // the paths now drawn; bolt length (thickness factor)
  const a = new THREE.Vector3(), b = new THREE.Vector3(), d = new THREE.Vector3(), u = new THREE.Vector3(), v = new THREE.Vector3(), e = new THREE.Vector3();
  const X = new THREE.Vector3(1, 0, 0), Z = new THREE.Vector3(0, 0, 1);
  function setMode(on) {
    if (on === haveEnds) return;
    haveEnds = on; def.visible = !on; endGroup.visible = on;
    if (!on) bounds.copy(unitBounds);
  }
  function follow(state) {
    const { from, to } = state.points;
    if (!useEnds || !from || !to) { setMode(false); return; }
    setMode(true);
    group.updateWorldMatrix(true, false);   // the prop's own placement is already set; we draw in stage space
    a.fromArray(from.at); b.fromArray(to.at);
    d.subVectors(b, a); const full = d.length(); d.normalize();
    // Props give their half-height (half): a bolt coming from above starts inside the cloud's belly (bottom) and ends on the
    // target's top surface. Plain points and sideways bolts fall back to the radius.
    if (from.half !== undefined && d.y < -0.3) a.y -= from.half * 0.35; else a.addScaledVector(d, Math.min(full * 0.45, from.radius * 0.2));
    if (to.half !== undefined && d.y < -0.3) b.y += to.half * 0.75; else b.addScaledVector(d, -Math.min(full * 0.45, to.radius * 0.5));
    if (typeof state.floor === 'number') { a.y = Math.max(a.y, 0); b.y = Math.max(b.y, 0); }   // a ground: nothing is drawn under it
    group.worldToLocal(a); group.worldToLocal(b);
    const len = Math.max(a.distanceTo(b), 1e-4);
    u.crossVectors(d.set(0, 0, 0).subVectors(b, a).normalize(), Z); if (u.lengthSq() < 1e-4) u.copy(X);
    u.normalize(); v.crossVectors(d, u).normalize();
    cur = layout(a.clone(), b.clone(), len, u, v); rScale = len;
    // The reported box (framing, labels, QA) follows the drawn bolt, padded by its glow thickness.
    bounds.makeEmpty(); for (const pts of cur) for (const q of pts) bounds.expandByPoint(q);
    bounds.expandByScalar(CORE * LAYERS[2][0] * rScale);
  }

  return {
    object: group,
    bounds,
    liveBounds: true,   // stage.js re-measures it each frame instead of using the build-time box
    update(t, state) {
      follow(state);
      const fl = state.params.flash;
      // Flicker: steps of 1/16 s, each with its own brightness (the same t always gives the same flash).
      const step = Math.floor(t * 16), flick = 0.62 + 0.38 * hash01(step + params.seed * 17);
      const k = fl * flick;
      group.visible = fl > 0.01;
      const thin = 0.55 + 0.45 * Math.min(1, fl);
      if (!haveEnds) {
        for (const s of strands) { if (s.ball) s.m.scale.setScalar(s.r * thin); else s.m.scale.set(s.r * thin, s.len, s.r * thin); }
        coreMat.opacity = Math.min(1, 0.4 + k) * state.opacity;
        midMat.opacity = 0.55 * k * state.opacity;
        glowBig.material.opacity = 0.45 * k * state.opacity;
        return;
      }
      let n = 0;
      cur.forEach((pts, pathNo) => {
        const w = (pathNo ? 0.6 : 1) * CORE * rScale * thin;   // forks are thinner
        for (let i = 1; i < pts.length; i++, n++) {
          d.subVectors(pts[i], pts[i - 1]); const len = d.length(), sg = segs[n];
          e.copy(d).normalize();
          sg.ms.forEach((m, li) => {
            m.position.copy(pts[i]).add(pts[i - 1]).multiplyScalar(0.5);
            m.quaternion.setFromUnitVectors(UP, e); m.scale.set(w * LAYERS[li][0], len, w * LAYERS[li][0]);
          });
          sg.cap.position.copy(pts[i]); sg.cap.scale.setScalar(w);
        }
      });
      layerMats[0].opacity = Math.min(1, 0.45 + k) * state.opacity;
      for (let i = 1; i < LAYERS.length; i++) layerMats[i].opacity = LAYERS[i][1] * k * state.opacity;
    },
    setColor(hex) { glowCol.setHex(hex); tintEnd(); for (let i = 1; i < LAYERS.length; i++) layerMats[i].color.copy(endCol); },
    dispose() { for (const x of made) x.dispose(); glowBig.material.dispose(); },
  };
}
