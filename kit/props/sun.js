// Prop: sun. A glowing star: bright core with a soft edge, a halo and slowly turning rays.
// Exports: meta, build(params, ctx). Ported from the previous kit's approved sun; halo and rays are now sprites,
// so they face the camera from any angle.

import * as THREE from 'three';

export const meta = {
  name: 'sun',
  summary: 'A glowing star with a halo and soft turning rays. Animate "brightness" to flare or dim it.',
  tags: ['space', 'light'],
  floats: true,
  params: {
    color: { type: 'color', default: '#ffc65a', doc: 'colour of the glow and rays (the core stays near white)' },
    rays: { type: 'bool', default: true, doc: 'show the soft rays' },
  },
  animatable: {
    brightness: { min: 0, max: 2, default: 1, doc: 'how strong the glow is (0 = core only)' },
  },
};

// Rays texture: soft spokes that fade toward their tips and toward the middle. Made once from bytes.
let RAYS_TEX = null;
function raysTexture() {
  if (RAYS_TEX) return RAYS_TEX;
  const n = 256, data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const px = (x + 0.5) / n - 0.5, py = (y + 0.5) / n - 0.5;
    const r = Math.min(1, Math.hypot(px, py) * 2), ang = Math.atan2(py, px);
    const spoke = Math.pow(Math.max(0, Math.cos(ang * 12)), 6) * 0.8 + Math.pow(Math.max(0, Math.cos(ang * 7 + 0.6)), 10) * 0.4;
    const along = Math.min(1, Math.max(0, (r - 0.22) / 0.15)) * Math.pow(1 - r, 1.6);
    const i = 4 * (y * n + x);
    data[i] = data[i + 1] = data[i + 2] = 255; data[i + 3] = Math.round(255 * Math.min(1, spoke * along));
  }
  RAYS_TEX = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
  RAYS_TEX.magFilter = THREE.LinearFilter; RAYS_TEX.minFilter = THREE.LinearFilter; RAYS_TEX.needsUpdate = true;
  return RAYS_TEX;
}

export function build(params, ctx) {
  const glowColor = new THREE.Color(ctx.color(params.color));
  const group = new THREE.Group();

  // Core: unlit; turns toward the glow colour and fades near its outline so it melts into the halo.
  const coreMat = new THREE.ShaderMaterial({
    uniforms: { uCore: { value: new THREE.Color(0xfff8ea) }, uGlow: { value: glowColor }, uOpacity: { value: 1 } },
    vertexShader: 'varying vec3 vN, vV; void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0);\n' +
      'vN = normalMatrix * normal; vV = -mv.xyz; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 uCore, uGlow; uniform float uOpacity; varying vec3 vN, vV;\n' +
      'void main() { float f = clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0); float d = sqrt(1.0 - f * f);\n' +
      'gl_FragColor = vec4(mix(uCore, uGlow, smoothstep(0.7, 1.0, d)), uOpacity * (1.0 - 0.6 * smoothstep(0.85, 1.0, d)));\n' +
      '#include <colorspace_fragment>\n}',
    transparent: true, toneMapped: false,
  });
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 24), coreMat);
  core.renderOrder = 2;

  const halo = ctx.mat.glowSprite(glowColor, 4.2, 0.9);
  const outer = ctx.mat.glowSprite(glowColor, 9, 0.25);
  const raysMat = new THREE.SpriteMaterial({ map: raysTexture(), color: glowColor, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const rays = ctx.mat.noBounds(new THREE.Sprite(raysMat));
  rays.scale.setScalar(3.6);
  rays.visible = params.rays;
  group.add(outer, halo, rays, core);

  return {
    object: group,
    update(t, state) {
      const b = state.params.brightness;
      halo.material.opacity = 0.9 * Math.min(1.4, b) * state.opacity;
      outer.material.opacity = 0.25 * b * state.opacity;
      raysMat.opacity = 0.6 * b * state.opacity;
      raysMat.rotation = t * 0.12;
      halo.scale.setScalar(4.2 * (0.7 + 0.3 * b));
    },
    setColor(hex) {
      glowColor.setHex(hex);
      for (const m of [halo.material, outer.material, raysMat]) m.color.setHex(hex);
    },
    setGlow() {},
    dispose() { core.geometry.dispose(); coreMat.dispose(); raysMat.dispose(); halo.material.dispose(); outer.material.dispose(); },
  };
}
