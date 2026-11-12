// Prop: phone. A smartphone slab with rounded corners and a glowing screen of app tiles. Animate "on" 0..1.
// Exports: meta, build(params, ctx). Stands upright, screen toward +z. The colour is the phone body.

import * as THREE from 'three';
import { rbox, kit } from './lib/machines.js';

export const meta = {
  name: 'phone',
  summary: 'A smartphone with a glowing screen. For screens, apps, social media, notifications, attention.',
  tags: ['machine', 'everyday', 'tech'],
  floats: false,
  params: {
    color: { type: 'color', default: '#2a2f3a', doc: 'phone body colour' },
    screen: { type: 'color', default: 'cyan', doc: 'screen glow colour' },
  },
  animatable: { on: { min: 0, max: 1, default: 1, doc: 'screen on (0 = dark, 1 = glowing)' } },
};

export function build(params, ctx) {
  const k = kit(ctx), group = new THREE.Group();
  const m = (g, mt, x, y, z, p = group) => k.mesh(g, mt, x, y, z, p);
  const glow = new THREE.Color(ctx.color(params.screen));
  m(rbox(0.52, 1.0, 0.08, 0.08), k.main(ctx.color(params.color), { rough: 0.3, metal: 0.4, rim: 0.4 }), 0, 0, 0);
  for (const y of [0.18, 0.1]) m(rbox(0.012, 0.07, 0.012, 0.004), k.mat(0x8892a0, { metal: 0.7 }), 0.265, y, 0);
  // Screen: dark glass that lights up in the screen colour; tiles and status bar are only visible when on.
  const scr = k.raw(new THREE.MeshStandardMaterial({ color: 0x0a0e14, roughness: 0.15, emissive: 0x000000 }));
  m(rbox(0.45, 0.9, 0.01, 0.055), scr, 0, 0, 0.04);
  const ui = new THREE.Group(); ui.position.z = 0.047; group.add(ui);
  const uiMats = [];
  const tileMat = (c, a) => { const t = k.raw(new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: a, toneMapped: false })); uiMats.push([t, a]); return t; };
  const white = tileMat(0xffffff, 0.9);
  const hues = [0.0, 0.08, 0.15, 0.33, 0.5, 0.58, 0.72, 0.85];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) {
    const col = new THREE.Color().setHSL(hues[(r * 3 + c) % hues.length], 0.75, 0.62);
    m(rbox(0.095, 0.095, 0.006, 0.028), tileMat(col, 0.95), -0.125 + c * 0.125, 0.24 - r * 0.13, 0, ui);
  }
  m(rbox(0.3, 0.02, 0.006, 0.01), white, 0, 0.4, 0, ui);                 // status bar
  m(rbox(0.3, 0.075, 0.006, 0.03), tileMat(0xffffff, 0.35), 0, -0.34, 0, ui);   // dock
  const halo = ctx.mat.glowSprite(glow.getHex(), 1.6, 0); halo.position.z = 0.08; k.raw(halo.material); group.add(halo);
  return {
    object: group,
    update(t, state) {
      const on = state.params.on;
      scr.color.set(0x0a0e14).lerp(glow.clone().multiplyScalar(0.35), on); scr.emissive.copy(glow); scr.emissiveIntensity = 0.75 * on;
      ui.visible = on > 0.02;
      for (const [mt, a] of uiMats) mt.opacity = a * on * state.opacity;
      halo.material.opacity = 0.4 * on * state.opacity;
    },
    dispose() { k.dispose(); },
  };
}
