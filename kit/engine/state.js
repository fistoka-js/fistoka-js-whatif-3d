// Action folding: the value of every prop's animated properties, and the camera, at any time t (SPEC §7).
// Pure: the same shot and t always give the same answer, whatever was asked before. No three.js, no DOM.
// Exports: makeShotState(shot, catalog) -> { propAt(id, t), positionOf(id, t), cameraAt(t), frameOf(ids, t0, t1), radiusOf(id, t),
//          baseFocus (what the shot's camera frames: { center, radius, depth }) }.
//
// How folding works: each action with a "channel" (presence, position, scale, color, glow, rotation, param:<name>)
// is a segment starting at its time t0. A channel's value at t comes from the last segment that has started, and that
// segment starts from the value the previous segment had at the new segment's t0. "Effects" (bob, shake, pulse) add on top.

import { cameraPoseAt, effectiveRadius, angleBasis, HEIGHT_TO_WIDTH } from './camera.js';
import { resolvePlace } from './places.js';
import { parseColor } from './palette.js';
import { hashString } from './rng.js';
import { lerp3, ease, progress } from './tween.js';

// Value of one channel at t. segs: sorted list of { a, entry }. base: value before any action.
function channelAt(segs, base, t, ctx) {
  let prev = null, prevFrom = base;
  for (const seg of segs) {
    if (seg.a.t0 > t) break;
    const from = prev ? prev.entry.value(prev.a, seg.a.t0, prevFrom, ctx) : base;
    prev = seg; prevFrom = from;
  }
  return prev ? prev.entry.value(prev.a, t, prevFrom, ctx) : base;
}

// How far (as a share of the subject's size, per side) free beam/arrow end points may pull the frame outward.
const STAGE_REACH = 0.12;
const MIN_FRAME_RADIUS = 0.3;

