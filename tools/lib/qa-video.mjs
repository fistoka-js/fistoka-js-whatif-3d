// Facts about a finished video file for QA, read with ffprobe / ffmpeg (FFPROBE_PATH / FFMPEG_PATH env, else PATH).
// Exports: probeVideo(file) -> { width, height, fps, hasAudio, videoSeconds }, probeSeconds(file) -> seconds,
//          measureLoudness(file) -> integrated LUFS or null, parseEbur128(text) -> number|null.

import { spawnSync } from 'node:child_process';

const FFPROBE = process.env.FFPROBE_PATH || 'ffprobe';
const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';

function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.error) throw new Error(`could not run ${cmd}: ${r.error.message}`);
  return r;
}

export function probeVideo(file) {
  const r = run(FFPROBE, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file]);
  if (r.status !== 0) throw new Error(`ffprobe failed on ${file}: ${r.stderr.trim()}`);
  const j = JSON.parse(r.stdout);
  const v = (j.streams || []).find(s => s.codec_type === 'video');
  if (!v) throw new Error(`${file} has no video stream`);
  const [n, d] = String(v.avg_frame_rate || v.r_frame_rate || '0/1').split('/').map(Number);
  const fmtSeconds = Number(j.format && j.format.duration);
  return {
    width: v.width, height: v.height, fps: d ? n / d : 0,
    hasAudio: (j.streams || []).some(s => s.codec_type === 'audio'),
    videoSeconds: Number(v.duration) || fmtSeconds,
  };
}

export function probeSeconds(file) {
  const r = run(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file]);
  const s = Number(r.stdout.trim());
  if (r.status !== 0 || !Number.isFinite(s)) throw new Error(`ffprobe could not read the length of ${file}`);
  return s;
}

// The "Summary:" block at the end of ffmpeg's ebur128 output has "I:  -14.2 LUFS".
export function parseEbur128(text) {
  const i = text.lastIndexOf('Summary:');
  if (i < 0) return null;
  const m = /I:\s+(-?[\d.]+)\s+LUFS/.exec(text.slice(i));
  return m ? Number(m[1]) : null;
}

export function measureLoudness(file) {
  const r = run(FFMPEG, ['-hide_banner', '-nostats', '-i', file, '-vn', '-af', 'ebur128=peak=none', '-f', 'null', '-']);
  return parseEbur128(r.stderr || '');
}
