// Prop: battery. A chunky cylinder cell with a + cap and a window showing the charge level (red -> green).
// Exports: meta, build(params, ctx). Stands upright. The colour is the label colour of the body.

import * as THREE from 'three';
import { rbox, kit } from './lib/machines.js';

export const meta = {
  name: 'battery',
  summary: 'A cylinder battery with a charge window that fills and turns red to green. For energy, power, charging.',
  tags: ['machine', 'energy', 'everyday'],
  floats: false,
  params: { color: { type: 'color', default: '#2d6ed6', doc: 'body colour' } },
  animatable: { charge: { min: 0, max: 1, default: 0.6, doc: 'charge level: window fill and colour (0 = empty red, 1 = full green)' } },
};

const H = 0.42;   // height of the charge window's fill at full charge

export function build(params, ctx) {
  const k = kit(ctx), group = new THREE.Group();
  const m = (g, mt, x, y, z) => k.mesh(g, mt, x, y, z, group);
  const metal = k.mat(0xc4ccd6, { rough: 0.3, metal: 0.8 });
  const dark = k.mat(0x20242c, { rough: 0.5 });
  m(new THREE.CylinderGeometry(0.28, 0.28, 0.68, 40), k.main(ctx.color(params.color), { rough: 0.35, rim: 0.35 }), 0, 0, 0);
  for (const y of [-0.37, 0.37]) m(new THREE.CylinderGeometry(0.285, 0.285, 0.06, 40), metal, 0, y, 0);
  m(new THREE.CylinderGeometry(0.1, 0.11, 0.1, 24), metal, 0, 0.44, 0);
  // A + on the top of the cap and on the body.
  const white = k.mat(0xffffff, { rough: 0.4, emissive: 0.15 });
  m(rbox(0.075, 0.012, 0.02, 0.005), dark, 0, 0.495, 0); m(rbox(0.02, 0.012, 0.075, 0.005), dark, 0, 0.495, 0);
  m(rbox(0.09, 0.022, 0.012, 0.005), white, 0, 0.27, 0.285); m(rbox(0.022, 0.09, 0.012, 0.005), white, 0, 0.27, 0.285);
  // Charge window (frame + fill that grows from the bottom) with three tick marks.
  m(rbox(0.2, 0.5, 0.05, 0.03), dark, 0, -0.05, 0.28);
  const fillMat = k.raw(new THREE.MeshStandardMaterial({ color: 0x33cc55, roughness: 0.3, emissive: 0x33cc55, emissiveIntensity: 0.9 }));
  const fg = new THREE.BoxGeometry(0.13, 1, 0.04); fg.translate(0, 0.5, 0);
  const fill = m(fg, fillMat, 0, -0.26, 0.292);
  for (const y of [-0.15, -0.05, 0.05]) m(rbox(0.15, 0.012, 0.01, 0.004), dark, 0, y, 0.316);
  return {
    object: group,
    update(t, state) {
      const c = Math.min(1, Math.max(0, state.params.charge));
      fill.visible = c > 0.01;
      fill.scale.y = H * c;
      const col = new THREE.Color().setHSL(0.34 * c, 0.85, 0.5);
      fillMat.color.copy(col); fillMat.emissive.copy(col);
      fillMat.emissiveIntensity = 0.9 + 0.08 * Math.sin(t * 3);
    },
    dispose() { k.dispose(); },
  };
}
