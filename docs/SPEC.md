# SPEC: the kit's contracts

This file is the contract between the parts. If code and this file disagree, fix one of them in the same change.
Audience: Sonnet/Opus maintaining the kit. Keep it short and exact.

## 1. The idea in five lines

- A video is described by one data file, `shows/<slug>/show.json` (a "show").
- A show is a list of **shots**. Each shot is a small stage: one **environment**, some **props**, one **camera** instruction, and **actions** that happen when words are spoken.
- Props, actions, environments and camera moves come from a fixed **catalogue**. A new topic should need only a new show file. A new *thing* (say, a submarine) needs one new prop file and nothing else.
- The browser page `kit/index.html` plays any show. `window.__renderAt(t)` draws the frame for time `t` (seconds). **Every frame is a pure function of `t`**: no state carried between frames, no `Math.random()` (use the seeded `rng`), no clocks.
- The catalogue is defined once, in code (`meta` objects). The checker, the docs and the LLM prompt are all generated from it.

## 2. Folders

```
kit/                 the browser player (ES modules, no build step)
  index.html         page: canvas + caption/label overlays
  vendor/            three.js (pinned copy) and the few addons used
  engine/            player.js show.js anchors.js stage.js camera.js captions.js overlay.js
                     tween.js rng.js types.js materials.js registry.js
  props/             one file per prop, plus index.js that lists them
  envs/              one file per environment, plus index.js
  actions/           actions.js (all generic actions)
tools/               Node scripts (ESM): serve.mjs validate.mjs still.mjs render.mjs gallery.mjs catalog.mjs qa.mjs
pipeline/            Python: voice, script, storyboard (LLM), mix, sfx, upload, run
shows/<slug>/        show.json voice.mp3 words.json script.txt (+ out/ for renders, git-ignored)
tests/               node --test files (tests/*.test.mjs) and pytest files (tests/py/)
docs/                SPEC.md (this), AUTHORING.md, HOW-IT-WORKS.md, CATALOG.md (generated), ASKING-CLAUDE.md
```

The page is always opened over `http://127.0.0.1:<port>/` from `tools/serve.mjs` (a tiny static server rooted at the repo), never from `file://`. URL: `kit/index.html?show=shows/<slug>`. The page fetches `show.json`, `words.json` and the audio relative to that folder.

Imports of three.js use the bare name `three` (and `three/addons/...`). The page has an import map pointing at `kit/vendor/`; Node resolves the same names from `node_modules` (same pinned version), so prop files can be imported in Node for checking and tests.

## 3. The show file

```jsonc
{
  "format": 1,
  "title": "What if the Moon disappeared?",
  "voice": { "audio": "voice.mp3", "words": "words.json" },
  "style": { "accent": "#ffe14d" },            // optional; see §8
  "shots": [
    {
      "id": "calm-earth",                      // unique, a-z 0-9 and dashes
      "start": "What if",                      // anchor (§4). First shot may omit it (= 0 s).
      "env": { "type": "space" },              // or just "space"
      "props": [
        { "id": "earth", "type": "planet", "look": "earth", "at": "center", "size": 1.2 },
        { "id": "moon",  "type": "planet", "look": "moon",  "at": [0.9, 0.3, -0.2], "size": 0.35 }
      ],
      "camera": { "move": "orbit", "focus": ["earth", "moon"], "framing": "medium", "angle": "front", "amount": 0.5 },
      "transition": "cut",                     // "cut" (default) or "dip" (quick dip through the env colour)
      "actions": [
        { "at": "vanished", "do": "disappear", "prop": "moon", "style": "pop" },
        { "at": "tides", "do": "label", "prop": "earth", "text": "TIDES SHRINK" }
      ]
    }
  ]
}
```

Rules:
- A shot lasts from its `start` to the next shot's `start`; the last shot runs to the end of the audio plus `tail` (default 0.4 s; optional top-level number `"tail"`). So shots can never overlap or leave gaps.
- Shot `start` times must increase. A shot should last 1.5 s to 12 s (shorter or longer is an error; over 9 s is a warning).
- `words.json` is `[{"text": "What", "start": 0.10, "end": 0.31}, ...]` (seconds), in spoken order.
- Unknown fields are errors everywhere (catches typos), with a "did you mean" hint.

## 4. Anchors (when things happen)

