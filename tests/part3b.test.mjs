// Round 2 part 3b: gaps the chameleon rebuild exposed. A prop first declared in a continuing shot (page crash),
// camera "fill" and "glide", icon size / plain style / until into a later shot / colour, the studio "haze" param,
// and the validator messages for their mistakes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildStage } from '../kit/engine/stage.js';
import { makeShotState } from '../kit/engine/state.js';
import { catalog } from '../kit/engine/registry.js';
import { resolveMini } from './helpers.mjs';
import * as THREE from 'three';
import { CAMERA_FIELDS, cameraUp, blendPose } from '../kit/engine/camera.js';
import { ease, progress } from '../kit/engine/tween.js';

// A stand-in for the WebGL renderer: the stage only asks for its size and hands it a scene to draw.
const fakeRenderer = () => ({ getSize: v => v.set(540, 960), render() {} });

// Words used below (demo-sky): sky 0.88, reflects 2.40, completely 3.82, What 5.00, no 5.70. The 24 mini words end with "all?" (6.60-7.14 s).
function twoShots() {
  return {
    format: 1, title: 'Part 3b', voice: { audio: 'voice.mp3', words: 'words.json' },
    shots: [
      { id: 'one', env: { type: 'studio', color: 'teal' }, props: [{ id: 'ball', type: 'ball' }] },
      {
        id: 'two', start: 'What if sunlight', continue: true,
        // "box" joins the scene here: it was never declared in the shot before.
        props: [{ id: 'box', type: 'box', at: 'right' }],
        actions: [{ at: 'no blue', do: 'move', prop: 'box', to: 'left', over: 0.5 }],
      },
    ],
  };
}
const resolved = s => { const r = resolveMini(s); assert.deepEqual(r.errors, []); return r.show; };

// ---------- 1. a prop first declared in a continuing shot ----------

test('stage: a prop first declared in a continuing shot does not crash the earlier shot, and is hidden there', () => {
  const show = resolved(twoShots());
  const stage = buildStage(show, catalog, fakeRenderer());
  // Drawing the first shot used to throw "Cannot read properties of undefined (reading 'since')".
  assert.doesNotThrow(() => stage.render(1.0));
  const box = stage.shots[0].byId.get('box');
  assert.equal(box.wrapper.visible, false, 'not in the scene before its own shot');
  assert.doesNotThrow(() => stage.render(5.5));
  assert.equal(stage.shots[1].byId.get('box').wrapper.visible, true);
  assert.doesNotThrow(() => stage.warmUp());
});

test('state: the earlier shot does not know the later prop, so its framing ignores it', () => {
  const show = resolved(twoShots());
  const one = makeShotState(show.shots[0], catalog);
  assert.equal(one.has('box'), false);
  assert.equal(one.has('ball'), true);
  assert.ok(Math.abs(one.baseFocus.center[0]) < 1e-6, `framed on the ball alone (box is to the right): ${one.baseFocus.center}`);
});

// ---------- 2. camera "fill" ----------

test('fill: unset frames exactly as the framing does; a bigger fill brings the camera closer', () => {
  const dist = cam => {
    const s = twoShots(); s.shots[0].camera = cam;
    return makeShotState(resolved(s).shots[0], catalog).cameraAt(1.0).distance;
  };
  const plain = dist({ move: 'still', framing: 'close' });
  assert.equal(dist({ move: 'still', framing: 'close', fill: null }), plain);
  close(dist({ move: 'still', framing: 'close', fill: 1.02 }), plain);   // close's own share
  close(dist({ move: 'still', fill: 1.02 }), plain);                      // fill replaces the framing's share
  const big = dist({ move: 'still', fill: 1.3 });
  assert.ok(big < plain * 0.8, `fill 1.3 is nearer than close: ${big} vs ${plain}`);
});

test('fill: a focus action keeps the shot\'s fill (its own framing is then ignored)', () => {
  const dists = framing => {
    const s = twoShots();
    s.shots[0].camera = { move: 'still', focus: ['ball'], fill: 1.3 };
    s.shots[0].actions = [{ at: 'reflects', do: 'focus', props: ['ball'], ...(framing ? { framing } : {}), over: 0.5 }];
    const st = makeShotState(resolved(s).shots[0], catalog);
    return [st.cameraAt(1.0).distance, st.cameraAt(4.0).distance];   // before "reflects" (2.40 s) and after the focus
  };
  for (const framing of [null, 'close', 'wide']) {
    const [before, after] = dists(framing);
    close(after, before, 1e-9);
  }
});

