// Story rules (SPEC §14): calibration on the two committed "slideshow" samples (they must fail) and a synthetic
// "mechanism" show (one subject, a dial moving through every sentence: it must pass). Fixtures: tests/fixtures/story/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { resolveShow } from '../kit/engine/show.js';
import { catalog } from '../kit/engine/registry.js';
import { storyRules, sentencesOf, STORY_RULES_DEFAULT } from '../tools/lib/story-rules.mjs';
import { REPO } from './helpers.mjs';

const FIX = path.join(REPO, 'tests/fixtures/story');
function fixture(name) {
  const read = f => JSON.parse(fs.readFileSync(path.join(FIX, name, f), 'utf8'));
  const r = resolveShow(read('show.json'), read('words.json'), catalog);
  assert.deepEqual(r.errors, [], `${name} must be a valid show`);
  return r.show;
}

test('slideshow fixture moon-gone fails: things sit still for over 3.5 s', () => {
  const r = storyRules(fixture('moon-gone'), catalog);
  const still = r.errors.filter(e => e.path === 'story.stillness');
  assert.ok(still.length >= 1, JSON.stringify(r.errors));
  assert.match(still[0].message, /nothing on screen changes from \d+\.\d\d to \d+\.\d\d s \(\d+\.\d\d s; at most 3\.5 s allowed/);
  assert.ok(r.warnings.some(w => w.path === 'story.scenes'));
  assert.ok(r.warnings.some(w => w.path === 'story.subject'));
});

test('slideshow fixture sky-blue fails: a sentence with no change, and a still stretch', () => {
  const r = storyRules(fixture('sky-blue'), catalog);
  const cov = r.errors.find(e => e.path.startsWith('story.sentences['));
  assert.ok(cov, JSON.stringify(r.errors));
  assert.match(cov.message, /the sentence "Then why isn't the sky violet\?" \(24\.81-26\.39 s\) has no visible change/);
  assert.match(cov.hint, /Labels, text, icons, counts and camera moves do not count/);
  assert.ok(r.errors.some(e => e.path === 'story.stillness'));
});

test('mechanism fixture passes every story rule (one subject, a dial bound to it moving through each sentence)', () => {
  const r = storyRules(fixture('mechanism'), catalog);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
  assert.equal(r.measured.uncovered, 0);
  assert.equal(r.measured.scenes, 1);
  assert.ok(r.measured.longestStill.seconds < 2.5);
});

test('a dial that no visible prop follows does not count as a change', () => {
  const read = f => JSON.parse(fs.readFileSync(path.join(FIX, 'mechanism', f), 'utf8'));
  const raw = read('show.json');
  raw.shots[0].props[0] = { id: 'earth', type: 'planet', look: 'earth' };   // nothing bound any more (the env still is)
  const r = resolveShow(raw, read('words.json'), catalog);
  assert.deepEqual(r.errors, []);
  const s = storyRules(r.show, catalog);
  assert.equal(s.measured.uncovered, s.measured.sentences);
});

test('sentences: split at . ? !, very short ones joined to the next, each runs to the next one\'s start', () => {
  const w = (text, start, end) => ({ text, start, end });
  const words = [w('No', 0, 0.2), w('paint.', 0.2, 0.4), w('No', 0.8, 1.0), w('dye.', 1.0, 1.2), w('Just', 1.6, 1.8), w('physics', 1.8, 2.2), w('works', 2.2, 2.8), w('here.', 2.8, 3.2), w('Bye.', 3.5, 3.8)];
  const s = sentencesOf(words);
  assert.deepEqual(s.map(x => x.text), ['No paint. No dye.', 'Just physics works here. Bye.']);
  assert.deepEqual(s.map(x => [x.start, x.end]), [[0, 1.6], [1.6, 3.8]]);
});

const run = args => {
  try { return { code: 0, out: execFileSync(process.execPath, [path.join(REPO, 'tools/validate.mjs'), ...args], { encoding: 'utf8' }) }; }
  catch (e) { return { code: e.status, out: e.stdout + e.stderr }; }
};

test('CLI: --story-rules adds the story errors with the usual JSON shape; --no-story-rules and the default leave old shows passing', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'story-'));
  for (const f of ['show.json', 'words.json']) fs.copyFileSync(path.join(FIX, 'sky-blue', f), path.join(tmp, f));
  fs.writeFileSync(path.join(tmp, 'voice.mp3'), '');
  try {
    const on = run([tmp, '--json', '--story-rules']);
    assert.equal(on.code, 1);
    const j = JSON.parse(on.out);
    assert.equal(j.ok, false);
    assert.ok(j.errors.length >= 2);
    for (const e of [...j.errors, ...j.warnings]) assert.deepEqual(Object.keys(e), ['path', 'message', 'hint']);
    assert.equal(run([tmp, '--no-story-rules']).code, 0);
    assert.equal(run([tmp]).code, STORY_RULES_DEFAULT ? 1 : 0);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});
