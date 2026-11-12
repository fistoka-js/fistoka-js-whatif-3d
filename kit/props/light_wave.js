// Prop: light_wave. A wavy line of small glowing beads travelling from one point to another (a light wave).
// Exports: meta, build(params, ctx). Ported from the approved chameleon video (old scenes/light_rays.js): 64 beads on a
// sine path, white coming in, coloured going out. Stage-space prop like beam: drawn between its two points.

import * as THREE from 'three';

export const meta = {
  name: 'light_wave',
  summary: 'A wavy beaded wave from one point to another. Animate progress, wavelength, amplitude. Light, signals.',
  tags: ['light', 'science', 'mechanism'],
  floats: true,
  stageSpace: true,
  params: {
    from: { type: 'point', default: 'left', doc: 'start (slot, [x,y,z] or prop id)' },
    to: { type: 'point', default: 'right', doc: 'end (slot, [x,y,z] or prop id)' },
    color: { type: 'color', default: 'white', doc: 'bead colour' },
  },
  animatable: {
    progress: { min: 0, max: 1, default: 1, doc: 'how far the wave has grown (0..1)' },
    wavelength: { min: 0, max: 1, default: 0.32, doc: 'crest spacing: 0 short, 1 long' },
    amplitude: { min: 0, max: 1, default: 0.5, doc: 'wiggle height (0 = straight)' },
  },
};

export function build(params, ctx) {
  const N = 64;
  const geo = new THREE.SphereGeometry(1, 12, 9);
  const mat = new THREE.MeshBasicMaterial({ color: ctx.color(params.color), transparent: true, opacity: 0.9, toneMapped: false });
  const group = new THREE.Group();
  const beads = [];
  for (let i = 0; i < N; i++) { const m = new THREE.Mesh(geo, mat); group.add(m); beads.push(m); }
  const a = new THREE.Vector3(), b = new THREE.Vector3(), dir = new THREE.Vector3(), perp = new THREE.Vector3(), p = new THREE.Vector3();
  const Z = new THREE.Vector3(0, 0, 1), X = new THREE.Vector3(1, 0, 0);

  return {
    object: group,
    update(t, state) {
      const { from, to } = state.points;
      a.fromArray(from.at); b.fromArray(to.at);
      dir.subVectors(b, a);
      const len = dir.length();
      dir.normalize();
      perp.crossVectors(dir, Z);                       // the wiggle is sideways in the picture plane
      if (perp.lengthSq() < 1e-4) perp.crossVectors(dir, X);
      perp.normalize();
      const cycles = 1 / (0.1667 + 0.361 * state.params.wavelength);   // same crest count as the old 0.3..0.95 wavelength
      const amp = len * 0.1 * state.params.amplitude, bead = Math.max(0.004, len * 0.017);
      const grow = state.params.progress;
      group.visible = grow > 0.002 && state.opacity > 0.01;
      for (let i = 0; i < N; i++) {
        const u = i / (N - 1);
        const wig = amp * Math.sin(Math.PI * 2 * (u * cycles - t * 1.1)) * Math.min(1, u * 8, (1 - u) * 8 + 0.4);
        p.copy(a).addScaledVector(dir, u * len).addScaledVector(perp, wig);
        beads[i].position.copy(p);
        beads[i].visible = u <= grow;
        beads[i].scale.setScalar(bead);
      }
    },
    setColor(hex) { mat.color.setHex(hex); },
    dispose() { geo.dispose(); mat.dispose(); },
  };
}
