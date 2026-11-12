// Renders a show to an MP4 (video + voice).
// Usage: node tools/render.mjs <slug> [--chunks N] [--size 1080x1920] [--fps 30] [--from S --to S] [--out path]
//                                      [--no-audio] [--quality 92] [--crf 20]
// How: the frames are split into N chunks; each chunk is drawn by its own worker process (own Chrome), piped into
// ffmpeg as a video-only .ts file; the chunks are joined without re-encoding and the voice is added.
// Output: shows/<slug>/out/<slug>.mp4 and <slug>.render.json. Last line on success: RENDER_DONE ...
// Exit codes: 0 done, 1 render failed (show invalid, page error, worker died, wrong frame count), 2 bad command.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { findShowDir, loadShow } from './lib/showfiles.mjs';

const USAGE = 'node tools/render.mjs <slug> [--chunks N] [--size 1080x1920] [--fps 30] [--from S --to S] [--out path] [--no-audio] [--quality 92] [--crf 20]';
const WORKER = path.join(path.dirname(fileURLToPath(import.meta.url)), 'lib', 'render-worker.mjs');
const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
const FFPROBE = process.env.FFPROBE_PATH || 'ffprobe';

function parseArgs(argv) {
  const a = { slug: null, chunks: Math.min(4, Math.max(1, Math.floor(os.cpus().length / 2))), size: '1080x1920', fps: 30,
    from: 0, to: null, out: null, noAudio: false, quality: 92, crf: 20 };
  const num = { '--chunks': 'chunks', '--fps': 'fps', '--from': 'from', '--to': 'to', '--quality': 'quality', '--crf': 'crf' };
  for (let i = 0; i < argv.length; i++) {
    const f = argv[i];
    const val = () => { const v = argv[++i]; if (v === undefined || v.startsWith('--')) throw new Error(`${f} needs a value`); return v; };
    if (num[f]) { const v = Number(val()); if (!Number.isFinite(v)) throw new Error(`${f} needs a number`); a[num[f]] = v; }
    else if (f === '--size') a.size = val();
    else if (f === '--out') a.out = val();
    else if (f === '--no-audio') a.noAudio = true;
    else if (f.startsWith('--')) throw new Error(`unknown option ${f}`);
    else if (!a.slug) a.slug = f;
    else throw new Error(`unexpected "${f}"`);
  }
  if (!a.slug) throw new Error('give the show slug');
  const m = /^(\d+)x(\d+)$/.exec(a.size);
  if (!m || +m[1] % 2 || +m[2] % 2 || !+m[1] || !+m[2]) throw new Error('--size looks like 1080x1920 (both numbers even)');
  [a.width, a.height] = [+m[1], +m[2]];
  if (!Number.isInteger(a.chunks) || a.chunks < 1) throw new Error('--chunks must be a whole number, 1 or more');
  if (!Number.isInteger(a.fps) || a.fps < 1) throw new Error('--fps must be a whole number, 1 or more');
  if (!Number.isInteger(a.quality) || a.quality < 1 || a.quality > 100) throw new Error('--quality must be 1 to 100');
  if (!Number.isInteger(a.crf) || a.crf < 0 || a.crf > 51) throw new Error('--crf must be 0 to 51');
  if (a.from < 0 || (a.to !== null && a.to <= a.from)) throw new Error('--from must be 0 or more and --to must be after it');
  return a;
}

function killTree(pid) {
  try {
    if (process.platform === 'win32') execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' });
    else process.kill(pid, 'SIGKILL');
  } catch { /* already gone */ }
}

function run(exe, args) {
  const r = spawnSync(exe, args, { encoding: 'utf8', maxBuffer: 1 << 26 });
  if (r.error) throw new Error(`could not run ${exe}: ${r.error.message}. Is ffmpeg installed and on PATH?`);
  return r;
}

const live = new Set();      // worker processes still running
let tmpDir = null;

// Asks every worker to stop (closing its stdin makes it close Chrome), then force-kills whatever is left.
async function stopWorkers() {
  for (const w of live) { try { w.stdin.end(); } catch { /* ignore */ } }
  const until = Date.now() + 6000;
  while (live.size && Date.now() < until) await new Promise(r => setTimeout(r, 100));
  for (const w of live) killTree(w.pid);
}
function removeTmp() { if (tmpDir) { fs.rmSync(tmpDir, { recursive: true, force: true }); tmpDir = null; } }

function startChunk(cfg, onProgress) {
  return new Promise((resolve, reject) => {
    const w = spawn(process.execPath, [WORKER, JSON.stringify(cfg)], { stdio: ['pipe', 'pipe', 'pipe'] });
    live.add(w);
    let out = '', err = '', result = null;
    w.stdout.on('data', d => {
      out += d;
      const lines = out.split('\n'); out = lines.pop();
      for (const l of lines) {
        if (l.startsWith('P ')) onProgress(+l.slice(2));
        else if (l.startsWith('RESULT ')) result = JSON.parse(l.slice(7));
      }
    });
    w.stderr.on('data', d => { err = (err + d).slice(-3000); });
    w.on('error', e => { live.delete(w); reject(new Error(`could not start a worker: ${e.message}`)); });
    w.on('close', code => {
      live.delete(w);
      if (code === 0 && result) resolve(result);
      else reject(new Error(`chunk ${cfg.index} failed (exit ${code}): ${err.trim() || 'no message'}`));
    });
  });
}

