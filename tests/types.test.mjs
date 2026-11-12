// The type checker: each message says what was given, what is allowed, and the nearest valid name.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { check, checkFields, nearest } from '../kit/engine/types.js';

const msg = (v, spec, ctx) => check(v, spec, 'x', ctx).map(p => `${p.message} ${p.hint}`).join(' | ');

test('numbers: type and range, with the allowed range in the message', () => {
  assert.deepEqual(check(0.5, { type: 'number', min: 0, max: 1 }, 'x'), []);
  assert.match(msg(3, { type: 'number', min: 0, max: 2 }), /3 is too big \(allowed: number 0\.\.2\)/);
  assert.match(msg(-1, { type: 'number', min: 0, max: 2 }), /-1 is too small/);
  assert.match(msg('big', { type: 'number', min: 0, max: 2 }), /"big" is not a number/);
  assert.match(msg(1.5, { type: 'int', min: 0, max: 3 }), /must be a whole number/);
});

test('enum: lists the allowed values and suggests the nearest', () => {
  assert.match(msg('fad', { type: 'enum', values: ['pop', 'fade', 'grow'] }), /"fad" is not allowed here \(allowed: "pop", "fade", "grow"\)\. Did you mean "fade"\?/);
  assert.match(msg('push-in', { type: 'enum', values: ['push_in', 'orbit'] }), /Did you mean "push_in"\?/);
});

test('colours: hex or palette name, with a suggestion', () => {
  assert.deepEqual(check('#ff0000', { type: 'color' }, 'x'), []);
  assert.deepEqual(check('#f00', { type: 'color' }, 'x'), []);
  assert.deepEqual(check('teal', { type: 'color' }, 'x'), []);
  assert.match(msg('bleu', { type: 'color' }), /"bleu" is not a colour.*Did you mean "blue"\?/);
});

test('places and points: slots, coordinates and prop ids', () => {
  assert.deepEqual(check('top-left', { type: 'place' }, 'x'), []);
  assert.deepEqual(check([1, 2, 0], { type: 'place' }, 'x'), []);
  assert.match(msg('topleft', { type: 'place' }), /"topleft" is not a slot.*Did you mean "top-left"\?/);
  assert.match(msg([1, 2], { type: 'place' }), /must be three numbers/);
  assert.match(msg([100, 0, 0], { type: 'place' }), /very far from the stage/);
  assert.deepEqual(check('earth', { type: 'point' }, 'x', { propIds: ['earth'] }), []);
  assert.match(msg('erth', { type: 'point' }, { propIds: ['earth'] }), /or a prop id here \(earth\).*Did you mean "earth"\?/);
});

test('propId and lists', () => {
  assert.match(msg('mooon', { type: 'propId' }, { propIds: ['earth', 'moon'] }), /"mooon" is not a prop in this shot \(props here: earth, moon\)\. Did you mean "moon"\?/);
  const p = check(['earth', 'mars'], { type: 'list', of: { type: 'propId' } }, 'focus', { propIds: ['earth'] });
  assert.equal(p.length, 1);
  assert.equal(p[0].path, 'focus[1]');
});

test('checkFields: unknown fields get a "did you mean", required fields are reported', () => {
  const specs = { text: { type: 'string', required: true }, side: { type: 'enum', values: ['left', 'right'], default: 'left' } };
  const p = checkFields({ txt: 'hi', side: 'left' }, specs, 'a');
  assert.equal(p.length, 2);
  assert.equal(p[0].path, 'a.txt');
  assert.match(p[0].message, /"txt" is not a field here \(allowed: text, side\)/);
  assert.equal(p[0].hint, 'Did you mean "text"?');
  assert.match(p[1].message, /"text" is required/);
});

test('nearest returns null when nothing is close', () => {
  assert.equal(nearest('zebra', ['planet', 'ball']), null);
  assert.equal(nearest('planit', ['planet', 'ball']), 'planet');
});
