// Dials and bindings (SPEC §12). A dial is a show-level number that changes when words are spoken; a binding makes a
// prop or environment value follow a dial. Everything here is a pure function of t.
// Exports: DIAL_KEY_FIELDS, resolveDials(raw, words) -> { dials, errors }, dialAt(dial, t), isBinding(v),
//          checkBinding(v, target, path, dials) -> problems, bindingAt(b, dials, t) -> number | [x,y,z] | 0xRRGGBB,
//          colorText(n) -> '#rrggbb', dialMovingAt(dial, t) -> bool.
//
// Raw dial:      { "start": 0.1, "keys": [ { "at": "sit close together", "to": 0.06 }, ... ] }
// Resolved dial: { name, start, keys: [ { t0, to, over, ease, hold, path } ] }
// A key STARTS moving the dial at its "at" time and arrives at "to" when the next key starts (or after "over" seconds,
// or at "until"; the last key takes 1 s). Before the first key the dial is at "start". "hold": true jumps at once.

import { check, checkFields, nearest, problem } from './types.js';
import { resolveAnchor } from './anchors.js';
import { resolvePlace } from './places.js';
import { parseColor, wavelengthColor } from './palette.js';
import { clamp, lerp, lerp3, mixColor } from './tween.js';

const NAME_RE = /^[a-z][a-z0-9_-]*$/;
const LAST_KEY_OVER = 1;

export const DIAL_KEY_FIELDS = {
  at: { type: 'anchor', required: true, doc: 'when the dial starts moving to this key (searched from the previous key)' },
  to: { type: 'number', min: -1000, max: 1000, required: true, doc: 'the value it moves to' },
  over: { type: 'number', min: 0, max: 20, doc: 'seconds to get there (default: until the next key starts; the last key 1 s)' },
  until: { type: 'anchor', doc: 'arrive when this is spoken (instead of over)' },
  ease: { type: 'enum', values: ['smooth', 'linear'], default: 'smooth', doc: 'smooth = ease in and out; linear = steady' },
  hold: { type: 'bool', default: false, doc: 'true = jump to the value at "at" (a step, no ramp)' },
};

const didYouMean = (name, options) => { const n = nearest(name, options); return n ? `Did you mean "${n}"?` : ''; };

