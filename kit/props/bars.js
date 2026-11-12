// Prop: bars. A 3D bar chart: 2 to 6 chunky bars on a base. Animate "grow" 0..1 (bars rise) and "highlight" (which glows).
// Exports: meta, build(params, ctx). Bar heights are relative to the tallest value. Labels come from the show's label actions.

import * as THREE from 'three';
import { rbox, kit } from './lib/machines.js';

export const meta = {
  name: 'bars',
  summary: 'A 3D bar chart of 2-6 chunky bars that rise and can glow. For comparing numbers, growth, rankings.',
  tags: ['info', 'chart'],
  floats: false,
  params: {
    values: { type: 'list', of: { type: 'number', min: 0, max: 1000000 }, min: 2, max: 6, default: [3, 5, 8, 6, 10], doc: 'bar sizes (the tallest fills the chart)' },
    colors: { type: 'list', of: { type: 'color' }, min: 1, max: 6, default: ['orange', 'yellow', 'green', 'blue', 'purple', 'pink'], doc: 'bar colours, in order (repeats if fewer than bars)' },
  },
  animatable: {
    grow: { min: 0, max: 1, default: 1, doc: 'how far the bars have risen (0 = flat, 1 = full height)' },
    highlight: { min: -1, max: 5, default: -1, doc: 'index of the bar that glows (0 = first; -1 = none)' },
  },
};

const MAXH = 0.8, W = 0.9, D = 0.3;

export function build(params, ctx) {
  const k = kit(ctx), group = new THREE.Group();
  const n = params.values.length, slot = W / n, bw = slot * 0.64;
  const top = Math.max(...params.values, 1e-9);
  k.mesh(rbox(1.0, 0.09, 0.46, 0.035), k.mat(0xdfe5ee, { rough: 0.5 }), 0, -0.045, 0, group);
  k.mesh(rbox(1.0, 0.025, 0.465, 0.01), k.mat(0x8893a6, { rough: 0.5 }), 0, -0.07, 0, group);
  const bars = [];
  const unit = new THREE.BoxGeometry(1, 1, 1); unit.translate(0, 0.5, 0);
  const capGeo = rbox(1, 0.035, 1, 0.012);
  for (let i = 0; i < n; i++) {
    const colour = ctx.color(params.colors[i % params.colors.length]);
    const mt = k.mat(colour, { rough: 0.4, rim: 0.3 });
    const capMt = k.mat(new THREE.Color(colour).lerp(new THREE.Color(0xffffff), 0.22).getHex(), { rough: 0.35 });
    const x = -W / 2 + slot * (i + 0.5);
    const g = new THREE.Group(); g.position.x = x; group.add(g);
    const body = k.mesh(unit, mt, 0, 0, 0, g), cap = k.mesh(capGeo, capMt, 0, 0, 0, g);
    const halo = ctx.mat.glowSprite(colour, 0.9, 0); k.raw(halo.material); g.add(halo);
    bars.push({ g, body, cap, mt, capMt, halo, h: params.values[i] / top * MAXH, c: new THREE.Color(colour) });
  }
  const tmp = new THREE.Color();
  return {
    object: group,
    bounds: new THREE.Box3(new THREE.Vector3(-0.5, -0.08, -0.23), new THREE.Vector3(0.5, MAXH + 0.04, 0.23)),
    update(t, state) {
      const grow = state.params.grow, hl = state.params.highlight;
      bars.forEach((b, i) => {
        const h = Math.max(0.0005, b.h * grow), w = Math.max(0, 1 - Math.abs(hl - i));
        const pw = bw * (1 + 0.1 * w);
        b.body.scale.set(pw, h, D * (1 + 0.1 * w)); b.cap.scale.set(pw * 1.04, 1, D * 1.04 * (1 + 0.1 * w));
        b.cap.position.y = h; b.cap.visible = grow > 0.02;
        for (const mt of [b.mt, b.capMt]) { mt.emissive.copy(tmp.copy(b.c)); mt.emissiveIntensity = 0.4 * w * (0.9 + 0.1 * Math.sin(t * 4)); }
        b.halo.position.y = h * 0.6; b.halo.scale.set(0.6 + h * 0.5, 0.4 + h * 1.2, 1); b.halo.material.opacity = 0.28 * w * state.opacity;
      });
    },
    dispose() { unit.dispose(); capGeo.dispose(); k.dispose(); },
  };
}
