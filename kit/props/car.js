// Prop: car. A chunky toy vehicle: car, truck or bus, with round wheels that turn when "driving" is on.
// Exports: meta, build(params, ctx). Faces +x (side view shows the shape). Main colour = the painted body.

import * as THREE from 'three';
import { rbox, kit } from './lib/machines.js';

export const meta = {
  name: 'car',
  summary: 'A chunky toy car, truck or bus with turning wheels. For traffic, transport, fuel, speed, commuting.',
  tags: ['machine', 'vehicle'],
  floats: false,
  params: {
    color: { type: 'color', default: 'red', doc: 'paint colour' },
    style: { type: 'enum', values: ['car', 'truck', 'bus'], default: 'car', doc: 'which vehicle' },
    driving: { type: 'bool', default: false, doc: 'wheels turn and the body jiggles' },
  },
  animatable: {},
};

const GLASS = 0x34506e, DARK = 0x23262e;

export function build(params, ctx) {
  const k = kit(ctx), group = new THREE.Group(), body = new THREE.Group();
  group.add(body);
  const paint = k.main(ctx.color(params.color), { rough: 0.35, rim: 0.3 });
  const glass = k.mat(GLASS, { rough: 0.12, metal: 0.2 });
  const dark = k.mat(DARK, { rough: 0.6 });
  const cream = k.mat(0xeef1f5, { rough: 0.5 });
  const lamp = k.mat(0xfff0b0, { rough: 0.2, emissive: 0.8 });
  const tail = k.mat(0xff3030, { rough: 0.3, emissive: 0.6 });
  const m = (g, mt, x, y, z) => k.mesh(g, mt, x, y, z, body);
  const lights = (x0, x1, y, z) => {
    for (const s of [-1, 1]) {
      m(new THREE.SphereGeometry(0.04, 12, 8), lamp, x0, y, s * z).scale.set(0.5, 1, 1);
      m(new THREE.SphereGeometry(0.035, 12, 8), tail, x1, y, s * z).scale.set(0.5, 1, 1);
    }
  };
  let wheelR = 0.13, axles;
  if (params.style === 'car') {
    m(rbox(1.0, 0.26, 0.5, 0.09), paint, 0, 0.27, 0);
    m(rbox(0.5, 0.22, 0.42, 0.07), glass, -0.06, 0.5, 0);
    m(rbox(0.54, 0.05, 0.47, 0.04), paint, -0.06, 0.625, 0);
    for (const s of [-1, 1]) m(rbox(0.07, 0.22, 0.47, 0.03), paint, -0.06 + s * 0.255, 0.5, 0);
    m(rbox(0.05, 0.09, 0.5, 0.03), dark, 0.5, 0.2, 0); m(rbox(0.05, 0.09, 0.5, 0.03), dark, -0.5, 0.2, 0);
    lights(0.5, -0.5, 0.31, 0.15); axles = [0.3, -0.3];
  } else if (params.style === 'truck') {
    m(rbox(1.0, 0.1, 0.44, 0.03), dark, 0, 0.19, 0);
    m(rbox(0.38, 0.46, 0.5, 0.08), paint, 0.31, 0.4, 0);
    m(rbox(0.2, 0.17, 0.51, 0.04), glass, 0.37, 0.53, 0);
    m(rbox(0.02, 0.17, 0.4, 0.02), glass, 0.495, 0.53, 0);
    m(rbox(0.6, 0.52, 0.54, 0.04), cream, -0.2, 0.5, 0);
    m(rbox(0.04, 0.1, 0.5, 0.02), dark, 0.5, 0.25, 0);
    lights(0.5, -0.5, 0.31, 0.17); wheelR = 0.14; axles = [0.33, -0.08, -0.34];
  } else {
    m(rbox(1.0, 0.54, 0.5, 0.1), paint, 0, 0.42, 0);
    m(rbox(0.84, 0.17, 0.51, 0.05), glass, -0.04, 0.55, 0);
    m(rbox(0.02, 0.26, 0.42, 0.02), glass, 0.495, 0.5, 0);
    m(rbox(1.01, 0.05, 0.505, 0.02), cream, 0, 0.33, 0);
    m(rbox(0.4, 0.06, 0.3, 0.03), cream, -0.1, 0.72, 0);
    lights(0.5, -0.5, 0.25, 0.17); axles = [0.32, -0.3];
  }
  // Wheels: a dark tyre, a light hub and a little cross so the turning is visible.
  const wheels = [];
  const tyre = new THREE.CylinderGeometry(wheelR, wheelR, 0.1, 24); tyre.rotateX(Math.PI / 2);
  const hub = new THREE.CylinderGeometry(wheelR * 0.55, wheelR * 0.55, 0.106, 16); hub.rotateX(Math.PI / 2);
  const spoke = rbox(wheelR * 0.8, 0.025, 0.02, 0.01);
  const hubMat = k.mat(0xcfd5dd, { metal: 0.5, rough: 0.35 });
  const tyreMat = k.mat(0x1c1e24, { rough: 0.8 });
  for (const x of axles) for (const s of [-1, 1]) {
    const w = new THREE.Group(); w.position.set(x, wheelR, s * 0.27); body.add(w);
    k.mesh(tyre, tyreMat, 0, 0, 0, w); k.mesh(hub, hubMat, 0, 0, 0, w);
    for (let i = 0; i < 2; i++) { const sp = k.mesh(spoke, dark, 0, 0, s * 0.056, w); sp.rotation.z = i * Math.PI / 2; }
    wheels.push(w);
  }
  return {
    object: group,
    update(t) {
      if (!params.driving) return;
      for (const w of wheels) w.rotation.z = -t * 9;
      body.position.y = 0.006 * Math.sin(t * 17);
      body.rotation.z = 0.006 * Math.sin(t * 11);
    },
    dispose() { tyre.dispose(); hub.dispose(); k.dispose(); },
  };
}