export function makeShotState(shot, catalog) {
  const actions = catalog.actions;
  const props = new Map(shot.props.map(p => [p.id, p]));
  const channels = new Map();   // propId -> { channelName: [segments] }
  const effects = new Map();    // propId -> [segments]
  const focusSegs = [], cameraShakes = [];
  for (const p of shot.props) { channels.set(p.id, {}); effects.set(p.id, []); }
  for (const a of shot.actions) {
    const entry = actions[a.do];
    if (entry.kind === 'camera') focusSegs.push(a);
    else if (entry.kind === 'effect' && !a.prop) cameraShakes.push({ a, entry });
    else if (entry.kind === 'effect') effects.get(a.prop).push({ a, entry });
    else if (entry.kind === 'channel') {
      const name = entry.channel === 'param' ? 'param:' + a.param : entry.channel;
      const ch = channels.get(a.prop);
      (ch[name] = ch[name] || []).push({ a, entry });
    }
  }
  for (const ch of channels.values()) for (const segs of Object.values(ch)) segs.sort((x, y) => x.a.t0 - y.a.t0);

  // Starting values of a prop (before any action).
  function baseOf(p) {
    const params = {};
    for (const [name, spec] of Object.entries(catalog.props[p.type].meta.animatable || {})) params[name] = p.params[name] ?? spec.default;
    return {
      presence: { shown: !p.startsHidden, opacity: 1, scaleMul: 1, fly: null },
      position: p.at, scale: 1, rotation: [0, 0, 0],
      color: parseColor(p.params.color) ?? 0xffffff, glow: 0, params,
    };
  }
  const bases = new Map(shot.props.map(p => [p.id, baseOf(p)]));
  const grounded = p => !!(shot.env && shot.env.ground) && !p.floats && !p.stageSpace;

  let depth = 0; // guards against two props orbiting each other forever
  function positionOf(id, t) {
    if (depth > 6) return bases.get(id).position;
    depth++;
    try { return propAt(id, t).position; } finally { depth--; }
  }

  // steady = true ignores the arrive/leave flight (drop, fly_in, fly_out); used for framing.
  function propAt(id, t, steady = false) {
    const p = props.get(id), base = bases.get(id), ch = channels.get(id);
    const ctx = { positionOf, base, seed: hashString(shot.id + ':' + id) % 1000 };
    const at = (name, b) => (ch[name] ? channelAt(ch[name], b, t, ctx) : b);
    const presence = at('presence', base.presence);
    let position = at('position', base.position);
    if (presence.fly && !steady) {
      const from = presence.fly.relative ? [position[0] + presence.fly.from[0], position[1] + presence.fly.from[1], position[2] + presence.fly.from[2]] : presence.fly.from;
      position = lerp3(from, position, presence.fly.k);
    }
    let scale = at('scale', base.scale) * (steady ? 1 : presence.scaleMul);
    const offset = [0, 0, 0];
    for (const { a, entry } of effects.get(id)) {
      if (a.t0 > t || steady) continue;
      const e = entry.effect(a, t, ctx);
      offset[0] += e.offset[0]; offset[1] += e.offset[1]; offset[2] += e.offset[2]; scale *= e.scale;
    }
    // On a ground, `at` is where the prop's base rests, so its centre is half its height higher (SPEC §5).
    const lift = grounded(p) ? 0.5 * p.size * scale : 0;
    position = [position[0] + offset[0], position[1] + offset[1] + lift, position[2] + offset[2]];
    const params = {};
    for (const name of Object.keys(base.params)) params[name] = at('param:' + name, base.params[name]);
    const rot = at('rotation', base.rotation);
    return {
      visible: presence.shown && presence.opacity > 0.001,
      opacity: presence.opacity, position, scale,
      rotation: [p.rotate[0] + rot[0], p.rotate[1] + rot[1], p.rotate[2] + rot[2]],
      color: at('color', base.color), glow: at('glow', base.glow), params,
      points: pointsOf(p, t),
    };
  }

  // Params of type "point" (slot, [x,y,z] or prop id) resolved to stage coordinates at t, with the radius of a named prop.
  function pointsOf(p, t) {
    const out = {};
    for (const [name, spec] of Object.entries(catalog.props[p.type].meta.params)) {
      if (spec.type !== 'point' || p.params[name] === null || p.params[name] === undefined) continue;
      const v = p.params[name];
      if (typeof v === 'string' && props.has(v)) out[name] = { at: positionOf(v, t), radius: radiusOf(v, t) };
      else out[name] = { at: resolvePlace(v), radius: 0 };
    }
    return out;
  }

  // Rough radius of a prop at t (its unit box is about a sphere of radius 0.5).
  function radiusOf(id, t) {
    const p = props.get(id);
    if (p.stageSpace) return 0.15;
    depth++;
    try { return 0.5 * p.size * (depth > 6 ? 1 : propAt(id, t).scale); } finally { depth--; }
  }

  // Points (with radius) a prop covers at t, for framing.
  function extentOf(id, t) {
    const p = props.get(id);
    if (!p.stageSpace) { const st = propAt(id, t, true); return [{ at: st.position, r: 0.5 * p.size * st.scale }]; }
    const pts = Object.values(pointsOf(p, t)).map(q => ({ at: q.at, r: 0, free: true }));
    return pts.length ? pts : [{ at: p.at, r: 0.3 }];
  }

  // The sphere that holds the given props over [t0, t1] (sampled), as { center, radius }. Uses steady positions
// and sizes (no pop overshoot, pulse, shake or arrive/leave flight), so short effects never shift the framing.
  const frameCache = new Map();
  const basis = angleBasis(shot.camera.angle);
  const dot = (p, v) => p[0] * v[0] + p[1] * v[1] + p[2] * v[2];
  function frameOf(ids, t0, t1, clampRays = false) {
    const key = ids.join(',') + (clampRays ? '!' : '') + '@' + t0.toFixed(3) + '-' + t1.toFixed(3);
    if (frameCache.has(key)) return frameCache.get(key);
    const times = [];
    for (let i = 0; i <= 16; i++) times.push(t0 + ((t1 - t0) * i) / 16);
    for (const a of shot.actions) if (a.t0 >= t0 && a.t0 <= t1) times.push(a.t0, Math.min(t1, a.t0 + a.over));
    // Extents along the camera's screen axes (right, up) and its depth axis (dir), for the shot's camera angle.
    // Solid props set the frame first. Free-standing beams and arrows (when the shot has no `focus` list) only count up to STAGE_REACH of the subject's
    // size beyond it (min one unit), so a long ray never shrinks the real subject to a speck; its far end may leave the frame.
    const axes = [basis.right, basis.up, basis.dir];
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    const stagePts = [];
    for (const t of times) for (const id of ids) for (const { at, r, free } of extentOf(id, t)) {
      if (free) { stagePts.push(at); continue; }
      for (let k = 0; k < 3; k++) { const c = dot(at, axes[k]); lo[k] = Math.min(lo[k], c - r); hi[k] = Math.max(hi[k], c + r); }
    }
    if (Number.isFinite(lo[0])) {
      const mlo = lo.slice(), mhi = hi.slice();
      for (const at of stagePts) for (let k = 0; k < 3; k++) {
        if (!clampRays) { const c = dot(at, axes[k]); lo[k] = Math.min(lo[k], c); hi[k] = Math.max(hi[k], c); continue; }
        const reach = STAGE_REACH * Math.max(1, mhi[k] - mlo[k]);
        const c = Math.min(mhi[k] + reach, Math.max(mlo[k] - reach, dot(at, axes[k])));
        lo[k] = Math.min(lo[k], c); hi[k] = Math.max(hi[k], c);
      }
    } else for (const at of stagePts) for (let k = 0; k < 3; k++) { const c = dot(at, axes[k]); lo[k] = Math.min(lo[k], c); hi[k] = Math.max(hi[k], c); }
    if (!Number.isFinite(lo[0])) return { center: [0, 0, 0], radius: 1, depth: 0 };
    const mid = [0, 1, 2].map(k => (lo[k] + hi[k]) / 2);
    const center = [0, 1, 2].map(i => axes[0][i] * mid[0] + axes[1][i] * mid[1] + axes[2][i] * mid[2]);
    // radius: half the width on screen, or the half-height in width terms, whichever needs more room.
    const halfW = (hi[0] - lo[0]) / 2, halfH = (hi[1] - lo[1]) / 2;
    const radius = Math.max(MIN_FRAME_RADIUS, halfW, halfH * HEIGHT_TO_WIDTH);
    // Depth: only the half-depth beyond what a sphere of the same width would have (a ball needs no extra step back).
    const out = { center, radius, depth: Math.max(0, (hi[2] - lo[2]) / 2 - Math.max(halfW, halfH)) };
    frameCache.set(key, out);
    return out;
  }

  const allIds = shot.props.map(p => p.id);
  // Without a `focus` list, free beams and arrows are clamped (see frameOf); listing them in `focus` frames them in full.
  const baseFocus = frameOf(shot.camera.focus || allIds, shot.start, shot.end, !shot.camera.focus);
  const camSeed = hashString(shot.id) % 1000;

  // Camera at t: framing (with focus actions tweened in), the move, and any camera shakes.
  // Framing is folded into the radius (effectiveRadius) so a focus action can tween both centre and tightness.
  function cameraAt(t) {
    let focus = { center: baseFocus.center, radius: effectiveRadius(baseFocus.radius, shot.camera.framing), depth: baseFocus.depth };
    for (const a of focusSegs) {
      if (a.t0 > t) break;
      const target = frameOf(a.props, a.t0, shot.end);
      const k = ease('in_out', progress(t, a.t0, a.over));
      const rTo = effectiveRadius(target.radius, a.framing);
      focus = { center: lerp3(focus.center, target.center, k), radius: focus.radius + (rTo - focus.radius) * k, depth: focus.depth + (target.depth - focus.depth) * k };
    }
    const shake = [0, 0, 0];
    for (const { a, entry } of cameraShakes) {
      if (a.t0 > t) continue;
      const e = entry.effect(a, t, { seed: camSeed });
      for (let k = 0; k < 3; k++) shake[k] += e.offset[k] * 1.5;
    }
    const pose = cameraPoseAt({ ...shot.camera, framing: 'medium' }, focus, shot, t, shake);
    // On a ground, never go below it: lift the camera to just above the surface (it keeps looking at the subject).
    const floor = 0.3 + 0.03 * pose.distance;
    if (shot.env && shot.env.ground && pose.position[1] < floor) pose.position[1] = floor;
    return pose;
  }

  return { propAt, positionOf, radiusOf, cameraAt, frameOf, baseFocus };
}
