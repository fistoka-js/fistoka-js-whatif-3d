// All generic actions (SPEC §7). One entry per action: its catalogue description and how it changes things over time.
// Exports: ACTIONS (name -> entry), COMMON_FIELDS, SFX_NAMES, ICON_NAMES.
//
// An entry has:
//   doc     one line for people and the LLM
//   prop    'required' | 'optional' | 'none'  (does the action name a prop with "prop")
//   over    default duration in seconds (the "over" field)
//   fields  type specs (engine/types.js) of the action's own fields, with defaults and docs
//   kind    'channel' (a value that tweens and stays), 'effect' (adds on top, then fades), 'overlay' (HTML text/icon),
//           'camera' (re-aims the camera) or 'sound' (only for the timeline)
//   channel which prop value a 'channel' action changes: presence | position | scale | color | glow | rotation | param
//   value(a, t, from, ctx)  for channels: the value at time t. `from` is the channel's value when this action starts.
//   effect(a, t, ctx)       for effects: { offset: [x,y,z], scale } to add at time t.
//   placedOnly  true when the action moves/turns a prop, so it cannot be used on props drawn between two points.
//   validate(a, ctx) -> list of { field, message, hint } for rules a type spec cannot say.
// `a` is the resolved action: every field with its default filled in, plus t0 (start, s) and over (s).
// ctx: { positionOf(propId, t), base (the prop's starting state), seed (number) }.

import { ease, lerp, lerp3, mixColor, progress, clamp } from '../engine/tween.js';
import { resolvePlace } from '../engine/places.js';
import { parseColor } from '../engine/palette.js';
import { smoothNoise } from '../engine/rng.js';

export const SFX_NAMES = ['whoosh', 'pop', 'buzz', 'chime', 'rumble', 'tick', 'shimmer', 'thud', 'rise'];
export const ICON_NAMES = ['x', 'check', 'question', 'warning', 'heart', 'bolt'];
const EASE_FIELD = { type: 'enum', values: ['in_out', 'out', 'in', 'linear', 'back', 'bounce'], default: 'in_out', doc: 'easing curve' };
const UNTIL_FIELD = { type: 'anchor', default: null, doc: 'when it goes away (default: end of the shot)' };
// On a ramp (move, scale, color, glow, set): arrive when this is spoken, instead of after "over" seconds.
const RAMP_UNTIL = { type: 'anchor', default: null, doc: 'arrive when this is spoken (instead of over)' };

// Fields every action may have. "prop" and "over" are only allowed when the entry says so (see show.js).
export const COMMON_FIELDS = {
  at: { type: 'anchor', required: true, doc: 'when it starts' },
  do: { type: 'string', required: true, doc: 'the action name' },
  prop: { type: 'propId', doc: 'the prop it acts on' },
  over: { type: 'number', min: 0, max: 20, doc: 'duration in seconds' },
};

const k = (a, t) => progress(t, a.t0, a.over);

