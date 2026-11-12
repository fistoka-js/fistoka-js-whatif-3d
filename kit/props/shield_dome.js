// Prop: shield_dome. A translucent hex-tiled dome or bubble: force field, atmosphere layer, magnetic field.
// Exports: meta, build(params, ctx). Tiles are the dual of a geodesic sphere (hexagons + 12 pentagons). Animate "strength" 0..1.

import * as THREE from 'three';
import { kit } from './lib/machines.js';

export const meta = {
  name: 'shield_dome',
  summary: 'A translucent hex-pattern dome or bubble that shimmers. For force fields, atmosphere, magnetic shield, protection.',
  tags: ['effect', 'energy', 'space'],
  floats: false,
  params: {
    color: { type: 'color', default: 'cyan', doc: 'shield colour' },
    shape: { type: 'enum', values: ['dome', 'bubble'], default: 'dome', doc: 'half dome on the ground, or a full bubble' },
  },
  animatable: { strength: { min: 0, max: 1, default: 1, doc: 'how strong the shield is (0 = invisible, 1 = bright)' } },
};

const R = 0.5;

// Hexagon tiles: for each vertex of an icosphere, a fan around it through the centres of its surrounding faces.
function hexTiles(keep) {
  const ico = new THREE.IcosahedronGeometry(1, 3);
  const pos = ico.attributes.position, key = (x, y, z) => `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
  const verts = new Map(), faces = [];
  for (let f = 0; f < pos.count; f += 3) {
    const ids = [];
    for (let j = 0; j < 3; j++) {
      const v = new THREE.Vector3().fromBufferAttribute(pos, f + j), kk = key(v.x, v.y, v.z);
      if (!verts.has(kk)) verts.set(kk, { p: v, faces: [] });
      ids.push(kk);
    }
    const c = new THREE.Vector3(); ids.forEach(i => c.add(verts.get(i).p)); c.normalize();
    faces.push(c);
    ids.forEach(i => verts.get(i).faces.push(c));
  }
  ico.dispose();
  const tiles = [];
  for (const v of verts.values()) {
    if (!keep(v.p)) continue;
    const n = v.p.clone().normalize(), ref = Math.abs(n.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const u = new THREE.Vector3().crossVectors(ref, n).normalize(), w = new THREE.Vector3().crossVectors(n, u);
    const ring = v.faces.slice().sort((a, b) => Math.atan2(a.dot(w), a.dot(u)) - Math.atan2(b.dot(w), b.dot(u)));
    tiles.push({ c: n, ring });
  }
  return tiles;
}

export function build(params, ctx) {
  const k = kit(ctx), group = new THREE.Group();
  const colour = new THREE.Color(ctx.color(params.color));
  const dome = params.shape === 'dome';
  const tiles = hexTiles(p => !dome || p.y > -0.05);
  const fill = [], lines = [];
  for (const t of tiles) {
    const n = t.ring.length;
    for (let i = 0; i < n; i++) {
      const a = t.ring[i], b = t.ring[(i + 1) % n];
      const s = 0.9;   // shrink the filled tile a little so the lines show between tiles
      for (const p of [t.c, t.c.clone().lerp(a, s).normalize(), t.c.clone().lerp(b, s).normalize()]) fill.push(p.x * R, p.y * R, p.z * R);
      lines.push(a.x * R, a.y * R, a.z * R, b.x * R, b.y * R, b.z * R);
    }
  }
  const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(fill, 3));
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
  const fillMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: colour }, uStrength: { value: 1 }, uOpacity: { value: 1 }, uTime: { value: 0 } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; varying vec3 vP;\n' +
      'void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * position); vV = normalize(-mv.xyz); vP = position; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 uColor; uniform float uStrength; uniform float uOpacity; uniform float uTime; varying vec3 vN; varying vec3 vV; varying vec3 vP;\n' +
      'void main() { float d = abs(dot(normalize(vN), normalize(vV)));\n' +
      'float edge = pow(1.0 - d, 2.0); float wave = 0.5 + 0.5 * sin(uTime * 1.6 - vP.y * 9.0 + vP.x * 3.0);\n' +
      'float a = 0.10 + 0.5 * edge + 0.22 * wave * wave;\n' +
      'gl_FragColor = vec4(uColor * a * uStrength * uOpacity, 1.0);\n#include <colorspace_fragment>\n}',
    side: THREE.DoubleSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  });
  k.raw(fillMat);
  const lineMat = k.raw(new THREE.LineBasicMaterial({ color: colour.clone().lerp(new THREE.Color(0xffffff), 0.45), transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  const shell = new THREE.Mesh(fg, fillMat), net = new THREE.LineSegments(lg, lineMat);
  shell.renderOrder = 3; net.renderOrder = 4; group.add(shell, net);
  // A glowing ring where the dome meets the ground, and a pale base disc, give it a footprint.
  let ringMat = null;
  if (dome) {
    ringMat = k.raw(new THREE.MeshBasicMaterial({ color: colour.clone().lerp(new THREE.Color(0xffffff), 0.5), toneMapped: false, transparent: true }));
    k.mesh(new THREE.TorusGeometry(R, 0.012, 8, 64), ringMat, 0, 0, 0, group).rotation.x = Math.PI / 2;
  }
  const baseGlow = dome ? ctx.mat.glowSprite(colour.getHex(), 1.5, 0) : null;
  if (baseGlow) { baseGlow.material.depthWrite = false; k.raw(baseGlow.material); baseGlow.position.y = 0.02; group.add(baseGlow); }
  return {
    object: group,
    update(t, state) {
      const s = state.params.strength, o = state.opacity;
      fillMat.uniforms.uStrength.value = s; fillMat.uniforms.uTime.value = t;
      lineMat.opacity = Math.min(1, 0.25 + 0.75 * s) * s * o * (0.85 + 0.15 * Math.sin(t * 2.3));
      if (ringMat) ringMat.opacity = s * o;
      if (baseGlow) baseGlow.material.opacity = 0.35 * s * o;
      group.visible = s > 0.003;
    },
    dispose() { fg.dispose(); lg.dispose(); k.dispose(); },
  };
}
