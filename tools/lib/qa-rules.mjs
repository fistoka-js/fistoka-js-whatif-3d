// QA rules: pure functions (no browser, no files) that turn measurements into findings.
// Exports: T (all thresholds), rect helpers, toGray/meanLuma/meanAbsDiff, and the rule functions
//   blackFindings, frozenFindings, framingFindings, textFindings, pacingFindings, videoFindings, mergeFindings, worstLevel.
// A finding is { level:'FAIL'|'WARN', code, shot (id or null), time (s or null), what, measured:{}, fix, hits, key }.
// Samples (made by tools/qa.mjs) look like { t, shotIndex, kinds:Set<'grid'|'mid'|'edge'|'action'>, luma (0..255), boxes:[__boxes rows],
//   actions:[resolved actions that this sample follows by 0.3 s] }. `show` is the resolved show (kit/engine/show.js).

// ---- Thresholds: the one table. Change numbers here only. ----
export const T = {
  STEP: 0.5,                 // seconds between regular samples
  SIZE: [540, 960],          // page size used for sampling (the real video is 1080x1920; same shape, 4x fewer pixels)
  BLACK_LUMA: 0.05,          // mean brightness under this fraction of full scale counts as black
  BLACK_BRIGHT_FRAC: 0.0015, // ...and fewer than this fraction of pixels (outside captions/overlays) brighter than 25% (dark space scenes with a lit prop are not black)
  BLACK_SECONDS: 1.0,        // FAIL when black lasts longer than this
  FROZEN_DIFF: 0.3,          // mean pixel change (of 255) between samples one step apart under this counts as frozen
  FROZEN_SECONDS: 2.5,       // FAIL when frozen longer than this
  TARGET_INSIDE_MIN: 0.6,    // FAIL when a targeted/focused prop has less than this fraction of its box inside the frame
  CAPTION_ZONE: 0.24,        // bottom fraction of the frame reserved for captions
  CAPTION_OVERLAP_MAX: 0.4,  // WARN when more than this fraction of a prop box sits in the caption zone
  SUBJECT_MIN_AREA: 0.06,    // WARN when all visible prop boxes together cover less than this fraction of the frame
  EMPTY_WARN_SECONDS: 1.5,   // WARN when nothing at all is visible for longer than this inside a shot
  TEXT_OVERLAP_FAIL: 0.2,    // FAIL when two text boxes overlap by this fraction of the smaller box or more
  TEXT_OVERLAP_MIN: 0.02,    // overlaps smaller than this fraction are ignored (rounding noise)
  TEXT_OUTSIDE_MAX: 0.05,    // FAIL when a text box has more than this fraction of its area outside the frame
  LABEL_COVER_MAX: 0.35,     // WARN when a label covers more than this fraction of the prop it belongs to
  MIN_HITS_FOR_FAIL: 2,      // a text problem must show in this many samples to FAIL (a one-sample flash is only a WARN)
  IDLE_SECONDS: 7,           // WARN when a shot with a still/drift camera has no action for longer than this
  MAX_OVERLAYS: 3,           // WARN when more than this many labels/texts/counters/icons are visible at once
  VIDEO_LEN_DIFF: 0.5,       // FAIL when video and voice lengths differ by more than this many seconds
  VIDEO_SIZE: [1080, 1920],  // the video must be exactly this size
  VIDEO_FPS: 30,             // and this frame rate
  LUFS_MIN: -18,             // WARN when the measured loudness is quieter than this
  LUFS_MAX: -13,             // WARN when it is louder than this
};

const TEXT_KINDS = ['label', 'text', 'count', 'icon', 'caption'];
const OVERLAY_KINDS = ['label', 'text', 'count', 'icon'];
const r1 = v => Math.round(v * 10) / 10;
const pct = v => Math.round(v * 100) + '%';
const sec = v => r1(v) + ' s';

