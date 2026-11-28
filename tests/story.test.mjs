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
import { storyRules, sentencesOf, changeEvents, STORY_RULES_DEFAULT } from '../tools/lib/story-rules.mjs';
import { REPO, miniShow, resolveMini } from './helpers.mjs';

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
  const cov = r.errors.find(e => e.path.startsWith('story.sentences[') && /violet/.test(e.message));   // the pulses that used to cover the first sentences no longer count
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

test('ground life in a space shot is a warning, once per scene, also in a continuing shot; a person is fine', () => {
  const envErrors = edit => { const raw = miniShow(); edit(raw); const r = resolveMini(raw); assert.deepEqual(r.errors, []); return storyRules(r.show, catalog).warnings.filter(e => e.path === 'story.env'); };
  assert.deepEqual(envErrors(() => {}), []);
  assert.deepEqual(envErrors(raw => raw.shots[0].props.push({ id: 'pilot', type: 'person' })), [], 'astronauts are fine');
  const dino = envErrors(raw => raw.shots[0].props.push({ id: 'rex', type: 'dinosaur' }));
  assert.equal(dino.length, 1);
  assert.match(dino[0].message, /prop "rex" \(dinosaur\) is in shot "one", whose environment is "space"/);
  // Shot two continues shot one: it has the space env and the dinosaur without naming them, and is reported once.
  const cont = envErrors(raw => { raw.shots[0].props.push({ id: 'rex', type: 'dinosaur' }); raw.shots[1] = { id: 'two', start: 'What if sunlight', continue: true, props: [{ id: 'oak', type: 'tree' }] }; });
  assert.deepEqual(cont.map(e => e.message.match(/"(\w+)"/)[1]), ['rex', 'oak']);
  assert.deepEqual(envErrors(raw => raw.shots[1].props.push({ id: 'rex', type: 'dinosaur' })), [], 'the studio is not space');
});

test('a ground prop that starts hidden and never appears in a space shot is not reported', () => {
  const envErrors = edit => { const raw = miniShow(); edit(raw); const r = resolveMini(raw); assert.deepEqual(r.errors, []); return storyRules(r.show, catalog).warnings.filter(e => e.path === 'story.env'); };
  assert.deepEqual(envErrors(raw => raw.shots[0].props.push({ id: 'rex', type: 'dinosaur', hidden: true })), []);
  assert.equal(envErrors(raw => raw.shots[0].props.push({ id: 'rex', type: 'dinosaur' })).length, 1);
});

test('earthbound things in a space shot are only a warning (the picture critic judges them)', () => {
  const run = type => { const raw = miniShow(); raw.shots[0].props.push({ id: 'x', type }); const r = resolveMini(raw); assert.deepEqual(r.errors, []); const s = storyRules(r.show, catalog); return { e: s.errors.filter(q => q.path === 'story.env'), w: s.warnings.filter(q => q.path === 'story.env') }; };
  for (const type of ['dinosaur', 'tree', 'house', 'fish', 'bird', 'ship', 'car', 'city', 'plane', 'submarine', 'crowd']) { const r = run(type); assert.equal(r.e.length, 0, type); assert.equal(r.w.length, 1, type); }
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

test('pulse and shake are emphasis only: they are not a change, so they cannot fill a sentence or a still stretch', () => {
  const show = { shots: [{ id: 's1', actions: [
    { do: 'pulse', prop: 'a', t0: 1, over: 0.5 }, { do: 'shake', prop: 'a', t0: 2, for: 1 }, { do: 'scale', prop: 'a', t0: 3, over: 1 },
  ] }] };
  assert.deepEqual(changeEvents(show).map(e => e.what), ['scale on "a"']);
  const r = storyRules(fixture('sky-blue'), catalog);
  assert.match(r.errors.find(e => e.path.startsWith('story.sentences[')).hint, /Pulse and shake are emphasis only/);
  assert.match(r.errors.find(e => e.path === 'story.stillness').hint, /pulse, shake/);
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

test('an earthbound prop the narration names is a thought experiment: a warning, not an error', () => {
  const run = (type, words) => {
    const raw = miniShow(); raw.shots[0].props.push({ id: 'x', type });
    const r = resolveMini(raw); assert.deepEqual(r.errors, []);
    if (words) r.show.words = r.show.words.map((w, i) => (i === 0 ? { ...w, text: words } : w));
    const s = storyRules(r.show, catalog);
    return { e: s.errors.filter(q => q.path === 'story.env'), w: s.warnings.filter(q => q.path === 'story.env') };
  };
  const named = run('bird', 'Could a bird fly');
  assert.equal(named.e.length, 0); assert.equal(named.w.length, 1);
  const other = run('bird', 'Could a plane fly');
  assert.equal(other.e.length, 0); assert.equal(other.w.length, 1); assert.match(other.w[0].message, /cannot float in space/);
  assert.equal(run('dinosaur', 'Dinosaurs').e.length, 0, 'plural');
  assert.match(named.w[0].message, /the narration names the bird.*check it is intended/);
  assert.equal(run('house', 'our home planet').w[0].message.includes('cannot float'), true, '"home" does not name a house');
});
