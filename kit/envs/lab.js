// Environment: lab. A dark neutral room: a faint grid floor that fades into darkness, a soft pool of light under the
// subject, a faint glow on the back wall and thin light strips at two depths. Good for objects, machines and charts.
// Exports: meta, build(params, ctx).

import * as THREE from 'three';
import { gradientDome, motes, lightRig } from './lib/parts.js';
import { glowSprite } from '../engine/materials.js';

export const meta = {
  name: 'lab',
  summary: 'A dark neutral lab / showroom with a faint grid floor and a spotlight pool. For machines, objects and charts.',
  ground: true,
  dialParams: ['color'],          // the accent colour can follow a dial (setColors below)
  params: { color: { type: 'color', default: 'cyan', doc: 'accent colour of the grid, wall glow and rim light' } },
};

// Floor shader: dark floor, faint grid lines in the accent colour, a pool of light under the subject, fade-out with distance.
function floorMaterial(accent, s) {
  return new THREE.ShaderMaterial({
    uniforms: { uAccent: { value: accent }, uS: { value: s } },
    vertexShader: 'varying vec3 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: 'uniform vec3 uAccent; uniform float uS; varying vec3 vW;\n' +
      'float grid(vec2 p, float cell, float w) { vec2 g = abs(fract(p / cell - 0.5) - 0.5) * cell; float d = min(g.x, g.y); return 1.0 - smoothstep(0.0, w, d); }\n' +
      'void main() { vec2 p = vW.xz; float r = length(p) / uS;\n' +
      'float fade = 1.0 - smoothstep(4.0, 26.0, r);\n' +
      'float lines = grid(p, 0.5 * uS, 0.012 * uS) * 0.9 + grid(p, 2.5 * uS, 0.02 * uS) * 0.9;\n' +
      'float pool = exp(-r * r / 5.0);\n' +
      'vec3 base = vec3(0.02, 0.024, 0.032) + vec3(0.075, 0.085, 0.105) * pool;\n' +
      'vec3 col = base + uAccent * lines * (0.06 + 0.22 * pool) * fade;\n' +
      'col = mix(vec3(0.02, 0.025, 0.035), col, fade * 0.9 + 0.1);\n' +
      'gl_FragColor = vec4(col, 1.0);\n#include <colorspace_fragment>\n}',
  });
}

export function build(params, ctx) {
  const s = ctx.scale, rng = ctx.rng;
  const accent = new THREE.Color(ctx.color(params.color));
  const group = new THREE.Group(), far = new THREE.Group();
  const dim = k => accent.clone().multiplyScalar(k).getHex();
  far.add(gradientDome([[-1, 0x030407], [-0.02, 0x0a0d14], [0.12, 0x10151e], [0.45, 0x0b0e15], [1, 0x040508]]));
  group.add(far);

  const floorGeo = new THREE.CircleGeometry(120 * s, 64); floorGeo.rotateX(-Math.PI / 2);
  const floor = new THREE.Mesh(floorGeo, floorMaterial(accent, s)); floor.renderOrder = -5; group.add(floor);

  // Back wall glow: a big soft accent sprite plus a horizon line of light far behind the subject.
  const wall = glowSprite(accent.getHex(), 70 * s, 0.32); wall.position.set(0, 7 * s, -40 * s); wall.scale.set(90 * s, 34 * s, 1); wall.material.fog = false; group.add(wall);
  const strips = [];
  const stripMat = new THREE.MeshBasicMaterial({ color: dim(0.9), transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  for (const [z, n, h] of [[-26, 7, 9], [-14, 5, 6]]) for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.1 * s, h * s, 0.1 * s), stripMat);
    m.position.set(((i + 0.5) / n - 0.5) * 2 * (Math.abs(z) * 0.62) * s + (rng() - 0.5) * 2 * s, h * s / 2, z * s); strips.push(m); group.add(m);
  }
  const dust = motes(rng, { scale: s, count: 60, colors: [0xffffff, accent.getHex()], size: 0.03, opacity: 0.4 });
  group.add(dust.object);

  const lights = lightRig({
    key: [0xffffff, 2.6, [-3, 6, 4]], fill: [dim(0.8), 1.0, [5, 1, 3]], rim: [accent.clone().lerp(new THREE.Color(0xffffff), 0.3).getHex(), 3.0, [2, 3, -5]],
    sky: 0x9aa6ba, ground: 0x1a2030, hemi: 1.0,
  });
  const fog = new THREE.Fog(0x0b0e15, 10 * s, 60 * s);
  let painted = accent.getHex();
  return {
    object: group, lights, fog, background: 0x0b0e15,
    // The accent colour follows a dial: grid, wall glow, light strips and the fill and rim lights (the dust keeps its colour).
    setColors(cols) {
      if (cols.color === undefined || cols.color === painted) return;
      painted = cols.color;
      accent.setHex(painted);
      floor.material.uniforms.uAccent.value.copy(accent);
      wall.material.color.setHex(painted);
      stripMat.color.setHex(dim(0.9));
      lights[1].color.setHex(dim(0.8));
      lights[2].color.copy(accent).lerp(new THREE.Color(0xffffff), 0.3);
    },
    update(t, cam) {
      far.position.fromArray(cam.position);
      fog.near = cam.distance * 2.2; fog.far = cam.distance * 9;
      stripMat.opacity = 0.3 + 0.05 * Math.sin(t * 0.7);
      dust.update(t);
    },
    dispose() { floorGeo.dispose(); stripMat.dispose(); },
  };
}