// ---- rectangles {x,y,w,h} ----
export const area = r => Math.max(0, r.w) * Math.max(0, r.h);
export function intersect(a, b) {
  const x0 = Math.max(a.x, b.x), y0 = Math.max(a.y, b.y), x1 = Math.min(a.x + a.w, b.x + b.w), y1 = Math.min(a.y + a.h, b.y + b.h);
  return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) };
}
// Fraction of rect r that lies inside rect frame.
export const insideFraction = (r, frame) => (area(r) > 0 ? area(intersect(r, frame)) / area(r) : 0);
// Area of the union of rects (clipped to frame) as a fraction of the frame. Done on a coarse grid; good enough for a 6% rule.
export function unionFraction(rects, frame, cells = 100) {
  const cw = frame.w / cells, ch = frame.h / cells;
  let hit = 0;
  for (let j = 0; j < cells; j++) for (let i = 0; i < cells; i++) {
    const cx = frame.x + (i + 0.5) * cw, cy = frame.y + (j + 0.5) * ch;
    if (rects.some(r => cx >= r.x && cx < r.x + r.w && cy >= r.y && cy < r.y + r.h)) hit++;
  }
  return hit / (cells * cells);
}

// ---- pixels ----
// RGBA buffer -> grey picture sampled every `stride` pixels (0..255). Rec.709 weights.
export function toGray(rgba, w, h, stride = 2) {
  const gw = Math.floor(w / stride), gh = Math.floor(h / stride), data = new Uint8Array(gw * gh);
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
    const i = ((y * stride) * w + x * stride) * 4;
    data[y * gw + x] = 0.2126 * rgba[i] + 0.7152 * rgba[i + 1] + 0.0722 * rgba[i + 2];
  }
  return { w: gw, h: gh, stride, data };
}
export function meanLuma(g) { let s = 0; for (let i = 0; i < g.data.length; i++) s += g.data[i]; return s / g.data.length; }
// Fraction of pixels brighter than `level` (0..255), skipping `mask` rects (full-size pixels): tells "dark scene with a subject" from "blank".
export function brightFraction(g, mask = [], level = 64) {
  let n = 0, hit = 0;
  const m = mask.map(r => ({ x0: r.x / g.stride, y0: r.y / g.stride, x1: (r.x + r.w) / g.stride, y1: (r.y + r.h) / g.stride }));
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    if (m.some(r => x >= r.x0 && x < r.x1 && y >= r.y0 && y < r.y1)) continue;
    n++; if (g.data[y * g.w + x] > level) hit++;
  }
  return n ? hit / n : 0;
}
// Mean absolute difference of two grey pictures, skipping `mask` rects (given in full-size pixels).
export function meanAbsDiff(a, b, mask = []) {
  let s = 0, n = 0;
  const m = mask.map(r => ({ x0: r.x / a.stride, y0: r.y / a.stride, x1: (r.x + r.w) / a.stride, y1: (r.y + r.h) / a.stride }));
  for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) {
    if (m.some(r => x >= r.x0 && x < r.x1 && y >= r.y0 && y < r.y1)) continue;
    s += Math.abs(a.data[y * a.w + x] - b.data[y * a.w + x]); n++;
  }
  return n ? s / n : 0;
}

// ---- findings ----
const shotOf = (show, t) => show.shots.find(s => t >= s.start && t < s.end) || show.shots[show.shots.length - 1];
const mk = (level, code, shot, time, what, measured, fix, key) => ({
  level, code, shot: shot ? shot.id : null, time, what, measured, fix, hits: 1, key: key || `${code}|${shot ? shot.id : ''}|${what}`,
});

// Joins findings with the same key: keeps the first time, adds up the hits, and lets FAIL win.
export function mergeFindings(list) {
  const map = new Map();
  for (const f of list) {
    const old = map.get(f.key);
    if (!old) { map.set(f.key, { ...f }); continue; }
    old.hits += f.hits;
    if (f.level === 'FAIL') old.level = 'FAIL';
    old.time = Math.min(old.time ?? Infinity, f.time ?? Infinity);
  }
  return [...map.values()];
}
export const worstLevel = list => (list.some(f => f.level === 'FAIL') ? 'fail' : list.some(f => f.level === 'WARN') ? 'warn' : 'pass');

