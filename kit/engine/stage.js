// The 3D stage: builds every shot once at load (its own scene: environment, lights, props, blob shadows) and draws
// the frame for any time t. Only the current shot's scene is drawn.
// Exports: buildStage(show, catalog, renderer) -> { render(t), shotIndexAt(t), propRect(id), project(xyz), dipAt(t),
//          warmUp(), camera, shots }, buildProp(p, shot, catalog, accent, scale), measure(inst).
// Every value that affects pixels is set from scratch each frame from the pure state (engine/state.js).
// A scene (a shot and the continuing shots after it) is built once; its shots share the env and props.

import * as THREE from 'three';
import * as mat from './materials.js';
import { makeShotState } from './state.js';
import { makeRng, hashString } from './rng.js';
import { parseColor } from './palette.js';
import { effectiveRadius } from './camera.js';
import { bindingAt } from './dials.js';

const DEG = Math.PI / 180;

// The prop's size box, ignoring parts marked noBounds (glows, halos, shadows) and using the prop's own `bounds` if given.
export function measure(inst) {
  inst.object.updateWorldMatrix(true, true);
  if (inst.bounds) return inst.bounds.clone().applyMatrix4(inst.object.matrixWorld);
  const box = new THREE.Box3(), tmp = new THREE.Box3();
  (function walk(o) {
    if (o.userData.noBounds) return;
    if (o.geometry) {
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      tmp.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
      box.union(tmp);
    }
    for (const c of o.children) walk(c);
  })(inst.object);
  return box;
}

// Builds one prop: the prop's own object inside a "normaliser" (scale + centre to the unit box) inside a "wrapper"
// (position / rotation / size from the state each frame). Stage-space props are not normalised.
export function buildProp(p, shot, catalog, accent, scale = 1) {
  const mod = catalog.props[p.type];
  const ctx = {
    THREE, mat, quality: 'high', scale,
    rng: makeRng(hashString(shot.id + '/' + p.id)),
    color: v => (v === 'accent' ? parseColor(accent) : parseColor(v)) ?? 0xffffff,
  };
  const inst = mod.build(p.params, ctx);
  const wrapper = new THREE.Group(), normaliser = new THREE.Group();
  wrapper.name = p.id;
  normaliser.add(inst.object);
  wrapper.add(normaliser);
  let halfHeight = 0.5, footprint = 1, localBox = null;
  if (!p.stageSpace) {
    const box = measure(inst);
    const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
    const k = 1 / Math.max(size.x, size.y, size.z, 1e-6);
    normaliser.scale.setScalar(k);
    normaliser.position.copy(center).multiplyScalar(-k);
    halfHeight = (size.y * k) / 2;
    footprint = Math.max(size.x, size.z) * k;
    localBox = new THREE.Box3(size.clone().multiplyScalar(-k / 2), size.clone().multiplyScalar(k / 2));
  }
  return { p, inst, wrapper, normaliser, halfHeight, footprint, localBox };
}

