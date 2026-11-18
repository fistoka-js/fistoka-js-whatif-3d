// Prop: wire. A thin copper-coloured cable between two points, optionally bending up or down (it does not steer around props).
// Exports: meta, build(params, ctx). Animate "current" 0 -> 1 to make glowing charge dots travel along it.
// Stage-space prop (like arrow and beam): drawn between its points, no at/size/rotate, not normalised.

import * as THREE from 'three';

export const meta = {
  name: 'wire',
  summary: 'An electric wire between two points; "lift" bends it into a loop. Animate "current" 0->1 to send charge dots along it.',
  tags: ['energy', 'diagram', 'machine'],
  floats: true,
  stageSpace: true,
  reachParam: 'lift', // the engine's auto-framing widens by this param (extra height the wire reaches, up or down)
  params: {
    from: { type: 'point', default: 'left', doc: 'where the wire starts (slot, [x,y,z] or prop id; a prop id means its centre)' },
    to: { type: 'point', default: 'right', doc: 'where it ends (slot, [x,y,z] or prop id)' },
    lift: { type: 'number', min: -3, max: 3, default: 0, doc: 'bend: 0 = straight; above 0 goes up and across (like over the top of a loop) so the top is the higher end plus lift; below 0 goes down and across so the bottom is the lower end plus lift (lift is negative). It does not steer around props. Floor: when both ends are at y 0 or higher, the wire never sinks into the floor: its centre is held at least half its thickness plus 0.01 above y 0 (y 0.04 at the default width), even if an end is at y 0, so a wire already at floor level stays straight. If either end is below y 0 (space, no ground) there is no floor and nothing is held up' },
    color: { type: 'color', default: '#d9822b', doc: 'wire colour (copper by default; red or blue for insulated)' },
    width: { type: 'number', min: 0.02, max: 0.2, default: 0.06, doc: 'thickness of the wire' },
  },
  animatable: {
    current: { min: 0, max: 1, default: 0, doc: 'electric current: 0 = plain wire, 1 = bright charge dots racing along it' },
  },
};

const DOTS = 7, CORNER = 0.18;

// A path from a to b: straight, or out to a height, across, and back (corners rounded).
function makePath(a, b, lift, floorY) {
  a = a.clone(); b = b.clone();
  // floorY is -Infinity when there is no ground (an end below y 0), so nothing is held up
  a.y = Math.max(a.y, floorY); b.y = Math.max(b.y, floorY); // the tube's bottom stays above the floor, even for ends given at y 0
  const top = Math.max(lift >= 0 ? Math.max(a.y, b.y) + lift : Math.min(a.y, b.y) + lift, floorY);
  // Corner points; one sitting on an end is dropped, so an end already at the top height still bends at the other end.
  const P = [a];
  for (const [p, end] of [[new THREE.Vector3(a.x, top, a.z), a], [new THREE.Vector3(b.x, top, b.z), b]]) {
    if (p.distanceTo(end) >= 0.02 && p.distanceTo(P[P.length - 1]) >= 0.02) P.push(p);
  }
  P.push(b);
  const path = new THREE.CurvePath();
  if (Math.abs(lift) < 0.02 || P.length < 3) {
    path.add(new THREE.LineCurve3(a.clone(), b.clone()));
    return path;
  }
  let cur = P[0];
  for (let i = 1; i < P.length - 1; i++) {
    const r = Math.min(CORNER, P[i].distanceTo(P[i - 1]) / 2, P[i].distanceTo(P[i + 1]) / 2);
    const before = P[i].clone().lerp(P[i - 1], r / P[i].distanceTo(P[i - 1]));
    const after = P[i].clone().lerp(P[i + 1], r / P[i].distanceTo(P[i + 1]));
    // A vertical or zero-length wire folds back on itself; a rounded fold peaks r/2 short of its corner, so push the control point out by r.
    const ctrl = P[i].clone();
    const out = P[i].clone().sub(P[i - 1]).normalize();
    if (out.dot(P[i + 1].clone().sub(P[i]).normalize()) < -0.99) ctrl.addScaledVector(out, r);
    path.add(new THREE.LineCurve3(cur, before));
    path.add(new THREE.QuadraticBezierCurve3(before, ctrl, after));
    cur = after;
  }
  path.add(new THREE.LineCurve3(cur, b.clone()));
  return path;
}

