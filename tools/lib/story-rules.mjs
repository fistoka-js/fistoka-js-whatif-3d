// Story rules (SPEC §14): does the picture follow the words? Computed from the resolved show alone (no browser).
// They fail a "slideshow": a new object per sentence that then sits still while the narrator talks.
// Exports: STORY_RULES_DEFAULT (on or off when no flag is given), STORY (thresholds), sentencesOf(words),
//          changeEvents(show, catalog), storyRules(show, catalog) -> { errors, warnings, measured }.
// errors/warnings are { path, message, hint, time } (time: seconds or null). validate.mjs drops "time" so its JSON keeps
// the validator's { path, message, hint } shape and the problems flow into the writer's repair loop; qa.mjs uses it.

import { makeShotState } from '../../kit/engine/state.js';
import { dialMovingAt } from '../../kit/engine/dials.js';

// Off by default for now: the writer's fallback show and the two prompt examples are slideshows and would fail, and
// pipeline/writer.py (not owned here) calls the validator with no flag. Turn on with --story-rules (see docs/QA.md).
export const STORY_RULES_DEFAULT = false;

export const STORY = {
  STEP: 0.05,          // seconds between the samples of the time grid
  MIN_SENTENCE: 1.0,   // a sentence spoken in under this many seconds ("No paint.") is joined to the next one
  MIN_CHANGE: 0.3,     // an instant change (a step, over 0) counts as a change for this long
  STILL_ERROR: 3.5,    // nothing changing for longer than this (s) = ERROR
  STILL_WARN: 2.5,     // ... longer than this = WARNING
  MAX_SCENES: 6,       // more scenes (shots without "continue") than this = WARNING
  HERO_SHARE: 0.3,     // some prop should be on screen for at least this share of the video
};

// Actions that do not change a prop's state (overlays, camera, sound), and continuous idle motions.
const NOT_A_CHANGE = new Set(['label', 'text', 'icon', 'count', 'focus', 'sfx']);
const IDLE = new Set(['spin', 'bob', 'orbit']);

