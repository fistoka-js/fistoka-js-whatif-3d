// Shared look helpers, so every prop has the same shading style (the channel's visual identity).
// Exports:
//   solid(color, opts)        lit material with a soft rim highlight; marked as the prop's "main" colour by default
//   glowTexture()             a soft round white-to-clear texture (DataTexture, works in Node), shared
//   glowSprite(color, size, strength)  a soft additive glow that always faces the camera (excluded from bounds)
//   fresnelShell(color, opts) an additive glow shell material (atmospheres, beam glow)
//   shadowTexture()           soft dark round texture for blob shadows
//   noBounds(object)          marks an object so the engine ignores it when measuring the prop's size
//   setOpacity(object, k), setGlow(object, v), setColor(object, hex)  the engine's default action hooks
// Everything here is plain three.js and builds in Node (no canvas, no DOM).

import * as THREE from 'three';

// Lit material with a soft rim (edge light) so shapes separate from the background and read as solid 3D.
// opts: { rough (0.55), metal (0), rim (0.25), flat (false), main (true), emissive (0), map, transparent, opacity }
export function solid(color, opts = {}) {
  const m = new THREE.MeshStandardMaterial({
    color, roughness: opts.rough ?? 0.55, metalness: opts.metal ?? 0, flatShading: !!opts.flat,
    map: opts.map || null, transparent: !!opts.transparent, opacity: opts.opacity ?? 1,
  });
  if (opts.emissive) { m.emissive = new THREE.Color(color); m.emissiveIntensity = opts.emissive; }
  const rim = { value: opts.rim ?? 0.25 };
  const rimColor = { value: new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.6) };
  m.userData.rim = rim; m.userData.rimColor = rimColor;
  m.userData.main = opts.main !== false;
  m.onBeforeCompile = shader => {
    shader.uniforms.uRim = rim; shader.uniforms.uRimColor = rimColor;
    shader.fragmentShader = 'uniform float uRim; uniform vec3 uRimColor;\n' + shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\n' +
      'float rimF = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 3.0);\n' +
      'totalEmissiveRadiance += uRimColor * rimF * uRim;');
  };
  m.customProgramCacheKey = () => 'kit-rim';
  return m;
}

// A soft round texture: white in the middle, clear at the edge. Made once from bytes so it works in Node.
let GLOW_TEX = null;
export function glowTexture() {
  if (GLOW_TEX) return GLOW_TEX;
  const n = 64, data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const dx = (x + 0.5) / n * 2 - 1, dy = (y + 0.5) / n * 2 - 1;
    const r = Math.min(1, Math.hypot(dx, dy));
    const a = Math.pow(1 - r, 2.2);
    const i = 4 * (y * n + x);
    data[i] = data[i + 1] = data[i + 2] = 255; data[i + 3] = Math.round(a * 255);
  }
  GLOW_TEX = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
  GLOW_TEX.magFilter = THREE.LinearFilter; GLOW_TEX.minFilter = THREE.LinearFilter;
  GLOW_TEX.needsUpdate = true;
  return GLOW_TEX;
}

// Marks an object (and its children) as "not part of the prop's size": halos, glows, shadows.
export function noBounds(object) { object.userData.noBounds = true; return object; }

// A soft additive glow sprite. size = diameter in prop units.
export function glowSprite(color, size, strength = 1) {
  const mat = new THREE.SpriteMaterial({
    map: glowTexture(), color, transparent: true, opacity: strength, depthWrite: false,
    blending: THREE.AdditiveBlending, toneMapped: false,
  });
  const s = new THREE.Sprite(mat);
  s.scale.setScalar(size);
  return noBounds(s);
}

// Glow shell material, added on top of the picture (additive). d = how much the surface faces the camera (1 = facing).
// opts: { power (2.5), strength (1), center (false), inside (false), limb (1: d is divided by it, so a halo shell
//   can be at full strength right at the body's edge) }
//   center false: brightest at the silhouette (an atmosphere's thin skin)
//   center true:  brightest where the surface faces the camera (a beam's soft core; with inside, a halo ring
//                 that shows only outside a solid body, because the body hides the shell's middle)
//   inside true:  draw the inside of the shell (BackSide)
// uniforms.uOpacity is set by setOpacity like any material's opacity; uniforms.uStrength is the brightness.
export function fresnelShell(color, opts = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uStrength: { value: opts.strength ?? 1 }, uOpacity: { value: 1 }, uPower: { value: opts.power ?? 2.5 }, uLimb: { value: opts.limb ?? 1 } },
    vertexShader: 'varying vec3 vN; varying vec3 vV;\n' +
      'void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 uColor; uniform float uStrength; uniform float uOpacity; uniform float uPower; uniform float uLimb; varying vec3 vN; varying vec3 vV;\n' +
      'void main() { float d = clamp(abs(dot(normalize(vN), normalize(vV))) / uLimb, 0.0, 1.0);\n' +
      (opts.center ? 'float f = pow(d, uPower);\n' : 'float f = pow(1.0 - d, uPower);\n') +
      'gl_FragColor = vec4(uColor * f * uStrength * uOpacity, 1.0);\n#include <colorspace_fragment>\n}',
    side: opts.inside ? THREE.BackSide : THREE.FrontSide,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  });
}

// A soft dark round texture for blob shadows under props (black, alpha falls off to the edge).
let SHADOW_TEX = null;
export function shadowTexture() {
  if (SHADOW_TEX) return SHADOW_TEX;
  const n = 64, data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const r = Math.min(1, Math.hypot((x + 0.5) / n * 2 - 1, (y + 0.5) / n * 2 - 1));
    data[4 * (y * n + x) + 3] = Math.round(255 * Math.pow(1 - r, 1.6));
  }
  SHADOW_TEX = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
  SHADOW_TEX.magFilter = THREE.LinearFilter; SHADOW_TEX.minFilter = THREE.LinearFilter;
  SHADOW_TEX.needsUpdate = true;
  return SHADOW_TEX;
}

// --- default hooks used by the engine for appear/disappear, glow and color actions ---

function eachMaterial(object, fn) {
  object.traverse(o => {
    if (!o.material) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) fn(m, o);
  });
}

// Fades a whole prop. Remembers each material's own opacity the first time, so k = 1 restores it exactly.
export function setOpacity(object, k) {
  eachMaterial(object, m => {
    if (m.userData.baseOpacity === undefined) { m.userData.baseOpacity = m.opacity; m.userData.baseTransparent = m.transparent; }
    m.opacity = m.userData.baseOpacity * k;
    m.transparent = m.userData.baseTransparent || k < 0.999;
    if (m.uniforms && m.uniforms.uOpacity) m.uniforms.uOpacity.value = k;
  });
}

// Makes the "main" materials glow in their own colour (v = 0 none .. 2 strong).
export function setGlow(object, v) {
  eachMaterial(object, m => {
    if (!m.userData.main || !m.emissive) return;
    if (m.userData.baseEmissive === undefined) m.userData.baseEmissive = m.emissiveIntensity * (m.emissive.getHex() ? 1 : 0);
    m.emissive.copy(m.color);
    m.emissiveIntensity = m.userData.baseEmissive + v * 0.7;
  });
}

// Sets the colour of the "main" materials (their rim colour follows).
export function setColor(object, hex) {
  eachMaterial(object, m => {
    if (!m.userData.main || !m.color) return;
    m.color.setHex(hex);
    if (m.userData.rimColor) m.userData.rimColor.value.setHex(hex).lerp(new THREE.Color(0xffffff), 0.6);
  });
}
