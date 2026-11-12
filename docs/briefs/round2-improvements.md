# Brief: round 2 — make the kit able to do what the chameleon video does

Rewritten 2026-11-12 after Jacob watched the first two samples and said: the pictures do not match the script well, and it is not as good as the chameleon video. He is right. Read `PLAN.md` section "Round 2 finding" first. Read `docs/HELPER-RULES.md` and obey it.

## What the chameleon video does that the samples do not (measured from 1-frame-per-second sheets)

Evidence: `E:\Youtube Project\_fable_work\watch\cham\cham-sheet-1..4.jpg` (approved video), `...\watch\moon-gone-sheet-*.jpg`, `...\watch\sky-blue-sheet-*.jpg` (our samples). Prototype source: `E:\Youtube Project\chameleon_3d_test\chameleon_3d_test\index.html`.

1. **One subject stays on screen and changes with every clause.** The crystal lattice is on screen from 18 s to 38 s. "sit close together" → it tightens. "spread apart" → it opens. "yellow, orange, red" → it changes colour on each word. Our samples show a new object per sentence, and then it sits still for 4-6 s.
2. **One number drives everything.** In the prototype a single value (crystal spacing, 0 to 1) is keyed at 13 spoken-word times. The lattice spacing, the lattice colour, the small chameleon's skin, the reflected wave's length, the background tint and later the antenna's dial all follow that one value. That is why picture and words agree.
3. **Cause and effect share the frame.** Small chameleon at the top (the effect), lattice below (the cause).
4. **The camera travels into the subject**: animal → skin layers → crystal layer → back out to the animal. One journey, not a set of unrelated rooms.
5. **The background is part of the story** (its colour follows the value).
6. **The script is one causal chain about one subject**, not a list of separate consequences.

## Part 1 — engine additions (owner: `kit/engine/**`, `kit/actions/**`, `tools/validate.mjs`, `tools/lib/showfiles.mjs`, their tests, `docs/SPEC.md`)

Additions only. Existing shows must keep validating and rendering the same.

1. **Dials**: show-level named numbers keyed at phrase anchors, interpolated between keys (linear or smooth; `"hold": true` for a step). Example:
   `"dials": { "spacing": { "start": 0.1, "keys": [ {"at": "sit close together", "to": 0.06}, {"at": "spread apart", "to": 0.3}, {"at": "red", "to": 1.0} ] } }`.
   Dial anchors search the whole narration in order (each key at or after the previous key).
2. **Bindings**: wherever a show gives a number or a colour for a prop param, an animatable, a prop colour, glow, size, or an environment param/colour, it may give a binding instead: `{"dial": "spacing", "from": [0, 1], "to": [0.4, 1.6]}` for numbers, `{"dial": "spacing", "colors": ["#35c6e8", "#5fdc7a", "#ffe14d", "#ff3b3b"]}` for colours (evenly spaced stops). Evaluated per frame as a pure function of t.
3. **Continuing shots**: a shot with `"continue": true` keeps the previous shot's environment and props, with their current state, and only gives a new `camera` (and may add props and actions). Actions in it may target props declared in the earlier shot of the same run. This is how a subject persists while the camera cuts or moves.
4. **Ramps between words**: `set`, `move`, `scale`, `color`, `glow` accept `"until": <anchor>` as an alternative to `"over"`.
5. **Camera "dive"**: a transition `"dive"` (the camera pushes into the focus prop over the last 0.4 s of the outgoing shot and the next shot starts close and pulls back) for the zoom-into-the-subject journey.
6. **Environment colour** params accept bindings (item 2), so the background can follow a dial.
7. Catalogue output and validator messages for all of the above. Timeline/sfx: a dial key is not a sound event.

## Part 2 — mechanism props, ported from the approved video (owner: the new prop files, `kit/props/index.js` lines, tests)

