// Prop: ball. A simple lit sphere: a marble, a molecule, a planet stand-in, a pinball.
// Exports: meta, build(params, ctx). Copy this file to start a new simple prop.

import * as THREE from 'three';

export const meta = {
  name: 'ball',
  summary: 'A shiny or matte sphere in any colour (marble, molecule, pinball, drop).',
  tags: ['basic'],
  floats: false,
  params: {
    color: { type: 'color', default: 'blue', doc: 'main colour' },
    finish: { type: 'enum', values: ['glossy', 'matte', 'metal', 'facets'], default: 'glossy', doc: 'surface: glossy, matte, metal, or low-poly facets' },
  },
  animatable: {},
};

// Surface settings per finish: roughness, metalness, flat shading, sphere detail.
const FINISH = {
  glossy: { rough: 0.25, metal: 0.05, flat: false },
  matte: { rough: 0.85, metal: 0, flat: false },
  metal: { rough: 0.3, metal: 0.85, flat: false },
  facets: { rough: 0.5, metal: 0, flat: true },
};

export function build(params, ctx) {
  const f = FINISH[params.finish];
  const geo = f.flat ? new THREE.IcosahedronGeometry(0.5, 1) : new THREE.SphereGeometry(0.5, 48, 32);
  const mat = ctx.mat.solid(ctx.color(params.color), { rough: f.rough, metal: f.metal, flat: f.flat });
  const mesh = new THREE.Mesh(geo, mat);
  return {
    object: mesh,
    dispose() { geo.dispose(); mat.dispose(); },
  };
}
