// Framing fractions, camera drift, label placement and the polished environments, all without a browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { catalog } from '../kit/engine/registry.js';
import { makeShotState } from '../kit/engine/state.js';
import { cameraPoseAt, effectiveRadius, FOV, ASPECT, VIEW_OFFSET_Y } from '../kit/engine/camera.js';
import { chooseLabelPlacement, labelBox, overlapArea, TITLE_BAND } from '../kit/engine/overlay.js';
import { makeRng } from '../kit/engine/rng.js';
import * as mat from '../kit/engine/materials.js';
import { resolve, WORDS } from './helpers.mjs';

const words = WORDS.slice(0, 24);
const TAN_H = Math.tan((FOV / 2) * Math.PI / 180) * ASPECT;

// A one-shot show: given props and camera, resolved and ready for makeShotState.
function shotWith(props, camera = {}, env = 'space') {
  const { show, errors } = resolve({ format: 1, title: 't', voice: { audio: 'v.mp3', words: 'w.json' }, shots: [{ id: 'only', env, props, camera }] }, words);
  assert.deepEqual(errors, []);
  return show.shots[0];
}
// Width of a unit-box sphere of radius r as a fraction of the frame width, seen from distance d.
const widthFraction = (r, d) => Math.tan(Math.asin(r / d)) / TAN_H;

test('framing: a lone prop spans about 70% (medium), 90% (close), 45% (wide) of the frame width', () => {
  const want = { close: [0.84, 1.0], medium: [0.64, 0.78], wide: [0.38, 0.52] };
  for (const [framing, [lo, hi]] of Object.entries(want)) {
    const shot = shotWith([{ id: 'b', type: 'ball' }], { move: 'still', framing });
    const pose = makeShotState(shot, catalog).cameraAt(shot.start + 0.01);
    const f = widthFraction(0.5, pose.distance);
    assert.ok(f >= lo && f <= hi, `${framing}: ${f.toFixed(3)} not in ${lo}..${hi}`);
  }
});

test('framing: the subject centre sits at 43% of the frame height, above the caption zone', () => {
  assert.ok(Math.abs(0.5 - VIEW_OFFSET_Y - 0.43) < 1e-9);
  const shot = shotWith([{ id: 'b', type: 'ball', size: 1.4 }], { move: 'still' });
  const pose = makeShotState(shot, catalog).cameraAt(shot.start + 0.01);
  const half = widthFraction(0.7, pose.distance) * ASPECT / 2; // half-height as a fraction of the frame height
  assert.ok(0.43 + half < 0.76, 'the subject bottom stays above the caption zone');
});

test('framing: a long free beam pulls the frame out only a little, unless it is named in focus', () => {
  const ball = { id: 'b', type: 'ball' };
  const beam = { id: 'r', type: 'beam', from: [0, 0, 0], to: [4, 0, 0] };
  const r0 = makeShotState(shotWith([ball], { move: 'still' }), catalog).baseFocus.radius;
  const r1 = makeShotState(shotWith([ball, beam], { move: 'still' }), catalog).baseFocus.radius;
  const r2 = makeShotState(shotWith([ball, beam], { move: 'still', focus: ['b', 'r'] }), catalog).baseFocus.radius;
  assert.ok(r1 > r0 && r1 < 1.35 * r0, `clamped: ${r0} -> ${r1}`);
  assert.ok(r2 > 1.5 * r0, `focus names the beam: ${r2}`);
});

// Where a world point lands across the frame (fraction of frame width from the centre) for a pose.
function screenX(pose, S) {
  const sub = (a, b) => a.map((v, i) => v - b[i]), dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
  const norm = a => { const l = Math.hypot(...a); return a.map(v => v / l); };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const f = norm(sub(pose.target, pose.position)), right = norm(cross(f, [0, 1, 0])), v = sub(S, pose.position);
  return dot(v, right) / dot(v, f) / TAN_H / 2;
}

