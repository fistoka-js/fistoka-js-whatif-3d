// The page's main module: loads the show, builds the stage, overlays and captions, and exposes the hooks (SPEC §10).
// URL: kit/index.html?show=shows/<slug>[&render=1][&t=12.5]
//   render=1  for tools: no controls; frames are drawn only by window.__renderAt(t).
//   t         preview only: the first frame shown (handy for checking a moment by eye).
// Hooks: __ready, __error, __renderAt(t), __info(), __boxes(t).
// Exports nothing (it runs on load).

import * as THREE from 'three';
import { resolveShow, formatProblem } from './show.js';
import { catalog } from './registry.js';
import { buildStage } from './stage.js';
import { makeOverlay } from './overlay.js';
import { makeCaptions } from './captions.js';

const FPS = 30;
const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const renderMode = params.get('render') === '1';
if (renderMode) document.body.classList.add('render');

function fail(message) {
  window.__error = message;
  const box = $('msg');
  box.textContent = 'This show cannot play:\n\n' + message;
  box.style.display = 'block';
  $('playlabel').textContent = 'Error';
  console.error(message);
}

async function fetchJson(url, label) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${label}: could not load ${url} (HTTP ${res.status}).`);
  try { return await res.json(); } catch (e) { throw new Error(`${label}: ${url} is not valid JSON (${e.message}).`); }
}

// Keeps --u (1% of the stage width, in px) in step with the stage size, and the renderer size with it.
function fitStage(renderer) {
  const st = $('stage');
  const w = st.clientWidth, h = st.clientHeight;
  st.style.setProperty('--u', (w / 100).toFixed(3) + 'px');
  renderer.setSize(w, h, false);
}

async function boot() {
  const showDir = (params.get('show') || '').replace(/\/+$/, '');
  if (!showDir) { fail('No show given. Open kit/index.html?show=shows/<slug>'); return; }
  const base = new URL('../' + showDir + '/', location.href);
  const raw = await fetchJson(new URL('show.json', base), 'show.json');
  const words = await fetchJson(new URL((raw.voice && raw.voice.words) || 'words.json', base), 'words');
  const { show, errors } = resolveShow(raw, words, catalog);
  if (errors.length) { fail(errors.map(p => formatProblem(p)).join('\n')); return; }

  $('stage').style.setProperty('--accent', show.accent);
  document.title = show.title;
  const renderer = new THREE.WebGLRenderer({ canvas: $('gl'), antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  fitStage(renderer);

  const stage = buildStage(show, catalog, renderer);
  const overlay = makeOverlay($('overlay'), $('ovsvg'), show, stage);
  const captions = makeCaptions($('cap'), words, show.duration);
  stage.warmUp();

  function renderAt(t) {
    const tt = Math.min(Math.max(0, Number(t) || 0), show.duration - 1e-3);
    stage.render(tt);
    overlay.update(tt);
    captions.update(tt);
    const dip = stage.dipAt(tt);
    $('dip').style.background = dip.color;
    $('dip').style.opacity = dip.opacity.toFixed(3);
    $('fill').style.width = (100 * tt / show.duration).toFixed(2) + '%';
  }

  window.__renderAt = renderAt;
  window.__info = () => ({ duration: show.duration, fps: FPS, shots: show.shots.map(s => ({ id: s.id, start: s.start, end: s.end })) });
  // Screen rectangles (px) of every visible prop, overlay and the caption block at time t.
  window.__boxes = t => {
    renderAt(t);
    const s = stage.shots[stage.shotIndexAt(t)];
    const out = [];
    for (const pr of s.props) {
      const r = stage.propRect(pr.p.id);
      if (r) out.push({ kind: 'prop', id: pr.p.id, x: r.x, y: r.y, w: r.w, h: r.h });
    }
    out.push(...overlay.boxes());
    const cap = $('cap').querySelector('.line');
    if (cap) {
      const b = cap.getBoundingClientRect(), o = $('stage').getBoundingClientRect();
      out.push({ kind: 'caption', id: 'caption', x: b.left - o.left, y: b.top - o.top, w: b.width, h: b.height });
    }
    return out;
  };

  await document.fonts.ready;
  renderAt(Number(params.get('t')) || 0);
  if (!renderMode) setupPreview(show, base, renderAt, renderer);
  window.__ready = true;
}

// Preview: play button, audio clock, click-to-seek bar, R to restart.
function setupPreview(show, base, renderAt, renderer) {
  const audio = $('voice');
  audio.src = new URL(show.voice.audio, base).href;
  const play = $('play'), label = $('playlabel');
  play.disabled = false;
  label.textContent = 'Play';
  let playing = false;
  const loop = () => {
    if (!playing) return;
    renderAt(audio.currentTime);
    if (audio.ended) { playing = false; $('center').style.display = 'flex'; label.textContent = 'Replay'; return; }
    requestAnimationFrame(loop);
  };
  const start = () => { audio.play(); playing = true; $('center').style.display = 'none'; requestAnimationFrame(loop); };
  play.onclick = start;
  $('bar').onclick = e => {
    const r = $('bar').getBoundingClientRect();
    audio.currentTime = ((e.clientX - r.left) / r.width) * show.duration;
    if (!playing) renderAt(audio.currentTime);
  };
  document.addEventListener('keydown', e => {
    if (e.key === 'r' || e.key === 'R') { audio.currentTime = 0; if (!playing) start(); }
    if (e.key === ' ') { e.preventDefault(); if (playing) { audio.pause(); playing = false; } else start(); }
  });
  window.addEventListener('resize', () => { fitStage(renderer); renderAt(audio.currentTime); });
}

boot().catch(e => fail(e && e.message ? e.message : String(e)));
