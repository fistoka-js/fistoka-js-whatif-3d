// The type checker for show fields. Every catalogue param, action field and camera field has a type spec here.
// Exports: check(value, spec, path, ctx) -> problems, checkFields(obj, specs, path, ctx, opts) -> problems,
//          nearest(name, options) -> closest name or null, describe(spec) -> short text, problem(path, message, hint).
// A problem is { path, message, hint }. Messages are read by people AND by an LLM repairing its own show,
// so each one says what was given, what is allowed, and (hint) the nearest valid name.
//
// Type specs: { type: 'number', min, max } | { type: 'int', min, max } | { type: 'bool' } | { type: 'color' }
//   | { type: 'enum', values: [...] } | { type: 'string', max } | { type: 'place' } (slot or [x,y,z])
//   | { type: 'point' } (slot, [x,y,z] or a prop id in this shot) | { type: 'anchor' } | { type: 'propId' }
//   | { type: 'list', of: <spec>, min, max }.  Any spec may also have default, doc, required.

import { PALETTE, parseColor } from './palette.js';
import { SLOTS } from './places.js';
import { anchorShapeProblem } from './anchors.js';

export const problem = (path, message, hint = '') => ({ path, message, hint });

// Edit distance between two short strings.
function distance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return d[a.length][b.length];
}

// The closest option to `name`, or null if nothing is close enough to be a likely typo.
export function nearest(name, options) {
  if (typeof name !== 'string' || !options.length) return null;
  const n = name.toLowerCase().replace(/[\s_]/g, '-');
  let best = null, bestD = Infinity;
  for (const o of options) {
    const oo = String(o).toLowerCase().replace(/[\s_]/g, '-');
    let d = distance(n, oo);
    // A clear prefix ("rot" for "rotate") counts as close, but a true near-spelling still wins a tie.
    if (Math.min(n.length, oo.length) >= 3 && (oo.startsWith(n) || n.startsWith(oo))) d = Math.min(d, 1.5);
    if (d < bestD) { best = o; bestD = d; }
  }
  return bestD <= Math.max(2, Math.floor(name.length / 3)) ? best : null;
}

const didYouMean = (name, options) => {
  const n = nearest(name, options);
  return n === null ? '' : `Did you mean "${n}"?`;
};
const show = v => (typeof v === 'string' ? `"${v}"` : JSON.stringify(v));
const list = values => values.map(v => `"${v}"`).join(', ');

// Short text for a spec, used in messages and in the generated catalogue.
export function describe(spec) {
  switch (spec.type) {
    case 'number': return `number ${spec.min ?? '-inf'}..${spec.max ?? 'inf'}`;
    case 'int': return `whole number ${spec.min ?? '-inf'}..${spec.max ?? 'inf'}`;
    case 'bool': return 'true or false';
    case 'color': return 'colour (#rrggbb or a name: ' + Object.keys(PALETTE).join(', ') + ')';
    case 'enum': return 'one of: ' + spec.values.join(' | ');
    case 'string': return `text (up to ${spec.max ?? 200} characters)`;
    case 'place': return 'place: a slot (' + Object.keys(SLOTS).join(', ') + ') or [x, y, z]';
    case 'point': return 'point: a slot, [x, y, z], or the id of a prop in this shot';
    case 'anchor': return 'anchor: "spoken phrase" | {phrase, edge, offset} | {time} | {shot}';
    case 'propId': return 'the id of a prop in this shot';
    case 'list': return 'list of ' + describe(spec.of);
    default: return spec.type;
  }
}

