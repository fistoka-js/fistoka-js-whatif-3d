// Action folding: values at time t, chaining (each tween starts where the last one ended), and purity
// (the same t gives the same values whatever was asked before, in any order).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeShotState } from '../kit/engine/state.js';
import { catalog } from '../kit/engine/registry.js';
import { resolve, resolveMini, miniShow, demoShow } from './helpers.mjs';

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test('appear: hidden before, popping during, shown after', () => {
  const shot = resolveMini(miniShow()).show.shots[0];
  const st = makeShotState(shot, catalog);
  assert.equal(st.propAt('moon', 0.5).visible, false);
  const mid = st.propAt('moon', 0.88 + 0.25);
  assert.equal(mid.visible, true);
  assert.ok(mid.scale > 0.3 && mid.scale < 1.3);
  close(st.propAt('moon', 2).scale, 1);
});

test('move tweens from the slot to the target and stays there', () => {
  const shot = resolveMini(miniShow()).show.shots[0];
  const st = makeShotState(shot, catalog);
  assert.deepEqual(st.propAt('moon', 2.0).position, [0.8, 0, 0]);
  const half = st.propAt('moon', 2.4 + 0.5).position[0];
  assert.ok(half < 0.8 && half > -0.8);
  assert.deepEqual(st.propAt('moon', 4.9).position, [-0.8, 0, 0]);
});

test('chained tweens: the second starts from where the first ended', () => {
  const s = miniShow();
  s.shots[0].actions.push({ at: 'That\'s', do: 'move', prop: 'moon', to: 'top', over: 1 });
  const st = makeShotState(resolveMini(s).show.shots[0], catalog);
  // At the start of the second move (3.66) the moon is at "left"; mid-way it is between left and top.
  const p = st.propAt('moon', 3.66 + 0.5).position;
  assert.ok(p[0] < 0 && p[0] > -0.8 && p[1] > 0 && p[1] < 0.9, JSON.stringify(p));
});

test('purity: same t, same values, regardless of call order', () => {
  const { show } = resolve(demoShow());
  for (const shot of show.shots) {
    const a = makeShotState(shot, catalog), b = makeShotState(shot, catalog);
    const times = [];
    for (let t = shot.start; t < shot.end; t += 0.37) times.push(t);
    const forward = times.map(t => shot.props.map(p => a.propAt(p.id, t)));
    const backward = [...times].reverse().map(t => shot.props.map(p => b.propAt(p.id, t))).reverse();
    assert.deepEqual(forward, backward, shot.id);
    // Asking for other times in between changes nothing.
    const t = shot.start + 0.5 * (shot.end - shot.start);
    const first = JSON.stringify([a.cameraAt(t), shot.props.map(p => a.propAt(p.id, t))]);
    a.cameraAt(shot.end - 0.01); a.propAt(shot.props[0].id, shot.start);
    assert.equal(JSON.stringify([a.cameraAt(t), shot.props.map(p => a.propAt(p.id, t))]), first, shot.id);
  }
});

test('set tweens an animatable param; glow and color fold too', () => {
  const shot = resolve(demoShow()).show.shots[1]; // no-blue
  const st = makeShotState(shot, catalog);
  assert.equal(st.propAt('light', 5.3).params.progress, 0);
  close(st.propAt('light', 6).params.progress, 1);
  assert.equal(st.propAt('earth', 5.6).params.atmosphere, 0.9);
  close(st.propAt('earth', 7.5).params.atmosphere, 0.05);
  assert.notEqual(st.propAt('light', 7).color, st.propAt('light', 5.5).color, 'beam turned orange');
});

test('orbit circles the centre prop at the chosen period', () => {
  const shot = resolve(demoShow()).show.shots[7]; // the-air: the moon orbits the earth from "the ocean" (49.42)
  const st = makeShotState(shot, catalog);
  const a = st.propAt('moon', 50).position, b = st.propAt('moon', 50 + 9).position;
  const e = st.propAt('earth', 50).position;
  close(Math.hypot(a[0] - e[0], a[2] - e[2]) > 0.2 ? 1 : 0, 1);
  // One full period later it is back in (almost) the same place (the earth bobs a little).
  assert.ok(Math.hypot(a[0] - b[0], a[2] - b[2]) < 0.05);
});

test('camera: the subject sphere is computed over the whole shot and the camera always moves a little', () => {
  const { show } = resolve(demoShow());
  for (const shot of show.shots) {
    const st = makeShotState(shot, catalog);
    const p0 = st.cameraAt(shot.start + 0.1).position, p1 = st.cameraAt(shot.start + 1.1).position;
    assert.ok(Math.hypot(p0[0] - p1[0], p0[1] - p1[1], p0[2] - p1[2]) > 1e-3, `${shot.id}: camera never fully still`);
    if (shot.env.ground) assert.ok(p0[1] > 0, `${shot.id}: camera stays above the ground`);
  }
});