export function build(params, ctx) {
  const color = new THREE.Color(ctx.color(params.color));
  const mat = ctx.mat.solid(color, { rough: 0.3, metal: 0.5, rim: 0.4, emissive: 0.1 });
  const white = new THREE.Color(0xffffff);
  const hot = color.clone().lerp(white, 0.6);
  let lastHex = null;
  const group = new THREE.Group();
  const dots = [];
  const capGeo = new THREE.SphereGeometry(params.width / 2, 12, 8); // round caps close the open tube ends
  const caps = [new THREE.Mesh(capGeo, mat), new THREE.Mesh(capGeo, mat)];
  group.add(...caps);
  const toCam = new THREE.Vector3(), wp = new THREE.Vector3();
  for (let i = 0; i < DOTS; i++) {
    const d = ctx.mat.glowSprite(hot, params.width * 7, 0); dots.push(d); group.add(d);
    // Draw the dot just in front of the tube (toward the camera) so the tube's front surface does not hide it,
    // while props standing in front of the wire still do. matrixWorld is rebuilt every frame, so this does not pile up.
    d.onBeforeRender = (r, s, cam) => {
      const e = d.matrixWorld.elements;
      toCam.setFromMatrixPosition(cam.matrixWorld).sub(wp.set(e[12], e[13], e[14])).setLength(params.width / 2 + 0.01);
      e[12] += toCam.x; e[13] += toCam.y; e[14] += toCam.z;
    };
  }
  let mesh = null, path = null, key = '';
  let glowAmount = 0; // set by the "glow" action (setGlow runs before update each frame)
  const a = new THREE.Vector3(), b = new THREE.Vector3();

  return {
    object: group,
    update(t, state) {
      const { from, to } = state.points;
      a.fromArray(from.at); b.fromArray(to.at);
      const lift = params.lift;
      const k = [...from.at, ...to.at, lift].map(v => v.toFixed(3)).join();
      if (k !== key) { // endpoints moved or lift changed: rebuild the tube
        key = k;
        // No ground when an end is below y 0 (space, no floor): then no clamp, or the wire would float off its props.
        path = makePath(a, b, lift, Math.min(a.y, b.y) < 0 ? -Infinity : params.width / 2 + 0.01);
        if (mesh) { group.remove(mesh); mesh.geometry.dispose(); }
        mesh = new THREE.Mesh(new THREE.TubeGeometry(path, Math.min(400, Math.max(64, Math.ceil(path.getLength() / 0.05))), params.width / 2, 10), mat);
        group.add(mesh);
        caps[0].position.copy(path.getPointAt(0)); caps[1].position.copy(path.getPointAt(1));
      }
      const cur = state.params.current;
      mat.emissiveIntensity = 0.1 + 0.5 * cur + 0.6 * glowAmount;
      dots.forEach((d, i) => {
        d.position.copy(path.getPointAt(((i / DOTS) + t * 0.35) % 1));
        // The dot rides the tube's centre line. Where its glow would dip below the floor, skip the depth test so the
        // floor cannot cut it (shortcut: such a low dot also shows through a prop standing in front of it).
        const size = Math.min(params.width * 7, params.width + 0.35); // a very thick wire does not get a screen-filling glow
        d.scale.setScalar(size);
        d.material.depthTest = Math.min(a.y, b.y) < 0 || d.position.y * 2 >= size; // no ground (an end below y 0): always depth-test
        d.material.opacity = (path.getLength() < 0.05 ? 0 : cur) * state.opacity; // no dots on a (near) zero-length wire: they would pile into one white blob
      });
    },
    setGlow(v) { glowAmount = v; },
    // The default recolour would leave the emissive copper, which washes a blue wire out pink at full current.
    // The engine calls this every frame, so do nothing unless the colour changed.
    setColor(hex) {
      if (hex === lastHex) return;
      lastHex = hex;
      mat.color.setHex(hex); mat.emissive.setHex(hex); mat.userData.rimColor.value.setHex(hex).lerp(white, 0.6);
      hot.setHex(hex).lerp(white, 0.6); dots.forEach(d => d.material.color.copy(hot));
    },
    // Where a label points: the middle of the wire itself (the bounding box middle can be empty air under a loop).
    labelPoint() { return path ? path.getPointAt(0.5) : null; },
    dispose() { if (mesh) mesh.geometry.dispose(); capGeo.dispose(); mat.dispose(); dots.forEach(d => d.material.dispose()); },
  };
}