// ---------- 3. camera "glide" ----------

function glideShow(glide) {
  const s = twoShots();
  s.shots[0].camera = { move: 'still', angle: 'front' };
  s.shots[1].camera = { move: 'still', angle: 'side', focus: ['box'], ...(glide ? { glide } : {}) };
  return resolved(s);
}

test('glide: a continuing shot starts at the previous camera and eases into its own over "glide" seconds', () => {
  const show = glideShow(1.2);
  const one = makeShotState(show.shots[0], catalog);
  const two = makeShotState(show.shots[1], catalog, one);
  const cut = makeShotState(glideShow(null).shots[1], catalog, one);
  const t0 = show.shots[1].start;
  const before = one.cameraAt(t0 - 1e-3), start = two.cameraAt(t0);
  for (let i = 0; i < 3; i++) close(start.position[i], before.position[i], 1e-3);   // no jump at the cut
  const mid = two.cameraAt(t0 + 0.6), own = cut.cameraAt(t0 + 0.6);
  assert.ok(Math.hypot(...mid.position.map((v, i) => v - own.position[i])) > 0.05, 'still on its way mid-glide');
  // The camera swings around the target: mid-glide it is no nearer the target than the shorter of the two distances.
  const d = Math.hypot(...mid.position.map((v, i) => v - mid.target[i]));
  assert.ok(d >= Math.min(before.distance, own.distance) - 1e-6, `distance ${d}`);
  assert.deepEqual(two.cameraAt(t0 + 1.3), cut.cameraAt(t0 + 1.3));                // after the glide: its own camera
  // Pure: the same t gives the same pose, whatever was asked before.
  const again = makeShotState(show.shots[1], catalog, makeShotState(show.shots[0], catalog));
  assert.deepEqual(again.cameraAt(t0 + 0.6), two.cameraAt(t0 + 0.6));
});

test('glide: without a previous state (tools that only need props) the shot simply cuts', () => {
  const lone = makeShotState(glideShow(1.2).shots[1], catalog);
  const cut = makeShotState(glideShow(null).shots[1], catalog);
  assert.deepEqual(lone.cameraAt(5.3), cut.cameraAt(5.3));
});

test('stage: a gliding shot renders from where the shot before left the camera', () => {
  const show = glideShow(1.2);
  const stage = buildStage(show, catalog, fakeRenderer());
  stage.render(show.shots[1].start + 0.001);
  const p = stage.camera.position.toArray();
  const prev = makeShotState(show.shots[0], catalog).cameraAt(show.shots[1].start - 1e-3).position;
  for (let i = 0; i < 3; i++) close(p[i], prev[i], 0.05);
});

// The camera's turn (degrees) from each frame to the next, sampled at 30 fps through the real stage.
function turnsPerFrame(fromAngle, toAngle, glide) {
  const s = twoShots();
  s.shots[0].camera = { move: 'still', angle: fromAngle };
  s.shots[1].camera = { move: 'still', angle: toAngle, glide };
  const show = resolved(s);
  const stage = buildStage(show, catalog, fakeRenderer());
  const t0 = show.shots[1].start;
  const turns = [];
  let last = null;
  for (let t = t0 - 0.2; t < t0 + glide + 0.2; t += 1 / 30) {
    stage.render(t);
    const q = stage.camera.quaternion.clone();
    if (last) turns.push(last.angleTo(q) * 180 / Math.PI);
    last = q;
  }
  return turns;
}

test('glide: the camera never jumps mid-glide, even between a side view and a view from the top', () => {
  // A smooth glide speeds up and slows down gradually, so no frame turns much more than the frames beside it.
  // (Before the fix, side -> top turned 28 degrees in one frame between frames of about 4 degrees.)
  for (const [a, b] of [['side', 'top'], ['top', 'side'], ['front', 'top'], ['top', 'front'], ['three-quarter', 'top'], ['low', 'top']]) {
    const turns = turnsPerFrame(a, b, 2);
    for (let i = 1; i < turns.length - 1; i++) {
      const near = Math.max(turns[i - 1], turns[i + 1]);
      assert.ok(turns[i] <= 1.5 * near + 0.3, `${a} -> ${b}: frame ${i} turned ${turns[i].toFixed(1)} degrees, its neighbours ${turns[i - 1].toFixed(1)} and ${turns[i + 1].toFixed(1)}`);
    }
  }
});

