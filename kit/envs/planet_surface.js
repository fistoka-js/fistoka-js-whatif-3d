// Environment: planet_surface. The ground of another world: a low horizon, hazy ridges, scattered rocks, a big sky
// that darkens to stars, and an optional moon or ringed planet hanging above. Props stand on the ground at y = 0.
// Exports: meta, build(params, ctx).

import * as THREE from 'three';
import { gradientDome, pointLayer, motes, lightRig } from './lib/parts.js';
import { glowSprite } from '../engine/materials.js';
import { jitter } from '../props/lib/facets.js';
import { fbm } from '../props/lib/noise.js';

export const meta = {
  name: 'planet_surface',
  summary: 'The surface of another world: ground, low horizon, big sky with stars and an optional moon or ringed planet.',
  ground: true,
  params: {
    ground: { type: 'color', default: '#b5593a', doc: 'ground colour (Mars red, Moon grey, ...)' },
    sky: { type: 'color', default: '#e0a070', doc: 'sky colour at the horizon' },
    companion: { type: 'enum', values: ['none', 'moon', 'ringed'], default: 'moon', doc: 'a big body hanging in the sky' },
  },
};

const mix = (a, b, k) => new THREE.Color(a).lerp(new THREE.Color(b), k);

// A sphere painted with baked light (from the upper left) so it needs no scene lights. colorAt(x,y,z unit) -> Color.
function bakedSphere(R, colorAt) {
  const g = new THREE.SphereGeometry(R, 48, 32), p = g.attributes.position, cols = new Float32Array(p.count * 3);
  const L = new THREE.Vector3(-0.55, 0.45, 0.7).normalize(), n = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    n.set(p.getX(i), p.getY(i), p.getZ(i)).normalize();
    const lit = 0.1 + 0.95 * Math.max(0, n.dot(L));
    colorAt(n).multiplyScalar(lit).toArray(cols, i * 3);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }));
}