export const ACTIONS = {
  appear: {
    doc: 'Show a prop. A prop whose first action is appear starts hidden.',
    prop: 'required', over: 0.5, kind: 'channel', channel: 'presence',
    fields: {
      style: { type: 'enum', values: ['pop', 'fade', 'grow', 'drop', 'fly_in'], default: 'pop', doc: 'how it arrives' },
      from: { type: 'place', default: 'far-left', doc: 'where fly_in starts' },
    },
    value(a, t) {
      const p = k(a, t);
      const v = { shown: t >= a.t0, opacity: 1, scaleMul: 1, fly: null };
      if (a.style === 'pop') v.scaleMul = Math.max(0.001, ease('back', p));
      if (a.style === 'grow') v.scaleMul = Math.max(0.001, ease('out', p));
      if (a.style === 'fade') v.opacity = p;
      if (a.style === 'drop') { v.fly = { from: [0, 1.6, 0], relative: true, k: ease('bounce', p) }; v.opacity = clamp(p * 4); }
      if (a.style === 'fly_in') v.fly = { from: resolvePlace(a.from), relative: false, k: ease('out', p) };
      return v;
    },
  },
  disappear: {
    doc: 'Hide a prop.',
    prop: 'required', over: 0.4, kind: 'channel', channel: 'presence',
    fields: {
      style: { type: 'enum', values: ['fade', 'shrink', 'pop', 'fly_out'], default: 'fade', doc: 'how it leaves' },
      to: { type: 'place', default: 'far-right', doc: 'where fly_out goes' },
    },
    value(a, t) {
      const p = k(a, t);
      const v = { shown: p < 1, opacity: 1, scaleMul: 1, fly: null };
      if (a.style === 'fade') v.opacity = 1 - p;
      if (a.style === 'shrink') v.scaleMul = Math.max(0.001, 1 - ease('in', p));
      if (a.style === 'pop') v.scaleMul = Math.max(0.001, p < 0.3 ? 1 + 0.25 * (p / 0.3) : 1.25 * (1 - ease('in', (p - 0.3) / 0.7)));
      if (a.style === 'fly_out') { v.fly = { from: resolvePlace(a.to), relative: false, k: 1 - ease('in', p) }; v.opacity = clamp((1 - p) * 3); }
      return v;
    },
  },
  move: {
    doc: 'Move a prop to a place, or toward another prop.',
    prop: 'required', over: 1.2, kind: 'channel', channel: 'position', placedOnly: true,
    fields: {
      to: { type: 'place', default: null, doc: 'where to go (use "to" or "toward")' },
      toward: { type: 'propId', default: null, doc: 'another prop to move toward' },
      amount: { type: 'number', min: 0, max: 1, default: 0.75, doc: 'with "toward": how much of the way to go' },
      ease: EASE_FIELD,
      until: RAMP_UNTIL,
    },
    validate(a) {
      if ((a.to === null) === (a.toward === null)) return [{ field: 'to', message: 'give exactly one of "to" (a place) or "toward" (a prop id).' }];
      if (a.toward !== null && a.toward === a.prop) return [{ field: 'toward', message: 'a prop cannot move toward itself.' }];
      return [];
    },
    value(a, t, from, ctx) {
      const target = a.to !== null ? resolvePlace(a.to) : lerp3(from, ctx.positionOf(a.toward, a.t0), a.amount);
      return lerp3(from, target, ease(a.ease, k(a, t)));
    },
  },
  scale: {
    doc: 'Change a prop\'s size (to = multiple of its starting size).',
    prop: 'required', over: 0.8, kind: 'channel', channel: 'scale', placedOnly: true,
    fields: { to: { type: 'number', min: 0.05, max: 10, required: true, doc: 'size multiplier' }, ease: EASE_FIELD, until: RAMP_UNTIL },
    value: (a, t, from) => lerp(from, a.to, ease(a.ease, k(a, t))),
  },
  color: {
    doc: 'Tint a prop\'s main colour.',
    prop: 'required', over: 0.8, kind: 'channel', channel: 'color',
    fields: { to: { type: 'color', required: true, doc: 'new colour' }, until: RAMP_UNTIL },
    value: (a, t, from) => mixColor(from, parseColor(a.to), ease('in_out', k(a, t))),
  },
  spin: {
    doc: 'Start (or stop, with speed 0) turning a prop.',
    prop: 'required', over: 0, kind: 'channel', channel: 'rotation', placedOnly: true,
    fields: {
      speed: { type: 'number', min: -5, max: 5, default: 0.1, doc: 'turns per second' },
      axis: { type: 'enum', values: ['y', 'x', 'z'], default: 'y', doc: 'turning axis' },
    },
    value(a, t, from) {
      const deg = a.speed * 360 * Math.max(0, t - a.t0);
      const i = { x: 0, y: 1, z: 2 }[a.axis];
      const out = from.slice(); out[i] += deg; return out;
    },
  },
  orbit: {
    doc: 'Circle around another prop (keeps going until a later move).',
    prop: 'required', over: 0, kind: 'channel', channel: 'position', placedOnly: true,
    fields: {
      around: { type: 'propId', required: true, doc: 'the prop at the centre' },
      radius: { type: 'number', min: 0.1, max: 5, default: null, doc: 'distance (default: where it is now)' },
      period: { type: 'number', min: 0.5, max: 60, default: 6, doc: 'seconds per turn' },
      tilt: { type: 'number', min: -90, max: 90, default: 15, doc: 'tilt of the circle in degrees' },
    },
    validate: a => (a.around === a.prop ? [{ field: 'around', message: 'a prop cannot orbit itself.' }] : []),
    value(a, t, from, ctx) {
      const c0 = ctx.positionOf(a.around, a.t0);
      const c = ctx.positionOf(a.around, t);
      const d = [from[0] - c0[0], from[1] - c0[1], from[2] - c0[2]];
      const r = a.radius ?? Math.max(0.3, Math.hypot(d[0], d[2]) || Math.hypot(...d) || 1);
      const ang = Math.atan2(d[2], d[0]) + (2 * Math.PI * (t - a.t0)) / a.period;
      const tilt = (a.tilt * Math.PI) / 180;
      const x = r * Math.cos(ang), z0 = r * Math.sin(ang);
      return [c[0] + x, c[1] - z0 * Math.sin(tilt), c[2] + z0 * Math.cos(tilt)];
    },
  },
  bob: {
    doc: 'Gentle floating up and down (keeps going).',
    prop: 'required', over: 0, kind: 'effect', placedOnly: true,
    fields: {
      height: { type: 'number', min: 0, max: 2, default: 0.08, doc: 'how far up and down' },
      period: { type: 'number', min: 0.3, max: 20, default: 2.5, doc: 'seconds per bob' },
    },
    effect(a, t) {
      const s = t - a.t0, ramp = clamp(s / 0.5);
      return { offset: [0, a.height * ramp * Math.sin((2 * Math.PI * s) / a.period), 0], scale: 1 };
    },
  },
  shake: {
    doc: 'Shake a prop, or the camera when no prop is given.',
    prop: 'optional', over: 0, kind: 'effect', placedOnly: true,
    fields: {
      strength: { type: 'number', min: 0, max: 2, default: 0.5, doc: 'how hard' },
      for: { type: 'number', min: 0.05, max: 5, default: 0.6, doc: 'seconds' },
    },
    effect(a, t, ctx) {
      const s = t - a.t0;
      if (s > a.for) return { offset: [0, 0, 0], scale: 1 };
      const env = Math.sin(Math.PI * clamp(s / a.for)) * a.strength * 0.12;
      const f = 18;
      return { offset: [env * smoothNoise(ctx.seed, s * f), env * smoothNoise(ctx.seed + 7, s * f), env * 0.5 * smoothNoise(ctx.seed + 13, s * f)], scale: 1 };
    },
  },
  pulse: {
    doc: 'One quick swell and back, to draw the eye.',
    prop: 'required', over: 0.5, kind: 'effect', placedOnly: true,
    fields: { strength: { type: 'number', min: 0, max: 2, default: 0.25, doc: 'how much bigger at the peak' } },
    effect: (a, t) => ({ offset: [0, 0, 0], scale: 1 + a.strength * Math.sin(Math.PI * k(a, t)) }),
  },
  glow: {
    doc: 'Change how much a prop glows (0 = none).',
    prop: 'required', over: 0.6, kind: 'channel', channel: 'glow',
    fields: { to: { type: 'number', min: 0, max: 2, required: true, doc: 'glow amount' }, until: RAMP_UNTIL },
    value: (a, t, from) => lerp(from, a.to, ease('in_out', k(a, t))),
  },
  set: {
    doc: 'Animate one of the prop\'s own numbers (see the prop\'s "animatable" list).',
    prop: 'required', over: 1, kind: 'channel', channel: 'param',
    fields: {
      param: { type: 'string', max: 40, required: true, doc: 'the animatable param name' },
      to: { type: 'number', required: true, doc: 'its new value' },
      ease: EASE_FIELD,
      until: RAMP_UNTIL,
    },
    value: (a, t, from) => lerp(from, a.to, ease(a.ease, k(a, t))),
  },
  label: {
    doc: 'A callout with a leader line, attached to a prop.',
    prop: 'required', over: 0.3, kind: 'overlay',
    fields: {
      text: { type: 'string', max: 32, required: true, doc: 'short text (2-4 words)' },
      side: { type: 'enum', values: ['auto', 'left', 'right', 'top'], default: 'auto', doc: 'which side of the prop' },
      until: UNTIL_FIELD,
    },
  },
  text: {
    doc: 'Free on-screen text.',
    prop: 'none', over: 0.3, kind: 'overlay',
    fields: {
      text: { type: 'string', max: 40, required: true, doc: 'short text' },
      style: { type: 'enum', values: ['title', 'stamp', 'number'], default: 'title', doc: 'title = big heading, stamp = tilted red stamp, number = huge figure' },
      pos: { type: 'enum', values: ['top', 'middle'], default: 'top', doc: 'where on screen' },
      until: UNTIL_FIELD,
    },
  },
  count: {
    doc: 'A number that counts from one value to another.',
    prop: 'none', over: 1.5, kind: 'overlay',
    fields: {
      from: { type: 'number', default: 0, doc: 'start value' },
      to: { type: 'number', required: true, doc: 'end value' },
      unit: { type: 'string', max: 16, default: '', doc: 'text after the number' },
      decimals: { type: 'int', min: 0, max: 3, default: 0, doc: 'digits after the point' },
      pos: { type: 'enum', values: ['top', 'middle'], default: 'top', doc: 'where on screen' },
      until: UNTIL_FIELD,
    },
  },
  icon: {
    doc: 'Pop an icon on a prop or at a place.',
    prop: 'optional', over: 0.35, kind: 'overlay',
    fields: {
      name: { type: 'enum', values: ICON_NAMES, required: true, doc: 'which icon' },
      place: { type: 'place', default: null, doc: 'where, when no prop is given' },
      until: UNTIL_FIELD,
    },
    validate: a => (a.prop === null && a.place === null ? [{ field: 'prop', message: 'give "prop" (a prop id) or "place" (a slot or [x,y,z]) for the icon.' }] : []),
  },
  focus: {
    doc: 'Re-aim the camera at some props.',
    prop: 'none', over: 1.2, kind: 'camera',
    fields: {
      props: { type: 'list', of: { type: 'propId' }, min: 1, required: true, doc: 'prop ids to frame' },
      framing: { type: 'enum', values: ['close', 'medium', 'wide'], default: 'medium', doc: 'how tight' },
    },
  },
  sfx: {
    doc: 'Force a sound here, or "none" to silence the automatic sound at this moment.',
    prop: 'none', over: 0, kind: 'sound',
    fields: { name: { type: 'enum', values: SFX_NAMES.concat(['none']), required: true, doc: 'sound name or "none"' } },
  },
};
