// Prop: lightbulb. A glass bulb with a coil filament and a screw base. Animate "on" 0..1 to light it up.
// Exports: meta, build(params, ctx). Stands upright (base down). The colour is the light's colour.

import * as THREE from 'three';
import { kit } from './lib/machines.js';

export const meta = {
  name: 'lightbulb',
  summary: 'A glass lightbulb that can light up. For ideas, electricity, energy use, efficiency, brightness.',
  tags: ['machine', 'energy', 'everyday'],
  floats: false,
  params: { color: { type: 'color', default: '#ffd36b', doc: 'colour of the light when on' } },
  animatable: { on: { min: 0, max: 1, default: 0, doc: 'brightness (0 = off, 1 = glowing)' } },
};

export function build(params, ctx) {
  const k = kit(ctx), group = new THREE.Group();
  const light = new THREE.Color(ctx.color(params.color));
  const m = (g, mt, x, y, z) => k.mesh(g, mt, x, y, z, group);
  // Glass: a see-through lathe shape (round bulb narrowing into the neck). Glows warm when on.
  const prof = [[0.12, 0], [0.13, 0.08], [0.18, 0.17], [0.26, 0.28], [0.3, 0.42], [0.29, 0.55], [0.22, 0.67], [0.12, 0.74], [0, 0.76]];
  const glass = k.mat(0xcfe6f5, { rough: 0.05, rim: 0.9, transparent: true, opacity: 0.32 });
  glass.depthWrite = false;
  m(new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 40), glass, 0, 0, 0).renderOrder = 2;
  // Screw base: metal rings, a darker core and a bronze tip.
  const metal = k.mat(0xb7bfca, { rough: 0.3, metal: 0.8 });
  m(new THREE.CylinderGeometry(0.115, 0.115, 0.3, 24), k.mat(0x6a7380, { rough: 0.5, metal: 0.6 }), 0, -0.13, 0);
  for (let i = 0; i < 4; i++) { const t = m(new THREE.TorusGeometry(0.12, 0.022, 8, 28), metal, 0, -0.03 - i * 0.065, 0); t.rotation.x = Math.PI / 2; }
  m(new THREE.SphereGeometry(0.06, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), k.mat(0xa8793f, { metal: 0.7, rough: 0.35 }), 0, -0.28, 0);
  // Support wires and the filament coil.
  const wire = k.mat(0x3a3f48, { rough: 0.5 });
  for (const s of [-1, 1]) { const w = m(new THREE.CylinderGeometry(0.006, 0.006, 0.38, 6), wire, s * 0.035, 0.2, 0); w.rotation.z = s * -0.12; }
  const pts = [];
  for (let i = 0; i <= 16; i++) pts.push(new THREE.Vector3(-0.07 + 0.14 * i / 16, 0.4 + (i % 2 ? 0.035 : -0.035), 0));
  const fil = k.raw(new THREE.MeshStandardMaterial({ color: 0x555a63, roughness: 0.5, emissive: 0x000000 }));
  m(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.009, 6), fil, 0, 0, 0);
  // Glow halo (not part of the size).
  const halo = ctx.mat.glowSprite(light.getHex(), 1.5, 0); halo.position.set(0, 0.42, 0);
  halo.material.fog = false; k.raw(halo.material); group.add(halo);
  const hot = new THREE.Color(0xffffff);
  return {
    object: group,
    update(t, state) {
      const on = state.params.on, flick = 1 + 0.015 * Math.sin(t * 31);
      fil.color.set(0x555a63).lerp(hot, on); fil.emissive.copy(light).lerp(hot, 0.4); fil.emissiveIntensity = 2.2 * on * flick;
      glass.emissive.copy(light); glass.emissiveIntensity = 0.55 * on;
      halo.material.opacity = 0.85 * on * state.opacity * flick;
    },
    dispose() { k.dispose(); },
  };
}