test('camera: drift slides the subject 3-7% of the frame width over a 5 s shot; still is the only static move', () => {
  const focus = { center: [0, 0, 0], radius: effectiveRadius(1, 'medium'), depth: 0 }, shot = { start: 0, end: 5 };
  const pose = (move, t) => cameraPoseAt({ move, amount: 0.5, framing: 'medium', angle: 'front' }, focus, shot, t);
  const xs = [0, 1, 2, 3, 4, 5].map(t => screenX(pose('drift', t), [0, 0, 0]));
  const travel = Math.max(...xs) - Math.min(...xs);
  assert.ok(travel > 0.03 && travel < 0.07, `drift travel ${travel.toFixed(3)}`);
  // The background (3 units behind) moves differently from the subject: that is the parallax.
  const back = screenX(pose('drift', 5), [0, 0, -3]) - screenX(pose('drift', 0), [0, 0, -3]);
  assert.ok(Math.abs(back - (xs[5] - xs[0])) > 0.01, 'parallax');
  // Every move other than still visibly changes the picture.
  for (const move of ['drift', 'push_in', 'pull_out', 'orbit', 'rise', 'pan']) {
    const a = pose(move, 0), b = pose(move, 5);
    const d = Math.hypot(...a.position.map((v, i) => v - b.position[i]));
    assert.ok(d > 0.03 * a.distance, `${move} moves (${(d / a.distance).toFixed(3)} of the distance)`);
  }
  const a = pose('still', 0), b = pose('still', 5);
  assert.ok(Math.hypot(...a.position.map((v, i) => v - b.position[i])) < 0.02 * a.distance, 'still is almost static');
});

// ---- label placement ----
const bounds = { left: 60, right: 1020, top: 134, bottom: 1400 };
const size = { w: 300, h: 90 };
const inside = b => b.x >= bounds.left - 0.01 && b.x + b.w <= bounds.right + 0.01 && b.y >= bounds.top - 0.01 && b.y + b.h <= bounds.bottom + 0.01;

test('labels: the preferred side is used when it is free', () => {
  const rect = { x: 150, y: 600, w: 200, h: 280 };
  const wide = { ...bounds, right: 1080 };
  for (const preferred of ['top', 'right', 'bottom']) {
    const c = chooseLabelPlacement({ rect, size, preferred, bounds: wide, obstacles: [], gap: 34 });
    assert.equal(c.side, preferred);
    assert.equal(overlapArea(c.box, rect), 0);
  }
  const mid = { x: 400, y: 600, w: 280, h: 280 };
  assert.equal(chooseLabelPlacement({ rect: mid, size, preferred: 'left', bounds: wide, obstacles: [], gap: 34 }).side, 'left');
});

test('labels: never cover the prop, never leave the frame, and go to another side when blocked', () => {
  const rect = { x: 700, y: 500, w: 300, h: 300 }; // right side has no room
  const c = chooseLabelPlacement({ rect, size, preferred: 'right', bounds, obstacles: [], gap: 34 });
  assert.notEqual(c.side, 'right');
  assert.equal(overlapArea(c.box, rect), 0);
  assert.ok(inside(c.box));
  // Block the top and the left as well: it takes what is left, still clear of the prop.
  const blocked = [{ x: 0, y: 134, w: 1080, h: 330 }, { x: 0, y: 460, w: 650, h: 400 }];
  const d = chooseLabelPlacement({ rect, size, preferred: 'top', bounds, obstacles: blocked, gap: 34 });
  assert.equal(overlapArea(d.box, rect), 0);
  for (const o of blocked) assert.equal(overlapArea(d.box, o), 0, 'clear of obstacles');
  assert.ok(inside(d.box));
});

test('labels: keep clear of other labels, texts and icons (nudging along the side if needed)', () => {
  const rect = { x: 400, y: 600, w: 280, h: 280 };
  const first = chooseLabelPlacement({ rect, size, preferred: 'top', bounds, obstacles: [], gap: 34 });
  const second = chooseLabelPlacement({ rect, size, preferred: 'top', bounds, obstacles: [{ ...first.box, weight: 10 }], gap: 34 });
  assert.equal(overlapArea(first.box, second.box), 0);
  assert.equal(overlapArea(second.box, rect), 0);
  assert.ok(inside(second.box));
});

