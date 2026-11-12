// Prop: chameleon. The channel's first mascot: a green chameleon gripping a branch, eyes that swivel on their own.
// Exports: meta, build(params, ctx). Ported from the approved chameleon model (the lofted body, spines, turret eyes,
// zygodactyl feet and branch are unchanged); the scale texture is now a small DataTexture so it builds in Node.
// It answers the generic "color" action through its own setColor hook (skin and crest tint together).

import * as THREE from 'three';

export const meta = {
  name: 'chameleon',
  summary: 'The channel mascot: a chameleon on a branch with swivelling eyes. Use the color action to change its colour.',
  tags: ['animal', 'mascot', 'nature'],
  floats: false,
  params: {
    color: { type: 'color', default: '#4faa4a', doc: 'skin colour (the "color" action changes it)' },
    branch: { type: 'bool', default: true, doc: 'show the branch it grips' },
  },
  animatable: {},
};

// Hexagonal scale pattern as a small greyscale texture (tiles seamlessly). Built once from bytes, shared.
let SCALES = null;
function scaleTextures() {
  if (SCALES) return SCALES;
  const S = 256, N = 16, cell = S / N, data = new Uint8Array(S * S * 4);
  const hash = (i, j) => { const x = Math.sin((i + 3) * 127.1 + (j + 5) * 311.7) * 43758.5453; return x - Math.floor(x); };
  for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
    const gx = px / cell, gy = py / cell, j0 = Math.floor(gy);
    let best = 9, bi = 0, bj = 0, bdx = 0, bdy = 0;
    for (let j = j0 - 1; j <= j0 + 1; j++) for (let i = Math.floor(gx) - 2; i <= Math.floor(gx) + 2; i++) {
      const jw = ((j % N) + N) % N, cx = i + 0.5 + (jw % 2 ? 0.5 : 0), cy = j + 0.5;
      const dx = gx - cx, dy = (gy - cy) * 1.1;
      const d = Math.max(Math.abs(dx) * 0.866 + Math.abs(dy) * 0.5, Math.abs(dy));
      if (d < best) { best = d; bi = ((i % N) + N) % N; bj = jw; bdx = dx; bdy = dy; }
    }
    const v = 0.67 + 0.27 * hash(bi, bj);
    const rim = best / 0.56;                                       // 0 centre .. 1 edge
    let k = v * (1 - 0.32 * rim * rim * rim) + 0.08 * Math.max(0, 1 - Math.hypot(bdx + 0.15, bdy + 0.2) * 2.2);
    if (rim > 0.93) k *= 0.35;                                     // dark seam between scales
    const g = Math.round(Math.min(1, Math.max(0, k)) * 255), o = 4 * (py * S + px);
    data[o] = data[o + 1] = data[o + 2] = g; data[o + 3] = 255;
  }
  const make = srgb => {
    const t = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true; t.anisotropy = 4; if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; return t;
  };
  SCALES = { scaleTex: make(true), bumpTex: make(false) };
  return SCALES;
}

