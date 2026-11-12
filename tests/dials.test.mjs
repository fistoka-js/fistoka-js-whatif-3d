// Round 2 engine additions (SPEC §12, §13): dials, bindings, continuing shots, "until" ramps, the dive transition,
// and the validator messages for their typical mistakes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveDials, dialAt, bindingAt } from '../kit/engine/dials.js';
import { wavelengthColor, parseColor } from '../kit/engine/palette.js';
import { makeShotState } from '../kit/engine/state.js';
import { catalog } from '../kit/engine/registry.js';
import { WORDS, MINI_WORDS, resolveMini } from './helpers.mjs';

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

// Words used below (demo-sky): sky 0.88, reflects 2.40, completely 3.82, What 5.00, no 5.70, all 6.45, totally 7.82.
function dialShow() {
  return {
    format: 1, title: 'Dials', voice: { audio: 'voice.mp3', words: 'words.json' },
    dials: { heat: { start: 0.1, keys: [{ at: 'sky is blue', to: 0.5 }, { at: 'completely wrong', to: 1, ease: 'linear' }, { at: 'What if', to: 0, hold: true }] } },
    shots: [
      {
        id: 'one', env: { type: 'studio', color: { dial: 'heat', colors: ['#000000', '#ffffff'] } },
        props: [
          { id: 'earth', type: 'planet', atmosphere: { dial: 'heat', to: [0, 1.5] }, color: { dial: 'heat', colors: 'spectrum' } },
          { id: 'ball', type: 'ball', at: 'left', size: { dial: 'heat', to: [0.5, 1] } },
        ],
        actions: [{ at: 'reflects', do: 'move', prop: 'ball', to: 'right', until: 'completely' }],
      },
      {
        id: 'two', start: 'What if sunlight', continue: true, camera: { framing: 'close' },
        props: [{ id: 'box', type: 'box', at: 'top' }],
        actions: [{ at: 'no blue', do: 'scale', prop: 'earth', to: 1.5 }, { at: 'no blue', do: 'move', prop: 'ball', to: 'center', over: 0.5 }],
      },
    ],
  };
}
const resolved = () => { const r = resolveMini(dialShow()); assert.deepEqual(r.errors, []); return r.show; };

// ---------- dials ----------

test('dial: start before the first key, smooth ramp to the next key, linear, hold, keys at phrase anchors', () => {
  const { dials, errors } = resolveDials(dialShow().dials, WORDS);
  assert.deepEqual(errors, []);
  const d = dials.heat;
  assert.deepEqual(d.keys.map(k => [k.t0, k.over]), [[0.88, 2.94], [3.82, 1.18], [5, 0]]);
  close(dialAt(d, 0), 0.1);
  close(dialAt(d, 0.87), 0.1);                      // before the first key = start
  close(dialAt(d, (0.88 + 3.82) / 2), 0.3);          // smooth: half way in time = half way in value
  assert.ok(dialAt(d, 1.5) < 0.1 + 0.4 * (1.5 - 0.88) / 2.94, 'smooth starts slower than linear');
  close(dialAt(d, 3.82), 0.5);                       // arrives when the next key starts
  close(dialAt(d, 3.82 + 0.59), 0.75);               // linear: half the time, half the change
  assert.ok(dialAt(d, 4.99) > 0.99);
  close(dialAt(d, 5), 0);                            // hold: a step at its word
  close(dialAt(d, 40), 0);
});

test('dial: "over", "until", the last key takes 1 s, and the same word keyed twice means its next occurrence', () => {
  const { dials, errors } = resolveDials({
    a: { keys: [{ at: 'the', to: 1, over: 0.5 }, { at: 'the', to: 2, until: 'completely' }, { at: 'totally', to: 3 }] },
  }, WORDS);
  assert.deepEqual(errors, []);
  assert.deepEqual(dials.a.keys.map(k => [k.t0, k.over]), [[0.68, 0.5], [2.68, 1.14], [7.82, 1]]);
  close(dialAt(dials.a, 0.5), 0);                    // start defaults to 0
  close(dialAt(dials.a, 1.5), 1);                    // arrived after 0.5 s and waits
  close(dialAt(dials.a, 3.82), 2);
  close(dialAt(dials.a, 9), 3);
});