// ---- 1. black ----
// samples with .luma, sorted by time. A run of dark samples lasts (last - first + step) seconds.
export function blackFindings(show, samples, step = T.STEP) {
  const out = [], dark = s => s.luma < T.BLACK_LUMA * 255 && (s.bright ?? 0) < T.BLACK_BRIGHT_FRAC;
  let run = [];
  const flush = () => {
    if (run.length) {
      const len = run[run.length - 1].t - run[0].t + step;
      if (len > T.BLACK_SECONDS) {
        const avg = run.reduce((a, s) => a + s.luma, 0) / run.length;
        out.push(mk('FAIL', 'black', shotOf(show, run[0].t), run[0].t,
          `the picture is almost black (mean brightness ${pct(avg / 255)} of full scale) for ${sec(len)}, from ${r1(run[0].t)} s`,
          { meanBrightnessPct: Math.round(avg / 2.55), seconds: r1(len) },
          'check the shot\'s env colour is not near black and that its props are inside the frame and not hidden; add an "appear" action for props that start hidden.'));
      }
    }
    run = [];
  };
  for (const s of samples) { if (dark(s)) run.push(s); else flush(); }
  flush();
  return out;
}

// ---- 2. frozen ----
// pairs: [{ t0, t1, diff }] for consecutive regular samples (diff = mean abs change, 0..255).
export function frozenFindings(show, pairs) {
  const out = [];
  let run = [];
  const flush = () => {
    if (run.length) {
      const len = run[run.length - 1].t1 - run[0].t0;
      if (len > T.FROZEN_SECONDS) {
        const avg = run.reduce((a, p) => a + p.diff, 0) / run.length;
        out.push(mk('FAIL', 'frozen', shotOf(show, run[0].t0), run[0].t0,
          `the picture does not change for ${sec(len)}, from ${r1(run[0].t0)} s (average change ${avg.toFixed(2)} of 255)`,
          { seconds: r1(len), avgChange: Math.round(avg * 100) / 100 },
          'give the shot something to do every few seconds: an action ("pulse", "move", "glow", "label") or a camera "move" other than "still" (for example "push_in" or "orbit").'));
      }
    }
    run = [];
  };
  for (const p of pairs) { if (p.diff < T.FROZEN_DIFF) run.push(p); else flush(); }
  flush();
  return out;
}

// ---- 3. framing ----
const propIn = (shot, id) => shot.props.find(p => p.id === id);
const TRANSITIONAL = ['appear', 'disappear']; // the prop is still flying in/out 0.3 s after these, so it is not framing-checked then

// Ids the picture must show well: props named by actions (and focus actions) in the given list, plus the shot camera's focus list.
function targetIds(shot, actions, withCameraFocus) {
  const ids = new Set();
  for (const a of actions) {
    if (TRANSITIONAL.includes(a.do)) continue;
    if (a.prop) ids.add(a.prop);
    if (a.do === 'focus' && Array.isArray(a.props)) a.props.forEach(p => ids.add(p));
  }
  if (withCameraFocus && shot.camera && Array.isArray(shot.camera.focus)) shot.camera.focus.forEach(p => ids.add(p));
  return ids;
}

