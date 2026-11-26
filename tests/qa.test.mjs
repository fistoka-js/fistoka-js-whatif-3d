// QA tool tests. Pure rule tests need no browser; the show tests open Chrome (a few seconds per fixture show) and are
// skipped when Chrome is missing or under 2 GB of memory is free. Fixture shows live in tests/fixtures/qa/<name>.show.json;
// each is copied into a temporary shows/qa-tmp-<name>/ folder (with the demo voice and its first 24 words) and deleted afterwards.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { REPO } from '../tools/lib/showfiles.mjs';
import { findChrome, checkFreeRam, openSession } from '../tools/lib/browser.mjs';
import { runQa, planSamples, formatFinding } from '../tools/qa.mjs';
import { resolveMini, miniShow } from './helpers.mjs';
import {
  area, intersect, insideFraction, unionFraction, toGray, meanLuma, brightFraction, meanAbsDiff,
  blackFindings, frozenFindings, framingFindings, textFindings, overlapFindings, pacingFindings, videoFindings, mergeFindings, worstLevel,
} from '../tools/lib/qa-rules.mjs';
import { parseEbur128, probeVideo, measureLoudness } from '../tools/lib/qa-video.mjs';

const codes = r => r.findings.map(f => f.code);

// ---------- pure rules (no browser) ----------
const fakeShow = { shots: [{ id: 'a', start: 0, end: 6, props: [], actions: [], camera: {} }, { id: 'b', start: 6, end: 12, props: [], actions: [], camera: {} }] };
const solid = (w, h, v) => { const d = new Uint8Array(w * h * 4); for (let i = 0; i < d.length; i += 4) { d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; } return d; };

test('rect helpers', () => {
  const frame = { x: 0, y: 0, w: 100, h: 100 };
  assert.equal(area({ x: 0, y: 0, w: 10, h: 5 }), 50);
  assert.equal(insideFraction({ x: 50, y: 0, w: 100, h: 10 }, frame), 0.5);
  assert.equal(insideFraction({ x: 200, y: 0, w: 10, h: 10 }, frame), 0);
  assert.equal(intersect({ x: 0, y: 0, w: 10, h: 10 }, { x: 20, y: 20, w: 5, h: 5 }).w, 0);
  assert.ok(Math.abs(unionFraction([{ x: 0, y: 0, w: 50, h: 100 }, { x: 25, y: 0, w: 50, h: 100 }], frame) - 0.75) < 0.01);
});

test('black detector: synthetic dark pixels FAIL after 1 s; a short dip or a dark picture with a lit subject does not', () => {
  const dark = toGray(solid(40, 40, 3), 40, 40, 2);
  assert.ok(meanLuma(dark) < 12.75);
  const mk = (ts, luma, bright = 0) => ts.map(t => ({ t, luma, bright }));
  const long = blackFindings(fakeShow, mk([2, 2.5, 3, 3.5], 3));
  assert.equal(long.length, 1);
  assert.equal(long[0].level, 'FAIL');
  assert.equal(long[0].shot, 'a');
  assert.match(long[0].fix, /env colour/);
  assert.equal(blackFindings(fakeShow, mk([2, 2.5], 3)).length, 0, 'two samples = 1.0 s, not more than 1.0 s');
  assert.equal(blackFindings(fakeShow, [...mk([2, 2.5], 3), ...mk([3], 80), ...mk([3.5, 4], 3)]).length, 0, 'a bright sample breaks the run');
  assert.equal(blackFindings(fakeShow, mk([2, 2.5, 3, 3.5, 4], 3, 0.02)).length, 0, 'dark scene with a lit subject is not black');
  const g = toGray(solid(40, 40, 200), 40, 40, 2);
  assert.equal(brightFraction(g), 1);
  assert.equal(brightFraction(g, [{ x: 0, y: 0, w: 40, h: 40 }]), 0);
});