// Every angle and move to every angle and move. The camera's facing is worked out the way the stage does it
// (three.js lookAt with cameraUp), from the shot states alone, so the whole sweep stays fast.
function facingAt(pose) {
  const m = new THREE.Matrix4().lookAt(new THREE.Vector3(...pose.position), new THREE.Vector3(...pose.target), new THREE.Vector3(...cameraUp(pose)));
  return new THREE.Quaternion().setFromRotationMatrix(m);
}
function sweepGlide(fromCam, toCam, glide, floor) {
  const s = twoShots();
  s.shots[0].env.floor = floor;
  s.shots[0].camera = fromCam;
  s.shots[1].camera = { ...toCam, glide };
  const show = resolved(s);
  const one = makeShotState(show.shots[0], catalog);
  const two = makeShotState(show.shots[1], catalog, one);
  const own = makeShotState(show.shots[1], catalog);               // the same shot without a previous one: it cuts
  const t0 = show.shots[1].start;
  const from = facingAt(one.cameraAt(t0 - 1e-3));
  let reach = 0;   // the largest angle from the starting pose to the new shot's own pose during the glide (half-turn guard)
  let turnMax = 0, turnAt = 0, ownMax = 0, dkMax = 0, last = null, lastOwn = null, lastK = 0;
  let firstGlide = null, lastGlide = null;   // the camera's facing on the first and the last frame of the glide
  for (let i = -6; t0 + i / 30 < t0 + glide + 0.2; i++) {
    const t = t0 + i / 30;
    const q = facingAt(t < t0 ? one.cameraAt(t) : two.cameraAt(t));
    const qOwn = facingAt(t < t0 ? one.cameraAt(t) : own.cameraAt(t));
    const k = ease('in_out', progress(t, t0, glide));
    if (last) {
      const turn = last.angleTo(q) * 180 / Math.PI;
      if (turn > turnMax) { turnMax = turn; turnAt = t - t0; }
      // The shots' own moves, frame to frame; the cut between them (which the glide replaces) does not count.
      if (i !== 0) ownMax = Math.max(ownMax, lastOwn.angleTo(qOwn) * 180 / Math.PI);
      dkMax = Math.max(dkMax, k - lastK);
    }
    if (t >= t0 && t < t0 + glide) {
      if (!firstGlide) firstGlide = q;
      lastGlide = q;
      reach = Math.max(reach, from.angleTo(qOwn) * 180 / Math.PI);
    }
    last = q; lastOwn = qOwn; lastK = k;
  }
  // The total angle of the glide: between its first and its last frame.
  const swing = firstGlide.angleTo(lastGlide) * 180 / Math.PI;
  // The glide's two ends (position and target): its first frame is the previous shot's pose (taken 1 ms before the
  // cut, as the engine does), and just before it ends it is the new shot's own pose.
  const gap = (p, q) => Math.max(...[0, 1, 2].flatMap(i => [Math.abs(p.position[i] - q.position[i]), Math.abs(p.target[i] - q.target[i])]));
  const startGap = gap(two.cameraAt(t0), one.cameraAt(t0 - 1e-3));
  const tEnd = t0 + glide - 1e-4;
  const endGap = gap(two.cameraAt(tEnd), own.cameraAt(tEnd));
  // The ideal: the whole swing turned at the eased pace, so its fastest frame turns swing x the largest step of the ease.
  return { turnMax, turnAt, ownMax, ideal: swing * dkMax, swing, reach, startGap, endGap };
}

