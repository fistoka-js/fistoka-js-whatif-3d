// Prop: black_hole. A dark sphere with a hot glowing accretion disc (tilted), a thin bright light ring and a soft halo.
// Exports: meta, build(params, ctx). The disc swirls slowly; animate "disc" to feed it (brighter, wider).

import * as THREE from 'three';

export const meta = {
  name: 'black_hole',
  summary: 'A black hole: dark sphere, glowing swirling accretion disc, light ring. Animate "disc" to feed it.',
  tags: ['space'],
  floats: true,
  params: {
    color: { type: 'color', default: 'orange', doc: 'colour of the disc glow (inner edge stays near white)' },
    tilt: { type: 'number', min: 0, max: 90, default: 72, doc: 'how much the disc leans back (0 = face-on, 90 = edge-on)' },
  },
  animatable: {
    disc: { min: 0, max: 1.5, default: 1, doc: 'disc brightness and width (0 = bare black sphere)' },
  },
};

// Disc texture: x = inner to outer edge (white-hot to the glow colour, fading out), y = around, with soft streaks.
function discTexture(glow) {
  const w = 128, h = 128, data = new Uint8Array(w * h * 4);
  const hot = new THREE.Color(0xfff4d8), c = new THREE.Color();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = x / (w - 1), a = (y / h) * Math.PI * 2;
    const streak = 0.75 + 0.25 * Math.sin(a * 5 + u * 14) * Math.sin(a * 3 - u * 6);
    const fade = Math.min(1, u * 14) * Math.pow(1 - u, 1.3);
    c.copy(hot).lerp(glow, Math.min(1, u * 1.6));
    const i = 4 * (y * w + x);
    data[i] = c.r * 255; data[i + 1] = c.g * 255; data[i + 2] = c.b * 255;
    data[i + 3] = Math.round(255 * Math.min(1, fade * streak * 1.3));
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  tex.wrapT = THREE.RepeatWrapping; tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace; tex.needsUpdate = true;
  return tex;
}

export function build(params, ctx) {
  const made = [], keep = x => { made.push(x); return x; };
  const glow = new THREE.Color(ctx.color(params.color));
  const group = new THREE.Group();
  const IN = 0.62, OUT = 1.35;

  const holeMat = keep(new THREE.MeshBasicMaterial({ color: 0x020204 }));
  holeMat.userData.main = false;
  const hole = new THREE.Mesh(keep(new THREE.SphereGeometry(0.5, 48, 32)), holeMat);

  // Disc: a flat ring remapped so u runs inner (0) to outer (1) and v runs around.
  const geo = keep(new THREE.RingGeometry(IN, OUT, 96, 1));
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, (Math.hypot(pos.getX(i), pos.getY(i)) - IN) / (OUT - IN), (Math.atan2(pos.getY(i), pos.getX(i)) / (Math.PI * 2) + 1) % 1);
  }
  const discMat = keep(new THREE.MeshBasicMaterial({ map: keep(discTexture(glow)), transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  discMat.userData.main = false;
  const disc = new THREE.Mesh(geo, discMat);
  const tilter = new THREE.Group();            // leans the disc; the disc itself spins inside
  tilter.rotation.x = -THREE.MathUtils.degToRad(90 - params.tilt);
  tilter.add(disc);

  // Thin light ring hugging the hole, facing the camera (light bent around the back of the hole).
  const lensMat = keep(new THREE.MeshBasicMaterial({ color: 0xfff1d0, toneMapped: false, transparent: true }));
  lensMat.userData.main = false;
  const lens = new THREE.Mesh(keep(new THREE.TorusGeometry(0.56, 0.016, 12, 96)), lensMat);
  const halo = ctx.mat.glowSprite(glow, 3.4, 0.35);
  group.add(halo, hole, tilter, lens);

  return {
    object: group,
    update(t, state) {
      const d = state.params.disc;
      disc.rotation.z = t * 0.35;
      disc.scale.setScalar(0.55 + 0.45 * Math.min(d, 1.5));
      discMat.opacity = Math.min(1, d * 1.2) * state.opacity;
      halo.material.opacity = 0.35 * Math.min(1.4, d) * state.opacity;
      lens.scale.setScalar(1 + 0.02 * Math.sin(t * 1.3));
    },
    setColor(hex) { glow.setHex(hex); halo.material.color.setHex(hex); },
    setGlow() {},
    dispose() { for (const x of made) x.dispose(); halo.material.dispose(); },
  };
}