test('frozen detector: identical pictures for over 2.5 s FAIL; masked changes are ignored', () => {
  const a = toGray(solid(40, 40, 100), 40, 40, 2), b = toGray(solid(40, 40, 100), 40, 40, 2);
  assert.equal(meanAbsDiff(a, b), 0);
  const c = toGray(solid(40, 40, 100), 40, 40, 2);
  for (let i = 0; i < 20 * 10; i++) c.data[i] = 255; // top half changes (like a caption)
  assert.ok(meanAbsDiff(a, c) > 10);
  assert.equal(meanAbsDiff(a, c, [{ x: 0, y: 0, w: 40, h: 20 }]), 0, 'a masked region does not count');
  const pairs = n => Array.from({ length: n }, (_, i) => ({ t0: i * 0.5, t1: i * 0.5 + 0.5, diff: 0.1 }));
  assert.equal(frozenFindings(fakeShow, pairs(6)).length, 1, '3.0 s frozen');
  assert.equal(frozenFindings(fakeShow, pairs(5)).length, 0, '2.5 s is not more than 2.5 s');
  const mixed = pairs(8); mixed[3].diff = 5;
  assert.equal(frozenFindings(fakeShow, mixed).length, 0);
  assert.equal(frozenFindings(fakeShow, pairs(6))[0].level, 'FAIL');
});

const sample = (t, boxes, kinds = ['mid'], extra = {}) => ({ t, shotIndex: 0, kinds: new Set(kinds), boxes, luma: 100, bright: 1, actions: [], ...extra });
const frame = { w: 540, h: 960 };
const showWith = (props, actions = [], camera = { framing: 'medium', focus: null }) => ({ shots: [{ id: 's', start: 0, end: 6, props, actions, camera }] });
const P = (id, extra = {}) => ({ id, type: 'ball', at: [0, 0, 0], stageSpace: false, ...extra });
const box = (id, x, y, w, h, kind = 'prop') => ({ kind, id, x, y, w, h });

test('framing: a targeted prop mostly outside FAILs; an untargeted one does not; beams are ignored', () => {
  const show = showWith([P('ball'), P('beam', { stageSpace: true })], [{ do: 'pulse', prop: 'ball', t0: 1, path: 'x' }, { do: 'pulse', prop: 'beam', t0: 1, path: 'y' }]);
  const f = framingFindings(show, [sample(3, [box('ball', 400, 300, 300, 200), box('beam', 600, 0, 100, 100)])], frame);
  const bad = f.filter(x => x.code === 'prop-outside');
  assert.equal(bad.length, 1);
  assert.equal(bad[0].level, 'FAIL');
  assert.match(bad[0].what, /"ball" is 5\d% outside/);
  assert.match(bad[0].fix, /"at"/);
  const ok = framingFindings(showWith([P('ball')]), [sample(3, [box('ball', 400, 300, 300, 200)])], frame);
  assert.equal(ok.filter(x => x.code === 'prop-outside').length, 0, 'not targeted, not checked');
  const inside = framingFindings(show, [sample(3, [box('ball', 100, 300, 300, 200)])], frame);
  assert.equal(inside.filter(x => x.level === 'FAIL').length, 0);
});

test('framing: action samples check the action prop except right after appear/disappear', () => {
  const act = d => ({ do: d, prop: 'ball', t0: 1, path: 'x' });
  const show = showWith([P('ball')], [act('pulse')]);
  const off = [box('ball', 700, 300, 100, 100)];
  assert.equal(framingFindings(show, [sample(1.3, off, ['action'], { actions: [act('pulse')] })], frame).filter(f => f.code === 'prop-outside').length, 1);
  assert.equal(framingFindings(show, [sample(1.3, off, ['action'], { actions: [act('appear')] })], frame).length, 0);
});

