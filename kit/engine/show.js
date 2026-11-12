// Show loading: checks a show.json against the catalogue and the words, and resolves it (anchors -> seconds,
// shots -> time windows, props and actions with defaults filled in). Used by the page AND by the Node tools.
// Exports: resolveShow(raw, words, catalog) -> { show, errors, warnings }, formatProblem(p, level), checkWords(words),
//          PROP_COMMON_FIELDS (fields every prop has).
// errors/warnings are lists of { path, message, hint }. If errors is not empty, `show` must not be played.
//
// The resolved show: { title, duration, tail, accent, voice, words, shots: [shot] } where shot is
//   { id, index, start, end, env: { type, params, ground }, props: [prop], camera: {...}, transition, actions: [action] }
//   prop:   { id, type, at: [x,y,z], size, rotate: [x,y,z] deg, startsHidden, floats, stageSpace, params }
//   action: { do, t0, over, until, prop, ...fields with defaults, path }  (sorted by t0)

import { check, checkFields, nearest, problem } from './types.js';
import { resolveAnchor } from './anchors.js';
import { resolvePlace } from './places.js';
import { DEFAULT_ACCENT } from './palette.js';
import { CAMERA_FIELDS } from './camera.js';
import { COMMON_FIELDS } from '../actions/actions.js';

const MIN_SHOT = 1.5, MAX_SHOT = 12, LONG_SHOT = 9, DEFAULT_TAIL = 0.4;
const TOP_FIELDS = ['format', 'title', 'voice', 'style', 'tail', 'shots'];
const SHOT_FIELDS = ['id', 'start', 'env', 'props', 'camera', 'transition', 'actions'];
const PROP_FIELDS = {
  id: { type: 'string', max: 40, required: true, doc: 'unique id in this shot (a-z, 0-9, dashes)' },
  type: { type: 'string', required: true, doc: 'which prop from the catalogue' },
  at: { type: 'place', default: 'center', doc: 'where it stands' },
  size: { type: 'number', min: 0.05, max: 6, default: 1, doc: 'size (1 = fits a unit box)' },
  rotate: { type: 'list', of: { type: 'number', min: -360, max: 360 }, min: 3, max: 3, default: [0, 0, 0], doc: 'turn [x, y, z] in degrees' },
  hidden: { type: 'bool', default: false, doc: 'start hidden' },
};
export const PROP_COMMON_FIELDS = PROP_FIELDS;
const ID_RE = /^[a-z0-9][a-z0-9-]*$/;

export const formatProblem = (p, level = 'ERROR') => `${level} ${p.path}: ${p.message}${p.hint ? ' ' + p.hint : ''}`;

// words.json must be a list of { text, start, end } in spoken order.
export function checkWords(words) {
  if (!Array.isArray(words) || words.length === 0) return [problem('words', 'words.json must be a non-empty list of {"text", "start", "end"}.')];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (!w || typeof w.text !== 'string' || typeof w.start !== 'number' || typeof w.end !== 'number' || w.end < w.start) {
      return [problem(`words[${i}]`, `${JSON.stringify(w)} must be {"text": "...", "start": seconds, "end": seconds} with end >= start.`)];
    }
    if (i > 0 && w.start < words[i - 1].start) return [problem(`words[${i}]`, `starts at ${w.start} s, before the word before it (${words[i - 1].start} s). Words must be in spoken order.`)];
  }
  return [];
}

