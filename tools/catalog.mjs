// Writes the catalogue in two forms, both generated from the `meta` objects (never edit them by hand):
//   docs/CATALOG.md   for people
//   kit/catalog.json  compact, for the LLM prompt that writes shows
// Usage: node tools/catalog.mjs
// Exports: catalogData() -> object (the JSON), catalogMarkdown(data) -> text.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { catalog } from '../kit/engine/registry.js';
import { CAMERA_DOCS } from '../kit/engine/camera.js';
import { PROP_COMMON_FIELDS } from '../kit/engine/show.js';
import { SLOTS } from '../kit/engine/places.js';
import { PALETTE } from '../kit/engine/palette.js';
import { describe } from '../kit/engine/types.js';
import { COMMON_FIELDS } from '../kit/actions/actions.js';
import { DIAL_KEY_FIELDS } from '../kit/engine/dials.js';

// The show-level features (SPEC §12, §13), one compact text each, for the prompt and the docs.
export const FEATURES = {
  dials: 'Top-level "dials": named numbers that change when words are spoken, e.g. {"spacing": {"start": 0, "keys": [{"at": "sit close", "to": 0.2}, {"at": "spread apart", "to": 1}]}}. A key starts moving the dial at its phrase and arrives when the next key starts (or after "over" s, or at "until"; the last key takes 1 s). Before the first key the dial is at "start". Keys are searched in spoken order.',
  bindings: 'Instead of a plain value, a prop\'s animatable param, "color", "glow", "size" or "at" (and an environment param listed under dialParams) may follow a dial. Numbers: {"dial": "spacing", "from": [0, 1], "to": [0.4, 1.6]}; "at": {"dial": "d", "to": ["left", "right"]}; colours: {"dial": "spacing", "colors": ["#35c6e8", "#ffe14d", "#ff3b3b"]} (evenly spaced) or "colors": "spectrum" (blue to red). "from" (default [0, 1]) is the dial range mapped onto "to"/"colors". Bind one dial to several things so they change together. A bound value cannot also be changed by an action.',
  continue: 'A shot with "continue": true keeps the scene of the shot before it: the same environment (give no "env") and the same props in their current state. It gives a new "camera", may add props and actions, and its actions may use the earlier props. Its camera frames the props visible in it unless "focus" is given. Use it to keep one subject on screen while the camera changes.',
};

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// A field spec in compact form: { type, values?, min?, max?, default?, required?, doc }.
function field(spec) {
  const out = { type: spec.type };
  for (const k of ['values', 'min', 'max']) if (spec[k] !== undefined) out[k] = spec[k];
  if (spec.of) out.of = field(spec.of);
  if (spec.default !== undefined && spec.default !== null) out.default = spec.default;
  if (spec.required) out.required = true;
  if (spec.doc) out.doc = spec.doc;
  return out;
}
const fields = specs => Object.fromEntries(Object.entries(specs).map(([k, v]) => [k, field(v)]));

// What the writer can see INTO (read from each prop's materials and geometry). Particles go inside only a see-through
// prop or the open part of a cutaway; inside a solid prop they are hidden. open = nothing to put inside.
const S = 'see-through', X = 'solid';
export const INSIDE = {
  ...Object.fromEntries(['particles', 'atom', 'lattice', 'lightbulb', 'thermometer', 'cell', 'shield_dome'].map(k => [k, S])),
  ...Object.fromEntries(['arrow', 'beam', 'wire', 'wave', 'light_wave', 'lightning', 'ring', 'galaxy', 'dna', 'crowd', 'scale_balance', 'molecule', 'bomb_blast'].map(k => [k, 'open'])),
  layer_stack: 'cutaway: top 3 slabs are glassy (particles show through), bottom 2 are solid; keep particles in the top 3',
  iceberg: 'cutaway: the ice is solid; put particles in the see-through water volume',
  terrain: 'cutaway: only the soil edge shows; put particles on or just above the surface',
  volcano: 'cutaway: only the crater at the top shows; start particles in the crater',
  magma_chamber: 'cutaway: cut face shows chamber and vent; put particles on or just in front of the face (z a little above 0), never behind it',
  ...Object.fromEntries(['ball', 'box', 'planet', 'sun', 'magnet', 'black_hole', 'asteroid', 'comet', 'rocket', 'satellite', 'cloud', 'tree', 'city',
    'house', 'rock', 'island', 'fire', 'water_drop', 'crystal', 'person', 'chameleon', 'brain', 'heart', 'eye', 'virus', 'fish', 'bird',
    'skeleton_bone', 'dinosaur', 'car', 'plane', 'ship', 'submarine', 'battery', 'clock', 'bars', 'gauge', 'coin_stack', 'phone', 'gear', 'tuner',
    'mountain', 'marshmallow'].map(k => [k, X])),
};

