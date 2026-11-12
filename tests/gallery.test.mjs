// Gallery test (opens Chrome, about 10 s): --only ball,sun makes a contact sheet. Writes to a temp folder, not docs/gallery.
// Skipped when Chrome is missing or under 2 GB of memory is free.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { findChrome, checkFreeRam } from '../tools/lib/browser.mjs';
import { REPO } from '../tools/lib/showfiles.mjs';

let skip = false;
try { findChrome(); checkFreeRam(); } catch (e) { skip = e.message; }

test('gallery --only ball,sun produces a sheet and cleans up its temporary show', { skip, timeout: 120000 }, () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'gallery-test-'));
  try {
    const r = spawnSync(process.execPath, [path.join(REPO, 'tools', 'gallery.mjs'), '--only', 'ball,sun', '--out', out], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.match(r.stdout, /SHEET .*props-1\.jpg \(2 tiles\)/);
    const jpg = fs.readFileSync(path.join(out, 'props-1.jpg'));
    assert.ok(jpg.length > 5000 && jpg[0] === 0xff && jpg[1] === 0xd8, 'not a JPEG');
    assert.ok(!fs.existsSync(path.join(REPO, 'shows', 'zz-gallery')), 'temporary show left behind');
    const bad = spawnSync(process.execPath, [path.join(REPO, 'tools', 'gallery.mjs'), '--only', 'nonesuch', '--out', out], { encoding: 'utf8' });
    assert.equal(bad.status, 2);
  } finally { fs.rmSync(out, { recursive: true, force: true }); }
});