test('glide: every pair of angles and moves turns no faster than a perfectly smooth glide would', () => {
  const cams = [];
  for (const angle of CAMERA_FIELDS.angle.values) for (const move of CAMERA_FIELDS.move.values) for (const amount of [0.5, 1]) cams.push({ angle, move, amount });
  for (const floor of [true, false]) {
    for (const glide of [1.2, 2]) {
      for (const a of cams) {
        for (const b of cams) {
          const r = sweepGlide(a, b, glide, floor);
          // Allowed: a little over the ideal, plus the shots' own moves (an orbit keeps turning while the glide runs).
          const limit = 1.2 * r.ideal + r.ownMax + 0.001; // 0.001 = floating-point epsilon only
          const name = `${a.angle}+${a.move} (amount ${a.amount}) -> ${b.angle}+${b.move} (amount ${b.amount}), glide ${glide} s, ${floor ? 'floor' : 'no floor'}`;
          assert.ok(r.turnMax <= limit, `${name}: turned ${r.turnMax.toFixed(2)} degrees in one frame (at ${r.turnAt.toFixed(2)} s), ideal ${r.ideal.toFixed(2)}, own move ${r.ownMax.toFixed(2)}`);
          // The fixed way round for exactly opposite views (blendPose) must never be needed: no swing comes near a half turn.
          assert.ok(r.reach < 175, `${name}: a ${r.reach.toFixed(1)} degree swing is close to a half turn`);
          // 1e-3 stage units: far below a pixel at any framing.
          assert.ok(r.startGap < 1e-3, `${name}: the first glide frame is ${r.startGap.toExponential(2)} away from the previous shot's pose`);
          assert.ok(r.endGap < 1e-3, `${name}: the last glide frame is ${r.endGap.toExponential(2)} away from the new shot's own pose`);
        }
      }
    }
  }
});

test('glide: exactly opposite views have one fixed way round, and the blend starts and ends on the two poses', () => {
  const pose = (dir, up) => ({ position: dir, target: [0, 0, 0], fov: 40, viewOffsetY: 0.07, distance: 1, up });
  const a = pose([0, 0, 1], [0, 1, 0]), b = pose([0, 0, -1], [0, 1, 0]);    // front and back: a half turn either way
  const mid = blendPose(a, b, 0.5), again = blendPose(a, b, 0.5 + 1e-9);
  assert.ok(mid.position.every(Number.isFinite) && mid.up.every(Number.isFinite));
  // The fixed way round: turning about world up, counter-clockwise seen from above (through +x).
  close(mid.position[0], 1, 1e-6); close(mid.position[2], 0, 1e-6);
  close(again.position[0], 1, 1e-6);
  for (let i = 0; i < 3; i++) {
    close(blendPose(a, b, 0).position[i], a.position[i], 1e-9);
    close(blendPose(a, b, 1).position[i], b.position[i], 1e-9);
  }
});

// ---------- 4. icons: size, style, colour, until in a later shot ----------

function iconShow() {
  const s = twoShots();
  s.shots[0].actions = [
    { at: 'sky is blue', do: 'icon', name: 'no', place: [0, 0.8, 0], size: 2.5, style: 'plain', id: 'sign', until: 'no blue' },
    { at: 'completely', do: 'icon', name: 'question', place: 'left', color: 'yellow', style: 'plain' },
  ];
  s.shots[1].actions.push({ at: 'What if', do: 'color', icon: 'sign', to: 'grey', over: 0.5 });
  return s;
}

test('icon: size, style, colour and id resolve; "until" may end in a later shot of the scene', () => {
  const show = resolved(iconShow());
  const [sign, q] = show.shots[0].actions;
  assert.equal(sign.size, 2.5); assert.equal(sign.style, 'plain'); assert.equal(sign.id, 'sign');
  close(sign.until, 5.7);                       // "no blue" is spoken in shot two
  assert.equal(q.color, 'yellow'); assert.equal(q.size, 1); assert.equal(q.style, 'plain'); assert.equal(q.id, null);
  close(q.until, show.shots[0].end);            // default: the end of its own shot
  const tint = show.shots[1].actions.find(a => a.do === 'color');
  assert.equal(tint.prop, null); assert.equal(tint.icon, 'sign');
  // The colour change of an icon is not a prop channel: the state ignores it (no crash).
  assert.doesNotThrow(() => makeShotState(show.shots[1], catalog).propAt('ball', 5.5));
});

