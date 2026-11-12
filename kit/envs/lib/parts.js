// Building blocks shared by the environments: gradient dome, star/mote layers, the three-light rig.
// Exports: gradientDome(colors, radius), pointLayer(opts), lightRig(opts), motes(rng, opts).
// Every env uses these so that each one has a background with depth, haze, parallax layers and key/fill/rim lights.

import * as THREE from 'three';
import { glowTexture } from '../../engine/materials.js';

// A big sphere seen from inside, coloured by height: stops = [[y (-1..1), 0xRRGGBB], ...] from bottom to top.
// It follows the camera (see env update) so it always looks infinitely far away. Not affected by fog.
export function gradientDome(stops, radius = 500) {
  const geo = new THREE.SphereGeometry(radius, 48, 32);
  const pos = geo.attributes.position, cols = new Float32Array(pos.count * 3);
  const c = new THREE.Color(), a = new THREE.Color(), b = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / radius;
    let j = 0;
    while (j < stops.length - 2 && y > stops[j + 1][0]) j++;
    const [y0, c0] = stops[j], [y1, c1] = stops[j + 1];
    const k = Math.min(1, Math.max(0, (y - y0) / (y1 - y0)));
    c.copy(a.setHex(c0)).lerp(b.setHex(c1), k * k * (3 - 2 * k));
    c.toArray(cols, i * 3);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = -10;
  return mesh;
}

// Points with a soft round sprite. opts: { rng, count, place(rng) -> [x,y,z], size, colors: [hex], opacity, fog, additive }
export function pointLayer(opts) {
  const { rng, count } = opts;
  const pos = new Float32Array(count * 3), cols = new Float32Array(count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const p = opts.place(rng);
    pos[i * 3] = p[0]; pos[i * 3 + 1] = p[1]; pos[i * 3 + 2] = p[2];
    c.setHex(opts.colors[Math.floor(rng() * opts.colors.length)]).multiplyScalar(0.55 + 0.45 * rng());
    c.toArray(cols, i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const mat = new THREE.PointsMaterial({
    size: opts.size, map: glowTexture(), vertexColors: true, transparent: true, depthWrite: false,
    opacity: opts.opacity ?? 1, fog: !!opts.fog, sizeAttenuation: true,
    blending: opts.additive === false ? THREE.NormalBlending : THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return pts;
}

// Slow floating specks at several depths around the stage, so camera motion shows parallax.
// opts: { scale (stage size), count, colors, size, opacity, additive }. Returns { object, update(t) }.
export function motes(rng, opts) {
  const s = opts.scale;
  const layer = pointLayer({
    rng, count: opts.count, colors: opts.colors, size: opts.size * s, opacity: opts.opacity ?? 0.7, fog: true, additive: opts.additive,
    place: r => [(r() - 0.5) * 9 * s, (r() - 0.35) * 7 * s, (r() * -14 + 3.5) * s],
  });
  const base = layer.geometry.attributes.position.array.slice();
  return {
    object: layer,
    update(t) {
      // Each speck drifts on its own slow loop: a pure function of t.
      const arr = layer.geometry.attributes.position.array;
      for (let i = 0; i < arr.length; i += 3) {
        const ph = i * 0.37;
        arr[i] = base[i] + Math.sin(t * 0.13 + ph) * 0.12 * s;
        arr[i + 1] = base[i + 1] + Math.sin(t * 0.09 + ph * 1.7) * 0.1 * s + t * 0.015 * s;
        arr[i + 2] = base[i + 2] + Math.cos(t * 0.11 + ph) * 0.1 * s;
      }
      layer.geometry.attributes.position.needsUpdate = true;
    },
  };
}

// Key + fill + rim lights (and a hemisphere fill). opts: { key: [hex, intensity, [x,y,z]], rim: [...], sky, ground, hemi }
export function lightRig(opts) {
  const key = new THREE.DirectionalLight(opts.key[0], opts.key[1]);
  key.position.fromArray(opts.key[2]);
  const rim = new THREE.DirectionalLight(opts.rim[0], opts.rim[1]);
  rim.position.fromArray(opts.rim[2]);
  const fill = new THREE.DirectionalLight(opts.fill[0], opts.fill[1]);
  fill.position.fromArray(opts.fill[2]);
  const hemi = new THREE.HemisphereLight(opts.sky, opts.ground, opts.hemi);
  return [key, fill, rim, hemi];
}
