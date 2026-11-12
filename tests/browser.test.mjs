// The one browser test: opens demo-sky in headless Chrome (software WebGL), checks the hooks, determinism
// (same t twice, with a different t in between, gives identical pixels) and that __boxes returns sane rectangles.
// Skipped (with a message) when Chrome is missing or less than 2 GB of memory is free.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import { openSession, grabFrame, findChrome, checkFreeRam } from '../tools/lib/browser.mjs';

let skip = false;
try { findChrome(); checkFreeRam(); } catch (e) { skip = e.message; }

const W = 360, H = 640;
let session, page;
before(async () => {
  if (skip) return;
  session = await openSession();
  page = await session.openShow('demo-sky', { width: W, height: H });
});
after(async () => { if (session) await session.close(); });

test('hooks: __ready, __info', { skip }, async () => {
  assert.equal(await page.evaluate(() => window.__ready), true);
  const info = await page.evaluate(() => window.__info());
  assert.equal(info.duration, 54.7);
  assert.equal(info.fps, 30);
  assert.equal(info.shots.length, 8);
  assert.deepEqual(info.shots[0], { id: 'myth', start: 0, end: 5 });
});

test('determinism: the same t gives identical pixels, even after drawing other times', { skip }, async () => {
  for (const t of [3.9, 19.5, 28.7, 51.8]) {
    const a = await grabFrame(page, t, { type: 'png' });
    await grabFrame(page, t + 7.3 > 54 ? 1.2 : t + 7.3, { type: 'png' });
    await grabFrame(page, 0.2, { type: 'png' });
    const b = await grabFrame(page, t, { type: 'png' });
    const pa = PNG.sync.read(a), pb = PNG.sync.read(b);
    assert.equal(pa.width, W);
    let diff = 0;
    for (let i = 0; i < pa.data.length; i++) if (pa.data[i] !== pb.data[i]) diff++;
    assert.equal(diff, 0, `t=${t}: ${diff} bytes differ`);
    // And the picture is not blank: some variety of colours.
    const seen = new Set();
    for (let i = 0; i < pa.data.length; i += 4 * 97) seen.add((pa.data[i] >> 4) * 256 + (pa.data[i + 1] >> 4) * 16 + (pa.data[i + 2] >> 4));
    assert.ok(seen.size > 20, `t=${t}: picture looks blank (${seen.size} colours)`);
  }
});

test('__boxes: props, labels and the caption as sane rectangles; captions stay in the bottom zone', { skip }, async () => {
  const boxes = await page.evaluate(() => window.__boxes(19.5)); // molecules shot, label "GAS MOLECULES" showing
  const kinds = new Set(boxes.map(b => b.kind));
  assert.ok(kinds.has('prop') && kinds.has('label') && kinds.has('caption'), JSON.stringify(boxes));
  for (const b of boxes) {
    for (const k of ['x', 'y', 'w', 'h']) assert.ok(Number.isFinite(b[k]), JSON.stringify(b));
    assert.ok(b.w > 0 && b.h > 0, JSON.stringify(b));
  }
  const cap = boxes.find(b => b.kind === 'caption');
  assert.ok(cap.y > H * 0.7, 'caption in the bottom zone');
  const label = boxes.find(b => b.kind === 'label');
  assert.ok(label.y + label.h <= H * 0.76, 'label above the caption zone');
  // Beams that have not started yet (progress 0) have no box: at 7.0 s only the sun, the earth and its light show.
  const early = await page.evaluate(() => window.__boxes(7.0));
  assert.deepEqual(early.filter(b => b.kind === 'prop').map(b => b.id).sort(), ['earth', 'light', 'sun']);
  const air = boxes.find(b => b.id === 'air');
  assert.ok(air.x > 0 && air.x + air.w < W && air.y > 0 && air.y + air.h < H * 0.76, 'the subject is inside the safe area');
});
