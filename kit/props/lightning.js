// Prop: lightning. A jagged glowing bolt from the top to the bottom of its box, with two side forks. Seeded shape.
// Exports: meta, build(params, ctx). Animate "flash" 0..1: at 1 the bolt strobes bright, at 0 it is gone.

import * as THREE from 'three';
import { makeRng, hash01 } from '../engine/rng.js';

export const meta = {
  name: 'lightning',
  summary: 'A jagged glowing lightning bolt, top to bottom. Animate "flash" 0..1 for the strike.',
  tags: ['science', 'light'],
  floats: true,
  params: {
    color: { type: 'color', default: '#9fd0ff', doc: 'glow colour (the core stays near white)' },
    seed: { type: 'int', min: 0, max: 999, default: 8, doc: 'which jagged shape' },
  },
  animatable: {
    flash: { min: 0, max: 1, default: 1, doc: 'strike brightness (0 = off, 1 = full flash with flicker)' },
  },
};

// A zig-zag path from (x0, top) to (x1, bottom) in n steps.
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

export function build(params, ctx) {
  const rng = makeRng(params.seed * 421 + 9);
  const made = [], keep = x => { made.push(x); return x; };
  const glowCol = new THREE.Color(ctx.color(params.color));
  const group = new THREE.Group();
  const main = zigzag(rng, new THREE.Vector3(0.05, 0.5, 0), new THREE.Vector3(-0.05, -0.5, 0), 9, 0.14);
  const forkA = zigzag(rng, main[3], main[3].clone().add(new THREE.Vector3(0.28, -0.3, 0)), 3, 0.05);
  const forkB = zigzag(rng, main[6], main[6].clone().add(new THREE.Vector3(-0.25, -0.25, 0)), 3, 0.05);

  const coreMat = keep(new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, transparent: true }));
  const midMat = keep(new THREE.MeshBasicMaterial({ color: glowCol, toneMapped: false, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
  coreMat.userData.main = false; midMat.userData.main = false;
  const up = new THREE.Vector3(0, 1, 0);
  const cyl = keep(new THREE.CylinderGeometry(1, 1, 1, 8)), ball = keep(new THREE.SphereGeometry(1, 10, 8));
  const strands = [];   // { meshes, radius } so flash can scale thickness
  const addPath = (pts, r) => {
    for (let i = 0; i < pts.length; i++) {
      for (const [mat, k] of [[coreMat, 1], [midMat, 3.2]]) {
        const j = new THREE.Mesh(ball, mat); j.position.copy(pts[i]); j.scale.setScalar(r * k); group.add(j); strands.push({ m: j, r: r * k, ball: true });
        if (k > 1) ctx.mat.noBounds(j);
        if (i > 0) {
          const d = pts[i].clone().sub(pts[i - 1]), len = d.length();
          const c = new THREE.Mesh(cyl, mat); c.position.copy(pts[i]).add(pts[i - 1]).multiplyScalar(0.5);
          c.quaternion.setFromUnitVectors(up, d.normalize()); c.scale.set(r * k, len, r * k);
          group.add(c); strands.push({ m: c, r: r * k, len });
          if (k > 1) ctx.mat.noBounds(c);
        }
      }
    }
  };
  addPath(main, 0.017); addPath(forkA, 0.011); addPath(forkB, 0.011);
  const glowBig = ctx.mat.glowSprite(glowCol, 1.4, 0.4);
  glowBig.scale.set(0.9, 1.5, 1);
  group.add(glowBig);
  const bounds = new THREE.Box3(new THREE.Vector3(-0.3, -0.52, -0.05), new THREE.Vector3(0.35, 0.52, 0.05));

  return {
    object: group,
    bounds,
    update(t, state) {
      const fl = state.params.flash;
      // Flicker: steps of 1/16 s, each with its own brightness (the same t always gives the same flash).
      const step = Math.floor(t * 16), flick = 0.62 + 0.38 * hash01(step + params.seed * 17);
      const k = fl * flick;
      group.visible = fl > 0.01;
      const thin = 0.55 + 0.45 * Math.min(1, fl);
      for (const s of strands) { if (s.ball) s.m.scale.setScalar(s.r * thin); else s.m.scale.set(s.r * thin, s.len, s.r * thin); }
      coreMat.opacity = Math.min(1, 0.4 + k) * state.opacity;
      midMat.opacity = 0.55 * k * state.opacity;
      glowBig.material.opacity = 0.45 * k * state.opacity;
    },
    setColor(hex) { glowCol.setHex(hex); },
    dispose() { for (const x of made) x.dispose(); glowBig.material.dispose(); },
  };
}