An anchor is one of:
- `"some spoken phrase"`: the start time of the first word of the first place that phrase is spoken **at or after the start of the shot it is in** (for a shot's own `start`: at or after the previous shot's start). Matching ignores case and punctuation; 1 to 6 words.
- `{ "phrase": "some phrase", "edge": "start" | "end", "offset": -0.2 }`: same, with the end of the phrase and/or a shift in seconds.
- `{ "time": 12.3 }`: absolute seconds (avoid; breaks when the voice changes).
- `{ "shot": 0.5 }`: a fraction of the way through the current shot (0 = its start, 1 = its end). Only inside a shot.

An action's time must fall inside its shot. Error messages for a phrase that is not found must list the words actually spoken in that shot, with times.

## 5. Stage space, placement and size

- Each shot has its own stage centred on the origin. +x right, +y up, +z toward the viewer. One unit is roughly half the frame width at "medium" framing.
- `at` is a slot name or `[x, y, z]`. Slots: `center` [0,0,0], `left` [-0.8,0,0], `right` [0.8,0,0], `top` [0,0.9,0], `bottom` [0,-0.9,0], `top-left`, `top-right`, `bottom-left`, `bottom-right`, `front` [0,0,0.8], `back` [0,0,-1.2], `far-left` [-1.6,0,0], `far-right` [1.6,0,0]. In environments with a ground, y = 0 is where things rest on the ground unless the prop's meta says `floats: true`.
- Every prop is built to fit inside a unit box (largest side = 1) with its natural base/centre at the origin; `size` (default 1) scales it. The engine measures and normalises after `build`, so a prop file cannot get this wrong.
- Optional per-prop: `rotate: [xDeg, yDeg, zDeg]`, `hidden: true`. A prop whose first action is `appear` starts hidden automatically.

## 6. Camera

`camera` fields (all optional):
- `focus`: prop ids to frame (default: all props in the shot). The engine frames the bounding sphere of their positions **over the whole shot** (so things that move or appear later stay in frame) inside the safe rectangle: the frame minus the caption zone (bottom 24%) and a top margin (7%), minus 6% side margins.
- `framing`: `close` | `medium` (default) | `wide`.
- `angle`: `front` (default) | `high` | `low` | `top` | `side` | `three-quarter`.
- `move`: `drift` (default; slow small sideways float, never fully still) | `push_in` | `pull_out` | `orbit` | `rise` | `pan` | `still`.
- `amount`: 0 to 1 strength of the move (default 0.5).
- Actions can re-aim the camera mid-shot: `{ "do": "focus", "props": ["moon"], "framing": "close", "over": 1.2 }` and shake it: `{ "do": "shake", "strength": 0.5, "for": 0.6 }`.

Field of view is fixed (about 40° vertical) unless a move changes it.

## 7. Actions

Common fields: `at` (anchor, required), `do` (required), `prop` (most actions), `over` (seconds; each action has a default).
The value of every animated property at time `t` is computed by folding the prop's actions in time order (each tween starts from the value the previous one ends at). Continuous motions (`spin`, `orbit`, `bob`) are functions of `t - start`.