export function framingFindings(show, samples, frame) {
  const out = [], capTop = frame.h * (1 - T.CAPTION_ZONE);
  const capRect = { x: 0, y: capTop, w: frame.w, h: frame.h - capTop };
  const frameRect = { x: 0, y: 0, w: frame.w, h: frame.h };

  for (const s of samples) {
    const shot = show.shots[s.shotIndex];
    const props = s.boxes.filter(b => b.kind === 'prop');
    const isMid = s.kinds.has('mid'), isAct = s.kinds.has('action');
    if (!isMid && !isAct) continue;
    const targets = new Set();
    if (isMid) targetIds(shot, shot.actions, true).forEach(i => targets.add(i));
    if (isAct) targetIds(shot, s.actions || [], false).forEach(i => targets.add(i));

    for (const b of props) {
      const p = propIn(shot, b.id);
      if (!p) continue;
      const line = p.stageSpace; // beams/arrows: their box is the bounding box of a line and they often run off the frame on purpose, so skip them here
      const inside = insideFraction(b, frameRect);
      if (!line && targets.has(b.id) && inside < T.TARGET_INSIDE_MIN) {
        const where = `x ${Math.round(b.x)}..${Math.round(b.x + b.w)} of ${frame.w}, y ${Math.round(b.y)}..${Math.round(b.y + b.h)} of ${frame.h}`;
        out.push(mk('FAIL', 'prop-outside', shot, s.t,
          `prop "${b.id}" is ${pct(1 - inside)} outside the frame (box ${where})`,
          { prop: b.id, outsidePct: Math.round((1 - inside) * 100), box: [b.x, b.y, b.w, b.h].map(Math.round) },
          `move it toward the centre (its "at" is ${JSON.stringify(p.at)}) or use a wider camera "framing" (now "${shot.camera.framing}") and list the props to keep in view under "focus".`,
          `prop-outside|${shot.id}|${b.id}`));
      }
      if (!line && area(b) > 0) {
        const cap = area(intersect(b, capRect)) / area(b);
        if (cap > T.CAPTION_OVERLAP_MAX) {
          out.push(mk('WARN', 'prop-in-captions', shot, s.t,
            `prop "${b.id}" is ${pct(cap)} inside the caption zone (bottom ${pct(T.CAPTION_ZONE)} of the frame, y from ${Math.round(capTop)})`,
            { prop: b.id, captionPct: Math.round(cap * 100) },
            `lift it (raise y in its "at", now ${JSON.stringify(p.at)}) or use a "high" camera "angle"; the captions will cover it otherwise.`,
            `prop-in-captions|${shot.id}|${b.id}`));
        }
      }
    }
    if (isMid) {
      const solid = props.filter(b => { const p = propIn(shot, b.id); return p && !p.stageSpace; });
      if (solid.length) {
        const cov = unionFraction(solid, frameRect);
        if (cov < T.SUBJECT_MIN_AREA) {
          out.push(mk('WARN', 'subject-small', shot, s.t, `the subject is too small: visible props cover only ${pct(cov)} of the frame`,
            { coveragePct: Math.round(cov * 100) },
            'raise the props\' "size" or use "framing": "close" in the shot\'s camera; list only the props that matter under "focus".', `subject-small|${shot.id}`));
        }
      }
    }
  }

  // Nothing visible: look at the regular, midpoint and edge samples of each shot.
  const base = samples.filter(s => s.kinds.has('grid') || s.kinds.has('mid') || s.kinds.has('edge'));
  show.shots.forEach((shot, si) => {
    const list = base.filter(s => s.shotIndex === si).sort((a, b) => a.t - b.t);
    if (!list.length) return;
    const empty = s => !s.boxes.some(b => b.kind === 'prop' || OVERLAY_KINDS.includes(b.kind));
    if (list.every(empty)) {
      out.push(mk('FAIL', 'nothing-visible', shot, shot.start, `nothing is visible in the whole shot (no prop, label, text, counter or icon in ${list.length} samples)`,
        { samples: list.length },
        'give the shot visible props: check no prop is "hidden" without an "appear" action (at a word spoken inside this shot), and that the prop "type" draws something.'));
      return;
    }
    let run = [];
    const flush = () => {
      if (run.length) {
        const len = run[run.length - 1].t - run[0].t + T.STEP;
        if (len > T.EMPTY_WARN_SECONDS) {
          out.push(mk('WARN', 'empty-stretch', shot, run[0].t, `nothing is visible for ${sec(len)} (from ${r1(run[0].t)} s)`, { seconds: r1(len) },
            'make the first "appear" happen sooner (on the shot\'s first words) or drop "hidden" from a prop that should be there from the start.', `empty-stretch|${shot.id}`));
        }
      }
      run = [];
    };
    for (const s of list) { if (empty(s)) run.push(s); else flush(); }
    flush();
  });
  return out;
}

