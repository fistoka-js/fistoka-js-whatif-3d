// Prop: skeleton_bone. One classic cartoon bone: a shaft with a knobbly double bulb at each end.
// Exports: meta, build(params, ctx). Lies along x; a tiny idle sway keeps it alive.

import * as THREE from 'three';

export const meta = {
  name: 'skeleton_bone',
  summary: 'A single classic bone (shaft with two knobs at each end). Good for bones, calcium, skeleton, fossils.',
  tags: ['body', 'science'],
  floats: true,
  params: {
    color: { type: 'color', default: '#f3ecd8', doc: 'bone colour' },
  },
  animatable: {},
};

export function build(params, ctx) {
  const made = [], keep = x => { made.push(x); return x; };
  const group = new THREE.Group();
  const mat = keep(ctx.mat.solid(ctx.color(params.color), { rough: 0.6, rim: 0.3 }));
  // Shaft: a lathe profile, slim in the middle and flaring into each end (lathe spins about y, so it is turned to lie along x).
  const prof = [[0.095, -0.5], [0.075, -0.4], [0.05, -0.3], [0.04, -0.15], [0.037, 0], [0.04, 0.15], [0.05, 0.3], [0.075, 0.4], [0.095, 0.5]];
  const shaft = new THREE.Mesh(keep(new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 28)), mat);
  shaft.rotation.z = Math.PI / 2; shaft.scale.set(1, 0.84, 1); group.add(shaft);
  // Ends: two round knobs each, side by side across the shaft (the classic dog-bone look), joined by a small bridge.
  const knob = keep(new THREE.SphereGeometry(1, 28, 20));
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    const k = new THREE.Mesh(knob, mat); k.position.set(sx * 0.46, sy * 0.095, 0); k.scale.set(0.11, 0.1, 0.1); group.add(k);
  }
  for (const sx of [-1, 1]) { const b = new THREE.Mesh(knob, mat); b.position.set(sx * 0.5, 0, 0); b.scale.set(0.085, 0.12, 0.09); group.add(b); }
  return {
    object: group,
    update(t) { group.rotation.set(0.1 * Math.sin(t * 0.8), 0.15 * Math.sin(t * 0.5), 0.04 * Math.sin(t * 0.6)); },
    bounds: new THREE.Box3(new THREE.Vector3(-0.58, -0.22, -0.13), new THREE.Vector3(0.58, 0.22, 0.13)),
    dispose() { for (const x of made) x.dispose(); },
  };
}