| do | what | key fields (defaults) |
|---|---|---|
| `appear` | show a prop | `style`: pop \| fade \| grow \| drop \| fly_in (pop); `from` slot for fly_in |
| `disappear` | hide a prop | `style`: fade \| shrink \| pop \| fly_out (fade) |
| `move` | move a prop | `to` slot/coords or `toward` prop id; `ease` |
| `scale` | change size | `to` (multiplier of its starting size) |
| `color` | tint the prop's main colour | `to` colour |
| `spin` | start/stop turning | `speed` turns per second (0.1), `axis` y |
| `orbit` | circle another prop | `around` prop id, `radius`, `period` s, `tilt` deg |
| `bob` | gentle float up/down | `height`, `period` |
| `shake` | shake a prop or (no `prop`) the camera | `strength`, `for` |
| `pulse` | one quick swell and back | `strength` |
| `glow` | change emissive glow | `to` 0..2 |
| `set` | animate a prop-specific number | `param`, `to` (the prop's meta lists `animatable` params) |
| `label` | callout text attached to a prop | `text`, `side` auto\|left\|right\|top, `until` anchor (default: shot end) |
| `text` | free on-screen text | `text`, `style` title\|stamp\|number, `pos` top\|middle, `until` |
| `count` | animated number | `from`, `to`, `unit`, `decimals`, `pos`, `until` |
| `icon` | pop an icon on a prop or slot | `name` x\|check\|question\|warning\|heart\|bolt, `prop` or `at`, `until` |
| `focus` | re-aim camera | `props`, `framing` |
| `sfx` | force or silence a sound | `name` or `"none"` |

Labels, text, counters and icons are HTML overlays positioned from 3D points each frame (crisp text, and the QA tool can read their boxes). Captions are also HTML.

Sound effects are derived automatically later by the pipeline (appear → pop, shot change → whoosh, shake → rumble, icon x → buzz, count → ticks); the page itself plays no effects.

## 8. Look (what makes it read as 3D, applied by default)

Every environment provides: a key light, a fill, a rim light, a background with a gradient or depth layers, distance haze, slow "motes" or stars at several depths for parallax, and a grounding cue (soft blob shadow under props when there is a ground). The camera never sits fully still. Props use `engine/materials.js` helpers so shading, saturation and outline/rim treatment stay consistent across videos (the channel's visual identity). Captions: 4 words max per chunk, white with the active word in the accent colour, heavy stroke (ported from the approved chameleon video).

## 9. Module interfaces

### Prop: `kit/props/<name>.js`
```js
import * as THREE from 'three';
export const meta = {
  name: 'planet',
  summary: 'A lit planet or moon. Looks: earth, moon, mars, ...',   // one line, shown to the LLM
  tags: ['space'],
  floats: true,                                                     // does not rest on the ground
  params: {                                                         // checked by engine/types.js
    look:  { type: 'enum', values: ['earth','moon','mars'], default: 'earth', doc: 'surface style' },
    color: { type: 'color', default: null, doc: 'override main colour' },
    rings: { type: 'bool', default: false, doc: 'Saturn-style rings' }
  },
  animatable: { atmosphere: { min: 0, max: 1, default: 0, doc: 'glow of the air shell' } },
  sounds: {}                                                        // optional sfx hints
};
export function build(params, ctx) {        // ctx: { THREE, rng (seeded), mat (materials helpers), quality }
  const group = new THREE.Group();
  // ... build meshes into group ...
  return {
    object: group,
    update(t, state) {},                    // optional; t = seconds since shot start; state = { <animatable>: value, glow, color }
    setColor(c) {}, setGlow(v) {},          // optional hooks used by the generic color/glow actions
    dispose() {}
  };
}
```
### Environment: `kit/envs/<name>.js`
`meta` (name, summary, params, `ground: true|false`) and `build(params, ctx)` → `{ object, update(t, cameraInfo), background, fog, lights }`.

### Types (`engine/types.js`)
`number {min,max}`, `int`, `bool`, `color` (#rgb/#rrggbb or a palette name), `enum {values}`, `string {max}`, `place` (slot or [x,y,z]), `anchor`, `propId`, `list {of}`. One function `check(value, typeSpec, path)` → list of `{path, message, hint}`. Messages are written for a person: what was given, what is allowed, and the nearest valid name.

### Validator (`tools/validate.mjs`)
`node tools/validate.mjs shows/<slug>` checks the show against the catalogue and the words file without a browser. Prints every problem as `ERROR shots[2].actions[1].prop: "mooon" is not a prop in this shot (props here: earth, moon). Did you mean "moon"?`. Exit 0 = ok (warnings allowed), 1 = errors, 2 = bad command. `--json` prints machine-readable results for the repair loop.

### Other tools
- `serve.mjs`: static server on 127.0.0.1, `--port` (default: a free port, printed).
- `still.mjs <slug> --at 3.2,10 | --every 3`: PNG stills and optionally a contact sheet.
- `render.mjs <slug> [--chunks N] [--size 1080x1920] [--fps 30]`: MP4 (video + voice) in `shows/<slug>/out/`.
- `gallery.mjs`: one still of every prop (and every env) into `docs/gallery/`, for eyeball review.
- `catalog.mjs`: writes `docs/CATALOG.md` and `kit/catalog.json` from the `meta` objects.
- `qa.mjs <slug>`: automatic picture checks (see docs/HOW-IT-WORKS.md).

All browser tools use puppeteer-core with the installed Chrome (`CHROME_PATH` env, else the usual Windows/Linux paths), software WebGL flags `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`, and wait for `window.__ready === true` before drawing.

## 10. Page hooks (for tools and tests)

- `window.__ready`: true once the show is built; `window.__error`: a message string if it failed (also shown on the page).
- `window.__renderAt(t)`: draw the frame for time `t`.
- `window.__info()`: `{ duration, fps, shots: [{id, start, end}] }`.
- `window.__boxes(t)`: screen rectangles (pixels) of every visible prop, label, text and the caption block at time `t`, for QA.
- Without `?render=1` the page shows a play button and plays with the audio (preview mode).
