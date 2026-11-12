// Prop: arrow. A solid 3D arrow from one point to another (points can be slots, [x,y,z] or prop ids).
// Exports: meta, build(params, ctx).
// This is a "stage-space" prop: it is drawn between its two points, so it has no at/size/rotate and is not
// normalised to the unit box. The engine passes the points (resolved at time t) in state.points.

import * as THREE from 'three';

export const meta = {
  name: 'arrow',
  summary: 'A solid 3D arrow from one point or prop to another. Animate "length" (0..1) to make it grow.',
  tags: ['basic', 'diagram'],
  floats: true,
  stageSpace: true,
  params: {
    from: { type: 'point', default: 'left', doc: 'where the arrow starts (slot, [x,y,z] or prop id)' },
    to: { type: 'point', default: 'right', doc: 'where it points (slot, [x,y,z] or prop id)' },
    color: { type: 'color', default: 'accent', doc: 'colour' },
    thickness: { type: 'number', min: 0.02, max: 0.3, default: 0.07, doc: 'shaft thickness' },
  },
  animatable: {
    length: { min: 0, max: 1, default: 1, doc: 'how much of the arrow is drawn (0 = none, 1 = all)' },
  },
};

const UP = new THREE.Vector3(0, 1, 0);

export function build(params, ctx) {
  const th = params.thickness;
  const mat = ctx.mat.solid(ctx.color(params.color), { rough: 0.4, rim: 0.4 });
  const shaftGeo = new THREE.CylinderGeometry(th / 2, th / 2, 1, 20);
  shaftGeo.translate(0, 0.5, 0);                       // base at 0, top at 1
  const headGeo = new THREE.ConeGeometry(th * 1.6, th * 3.2, 24);
  headGeo.translate(0, -th * 1.6, 0);                  // tip at 0
  const shaft = new THREE.Mesh(shaftGeo, mat), head = new THREE.Mesh(headGeo, mat);
  const group = new THREE.Group();
  group.add(shaft, head);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), dir = new THREE.Vector3();

  return {
    object: group,
    update(t, state) {
      const { from, to } = state.points;
      a.fromArray(from.at); b.fromArray(to.at);
      dir.subVectors(b, a);
      const full = dir.length();
      dir.normalize();
      // Start and stop just outside props, so the arrow touches them instead of piercing them.
      const startGap = from.radius ? from.radius * 1.05 : 0, endGap = to.radius ? to.radius * 1.08 : 0;
      const usable = Math.max(0, full - startGap - endGap);
      const len = usable * state.params.length;
      group.visible = len > 0.01;
      group.position.copy(a).addScaledVector(dir, startGap);
      group.quaternion.setFromUnitVectors(UP, dir);
      const headLen = Math.min(th * 3.2, len * 0.6);
      shaft.scale.set(1, Math.max(0.001, len - headLen * 0.9), 1);
      head.position.set(0, len, 0);
      head.scale.setScalar(headLen / (th * 3.2) || 0.001);
    },
    dispose() { shaftGeo.dispose(); headGeo.dispose(); mat.dispose(); },
  };
}