test('framing: caption zone, small subject, nothing visible', () => {
  const show = showWith([P('a'), P('b')]);
  const f = framingFindings(show, [sample(3, [box('a', 200, 700, 100, 200), box('b', 200, 100, 20, 20)])], frame);
  assert.ok(f.some(x => x.code === 'prop-in-captions' && x.level === 'WARN' && /"a"/.test(x.what)));
  assert.ok(f.some(x => x.code === 'subject-small' && x.level === 'WARN'));
  const none = framingFindings(show, [0.5, 1, 1.5, 2].map(t => sample(t, [box('caption', 100, 800, 300, 40, 'caption')], ['grid'])), frame);
  assert.ok(none.some(x => x.code === 'nothing-visible' && x.level === 'FAIL'), 'a caption alone does not count as visible');
  const gap = [0.5, 1, 1.5, 2, 2.5, 3].map(t => sample(t, t < 2.5 ? [] : [box('a', 100, 100, 200, 200)], ['grid']));
  const g = framingFindings(show, gap, frame);
  assert.ok(g.some(x => x.code === 'empty-stretch' && x.level === 'WARN') && !g.some(x => x.code === 'nothing-visible'));
});

test('text rules: overlap 20% FAIL (needs 2 samples), under 20% WARN, outside frame, label covering prop', () => {
  const show = showWith([P('ball')], [{ do: 'label', prop: 'ball', text: 'HI', t0: 1, path: 'p0' }]);
  const two = (a, b) => [3, 3.5].map(t => sample(t, [a, b], ['grid']));
  const l1 = box('s:p0', 100, 100, 200, 50, 'label'), t1 = box('s:p1', 150, 100, 200, 50, 'text');
  const f = textFindings(show, two(l1, t1), frame);
  assert.equal(f.length, 1);
  assert.equal(f[0].level, 'FAIL'); assert.equal(f[0].code, 'text-overlap'); assert.equal(f[0].hits, 2);
  assert.match(f[0].what, /overlap by 75%/);
  const f2 = textFindings(show, [sample(3, [l1, t1], ['grid'])], frame);
  assert.equal(f2[0].level, 'WARN', 'seen once only');
  const small = textFindings(show, two(l1, box('s:p1', 280, 100, 200, 50, 'text')), frame);
  assert.equal(small[0].level, 'WARN'); assert.match(small[0].what, /overlap by 10%/);
  assert.equal(textFindings(show, two(l1, box('s:p1', 400, 100, 100, 50, 'text')), frame).length, 0, 'apart');
  const out = textFindings(show, two(box('s:p0', 400, 100, 300, 50, 'label'), box('caption', 100, 800, 300, 40, 'caption')), frame);
  assert.equal(out[0].code, 'text-outside'); assert.equal(out[0].level, 'FAIL'); assert.match(out[0].what, /outside the frame/);
  const cover = textFindings(show, two(box('s:p0', 100, 100, 200, 100, 'label'), box('ball', 100, 120, 200, 100)), frame);
  assert.ok(cover.some(x => x.code === 'label-covers-prop' && x.level === 'WARN'));
});

test('prop overlap: two solid props drawn over each other FAIL (2 samples); see-through, small, moved, flying-in and apart do not', () => {
  const isSolid = t => ['planet', 'sun', 'person'].includes(t);
  const show = showWith([P('earth', { type: 'planet' }), P('star', { type: 'sun' }), P('bulb', { type: 'lightbulb' }), P('man', { type: 'person' })]);
  const two = boxes => [3, 3.5].map(t => sample(t, boxes, ['grid']));
  const earth = box('earth', 100, 300, 300, 300);
  // The real shape (clipped to the box) is what is judged: the boxes overlap 75%, the shapes 67%.
  const star = { ...box('star', 250, 300, 200, 200), shape: { x: 300, y: 350, w: 150, h: 150 } };
  const f = overlapFindings(show, two([earth, star]), isSolid);
  assert.equal(f.length, 1);
  assert.equal(f[0].level, 'FAIL'); assert.equal(f[0].code, 'prop-overlap'); assert.equal(f[0].shot, 's'); assert.equal(f[0].hits, 2);
  assert.match(f[0].what, /"earth" \(planet\) and "star" \(sun\).*overlap by 67% of the smaller/);
  assert.match(f[0].fix, /"at"/);
  assert.equal(overlapFindings(show, [sample(3, [earth, star], ['grid'])], isSolid)[0].level, 'WARN', 'seen once only');
  assert.equal(overlapFindings(show, two([earth, box('star', 360, 300, 200, 200)]), isSolid).length, 0, 'a corner touch (20%) is under 25%');
  assert.equal(overlapFindings(show, two([earth, box('bulb', 150, 350, 200, 200)]), isSolid).length, 0, 'see-through props are not judged');
  assert.equal(overlapFindings(show, two([earth, box('man', 200, 350, 100, 100)]), isSolid).length, 0, 'an attachment under 15% of the other');
  assert.equal(overlapFindings(show, two([earth]), isSolid).length, 0, 'a hidden prop has no box');
  const flying = showWith(show.shots[0].props, [{ do: 'appear', prop: 'star', t0: 2.8, over: 0.5, path: 'a' }]);
  assert.equal(overlapFindings(flying, two([earth, star]), isSolid).length, 0, 'still flying in');
  const moving = showWith(show.shots[0].props, [{ do: 'move', prop: 'star', t0: 1, over: 2.5, path: 'm' }]);
  assert.equal(overlapFindings(moving, two([earth, star]), isSolid).length, 0, 'still moving into it (until 0.3 s after the move ends)');
  const moved = showWith(show.shots[0].props, [{ do: 'move', prop: 'star', t0: 1, over: 1, path: 'm' }]);
  assert.equal(overlapFindings(moved, two([earth, star]), isSolid).length, 1, 'fused after the move ended: the mistake');
});

