// Prop: ring. A tube or flat ring to mark an orbit path. Tilted, any colour, solid or dashed (dashes slowly travel).
// Exports: meta, build(params, ctx). Its radius comes from the prop's size: size 2 is a ring twice as wide.

import * as THREE from 'three';

export const meta = {
  name: 'ring',
  summary: 'An orbit-path ring around something: tube or flat band, tilted, solid or dashed. Radius comes from size.',
  tags: ['space', 'basic'],
  floats: true,
  params: {
    color: { type: 'color', default: '#9fd0ff', doc: 'ring colour' },
    style: { type: 'enum', values: ['tube', 'flat'], default: 'tube', doc: 'round tube or flat band' },
    tilt: { type: 'number', min: 0, max: 90, default: 65, doc: 'degrees the ring leans back (0 = facing the camera, 90 = edge-on)' },
    dashed: { type: 'bool', default: false, doc: 'broken into dashes that slowly travel round' },
    thickness: { type: 'number', min: 0.01, max: 0.1, default: 0.025, doc: 'how thick the tube or band is' },
  },
  animatable: {},
};

export function build(params, ctx) {
  const made = [], keep = x => { made.push(x); return x; };
  const R = 0.5, th = params.thickness;
  const mat = keep(ctx.mat.solid(ctx.color(params.color), { rough: 0.35, emissive: 0.5, rim: 0.4 }));
  const turner = new THREE.Group();           // spins about the ring's own axis (visible only for dashes)
  const dashes = params.dashed ? 24 : 1;
  const arc = params.dashed ? (Math.PI * 2 / dashes) * 0.55 : Math.PI * 2;
  let geo;
  if (params.style === 'tube') geo = keep(new THREE.TorusGeometry(R, th, 12, params.dashed ? 8 : 128, arc));
  else {
    // Flat band: a ring slice lying in the ring's plane, with a little height so it is a thin solid, not a card.
    const s = new THREE.Shape(); s.absarc(0, 0, R + th * 1.5, 0, arc, false); s.absarc(0, 0, R - th * 1.5, arc, 0, true);
    geo = keep(new THREE.ExtrudeGeometry(s, { depth: th * 0.8, bevelEnabled: false, curveSegments: params.dashed ? 6 : 96 }));
    geo.translate(0, 0, -th * 0.4);
  }
  for (let i = 0; i < dashes; i++) {
    const m = new THREE.Mesh(geo, mat);
    m.rotation.z = (i / dashes) * Math.PI * 2;
    turner.add(m);
  }
  if (params.dashed && params.style === 'tube') {          // round end-caps so dashes look like capsules
    const cap = keep(new THREE.SphereGeometry(th, 10, 8));
    for (let i = 0; i < dashes; i++) for (const e of [0, arc]) {
      const a = (i / dashes) * Math.PI * 2 + e;
      const c = new THREE.Mesh(cap, mat); c.position.set(Math.cos(a) * R, Math.sin(a) * R, 0); turner.add(c);
    }
  }
  const tilt = new THREE.Group();
  tilt.rotation.x = -THREE.MathUtils.degToRad(params.tilt);
  tilt.add(turner);
  const group = new THREE.Group(); group.add(tilt);
  return {
    object: group,
    update(t) { if (params.dashed) turner.rotation.z = t * 0.12; },
    dispose() { for (const x of made) x.dispose(); },
  };
}