// Checks and resolves the top-level "dials" object. Unknown dials in bindings are caught later (checkBinding).
export function resolveDials(raw, words) {
  const errors = [], dials = {};
  if (raw === undefined) return { dials, errors };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    errors.push(problem('dials', 'must be an object of named dials: {"spacing": {"start": 0, "keys": [{"at": "spoken phrase", "to": 1}]}}.'));
    return { dials, errors };
  }
  for (const [name, d] of Object.entries(raw)) {
    const path = `dials.${name}`;
    if (!NAME_RE.test(name)) { errors.push(problem(path, `"${name}" is not a good dial name; use lower-case letters, digits, "_" or "-", starting with a letter (like "spacing").`)); continue; }
    const bad = checkFields(d, { start: { type: 'number', min: -1000, max: 1000, doc: 'value before the first key' } }, path, {}, { extra: ['keys'] });
    if (!bad.length && (!Array.isArray(d.keys) || d.keys.length === 0)) bad.push(problem(`${path}.keys`, '"keys" is required: a list of at least one {"at": "spoken phrase", "to": number}.'));
    if (bad.length) { errors.push(...bad); continue; }
    const out = { name, start: typeof d.start === 'number' ? d.start : 0, keys: [] };
    let prevT = 0, ok = true;
    d.keys.forEach((k, i) => {
      const kp = `${path}.keys[${i}]`;
      if (!ok) return;
      const probs = checkFields(k, DIAL_KEY_FIELDS, kp);
      if (probs.length) { errors.push(...probs); ok = false; return; }
      if (typeof k.at === 'object' && 'shot' in k.at) { errors.push(problem(`${kp}.at`, 'a dial belongs to the whole show, not a shot, so {"shot": ...} cannot be used; give a spoken phrase.')); ok = false; return; }
      const where = i === 0 ? 'the narration' : `the narration after key ${i - 1} of dial "${name}" (${prevT.toFixed(2)} s)`;
      // Searched from just after the previous key, so the same word keyed twice means its next occurrence.
      const r = resolveAnchor(k.at, { words, from: i === 0 ? 0 : prevT + 0.01, where });
      if (r.error) { errors.push(problem(`${kp}.at`, r.error)); ok = false; return; }
      if (r.t < prevT - 0.001) { // only possible with {"time": ...} or a negative "offset"
        errors.push(problem(`${kp}.at`, `resolves to ${r.t.toFixed(2)} s, before the previous key of dial "${name}" (${prevT.toFixed(2)} s). Dial keys must be in spoken order.`));
        ok = false; return;
      }
      if (k.hold && (k.over !== undefined || k.until !== undefined)) { errors.push(problem(`${kp}.hold`, '"hold": true jumps at once, so it takes no "over" or "until".')); ok = false; return; }
      if (k.over !== undefined && k.until !== undefined) { errors.push(problem(`${kp}.until`, 'give "over" (seconds) or "until" (a phrase), not both.')); ok = false; return; }
      const key = { t0: round3(r.t), to: k.to, over: null, ease: k.ease || 'smooth', hold: k.hold === true, path: kp };
      if (k.over !== undefined) key.over = k.over;
      if (k.until !== undefined) {
        const u = resolveAnchor(k.until, { words, from: key.t0, where: `the narration after ${key.t0.toFixed(2)} s` });
        if (u.error) { errors.push(problem(`${kp}.until`, u.error)); ok = false; return; }
        if (u.t <= key.t0) { errors.push(problem(`${kp}.until`, `resolves to ${u.t.toFixed(2)} s, which is not after "at" (${key.t0.toFixed(2)} s).`)); ok = false; return; }
        key.over = round3(u.t - key.t0);
      }
      out.keys.push(key);
      prevT = key.t0;
    });
    if (!ok) continue;
    // Default ramp: until the next key starts (the last key: LAST_KEY_OVER seconds).
    out.keys.forEach((k, i) => {
      if (k.hold) k.over = 0;
      else if (k.over === null) k.over = i + 1 < out.keys.length ? round3(out.keys[i + 1].t0 - k.t0) : LAST_KEY_OVER;
    });
    dials[name] = out;
  }
  return { dials, errors };
}

const round3 = x => Math.round(x * 1000) / 1000;
const smooth = k => k * k * (3 - 2 * k);

// Value of one key's ramp at t, starting from `from` at the key's time.
function keyValue(k, t, from) {
  if (t < k.t0) return from;
  if (k.hold || k.over <= 0) return k.to;
  const u = clamp((t - k.t0) / k.over);
  return lerp(from, k.to, k.ease === 'linear' ? u : smooth(u));
}

// The dial's value at t: fold the keys in order (each ramp starts from where the dial is when the key starts).
export function dialAt(dial, t) {
  let prev = null, from = dial.start;
  for (const k of dial.keys) {
    if (k.t0 > t) break;
    from = prev ? keyValue(prev, k.t0, from) : dial.start;
    prev = k;
  }
  return prev ? keyValue(prev, t, from) : dial.start;
}

// Is the dial changing at t? (inside a ramp, or within 0.3 s after a step, that really changes the value)
export function dialMovingAt(dial, t) {
  for (const k of dial.keys) {
    const end = k.t0 + Math.max(k.over, 0.3);
    if (t < k.t0 || t > end) continue;
    if (Math.abs(dialAt(dial, end) - dialAt(dial, k.t0 - 0.001)) > 1e-6) return true;
  }
  return false;
}

export const isBinding = v => !!v && typeof v === 'object' && !Array.isArray(v) && 'dial' in v;