test('icon colour: its own colour, then each colour action in turn', async () => {
  const { iconColorAt } = await import('../kit/engine/overlay.js');
  const show = resolved(iconShow());
  const sign = show.shots[0].actions[0];
  const tints = show.shots[1].actions.filter(a => a.do === 'color');
  assert.equal(iconColorAt(sign, tints, 4.9), '#ff3b30');   // the "no" sign's own red
  assert.equal(iconColorAt(sign, tints, 6.0), '#9aa3ad');   // fully grey after the change
  const mid = iconColorAt(sign, tints, 5.25);
  assert.ok(mid !== '#ff3b30' && mid !== '#9aa3ad', mid);
  assert.equal(iconColorAt(show.shots[0].actions[1], [], 4), '#ffd84a'); // its own "color" field
});

test('icon colour: a second change that starts during the first takes over from the colour reached then', async () => {
  const { iconColorAt } = await import('../kit/engine/overlay.js');
  // The reviewer's case: a black icon, a change to white over 0-1 s, and a change to black starting at 0.5 s (over 1 s).
  const icon = { name: 'x', color: '#000000' };
  const tints = [{ t0: 0, over: 1, to: '#ffffff' }, { t0: 0.5, over: 1, to: '#000000' }];
  assert.equal(iconColorAt(icon, tints, 0.5), '#808080');   // halfway to white when the change to black starts
  const grey = t => parseInt(iconColorAt(icon, tints, t).slice(1, 3), 16);
  // From then on it only gets darker: it must never brighten after the change to black has begun.
  let before = grey(0.5);
  for (let i = 11; i <= 30; i++) {
    const t = i / 20, now = grey(t);
    assert.ok(now <= before, `at ${t.toFixed(2)} s the icon brightened from ${before} to ${now}`);
    before = now;
  }
  assert.equal(iconColorAt(icon, tints, 1.0), '#404040');   // halfway from #808080 to black
  assert.equal(iconColorAt(icon, tints, 1.5), '#000000');
});

test('icon: an "until" past the scene end warns and ends with the scene', () => {
  const s = iconShow();
  s.shots[0].actions[0].until = { time: 9 };   // the mini words end at 7.14 s; the scene ends at 7.54 s
  const r = resolveMini(s);
  assert.deepEqual(r.errors, []);
  assert.ok(r.warnings.some(w => w.path === 'shots[0].actions[0].until' && /after the scene ends/.test(w.message)), JSON.stringify(r.warnings));
  // ...and it is cut to the scene end, which is the end of the scene's last shot.
  close(r.show.shots[0].actions[0].until, r.show.shots[1].end);
  close(r.show.shots[1].end, 7.54);
});

test('icon: a colour change after the icon has gone warns (it would change nothing)', () => {
  const s = iconShow();
  s.shots[0].actions[0].until = 'reflects';                         // the sign goes at 2.40 s
  s.shots[1].actions = s.shots[1].actions.filter(a => a.do !== 'color');
  s.shots[0].actions.push({ at: 'completely', do: 'color', icon: 'sign', to: 'grey' }); // 3.82 s
  const r = resolveMini(s);
  assert.deepEqual(r.errors, []);
  assert.ok(r.warnings.some(w => w.path === 'shots[0].actions[2].at' && /after icon "sign" has gone \(2\.40 s\)/.test(w.message)), JSON.stringify(r.warnings));
  // A colour change while the icon is up gives no such warning.
  assert.ok(!resolveMini(iconShow()).warnings.some(w => /has gone/.test(w.message)));
});

// The overlay without a browser: just enough of the DOM for makeOverlay. Elements keep their style (labels measure
// 120 x 30 px); the divs are returned in the order they were made, which is the order of the actions.
function fakeDom() {
  const divs = [];
  const el = () => ({ style: {}, offsetWidth: 120, offsetHeight: 30, clientWidth: 120, firstChild: {}, lastChild: {}, setAttribute() {} });
  globalThis.document = { createElement: () => { const e = el(); divs.push(e); return e; }, createElementNS: el };
  globalThis.getComputedStyle = () => ({ fontSize: '16px' });
  const root = { clientWidth: 540, clientHeight: 960, appendChild() {}, getBoundingClientRect: () => ({ left: 0, top: 0 }) };
  return { root, svg: { append() {} }, divs };
}
const rectOf = (st, w, h) => ({ x: parseFloat(st.left), y: parseFloat(st.top), w: st.width ? parseFloat(st.width) : w, h: st.height ? parseFloat(st.height) : h });

