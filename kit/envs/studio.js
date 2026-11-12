// Environment: studio. A coloured gradient backdrop that curves into a soft floor, haze in the backdrop colour,
// a soft glow along the horizon, a gentle vignette, floating dust at three depths, and soft key/fill/rim lights. The default "explain an object" look. Props stand on the floor
// (blob shadows are added by the stage) unless floor is false.
// Exports: meta, build(params, ctx).

import * as THREE from 'three';
import { gradientDome, paintDome, pointLayer, lightRig } from './lib/parts.js';

export const meta = {
  name: 'studio',
  summary: 'A clean coloured studio backdrop with a soft floor. The default look for explaining an object.',
  ground: params => params.floor,
  dialParams: ['color'],          // the backdrop colour can follow a dial (setColors below)
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

// Dust specks floating in a slab of depth (z0..z1 in stage units) around the stage; each is a pure function of t.
// Near slabs shift more when the camera moves, so the drift shows real parallax.
function floaters(rng, { s, count, z0, z1, size, opacity, colors, spread = 9 }) {
  const layer = pointLayer({
    rng, count, colors, size: size * s, opacity, fog: false,
    place: r => [(r() - 0.5) * spread * s, (r() - 0.35) * spread * 0.7 * s, (z0 + r() * (z1 - z0)) * s],
  });
  const base = layer.geometry.attributes.position.array.slice();
  return {
    object: layer,
    update(t) {
      const arr = layer.geometry.attributes.position.array;
      for (let i = 0; i < arr.length; i += 3) {
        const ph = i * 0.37;
        arr[i] = base[i] + Math.sin(t * 0.13 + ph) * 0.1 * s;
        arr[i + 1] = base[i + 1] + Math.sin(t * 0.09 + ph * 1.7) * 0.08 * s + t * 0.012 * s;
        arr[i + 2] = base[i + 2] + Math.cos(t * 0.11 + ph) * 0.08 * s;
      }
      layer.geometry.attributes.position.needsUpdate = true;
    },
  };
}

// A soft dark edge for the picture (no post-processing): a big dark-edged quad held in front of the camera.
let VIGNETTE = null;
function vignetteTexture() {
  if (VIGNETTE) return VIGNETTE;
  const n = 64, data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const r = Math.hypot((x + 0.5) / n * 2 - 1, (y + 0.5) / n * 2 - 1);
    const k = Math.min(1, Math.max(0, (r - 0.35) / 0.6));
    data[4 * (y * n + x) + 3] = Math.round(255 * 0.38 * k * k * (3 - 2 * k));
  }
  VIGNETTE = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
  VIGNETTE.magFilter = VIGNETTE.minFilter = THREE.LinearFilter;
  VIGNETTE.needsUpdate = true;
  return VIGNETTE;
}

// Every colour of the room, from the backdrop colour (0xRRGGBB). One place, so a colour that follows a dial repaints the same way.
function roomColors(color) {
  // The backdrop: muted version of the colour, darker toward the floor and the top, a bright band behind the subject.
  const base = new THREE.Color(color).lerp(new THREE.Color(0x203040), 0.35).getHex();
  return {
    base, dome: [[-1, shade(base, 0.25)], [-0.05, shade(base, 0.55)], [0.08, tint(base, 0.08)], [0.45, shade(base, 0.62)], [1, shade(base, 0.3)]],
    floorMid: shade(base, 0.42), floorEdge: shade(base, 0.2), horizon: tint(base, 0.55),
    fill: tint(base, 0.5), sky: tint(base, 0.4), ground: shade(base, 0.4), fog: shade(base, 0.55), background: shade(base, 0.5),
  };
}

// Floor colours: a soft pool of light in the middle, darker toward the edges (vertex colours by distance).
function paintFloor(geo, rc, s) {
  const pos = geo.attributes.position, cols = geo.attributes.color.array;
  const mid = new THREE.Color(rc.floorMid), edge = new THREE.Color(rc.floorEdge), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const r = Math.hypot(pos.getX(i), pos.getZ(i)) / s;
    c.copy(mid).lerp(edge, Math.min(1, Math.pow(r / 7, 0.8))).toArray(cols, i * 3);
  }
  geo.attributes.color.needsUpdate = true;
}

// Horizon ring colours: clear at the top, brightest at its foot (vertex alpha).
function paintHorizon(geo, rc, H) {
  const pos = geo.attributes.position, cols = geo.attributes.color.array, c = new THREE.Color(rc.horizon);
  for (let i = 0; i < pos.count; i++) { const top = pos.getY(i) > H / 2; c.toArray(cols, i * 4); cols[i * 4 + 3] = top ? 0 : 0.5; }
  geo.attributes.color.needsUpdate = true;
}