// target: { kind: 'number', min, max } | { kind: 'color' } | { kind: 'place' }. dials: the resolved dials.
export function checkBinding(v, target, path, dials) {
  const names = Object.keys(dials);
  const allowed = target.kind === 'color' ? ['dial', 'from', 'colors'] : ['dial', 'from', 'to'];
  const out = [];
  for (const key of Object.keys(v)) {
    if (allowed.includes(key)) continue;
    const why = key === 'colors' ? ' ("colors" is for colour values; a number follows a dial with "to": [low, high])'
      : key === 'to' ? ' (a colour follows a dial with "colors": ["#hex", ...] or "spectrum")' : '';
    out.push(problem(`${path}.${key}`, `"${key}" is not a binding field here${why}. A binding is ${target.kind === 'color' ? '{"dial": name, "from": [0, 1], "colors": [...] or "spectrum"}' : '{"dial": name, "from": [0, 1], "to": [low, high]}'}.`, didYouMean(key, allowed)));
  }
  if (typeof v.dial !== 'string' || !dials[v.dial]) {
    const msg = names.length ? `${JSON.stringify(v.dial)} is not a dial (dials in this show: ${names.join(', ')}).`
      : `${JSON.stringify(v.dial)} is not a dial: this show has no "dials". Add a top-level "dials": {"${typeof v.dial === 'string' ? v.dial : 'name'}": {"start": 0, "keys": [{"at": "spoken phrase", "to": 1}]}}.`;
    out.push(problem(`${path}.dial`, msg, didYouMean(v.dial, names)));
  }
  if (v.from !== undefined) {
    const ok = Array.isArray(v.from) && v.from.length === 2 && v.from.every(n => typeof n === 'number' && Number.isFinite(n)) && v.from[0] !== v.from[1];
    if (!ok) out.push(problem(`${path}.from`, `${JSON.stringify(v.from)} must be two different numbers [dial value for the first end, dial value for the last end], like [0, 1].`));
  }
  if (target.kind === 'color') {
    if (v.colors === undefined) out.push(problem(`${path}.colors`, '"colors" is required: a list of 2 or more colours (spread evenly over the dial range), or "spectrum" (blue to red).'));
    else if (v.colors !== 'spectrum') {
      if (!Array.isArray(v.colors) || v.colors.length < 2) out.push(problem(`${path}.colors`, `${JSON.stringify(v.colors)} must be a list of 2 or more colours, or "spectrum".`));
      else v.colors.forEach((c, i) => out.push(...check(c, { type: 'color' }, `${path}.colors[${i}]`)));
    }
  } else if (v.to === undefined) {
    out.push(problem(`${path}.to`, `"to" is required: [value at the low end, value at the high end]${target.kind === 'place' ? ', each a slot or [x, y, z]' : ` (allowed: ${target.min}..${target.max})`}.`));
  } else if (!Array.isArray(v.to) || v.to.length !== 2) {
    out.push(problem(`${path}.to`, `${JSON.stringify(v.to)} must be a pair [low end, high end].`));
  } else {
    const spec = target.kind === 'place' ? { type: 'place' } : { type: 'number', min: target.min, max: target.max };
    v.to.forEach((x, i) => out.push(...check(x, spec, `${path}.to[${i}]`)));
  }
  return out;
}

// How far (0..1) the dial is through the binding's "from" range at t.
function amount(b, dials, t) {
  const [lo, hi] = b.from || [0, 1];
  return clamp((dialAt(dials[b.dial], t) - lo) / (hi - lo));
}

// The bound value at t: a number, an [x, y, z] (place) or a 0xRRGGBB colour.
export function bindingAt(b, dials, t) {
  const u = amount(b, dials, t);
  if (b.colors === 'spectrum') return parseColor(wavelengthColor(u));
  if (Array.isArray(b.colors)) {
    const x = u * (b.colors.length - 1), i = Math.min(b.colors.length - 2, Math.floor(x));
    return mixColor(parseColor(b.colors[i]) ?? 0xffffff, parseColor(b.colors[i + 1]) ?? 0xffffff, x - i);
  }
  if (typeof b.to[0] === 'number') return lerp(b.to[0], b.to[1], u);
  return lerp3(resolvePlace(b.to[0]), resolvePlace(b.to[1]), u);
}

export const colorText = n => '#' + n.toString(16).padStart(6, '0');
