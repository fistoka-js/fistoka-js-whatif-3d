// Prop: bomb_blast. An explosion / impact burst: flash, fireball, smoke, shockwave rings and flying debris.
// Exports: meta, build(params, ctx). Driven entirely by "blast" 0..1 (0 = nothing visible, 1 = fully spread and faded).

import * as THREE from 'three';
import { kit } from './lib/machines.js';

export const meta = {
  name: 'bomb_blast',
  summary: 'An explosion burst: fireball, shockwave ring, smoke and debris. Animate "blast" 0..1. For impacts, bombs, asteroids.',
  tags: ['effect', 'energy'],
  floats: true,
  params: { color: { type: 'color', default: 'orange', doc: 'fire colour' } },
  animatable: { blast: { min: 0, max: 1, default: 0, doc: 'progress of the explosion (0 = not started / invisible, 1 = fully spread and faded)' } },
};

const ease = x => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
const smooth = (a, b, x) => { const u = Math.min(1, Math.max(0, (x - a) / (b - a))); return u * u * (3 - 2 * u); };

export function build(params, ctx) {
  const k = kit(ctx), group = new THREE.Group(), rng = ctx.rng;
  const fire = new THREE.Color(ctx.color(params.color));
  const basic = (c, extra = {}) => k.raw(new THREE.MeshBasicMaterial({ color: c, transparent: true, depthWrite: false, toneMapped: false, ...extra }));
  // Fireball: a core and a few lumps, all additive glowing spheres.
  const sph = new THREE.SphereGeometry(1, 24, 16);
  const lumps = [];
  // Solid-looking flame lumps in three shades (normal blending, so they read as fire, not as a white flash).
  const shades = [new THREE.Color(fire), new THREE.Color(fire).offsetHSL(-0.03, 0, -0.1), new THREE.Color(fire).offsetHSL(0.04, 0, 0.08)];
  const lumpMats = shades.map(c => k.mat(c.getHex(), { rough: 0.8, flat: true, emissive: 0.8, rim: 0.35, transparent: true }));
  lumpMats.forEach(m => { m.depthWrite = false; });
  const ico = new THREE.IcosahedronGeometry(1, 1);
  const coreMat = basic(0xffe58a);
  const core = k.mesh(sph, coreMat, 0, 0, 0, group);
  core.renderOrder = 6;
  for (let i = 0; i < 7; i++) {
    const a = i * 0.9 + rng() * 0.5, el = (rng() - 0.3) * 1.0;
    const l = k.mesh(ico, lumpMats[i % 3], 0, 0, 0, group);
    lumps.push({ m: l, d: new THREE.Vector3(Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el)), s: 0.5 + rng() * 0.35 });
  }
  // Smoke: dark lit puffs that swell late.
  const smokeMat = k.mat(0x6a626a, { rough: 1, rim: 0.05, flat: true, transparent: true, opacity: 0.5 });
  smokeMat.depthWrite = false;
  const smoke = [];
  for (let i = 0; i < 7; i++) {
    const a = rng() * 6.28, el = rng() * 1.0;
    smoke.push({ m: k.mesh(ico, smokeMat, 0, 0, 0, group), d: new THREE.Vector3(Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el)), s: 0.3 + rng() * 0.2 });
  }
  // Shockwave rings: one flat on the ground plane, one upright facing the viewer.
  const ringGeo = new THREE.RingGeometry(0.9, 1, 64);
  const ringMat = basic(0xffe6b8, { side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  const ringA = k.mesh(ringGeo, ringMat, 0, 0, 0, group); ringA.rotation.x = -Math.PI / 2;
  const ringB = k.mesh(ringGeo, ringMat, 0, 0, 0, group);
  // Debris: dark low-poly chunks thrown out in all directions, falling under gravity.
  const chunk = new THREE.IcosahedronGeometry(1, 0);
  const rockMat = k.mat(0x4a3f38, { rough: 0.8, flat: true });
  const embMat = k.mat(0xffa040, { rough: 0.6, flat: true, emissive: 0.8 });
  const debris = [];
  for (let i = 0; i < 30; i++) {
    const a = rng() * 6.28, el = Math.acos(1 - rng() * 1.5), sp = 0.45 + rng() * 0.5;
    debris.push({
      m: k.mesh(chunk, i % 4 === 0 ? embMat : rockMat, 0, 0, 0, group),
      v: new THREE.Vector3(Math.sin(el) * Math.cos(a), Math.cos(el), Math.sin(el) * Math.sin(a)).multiplyScalar(sp),
      s: 0.012 + rng() * 0.028, spin: [rng() * 8, rng() * 8],
    });
  }
  const flash = ctx.mat.glowSprite(0xffe9b0, 1.4, 0); k.raw(flash.material); group.add(flash);
  const haze = ctx.mat.glowSprite(fire.getHex(), 1.8, 0); k.raw(haze.material); group.add(haze);
    return {
    object: group,
    bounds: new THREE.Box3(new THREE.Vector3(-0.5, -0.5, -0.5), new THREE.Vector3(0.5, 0.5, 0.5)),
    update(t, state) {
      const b = state.params.blast, o = state.opacity;
      group.visible = b > 0.002;
      if (!group.visible) return;
      const grow = ease(b / 0.55), fade = 1 - smooth(0.4, 0.95, b);
      // Colour cools from yellow-white to deep orange-red as time passes.
      shades.forEach((sh, i) => { const cc = sh.clone().lerp(new THREE.Color(0x7a2410), smooth(0.25, 0.9, b)); lumpMats[i].color.copy(cc); lumpMats[i].emissive.copy(cc); lumpMats[i].opacity = 0.95 * fade * o; });
      coreMat.opacity = 0.95 * (1 - smooth(0.12, 0.55, b)) * o;
      core.scale.setScalar(0.04 + 0.2 * grow);
      for (const l of lumps) { l.m.position.copy(l.d).multiplyScalar(0.2 * grow); l.m.scale.setScalar((0.04 + 0.22 * grow) * l.s * 1.6); }
      const sw = smooth(0.12, 0.9, b), sf = 1 - smooth(0.7, 1, b);
      smokeMat.opacity = 0.5 * sf * o;
      for (const s of smoke) { s.m.position.copy(s.d).multiplyScalar(0.12 + 0.28 * sw); s.m.position.y += 0.1 * sw; s.m.scale.setScalar((0.03 + 0.17 * sw) * s.s * 1.6); }
      const rg = ease(b / 0.8);
      ringA.scale.setScalar(0.04 + 0.5 * rg); ringB.scale.setScalar(0.04 + 0.42 * ease(b / 0.7));
      ringMat.opacity = 0.9 * Math.pow(1 - b, 1.5) * o; ringA.visible = ringB.visible = b > 0.01;
      flash.material.opacity = Math.max(0, 1 - b * 6) * o; flash.scale.setScalar(0.4 + 1.4 * ease(b * 3));
      haze.material.opacity = 0.5 * fade * o; haze.scale.setScalar(0.7 + 1.0 * grow);
      for (const d of debris) {
        const e = ease(b / 0.9);
        d.m.position.copy(d.v).multiplyScalar(e);
        d.m.position.y -= 0.35 * b * b;
        d.m.scale.setScalar(d.s * (1 - smooth(0.82, 1, b)) * (b > 0.015 ? 1 : 0));
        d.m.rotation.set(d.spin[0] * b, d.spin[1] * b, 0);
      }
    },
    dispose() { sph.dispose(); ico.dispose(); ringGeo.dispose(); chunk.dispose(); k.dispose(); },
  };
}
