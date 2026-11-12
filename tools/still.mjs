// Still pictures of a show, drawn exactly as the video draws them (3D, labels, captions).
// Usage:
//   node tools/still.mjs <slug> --at 3.2,10          stills at those times (seconds)
//   node tools/still.mjs <slug> --every 3            a still every 3 seconds
//   node tools/still.mjs <slug> --sheet              a contact sheet: 2 stills per shot (or the --at/--every times),
//                                                    small tiles labelled with time and shot, in one JPEG
//   options: --size 1080x1920 (single stills; sheet tiles default 360x640), --out <folder>
// Output: shows/<slug>/out/stills/<slug>-<t>.png and shows/<slug>/out/stills/sheet.jpg. Prints each file written.
// Exit codes: 0 done, 1 the show or the page failed, 2 bad command.

import fs from 'node:fs';
import path from 'node:path';
import { findShowDir, loadShow } from './lib/showfiles.mjs';
import { openSession, grabFrame } from './lib/browser.mjs';

const USAGE = 'node tools/still.mjs <slug> [--at 3.2,10 | --every 3] [--sheet] [--size 1080x1920] [--out <folder>]';

function parseArgs(argv) {
  const a = { slug: null, at: null, every: null, sheet: false, size: null, out: null };
  for (let i = 0; i < argv.length; i++) {
    const f = argv[i];
    const val = () => { const v = argv[++i]; if (v === undefined || v.startsWith('--')) throw new Error(`${f} needs a value`); return v; };
    if (f === '--at') a.at = val().split(',').map(Number);
    else if (f === '--every') a.every = Number(val());
    else if (f === '--sheet') a.sheet = true;
    else if (f === '--size') a.size = val();
    else if (f === '--out') a.out = val();
    else if (f.startsWith('--')) throw new Error(`unknown option ${f}`);
    else if (!a.slug) a.slug = f;
    else throw new Error(`unexpected "${f}"`);
  }
  if (!a.slug) throw new Error('give the show slug');
  if (a.at && a.at.some(t => !Number.isFinite(t) || t < 0)) throw new Error('--at takes seconds like 3.2,10');
  if (a.every !== null && !(a.every > 0)) throw new Error('--every takes a number of seconds above 0');
  if (a.size && !/^\d+x\d+$/.test(a.size)) throw new Error('--size looks like 1080x1920');
  return a;
}

// The times to draw (rounded to 0.01 s), inside the show.
function pickTimes(a, show) {
  const end = show.duration - 0.05;
  let times;
  if (a.at) times = a.at;
  else if (a.every) { times = []; for (let t = 0.5; t < end; t += a.every) times.push(t); }
  else if (a.sheet) times = show.shots.flatMap(s => [s.start + 0.3 * (s.end - s.start), s.start + 0.75 * (s.end - s.start)]);
  else times = show.shots.map(s => (s.start + s.end) / 2);
  return times.map(t => Math.round(Math.min(t, end) * 100) / 100);
}

async function makeSheet(session, tiles, file, tileW, tileH) {
  const cols = Math.min(6, tiles.length);
  const page = await session.newPage();
  const html = `<html><body style="margin:0;background:#111;font:600 14px Segoe UI,Arial;color:#ddd">
    <div style="display:grid;grid-template-columns:repeat(${cols},${tileW}px);gap:6px;padding:6px">
    ${tiles.map(x => `<div><img src="data:image/jpeg;base64,${x.buf.toString('base64')}" style="width:${tileW}px;height:${tileH}px;display:block">
      <div style="padding:3px 2px">${x.t.toFixed(2)} s · ${x.shot}</div></div>`).join('')}
    </div></body></html>`;
  await page.setViewport({ width: cols * (tileW + 6) + 6, height: 200, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'load' });
  const buf = await page.screenshot({ type: 'jpeg', quality: 85, fullPage: true });
  fs.writeFileSync(file, buf);
  await page.close();
}

async function main(argv) {
  let a;
  try { a = parseArgs(argv); } catch (e) { console.error(`USAGE: ${e.message}\n  ${USAGE}`); return 2; }
  let dir;
  try { dir = findShowDir(a.slug); } catch (e) { console.error('USAGE: ' + e.message); return 2; }
  const slug = path.basename(dir);
  const { show, errors } = loadShow(dir);
  if (errors.length) { console.error(`STILL ERROR: the show has ${errors.length} error(s); run node tools/validate.mjs shows/${slug}`); return 1; }
  const outDir = path.resolve(a.out || path.join(dir, 'out', 'stills'));
  fs.mkdirSync(outDir, { recursive: true });
  const times = pickTimes(a, show);
  const [w, h] = (a.size || (a.sheet ? '360x640' : '1080x1920')).split('x').map(Number);

  const session = await openSession();
  try {
    const page = await session.openShow(slug, { width: w, height: h });
    const tiles = [];
    for (const t of times) {
      const shot = show.shots.find(s => t >= s.start && t < s.end) || show.shots[show.shots.length - 1];
      if (a.sheet) {
        tiles.push({ t, shot: shot.id, buf: await grabFrame(page, t, { type: 'jpeg', quality: 90 }) });
      } else {
        const file = path.join(outDir, `${slug}-${t.toFixed(2)}.png`);
        fs.writeFileSync(file, await grabFrame(page, t, { type: 'png' }));
        console.log(`STILL ${file}`);
      }
    }
    if (a.sheet) {
      const file = path.join(outDir, 'sheet.jpg');
      await makeSheet(session, tiles, file, Math.round(w * 0.6), Math.round(h * 0.6));
      console.log(`SHEET ${file} (${tiles.length} tiles)`);
    }
    for (const p of page.problems) console.log('WARNING ' + p);
  } finally {
    await session.close();
  }
  return 0;
}

main(process.argv.slice(2)).then(code => { process.exitCode = code; }, e => { console.error('STILL ERROR: ' + (e && e.message || e)); process.exitCode = 1; });