export function resolveShow(raw, words, catalog) {
  const errors = [], warnings = [];
  const err = (path, message, hint) => errors.push(problem(path, message, hint));
  const warn = (path, message, hint) => warnings.push(problem(path, message, hint));
  errors.push(...checkWords(words));
  if (errors.length) return { show: null, errors, warnings };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) { err('show', 'show.json must be an object { ... }.'); return { show: null, errors, warnings }; }

  for (const key of Object.keys(raw)) {
    if (!TOP_FIELDS.includes(key)) err(key, `"${key}" is not a top-level field (allowed: ${TOP_FIELDS.join(', ')}).`, hintFor(key, TOP_FIELDS));
  }
  if (raw.format !== 1) err('format', `must be 1 (you gave ${JSON.stringify(raw.format)}).`);
  errors.push(...check(raw.title, { type: 'string', max: 100 }, 'title'));
  errors.push(...checkFields(raw.voice, { audio: { type: 'string', required: true }, words: { type: 'string', required: true } }, 'voice'));
  if (raw.style !== undefined) errors.push(...checkFields(raw.style, { accent: { type: 'color' } }, 'style'));
  if (raw.tail !== undefined) errors.push(...check(raw.tail, { type: 'number', min: 0, max: 3 }, 'tail'));
  if (!Array.isArray(raw.shots) || raw.shots.length === 0) { err('shots', 'must be a non-empty list of shots.'); return { show: null, errors, warnings }; }

  const tail = typeof raw.tail === 'number' ? raw.tail : DEFAULT_TAIL;
  const duration = round3(words[words.length - 1].end + tail);

  // 1. Shot starts, then windows (each shot runs to the next shot's start).
  const starts = [];
  raw.shots.forEach((s, i) => {
    const path = `shots[${i}]`;
    const from = i > 0 && Number.isFinite(starts[i - 1]) ? starts[i - 1] : 0;
    if (s === null || typeof s !== 'object' || Array.isArray(s)) { err(path, 'must be a shot object { "id": ..., "start": ..., ... }.'); starts.push(from); return; }
    if (s.start === undefined) {
      if (i > 0) err(`${path}.start`, `"start" is required for every shot after the first (the phrase where this shot begins).`);
      starts.push(i === 0 ? 0 : from);
      return;
    }
    const shapeProblems = check(s.start, { type: 'anchor' }, `${path}.start`);
    if (shapeProblems.length) { errors.push(...shapeProblems); starts.push(from); return; }
    const r = resolveAnchor(s.start, { words, from, where: `shot "${s.id}" (searching from the previous shot's start)`, shot: null });
    if (r.error) { err(`${path}.start`, r.error); starts.push(from); return; }
    starts.push(i === 0 ? 0 : r.t); // the first shot always starts at 0 (its start phrase is only checked)
  });
  const ends = starts.map((_, i) => (i + 1 < starts.length ? starts[i + 1] : duration));
  starts.forEach((t, i) => {
    const len = ends[i] - t, path = `shots[${i}].start`;
    if (i > 0 && t <= starts[i - 1]) err(path, `starts at ${t.toFixed(2)} s, which is not after the previous shot's start (${starts[i - 1].toFixed(2)} s). Shot starts must increase.`);
    else if (len < MIN_SHOT) err(path, `shot "${raw.shots[i].id}" lasts ${len.toFixed(2)} s (${t.toFixed(2)}-${ends[i].toFixed(2)}); the shortest allowed is ${MIN_SHOT} s. Merge it with a neighbour or move a start.`);
    else if (len > MAX_SHOT) err(path, `shot "${raw.shots[i].id}" lasts ${len.toFixed(2)} s (${t.toFixed(2)}-${ends[i].toFixed(2)}); the longest allowed is ${MAX_SHOT} s. Split it into two shots.`);
    else if (len > LONG_SHOT) warn(path, `shot "${raw.shots[i].id}" lasts ${len.toFixed(2)} s; shots over ${LONG_SHOT} s feel slow. Consider splitting it.`);
  });

  // 2. Each shot's contents.
  const ids = new Set();
  const shots = raw.shots.map((s, i) => {
    if (s === null || typeof s !== 'object' || Array.isArray(s)) return null;
    const path = `shots[${i}]`;
    for (const key of Object.keys(s)) if (!SHOT_FIELDS.includes(key)) err(`${path}.${key}`, `"${key}" is not a shot field (allowed: ${SHOT_FIELDS.join(', ')}).`, hintFor(key, SHOT_FIELDS));
    if (typeof s.id !== 'string' || !ID_RE.test(s.id)) err(`${path}.id`, `${JSON.stringify(s.id)} must be a short id of a-z, 0-9 and dashes, like "calm-earth".`);
    else if (ids.has(s.id)) err(`${path}.id`, `"${s.id}" is used by two shots; shot ids must be unique.`);
    ids.add(s.id);
    const shot = { id: s.id, index: i, start: round3(starts[i]), end: round3(ends[i]) };
    shot.env = resolveEnv(s.env, `${path}.env`, catalog, errors);
    shot.props = resolveProps(s.props, `${path}.props`, catalog, errors);
    const propIds = shot.props.map(p => p.id);
    const ctx = { propIds };
    if (s.camera !== undefined) errors.push(...checkFields(s.camera, CAMERA_FIELDS, `${path}.camera`, ctx));
    shot.camera = withDefaults(CAMERA_FIELDS, s.camera || {});
    if (s.transition !== undefined) errors.push(...check(s.transition, { type: 'enum', values: ['cut', 'dip'] }, `${path}.transition`));
    shot.transition = s.transition === 'dip' ? 'dip' : 'cut';
    shot.actions = resolveActions(s.actions, path, shot, words, catalog, errors, warnings);
    // A prop whose first presence action is "appear" starts hidden (SPEC §5).
    for (const p of shot.props) {
      const first = shot.actions.find(a => a.prop === p.id && (a.do === 'appear' || a.do === 'disappear'));
      p.startsHidden = p.hidden || (first !== undefined && first.do === 'appear');
    }
    if (shot.props.length === 0) warn(`${path}.props`, 'this shot has no props; the camera will frame an empty stage.');
    return shot;
  }).filter(Boolean);

  const accent = (raw.style && raw.style.accent) || DEFAULT_ACCENT;
  // The colour name "accent" means this show's accent colour: replace it once here, so every later step agrees.
  for (const shot of shots) {
    for (const p of shot.props) for (const [k, v] of Object.entries(p.params)) if (v === 'accent') p.params[k] = accent;
    for (const a of shot.actions) for (const [k, v] of Object.entries(a)) if (v === 'accent' && k !== 'do') a[k] = accent;
  }
  const show = { title: raw.title, duration, tail, voice: raw.voice, words, accent, shots };
  return { show: errors.length ? null : show, errors, warnings };
}