test('labels: a title keeps the top band closed (bounds.top moves down); results are deterministic', () => {
  const rect = { x: 400, y: 300, w: 280, h: 200 };
  const top = Math.max(bounds.top, TITLE_BAND.bottom * 1920);
  const args = { rect, size, preferred: 'top', bounds: { ...bounds, top }, obstacles: [], gap: 34 };
  const c = chooseLabelPlacement(args);
  assert.ok(c.box.y >= top - 0.01, `label top ${c.box.y} below the title band ${top}`);
  assert.deepEqual(chooseLabelPlacement(args), c);
});

test('labels: a beam or arrow is pointed at in the middle only', () => {
  const rect = { x: 100, y: 300, w: 800, h: 600 }; // a long diagonal beam's bounding box
  const c = chooseLabelPlacement({ rect, line: true, size, preferred: 'top', bounds, obstacles: [], gap: 34 });
  assert.equal(c.side, 'top');
  const b = labelBox(rect, size, 'top', 34, 0, true);
  assert.ok(Math.abs(b.x + b.w / 2 - 500) < 1e-6 && Math.abs(b.y + b.h + 34 - 600) < 1e-6);
});

// ---- environments and beam ----
const envCtx = () => ({ THREE, mat, scale: 1, rng: makeRng(7), color: v => (typeof v === 'string' && v[0] === '#' ? parseInt(v.slice(1), 16) : 0x3355aa) });

test('space env: tint changes the nebula wash; dust layers exist at three depths', () => {
  const build = params => catalog.envs.space.build({ nebula: 'blue', stars: 1, tint: null, ...params }, envCtx());
  const a = build({}), b = build({ tint: '#ff3030' });
  const dome = e => Array.from(e.object.children[0].geometry.attributes.color.array.slice(0, 600));
  assert.notDeepEqual(dome(a), dome(b));
  // The dust layers are the unfogged point layers with a small size (stars use bigger sizes or follow the camera).
  const dust = a.object.children.filter(o => o.isPoints);
  assert.ok(dust.length >= 4, 'near stars plus three dust layers');
  a.update(1.5, { position: [0, 0, 5], target: [0, 0, 0], distance: 5 });
});

test('studio env: floor has a vignette; sky grass and sunset build and update', () => {
  const studio = catalog.envs.studio.build({ color: 'teal', floor: true }, envCtx());
  studio.update(2, { position: [0, 1, 6], target: [0, 0, 0], distance: 6 });
  assert.ok(studio.object.children.some(o => o.renderOrder === 999), 'vignette quad');
  const sky = catalog.envs.sky.build({ time: 'sunset', ground: 'grass', clouds: 0.5 }, envCtx());
  sky.update(0, { position: [0, 1, 6], target: [0, 0, 0], distance: 6 });
});

test('beam: a pure function of t, drawn as crossed soft ribbons (no hard cylinder)', () => {
  const inst = catalog.props.beam.build({ from: 'left', to: 'right', color: '#fff3d6', width: 0.08 }, { color: () => 0xfff3d6, mat });
  const state = { points: { from: { at: [-1, 0, 0], radius: 0 }, to: { at: [1, 0.5, 0], radius: 0 } }, params: { progress: 1, brightness: 1 }, opacity: 1 };
  const body = inst.object.children[0];
  const grab = t => { inst.update(t, state); return JSON.stringify(body.children.map(m => m.material.uniforms.uT.value)); };
  const at2 = grab(2);
  grab(5); grab(0.3);
  assert.equal(grab(2), at2);
  assert.equal(body.children.length, 4, 'two crossed ribbons for the glow and two for the core');
  assert.ok(body.children.every(m => m.geometry.type === 'PlaneGeometry'));
});
