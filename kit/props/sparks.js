// Prop: sparks. Glowing hot streaks flying outward from a point, cooling from white to a colour and fading as they go.
// Exports: meta, build(params, ctx). Animate "burst" 0..1: 0 = just lit (hidden at the centre), about 0.3 = in full flight, 1 = faded out.
// Positions are a pure function of burst (seeded directions and speeds), so scrubbing is safe.

import * as THREE from 'three';

export const meta = {
  name: 'sparks',
  summary: 'Glowing streaks flying outward and fading: sparks, embers, hot bits. Animate "burst" 0..1.',
  notes: 'Use for sparks and embers (not particles). burst 0 = just lit, about 0.3 = full spray, 1 = gone. Animate burst 0 -> 1 over about a second for one burst: the outward spray only happens while burst moves (a fixed burst just hangs and flickers in place, so always animate it).',
  tags: ['effect', 'light'],
  floats: true,
  params: {
    count: { type: 'int', min: 5, max: 300, default: 70, doc: 'how many sparks' },
    color: { type: 'color', default: '#ff6a14', doc: 'colour of the glow (orange-red embers; the hot core of each head is bright yellow-white)' },
    length: { type: 'number', min: 0.03, max: 0.5, default: 0.13, doc: 'length of each streak (fraction of the box)' },
    bias: { type: 'number', min: 0, max: 1, default: 0.35, doc: 'how much they favour flying upward (0 = every way equally)' },
  },
  animatable: {
    burst: { min: 0, max: 1, default: 0.3, doc: '0 = just lit, 0.3 = full spray, 1 = faded away' },
  },
};

const UP = new THREE.Vector3(0, 1, 0);

export function build(params, ctx) {
  const n = params.count, rng = ctx.rng, G = 0.5;   // G: gravity pulls the streaks down a little as they fly
  const sp = [];
  for (let i = 0; i < n; i++) {
    // random direction (uniform on a sphere), pushed upward by bias
    const z = rng() * 2 - 1, a = rng() * Math.PI * 2, r = Math.sqrt(1 - z * z);
    const d = new THREE.Vector3(r * Math.cos(a), z + params.bias * (0.6 + 0.4 * rng()), r * Math.sin(a)).normalize();
    sp.push({ d, v: 0.55 + 0.7 * rng(), life: 0.7 + 0.3 * rng(), w: rng() });
  }
  // A thin streak (a thin cone, wide at the head, hanging from its head) per spark, plus a soft glowing dot at the head.
  const geo = new THREE.CylinderGeometry(1, 0.08, 1, 5).translate(0, -0.5, 0);
  const mat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  mat.userData.main = false;
  const streaks = new THREE.InstancedMesh(geo, mat, n); streaks.frustumCulled = false;
  const dotGeo = new THREE.BufferGeometry(), dotPos = new Float32Array(n * 3), dotCol = new Float32Array(n * 3);
  dotGeo.setAttribute('position', new THREE.BufferAttribute(dotPos, 3)); dotGeo.setAttribute('color', new THREE.BufferAttribute(dotCol, 3));
  const dotMat = new THREE.PointsMaterial({ size: 0.1, map: ctx.mat.glowTexture(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  dotMat.userData.main = false;
  const dots = new THREE.Points(dotGeo, dotMat); dots.frustumCulled = false;
  const group = new THREE.Group(); group.add(streaks, dots);
  const hot = new THREE.Color(1, 0.78, 0.4), glow = new THREE.Color(ctx.color(params.color)), dark = new THREE.Color(0x6a1203), col = new THREE.Color();
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), sc = new THREE.Vector3(), vel = new THREE.Vector3();
  function update(t, state) {
    const b = state.params.burst, k = state.opacity;
    group.visible = b > 0.002 && b < 0.999 && k > 0.005;
    const f = Math.min(1, b / 0.8);   // flight progress; the sparks are gone before burst reaches 1
    sp.forEach((s, i) => {
      const age = Math.min(1, f / s.life), travel = 1 - (1 - f) * (1 - f);   // fast at first, then slowing
      pos.copy(s.d).multiplyScalar(0.5 * s.v * travel); pos.y -= G * 0.4 * f * f;
      // a gentle drift and flicker in time, so a sparks prop whose burst is not animated still lives (it never freezes)
      const ph = s.w * 40, live = 0.012 + 0.01 * s.w;
      pos.x += live * Math.sin(t * 2.3 + ph); pos.y += live * Math.sin(t * 1.9 + ph * 1.7); pos.z += live * Math.cos(t * 2.1 + ph);
      vel.copy(s.d).multiplyScalar(1 - f); vel.y -= G * f;   // the way it is heading now (tilts down as it falls)
      const dir = vel.lengthSq() > 1e-6 ? vel.normalize() : s.d;
      q.setFromUnitVectors(UP, dir);
      const len = params.length * 1.5 * (0.5 + 0.5 * s.w) * (1 - 0.75 * age) * Math.min(1, f * 8) * (0.85 + 0.15 * Math.sin(t * 9 + ph)), w = 0.0045 + 0.003 * s.w;
      m4.compose(pos, q, sc.set(w, Math.max(len, 1e-4), w)); streaks.setMatrixAt(i, m4);
      // white-hot, then the glow colour, then dim red; additive blending makes "darker" the same as "fading"
      col.copy(hot).lerp(glow, Math.min(1, age * 4)).lerp(dark, Math.max(0, age - 0.55) * 1.6).multiplyScalar(1.5 * Math.max(0, 1 - age * age) * k * (0.8 + 0.2 * Math.sin(t * 7 + ph * 2)));
      streaks.setColorAt(i, col);
      pos.toArray(dotPos, i * 3); col.toArray(dotCol, i * 3);
      // the head dot is the bright core: whiter-yellow than the streak, same fade
      const c = i * 3, core = Math.max(col.r, col.g, col.b); dotCol[c] = core; dotCol[c + 1] = col.g + 0.55 * core * (1 - age); dotCol[c + 2] = col.b + 0.3 * core * (1 - age);
    });
    streaks.instanceMatrix.needsUpdate = true; streaks.instanceColor.needsUpdate = true;
    dotGeo.attributes.position.needsUpdate = true; dotGeo.attributes.color.needsUpdate = true;
  }
  update(0, { opacity: 1, params: { burst: 0.3 } });
  return {
    object: group,
    bounds: new THREE.Box3(new THREE.Vector3(-0.5, -0.5, -0.5), new THREE.Vector3(0.5, 0.5, 0.5)),
    update,
    setColor(hex) { glow.setHex(hex); },
    dispose() { geo.dispose(); mat.dispose(); dotGeo.dispose(); dotMat.dispose(); },
  };
}
