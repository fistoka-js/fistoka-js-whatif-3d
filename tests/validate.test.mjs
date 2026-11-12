// The validator: the demo is clean, and ~15 typical mistakes each give a helpful message at the right path.
// Also runs tools/validate.mjs itself for the exit codes and the --json output.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { resolve, demoShow, REPO, WORDS } from './helpers.mjs';

// Applies `edit` to a copy of the demo show and returns the single matching error (by path).
function errorFor(edit, pathWanted) {
  const s = demoShow();
  edit(s);
  const { errors } = resolve(s);
  const hit = errors.find(e => e.path === pathWanted);
  assert.ok(hit, `no error at ${pathWanted}; got: ${JSON.stringify(errors, null, 1)}`);
  return `${hit.message} ${hit.hint}`;
}

test('the demo show has no errors and no warnings', () => {
  const { errors, warnings } = resolve(demoShow());
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
});

const CASES = [
  ['unknown prop type', s => { s.shots[1].props[1].type = 'planit'; }, 'shots[1].props[1].type', /"planit" is not a prop \(allowed: ball, box, planet.*Did you mean "planet"\?/],
  ['unknown env', s => { s.shots[0].env.type = 'skye'; }, 'shots[0].env.type', /"skye" is not an environment.*Did you mean "sky"\?/],
  ['unknown action', s => { s.shots[0].actions[0].do = 'apear'; }, 'shots[0].actions[0].do', /"apear" is not an action.*Did you mean "appear"\?/],
  ['action names a missing prop', s => { s.shots[1].actions[0].prop = 'snu'; }, 'shots[1].actions[0].prop', /"snu" is not a prop in this shot \(props here: sun, earth, light.*Did you mean "sun"\?/],
  ['phrase not spoken in the shot', s => { s.shots[2].actions[2].at = 'gas giants'; }, 'shots[2].actions[2].at', /"gas giants" is not spoken in shot "molecules".*Words spoken in shot "molecules".*collides \(15\.43\)/],
  ['phrase only spoken later', s => { s.shots[0].actions[0].at = 'rainbow'; }, 'shots[0].actions[0].at', /"rainbow" is not spoken inside shot "myth".*next time it is spoken is 12\.95 s, after this shot ends/],
  ['typo in a field name', s => { s.shots[0].actions[2].txt = s.shots[0].actions[2].text; delete s.shots[0].actions[2].text; }, 'shots[0].actions[2].txt', /"txt" is not a field here.*Did you mean "text"\?/],
  ['missing required field', s => { delete s.shots[0].actions[2].text; }, 'shots[0].actions[2].text', /"text" is required/],
  ['bad enum value', s => { s.shots[1].actions[0].style = 'grows'; }, 'shots[1].actions[0].style', /"grows" is not allowed here \(allowed: "pop", "fade", "grow".*Did you mean "grow"\?/],
  ['number out of range', s => { s.shots[0].props[2].size = 9; }, 'shots[0].props[2].size', /9 is too big \(allowed: number 0\.05\.\.6\)/],
  ['bad colour', s => { s.shots[0].props[2].color = 'redd'; }, 'shots[0].props[2].color', /"redd" is not a colour.*Did you mean "red"\?/],
  ['set on a param that is not animatable', s => { s.shots[1].actions[3].param = 'atmosfere'; }, 'shots[1].actions[3].param', /"atmosfere" is not an animatable param of planet \(animatable: atmosphere\)\. Did you mean "atmosphere"\?/],
  ['move on a stage-space prop', s => { s.shots[0].actions.push({ at: 'ocean', do: 'move', prop: 'bounce', to: 'left' }); }, 'shots[0].actions[7].do', /"bounce" \(beam\) is drawn between its points, so it cannot move/],
  ['at on a stage-space prop', s => { s.shots[0].props[0].at = 'left'; }, 'shots[0].props[0].at', /"beam" is drawn between its own points \(from, to\), so it has no "at"/],
  ['shot too short', s => { s.shots[4].start = { phrase: 'Think of it', offset: -4 }; }, 'shots[3].start', /shot "blue-scatters" lasts 1\.12 s \(21\.42-22\.54\); the shortest allowed is 1\.5 s/],
  ['shot too long', s => { s.shots.splice(3, 1); }, 'shots[2].start', /shot "molecules" lasts 12\.82 s .*longest allowed is 12 s\. Split it/],
  ['duplicate prop id', s => { s.shots[7].props[1].id = 'earth'; }, 'shots[7].props[1].id', /"earth" is used twice in this shot/],
  ['move with both to and toward', s => { s.shots[4].actions[6].to = 'left'; }, 'shots[4].actions[6].to', /give exactly one of "to" \(a place\) or "toward" \(a prop id\)/],
  ['point at a beam', s => { s.shots[1].props[3].from = 'light'; }, 'shots[1].props[3].from', /"light" is a beam, which has no single position/],
  ['unknown top-level field', s => { s.titel = 'x'; }, 'titel', /"titel" is not a top-level field.*Did you mean "title"\?/],
  ['until before at', s => { s.shots[1].actions[5].until = 'What if'; }, 'shots[1].actions[5].until', /is not after "at"|not spoken/],
];

for (const [name, edit, where, pattern] of CASES) {
  test(`broken show: ${name}`, () => { assert.match(errorFor(edit, where), pattern); });
}

test('a shot over 9 s is a warning, not an error', () => {
  const words = WORDS.filter(w => w.start < 13.7); // ends with "rainbow." (13.60 s)
  const s = { format: 1, title: 'Long', voice: { audio: 'voice.mp3', words: 'words.json' }, shots: [
    { id: 'long', env: 'space', props: [{ id: 'sun', type: 'sun' }] },
    { id: 'short', start: "Here's what's", env: 'space', props: [{ id: 'sun', type: 'sun' }] },
  ] };
  const { errors, warnings } = resolve(s, words);
  assert.deepEqual(errors, []);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].path, 'shots[0].start');
  assert.match(warnings[0].message, /shot "long" lasts 9\.34 s; shots over 9 s feel slow/);
});

const run = args => {
  try { return { code: 0, out: execFileSync(process.execPath, [path.join(REPO, 'tools/validate.mjs'), ...args], { encoding: 'utf8' }) }; }
  catch (e) { return { code: e.status, out: e.stdout + e.stderr }; }
};

test('CLI: exit 0 and an OK line for the demo; --json is machine readable', () => {
  const ok = run(['shows/demo-sky']);
  assert.equal(ok.code, 0);
  assert.match(ok.out, /OK shows\/demo-sky: 8 shots/);
  const j = JSON.parse(run(['shows/demo-sky', '--json']).out);
  assert.equal(j.ok, true);
  assert.deepEqual(j.errors, []);
});

test('CLI: exit 2 for a bad command or an unknown show', () => {
  assert.equal(run([]).code, 2);
  const r = run(['shows/no-such-show']);
  assert.equal(r.code, 2);
  assert.match(r.out, /Shows here: .*demo-sky/);
});