// ---- 4. text collisions ----
// A "stamp" text is drawn tilted, so the page reports the box around the tilted shape, which is bigger than the shape.
// Shrink it to about what is really covered.
function tightBox(b, shot) {
  if (b.kind !== 'text') return b;
  const act = (shot.actions || []).find(x => `${shot.id}:${x.path}` === b.id);
  if (!act || act.style !== 'stamp') return b;
  const w = b.w * 0.9, h = b.h * 0.65;
  return { ...b, x: b.x + (b.w - w) / 2, y: b.y + (b.h - h) / 2, w, h };
}
// names(box) -> short description such as: label "TIDES SHRINK" (tools/qa.mjs supplies it from the show file).
export function textFindings(show, samples, frame, names = b => b.kind) {
  const frameRect = { x: 0, y: 0, w: frame.w, h: frame.h };
  // Collect hits first so a problem must show in several samples before it counts as a FAIL.
  const raw = new Map();
  const note = (key, f) => {
    const old = raw.get(key);
    if (!old) raw.set(key, { ...f, hits: 1 });
    else { old.hits++; if (f.ratio > old.ratio) { old.ratio = f.ratio; old.what = f.what; old.measured = f.measured; } }
  };
  for (const s of samples) {
    const shot = show.shots[s.shotIndex];
    const texts = s.boxes.filter(b => TEXT_KINDS.includes(b.kind)).map(b => tightBox(b, shot));
    for (let i = 0; i < texts.length; i++) {
      const a = texts[i];
      const outside = 1 - insideFraction(a, frameRect);
      if (outside > T.TEXT_OUTSIDE_MAX) {
        note(`out|${shot.id}|${a.id}`, {
          code: 'text-outside', shot, t: s.t, ratio: outside,
          what: `${names(a)} is ${pct(outside)} outside the frame (box x ${Math.round(a.x)}..${Math.round(a.x + a.w)} of ${frame.w}, y ${Math.round(a.y)}..${Math.round(a.y + a.h)} of ${frame.h})`,
          measured: { outsidePct: Math.round(outside * 100) },
          fix: 'shorten the "text" (about 16 characters per line fit) or attach it to a prop nearer the centre of the frame.',
        });
      }
      for (let j = i + 1; j < texts.length; j++) {
        const b = texts[j];
        const small = Math.min(area(a), area(b));
        if (small <= 0) continue;
        const ratio = area(intersect(a, b)) / small;
        if (ratio < T.TEXT_OVERLAP_MIN) continue;
        const pair = [a, b].sort((p, q) => p.id.localeCompare(q.id));
        note(`ovl|${shot.id}|${pair[0].id}|${pair[1].id}`, {
          code: 'text-overlap', shot, t: s.t, ratio,
          what: `${names(a)} and ${names(b)} overlap by ${pct(ratio)} of the smaller box`,
          measured: { overlapPct: Math.round(ratio * 100) },
          fix: a.kind === 'caption' || b.kind === 'caption'
            ? 'move or shorten the on-screen text so it stays clear of the captions, or end it ("until") sooner.'
            : (a.kind === 'label' || b.kind === 'label' || a.kind === 'icon' || b.kind === 'icon')
              ? 'put the two on different props or "side" values (or a different "place" for an icon), start one on a later word ("at"), or end the first with "until" before the second starts.'
              : 'give the two a different "pos" (top or middle), start one on a later word ("at"), or end the first with "until" before the second starts.',
        });
      }
      // A label should not hide most of its own prop. Its prop is found through the box id (shotId:actionPath).
      if (a.kind === 'label') {
        const act = (shot.actions || []).find(x => `${shot.id}:${x.path}` === a.id);
        const pr = act && act.prop ? s.boxes.find(b => b.kind === 'prop' && b.id === act.prop) : null;
        if (pr && area(pr) > 0) {
          const cover = area(intersect(a, pr)) / area(pr);
          if (cover > T.LABEL_COVER_MAX) {
            note(`cover|${shot.id}|${a.id}`, {
              code: 'label-covers-prop', shot, t: s.t, ratio: cover, warnOnly: true,
              what: `${names(a)} covers ${pct(cover)} of its prop "${pr.id}"`, measured: { coverPct: Math.round(cover * 100) },
              fix: `use a shorter "text", set "side" to left, right or top on that label, or make prop "${pr.id}" larger ("size").`,
            });
          }
        }
      }
    }
  }
  const out = [];
  for (const [key, f] of raw) {
    const strong = f.code === 'text-outside' || f.ratio >= T.TEXT_OVERLAP_FAIL;
    const fail = !f.warnOnly && strong && f.hits >= T.MIN_HITS_FOR_FAIL;
    const o = mk(fail ? 'FAIL' : 'WARN', f.code, f.shot, f.t, f.what, f.measured, f.fix, key);
    o.hits = f.hits;
    out.push(o);
  }
  return out;
}