export function build(params, ctx) {
  const s = ctx.scale, rng = ctx.rng;
  const gc = ctx.color(params.ground), sc = ctx.color(params.sky);
  const group = new THREE.Group(), far = new THREE.Group();
  const horizon = mix(sc, 0xffffff, 0.12).getHex();
  far.add(gradientDome([[-1, mix(gc, 0x000000, 0.5).getHex()], [-0.02, horizon], [0.1, mix(sc, 0x101830, 0.35).getHex()], [0.35, mix(sc, 0x050814, 0.8).getHex()], [1, 0x02030a]]));
  // Stars: only up where the sky is dark.
  const stars = pointLayer({ rng, count: 700, size: 1.8, colors: [0xffffff, 0xcfe0ff, 0xfff1d6], opacity: 0.9, place: r => {
    const u = 0.14 + r() * 0.86, a = r() * Math.PI * 2, q = Math.sqrt(1 - u * u);
    return [Math.cos(a) * q * 380, u * 380, Math.sin(a) * q * 380];
  } });
  far.add(stars);
  // Small sun low on the horizon, behind the scene.
  const sun = glowSprite(0xfff3dc, 60, 0.9), core = glowSprite(0xffffff, 12, 1);
  sun.material.fog = core.material.fog = false; sun.position.set(220, 60, -300); core.position.copy(sun.position); far.add(sun, core);

  // The companion: a big moon (grey, cratered) or a ringed gas planet (banded). It follows the camera (infinitely far).
  if (params.companion !== 'none') {
    const R = 26, pos = new THREE.Vector3(-22, 46, -300);
    let body;
    if (params.companion === 'moon') {
      body = bakedSphere(R, n => mix(0x8a8a90, 0xd0d0d4, fbm(7, n.x * 3, n.y * 3, n.z * 3)).multiplyScalar(0.75 + 0.5 * Math.pow(fbm(3, n.x * 7, n.y * 7, n.z * 7), 2.5)));
    } else {
      body = bakedSphere(R, n => mix(0xd8a870, 0xf0dcb0, 0.5 + 0.5 * Math.sin(n.y * 22 + fbm(5, n.x * 2, n.y * 5, n.z * 2) * 5)));
      const rg = new THREE.RingGeometry(R * 1.35, R * 2.3, 96, 6), rp = rg.attributes.position, rc = new Float32Array(rp.count * 3);
      for (let i = 0; i < rp.count; i++) {
        const r = Math.hypot(rp.getX(i), rp.getY(i)) / R, band = 0.65 + 0.35 * Math.sin(r * 28);
        mix(0xe8d8b8, 0xa88a68, 0.5 + 0.5 * Math.sin(r * 11)).multiplyScalar(band).toArray(rc, i * 3);
      }
      rg.setAttribute('color', new THREE.Float32BufferAttribute(rc, 3));
      const ring = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: true, opacity: 0.8, fog: false, depthWrite: false }));
      ring.rotation.set(-1.25, 0, 0.35); body.add(ring);
    }
    body.position.copy(pos); body.rotation.y = 0.5;
    const halo = glowSprite(params.companion === 'moon' ? 0xdce6ff : 0xffe0b0, R * 3.4, 0.3); halo.material.fog = false; halo.position.copy(pos).add(new THREE.Vector3(0, 0, -2));
    far.add(halo, body);
  }
  group.add(far);

  // Ground: a big disc painted in patches. Far ridges (baked haze colour) give a skyline and depth.
  const geo = new THREE.CircleGeometry(100 * s, 96); geo.rotateX(-Math.PI / 2);
  const gp = geo.attributes.position, gcol = new Float32Array(gp.count * 3), c = new THREE.Color(), dark = mix(gc, 0x000000, 0.25);
  for (let i = 0; i < gp.count; i++) {
    const x = gp.getX(i) / s, z = gp.getZ(i) / s;
    c.copy(mix(gc, dark, fbm(11, x * 0.3, 0, z * 0.3)).lerp(new THREE.Color(horizon), Math.min(0.7, Math.hypot(x, z) / 120))).toArray(gcol, i * 3);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(gcol, 3));
  const ground = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true })); ground.renderOrder = -5; group.add(ground);
  for (const [r, h, haze, seed] of [[38, 2.2, 0.5, 21], [70, 3.5, 0.75, 22]]) {
    const rg = new THREE.RingGeometry(r * s, (r + 12) * s, 96, 1); rg.rotateX(-Math.PI / 2);
    const p = rg.attributes.position, cl = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const outer = Math.hypot(p.getX(i), p.getZ(i)) > (r + 6) * s, a = Math.atan2(p.getZ(i), p.getX(i));
      p.setY(i, outer ? s * h * (0.4 + 1.1 * fbm(seed, Math.cos(a) * 2.2, Math.sin(a) * 2.2, 0)) : 0);
      mix(mix(gc, 0x000000, 0.2), horizon, haze).toArray(cl, i * 3);
    }
    rg.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3));
    group.add(new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false })));
  }
  // Rocks, lit, scattered at a few distances.
  const rockMat = new THREE.MeshStandardMaterial({ color: mix(gc, 0x302824, 0.5).getHex(), roughness: 0.95, flatShading: true });
  for (let i = 0; i < 28; i++) {
    const rr = (1.3 + Math.pow(rng(), 0.7) * 16) * s, a = rng() * Math.PI * 2, sz = (0.08 + rng() * 0.35) * s * (0.6 + rr / (8 * s));
    const rk = new THREE.Mesh(jitter(new THREE.IcosahedronGeometry(sz, 0), rng, sz * 0.25), rockMat);
    rk.position.set(Math.cos(a) * rr, sz * 0.25, Math.sin(a) * rr - 2 * s); rk.scale.y = 0.55 + rng() * 0.4; rk.rotation.y = rng() * 6;
    group.add(rk);
  }
  const dust = motes(rng, { scale: s, count: 50, colors: [0xffffff, horizon], size: 0.03, opacity: 0.3 });
  group.add(dust.object);

  const lights = lightRig({
    key: [0xfff0e0, 3.0, [-3, 3.5, 4]], fill: [mix(sc, 0xffffff, 0.3).getHex(), 0.7, [5, 1, 3]], rim: [0xffd8b0, 2.6, [3, 3, -5]],
    sky: mix(sc, 0xffffff, 0.2).getHex(), ground: mix(gc, 0x000000, 0.4).getHex(), hemi: 0.8,
  });
  const fog = new THREE.Fog(mix(horizon, gc, 0.25).getHex(), 10 * s, 60 * s);
  return {
    object: group, lights, fog, background: horizon,
    update(t, cam) {
      far.position.fromArray(cam.position);
      fog.near = cam.distance * 2; fog.far = cam.distance * 12;
      stars.material.opacity = 0.9;
      dust.update(t);
    },
  };
}
