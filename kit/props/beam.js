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

export function build(params, ctx) {
  const w = params.width;
  const color = new THREE.Color(ctx.color(params.color));
  // A bright core and a wider soft glow around it, both unit-long along +y (scaled to the length each frame).
  const coreGeo = new THREE.CylinderGeometry(w * 0.22, w * 0.22, 1, 12, 1, true); coreGeo.translate(0, 0.5, 0);
  const glowGeo = new THREE.CylinderGeometry(w, w, 1, 20, 1, true); glowGeo.translate(0, 0.5, 0);
  const coreMat = new THREE.MeshBasicMaterial({ color: color.clone().lerp(new THREE.Color(0xffffff), 0.6), transparent: true, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending });
  const glowMat = ctx.mat.fresnelShell(color, { power: 1.6, strength: 1.1, center: true });
  const core = new THREE.Mesh(coreGeo, coreMat), glow = new THREE.Mesh(glowGeo, glowMat);
  const head = ctx.mat.glowSprite(color, w * 7, 1);
  const source = ctx.mat.glowSprite(color, w * 5, 0.7);
  const group = new THREE.Group(), body = new THREE.Group();
  body.add(core, glow);
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
      coreMat.opacity = Math.min(1, k);
      glowMat.uniforms.uStrength.value = 1.1 * k;
      // The head flare is strongest while the beam is still travelling.
      head.material.opacity = k * (state.params.progress < 1 ? 1 : 0.55);
      source.material.opacity = 0.7 * k;
    },
    setColor(hex) {
      color.setHex(hex);
      coreMat.color.setHex(hex).lerp(new THREE.Color(0xffffff), 0.6);
      glowMat.uniforms.uColor.value.setHex(hex);
      head.material.color.setHex(hex); source.material.color.setHex(hex);
    },
    setGlow(v) { glowAmount = v; },
    dispose() { coreGeo.dispose(); glowGeo.dispose(); coreMat.dispose(); glowMat.dispose(); head.material.dispose(); source.material.dispose(); },
  };
}
