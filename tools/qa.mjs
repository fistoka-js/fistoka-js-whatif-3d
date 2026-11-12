// Automatic quality check of a show: pass, warn or fail, with reasons an LLM can use to repair the show file.
// Usage: node tools/qa.mjs <slug> [--video path] [--json] [--step 0.5]
//   Picture checks run on the page (sampled every --step seconds, plus every shot's middle, first/last 0.1 s and each action + 0.3 s).
//   The video checks run when --video is given, or when shows/<slug>/out/<slug>.mp4 exists.
// Output: one line per finding (level, shot, time, what, numbers, "Fix:" hint); --json prints the same as data with result pass|warn|fail.
// Always writes shows/<slug>/out/qa.json and shows/<slug>/out/qa-sheet.jpg (one tile per shot).
// Exit codes: 0 pass or warn, 1 fail (or the show cannot play), 2 bad command.
// The rules and all thresholds are in tools/lib/qa-rules.mjs (see docs/QA.md).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { findShowDir, loadShow } from './lib/showfiles.mjs';
import { openSession } from './lib/browser.mjs';
import { probeVideo, probeSeconds, measureLoudness } from './lib/qa-video.mjs';
import { makeQaSheet } from './lib/qa-sheet.mjs';
import {
  T, toGray, meanLuma, brightFraction, meanAbsDiff, blackFindings, frozenFindings, framingFindings, textFindings, pacingFindings,
  videoFindings, mergeFindings, worstLevel,
} from './lib/qa-rules.mjs';

const USAGE = 'node tools/qa.mjs <slug> [--video path] [--json] [--step 0.5]';

function parseArgs(argv) {
  const a = { slug: null, video: null, json: false, step: T.STEP };
  for (let i = 0; i < argv.length; i++) {
    const f = argv[i];
    const val = () => { const v = argv[++i]; if (v === undefined || v.startsWith('--')) throw new Error(`${f} needs a value`); return v; };
    if (f === '--video') a.video = val();
    else if (f === '--json') a.json = true;
    else if (f === '--step') a.step = Number(val());
    else if (f.startsWith('--')) throw new Error(`unknown option ${f}`);
    else if (!a.slug) a.slug = f;
    else throw new Error(`unexpected "${f}"`);
  }
  if (!a.slug) throw new Error('give the show slug');
  if (!(a.step >= 0.1 && a.step <= 5)) throw new Error('--step takes seconds between 0.1 and 5');
  return a;
}

// The times to look at, each with the reasons for looking: grid (regular), mid, edge (shot start/end), action (+0.3 s).
export function planSamples(show, step) {
  const map = new Map();
  const add = (t, kind, action) => {
    const tt = Math.round(Math.min(Math.max(t, 0), show.duration - 0.05) * 1000) / 1000;
    let s = map.get(tt);
    if (!s) { s = { t: tt, kinds: new Set(), actions: [] }; map.set(tt, s); }
    s.kinds.add(kind);
    if (action) s.actions.push(action);
  };
  for (let k = 0; k * step < show.duration - 0.05; k++) add(k * step, 'grid');
  for (const shot of show.shots) {
    add((shot.start + shot.end) / 2, 'mid');
    add(shot.start + 0.1, 'edge');
    add(shot.end - 0.1, 'edge');
    for (const a of shot.actions) if (a.prop || a.do === 'focus') add(Math.min(a.t0 + 0.3, shot.end - 0.1), 'action', a);
  }
  const shotIndexAt = t => { const i = show.shots.findIndex(s => t >= s.start && t < s.end); return i < 0 ? show.shots.length - 1 : i; };
  return [...map.values()].sort((a, b) => a.t - b.t).map(s => ({ ...s, shotIndex: shotIndexAt(s.t) }));
}

// Short description of an overlay/caption box for messages: label "TEXT", icon "x", ...
function namer(show) {
  return b => {
    if (b.kind === 'caption') return 'the caption';
    const [shotId, apath] = String(b.id).split(':');
    const shot = show.shots.find(s => s.id === shotId);
    const act = shot && shot.actions.find(x => x.path === apath);
    if (!act) return b.kind;
    if (b.kind === 'icon') return `icon "${act.name}"`;
    if (b.kind === 'count') return `counter ${act.from}->${act.to}`;
    return `${b.kind} "${act.text}"`;
  };
}

