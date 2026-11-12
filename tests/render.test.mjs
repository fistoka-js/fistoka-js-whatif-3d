// Render test (opens Chrome, about 20 s): 1.0 s of demo-sky at 270x480.
// Checks: the MP4 has 30 frames and audio; frames around the chunk boundary (2 chunks) match the 1-chunk render;
// an invalid show is refused. Skipped when Chrome is missing or under 2 GB of memory is free.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { findChrome, checkFreeRam } from '../tools/lib/browser.mjs';
import { REPO } from '../tools/lib/showfiles.mjs';

let skip = false;
try { findChrome(); checkFreeRam(); } catch (e) { skip = e.message; }

let tmp;
before(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'render-test-')); });
after(() => { if (tmp) fs.rmSync(tmp, { recursive: true, force: true }); });

function render(chunks, name, extra = []) {
  const out = path.join(tmp, name);
  const r = spawnSync(process.execPath, [path.join(REPO, 'tools', 'render.mjs'), 'demo-sky', '--size', '270x480', '--to', '1',
    '--chunks', String(chunks), '--out', out, ...extra], { encoding: 'utf8' });
  return { r, out };
}
const probe = (file, args) => JSON.parse(spawnSync('ffprobe', ['-v', 'error', '-of', 'json', ...args, file], { encoding: 'utf8' }).stdout);

// Raw grey pixels of frames a..b (inclusive) of a video, as one Buffer.
function grey(file, a, b) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-vf', `select='between(n,${a},${b})'`, '-fps_mode', 'passthrough', '-f', 'rawvideo', '-pix_fmt', 'gray', '-'],
    { maxBuffer: 1 << 28 });
  return r.stdout;
}

test('2-chunk render: 30 frames, audio, boundary matches the 1-chunk render', { skip, timeout: 240000 }, () => {
  const two = render(2, 'two.mp4');
  assert.equal(two.r.status, 0, two.r.stderr + two.r.stdout);
  assert.match(two.r.stdout, /RENDER_DONE frames=30 /);
  const v = probe(two.out, ['-count_packets', '-show_entries', 'stream=codec_name,nb_read_packets,width,height']);
  assert.equal(v.streams.find(s => s.codec_name === 'h264').nb_read_packets, '30');
  assert.equal(v.streams.find(s => s.codec_name === 'h264').width, 270);
  assert.ok(v.streams.some(s => s.codec_name === 'aac'), 'no audio stream');
  assert.ok(fs.existsSync(two.out.replace(/\.mp4$/, '.render.json')));
  assert.deepEqual(fs.readdirSync(tmp).filter(f => f.startsWith('.render-tmp')), [], 'temp chunk folder left behind');

  const one = render(1, 'one.mp4');
  assert.equal(one.r.status, 0, one.r.stderr);
  // Chunks are frames 0-14 and 15-29; compare 12..17 across the join.
  const A = grey(two.out, 12, 17), B = grey(one.out, 12, 17);
  assert.equal(A.length, B.length);
  assert.equal(A.length, 6 * 270 * 480);
  const per = 270 * 480;
  for (let f = 0; f < 6; f++) {
    let sum = 0;
    for (let i = f * per; i < (f + 1) * per; i++) sum += Math.abs(A[i] - B[i]);
    assert.ok(sum / per < 2, `frame ${12 + f}: mean pixel difference ${(sum / per).toFixed(2)} is too large`);
  }
});

test('an invalid show is refused', { skip }, () => {
  const dir = path.join(REPO, 'shows', 'zz-bad-render-test');
  fs.mkdirSync(dir, { recursive: true });
  try {
    fs.writeFileSync(path.join(dir, 'show.json'), '{ "format": 1, "title": "x", "voice": {"audio": "voice.mp3", "words": "words.json"}, "shots": [] }');
    fs.writeFileSync(path.join(dir, 'words.json'), '[]');
    const r = spawnSync(process.execPath, [path.join(REPO, 'tools', 'render.mjs'), 'zz-bad-render-test', '--out', path.join(tmp, 'bad.mp4')], { encoding: 'utf8' });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /ERROR/);
    assert.ok(!fs.existsSync(path.join(tmp, 'bad.mp4')));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
