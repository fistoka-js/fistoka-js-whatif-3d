// Show resolving: shot windows, duration, defaults, hidden-at-start, action order; caption chunking.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, resolveMini, miniShow, demoShow, WORDS } from './helpers.mjs';
import { buildChunks } from '../kit/engine/captions.js';

test('shot windows: each shot runs to the next start; the last to the last word + tail', () => {
  const { show, errors } = resolveMini(miniShow());
  assert.deepEqual(errors, []);
  assert.equal(show.shots[0].start, 0);
  assert.equal(show.shots[0].end, 5.0, 'ends where "What if sunlight" starts');
  assert.equal(show.shots[1].start, 5.0);
  assert.equal(show.duration, 7.54, 'last word ends 7.14, default tail 0.4');
  assert.equal(show.shots[1].end, show.duration);
});

test('tail changes the duration', () => {
  const s = miniShow(); s.tail = 1;
  assert.equal(resolveMini(s).show.duration, 8.14);
});

test('the demo show resolves to the planned shots', () => {
  const { show, errors, warnings } = resolve(demoShow());
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
  assert.deepEqual(show.shots.map(s => s.start), [0, 5, 13.72, 21.42, 26.54, 31.52, 39.44, 47.22]);
  for (let i = 1; i < show.shots.length; i++) assert.equal(show.shots[i - 1].end, show.shots[i].start, 'no gaps or overlaps');
});

test('defaults are filled in and env strings are expanded', () => {
  const { show } = resolveMini(miniShow());
  const shot = show.shots[0];
  assert.deepEqual(shot.env, { type: 'space', params: { nebula: 'blue', stars: 1, tint: null }, ground: false });
  assert.equal(shot.camera.move, 'drift');
  assert.equal(shot.camera.framing, 'medium');
  const earth = shot.props[0];
  assert.deepEqual(earth.at, [0, 0, 0]);
  assert.equal(earth.size, 1);
  assert.equal(earth.params.look, 'earth');
  assert.equal(earth.params.atmosphere, 0.6, 'animatable params start at their default');
  assert.equal(show.shots[1].env.ground, true, 'studio has a floor by default');
});

test('a prop whose first action is appear starts hidden', () => {
  const { show } = resolveMini(miniShow());
  const [earth, moon] = show.shots[0].props;
  assert.equal(earth.startsHidden, false);
  assert.equal(moon.startsHidden, true);
});

test('actions get times, default over, and are sorted by time', () => {
  const s = miniShow();
  s.shots[0].actions.reverse();
  const acts = resolveMini(s).show.shots[0].actions;
  assert.deepEqual(acts.map(a => a.do), ['appear', 'move']);
  assert.equal(acts[0].t0, 0.88);
  assert.equal(acts[0].over, 0.5);
  assert.equal(acts[0].style, 'pop');
  assert.equal(acts[1].over, 1);
});

test('captions: max 4 words / 22 characters, break at sentence ends', () => {
  const chunks = buildChunks(WORDS);
  for (const c of chunks) {
    assert.ok(c.words.length <= 4, c.words.map(w => w.text).join(' '));
    assert.ok(c.words.map(w => w.text).join(' ').length <= 22 || c.words.length === 1);
  }
  assert.equal(chunks.map(c => c.words.map(w => w.text).join(' ')).find(t => t.includes('ocean.')), 'reflects the ocean.');
});
