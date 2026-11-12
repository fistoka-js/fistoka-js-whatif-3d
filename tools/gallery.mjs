// Contact sheets of the whole catalogue, for eyeball review: one still of every prop (default params) and of every environment.
// Usage: node tools/gallery.mjs [--only name,name] [--out folder]
// Output: docs/gallery/props-1.jpg, props-2.jpg, ... (15 props per sheet) and docs/gallery/envs.jpg. Props tagged "space" are
// shown on the space environment, all others on "studio". Reads the registry, so new props appear without any change here.
// How: it writes a temporary show (shows/zz-gallery/, deleted afterwards) with one 2 s shot per item and draws the middle of each shot.
// Exit codes: 0 done, 1 failed, 2 bad command.

import fs from 'node:fs';
import path from 'node:path';
import { REPO } from './lib/showfiles.mjs';
import { catalog } from '../kit/engine/registry.js';
import { openSession, grabFrame } from './lib/browser.mjs';

const TILE_W = 540, TILE_H = 960, PER_SHEET = 15, SHOT_S = 2;
const TMP_SLUG = 'zz-gallery';
let OUT_DIR = path.join(REPO, 'docs', 'gallery');
const TMP_DIR = path.join(REPO, 'shows', TMP_SLUG);

function parseArgs(argv) {
  let only = null, out = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--only') { const v = argv[++i]; if (!v || v.startsWith('--')) throw new Error('--only needs names like ball,sun'); only = v.split(',').map(s => s.trim()).filter(Boolean); }
    else if (argv[i] === '--out') { out = argv[++i]; if (!out || out.startsWith('--')) throw new Error('--out needs a folder'); }
    else throw new Error(`unknown option ${argv[i]}`);
  }
  return { only, out };
}

// One shot per item. item = { label, env, props }.
function writeShow(items) {
  fs.mkdirSync(TMP_DIR, { recursive: true });
  const demo = path.join(REPO, 'shows', 'demo-sky');
  fs.copyFileSync(path.join(demo, 'voice.mp3'), path.join(TMP_DIR, 'voice.mp3'));
  const end = items.length * SHOT_S;
  // Words only fix the show's length: the last word ends 0.4 s before the end (the default tail).
  fs.writeFileSync(path.join(TMP_DIR, 'words.json'), JSON.stringify([
    { text: 'a', start: 0, end: 0.1 }, { text: 'b', start: end - 0.5, end: end - 0.4 }]));
  const shots = items.map((it, i) => ({
    id: 'item-' + i, ...(i ? { start: { time: i * SHOT_S } } : {}),
    env: it.env, props: it.props, camera: { move: 'still' },
  }));
  fs.writeFileSync(path.join(TMP_DIR, 'show.json'), JSON.stringify({
    format: 1, title: 'Gallery', voice: { audio: 'voice.mp3', words: 'words.json' }, shots }));
}

async function sheet(session, tiles, file, cols) {
  const page = await session.newPage();
  const w = 300, h = Math.round(w * TILE_H / TILE_W);
  const html = `<html><body style="margin:0;background:#111;font:600 15px Segoe UI,Arial,sans-serif;color:#eee">
    <div style="display:grid;grid-template-columns:repeat(${cols},${w}px);gap:8px;padding:8px">
    ${tiles.map(x => `<div><img src="data:image/jpeg;base64,${x.buf.toString('base64')}" style="width:${w}px;height:${h}px;display:block">
      <div style="padding:4px 2px">${x.label}</div></div>`).join('')}
    </div></body></html>`;
  await page.setViewport({ width: cols * (w + 8) + 8, height: 200, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'load' });
  fs.writeFileSync(file, await page.screenshot({ type: 'jpeg', quality: 88, fullPage: true }));
  await page.close();
}

// Draws one batch of items and returns [{ label, buf }].
async function drawBatch(session, items) {
  writeShow(items);
  const page = await session.openShow(TMP_SLUG, { width: TILE_W, height: TILE_H });
  try {
    await page.addStyleTag({ content: '#cap{display:none !important}' });   // captions would only say "a b"
    const tiles = [];
    for (let i = 0; i < items.length; i++) {
      tiles.push({ label: items[i].label, buf: await grabFrame(page, i * SHOT_S + SHOT_S / 2, { type: 'jpeg', quality: 90 }) });
      console.log(`DRAWN ${items[i].label}`);
    }
    for (const p of page.problems) console.log('WARNING ' + p);
    return tiles;
  } finally { await page.close(); }
}

async function main(argv) {
  let a;
  try { a = parseArgs(argv); } catch (e) { console.error(`USAGE: ${e.message}\n  node tools/gallery.mjs [--only name,name] [--out folder]`); return 2; }
  if (a.out) OUT_DIR = path.resolve(a.out);
  const want = n => !a.only || a.only.includes(n);

  const props = Object.entries(catalog.props).filter(([n]) => want(n))
    .map(([n, m]) => ({ label: `${n} (${(m.meta.tags || []).includes('space') ? 'space' : 'studio'})`,
      env: (m.meta.tags || []).includes('space') ? 'space' : 'studio', props: [{ id: 'p', type: n }] }));
  const envs = Object.keys(catalog.envs).filter(want)
    .map(n => ({ label: `env: ${n}`, env: n, props: [{ id: 'p', type: 'ball', size: 0.5 }] }));
  if (!props.length && !envs.length) { console.error('GALLERY ERROR: --only matched no prop or environment'); return 2; }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const session = await openSession();
  try {
    // Remove old prop sheets first so a smaller catalogue leaves no stale sheet behind (only on a full run).
    if (!a.only) for (const f of fs.readdirSync(OUT_DIR)) if (/^props-\d+\.jpg$/.test(f)) fs.rmSync(path.join(OUT_DIR, f));
    for (let s = 0; s * PER_SHEET < props.length; s++) {
      const tiles = await drawBatch(session, props.slice(s * PER_SHEET, (s + 1) * PER_SHEET));
      const file = path.join(OUT_DIR, `props-${s + 1}.jpg`);
      await sheet(session, tiles, file, 5);
      console.log(`SHEET ${file} (${tiles.length} tiles)`);
    }
    if (envs.length) {
      const tiles = await drawBatch(session, envs);
      const file = path.join(OUT_DIR, 'envs.jpg');
      await sheet(session, tiles, file, Math.min(5, tiles.length));
      console.log(`SHEET ${file} (${tiles.length} tiles)`);
    }
  } finally {
    await session.close();
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
  }
  return 0;
}

main(process.argv.slice(2)).then(code => { process.exitCode = code; }, e => { console.error('GALLERY ERROR: ' + (e && e.message || e)); process.exitCode = 1; });
