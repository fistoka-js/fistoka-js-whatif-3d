// One render chunk: its own Chrome (and static server), frames [first .. first+count) of a show, piped into ffmpeg
// as a video-only MPEG-TS file. Started by tools/render.mjs; not meant to be run by hand.
// Config: one JSON argument { slug, width, height, fps, first, count, out, quality, crf, ffmpeg, expectFrames }.
// Prints "P <frames done>" lines for progress and one final "RESULT {json}" line. Exit 0 ok, 1 failed (reason on stderr).
// Why a closed stdin means "stop": if the driver dies, the pipe closes and we clean up instead of leaving Chrome behind.

import { spawn, execSync } from 'node:child_process';
import { once } from 'node:events';
import { openSession } from './browser.mjs';

const cfg = JSON.parse(process.argv[2]);
let session = null, ff = null, closing = false;

function killTree(pid) {
  if (!pid) return;
  try {
    if (process.platform === 'win32') execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' });
    else process.kill(pid, 'SIGKILL');
  } catch { /* already gone */ }
}

// Closes Chrome (force-kills it if it hangs for 5 s), the server and ffmpeg. Safe to call more than once.
async function cleanup() {
  if (closing) return;
  closing = true;
  if (ff && ff.exitCode === null) { try { ff.stdin.destroy(); } catch { /* ignore */ } killTree(ff.pid); }
  if (session) {
    const proc = session.browser && session.browser.process();
    const ok = await Promise.race([session.close().then(() => true, () => true), new Promise(r => setTimeout(() => r(false), 5000))]);
    if (!ok && proc) killTree(proc.pid);
  }
}

async function shutdown(code) { await cleanup(); process.exit(code); }
process.stdin.on('end', () => shutdown(1));
process.stdin.resume();
process.on('SIGINT', () => shutdown(1));
process.on('SIGTERM', () => shutdown(1));

async function run() {
  const t0 = Date.now();
  session = await openSession();
  const page = await session.openShow(cfg.slug, { width: cfg.width, height: cfg.height });
  const info = await page.evaluate(() => window.__info());
  const pageFrames = Math.round(info.duration * info.fps);
  if (info.fps !== cfg.fps) console.error(`note: the page says fps ${info.fps}; rendering at ${cfg.fps} as asked`);
  if (cfg.expectFrames && cfg.first + cfg.count > pageFrames + 1) {
    throw new Error(`the page says the show lasts ${info.duration} s (${pageFrames} frames at ${info.fps}) but frames up to ${cfg.first + cfg.count} were asked for`);
  }
  const renderer = await page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2');
    const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown';
  });
  const cdp = await page.createCDPSession();
  const startupS = (Date.now() - t0) / 1000;

  // JPEG frames from Chrome are full range; scale=out_range=tv makes the file standard limited-range video.
  ff = spawn(cfg.ffmpeg, ['-y', '-hide_banner', '-f', 'image2pipe', '-framerate', String(cfg.fps), '-c:v', 'mjpeg', '-i', 'pipe:0',
    '-vf', 'scale=out_range=tv', '-c:v', 'libx264', '-preset', 'medium', '-crf', String(cfg.crf), '-pix_fmt', 'yuv420p',
    '-r', String(cfg.fps), '-g', '30', '-keyint_min', '30', '-sc_threshold', '0', '-force_key_frames', '0',
    '-an', '-f', 'mpegts', cfg.out], { stdio: ['pipe', 'ignore', 'pipe'] });
  let ffErr = '';
  ff.stderr.on('data', d => { ffErr = (ffErr + d).slice(-4000); });
  ff.stdin.on('error', () => { /* ffmpeg died; its exit code is reported below */ });
  const ffDone = new Promise(res => ff.on('close', res));

  const loopStart = Date.now();
  for (let i = 0; i < cfg.count; i++) {
    if (closing) return;
    const t = (cfg.first + i) / cfg.fps;               // every frame f is drawn at exactly f/fps
    // draw, then wait for two animation frames so the compositor really holds this picture
    await page.evaluate(tt => { window.__renderAt(tt); return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); }, t);
    if (page.problems.length) throw new Error(`page error at t=${t.toFixed(3)}: ${page.problems[0]}`);
    const shot = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: cfg.quality, fromSurface: true, optimizeForSpeed: true });
    if (ff.exitCode !== null) throw new Error('ffmpeg stopped early: ' + ffErr.slice(-500));
    if (!ff.stdin.write(Buffer.from(shot.data, 'base64'))) await once(ff.stdin, 'drain');
    if ((i + 1) % 10 === 0 || i + 1 === cfg.count) console.log(`P ${i + 1}`);
  }
  ff.stdin.end();
  const code = await ffDone;
  if (code !== 0) throw new Error('ffmpeg failed: ' + ffErr.slice(-500));
  const loopS = (Date.now() - loopStart) / 1000;
  console.log('RESULT ' + JSON.stringify({ frames: cfg.count, startupS: +startupS.toFixed(2), loopS: +loopS.toFixed(2), renderer }));
}

run().then(() => shutdown(0), async e => { console.error(e && e.message || String(e)); await shutdown(1); });
