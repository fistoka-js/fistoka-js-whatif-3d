// Prop: satellite. A gold-foil box body, two big blue solar panels on arms, a dish and an antenna. Turns slowly.
// Exports: meta, build(params, ctx).

import * as THREE from 'three';

export const meta = {
  name: 'satellite',
  summary: 'A satellite: gold body, two solar panels, a dish and antenna. Turns slowly.',
  tags: ['space', 'vehicle'],
  floats: true,
  params: {
    color: { type: 'color', default: '#ffc44d', doc: 'body colour' },
    panels: { type: 'color', default: '#2f6bd8', doc: 'solar panel colour' },
    turn: { type: 'number', min: -1, max: 1, default: 0.06, doc: 'turns per second' },
  },
  animatable: {},
};

// Solar panel texture: coloured cells separated by pale grid lines. Small DataTexture (works in Node).
function panelTexture(hex) {
  const n = 64, data = new Uint8Array(n * n * 4), c = new THREE.Color(hex);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const line = (x % 16 < 2) || (y % 32 < 2);
    const k = line ? 0.85 : 0.55 + 0.25 * (y / n);
    const i = 4 * (y * n + x);
    data[i] = line ? 220 : c.r * 255 * k + 30; data[i + 1] = line ? 230 : c.g * 255 * k + 30; data[i + 2] = line ? 245 : c.b * 255 * k + 40; data[i + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace; tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
  return tex;
}

export function build(params, ctx) {
  const made = [], keep = x => { made.push(x); return x; };
  const group = new THREE.Group();
  const spin = new THREE.Group();
  group.add(spin);
  const gold = keep(ctx.mat.solid(ctx.color(params.color), { rough: 0.35, metal: 0.5 }));
  const grey = keep(ctx.mat.solid(0xc4cad4, { rough: 0.35, metal: 0.6, main: false }));
  const panelMat = keep(ctx.mat.solid(0xffffff, { rough: 0.25, metal: 0.3, map: keep(panelTexture(ctx.color(params.panels))), main: false }));

  const body = new THREE.Mesh(keep(new THREE.BoxGeometry(0.34, 0.3, 0.3)), gold);
  spin.add(body);
  // Little ribs on the body so it reads as built, not a plain cube.
  for (const y of [-0.1, 0.1]) {
    const rib = new THREE.Mesh(keep(new THREE.BoxGeometry(0.36, 0.025, 0.32)), grey);
    rib.position.y = y; spin.add(rib);
  }
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.02, 0.02, 0.2, 10)), grey);
    arm.rotation.z = Math.PI / 2; arm.position.x = s * 0.27; spin.add(arm);
    const panel = new THREE.Mesh(keep(new THREE.BoxGeometry(0.46, 0.34, 0.03)), panelMat);
    panel.position.x = s * 0.6; spin.add(panel);
    const frame = new THREE.Mesh(keep(new THREE.BoxGeometry(0.48, 0.36, 0.02)), grey);
    frame.position.set(s * 0.6, 0, -0.012); spin.add(frame);
  }
  // Dish on a stalk (front), antenna on top.
  const stalk = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.018, 0.018, 0.14, 8)), grey);
  stalk.rotation.x = Math.PI / 2; stalk.position.z = 0.22; spin.add(stalk);
  const dish = new THREE.Mesh(keep(new THREE.SphereGeometry(0.17, 28, 12, 0, Math.PI * 2, 0, Math.PI * 0.4)), keep(ctx.mat.solid(0xf4f6fa, { rough: 0.3, main: false })));
  dish.material.side = THREE.DoubleSide;
  dish.rotation.x = Math.PI / 2; dish.position.z = 0.3; spin.add(dish);
  const feed = new THREE.Mesh(keep(new THREE.SphereGeometry(0.025, 10, 8)), gold);
  feed.position.z = 0.4; spin.add(feed);
  const mast = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.01, 0.01, 0.22, 8)), grey);
  mast.position.y = 0.26; spin.add(mast);
  const tip = new THREE.Mesh(keep(new THREE.SphereGeometry(0.03, 10, 8)), keep(ctx.mat.solid(0xff4b4b, { emissive: 0.6, main: false })));
  tip.position.y = 0.38; spin.add(tip);

  group.rotation.x = 0.25;   // lean slightly toward the camera so the panels read as 3D
  return {
    object: group,
    update(t) {
      spin.rotation.y = 0.5 + t * params.turn * Math.PI * 2;
      spin.rotation.z = 0.12 * Math.sin(t * 0.5);
    },
    dispose() { for (const x of made) x.dispose(); },
  };
}
