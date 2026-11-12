// Prop: tree. A stylised low-poly tree: round, pine, palm or bare, with a tiny sway.
// Exports: meta, build(params, ctx). The shapes live in lib/plants.js (shared with the island prop).

import { buildTree } from './lib/plants.js';

export const meta = {
  name: 'tree',
  summary: 'A chunky low-poly tree: round, pine, palm or bare. Good for forests, seasons, deforestation, carbon.',
  tags: ['nature', 'earth', 'plant'],
  floats: false,
  params: {
    style: { type: 'enum', values: ['round', 'pine', 'palm', 'bare'], default: 'round', doc: 'kind of tree' },
    color: { type: 'color', default: null, doc: 'tint the leaves (bare tree: the wood); default natural colours' },
    seed: { type: 'int', min: 0, max: 999, default: 1, doc: 'which variant of the shape' },
  },
  animatable: {},
};

export function build(params, ctx) {
  const tree = buildTree(params.style, ctx, params.seed);
  return {
    object: tree.object,
    update(t) { tree.sway(t); },
    setColor(hex) { tree.setTint(hex); }, // white = natural colours
    dispose() { tree.dispose(); },
  };
}