const round3 = x => Math.round(x * 1000) / 1000;
const hintFor = (name, options) => { const n = nearest(name, options); return n ? `Did you mean "${n}"?` : ''; };

function withDefaults(specs, given) {
  const out = {};
  for (const [k, spec] of Object.entries(specs)) out[k] = given[k] !== undefined ? given[k] : (spec.default === undefined ? null : spec.default);
  return out;
}

function resolveEnv(env, path, catalog, errors) {
  const names = Object.keys(catalog.envs);
  if (env === undefined) { errors.push(problem(path, `"env" is required (one of: ${names.join(', ')}).`)); return null; }
  const given = typeof env === 'string' ? { type: env } : env;
  if (!given || typeof given !== 'object' || typeof given.type !== 'string') { errors.push(problem(path, `must be an environment name (${names.join(', ')}) or {"type": name, ...params}.`)); return null; }
  const mod = catalog.envs[given.type];
  if (!mod) { errors.push(problem(`${path}.type`, `"${given.type}" is not an environment (allowed: ${names.join(', ')}).`, hintFor(given.type, names))); return null; }
  errors.push(...checkFields(given, mod.meta.params, path, {}, { extra: ['type'] }));
  const { type, ...rest } = given;
  const params = withDefaults(mod.meta.params, rest);
  // ground: is there a floor at y = 0 that props stand on? (a boolean, or a function of the env's params)
  const ground = typeof mod.meta.ground === 'function' ? !!mod.meta.ground(params) : !!mod.meta.ground;
  return { type, params, ground };
}