test('prop overlap: props apart in depth pass, props touching in 3D still FAIL', () => {
  const isSolid = t => ['planet', 'sun'].includes(t);
  const show = showWith([P('earth', { type: 'planet' }), P('star', { type: 'sun' })]);
  const two = boxes => [3, 3.5].map(t => sample(t, boxes, ['grid']));
  const w = (min, max) => ({ world: { min, max } });
  const earth = { ...box('earth', 100, 300, 300, 300), ...w([-0.75, -0.75, -0.75], [0.75, 0.75, 0.75]) };
  const front = { ...box('star', 150, 350, 200, 200), ...w([-0.3, -0.3, 1.5], [0.3, 0.3, 2.1]) };   // same picture spot, 0.75 in front
  assert.equal(overlapFindings(show, two([earth, front]), isSolid).length, 0, 'a moon in front of a planet');
  const touching = { ...front, ...w([-0.3, -0.3, 0.5], [0.3, 0.3, 1.1]) };
  assert.equal(overlapFindings(show, two([earth, touching]), isSolid).length, 1, 'boxes overlap in 3D');
});

test('pacing: long idle stretch with a still camera, too many overlays', () => {
  const idle = { shots: [{ id: 's', start: 0, end: 10, props: [], camera: { move: 'still' }, actions: [{ do: 'pulse', t0: 1 }] }] };
  assert.equal(pacingFindings(idle, []).filter(f => f.code === 'idle').length, 1, 'a pulse is emphasis only, it does not end the quiet stretch');
  idle.shots[0].actions.push({ do: 'shake', t0: 5 });
  assert.equal(pacingFindings(idle, []).filter(f => f.code === 'idle').length, 1, 'a shake is emphasis only too');
  idle.shots[0].camera.move = 'orbit';
  assert.equal(pacingFindings(idle, []).length, 0);
  idle.shots[0].camera.move = 'drift'; idle.shots[0].actions.push({ do: 'move', t0: 3 }, { do: 'move', t0: 7 });
  assert.equal(pacingFindings(idle, []).length, 0);
  const four = [1, 2, 3, 4].map(i => box('s:p' + i, 10, 10, 10, 10, 'label'));
  assert.equal(pacingFindings(showWith([]), [sample(3, four)]).filter(f => f.code === 'too-many-overlays').length, 1);
  assert.equal(pacingFindings(showWith([]), [sample(3, four.slice(0, 3))]).length, 0);
});