test('overlay: an icon whose "until" is in the next shot stays up there, fades before its "until", and labels keep clear of it', async () => {
  const { makeOverlay } = await import('../kit/engine/overlay.js');
  const s = iconShow();
  // A label in the second shot, on the box, asking for the side where the carried-on sign sits.
  s.shots[1].actions.push({ at: 'What if', do: 'label', prop: 'box', text: 'BOX', side: 'top' });
  s.shots[0].actions[0].place = [1.1, 1.6, 0];
  const show = resolved(s);
  const stage = buildStage(show, catalog, fakeRenderer());
  const { root, svg, divs } = fakeDom();
  const ov = makeOverlay(root, svg, show, stage);
  const [sign, , label] = divs;            // sign, question icon, label
  const draw = t => { stage.render(t); ov.update(t); };
  draw(4.9);                               // shot one: the sign is up and holds to the cut (no fade at the shot end)
  assert.equal(sign.style.display, 'block'); assert.equal(sign.style.opacity, '1.000');
  draw(5.3);                               // shot two: still up, at full strength
  assert.equal(stage.shotIndexAt(5.3), 1);
  assert.equal(sign.style.display, 'block'); assert.equal(sign.style.opacity, '1.000');
  draw(5.6);                               // 0.1 s before its "until" (5.70 s), half faded
  assert.ok(Math.abs(parseFloat(sign.style.opacity) - 0.5) < 0.02, sign.style.opacity);
  draw(5.75);                              // gone
  assert.equal(sign.style.display, 'none');
  // The label, decided while the sign is on screen, keeps clear of it.
  draw(5.3);
  assert.equal(label.style.display, 'block');
  const a = rectOf(sign.style, 0, 0), b = rectOf(label.style, 120, 30);
  const ox = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)), oy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  assert.equal(ox * oy, 0, JSON.stringify({ sign: a, label: b }));
});

// ---------- 5. studio haze ----------

test('studio haze: default 1 (as before); 0 keeps the band no brighter than the backdrop around it', async () => {
  const studio = catalog.envs.studio;
  assert.equal(studio.meta.params.haze.default, 1);
  const mat = await import('../kit/engine/materials.js');
  const { makeRng } = await import('../kit/engine/rng.js');
  const { parseColor } = await import('../kit/engine/palette.js');
  const backdrop = haze => {
    const env = studio.build({ color: '#0d5a2c', floor: false, haze }, { THREE, mat, scale: 1, rng: makeRng(1), color: v => parseColor(v) });
    let found = null;
    env.object.traverse(o => { if (!found && o.geometry && o.geometry.attributes.color && o.geometry.attributes.color.itemSize === 3) found = o; });
    return found;
  };
  // The brightest backdrop colour above the horizon: the band.
  const brightest = obj => {
    const pos = obj.geometry.attributes.position, col = obj.geometry.attributes.color;
    let best = 0;
    for (let i = 0; i < pos.count; i++) if (pos.getY(i) > 0) best = Math.max(best, col.getX(i) + col.getY(i) + col.getZ(i));
    return best;
  };
  const d1 = backdrop(1), d0 = backdrop(0);
  assert.ok(d1 && d0, 'found the backdrop');
  assert.ok(brightest(d0) < 0.8 * brightest(d1), `${brightest(d0)} vs ${brightest(d1)}`);
});

// ---------- 6. the picture check accepts a large hero ----------

