// Sound effect events derived from a resolved show (the page plays none; the pipeline mixes them in).
// Exports: SOUND_RULES (the default mapping, in one small table), SFX_WINDOW, soundEvents(show, catalog) -> [{ t, sfx, why }].
// Names match the files in assets/sfx (whoosh, pop, buzz, chime, rumble, tick, shimmer, thud, rise).

import { makeShotState } from './state.js';

// Default sound per thing that happens. null = silent.
export const SOUND_RULES = {
  shotChange: 'whoosh',          // every shot start except the first
  appear: 'pop',
  disappear: null,
  icon: { x: 'buzz', check: 'chime', other: 'pop' },
  shake: 'rumble',
  count: 'tick',                 // at the start of the count
  label: 'tick',
  text: 'tick',
  glowUp: 'shimmer',             // a glow action that makes the prop brighter
};

// An "sfx" action replaces every automatic sound within this many seconds of it (name "none" just silences them).
export const SFX_WINDOW = 0.25;

const round2 = x => Math.round(x * 100) / 100;

export function soundEvents(show, catalog) {
  const events = [];
  const add = (t, sfx, why) => { if (sfx) events.push({ t: round2(t), sfx, why }); };
  for (const shot of show.shots) {
    if (shot.index > 0) add(shot.start, SOUND_RULES.shotChange, `shot ${shot.id}`);
    const state = makeShotState(shot, catalog);
    const overrides = [];
    for (const a of shot.actions) {
      switch (a.do) {
        case 'appear': add(a.t0, SOUND_RULES.appear, `appear ${a.prop}`); break;
        case 'disappear': add(a.t0, SOUND_RULES.disappear, `disappear ${a.prop}`); break;
        case 'icon': add(a.t0, SOUND_RULES.icon[a.name] || SOUND_RULES.icon.other, `icon ${a.name}`); break;
        case 'shake': add(a.t0, SOUND_RULES.shake, `shake ${a.prop || 'camera'}`); break;
        case 'count': add(a.t0, SOUND_RULES.count, `count to ${a.to}`); break;
        case 'label': add(a.t0, SOUND_RULES.label, `label ${a.text}`); break;
        case 'text': add(a.t0, SOUND_RULES.text, `text ${a.text}`); break;
        case 'glow': {
          const before = state.propAt(a.prop, a.t0 - 0.001).glow;
          if (a.to > before) add(a.t0, SOUND_RULES.glowUp, `glow up ${a.prop}`);
          break;
        }
        case 'sfx': overrides.push(a); break;
      }
    }
    for (const o of overrides) {
      for (let i = events.length - 1; i >= 0; i--) if (Math.abs(events[i].t - o.t0) <= SFX_WINDOW) events.splice(i, 1);
      if (o.name !== 'none') add(o.t0, o.name, `sfx action in shot ${shot.id}`);
    }
  }
  events.sort((x, y) => x.t - y.t);
  // The same sound twice at (almost) the same moment is played once.
  return events.filter((e, i) => !events.slice(0, i).some(p => p.sfx === e.sfx && Math.abs(p.t - e.t) < 0.08));
}