// Opens the show once and samples it. Returns { samples, pairs, tiles, frame }.
async function sampleShow(session, slug, show, step) {
  const [W, H] = T.SIZE;
  const page = await session.openShow(slug, { width: W, height: H });
  try {
    const plan = planSamples(show, step);
    const samples = [], pairs = [], mids = new Map();
    let prev = null;
    for (const p of plan) {
      const boxes = await page.evaluate(t => window.__boxes(t), p.t);
      const png = PNG.sync.read(Buffer.from(await page.screenshot({ type: 'png', captureBeyondViewport: false, optimizeForSpeed: true })));
      const gray = toGray(png.data, png.width, png.height, 2);
      const textMask = boxes.filter(b => b.kind !== 'prop').map(b => ({ x: b.x - 4, y: b.y - 4, w: b.w + 8, h: b.h + 8 }));
      const s = { ...p, boxes, luma: meanLuma(gray), bright: brightFraction(gray, textMask) };
      samples.push(s);
      if (p.kinds.has('mid')) mids.set(p.shotIndex, { t: p.t, png });
      if (p.kinds.has('grid')) {
        if (prev) {
          // Ignore captions and overlays (they change on their own) so a frozen picture cannot hide behind them.
          const mask = [...prev.boxes, ...boxes].filter(b => b.kind !== 'prop').map(b => ({ x: b.x - 4, y: b.y - 4, w: b.w + 8, h: b.h + 8 }));
          pairs.push({ t0: prev.t, t1: p.t, diff: meanAbsDiff(prev.gray, gray, mask) });
        }
        prev = { t: p.t, boxes, gray };
      }
    }
    return { samples, pairs, mids, frame: { w: W, h: H }, problems: page.problems };
  } finally {
    await page.close();
  }
}

export function checkVideo(slug, dir, show, videoArg) {
  const file = videoArg ? path.resolve(videoArg) : path.join(dir, 'out', `${slug}.mp4`);
  if (!fs.existsSync(file)) {
    if (videoArg) return { findings: [{ level: 'FAIL', code: 'video-missing', shot: null, time: null, what: `video file not found: ${file}`, measured: {}, fix: 'render it first: node tools/render.mjs <slug>.', hits: 1, key: 'video-missing' }], info: null };
    return { findings: [], info: null };
  }
  const info = probeVideo(file);
  const audioName = show.voice && show.voice.audio;
  info.voiceSeconds = audioName && fs.existsSync(path.join(dir, audioName)) ? probeSeconds(path.join(dir, audioName)) : null;
  info.lufs = info.hasAudio ? measureLoudness(file) : null;
  info.file = file;
  return { findings: videoFindings(info), info };
}

