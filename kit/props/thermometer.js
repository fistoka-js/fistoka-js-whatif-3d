// Prop: thermometer. A glass tube and bulb on a backplate with tick marks; liquid rises and shifts blue to red.
// Exports: meta, build(params, ctx). Stands upright. The colour is the backplate.

import * as THREE from 'three';
import { rbox, kit } from './lib/machines.js';

export const meta = {
  name: 'thermometer',
  summary: 'A thermometer whose liquid rises and turns blue to red. For temperature, heat, cold, fever, climate.',
  tags: ['machine', 'everyday', 'info'],
  floats: false,
  params: { color: { type: 'color', default: '#f3f5f9', doc: 'backplate colour' } },
  animatable: { level: { min: 0, max: 1, default: 0.5, doc: 'temperature (0 = cold blue, low; 1 = hot red, high)' } },
};

const COLD = new THREE.Color(0x2f86ff), HOT = new THREE.Color(0xff2a18);
const BY = -0.37, TOP = 0.36;   // bulb centre and top of the tube

export function build(params, ctx) {
  const k = kit(ctx), group = new THREE.Group();
  const m = (g, mt, x, y, z) => k.mesh(g, mt, x, y, z, group);
  const plate = k.main(ctx.color(params.color), { rough: 0.5, rim: 0.2 });
  m(rbox(0.3, 1.0, 0.06, 0.07), plate, 0, 0, 0);
  const disc = new THREE.CylinderGeometry(0.17, 0.17, 0.06, 28); disc.rotateX(Math.PI / 2);
  m(disc, plate, 0, BY, 0);
  const dark = k.mat(0x2b3140, { rough: 0.5 });
  for (let i = 0; i < 9; i++) m(rbox(i % 2 ? 0.05 : 0.09, 0.014, 0.012, 0.005), dark, 0.1 + (i % 2 ? 0.0 : 0.02), -0.2 + i * 0.07, 0.036);
  // Glass: tube and bulb, see-through, over the coloured liquid.
  const glass = k.mat(0xdff2ff, { rough: 0.05, rim: 0.5, transparent: true, opacity: 0.16 });
  glass.depthWrite = false;
  m(new THREE.CapsuleGeometry(0.05, TOP - BY, 8, 16), glass, 0, (TOP + BY) / 2, 0.075).renderOrder = 2;
  m(new THREE.SphereGeometry(0.125, 24, 16), glass, 0, BY, 0.075).renderOrder = 2;
  const liquid = k.raw(new THREE.MeshStandardMaterial({ color: 0xff3030, roughness: 0.25, emissive: 0xff3030, emissiveIntensity: 0.3 }));
  m(new THREE.SphereGeometry(0.098, 24, 16), liquid, 0, BY, 0.075);
  const lg = new THREE.CylinderGeometry(0.034, 0.034, 1, 14); lg.translate(0, 0.5, 0);
  const col = m(lg, liquid, 0, BY, 0.075);
  const tip = m(new THREE.SphereGeometry(0.034, 14, 10), liquid, 0, BY, 0.075);
  return {
    object: group,
    update(t, state) {
      const v = Math.min(1, Math.max(0, state.params.level));
      const len = 0.08 + (TOP - BY - 0.08) * v;
      col.scale.y = len; tip.position.y = BY + len;
      const c = COLD.clone().lerp(HOT, v);
      liquid.color.copy(c); liquid.emissive.copy(c);
    },
    dispose() { k.dispose(); },
  };
}