export function build(params, ctx) {
  const PI = Math.PI, lerp = (a, b, t) => a + (b - a) * t;
  const g = new THREE.Group();
  const { scaleTex, bumpTex } = scaleTextures();
  const start = new THREE.Color(ctx.color(params.color));

  const skin = new THREE.MeshPhysicalMaterial({ color: start, roughness: .5, metalness: .05, map: scaleTex, bumpMap: bumpTex, bumpScale: 1.1, vertexColors: true, sheen: .6, sheenRoughness: .5, sheenColor: new THREE.Color(0xc8ffc0), clearcoat: .25, clearcoatRoughness: .45 });
  const accent = new THREE.MeshPhysicalMaterial({ color: 0x9be07a, roughness: .55, metalness: .04, map: scaleTex, bumpMap: bumpTex, bumpScale: .9 });
  const skin2 = skin.clone(); skin2.vertexColors = false; skin2.side = THREE.DoubleSide;
  const black = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: .15, metalness: .2 });
  const iris = new THREE.MeshStandardMaterial({ color: 0xe9c95a, roughness: .3, emissive: 0x3a2a00, emissiveIntensity: .35 });
  const claw = new THREE.MeshStandardMaterial({ color: 0xcdb98a, roughness: .55 });
  const bark = new THREE.MeshStandardMaterial({ color: 0x5b3e28, roughness: .95 });

  /* ---------- lofted body: snout -> head -> neck -> body -> curled tail ---------- */
  const P = [[3.0, .25], [2.55, .28], [1.95, .2], [1.3, .15], [.3, .16], [-.8, .08], [-1.55, -.08], [-2.35, -.4], [-2.95, -.9], [-3.2, -1.65], [-2.85, -2.2], [-2.3, -2.05], [-2.2, -1.68], [-2.5, -1.48], [-2.68, -1.72]];
  const spine = new THREE.CatmullRomCurve3(P.map(p => new THREE.Vector3(p[0], p[1], 0)), false, 'catmullrom', .5);
  // [t, vertical half-height, lateral half-width]
  const prof = [[0, .05, .05], [.008, .14, .12], [.03, .24, .2], [.07, .33, .28], [.11, .44, .34], [.15, .5, .38], [.19, .5, .34], [.23, .56, .33], [.28, .8, .4], [.38, .92, .45], [.48, .86, .43], [.55, .68, .36], [.61, .44, .27], [.7, .3, .2], [.85, .17, .12], [1, .04, .04]];
  const sm = x => x * x * (3 - 2 * x);
  const radii = t => { let i = 0; while (i < prof.length - 2 && t > prof[i + 1][0]) i++; const a = prof[i], b = prof[i + 1], u = sm(Math.min(1, Math.max(0, (t - a[0]) / (b[0] - a[0])))); return [lerp(a[1], b[1], u), lerp(a[2], b[2], u)]; };
  const NR = 200, NA = 40;
  const pos = [], uvs = [], cols = [], idx = [];
  const tmp = new THREE.Vector3(), Tn = new THREE.Vector3();
  const ridgeTop = [];           // top-of-back points for spikes
  for (let i = 0; i <= NR; i++) {
    const t = i / NR, p = spine.getPoint(t); spine.getTangent(t, Tn); Tn.normalize();
    const Nn = new THREE.Vector3(Tn.y, -Tn.x, 0).normalize();   // "up" (the spine runs snout->tail, i.e. toward -x)
    let [rv, rl] = radii(t);
    const casque = .34 * Math.exp(-(((t - .17) / .045) ** 2));       // helmet on the head
    const brow = .06 * Math.exp(-(((t - .095) / .03) ** 2));         // brow ridge
    for (let j = 0; j <= NA; j++) {
      const a = (j / NA) * PI * 2, s = Math.sin(a), c = Math.cos(a);
      const top = Math.max(0, s), bot = Math.max(0, -s);
      const v = rv * (s > 0 ? 1 + .1 * Math.pow(top, 8) : (t < .2 ? .7 : .86)) * s + (s > 0 ? casque * Math.pow(top, 3) : 0) + brow * Math.abs(c) * top;
      const l = rl * c * (1 - .12 * Math.pow(Math.abs(s), 3));
      tmp.copy(p).addScaledVector(Nn, v).addScaledVector(new THREE.Vector3(0, 0, 1), l);
      pos.push(tmp.x, tmp.y, tmp.z); uvs.push(t * 9, (j / NA) * 3);
      // vertex colours: darker back, pale belly, diagonal bands across the flank
      const belly = Math.max(0, -s), dors = Math.max(0, s);
      let k = 1 - .22 * dors * dors + .28 * belly;
      const band = Math.sin(t * 38 + c * 2.4); if (t > .22 && t < .62 && Math.abs(s) < .75) k *= 1 + .12 * Math.max(0, band);
      k *= .96 + .06 * Math.sin(t * 90 + a * 3);
      if (t < .13 && s < -.05 && s > -.35 && c > 0) k *= .5;   // mouth line
      if (t < .13 && c > 0 && s < -.05 && s > -.35) k *= 1;
      cols.push(k, k, k);
      if (j === Math.round(NA / 4) && t > .2 && t < .6) ridgeTop.push({ p: tmp.clone(), Nn: Nn.clone(), Tn: Tn.clone(), t });
    }
  }
  for (let i = 0; i < NR; i++) for (let j = 0; j < NA; j++) {
    const a = i * (NA + 1) + j, b = a + 1, c = a + NA + 1, d = c + 1; idx.push(a, b, c, b, d, c);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  geo.setIndex(idx); geo.computeVertexNormals();
  { const n = geo.attributes.normal; for (let i = 0; i <= NR; i++) { const a = i * (NA + 1), b = a + NA; tmp.set(n.getX(a) + n.getX(b), n.getY(a) + n.getY(b), n.getZ(a) + n.getZ(b)).normalize(); n.setXYZ(a, tmp.x, tmp.y, tmp.z); n.setXYZ(b, tmp.x, tmp.y, tmp.z); } }
  const body = new THREE.Mesh(geo, skin); g.add(body);

  /* ---------- dorsal spines + head crest ---------- */
  const sp = new THREE.ConeGeometry(.045, .2, 8);
  for (let i = 0; i < 26; i++) {
    const r = ridgeTop[Math.floor(i / 26 * (ridgeTop.length - 1))]; if (!r) continue;
    const m = new THREE.Mesh(sp, accent); m.position.copy(r.p).addScaledVector(r.Nn, .08);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), r.Nn); m.scale.setScalar(.8 + .5 * Math.sin((i / 26) * PI)); g.add(m);
  }

  /* ---------- eyes: scaly turret, eyelid ring, iris + slit pupil (rotate independently) ---------- */
  const sphG = new THREE.SphereGeometry(1, 28, 20), eyes = [];
  for (const sz of [1, -1]) {
    const cx = 2.28, cy = .55, cz = .27 * sz;
    const turret = new THREE.Mesh(sphG, skin2); turret.position.set(cx, cy, cz); turret.scale.set(.235, .235, .235); g.add(turret);
    const eg = new THREE.Group(); eg.position.set(cx, cy, cz); g.add(eg);
    const dir = new THREE.Vector3(.2, .08, .98 * sz).normalize();
    const place = (m, d) => { m.position.copy(dir).multiplyScalar(d); m.lookAt(dir.clone().multiplyScalar(5)); eg.add(m); return m; };
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.1, .026, 10, 28), accent); place(ring, .205);
    const ir = new THREE.Mesh(sphG, iris); ir.scale.set(.088, .088, .045); place(ir, .21);
    const pu = new THREE.Mesh(sphG, black); pu.scale.set(.024, .066, .028); place(pu, .23);
    const hl = new THREE.Mesh(sphG, new THREE.MeshBasicMaterial({ color: 0xffffff })); hl.scale.setScalar(.012); hl.position.copy(dir).multiplyScalar(.225).add(new THREE.Vector3(.03, .035, 0)); eg.add(hl);
    eyes.push({ g: eg, sz });
  }
  // nostril bumps + mouth line
  for (const sz of [1, -1]) { const nb = new THREE.Mesh(sphG, accent); nb.scale.set(.045, .04, .04); nb.position.set(2.92, .32, .1 * sz); g.add(nb); }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(.5, .012, 6, 40, PI * .55), black); mouth.rotation.set(PI / 2, 0, PI * .0); mouth.position.set(2.5, .02, 0); mouth.scale.set(1, .3, 1);
  // (mouth omitted: lofted surface already reads as a closed jaw line)

  /* ---------- legs: tapered two-segment limbs, gripping zygodactyl feet ---------- */
  const BR = new THREE.Vector3(.45, -1.2, 0), BRAD = .17;
  function limb(a, b, r0, r1) {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), len = A.distanceTo(B);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, len, 14, 1, true), skin2);
    m.position.copy(A).add(B).multiplyScalar(.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize()); g.add(m);
    const j = new THREE.Mesh(sphG, skin2); j.position.copy(B); j.scale.setScalar(r1 * 1.15); g.add(j);
  }
  function foot(x, sz) {
    // toes are arcs wrapping over the top of the branch (ring axis = x); 2 toes forward, 3 back like a real zygodactyl foot
    const arc = PI * 1.05, phi0 = PI / 2 - arc / 2;
    for (const [dx, n] of [[-.1, 2], [.12, 3]]) for (let k = 0; k < n; k++) {
      const xx = x + dx + (k - (n - 1) / 2) * .085, rad = BRAD + .03;
      const outer = new THREE.Group(); outer.position.set(xx, BR.y, 0); outer.rotation.y = PI / 2;
      const tor = new THREE.Mesh(new THREE.TorusGeometry(rad, .038, 8, 20, arc), skin2); tor.rotation.z = phi0; outer.add(tor);
      for (const ph of [phi0, phi0 + arc]) {
        const cw = new THREE.Mesh(new THREE.ConeGeometry(.032, .11, 6), claw);
        cw.position.set(Math.cos(ph) * (rad - .02), Math.sin(ph) * (rad - .02), 0);
        cw.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(-Math.cos(ph), -Math.sin(ph), 0).normalize()); outer.add(cw);
      }
      g.add(outer);
    }
    const pad = new THREE.Mesh(sphG, skin2); pad.position.set(x, BR.y + BRAD + .06, .12 * sz); pad.scale.set(.2, .08, .13); g.add(pad);
  }
  for (const sz of [1, -1]) {
    const f = sz > 0 ? .18 : -.18;                       // alternate gait: near-side legs forward, far-side legs back
    for (const [sx, front] of [[1.25, true], [-.95, false]]) {
      const ox = front ? f : -f, dir = front ? 1 : -1;
      // shoulder / hip mass sunk into the flank so there is no visible seam
      const blob = new THREE.Mesh(sphG, skin2); blob.position.set(sx + ox * .3, -.3, .36 * sz); blob.scale.set(.2, .26, .13); g.add(blob);
      limb([sx + ox * .3, -.3, .36 * sz], [sx + dir * .3 + ox, -.68, .5 * sz], front ? .15 : .17, .1);
      limb([sx + dir * .3 + ox, -.68, .5 * sz], [sx + dir * .13 + ox, -1.02, .22 * sz], .1, .075);
      foot(sx + dir * .13 + ox, sz);
    }
  }

  /* ---------- branch ---------- */
  if (params.branch) {
  const br = new THREE.Mesh(new THREE.CylinderGeometry(BRAD, BRAD * 1.25, 6.4, 18), bark); br.rotation.z = PI / 2; br.position.copy(BR); br.position.x = .45; g.add(br);
  const twig = new THREE.Mesh(new THREE.CylinderGeometry(.04, .08, 1.1, 8), bark); twig.position.set(2.4, -.8, -.1); twig.rotation.z = -.9; g.add(twig);
  }

  const white = new THREE.Color(0xffffff);
  let cur = start.clone(), emis = 0;
  function paint() {
    skin.color.copy(cur); skin.emissive.copy(cur).multiplyScalar(emis); skin2.color.copy(cur); skin2.emissive.copy(cur).multiplyScalar(emis);
    accent.color.copy(cur).lerp(white, .2); accent.emissive.copy(accent.color).multiplyScalar(emis * .7);
    skin.sheenColor.copy(cur).lerp(white, .5); skin2.sheenColor.copy(skin.sheenColor);
  }
  paint();
  return {
    object: g,
    update(t) {
      for (const e of eyes) {   // each eye swivels on its own
        const k = (e.sz > 0 ? 0 : 1.7);
        e.g.rotation.y = Math.sin(t * .9 + k) * .55 + Math.sin(t * 2.3 + k * 2) * .12;
        e.g.rotation.z = Math.sin(t * .6 + k * 1.3) * .25;
      }
    },
    setColor(hex) { cur.setHex(hex); paint(); },
    setGlow(v) { emis = v * 0.35; paint(); },
    dispose() { g.traverse(o => { if (o.geometry) o.geometry.dispose(); }); for (const m of [skin, accent, skin2, black, iris, claw, bark]) m.dispose(); },
  };
}
