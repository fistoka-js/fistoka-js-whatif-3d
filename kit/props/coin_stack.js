// Prop: coin_stack. Five stacks of chunky gold coins that grow with "amount" 0..1. For money, savings, cost, wealth.
// Exports: meta, build(params, ctx). The colour is the metal (default gold).

import * as THREE from 'three';
import { kit } from './lib/machines.js';

export const meta = {
  name: 'coin_stack',
  summary: 'Stacks of gold coins that grow taller. For money, savings, cost, price, wealth, budgets.',
  tags: ['info', 'money', 'everyday'],
  floats: false,
  params: { color: { type: 'color', default: 'gold', doc: 'coin metal colour' } },
  animatable: { amount: { min: 0, max: 1, default: 1, doc: 'how much money (0 = none, 1 = all stacks full height)' } },
};

// x, z, number of coins at full amount.
const STACKS = [[-0.3, 0.1, 7], [0, 0.1, 12], [0.3, 0.1, 6], [-0.15, -0.2, 9], [0.15, -0.2, 5]];
const T = 0.05, R = 0.12;

export function build(params, ctx) {
  const k = kit(ctx), group = new THREE.Group();
  const mat = k.main(ctx.color(params.color), { rough: 0.28, metal: 0.8, flat: true, rim: 0.3 });
  // A coin: a disc with a raised rim and a dished face, as one lathe shape.
  const prof = [[0, -T / 2], [R, -T / 2], [R, T / 2], [R * 0.8, T / 2], [R * 0.76, T / 2 - 0.012], [0, T / 2 - 0.012]];
  const geo = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 20);
  const coins = [];
  for (const [x, z, n] of STACKS) {
    const list = [];
    for (let i = 0; i < n; i++) {
      const c = k.mesh(geo, mat, x + (ctx.rng() - 0.5) * 0.012, T / 2 + i * T, z + (ctx.rng() - 0.5) * 0.012, group);
      c.rotation.y = ctx.rng() * 6.28;
      list.push(c);
    }
    coins.push({ n, list });
  }
  return {
    object: group,
    bounds: new THREE.Box3(new THREE.Vector3(-0.42, 0, -0.32), new THREE.Vector3(0.42, 12 * T, 0.22)),
    update(t, state) {
      const a = state.params.amount;
      for (const s of coins) { const shown = Math.round(a * s.n); s.list.forEach((c, i) => { c.visible = i < shown; }); }
    },
    dispose() { geo.dispose(); mat.dispose(); },
  };
}