// Checks one value. ctx.propIds lists the prop ids of the current shot (for propId and point).
export function check(value, spec, path, ctx = {}) {
  const propIds = ctx.propIds || [];
  const bad = (msg, hint = '') => [problem(path, msg, hint)];
  switch (spec.type) {
    case 'number':
    case 'int': {
      if (typeof value !== 'number' || !Number.isFinite(value)) return bad(`${show(value)} is not a number (allowed: ${describe(spec)}).`);
      if (spec.type === 'int' && !Number.isInteger(value)) return bad(`${value} must be a whole number (allowed: ${describe(spec)}).`);
      if (spec.min !== undefined && value < spec.min) return bad(`${value} is too small (allowed: ${describe(spec)}).`);
      if (spec.max !== undefined && value > spec.max) return bad(`${value} is too big (allowed: ${describe(spec)}).`);
      return [];
    }
    case 'bool':
      return typeof value === 'boolean' ? [] : bad(`${show(value)} must be true or false.`);
    case 'color':
      if (parseColor(value) !== null) return [];
      return bad(`${show(value)} is not a colour. Use "#rrggbb", "#rgb" or a name: ${Object.keys(PALETTE).join(', ')}.`,
        didYouMean(value, Object.keys(PALETTE)));
    case 'enum':
      if (spec.values.includes(value)) return [];
      return bad(`${show(value)} is not allowed here (allowed: ${list(spec.values)}).`, didYouMean(value, spec.values));
    case 'string': {
      if (typeof value !== 'string' || !value.trim()) return bad(`${show(value)} must be some text.`);
      const max = spec.max ?? 200;
      return value.length > max ? bad(`text is ${value.length} characters; the most allowed is ${max}. Shorten it.`) : [];
    }
    case 'place':
      return checkPlace(value, path, false, propIds);
    case 'point':
      return checkPlace(value, path, true, propIds);
    case 'anchor': {
      const msg = anchorShapeProblem(value);
      return msg ? bad(msg) : [];
    }
    case 'propId':
      if (typeof value === 'string' && propIds.includes(value)) return [];
      return bad(`${show(value)} is not a prop in this shot (props here: ${propIds.join(', ') || 'none'}).`, didYouMean(value, propIds));
    case 'list': {
      if (!Array.isArray(value)) return bad(`${show(value)} must be a list [ ... ] of ${describe(spec.of)}.`);
      if (spec.min !== undefined && value.length < spec.min) return bad(`the list needs at least ${spec.min} item(s); it has ${value.length}.`);
      if (spec.max !== undefined && value.length > spec.max) return bad(`the list may have at most ${spec.max} items; it has ${value.length}.`);
      return value.flatMap((v, i) => check(v, spec.of, `${path}[${i}]`, ctx));
    }
    default:
      return bad(`internal: unknown type "${spec.type}" in the catalogue.`);
  }
}

function checkPlace(value, path, allowProp, propIds) {
  if (Array.isArray(value)) {
    if (value.length === 3 && value.every(n => typeof n === 'number' && Number.isFinite(n))) {
      if (value.some(n => Math.abs(n) > 20)) return [problem(path, `${show(value)} is very far from the stage (each number should be about -3..3).`)];
      return [];
    }
    return [problem(path, `${show(value)} must be three numbers [x, y, z].`)];
  }
  if (typeof value === 'string') {
    if (SLOTS[value]) return [];
    if (allowProp && propIds.includes(value)) return [];
    const options = Object.keys(SLOTS).concat(allowProp ? propIds : []);
    const what = allowProp ? `a slot (${Object.keys(SLOTS).join(', ')}) or a prop id here (${propIds.join(', ') || 'none'})`
      : `a slot (${Object.keys(SLOTS).join(', ')})`;
    return [problem(path, `"${value}" is not ${what}.`, didYouMean(value, options))];
  }
  return [problem(path, `${show(value)} must be a slot name or [x, y, z].`)];
}

// Checks an object's fields against a map of specs: unknown fields (with a "did you mean"), missing required
// fields, then each value. opts.extra lists field names that are allowed but checked elsewhere.
export function checkFields(obj, specs, path, ctx = {}, opts = {}) {
  const out = [];
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return [problem(path, `${show(obj)} must be an object { ... }.`)];
  const extra = opts.extra || [];
  const allowed = Object.keys(specs).concat(extra);
  for (const key of Object.keys(obj)) {
    if (!allowed.includes(key)) {
      out.push(problem(`${path}.${key}`, `"${key}" is not a field here (allowed: ${allowed.join(', ')}).`, didYouMean(key, allowed)));
    }
  }
  for (const [key, spec] of Object.entries(specs)) {
    if (obj[key] === undefined || obj[key] === null) {
      if (spec.required) out.push(problem(`${path}.${key}`, `"${key}" is required (${describe(spec)}).`));
      continue;
    }
    out.push(...check(obj[key], spec, `${path}.${key}`, ctx));
  }
  return out;
}