test('video rules and ffmpeg readers', () => {
  const good = { width: 1080, height: 1920, fps: 30, hasAudio: true, videoSeconds: 57.0, voiceSeconds: 54.5, tail: 2.5, lufs: -15 };
  assert.deepEqual(videoFindings(good), []);
  const bad = videoFindings({ ...good, width: 720, fps: 24, hasAudio: false, videoSeconds: 50 });
  assert.deepEqual(bad.map(f => f.code).sort(), ['video-audio', 'video-fps', 'video-length', 'video-size']);
  assert.ok(bad.every(f => f.level === 'FAIL'));
  assert.equal(videoFindings({ ...good, lufs: -30 })[0].level, 'WARN');
  assert.equal(videoFindings({ ...good, lufs: -10 })[0].code, 'video-loudness');
  assert.equal(parseEbur128('Summary:\n  Integrated loudness:\n    I:         -14.2 LUFS\n    Threshold: -24.5 LUFS\n'), -14.2);
  assert.equal(parseEbur128('no summary here'), null);
  // A real tiny file made by ffmpeg: 1 s, 320x240, 25 fps, a sine tone.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-video-'));
  try {
    const file = path.join(tmp, 't.mp4');
    const r = spawnSync(process.env.FFMPEG_PATH || 'ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'color=c=blue:s=320x240:r=25:d=1', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1',
      '-shortest', '-pix_fmt', 'yuv420p', file], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    const info = probeVideo(file);
    assert.equal(info.width, 320); assert.equal(info.fps, 25); assert.equal(info.hasAudio, true);
    assert.ok(info.videoSeconds > 0.9 && info.videoSeconds < 1.2);
    const lufs = measureLoudness(file);
    assert.ok(Number.isFinite(lufs) && lufs < -10 && lufs > -50, 'lufs ' + lufs);
    const found = videoFindings({ ...info, voiceSeconds: 1, lufs });
    assert.ok(found.some(f => f.code === 'video-size') && found.some(f => f.code === 'video-fps'));
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test('mergeFindings joins repeats, keeps the first time, FAIL wins; worstLevel', () => {
  const m = mergeFindings([{ level: 'WARN', key: 'k', time: 4, hits: 1 }, { level: 'FAIL', key: 'k', time: 2, hits: 1 }, { level: 'WARN', key: 'j', time: 1, hits: 1 }]);
  assert.equal(m.length, 2);
  const k = m.find(x => x.key === 'k');
  assert.equal(k.level, 'FAIL'); assert.equal(k.time, 2); assert.equal(k.hits, 2);
  assert.equal(worstLevel([]), 'pass'); assert.equal(worstLevel([{ level: 'WARN' }]), 'warn'); assert.equal(worstLevel(m), 'fail');
});

test('planSamples: regular steps, midpoint, shot edges and action + 0.3 s, all inside the show', () => {
  const { show } = resolveMini(miniShow());
  const plan = planSamples(show, 0.5);
  assert.ok(plan.every(p => p.t >= 0 && p.t < show.duration));
  assert.ok(plan.some(p => p.kinds.has('mid')) && plan.some(p => p.kinds.has('edge')) && plan.some(p => p.kinds.has('action')));
  const a = show.shots[0].actions[0];
  assert.ok(plan.some(p => p.kinds.has('action') && Math.abs(p.t - (a.t0 + 0.3)) < 0.002 && p.actions.includes(a)));
  assert.ok(plan.every((p, i) => i === 0 || p.t > plan[i - 1].t), 'sorted, no duplicates');
});

test('command line: bad commands exit 2', () => {
  const run = args => spawnSync(process.execPath, [path.join(REPO, 'tools', 'qa.mjs'), ...args], { encoding: 'utf8' });
  assert.equal(run([]).status, 2);
  assert.equal(run(['no-such-show-xyz']).status, 2);
  assert.equal(run(['demo-sky', '--bogus']).status, 2);
  assert.equal(run(['demo-sky', '--step', '0']).status, 2);
});

// ---------- shows in a browser ----------
let skip = false;
try { findChrome(); checkFreeRam(); } catch (e) { skip = e.message; }
const FIX = path.join(REPO, 'tests', 'fixtures', 'qa');
const made = [];
let session;
before(async () => { if (!skip) session = await openSession(); });
after(async () => {
  if (session) await session.close();
  for (const d of made) fs.rmSync(d, { recursive: true, force: true });
});

// Copies fixture <name> into a temporary shows/qa-tmp-<name>/ folder and runs QA on it with the shared browser.
async function qa(name) {
  const dir = path.join(REPO, 'shows', 'qa-tmp-' + name);
  fs.mkdirSync(dir, { recursive: true });
  made.push(dir);
  const demo = path.join(REPO, 'shows', 'demo-sky');
  fs.copyFileSync(path.join(demo, 'voice.mp3'), path.join(dir, 'voice.mp3'));
  fs.writeFileSync(path.join(dir, 'words.json'), JSON.stringify(JSON.parse(fs.readFileSync(path.join(demo, 'words.json'), 'utf8')).slice(0, 24))); // first 7.1 s
  fs.copyFileSync(path.join(FIX, name + '.show.json'), path.join(dir, 'show.json'));
  return runQa('qa-tmp-' + name, { session });
}

test('good show passes, and writes qa.json and the contact sheet', { skip, timeout: 120000 }, async () => {
  const r = await qa('good');
  assert.equal(r.result, 'pass', r.findings.map(formatFinding).join('\n'));
  const dir = path.join(REPO, 'shows', 'qa-tmp-good', 'out');
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'qa.json'), 'utf8')).result, 'pass');
  assert.ok(fs.statSync(path.join(dir, 'qa-sheet.jpg')).size > 2000);
});