Port from `E:\Youtube Project\_fable_work\ref-head\kit\template\scenes\` (`lattice.js`, `layer_stack.js`, `light_rays.js`, `meter_gadget.js`) and `...\template\engine\colors.js` (the wavelength colour rule). Keep the look that Jacob approved; change the interface to the new prop contract. Each is a prop with animatables that a dial can drive:
- `lattice` — grid of spheres with faint joining lines; animatables `spacing`, `shake`; colour bindable.
- `layer_stack` — see-through labelled slabs that slide in one by one; params: layers (name, colour, thickness); animatables `reveal` 0..1, `granules` spread 0..1, `focus` (index of the layer that glows/opens).
- `light_wave` — a wave travelling along a path from A to B (a wavy beaded line as in the video); params colour; animatables `wavelength`, `progress`.
- `tuner` — the antenna with broadcast rings and a dial strip; animatable `value`; ring and tip colour bindable.
- A helper `wavelengthColor(v)` in `kit/engine/palette.js`, usable as the named colour ramp `"spectrum"` in bindings.

## Part 3 — acceptance test: rebuild the chameleon video in the new kit (owner: `shows/chameleon/**`)

1. `shows/chameleon/`: the original `voice.mp3`; `words.json` from the `words` array of `ref-head\kit\storyboards\chameleon\storyboard.json`; `script.txt`.
2. Write `show.json` for the whole video using dials, bindings, continuing shots and the ported props. First target: 15 s to 38 s (the lattice section), then the rest.
3. Make 1-frame-per-second sheets (`node tools/still.mjs chameleon --every 1 --sheet`) and put them beside `cham-sheet-*.jpg`. **Done means**: for every second from 15 s to 38 s, the new frame shows the same thing happening as the approved frame (same subject, same state: tight/open, same colour family, wave in/out present when it is in the original), judged by reading both images. List every second that differs and why.
4. This show becomes the first worked example in the writer's prompt, and `tests/` must validate it.

## Part 4 — checker rules that measure what Jacob measures (owner: `tools/validate.mjs` rules module, `tools/qa.mjs`, tests, `docs/QA.md`)

No browser needed; computed from the resolved show and the words:
- **Sentence coverage** (ERROR): every spoken sentence (split at . ? ! in the words) must contain, inside its time span, at least one *state change on a prop*: an action other than label/text/icon/count/focus/sfx starting in it, or a dial that is moving during it and is bound to a visible prop. Message names the sentence text and its times.
- **Stillness** (ERROR over 3.5 s, WARN over 2.5 s): the longest stretch in which no prop state is changing (camera drift, spin, bob and idle motion do not count; overlays do not count).
- **Subject persistence** (WARN): more than 6 different environments in one show, or no prop that is on screen for at least 30% of the video.
- Calibration: `shows/chameleon` must pass; `shows/moon-gone` and `shows/sky-blue` as committed today must FAIL (keep copies of both under `tests/fixtures/` as the "slideshow" fixtures).

## Part 5 — the writer (owner: `pipeline/prompts/**`, `pipeline/writer.py`, `pipeline/catalog_text.py`, tests, `docs/WRITER.md`)

1. **Script and picture are planned together.** One call returns the script AND a beat list: for each sentence, `subject` (which persistent thing we are looking at), `change` (what visibly changes while it is spoken, as a verb), `dial` if a value drives it. A script whose sentences have no showable change is rewritten before any voice is made.
2. **Script shape** (from the chameleon script): hook that states a belief or question → "here is what really happens" → ONE mechanism followed through 2-3 zoom levels or stages → one analogy shown as an object → why it matters → closing question. One subject, one causal chain. 150-180 words, under 58 s.
3. **Show rules**: 2-4 scenes (runs of continuing shots), not 8 rooms; a hero prop that stays; at least one dial bound to two or more things; cause and effect in the same frame where possible; labels name parts, they do not carry the explanation.
4. **Missing mechanism**: if the catalogue has no prop that can show the central mechanism changing, answer `feasible: false` with the mechanism it needs (one paragraph: what it looks like, what varies). Do not substitute icons and bars. The topic goes to `queue/needs-props/`.
5. Worked examples in the prompt: the chameleon remake, plus one new show built the same way by the helper and checked with eyes.
6. Re-test with fresh agents in `files` mode on 2 topics, as before.

## Lower priority (only after parts 1-5)
The earlier list: video length, prop fixes (`wave`, `sun`, `planet` tilt, `particles`, `heart`, `bird`, `bomb_blast`, `magnet`), hidden-prop check, picture check waiting for memory, `--topic` queue handling, empty system section in the fact-check prompt, validator hint for `offset` beside `at`.

## Suggested split
Helper A (Opus): parts 1 and 4. Helper B (Sonnet), after A's dials land: part 2, then part 3 with A's help on gaps. Helper C (Opus): part 5 after part 3 passes.