export function buildStage(show, catalog, renderer) {
  const camera = new THREE.PerspectiveCamera(40, 9 / 16, 0.05, 2000);
  // One THREE scene per scene of the show (a shot plus the "continue" shots after it, SPEC §13), built at its first shot.
  // Each shot keeps its own state (camera); the props are shared, so a subject stays put across a camera change.
  const runs = new Map();
  const shots = show.shots.map(shot => {
    const state = makeShotState(shot, catalog);
    const first = shot.scene ? shot.scene.first : shot.index;
    if (!runs.has(first)) runs.set(first, buildRun(shot, state));
    return { shot, state, ...runs.get(first) };
  });

  function buildRun(shot, state) {
    const scale = effectiveRadius(state.baseFocus.radius, shot.camera.framing);
    const scene = new THREE.Scene();
    const envMod = catalog.envs[shot.env.type];
    const env = envMod.build(shot.env.params, {
      THREE, mat, scale, rng: makeRng(hashString(shot.id + '/env')),
      color: v => (v === 'accent' ? parseColor(show.accent) : parseColor(v)) ?? 0xffffff,
    });
    scene.add(env.object, ...env.lights);
    scene.fog = env.fog || null;
    // Every prop of the scene (the last shot of the scene lists them all); each is built with its own shot's id as seed.
    const all = show.shots.filter(s => (s.scene ? s.scene.first : s.index) === shot.index).pop().props;
    const props = all.map(p => buildProp(p, { id: p.declaredIn || shot.id }, catalog, show.accent, scale));
    for (const pr of props) {
      scene.add(pr.wrapper);
      if (shot.env.ground && !pr.p.stageSpace) {
        const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
          new THREE.MeshBasicMaterial({ map: mat.shadowTexture(), color: 0x000000, transparent: true, depthWrite: false }));
        shadow.renderOrder = -1;
        pr.shadow = shadow;
        scene.add(shadow);
      }
    }
    // Ground direction of blob shadows: away from the key light (the env's first light), kept short.
    const key = env.lights[0].position;
    const shadowDir = [-key.x / Math.max(key.y, 1) * 0.5, -key.z / Math.max(key.y, 1) * 0.5];
    return { scene, env, props, shadowDir, byId: new Map(props.map(x => [x.p.id, x])), runStart: shot.start, frameRadius: state.baseFocus.radius };
  }

  const shotIndexAt = t => {
    let i = 0;
    while (i + 1 < shots.length && t >= shots[i + 1].shot.start) i++;
    return i;
  };

  let current = null;

  // Sets every prop of shot s for time t (all values from the pure state).
  function poseProps(s, t) {
    const tl = t - s.runStart; // time since the scene began (continuous across continuing shots)
    for (const pr of s.props) {
      const st = s.state.propAt(pr.p.id, t);
      const w = pr.wrapper;
      w.visible = st.visible;
      if (!pr.p.stageSpace) {
        const k = pr.p.size * st.scale;
        // On a ground the state gives the centre of a full-height unit box; lower it if the prop is flatter.
        const drop = s.shot.env.ground && !pr.p.floats ? (0.5 - pr.halfHeight) * k : 0;
        w.position.set(st.position[0], st.position[1] - drop, st.position[2]);
        w.rotation.set(st.rotation[0] * DEG, st.rotation[1] * DEG, st.rotation[2] * DEG);
        w.scale.setScalar(Math.max(k, 1e-4));
      }
      mat.setOpacity(pr.inst.object, st.opacity);
      if (pr.inst.setColor) pr.inst.setColor(st.color); else mat.setColor(pr.inst.object, st.color);
      if (pr.inst.setGlow) pr.inst.setGlow(st.glow); else mat.setGlow(pr.inst.object, st.glow);
      if (pr.inst.update) pr.inst.update(tl, st);
      if (pr.shadow) {
        const k = pr.p.size * st.scale;
        const height = Math.max(0, w.position.y - pr.halfHeight * k);
        pr.shadow.visible = st.visible;
        // The shadow falls away from the key light: offset by the prop's centre height along the light's ground direction.
        const lift = height + 2 * pr.halfHeight * k;
        pr.shadow.position.set(w.position.x + s.shadowDir[0] * lift, 0.004 * s.frameRadius, w.position.z + s.shadowDir[1] * lift);
        pr.shadow.scale.setScalar(pr.footprint * k * (1.5 + height * 0.4));
        pr.shadow.material.opacity = 0.65 * st.opacity / (1 + height * 1.5 / Math.max(k, 0.05));
      }
    }
  }

  function render(t) {
    const s = shots[shotIndexAt(t)];
    current = s;
    const pose = s.state.cameraAt(t);
    const size = renderer.getSize(new THREE.Vector2());
    camera.aspect = size.x / size.y;
    camera.fov = pose.fov;
    camera.position.fromArray(pose.position);
    camera.up.set(0, 1, 0);
    // Looking straight down (top angle) needs a different "up" so the view does not spin.
    if (Math.abs(pose.position[1] - pose.target[1]) > 0.97 * pose.distance) camera.up.set(0, 0, -1);
    camera.lookAt(pose.target[0], pose.target[1], pose.target[2]);
    camera.setViewOffset(size.x, size.y, 0, pose.viewOffsetY * size.y, size.x, size.y);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    // Environment colours that follow a dial (SPEC §12): the env repaints itself only when the colour changes.
    if (s.env.setColors && Object.keys(s.shot.env.bind || {}).length) {
      const cols = {};
      for (const [k, b] of Object.entries(s.shot.env.bind)) cols[k] = bindingAt(b, show.dials, t);
      s.env.setColors(cols);
    }
    s.env.update(t - s.runStart, { position: pose.position, target: pose.target, distance: pose.distance });
    poseProps(s, t);
    s.scene.updateMatrixWorld(true);
    renderer.render(s.scene, camera);
  }

  // Screen position (CSS pixels of the canvas) of a stage point, for the current frame.
  const v = new THREE.Vector3();
  function project(xyz) {
    const size = renderer.getSize(new THREE.Vector2());
    v.set(xyz[0], xyz[1], xyz[2]).project(camera);
    return { x: (v.x + 1) / 2 * size.x, y: (1 - v.y) / 2 * size.y, behind: v.z > 1 };
  }

  // Screen rectangle of a prop in the current frame: { x, y, w, h } in pixels, or null if hidden.
  function propRect(id) {
    const pr = current && current.byId.get(id);
    // Hidden (by the state, or by the prop itself, e.g. a beam that has not started) means no box.
    if (!pr || !pr.wrapper.visible || !pr.inst.object.visible) return null;
    let box;
    if (pr.localBox) box = pr.localBox.clone().applyMatrix4(pr.wrapper.matrixWorld);
    else box = measure(pr.inst);
    if (box.isEmpty()) return null;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < 8; i++) {
      const q = project([(i & 1) ? box.max.x : box.min.x, (i & 2) ? box.max.y : box.min.y, (i & 4) ? box.max.z : box.min.z]);
      x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y);
    }
    // line: true for props drawn between points (beam, arrow): their middle is on the line, their corners are not.
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, line: pr.p.stageSpace };
  }

  // "dip" transition: the incoming shot fades up from its environment colour (and the outgoing one fades to it).
  const DIP = 0.25;
  function dipAt(t) {
    for (let i = 1; i < shots.length; i++) {
      const s = shots[i];
      if (s.shot.transition !== 'dip') continue;
      const d = Math.abs(t - s.shot.start);
      if (d < DIP) return { color: '#' + new THREE.Color(s.env.background).getHexString(), opacity: 1 - d / DIP };
    }
    return { color: '#000000', opacity: 0 };
  }

  // Warm up: compile every shot's shaders once so the first frame of a shot is not slow.
  function warmUp() {
    for (let i = 0; i < shots.length; i++) render(shots[i].shot.start + 0.01);
  }

  return { render, shotIndexAt, project, propRect, dipAt, warmUp, camera, shots };
}
