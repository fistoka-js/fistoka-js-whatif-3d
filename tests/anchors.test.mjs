// Anchors: phrase matching (case, punctuation, hyphens), edge/offset, time/shot forms, and not-found messages.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findPhrase, resolveAnchor, anchorShapeProblem, normWord } from '../kit/engine/anchors.js';
import { WORDS } from './helpers.mjs';

const words = [
  { text: 'That\'s', start: 0.0, end: 0.3 }, { text: 'completely', start: 0.3, end: 0.8 }, { text: 'WRONG.', start: 0.8, end: 1.2 },
  { text: 'A', start: 1.5, end: 1.6 }, { text: 'well-known', start: 1.6, end: 2.1 }, { text: 'fact,', start: 2.1, end: 2.5 },
  { text: 'wrong', start: 3.0, end: 3.4 },
];

test('matching ignores case and punctuation', () => {
  assert.equal(normWord('That\'s,'), 'thats');
  assert.deepEqual(findPhrase(words, 'thats completely wrong'), { start: 0, end: 1.2 });
  assert.deepEqual(findPhrase(words, 'Wrong!'), { start: 0.8, end: 1.2 });
});

test('hyphenated words match as separate words', () => {
  assert.deepEqual(findPhrase(words, 'well known fact'), { start: 1.6, end: 2.5 });
  assert.deepEqual(findPhrase(words, 'well-known'), { start: 1.6, end: 2.1 });
});

test('search starts at the given time (second "wrong")', () => {
  assert.equal(findPhrase(words, 'wrong', 1.0).start, 3.0);
  assert.equal(findPhrase(words, 'wrong', 3.5), null);
});

test('edge and offset', () => {
  assert.equal(resolveAnchor({ phrase: 'completely', edge: 'end' }, { words }).t, 0.8);
  assert.equal(resolveAnchor({ phrase: 'completely', offset: 0.25 }, { words }).t, 0.55);
  assert.equal(resolveAnchor({ phrase: 'completely', offset: -2 }, { words }).t, 0, 'never below 0');
});

test('time and shot fraction anchors', () => {
  assert.equal(resolveAnchor({ time: 2.5 }, { words }).t, 2.5);
  assert.equal(resolveAnchor({ shot: 0.5 }, { words, shot: { start: 2, end: 4 } }).t, 3);
  assert.match(resolveAnchor({ shot: 0.5 }, { words, shot: null }).error, /only be used inside a shot/);
});

test('not found: the message lists the words spoken in the shot, with times', () => {
  const r = resolveAnchor('purple cow', { words: WORDS, from: 13.72, until: 21.42, where: 'shot "molecules" (13.72-21.42 s)' });
  assert.match(r.error, /"purple cow" is not spoken in shot "molecules"/);
  assert.match(r.error, /not in the narration at all/);
  assert.match(r.error, /When \(13\.72\) it \(13\.87\) enters \(14\.02\)/);
  assert.doesNotMatch(r.error, /rainbow/, 'only this shot\'s words are listed');
});

test('not found because it is spoken before the shot: says when', () => {
  const r = resolveAnchor('reflects', { words: WORDS, from: 13.72, until: 21.42, where: 'this shot' });
  assert.match(r.error, /It is spoken at 2\.40 s, before this shot starts/);
});

test('anchor shape problems are explained', () => {
  assert.equal(anchorShapeProblem('the sky'), null);
  assert.match(anchorShapeProblem('one two three four five six seven'), /7 words; use 1 to 6/);
  assert.match(anchorShapeProblem({ phrase: 'sky', edge: 'middle' }), /edge "middle" must be "start" or "end"/);
  assert.match(anchorShapeProblem({ when: 3 }), /is not an anchor/);
  assert.match(anchorShapeProblem(''), /has no words/);
});
