// Environment: studio. A coloured gradient backdrop that curves into a soft floor, haze in the backdrop colour,
// floating dust, and soft key/fill/rim lights. The default "explain an object" look. Props stand on the floor
// (blob shadows are added by the stage) unless floor is false.
// Exports: meta, build(params, ctx).

import * as THREE from 'three';
import { gradientDome, motes, lightRig } from './lib/parts.js';

export const meta = {
  name: 'studio',
  summary: 'A clean coloured studio backdrop with a soft floor. The default look for explaining an object.',
  ground: params => params.floor,
  params: {
    color: { type: 'color', default: 'teal', doc: 'backdrop colour' },
    floor: { type: 'bool', default: true, doc: 'show a floor (props stand on it); false = props float' },
  },
};

// Colour helpers: a darker or lighter version of a colour.
const shade = (hex, k) => new THREE.Color(hex).multiplyScalar(k).getHex();
const tint = (hex, k) => new THREE.Color(hex).lerp(new THREE.Color(0xffffff), k).getHex();

// A white tile with a slightly darker border line, repeated over the floor. Made once from bytes.
let GRID = null;
function gridTexture() {
  if (GRID) return GRID;
  const n = 64, data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const line = x < 2 || y < 2;
    const i = 4 * (y * n + x);
    data[i] = data[i + 1] = data[i + 2] = line ? 205 : 255; data[i + 3] = 255;
  }
  GRID = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
  GRID.wrapS = GRID.wrapT = THREE.RepeatWrapping;
  GRID.magFilter = THREE.LinearFilter; GRID.minFilter = THREE.LinearMipmapLinearFilter; GRID.generateMipmaps = true;
  GRID.anisotropy = 8;
  GRID.needsUpdate = true;
  return GRID;
}

export function build(params, ctx) {
  const s = ctx.scale;
  // The backdrop: muted version of the colour, darker toward the floor and the top, a bright band behind the subject.
  const base = new THREE.Color(ctx.color(params.color)).lerp(new THREE.Color(0x203040), 0.35).getHex();
  const group = new THREE.Group();
  const dome = gradientDome([[-1, shade(base, 0.25)], [-0.05, shade(base, 0.55)], [0.08, tint(base, 0.08)], [0.45, shade(base, 0.62)], [1, shade(base, 0.3)]]);
  group.add(dome);

  // Floor: a big disc in the backdrop colour; fog melts its far edge into the backdrop (no visible horizon line).
  let floor = null;
  if (params.floor) {
    // A soft pool of light in the middle of the floor, darker toward the edges (vertex colours by distance).
    const floorGeo = new THREE.RingGeometry(0.001, 60 * s, 64, 24);
    floorGeo.rotateX(-Math.PI / 2);
    const pos = floorGeo.attributes.position, cols = new Float32Array(pos.count * 3);
    const mid = new THREE.Color(shade(base, 0.42)), edge = new THREE.Color(shade(base, 0.2)), c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const r = Math.hypot(pos.getX(i), pos.getZ(i)) / s;
      c.copy(mid).lerp(edge, Math.min(1, Math.pow(r / 7, 0.8))).toArray(cols, i * 3);
    }
    floorGeo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    // A faint tile grid: gives the floor a surface, so depth and camera motion read even from above.
    const grid = gridTexture();
    grid.repeat.set(120 / 0.4, 120 / 0.4); // the disc UVs span its diameter (120 * s); cells are 0.4 * s wide
    floor = new THREE.Mesh(floorGeo, new THREE.MeshLambertMaterial({ vertexColors: true, map: grid }));
    floor.renderOrder = -5;
    group.add(floor);
  }

  const dust = motes(ctx.rng, { scale: s, count: 70, colors: [0xffffff, tint(base, 0.6)], size: 0.04, opacity: 0.45 });
  group.add(dust.object);

  const lights = lightRig({
    key: [0xfff4e6, 2.4, [-3, 5, 4]], fill: [tint(base, 0.5), 0.8, [5, 1, 3]], rim: [0xffffff, 2.4, [2, 4, -5]],
    sky: tint(base, 0.4), ground: shade(base, 0.4), hemi: 0.9,
  });
  const fog = new THREE.Fog(shade(base, 0.55), 10 * s, 40 * s);

  return {
    object: group, lights, fog,
    background: shade(base, 0.5),
    update(t, cam) {
      dome.position.fromArray(cam.position);
      // Haze starts a little behind the subject, whatever the camera distance.
      fog.near = cam.distance * 1.3; fog.far = cam.distance * 5;
      dust.update(t);
    },
  };
}