test('framing check: a large hero whose turned box spills out, but whose real shape is inside and above the captions, passes', async () => {
  const { framingFindings } = await import('../tools/lib/qa-rules.mjs');
  const frame = { w: 540, h: 960 };
  const show = { shots: [{ id: 's', start: 0, end: 6, actions: [], camera: { framing: 'close', focus: ['hero'] },
    props: [{ id: 'hero', type: 'chameleon', at: [0, 0, 0], stageSpace: false }] }] };
  const sample = boxes => ({ t: 3, shotIndex: 0, kinds: new Set(['mid']), boxes, luma: 100, bright: 1, actions: [] });
  // The box measured from the hero's turned unit cube (as in the rebuild at 3.7 s) is 62% outside the frame.
  const big = { kind: 'prop', id: 'hero', x: -291, y: -188, w: 1110, h: 1238 };
  const fails = framingFindings(show, [sample([big])], frame);
  assert.ok(fails.some(f => f.code === 'prop-outside'), 'the box alone fails');
  // Its real shape: large (60% of the frame height) but inside the frame and clear of the caption zone (bottom 24%).
  const shape = { x: 40, y: 120, w: 460, h: 580 };
  const ok = framingFindings(show, [sample([{ ...big, shape }])], frame);
  assert.deepEqual(ok.map(f => f.code), []);
  // A shape that sinks into the captions still warns.
  const low = framingFindings(show, [sample([{ ...big, shape: { x: 40, y: 500, w: 460, h: 440 } }])], frame);
  assert.ok(low.some(f => f.code === 'prop-in-captions'));
  // The shape is clipped to the box: parts far outside the box (faded, sliding in) do not count.
  const wide = framingFindings(show, [sample([{ kind: 'prop', id: 'hero', x: 100, y: 200, w: 300, h: 300, shape: { x: -500, y: 200, w: 900, h: 300 } }])], frame);
  assert.deepEqual(wide.map(f => f.code), []);
  // "Outside the frame" never fails where the box alone passes, even if the shape sits in the box's outer part.
  const edge = { kind: 'prop', id: 'hero', x: -100, y: 200, w: 500, h: 300, shape: { x: -100, y: 200, w: 150, h: 300 } };
  assert.equal(framingFindings(show, [sample([{ ...edge, shape: undefined }])], frame).filter(f => f.code === 'prop-outside').length, 0);
  assert.equal(framingFindings(show, [sample([edge])], frame).filter(f => f.code === 'prop-outside').length, 0);
  // When it fails, the message prints the rectangle that gave the percentage, and says which one it is.
  const outside = b => framingFindings(show, [sample([b])], frame).find(f => f.code === 'prop-outside');
  const byShape = outside({ kind: 'prop', id: 'hero', x: -400, y: 200, w: 500, h: 300, shape: { x: -50, y: 200, w: 100, h: 300 } });
  assert.match(byShape.what, /50% outside the frame \(shape x -50\.\.50 of 540, y 200\.\.500 of 960\)/);
  assert.deepEqual(byShape.measured.box, [-50, 200, 100, 300]); assert.equal(byShape.measured.outsidePct, 50);
  const byBox = outside({ kind: 'prop', id: 'hero', x: -300, y: 200, w: 500, h: 300, shape: { x: -300, y: 200, w: 100, h: 300 } });
  assert.match(byBox.what, /60% outside the frame \(box x -300\.\.200 of 540, y 200\.\.500 of 960\)/);
  assert.deepEqual(byBox.measured.box, [-300, 200, 500, 300]); assert.equal(byBox.measured.outsidePct, 60);
  // The fix names what sets the size: "framing", or "fill" when the shot sets it (fill overrides framing).
  assert.match(byBox.fix, /wider camera "framing" \(now "close"\)/);
  show.shots[0].camera.fill = 1.3;
  const byFill = outside({ kind: 'prop', id: 'hero', x: -300, y: 200, w: 500, h: 300 });
  assert.match(byFill.fix, /lower the camera "fill" \(now 1\.3; it overrides "framing"\)/);
  assert.doesNotMatch(byFill.fix, /wider camera "framing"/);
});

test('stage: the shape rectangle of a turned chameleon lies inside its box and is much smaller', () => {
  const s = twoShots();
  s.shots = [{ id: 'one', env: { type: 'studio', color: 'teal', floor: false }, camera: { framing: 'close', fill: 1.3, move: 'still' },
    props: [{ id: 'hero', type: 'chameleon', rotate: [0, -35, 55] }] }];
  const show = resolved(s);
  const stage = buildStage(show, catalog, fakeRenderer());
  stage.render(2);
  const box = stage.propRect('hero'), shape = stage.propShapeRect('hero');
  assert.ok(box && shape, 'both measured');
  assert.ok(shape.x >= box.x - 1 && shape.y >= box.y - 1 && shape.x + shape.w <= box.x + box.w + 1 && shape.y + shape.h <= box.y + box.h + 1, JSON.stringify({ box, shape }));
  assert.ok(shape.w * shape.h < 0.6 * box.w * box.h, JSON.stringify({ box, shape }));
  assert.equal(stage.propShapeRect('nothing'), null);
});