function resolveProps(list, path, catalog, errors) {
  if (list === undefined) return [];
  if (!Array.isArray(list)) { errors.push(problem(path, 'must be a list of props [ {...}, ... ].')); return []; }
  const names = Object.keys(catalog.props), seen = new Set(), out = [];
  list.forEach((p, i) => {
    const pp = `${path}[${i}]`;
    if (!p || typeof p !== 'object' || Array.isArray(p)) { errors.push(problem(pp, 'must be a prop object {"id": ..., "type": ...}.')); return; }
    if (typeof p.id !== 'string' || !ID_RE.test(p.id)) { errors.push(problem(`${pp}.id`, `${JSON.stringify(p.id)} must be a short id of a-z, 0-9 and dashes, like "moon".`)); return; }
    if (seen.has(p.id)) { errors.push(problem(`${pp}.id`, `"${p.id}" is used twice in this shot; prop ids must be unique within a shot.`)); return; }
    seen.add(p.id);
    const mod = catalog.props[p.type];
    if (!mod) { errors.push(problem(`${pp}.type`, `${JSON.stringify(p.type)} is not a prop (allowed: ${names.join(', ')}).`, hintFor(p.type, names))); return; }
    const meta = mod.meta;
    const own = { ...meta.params };
    for (const [k, a] of Object.entries(meta.animatable || {})) own[k] = { type: 'number', min: a.min, max: a.max, default: a.default, doc: a.doc };
    const common = meta.stageSpace ? { id: PROP_FIELDS.id, type: PROP_FIELDS.type, hidden: PROP_FIELDS.hidden } : PROP_FIELDS;
    out.push({ raw: p, pp, meta, own, common });
  });
  const propIds = out.map(o => o.raw.id);
  return out.map(({ raw: p, pp, meta, own, common }) => {
    const specs = { ...common, ...own };
    const problems = checkFields(p, specs, pp, { propIds });
    if (meta.stageSpace) {
      for (const f of ['at', 'size', 'rotate']) {
        const i = problems.findIndex(q => q.path === `${pp}.${f}`);
        if (i >= 0) problems[i] = problem(`${pp}.${f}`, `"${p.type}" is drawn between its own points (${Object.keys(meta.params).filter(k => meta.params[k].type === 'point').join(', ')}), so it has no "${f}".`);
      }
    }
    for (const [k, spec] of Object.entries(own)) {
      if (spec.type !== 'point' || typeof p[k] !== 'string') continue;
      if (p[k] === p.id) problems.push(problem(`${pp}.${k}`, `a prop cannot point at itself.`));
      const target = out.find(o => o.raw.id === p[k]);
      if (target && target.meta.stageSpace) problems.push(problem(`${pp}.${k}`, `"${p[k]}" is a ${target.raw.type}, which has no single position; point at a slot, [x, y, z] or a solid prop.`));
    }
    errors.push(...problems);
    const params = withDefaults(own, p);
    return {
      id: p.id, type: p.type, at: resolvePlace(p.at ?? 'center') || [0, 0, 0], size: typeof p.size === 'number' ? p.size : 1,
      rotate: Array.isArray(p.rotate) && p.rotate.length === 3 ? p.rotate.slice() : [0, 0, 0],
      hidden: p.hidden === true, floats: !!meta.floats, stageSpace: !!meta.stageSpace, params,
    };
  });
}