test('dial: the same t gives the same value, whatever was asked before (pure)', () => {
  const d = resolveDials(dialShow().dials, WORDS).dials.heat;
  const a = [4.4, 1.2, 9, 0.3, 2.2].map(t => dialAt(d, t));
  const b = [2.2, 0.3, 9, 1.2, 4.4].map(t => dialAt(d, t)).reverse();
  assert.deepEqual(a, b);
});

// ---------- bindings ----------

test('bindings: number mapping with "from" (clamped), colour stops, "spectrum", places', () => {
  const dials = { d: { name: 'd', start: 0.5, keys: [] } };
  close(bindingAt({ dial: 'd', to: [0.4, 1.6] }, dials, 0), 1.0);
  close(bindingAt({ dial: 'd', from: [0.25, 0.75], to: [10, 20] }, dials, 0), 15);
  close(bindingAt({ dial: 'd', from: [0.6, 1], to: [10, 20] }, dials, 0), 10);           // below "from": the low end
  assert.equal(bindingAt({ dial: 'd', colors: ['#000000', '#ffffff'] }, dials, 0), 0x808080);
  assert.equal(bindingAt({ dial: 'd', colors: ['#ff0000', '#00ff00', '#0000ff'] }, dials, 0), 0x00ff00); // middle stop
  assert.equal(bindingAt({ dial: 'd', colors: 'spectrum' }, dials, 0), parseColor(wavelengthColor(0.5)));
  assert.deepEqual(bindingAt({ dial: 'd', to: ['left', 'right'] }, dials, 0), [0, 0, 0]);
  const low = { d: { name: 'd', start: 0, keys: [] } }, high = { d: { name: 'd', start: 1, keys: [] } };
  assert.equal(bindingAt({ dial: 'd', colors: 'spectrum' }, low, 0), 0x2a8ff5);   // blue end
  assert.equal(bindingAt({ dial: 'd', colors: 'spectrum' }, high, 0), 0xf52a2a);  // red end
});

test('wavelengthColor: blue at 0, green, yellow, red at 1 (the approved chameleon colours)', () => {
  assert.deepEqual([0, 0.3, 0.55, 1].map(wavelengthColor), ['#2a8ff5', '#2af58f', '#f5eb2a', '#f52a2a']);
  assert.equal(wavelengthColor(-3), wavelengthColor(0));
  assert.equal(wavelengthColor(7), wavelengthColor(1));
});

test('bound prop values follow the dial in the state; build values are the values at the scene start', () => {
  const show = resolved();
  const [one] = show.shots;
  const earth = one.props.find(p => p.id === 'earth'), ball = one.props.find(p => p.id === 'ball');
  close(earth.params.atmosphere, 0.15);                      // 0.1 * 1.5 at 0 s
  assert.equal(earth.params.color, wavelengthColor(0.1));
  assert.equal(ball.size, 1);                                // a bound size is built at its largest
  assert.equal(one.env.params.color, '#1a1a1a');             // 0.1 of the way from black to white
  assert.ok(one.env.bind.color);
  const st = makeShotState(one, catalog);
  close(st.propAt('earth', 0.2).params.atmosphere, 0.15);
  close(st.propAt('earth', 3.82).params.atmosphere, 0.75);
  assert.equal(st.propAt('earth', 3.82).color, parseColor(wavelengthColor(0.5)));
  close(st.propAt('ball', 0.2).scale, 0.55);                 // size 0.5..1 at dial 0.1 -> 0.55 of the built size 1
  close(st.propAt('ball', 3.82).scale, 0.75);
});

test('a plain show resolves exactly as before: no "bind" on the env, empty binds on props', () => {
  const r = resolveMini({ format: 1, title: 'x', voice: { audio: 'voice.mp3', words: 'words.json' }, shots: [{ id: 'a', env: 'space', props: [{ id: 'b', type: 'ball' }] }] });
  assert.deepEqual(r.errors, []);
  assert.deepEqual(Object.keys(r.show.shots[0].env), ['type', 'params', 'ground']);
  assert.deepEqual(r.show.shots[0].props[0].bind, {});
  assert.equal(r.show.shots[0].props[0].glow, 0);
});