// ---------- 7. validator messages ----------

const CASES = [
  ['fill out of range', s => { s.shots[0].camera = { fill: 2 }; }, 'shots[0].camera.fill', /2/],
  ['fill not a number', s => { s.shots[0].camera = { fill: 'big' }; }, 'shots[0].camera.fill', /number/],
  ['glide on a new scene', s => { s.shots[0].camera = { glide: 1 }; }, 'shots[0].camera.glide', /only works on a continuing shot/],
  ['glide with a dive', s => { s.shots[1].camera = { glide: 1 }; s.shots[1].transition = 'dive'; }, 'shots[1].camera.glide', /replaces the cut, so it cannot be used with "transition": "dive"/],
  ['glide longer than the shot', s => { s.shots[1].camera = { glide: 5 }; }, 'shots[1].camera.glide', /is longer than the shot/],
  ['glide out of range', s => { s.shots[1].camera = { glide: 9 }; }, 'shots[1].camera.glide', /9/],
  ['icon size out of range', s => { s.shots[0].actions = [{ at: 'sky', do: 'icon', name: 'no', place: 'center', size: 5 }]; }, 'shots[0].actions[0].size', /5/],
  ['unknown icon name', s => { s.shots[0].actions = [{ at: 'sky', do: 'icon', name: 'stop', place: 'center' }]; }, 'shots[0].actions[0].name', /stop/],
  ['colour of an unknown icon', s => { s.shots[0].actions = [{ at: 'sky', do: 'icon', name: 'no', place: 'center', id: 'sign' }, { at: 'reflects', do: 'color', icon: 'sing', to: 'grey' }]; }, 'shots[0].actions[1].icon', /"sing" is not the id of an icon in this scene \(icon ids here: sign\)\. .*Did you mean "sign"\?/],
  ['colour of an icon before it appears', s => { s.shots[0].actions = [{ at: 'reflects', do: 'icon', name: 'no', place: 'center', id: 'sign' }, { at: 'sky', do: 'color', icon: 'sign', to: 'grey' }]; }, 'shots[0].actions[1].at', /before icon "sign" appears/],
  ['colour with neither prop nor icon', s => { s.shots[0].actions = [{ at: 'sky', do: 'color', to: 'grey' }]; }, 'shots[0].actions[0].prop', /"prop" is required/],
  ['colour with both prop and icon', s => { s.shots[0].actions = [{ at: 'sky', do: 'color', prop: 'ball', icon: 'x', to: 'grey' }]; }, 'shots[0].actions[0].icon', /not both/],
  ['two icons with one id', s => { s.shots[0].actions = [{ at: 'sky', do: 'icon', name: 'no', place: 'center', id: 'a' }, { at: 'reflects', do: 'icon', name: 'x', place: 'left', id: 'a' }]; }, 'shots[0].actions[1].id', /used twice in this scene/],
  ['bad icon id', s => { s.shots[0].actions = [{ at: 'sky', do: 'icon', name: 'no', place: 'center', id: 'Big Sign' }]; }, 'shots[0].actions[0].id', /short id/],
  ['haze out of range', s => { s.shots[0].env = { type: 'studio', haze: 2 }; }, 'shots[0].env.haze', /2/],
];

for (const [name, edit, where, re] of CASES) {
  test(`validator: ${name}`, () => {
    const s = twoShots();
    edit(s);
    const { errors } = resolveMini(s);
    const hit = errors.find(e => e.path === where);
    assert.ok(hit, `no error at ${where}; got: ${JSON.stringify(errors, null, 1)}`);
    assert.match(`${hit.message} ${hit.hint}`, re);
  });
}

test('validator: a glide out of range gives one error, not a second "longer than the shot" one', () => {
  const s = twoShots();
  s.shots[1].camera = { glide: 9 };
  const { errors } = resolveMini(s);
  assert.equal(errors.filter(e => e.path === 'shots[1].camera.glide').length, 1, JSON.stringify(errors, null, 1));
});

function close(a, b, eps = 1e-6) { assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`); }