// Spoken sentences (split after a word ending in . ? or !), each { text, start, end, words }. `end` is where the next
// sentence starts (the pause belongs to the sentence before it). Very short sentences are joined to the next one.
export function sentencesOf(words) {
  const raw = [];
  let cur = [];
  for (const w of words) {
    cur.push(w);
    if (/[.?!]["')\]]*$/.test(w.text)) { raw.push(cur); cur = []; }
  }
  if (cur.length) raw.push(cur);
  const merged = [];
  for (let i = 0; i < raw.length; i++) {
    const ws = raw[i];
    const spoken = ws[ws.length - 1].end - ws[0].start;
    if (spoken < STORY.MIN_SENTENCE && i + 1 < raw.length) { raw[i + 1] = ws.concat(raw[i + 1]); continue; }
    if (spoken < STORY.MIN_SENTENCE && merged.length) { merged[merged.length - 1] = merged[merged.length - 1].concat(ws); continue; }
    merged.push(ws);
  }
  return merged.map((ws, i) => ({
    text: ws.map(w => w.text).join(' '), words: ws, start: ws[0].start,
    end: i + 1 < merged.length ? merged[i + 1][0].start : ws[ws.length - 1].end,
  }));
}

// Every state change of a prop made by an action: { t0, t1, what, shot }. Overlays, camera moves and idle motion are left out.
export function changeEvents(show) {
  const out = [];
  for (const shot of show.shots) for (const a of shot.actions) {
    if (NOT_A_CHANGE.has(a.do) || IDLE.has(a.do) || !a.prop) continue;
    const len = a.do === 'shake' ? a.for : a.over;
    out.push({ t0: a.t0, t1: a.t0 + Math.max(len || 0, STORY.MIN_CHANGE), what: `${a.do} on "${a.prop}"`, shot: shot.id });
  }
  return out;
}

const fmt = t => t.toFixed(2);
const quote = (text, max = 110) => `"${text.length > max ? text.slice(0, max - 3) + '...' : text}"`;

export function storyRules(show, catalog) {
  const errors = [], warnings = [];
  const states = show.shots.map(shot => makeShotState(shot, catalog));
  const shotIndexAt = t => { let i = 0; while (i + 1 < show.shots.length && t >= show.shots[i + 1].start) i++; return i; };
  const events = changeEvents(show);

  // The time grid: at each sample, is some prop changing? (an action's change, or a dial moving that a visible prop follows)
  const n = Math.floor(show.duration / STORY.STEP) + 1;
  const grid = [];
  for (let i = 0; i < n; i++) {
    const t = i * STORY.STEP;
    const si = shotIndexAt(t), shot = show.shots[si];
    let dial = null;
    for (const p of shot.props) {
      for (const b of Object.values(p.bind || {})) {
        if (dialMovingAt(show.dials[b.dial], t) && states[si].propAt(p.id, t).visible) { dial = b.dial; break; }
      }
      if (dial) break;
    }
    const action = events.some(e => t >= e.t0 - 1e-6 && t <= e.t1 + 1e-6);
    grid.push({ t, changing: action || dial !== null, dial });
  }

  // 1. Sentence coverage: something on screen changes in every sentence.
  const sentences = sentencesOf(show.words);
  let uncovered = 0;
  sentences.forEach((s, i) => {
    const starts = events.some(e => e.t0 >= s.start - 1e-6 && e.t0 < s.end);
    const dialMoves = grid.some(g => g.dial && g.t >= s.start && g.t < s.end);
    if (starts || dialMoves) return;
    uncovered++;
    errors.push({
      path: `story.sentences[${i}]`, time: s.start,
      message: `the sentence ${quote(s.text)} (${fmt(s.start)}-${fmt(s.end)} s) has no visible change: nothing on screen changes while it is spoken.`,
      hint: `Make something change between ${fmt(s.start)} and ${fmt(s.end)} s: an action on a prop that starts there (move, scale, color, glow, set, appear, disappear, pulse, shake), or a dial key at a phrase of this sentence with the dial bound to a prop on screen. Labels, text, icons, counts and camera moves do not count.`,
    });
  });

  // 2. Stillness: the longest stretch of the narration in which no prop changes.
  const first = show.words[0].start, last = show.words[show.words.length - 1].end;
  const stretches = [];
  let runStart = null;
  for (const g of grid) {
    const inside = g.t >= first && g.t <= last;
    if (inside && !g.changing) { if (runStart === null) runStart = g.t; continue; }
    if (runStart !== null) { stretches.push([runStart, Math.min(g.t, last)]); runStart = null; }
  }
  if (runStart !== null) stretches.push([runStart, last]);
  const longest = stretches.reduce((m, s) => (s[1] - s[0] > m[1] - m[0] ? s : m), [0, 0]);
  const stillMsg = ([a, b]) => {
    const said = show.words.filter(w => w.start >= a - 0.01 && w.start < b).map(w => w.text).join(' ');
    return {
      path: 'story.stillness', time: a,
      message: `nothing on screen changes from ${fmt(a)} to ${fmt(b)} s (${fmt(b - a)} s; at most ${STORY.STILL_ERROR} s allowed, ${STORY.STILL_WARN} s is better) while the narrator says ${quote(said || '(a pause)')}.`,
      hint: 'Add a change in that stretch: a "set", "move", "scale", "color" or "glow" on a prop (give it "until": a later phrase so it runs from word to word), or a dial key there with the dial bound to a prop on screen. Camera moves, spin, bob, orbit, labels and text do not count.',
    };
  };
  const long = stretches.filter(s => s[1] - s[0] > STORY.STILL_ERROR);
  for (const s of long) errors.push(stillMsg(s));
  if (!long.length && longest[1] - longest[0] > STORY.STILL_WARN) warnings.push(stillMsg(longest));

  // 3. Subject persistence: few scenes, and one prop (the subject) on screen for a good part of the video.
  const scenes = new Set(show.shots.map(s => (s.scene ? s.scene.first : s.index))).size;
  if (scenes > STORY.MAX_SCENES) {
    warnings.push({
      path: 'story.scenes', time: null,
      message: `this show has ${scenes} separate scenes (each shot without "continue" starts a new scene and environment); more than ${STORY.MAX_SCENES} feels like a slideshow of unrelated rooms.`,
      hint: 'Join shots that show the same subject with "continue": true (the next shot keeps the environment and the props, and only changes the camera).',
    });
  }
  const seen = new Map(); // "scene/prop" -> seconds on screen
  for (const g of grid) {
    const si = shotIndexAt(g.t), shot = show.shots[si];
    const scene = shot.scene ? shot.scene.first : shot.index;
    for (const p of shot.props) if (states[si].propAt(p.id, g.t).visible) {
      const key = `${show.shots[scene].id}/${p.id}`;
      seen.set(key, (seen.get(key) || 0) + STORY.STEP);
    }
  }
  let hero = { key: null, seconds: 0 };
  for (const [key, seconds] of seen) if (seconds > hero.seconds) hero = { key, seconds };
  const share = Math.min(1, hero.seconds / show.duration);
  if (share < STORY.HERO_SHARE) {
    const [scene, id] = (hero.key || '/').split('/');
    warnings.push({
      path: 'story.subject', time: null,
      message: `no prop stays on screen for ${Math.round(STORY.HERO_SHARE * 100)}% of the video${hero.key ? ` (the longest is "${id}" in the scene starting at shot "${scene}": ${fmt(hero.seconds)} s of ${fmt(show.duration)} s, ${Math.round(share * 100)}%)` : ''}.`,
      hint: 'Keep one subject on screen across several shots with "continue": true, and change it with each sentence (actions or a dial).',
    });
  }

  const measured = {
    sentences: sentences.length, uncovered, scenes,
    longestStill: { from: +fmt(longest[0]), to: +fmt(longest[1]), seconds: +fmt(longest[1] - longest[0]) },
    hero: { prop: hero.key, seconds: +fmt(hero.seconds), share: Math.round(share * 100) / 100 },
  };
  return { errors, warnings, measured };
}