function resolveActions(list, shotPath, shot, words, catalog, errors, warnings) {
  if (list === undefined) return [];
  const path = `${shotPath}.actions`;
  if (!Array.isArray(list)) { errors.push(problem(path, 'must be a list of actions [ {...}, ... ].')); return []; }
  const names = Object.keys(catalog.actions);
  const propIds = shot.props.map(p => p.id), byId = new Map(shot.props.map(p => [p.id, p]));
  const where = `shot "${shot.id}" (${shot.start.toFixed(2)}-${shot.end.toFixed(2)} s)`;
  const out = [];
  list.forEach((a, i) => {
    const ap = `${path}[${i}]`;
    if (!a || typeof a !== 'object' || Array.isArray(a)) { errors.push(problem(ap, 'must be an action object {"at": ..., "do": ...}.')); return; }
    const entry = catalog.actions[a.do];
    if (!entry) { errors.push(problem(`${ap}.do`, `${JSON.stringify(a.do)} is not an action (allowed: ${names.join(', ')}).`, hintFor(a.do, names))); return; }
    const specs = { at: COMMON_FIELDS.at, do: COMMON_FIELDS.do, ...entry.fields };
    if (entry.prop !== 'none') specs.prop = { ...COMMON_FIELDS.prop, required: entry.prop === 'required' };
    if (entry.over > 0) specs.over = COMMON_FIELDS.over;
    const before = errors.length;
    errors.push(...checkFields(a, specs, ap, { propIds }));
    if (errors.length > before) return;

    // Time: at or after the shot start, before the shot end.
    const r = resolveAnchor(a.at, { words, from: shot.start, until: shot.end, shot, where });
    if (r.error) { errors.push(problem(`${ap}.at`, r.error)); return; }
    if (r.t < shot.start - 0.001 || r.t >= shot.end) {
      const phrase = typeof a.at === 'string' ? a.at : a.at.phrase;
      const msg = phrase !== undefined && r.t >= shot.end
        ? `"${phrase}" is not spoken inside ${where}; the next time it is spoken is ${r.t.toFixed(2)} s, after this shot ends. Pick words from this shot: ${wordsIn(words, shot)}`
        : `resolves to ${r.t.toFixed(2)} s, outside ${where}. An action must happen inside its shot. Words spoken in this shot: ${wordsIn(words, shot)}`;
      errors.push(problem(`${ap}.at`, msg));
      return;
    }
    const res = { do: a.do, t0: round3(r.t), over: a.over ?? entry.over, prop: a.prop ?? null, path: ap };
    for (const [k, spec] of Object.entries(entry.fields)) res[k] = a[k] !== undefined ? a[k] : (spec.default === undefined ? null : spec.default);
    res.until = shot.end;
    if (a.until !== undefined) {
      const u = resolveAnchor(a.until, { words, from: shot.start, until: shot.end, shot, where });
      if (u.error) { errors.push(problem(`${ap}.until`, u.error)); return; }
      if (u.t <= res.t0) { errors.push(problem(`${ap}.until`, `resolves to ${u.t.toFixed(2)} s, which is not after "at" (${res.t0.toFixed(2)} s).`)); return; }
      if (u.t > shot.end) warnings.push(problem(`${ap}.until`, `resolves to ${u.t.toFixed(2)} s, after the shot ends (${shot.end.toFixed(2)} s); it will end with the shot.`));
      res.until = Math.min(round3(u.t), shot.end);
    }
    // Rules that depend on the prop.
    const prop = res.prop ? byId.get(res.prop) : null;
    if (prop && entry.placedOnly && prop.stageSpace) {
      errors.push(problem(`${ap}.do`, `"${a.do}" moves or turns a prop, but "${prop.id}" (${prop.type}) is drawn between its points, so it cannot ${a.do}. Animate its params with "set" instead.`));
      return;
    }
    if (a.do === 'set' && prop) {
      const anim = catalog.props[prop.type].meta.animatable || {};
      const okNames = Object.keys(anim);
      if (!anim[res.param]) {
        errors.push(problem(`${ap}.param`, `"${res.param}" is not an animatable param of ${prop.type} (animatable: ${okNames.join(', ') || 'none'}).`, hintFor(res.param, okNames)));
        return;
      }
      const spec = { type: 'number', min: anim[res.param].min, max: anim[res.param].max };
      const bad = check(res.to, spec, `${ap}.to`);
      if (bad.length) { errors.push(...bad); return; }
    }
    if (entry.validate) {
      const bad = entry.validate(res, { shot });
      if (bad.length) { for (const b of bad) errors.push(problem(`${ap}.${b.field}`, b.message, b.hint || '')); return; }
    }
    if (res.t0 + res.over > shot.end + 0.001 && entry.kind === 'channel') {
      warnings.push(problem(`${ap}.over`, `the ${a.do} lasts ${res.over} s but the shot ends ${(shot.end - res.t0).toFixed(2)} s after it starts; it will be cut off.`));
    }
    out.push(res);
  });
  return out.sort((x, y) => x.t0 - y.t0);
}

const wordsIn = (words, shot) => words.filter(w => w.start >= shot.start - 0.005 && w.start < shot.end).map(w => `${w.text} (${w.start.toFixed(2)})`).join(' ') || '(no words)';