// ---------- continuing shots ----------

test('continue: the state carries over the cut, earlier props are targetable, new props join at the shot start', () => {
  const show = resolved();
  const [one, two] = show.shots;
  assert.equal(two.continue, true);
  assert.equal(two.env, one.env);
  assert.deepEqual(two.props.map(p => p.id), ['earth', 'ball', 'box']);
  assert.deepEqual(two.actions.map(a => a.prop), ['earth', 'ball']); // its own actions only
  assert.equal(two.scene.actions.length, 3);                         // the scene's actions so far
  const st2 = makeShotState(two, catalog);
  assert.deepEqual(st2.propAt('ball', 5.0).position.slice(0, 1), [0.8]);  // moved right in shot one, still there
  close(st2.propAt('ball', 6.5).position[0], 0);                     // then moved by shot two's action
  close(st2.propAt('earth', 6.5).scale, 1.5);
  assert.equal(st2.propAt('box', 4.9).visible, false);               // not in the scene before its shot
  assert.equal(st2.propAt('box', 5.1).visible, true);
});

test('a shot without "continue" starts afresh (same prop id, own starting state)', () => {
  const s = dialShow();
  s.shots[1] = { id: 'two', start: 'What if sunlight', env: 'space', props: [{ id: 'ball', type: 'ball', at: 'left' }] };
  const { show, errors } = resolveMini(s);
  assert.deepEqual(errors, []);
  const two = show.shots[1];
  assert.equal(two.continue, false);
  assert.deepEqual(two.props.map(p => p.id), ['ball']);
  assert.deepEqual(makeShotState(two, catalog).propAt('ball', 5.5).position, [-0.8, 0, 0]);
});

test('continue: the camera frames the props visible in that shot (not ones that left earlier)', () => {
  const s = dialShow();
  s.shots[0].actions.push({ at: 'ocean', do: 'disappear', prop: 'earth' });
  s.shots[1].actions = [];
  const { show, errors } = resolveMini(s);
  assert.deepEqual(errors, []);
  const center = makeShotState(show.shots[1], catalog).baseFocus.center;
  assert.ok(center[1] > 0.3, `frames ball (moved right) and box (top), not the hidden planet: ${JSON.stringify(center)}`);
});

test('until ramps: "until" sets the length; it may run on into a continuing shot', () => {
  const show = resolved();
  const mv = show.shots[0].actions[0];
  close(mv.t0, 2.4); close(mv.over, 1.42);
  const s = dialShow();
  s.shots[0].actions[0].until = 'no blue';               // after shot one ends, inside the scene
  const r = resolveMini(s);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
  close(r.show.shots[0].actions[0].over, 5.7 - 2.4);
  const st2 = makeShotState(r.show.shots[1], catalog);
  const x = st2.propAt('ball', 5.2).position[0];
  assert.ok(x > -0.8 && x < 0.8, `still moving after the cut: ${x}`);
});

test('dive: the shot before pushes in at its end, the dive shot starts close and pulls back', () => {
  const s = dialShow();
  s.shots[1].transition = 'dive';
  const { show, errors } = resolveMini(s);
  assert.deepEqual(errors, []);
  assert.equal(show.shots[0].diveOut, true);
  const one = makeShotState(show.shots[0], catalog), two = makeShotState(show.shots[1], catalog);
  assert.ok(one.cameraAt(4.99).distance < 0.3 * one.cameraAt(4.5).distance);
  assert.ok(two.cameraAt(5.0).distance < 0.5 * two.cameraAt(6.2).distance);
});

// ---------- validator messages ----------

function errorFor(edit, where) {
  const s = dialShow();
  edit(s);
  const { errors } = resolveMini(s);
  const hit = errors.find(e => e.path === where);
  assert.ok(hit, `no error at ${where}; got: ${JSON.stringify(errors, null, 1)}`);
  return `${hit.message} ${hit.hint}`;
}