test('broken: a prop far off-frame FAILs with the prop id, numbers and a Fix', { skip, timeout: 120000 }, async () => {
  const r = await qa('offframe');
  assert.equal(r.result, 'fail');
  const f = r.findings.find(x => x.code === 'prop-outside');
  assert.ok(f, codes(r).join());
  assert.equal(f.level, 'FAIL'); assert.equal(f.shot, 'one');
  assert.match(formatFinding(f), /^FAIL shot "one" at [\d.]+ s: prop "moon" is 100% outside the frame .*Fix: /);
});

test('broken: two icons on the same spot FAIL (the engine now moves labels apart by itself, icons it does not)', { skip, timeout: 120000 }, async () => {
  const r = await qa('overlap');
  assert.equal(r.result, 'fail');
  const f = r.findings.find(x => x.code === 'text-overlap');
  assert.ok(f, codes(r).join());
  assert.equal(f.level, 'FAIL'); assert.match(f.what, /icon "x" and icon "question"/);
});

test('broken: a text and a counter in the same place FAIL', { skip, timeout: 120000 }, async () => {
  const r = await qa('stack');
  assert.ok(r.findings.some(x => x.code === 'text-overlap' && x.level === 'FAIL'), codes(r).join());
});

test('a 40-character text is shrunk by the engine and stays inside the frame (no text-outside finding)', { skip, timeout: 120000 }, async () => {
  const r = await qa('toolong');
  assert.ok(!codes(r).includes('text-outside'), codes(r).join());
  assert.notEqual(r.result, 'fail');
});

test('broken: a shot with every prop hidden FAILs as nothing visible and frozen (black is tested on synthetic pixels: the space env is not always dark enough)', { skip, timeout: 120000 }, async () => {
  const r = await qa('empty');
  assert.equal(r.result, 'fail');
  for (const c of ['nothing-visible', 'frozen']) assert.ok(codes(r).includes(c), `${c} missing: ${codes(r).join()}`);
  assert.ok(r.findings.every(f => f.shot === 'one' || f.shot === null));
});

test('warnings: a prop in the caption zone and a tiny subject WARN but do not FAIL', { skip, timeout: 120000 }, async () => {
  const cap = await qa('capzone');
  assert.equal(cap.result, 'warn');
  assert.ok(codes(cap).includes('prop-in-captions'), codes(cap).join());
  const tiny = await qa('tiny');
  assert.equal(tiny.result, 'warn');
  assert.ok(codes(tiny).includes('subject-small'), codes(tiny).join());
});

