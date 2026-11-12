// Prop: beam. A glowing ray of light between two points (slots, [x,y,z] or prop ids).
// Exports: meta, build(params, ctx). Animate "progress" 0 -> 1 to make it shoot out from its start.
// Stage-space prop (like arrow): drawn between its points, no at/size/rotate, not normalised.

import * as THREE from 'three';

export const meta = {
  name: 'beam',
  summary: 'A glowing light ray from one point or prop to another. Animate "progress" 0->1 to shoot it out.',
  tags: ['light', 'science'],
  floats: true,
  stageSpace: true,
  params: {
    from: { type: 'point', default: 'left', doc: 'where the light starts (slot, [x,y,z] or prop id)' },
    to: { type: 'point', default: 'right', doc: 'where it goes (slot, [x,y,z] or prop id)' },
    color: { type: 'color', default: '#fff3d6', doc: 'colour of the light' },
    width: { type: 'number', min: 0.01, max: 0.6, default: 0.08, doc: 'thickness' },
  },
  animatable: {
    progress: { min: 0, max: 1, default: 1, doc: 'how far the beam has travelled (0 = not yet, 1 = all the way)' },
    brightness: { min: 0, max: 2, default: 1, doc: 'how bright' },
  },
};

const UP = new THREE.Vector3(0, 1, 0);

// One light ribbon: a flat quad (crossed with a second one, so it reads from any side) shaded in the fragment shader.
// Across the ribbon: a gaussian falloff (uSharp: bigger = thinner). Along it: soft taper at both ends (uTaper, world
// units) and a gentle bright pulse that travels from the start to the end as a function of t (uT).
function ribbonMaterial(color, sharp, pulse) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) }, uStrength: { value: 1 }, uSharp: { value: sharp }, uPulse: { value: pulse },
      uLen: { value: 1 }, uTaper: { value: 0.2 }, uT: { value: 0 },
    },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: [
      'uniform vec3 uColor; uniform float uStrength, uSharp, uPulse, uLen, uTaper, uT; varying vec2 vUv;',
      'void main() {',
      '  float across = vUv.x * 2.0 - 1.0;',
      '  float prof = exp(-across * across * uSharp);',
      '  float along = vUv.y * uLen;',
      '  float taper = smoothstep(0.0, uTaper, along) * smoothstep(0.0, uTaper * 0.6, uLen - along);',
      '  float wave = 0.5 + 0.5 * sin(6.2831853 * (along / 0.9 - uT * 0.6));',
      '  float pulse = 1.0 + uPulse * (wave * wave - 0.35);',
      '  gl_FragColor = vec4(uColor * prof * taper * pulse * uStrength, 1.0);',
      '#include <colorspace_fragment>',
      '}',
    ].join(String.fromCharCode(10)),
    side: THREE.DoubleSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  });
}

export function build(params, ctx) {
  const w = params.width;
  const color = new THREE.Color(ctx.color(params.color));
  const white = new THREE.Color(0xffffff);
  const coreColor = () => color.clone().lerp(white, 0.7);
  // Unit-long ribbons along +y (scaled to the length each frame): a wide soft glow and a thin bright core.
  const glowGeo = new THREE.PlaneGeometry(w * 3.4, 1); glowGeo.translate(0, 0.5, 0);
  const coreGeo = new THREE.PlaneGeometry(w * 0.9, 1); coreGeo.translate(0, 0.5, 0);
  const glowMat = ribbonMaterial(color, 6, 0.35), coreMat = ribbonMaterial(coreColor(), 4.5, 0.15);
  const quads = [];
  for (const [geo, mat] of [[glowGeo, glowMat], [coreGeo, coreMat]]) {
    const a = new THREE.Mesh(geo, mat), b = new THREE.Mesh(geo, mat);
    b.rotation.y = Math.PI / 2;
    quads.push(a, b);
  }
  const head = ctx.mat.glowSprite(color, w * 6, 1);
  const source = ctx.mat.glowSprite(color, w * 4, 0.6);
  const group = new THREE.Group(), body = new THREE.Group();
  body.add(...quads);
  group.add(body, head, source);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), dir = new THREE.Vector3();
  let glowAmount = 0; // set by the "glow" action (setGlow runs before update each frame)

  return {
    object: group,
    update(t, state) {
      const { from, to } = state.points;
      a.fromArray(from.at); b.fromArray(to.at);
      dir.subVectors(b, a);
      const full = dir.length();
      dir.normalize();
      const startGap = from.radius ? from.radius * 0.9 : 0, endGap = to.radius ? to.radius * 0.95 : 0;
      const len = Math.max(0, full - startGap - endGap) * state.params.progress;
      const k = state.params.brightness * state.opacity * (1 + 0.6 * glowAmount);
      group.visible = len > 0.005 && k > 0.005;
      const start = a.clone().addScaledVector(dir, startGap);
      body.position.copy(start);
      body.quaternion.setFromUnitVectors(UP, dir);
      body.scale.set(1, Math.max(0.001, len), 1);
      head.position.copy(start).addScaledVector(dir, len);
      source.position.copy(start);
      const taper = Math.min(0.35, Math.max(0.05, len * 0.25));
      for (const m of [glowMat, coreMat]) { m.uniforms.uLen.value = len; m.uniforms.uTaper.value = taper; m.uniforms.uT.value = t; }
      glowMat.uniforms.uStrength.value = 0.4 * k;
      coreMat.uniforms.uStrength.value = 0.95 * k;
      // The head flare is strongest while the beam is still travelling.
      head.material.opacity = k * (state.params.progress < 1 ? 1 : 0.5);
      source.material.opacity = 0.6 * k;
    },
    setColor(hex) {
      color.setHex(hex);
      glowMat.uniforms.uColor.value.copy(color);
      coreMat.uniforms.uColor.value.copy(coreColor());
      head.material.color.setHex(hex); source.material.color.setHex(hex);
    },
    setGlow(v) { glowAmount = v; },
    dispose() { glowGeo.dispose(); coreGeo.dispose(); glowMat.dispose(); coreMat.dispose(); head.material.dispose(); source.material.dispose(); },
  };
}