export function catalogData() {
  const props = {}, envs = {}, actions = {};
  for (const [name, mod] of Object.entries(catalog.props)) {
    const m = mod.meta;
    props[name] = {
      summary: m.summary, ...(INSIDE[name] ? { inside: INSIDE[name] } : {}), ...(m.notes ? { notes: m.notes } : {}), floats: !!m.floats, ...(m.stageSpace ? { stageSpace: true } : {}),
      params: fields(m.params),
      animatable: Object.fromEntries(Object.entries(m.animatable || {}).map(([k, a]) => [k, { min: a.min, max: a.max, default: a.default, doc: a.doc }])),
    };
  }
  for (const [name, mod] of Object.entries(catalog.envs)) {
    envs[name] = { summary: mod.meta.summary, ...(mod.meta.notes ? { notes: mod.meta.notes } : {}), params: fields(mod.meta.params), ...(mod.meta.dialParams ? { dialParams: mod.meta.dialParams } : {}) };
  }
  for (const [name, a] of Object.entries(catalog.actions)) {
    actions[name] = { doc: a.doc, prop: a.prop, ...(a.over > 0 ? { over: a.over } : {}), fields: fields(a.fields) };
  }
  return {
    about: 'Catalogue for show.json (format 1). Generated by tools/catalog.mjs from the code; see docs/SPEC.md for the rules.',
    propFields: fields(PROP_COMMON_FIELDS),
    stageSpaceNote: 'Props with stageSpace: true are drawn between their own points (from/to); they have no at, size or rotate, and cannot move, scale, spin, orbit, bob, shake or pulse.',
    actionFields: fields(COMMON_FIELDS),
    anchors: describe({ type: 'anchor' }),
    slots: SLOTS,
    colors: Object.keys(PALETTE),
    camera: Object.fromEntries(Object.entries(catalog.camera).map(([k, v]) => [k, { ...field(v), ...(CAMERA_DOCS[k] ? { options: CAMERA_DOCS[k] } : {}) }])),
    transitions: {
      cut: 'hard cut (default)', dip: 'quick dip through the new shot\'s environment colour',
      dive: 'the camera pushes into the subject at the end of the shot before; this shot starts close and pulls back',
    },
    ...FEATURES, dialKeyFields: fields(DIAL_KEY_FIELDS),
    props, envs, actions,
  };
}

const fmt = f => {
  let s = describe(f.of ? { ...f, of: f.of } : f);
  if (f.default !== undefined) s += `; default ${JSON.stringify(f.default)}`;
  if (f.required) s += '; required';
  return s;
};
const table = (specs) => ['| field | type | what |', '|---|---|---|', ...Object.entries(specs).map(([k, f]) => `| \`${k}\` | ${fmt(f).replace(/\|/g, '\\|')} | ${f.doc || ''} |`)].join('\n');

export function catalogMarkdown(d) {
  const out = ['# Catalogue', '', '_Generated by `node tools/catalog.mjs` from the code. Do not edit by hand._', ''];
  out.push('## Props', '', 'Fields every prop has:', '', table(d.propFields), '', d.stageSpaceNote, '');
  for (const [name, p] of Object.entries(d.props)) {
    out.push(`### ${name}`, '', p.summary, ...(p.notes ? ['', `Notes: ${p.notes}`] : []), '', `Floats: ${p.floats ? 'yes' : 'no (stands on the ground)'}${p.stageSpace ? '. Stage-space: drawn between its points.' : ''}`, '');
    out.push(table(p.params), '');
    const anim = Object.entries(p.animatable);
    if (anim.length) out.push('Animatable with `set` (also usable as a starting value):', '', ...anim.map(([k, a]) => `- \`${k}\` ${a.min}..${a.max}, default ${a.default}: ${a.doc}`), '');
  }
  out.push('## Environments', '');
  for (const [name, e] of Object.entries(d.envs)) {
    out.push(`### ${name}`, '', e.summary, ...(e.notes ? ['', `Notes: ${e.notes}`] : []), '', table(e.params), '');
    if (e.dialParams) out.push(`Can follow a dial: ${e.dialParams.map(k => `\`${k}\``).join(', ')}`, '');
  }
  out.push('## Actions', '', 'Fields every action has:', '', table(d.actionFields), '');
  for (const [name, a] of Object.entries(d.actions)) {
    out.push(`### ${name}`, '', `${a.doc} (prop: ${a.prop}${a.over ? `; default over ${a.over} s` : ''})`, '');
    if (Object.keys(a.fields).length) out.push(table(a.fields), '');
  }
  out.push('## Camera', '', table(d.camera), '');
  for (const [k, f] of Object.entries(d.camera)) if (f.options) out.push(`**${k}**:`, '', ...Object.entries(f.options).map(([o, doc]) => `- \`${o}\`: ${doc}`), '');
  out.push('## Dials, bindings and continuing shots', '', d.dials, '', 'Fields of a dial key:', '', table(d.dialKeyFields), '', d.bindings, '', d.continue, '');
  out.push('## Places, colours, anchors', '', 'Slots: ' + Object.entries(d.slots).map(([k, v]) => `\`${k}\` [${v.join(', ')}]`).join(', '), '',
    'Colour names: ' + d.colors.join(', ') + ' (or #rrggbb).', '', 'Anchors: ' + d.anchors, '',
    'Transitions: ' + Object.entries(d.transitions).map(([k, v]) => `\`${k}\` ${v}`).join('; '), '');
  return out.join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const d = catalogData();
  fs.writeFileSync(path.join(REPO, 'kit', 'catalog.json'), JSON.stringify(d) + '\n');
  fs.writeFileSync(path.join(REPO, 'docs', 'CATALOG.md'), catalogMarkdown(d));
  console.log(`CATALOG docs/CATALOG.md and kit/catalog.json: ${Object.keys(d.props).length} props, ${Object.keys(d.envs).length} envs, ${Object.keys(d.actions).length} actions`);
}