export function build(params, ctx) {
  const s = ctx.scale;
  let rc = roomColors(ctx.color(params.color));
  const base = rc.base;
  const group = new THREE.Group();
  const dome = gradientDome(rc.dome);
  group.add(dome);

  // Floor: a big disc in the backdrop colour; fog melts its far edge into the backdrop (no visible horizon line).
  let floor = null;
  if (params.floor) {
    // A soft pool of light in the middle of the floor, darker toward the edges (vertex colours by distance).
    const floorGeo = new THREE.RingGeometry(0.001, 60 * s, 64, 24);
    floorGeo.rotateX(-Math.PI / 2);
    floorGeo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(floorGeo.attributes.position.count * 3), 3));
    paintFloor(floorGeo, rc, s);
    // A faint tile grid: gives the floor a surface, so depth and camera motion read even from above.
    const grid = gridTexture();
    grid.repeat.set(120 / 0.4, 120 / 0.4); // the disc UVs span its diameter (120 * s); cells are 0.4 * s wide
    floor = new THREE.Mesh(floorGeo, new THREE.MeshLambertMaterial({ vertexColors: true, map: grid }));
    floor.renderOrder = -5;
    group.add(floor);
  }

  // A soft glow where the floor meets the backdrop: a ring that is clear at the bottom and brightest at its foot (vertex alpha).
  let horizon = null;
  const H = 5 * s;
  if (params.floor) {
    const R = 52 * s, geo = new THREE.CylinderGeometry(R, R, H, 48, 1, true);
    geo.translate(0, H / 2, 0);
    geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count * 4), 4));
    paintHorizon(geo, rc, H);
    horizon = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, side: THREE.BackSide, depthWrite: false, fog: false }));
    horizon.renderOrder = -4;
    group.add(horizon);
  }

  // Dust at three depths: far behind the stage, around it, and in front of it.
  const dustColors = [0xffffff, tint(base, 0.6)];
  const dusts = [
    floaters(ctx.rng, { s, count: 50, z0: -12, z1: -5, size: 0.035, opacity: 0.4, colors: dustColors, spread: 14 }),
    floaters(ctx.rng, { s, count: 40, z0: -4, z1: 0.5, size: 0.055, opacity: 0.5, colors: dustColors }),
    floaters(ctx.rng, { s, count: 14, z0: 1.2, z1: 4, size: 0.09, opacity: 0.35, colors: dustColors, spread: 7 }),
  ];
  for (const d of dusts) group.add(d.object);

  const vignette = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 1.09),
    new THREE.MeshBasicMaterial({ map: vignetteTexture(), color: 0x000000, transparent: true, depthTest: false, depthWrite: false, fog: false }));
  vignette.renderOrder = 999;
  vignette.frustumCulled = false;
  group.add(vignette);
  const toCam = new THREE.Vector3();

  const lights = lightRig({
    key: [0xfff4e6, 2.4, [-3, 5, 4]], fill: [rc.fill, 0.8, [5, 1, 3]], rim: [0xffffff, 2.4, [2, 4, -5]],
    sky: rc.sky, ground: rc.ground, hemi: 0.9,
  });
  const fog = new THREE.Fog(rc.fog, 10 * s, 40 * s);
  let painted = ctx.color(params.color);

  const env = {
    object: group, lights, fog,
    background: rc.background,
    // The backdrop colour follows a dial: repaint the room (only when the colour really changed).
    setColors(cols) {
      if (cols.color === undefined || cols.color === painted) return;
      painted = cols.color;
      rc = roomColors(painted);
      paintDome(dome, rc.dome);
      if (floor) paintFloor(floor.geometry, rc, s);
      if (horizon) paintHorizon(horizon.geometry, rc, H);
      lights[1].color.setHex(rc.fill); lights[3].color.setHex(rc.sky); lights[3].groundColor.setHex(rc.ground);
      fog.color.setHex(rc.fog);
      env.background = rc.background;
    },
    update(t, cam) {
      dome.position.fromArray(cam.position);
      // Haze starts a little behind the subject, whatever the camera distance.
      fog.near = cam.distance * 1.3; fog.far = cam.distance * 5;
      for (const d of dusts) d.update(t);
      if (horizon) horizon.position.set(cam.position[0], 0, cam.position[2]);
      // The vignette sits one unit in front of the camera, facing it, upright (as the camera's up).
      toCam.fromArray(cam.position).sub(new THREE.Vector3().fromArray(cam.target)).normalize();
      vignette.position.fromArray(cam.position).addScaledVector(toCam, -1);
      vignette.up.set(0, Math.abs(toCam.y) > 0.97 ? 0 : 1, Math.abs(toCam.y) > 0.97 ? -1 : 0);
      vignette.lookAt(cam.position[0], cam.position[1], cam.position[2]);
    },
  };
  return env;
}
