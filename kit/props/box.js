// Prop: box. A rounded box: a block, a crate, a bumper, a building stand-in.
// Exports: meta, build(params, ctx).

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const meta = {
  name: 'box',
  summary: 'A rounded box in any colour and proportions (block, crate, bumper, wall).',
  tags: ['basic'],
  floats: false,
  params: {
    color: { type: 'color', default: 'orange', doc: 'main colour' },
    finish: { type: 'enum', values: ['matte', 'glossy', 'metal'], default: 'matte', doc: 'surface' },
    width: { type: 'number', min: 0.05, max: 1, default: 1, doc: 'width compared to the other sides' },
    height: { type: 'number', min: 0.05, max: 1, default: 1, doc: 'height compared to the other sides' },
    depth: { type: 'number', min: 0.05, max: 1, default: 1, doc: 'depth compared to the other sides' },
    round: { type: 'number', min: 0, max: 0.5, default: 0.12, doc: 'how rounded the edges are (share of the smallest side)' },
  },
  animatable: {},
};

const FINISH = { matte: { rough: 0.7, metal: 0 }, glossy: { rough: 0.25, metal: 0.05 }, metal: { rough: 0.3, metal: 0.85 } };

export function build(params, ctx) {
  const { width: w, height: h, depth: d } = params;
  const radius = Math.min(w, h, d) * params.round;
  const geo = new RoundedBoxGeometry(w, h, d, 3, Math.max(0.001, radius));
  const f = FINISH[params.finish];
  const mat = ctx.mat.solid(ctx.color(params.color), { rough: f.rough, metal: f.metal });
  const mesh = new THREE.Mesh(geo, mat);
  return {
    object: mesh,
    dispose() { geo.dispose(); mat.dispose(); },
  };
}
