// Prop: tuner. A radio antenna on a dark tuning box: mast with cross bars, glowing tip, broadcast rings that pulse outward,
// a blue-to-red colour strip with a marker, and a knob. Ported from the approved chameleon video (old meter_gadget.js).
// Exports: meta, build(params, ctx). Face looks toward +z. Colour of tip and rings follows "value" along the spectrum
// unless a colour is given.

import * as THREE from 'three';
import { spectrumColor } from './lib/spectrum.js';

export const meta = {
  name: 'tuner',
  summary: 'Antenna on a tuning box: colour dial, knob, glowing tip, pulsing rings. Radio, signals, tuning.',
  tags: ['machine', 'science', 'mechanism'],
  floats: false,
  params: {
    color: { type: 'color', default: null, doc: 'tip and ring colour; omit to follow the dial value' },
    rings: { type: 'int', min: 2, max: 10, default: 7, doc: 'broadcast rings at once' },
  },
  animatable: {
    value: { min: 0, max: 1, default: 0.5, doc: 'dial: marker, knob and tip/ring colour; 0 blue end, 1 red end' },
  },
};

export function build(params, ctx) {
  const made = [], keep = x => { made.push(x); return x; };
  const group = new THREE.Group();
  const lit = (c, o) => keep(ctx.mat.solid(c, { main: false, ...o }));
  const mesh = (g, m, x, y, z, parent = group) => { const o = new THREE.Mesh(keep(g), m); o.position.set(x, y, z); parent.add(o); return o; };
  const metal = lit(0xc4ccd8, { rough: 0.35, metal: 0.5 });
  mesh(new THREE.CylinderGeometry(0.045, 0.06, 2.7, 12), metal, 0, 0.65, 0);
  for (const [y, l] of [[0.62, 1.5], [0.98, 1.05], [1.3, 0.7]]) {
    mesh(new THREE.CylinderGeometry(0.03, 0.03, l, 8), metal, 0, y, 0).rotation.z = Math.PI / 2;
  }
  const TIP_Y = 2.05;
  const tipMat = lit(0xffffff, { emissive: 1.3, rim: 0 });
  const tip = mesh(new THREE.SphereGeometry(0.14, 28, 20), tipMat, 0, TIP_Y, 0);
  const box = mesh(new THREE.BoxGeometry(2.6, 1.3, 0.7), lit(0x333a48, { rough: 0.4, rim: 0.6 }), 0, -1.35, 0);
  // Colour strip: a flat strip whose vertex colours run along the spectrum.
  const STEPS = 48, stripGeo = new THREE.PlaneGeometry(2.2, 0.2, STEPS, 1), c = new THREE.Color(), cols = [];
  const pos = stripGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) { spectrumColor(pos.getX(i) / 2.2 + 0.5, c); cols.push(c.r, c.g, c.b); }
  stripGeo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  mesh(stripGeo, keep(new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })), 0, -1.1, 0.36);
  const cursor = mesh(new THREE.BoxGeometry(0.05, 0.38, 0.02), keep(new THREE.MeshBasicMaterial({ color: 0xffffff })), 0, -1.1, 0.38);
  const knob = new THREE.Group(); knob.position.set(-0.6, -1.62, 0.42); group.add(knob);
  mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.14, 28), metal, 0, 0, 0, knob).rotation.x = Math.PI / 2;
  mesh(new THREE.BoxGeometry(0.04, 0.2, 0.02), keep(new THREE.MeshBasicMaterial({ color: 0x111111 })), 0, 0.12, 0.09, knob);
  // Broadcast rings and tip glow: not part of the prop's size.
  const ringGeo = keep(new THREE.TorusGeometry(1, 0.03, 8, 80)), rings = [];
  for (let i = 0; i < params.rings; i++) {
    const m = new THREE.Mesh(ringGeo, keep(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, toneMapped: false, depthWrite: false })));
    m.position.set(0, TIP_Y, -0.3); ctx.mat.noBounds(m); group.add(m); rings.push(m);
  }
  const glow = ctx.mat.glowSprite(0xffffff, 3.2, 0.6); glow.position.set(0, TIP_Y, 0); group.add(glow);

  const bounds = new THREE.Box3(new THREE.Vector3(-1.3, -2.0, -0.35), new THREE.Vector3(1.3, 2.25, 0.35));
  const fixed = params.color !== null && params.color !== undefined;
  let given = fixed ? ctx.color(params.color) : 0xffffff;
  const col = new THREE.Color();

  return {
    object: group,
    bounds,
    update(t, state) {
      const v = Math.min(1, Math.max(0, state.params.value));
      if (fixed) col.setHex(given); else spectrumColor(v, col);
      tipMat.color.copy(col); tipMat.emissive.copy(col);
      cursor.position.x = (v - 0.5) * 2.2 * 0.9;
      knob.rotation.z = -(v - 0.5) * 4;
      const n = rings.length;
      rings.forEach((r, i) => {
        const ph = (t * 0.9 + i / n) % 1;
        r.scale.setScalar(0.15 + ph * 2.9);
        r.material.color.copy(col);
        r.material.opacity = (1 - ph) * 0.9 * state.opacity;
      });
      glow.material.color.copy(col);
      glow.material.opacity = (0.55 + 0.3 * Math.sin(t * 6)) * state.opacity;
      glow.scale.setScalar(3.2);
    },
    setColor(hex) { given = hex; },
    dispose() { for (const x of made) x.dispose(); glow.material.dispose(); },
  };
}