test('prop overlap: depth-staggered normal scenes pass (loose world boxes are shrunk), a sun poking out of a planet still FAILs', () => {
  const isSolid = t => ['planet', 'sun', 'house', 'car', 'tree', 'dinosaur', 'mountain'].includes(t);
  const w = (min, max) => ({ world: { min, max } });
  const two = boxes => [3, 3.5].map(t => sample(t, boxes, ['grid']));
  const pair = (ta, a, tb, b) => showWith([P(a.id, { type: ta }), P(b.id, { type: tb })]);
  // World boxes measured from real scenes (tools/qa.mjs): the screen boxes overlap a lot, the depth gap is small.
  const cases = [
    ['house', { ...box('house', 100, 300, 400, 400), ...w([-0.75, 0, -0.6], [0.75, 1.29, 0.6]) }, 'car', { ...box('car', 200, 500, 300, 200), ...w([-0.25, 0, 0.51], [0.65, 0.56, 1.09]) }],
    ['tree', { ...box('tree', 100, 300, 400, 400), ...w([-0.56, 0, -0.76], [0.56, 1.4, 0.16]) }, 'dinosaur', { ...box('dino', 200, 400, 300, 200), ...w([-0.4, 0, 0.26], [0.8, 0.64, 0.54]) }],
    ['planet', { ...box('earth', 100, 300, 300, 300), ...w([-0.75, -0.75, -0.75], [0.75, 0.75, 0.75]) }, 'planet', { ...box('moon', 200, 350, 150, 150), ...w([0.35, 0.05, 0.75], [0.85, 0.55, 1.25]) }],
  ];
  for (const [ta, a, tb, b] of cases) assert.equal(overlapFindings(pair(ta, a, tb, b), two([a, b]), isSolid).length, 0, `${a.id} and ${b.id} stagger in depth`);
  // The asteroid show's "recover" shot: sun star2 (z -0.85..-0.15) pokes out of planet earth3 (z -0.75..0.75).
  const earth3 = { ...box('earth3', 100, 300, 300, 300), ...w([-0.3, -0.75, -0.75], [1.2, 0.75, 0.75]) };
  const star2 = { ...box('star2', 250, 300, 200, 200), ...w([0.65, 0.45, -0.85], [1.35, 1.15, -0.15]) };
  assert.equal(overlapFindings(pair('planet', earth3, 'sun', star2), two([earth3, star2]), isSolid).length, 1);
});

test('prop overlap: a small prop swallowed by a big one is judged, a small one on its surface is an attachment', () => {
  const isSolid = t => ['planet', 'person'].includes(t);
  const show = showWith([P('big', { type: 'planet' }), P('moon', { type: 'planet' }), P('man', { type: 'person' })]);
  const two = boxes => [3, 3.5].map(t => sample(t, boxes, ['grid']));
  const w = (min, max) => ({ world: { min, max } });
  const big = { ...box('big', 0, 0, 800, 800), ...w([-1, -1, -1], [1, 1, 1]) };
  const swallowed = { ...box('moon', 300, 300, 100, 100), ...w([-0.1, -0.1, -0.1], [0.1, 0.1, 0.1]) };
  assert.equal(overlapFindings(show, two([big, swallowed]), isSolid).length, 1, 'a moon inside a planet');
  const onTop = { ...box('man', 300, 300, 100, 100), ...w([0.9, 0.9, -0.1], [1.1, 1.1, 0.1]) };
  assert.equal(overlapFindings(show, two([big, onTop]), isSolid).length, 0, 'a person on its surface');
});

test('solidForOverlap: fire, cloud and a tank iceberg are not judged; a plain iceberg and a house are', async () => {
  const { solidForOverlap } = await import('../tools/catalog.mjs');
  for (const t of ['house', 'planet', 'dinosaur']) assert.equal(solidForOverlap(t, {}), true, t);
  assert.equal(solidForOverlap('iceberg', {}), true);
  assert.equal(solidForOverlap('iceberg', { tank: true }), false);
  for (const t of ['fire', 'cloud', 'lightbulb', 'terrain']) assert.equal(solidForOverlap(t, {}), false, t);
});
