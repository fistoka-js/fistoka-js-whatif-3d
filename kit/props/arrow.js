// Prop: arrow. A flat 2D-style arrow (thin slab: rectangular shaft + triangular head) from one point to another.
// Exports: meta, build(params, ctx).
// Stage-space prop: drawn between its two points (slot, [x,y,z] or prop id), no at/size/rotate, not normalised.
// Shaft is a fixed 1.35 x thickness wide and the head 3x that; only an arrow shorter than 3 shaft widths shrinks whole.
// The engine passes the points (resolved at time t) in state.points. The flat face is turned toward +z (default camera).

import * as THREE from 'three';

export const meta = {
  name: 'arrow',
  summary: 'A flat, bold 2D-style arrow from one point or prop to another. Animate "length" (0..1) to grow it.',
  tags: ['basic', 'diagram'],
  floats: true,
  stageSpace: true,
  params: {
    from: { type: 'point', default: 'left', doc: 'where the arrow starts (slot, [x,y,z] or prop id)' },
    to: { type: 'point', default: 'right', doc: 'where it points (slot, [x,y,z] or prop id)' },
    color: { type: 'color', default: 'accent', doc: 'colour' },
    thickness: { type: 'number', min: 0.02, max: 0.3, default: 0.07, doc: 'shaft width is 1.35 times this number; the head is 3 times wider than the shaft. An arrow shorter than 3 shaft widths (e.g. while growing from 0) shrinks evenly, so it is narrower.' },
  },
  animatable: {
    length: { min: 0, max: 1, default: 1, doc: 'how much of the arrow is drawn (0 = none, 1 = all)' },
  },
};

const ZHAT = new THREE.Vector3(0, 0, 1), YHAT = new THREE.Vector3(0, 1, 0);

export function build(params, ctx) {
  const th = params.thickness;
  const SHAFT_W = th * 1.35, HEAD_W = SHAFT_W * 3, HEAD_L = th * 5.5, DEPTH = 0.03; // flat: the slab is only DEPTH thick
  // Unlit and not tone-mapped: lights and tone mapping wash a lit yellow toward white; this keeps the exact asked colour.
  // userData.main lets the engine's colour action still recolour it.
  const mat = new THREE.MeshBasicMaterial({ color: ctx.color(params.color), toneMapped: false });
  mat.userData.main = true;
  // Glow: the engine's glow action needs `emissive`; Basic has none. Three fills a uniform named `emissive` from it
  // (emissive x emissiveIntensity) each frame; the shader adds it on top. At 0 the colour is untouched.
  mat.emissive = new THREE.Color(0); mat.emissiveIntensity = 0;
  mat.onBeforeCompile = sh => {
    sh.uniforms.emissive = { value: new THREE.Color(0) };
    sh.fragmentShader = 'uniform vec3 emissive;\n' + sh.fragmentShader.replace('#include <opaque_fragment>', 'outgoingLight += emissive;\n#include <opaque_fragment>');
  };
  mat.customProgramCacheKey = () => 'arrow-glow';
  const shaftGeo = new THREE.BoxGeometry(SHAFT_W, 1, DEPTH);
  shaftGeo.translate(0, 0.5, 0);                        // base at 0, top at 1 (scaled to length)
  const tri = new THREE.Shape();
  tri.moveTo(-HEAD_W / 2, 0); tri.lineTo(HEAD_W / 2, 0); tri.lineTo(0, HEAD_L); tri.closePath();
  const headGeo = new THREE.ExtrudeGeometry(tri, { depth: DEPTH, bevelEnabled: false });
  headGeo.translate(0, 0, -DEPTH / 2);                  // centred on the shaft's mid-plane
  const shaft = new THREE.Mesh(shaftGeo, mat), head = new THREE.Mesh(headGeo, mat);
  const group = new THREE.Group();
  group.add(shaft, head);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), dir = new THREE.Vector3();
  const nrm = new THREE.Vector3(), side = new THREE.Vector3(), m = new THREE.Matrix4();

  return {
    object: group,
    update(t, state) {
      const { from, to } = state.points;
      a.fromArray(from.at); b.fromArray(to.at);
      dir.subVectors(b, a);
      const full = dir.length();
      if (full < 1e-6) { group.visible = false; return; }
      dir.divideScalar(full);
      // Start and stop just outside props, so the arrow touches them instead of piercing them.
      const startGap = from.radius ? from.radius * 1.05 : 0, endGap = to.radius ? to.radius * 1.08 : 0;
      const usable = Math.max(0, full - startGap - endGap);
      const len = usable * state.params.length;
      group.visible = len > 0.01;
      group.position.copy(a).addScaledVector(dir, startGap);
      // Flat face normal = the part of +z that is perpendicular to the arrow (up if it points along z).
      nrm.copy(ZHAT).addScaledVector(dir, -dir.z);
      if (nrm.lengthSq() < 1e-6) nrm.copy(YHAT); else nrm.normalize();
      side.crossVectors(dir, nrm);
      group.quaternion.setFromRotationMatrix(m.makeBasis(side, dir, nrm));
      const headLen = Math.min(HEAD_L, len * 0.6);
      // Shaft width stays fixed; only a tiny arrow (shorter than 3 shaft widths) narrows everything evenly, so it never pops in as a sliver.
      const k = Math.max(0.001, Math.min(1, len / (3 * SHAFT_W)));
      shaft.scale.set(k, Math.max(0.001, len - headLen), 1); // ends exactly where the head's base starts: nothing drawn twice
      head.position.set(0, len - headLen, 0);
      head.scale.set(k, Math.max(0.001, headLen / HEAD_L), 1); // head is always 3x the shaft width; depth stays DEPTH so front faces stay flush
    },
    dispose() { shaftGeo.dispose(); headGeo.dispose(); mat.dispose(); },
  };
}