// ---- 5. pacing ----
export function pacingFindings(show, samples) {
  const out = [];
  for (const shot of show.shots) {
    const move = shot.camera && shot.camera.move;
    if (move !== 'still' && move !== 'drift') continue;
    const times = [shot.start, ...shot.actions.filter(a => a.do !== 'sfx').map(a => a.t0), shot.end].sort((a, b) => a - b);
    let best = 0, at = shot.start;
    for (let i = 1; i < times.length; i++) if (times[i] - times[i - 1] > best) { best = times[i] - times[i - 1]; at = times[i - 1]; }
    if (best > T.IDLE_SECONDS) {
      out.push(mk('WARN', 'idle', shot, at, `nothing happens for ${sec(best)} (no action, camera "${move}")`, { seconds: r1(best) },
        'add an action in the quiet stretch (a "pulse", "label" or "move" on a spoken word), or change the camera "move" to "push_in", "orbit" or "pan".'));
    }
  }
  for (const s of samples) {
    const n = s.boxes.filter(b => OVERLAY_KINDS.includes(b.kind)).length;
    if (n > T.MAX_OVERLAYS) {
      const shot = show.shots[s.shotIndex];
      out.push(mk('WARN', 'too-many-overlays', shot, s.t, `${n} labels/texts/counters/icons are visible at once`, { overlays: n },
        'end some of them sooner with "until", or split the shot so fewer show at the same time.', `too-many-overlays|${shot.id}`));
    }
  }
  return out;
}

// ---- 6. video file ----
// info: { width, height, fps, hasAudio, videoSeconds, voiceSeconds, lufs (number|null) }
export function videoFindings(info) {
  const out = [];
  const add = (level, code, what, measured, fix) => out.push(mk(level, code, null, null, what, measured, fix));
  if (info.voiceSeconds != null && info.videoSeconds != null && Math.abs(info.videoSeconds - info.voiceSeconds) > T.VIDEO_LEN_DIFF) {
    add('FAIL', 'video-length', `video is ${info.videoSeconds.toFixed(2)} s but the voice is ${info.voiceSeconds.toFixed(2)} s long (difference ${Math.abs(info.videoSeconds - info.voiceSeconds).toFixed(2)} s)`,
      { video: info.videoSeconds, voice: info.voiceSeconds }, 'render again (node tools/render.mjs <slug>); if it repeats, check "tail" in show.json and that voice.mp3 was not changed after words.json.');
  }
  if (info.width !== T.VIDEO_SIZE[0] || info.height !== T.VIDEO_SIZE[1]) {
    add('FAIL', 'video-size', `video size is ${info.width}x${info.height}, expected ${T.VIDEO_SIZE.join('x')}`, { width: info.width, height: info.height }, 'render with --size 1080x1920.');
  }
  if (!(Math.abs(info.fps - T.VIDEO_FPS) <= 0.01)) {
    add('FAIL', 'video-fps', `video frame rate is ${r1(info.fps)} fps, expected ${T.VIDEO_FPS}`, { fps: info.fps }, 'render with --fps 30.');
  }
  if (!info.hasAudio) {
    add('FAIL', 'video-audio', 'the video has no audio stream', {}, 'render without --no-audio and check shows/<slug>/voice.mp3 exists.');
  } else if (info.lufs != null && (info.lufs < T.LUFS_MIN || info.lufs > T.LUFS_MAX)) {
    add('WARN', 'video-loudness', `loudness is ${info.lufs.toFixed(1)} LUFS, outside ${T.LUFS_MIN}..${T.LUFS_MAX}`, { lufs: info.lufs },
      info.lufs < T.LUFS_MIN ? 'raise the voice/music level in the mix step.' : 'lower the voice/music level in the mix step.');
  }
  return out;
}