const CASES = [
  ['unknown dial in a binding', s => { s.shots[0].props[0].atmosphere.dial = 'heet'; }, 'shots[0].props[0].atmosphere.dial', /"heet" is not a dial \(dials in this show: heat\)\. Did you mean "heat"\?/],
  ['binding but no dials at all', s => { delete s.dials; }, 'shots[0].props[0].atmosphere.dial', /this show has no "dials"\. Add a top-level "dials"/],
  ['binding on a build-time param', s => { s.shots[0].props[0].look = { dial: 'heat', to: [0, 1] }; }, 'shots[0].props[0].look', /"look" is fixed when the planet is built, so it cannot follow a dial\. Only animatable params \(for planet: atmosphere\), colour, glow, size and position/],
  ['binding on an env param that cannot follow a dial', s => { s.shots[0].env = { type: 'space', nebula: { dial: 'heat', colors: ['#000000', '#ffffff'] } }; }, 'shots[0].env.nebula', /"nebula" of the space environment is fixed.*can follow a dial: studio \(color\), lab \(color\)/],
  ['number range outside the param', s => { s.shots[0].props[0].atmosphere.to = [0, 5]; }, 'shots[0].props[0].atmosphere.to[1]', /5 is too big \(allowed: number 0\.\.1\.5\)/],
  ['colour binding written like a number binding', s => { s.shots[0].props[0].color = { dial: 'heat', to: [0, 1] }; }, 'shots[0].props[0].color.to', /"to" is not a binding field here \(a colour follows a dial with "colors"/],
  ['continue on the first shot', s => { s.shots[0].continue = true; }, 'shots[0].continue', /the first shot has nothing to continue/],
  ['env on a continuing shot', s => { s.shots[1].env = 'space'; }, 'shots[1].env', /a continuing shot keeps the environment of shot "one"; remove "env"/],
  ['a continuing shot declares an earlier prop again', s => { s.shots[1].props.push({ id: 'ball', type: 'ball' }); }, 'shots[1].props[1].id', /"ball" is already in this scene \(declared in shot "one"\)/],
  ['action changes a bound value', s => { s.shots[0].actions.push({ at: 'ocean', do: 'set', prop: 'earth', param: 'atmosphere', to: 1 }); }, 'shots[0].actions[1].do', /"atmosphere" of "earth" follows dial "heat", so "set" cannot change it/],
  ['until before at on a ramp', s => { s.shots[0].actions[0].until = { phrase: 'ocean', offset: -1 }; }, 'shots[0].actions[0].until', /resolves to 1\.92 s, which is not after "at" \(2\.40 s\)/],
  ['over and until on one ramp', s => { s.shots[0].actions[0].over = 1; }, 'shots[0].actions[0].until', /give "over" \(seconds\) or "until" \(a phrase\), not both/],
  ['dial key out of order', s => { s.dials.heat.keys[1].at = { time: 0.2 }; }, 'dials.heat.keys[1].at', /resolves to 0\.20 s, before the previous key of dial "heat" \(0\.88 s\)\. Dial keys must be in spoken order/],
  ['dial key phrase not spoken after the previous key', s => { s.dials.heat.keys[2].at = 'sky is blue'; }, 'dials.heat.keys[2].at', /"sky is blue" is not spoken in the narration after key 1 of dial "heat".*It is spoken at 0\.88 s/],
  ['dial key inside a shot', s => { s.dials.heat.keys[0].at = { shot: 0.5 }; }, 'dials.heat.keys[0].at', /a dial belongs to the whole show, not a shot/],
  ['dial key field typo', s => { s.dials.heat.keys[0].too = 1; }, 'dials.heat.keys[0].too', /"too" is not a field here.*Did you mean "to"\?/],
  ['dive on the first shot', s => { s.shots[0].transition = 'dive'; }, 'shots[0].transition', /the first shot has no shot before it/],
];
for (const [name, edit, where, pattern] of CASES) {
  test(`broken show: ${name}`, () => { assert.match(errorFor(edit, where), pattern); });
}

test('MINI_WORDS covers both shots of the dial show', () => { assert.equal(MINI_WORDS[MINI_WORDS.length - 1].text, 'all?'); });