async function main(argv) {
  let a;
  try { a = parseArgs(argv); } catch (e) { console.error(`USAGE: ${e.message}\n  ${USAGE}`); return 2; }
  let dir;
  try { dir = findShowDir(a.slug); } catch (e) { console.error('USAGE: ' + e.message); return 2; }
  const slug = path.basename(dir);

  const { raw, show, errors } = loadShow(dir);
  if (errors.length) {
    console.error(`RENDER ERROR: the show has ${errors.length} error(s), so it was not rendered:`);
    for (const e of errors) console.error(`  ERROR ${e.path}: ${e.message}${e.hint ? ' ' + e.hint : ''}`);
    return 1;
  }
  const v = run(FFMPEG, ['-version']);
  const ffmpegVersion = (v.stdout || '').split('\n')[0].trim();

  const fps = a.fps;
  const startF = Math.round(a.from * fps);
  const endF = Math.round((a.to === null ? show.duration : Math.min(a.to, show.duration)) * fps);
  const total = endF - startF;
  if (total < 1) { console.error('USAGE: that time range holds no frames'); return 2; }
  const chunks = Math.min(a.chunks, total);
  const out = path.resolve(a.out || path.join(dir, 'out', slug + '.mp4'));
  const audio = path.join(dir, raw.voice.audio);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  tmpDir = fs.mkdtempSync(path.join(path.dirname(out), '.render-tmp-'));

  const t0 = Date.now();
  const done = new Array(chunks).fill(0);
  const progress = setInterval(() => {
    const n = done.reduce((x, y) => x + y, 0), s = (Date.now() - t0) / 1000;
    const rate = n / s, eta = rate > 0 ? Math.round((total - n) / rate) : 0;
    console.log(`PROGRESS ${n}/${total} frames  ${rate.toFixed(2)} fps  ETA ${Math.floor(eta / 60)}m${String(eta % 60).padStart(2, '0')}s`);
  }, 5000);

  try {
    const jobs = [];
    const chunkFiles = [];
    for (let k = 0; k < chunks; k++) {
      const first = startF + Math.round(k * total / chunks), end = startF + Math.round((k + 1) * total / chunks);
      const file = path.join(tmpDir, `chunk${k}.ts`);
      chunkFiles.push(file);
      const cfg = { index: k, slug, width: a.width, height: a.height, fps, first, count: end - first, out: file,
        quality: a.quality, crf: a.crf, ffmpeg: FFMPEG, expectFrames: true };
      const s = Date.now();
      jobs.push(startChunk(cfg, n => { done[k] = n; }).then(r => ({ ...r, seconds: +((Date.now() - s) / 1000).toFixed(1) })));
    }
    // If one chunk fails, stop the others at once (Promise.all rejects on the first failure).
    let results;
    try { results = await Promise.all(jobs); } catch (e) { clearInterval(progress); await stopWorkers(); throw e; }
    clearInterval(progress);

    // Join the chunks without re-encoding.
    const list = path.join(tmpDir, 'chunks.txt');
    const quote = f => "file '" + f.replace(/\\/g, '/').replace(/'/g, "'\\''") + "'";
    fs.writeFileSync(list, chunkFiles.map(quote).join('\n') + '\n');
    const joined = path.join(tmpDir, 'joined.ts');
    let r = run(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', joined]);
    if (r.status !== 0) throw new Error('joining the chunks failed: ' + r.stderr);

    // Add the voice: cut to the video length (padded with silence if it is shorter).
    const length = total / fps;
    const tmpOut = path.join(tmpDir, 'final.mp4');
    const muxArgs = a.noAudio
      ? ['-i', joined, '-c:v', 'copy', '-an']
      : ['-i', joined, '-ss', String(a.from), '-i', audio, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-af', 'apad'];
    r = run(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', ...muxArgs, '-t', String(length), '-movflags', '+faststart', tmpOut]);
    if (r.status !== 0) throw new Error('adding the voice failed: ' + r.stderr);

    // Check the result: the number of video frames must be exactly what was asked for.
    r = run(FFPROBE, ['-v', 'error', '-count_packets', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_packets,width,height', '-of', 'json', tmpOut]);
    const st = JSON.parse(r.stdout).streams[0];
    if (+st.nb_read_packets !== total) throw new Error(`wrong frame count: the file has ${st.nb_read_packets} frames, expected ${total}`);
    if (st.width !== a.width || st.height !== a.height) throw new Error(`wrong picture size: ${st.width}x${st.height}, expected ${a.width}x${a.height}`);
    fs.copyFileSync(tmpOut, out);

    const seconds = (Date.now() - t0) / 1000;
    const report = { slug, frames: total, seconds: +seconds.toFixed(1), fps: +(total / seconds).toFixed(2), chunks, size: `${a.width}x${a.height}`,
      videoFps: fps, bytes: fs.statSync(out).size, renderer: [...new Set(results.map(x => x.renderer))].join(' | '),
      chunkSeconds: results.map(x => x.seconds), ffmpeg: ffmpegVersion, audio: !a.noAudio, from: a.from };
    fs.writeFileSync(out.replace(/\.mp4$/i, '') + '.render.json', JSON.stringify(report, null, 2) + '\n');
    console.log(`RENDER_DONE frames=${total} seconds=${seconds.toFixed(1)} fps=${report.fps} chunks=${chunks} out=${out}`);
    return 0;
  } finally {
    clearInterval(progress);
    await stopWorkers();
    removeTmp();
  }
}

async function onSignal() { await stopWorkers(); removeTmp(); process.exit(130); }
process.on('SIGINT', onSignal);
process.on('SIGTERM', onSignal);

main(process.argv.slice(2)).then(code => { process.exitCode = code; }, e => {
  console.error('RENDER ERROR: ' + (e && e.message || e));
  process.exitCode = 1;
});