export async function runQa(slugArg, { video = null, step = T.STEP, session: given = null } = {}) {
  const dir = findShowDir(slugArg);
  const slug = path.basename(dir);
  const outDir = path.join(dir, 'out');
  fs.mkdirSync(outDir, { recursive: true });
  const { show, errors } = loadShow(dir);
  const report = { slug, result: 'fail', samples: 0, step, findings: [], measured: {}, files: {} };
  const finish = () => {
    report.findings.sort((x, y) => (x.level === y.level ? (x.time ?? -1) - (y.time ?? -1) : x.level === 'FAIL' ? -1 : 1));
    report.result = worstLevel(report.findings);
    fs.writeFileSync(path.join(outDir, 'qa.json'), JSON.stringify(report, null, 2));
    return report;
  };
  if (errors.length) {
    report.findings.push({ level: 'FAIL', code: 'show-invalid', shot: null, time: null, what: `the show has ${errors.length} error(s): ${errors.slice(0, 3).map(e => `${e.path}: ${e.message}`).join(' | ')}`, measured: {}, fix: `run node tools/validate.mjs shows/${slug} and fix what it lists.`, hits: 1, key: 'show-invalid' });
    return finish();
  }

  const session = given || await openSession();
  try {
    const got = await sampleShow(session, slug, show, step);
    report.samples = got.samples.length;
    report.duration = show.duration;
    const all = [
      ...blackFindings(show, got.samples, step),
      ...frozenFindings(show, got.pairs),
      ...framingFindings(show, got.samples, got.frame),
      ...textFindings(show, got.samples, got.frame, namer(show)),
      ...pacingFindings(show, got.samples),
    ];
    for (const p of got.problems) all.push({ level: 'WARN', code: 'page-problem', shot: null, time: null, what: p, measured: {}, fix: 'open the show in the preview page and check the browser console.', hits: 1, key: 'pp|' + p });
    report.findings = mergeFindings(all);
    report.measured.minLuma = Math.round(Math.min(...got.samples.map(s => s.luma)) * 10) / 10;
    report.measured.darkest = [...got.samples].sort((a, b) => a.luma - b.luma).slice(0, 5).map(s => ({ t: s.t, lumaPct: Math.round(s.luma / 2.55 * 10) / 10, brightPct: Math.round(s.bright * 1000) / 10 }));
    report.measured.minFrameChange = got.pairs.length ? Math.round(Math.min(...got.pairs.map(p => p.diff)) * 100) / 100 : null;

    // Contact sheet: one tile per shot midpoint.
    const level = i => { const f = report.findings.filter(x => x.shot === show.shots[i].id); return worstLevel(f); };
    const tiles = show.shots.map((shot, i) => {
      const m = got.mids.get(i);
      return m ? { id: shot.id, level: level(i), t: m.t, buf: PNG.sync.write(m.png) } : null;
    }).filter(Boolean);
    const sheet = path.join(outDir, 'qa-sheet.jpg');
    await makeQaSheet(session, tiles, sheet);
    report.files.sheet = sheet;
  } finally {
    if (!given) await session.close();
  }

  try {
    const v = checkVideo(slug, dir, show, video);
    report.findings.push(...v.findings);
    if (v.info) report.measured.video = v.info;
  } catch (e) {
    report.findings.push({ level: 'FAIL', code: 'video-unreadable', shot: null, time: null, what: `could not read the video: ${e.message}`, measured: {}, fix: 'render it again; make sure ffprobe and ffmpeg are installed.', hits: 1, key: 'video-unreadable' });
  }
  report.files.json = path.join(outDir, 'qa.json');
  return finish();
}

export function formatFinding(f) {
  const where = f.shot ? `shot "${f.shot}"` : 'video';
  const at = f.time != null ? ` at ${f.time.toFixed(1)} s` : '';
  const more = f.hits > 1 ? ` (seen in ${f.hits} samples)` : '';
  return `${f.level} ${where}${at}: ${f.what}${more}. Fix: ${f.fix}`;
}

async function main(argv) {
  let a;
  try { a = parseArgs(argv); } catch (e) { console.error(`USAGE: ${e.message}\n  ${USAGE}`); return 2; }
  try { findShowDir(a.slug); } catch (e) { console.error('USAGE: ' + e.message); return 2; }
  const report = await runQa(a.slug, { video: a.video, step: a.step });
  if (a.json) {
    const { findings, ...rest } = report;
    console.log(JSON.stringify({ ...rest, findings: findings.map(({ key, ...f }) => f) }, null, 2));
  } else {
    for (const f of report.findings) console.log(formatFinding(f));
    const n = l => report.findings.filter(f => f.level === l).length;
    console.log(`QA RESULT: ${report.result} (${n('FAIL')} fail, ${n('WARN')} warn) for "${report.slug}", ${report.samples} samples. Report: ${report.files.json}${report.files.sheet ? ' Sheet: ' + report.files.sheet : ''}`);
  }
  return report.result === 'fail' ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(code => { process.exitCode = code; }, e => { console.error('QA ERROR: ' + (e && e.message || e)); process.exitCode = 1; });
}
