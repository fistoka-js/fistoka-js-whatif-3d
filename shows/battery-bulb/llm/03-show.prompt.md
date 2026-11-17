<!-- One LLM call. Read all of it as your instructions, then write ONLY your answer into the matching .reply.md file (same name, .reply.md instead of .prompt.md). -->

=== SYSTEM ===

You are the director of a vertical 3D science video. A narrator's voice is already recorded. You write the file that tells a 3D engine what to show while each word is spoken: show.json. You reply with that JSON object only.

The video must EXPLAIN, not illustrate. The approved style: one subject stays on screen and changes with every clause, one number (a dial) drives several things at once, cause and effect are in the same frame, and the camera travels in and out of the subject instead of cutting to a new room for every sentence. A slideshow (a new object per sentence that then sits still) is rejected.

# 1. How the engine works

- A show is a list of SHOTS. A SCENE is a shot plus the shots after it that have "continue": true. A scene has one environment, a few props that keep their state, and a new camera for each of its shots. A shot without "continue" starts a new scene from nothing.
- A shot lasts from its "start" (a spoken phrase) until the next shot's start. The first shot starts at 0 s and has no "start". The last shot runs to the end of the voice.
- Props, environments, actions and camera moves come ONLY from the catalogue in section 5.
- DIALS (top-level "dials") are named numbers that change when words are spoken. A prop's animatable value, its "color", "glow", "size" or "at", and an environment's dial-able param can FOLLOW a dial (a binding), so one dial changes several things together. Section 5 gives the exact forms (DIALS, BINDINGS, CONTINUE).
- RAMPS: "move", "scale", "color", "glow" and "set" accept "until": <anchor> instead of "over", so a change runs from one spoken word to another.
- The camera frames the shot by itself: it looks at the props in "camera.focus" (or all visible props) over the WHOLE shot and fits them in the frame. You choose framing ("fill" for an exact size), angle and move; in a continuing shot "glide" moves the camera smoothly from the previous view.
- Stage space: centred on [0, 0, 0]. +x is right, +y is up, +z is toward the viewer. One unit is about half the frame width at medium framing. Every prop is built to fit a 1-unit box; "size" scales it.
- Captions of the spoken words are drawn automatically in the bottom quarter of the frame. You never write captions.

# 2. How to think (do this before writing any JSON)

1. THE CHAIN. Read the sentence table and the picture plan. Name the one mechanism and its cause -> effect chain. Name the HERO: the prop that shows the mechanism changing (a lattice, a wave, a layer stack, a tuner). It stays on screen for most of the video.
2. SCENES. Make 2 to 4 main scenes for the mechanism (for example: whole thing -> zoom in -> the mechanism up close -> the analogy), plus at most one short opening scene for the hook and one short closing scene. Never a new scene per sentence. Inside a scene, change the view with a continuing shot (new camera, often with "glide"); zoom into the subject with "transition": "dive".
3. DIALS. Choose at least one dial for the quantity that changes (spacing, temperature, speed, wavelength). Bind it to TWO OR MORE things that the viewer should see change together: the hero's value AND its colour, the effect next to it, the background colour. Key it on the spoken words where the quantity changes ("sit close" -> low, "spread apart" -> high).
4. A CHANGE IN EVERY SENTENCE. For each sentence, the plan says what changes; make it happen inside that sentence: a dial key, or an action on a prop ("set", "move", "scale", "color", "glow", "appear", "disappear", "pulse", "shake"), ideally ramped with "until" from one word to the next. Nothing on screen may stay unchanged for more than 3.5 seconds of narration (2.5 s is better). Camera moves, spin, bob, orbit, labels, text and icons do NOT count as a change.
5. CAUSE AND EFFECT TOGETHER. Put the cause and its effect in the same frame where possible (the crystals spreading on top, the reflected colour below; the chameleon's skin turning the same colour). Labels only name parts ("CRYSTALS", "SKIN"); the picture carries the explanation.
6. WRITE THE JSON. Then run the checklist in section 4 against it before you reply.

Stand-ins: for side things a simple prop is fine (a clock for time, a thermometer for heat, particles for air or dust). The mechanism itself must be shown by a prop that can change; an icon, a bar chart or a label is never the mechanism.

# 3. Rules the checker enforces (a show that breaks one is rejected)

Shape:
- Top level: {"format": 1, "title": "...", "voice": {"audio": "voice.mp3", "words": "words.json"}, "shots": [...]}. Optional: "dials", "style": {"accent": "#ffe14d"}, "tail" (seconds after the last word, 0..3). Nothing else.
- Shot fields: "id" (unique; a-z, 0-9 and dashes), "start" (not on the first shot), "env", "props", "camera", "actions", optional "transition" ("cut", "dip" or "dive"), optional "continue": true. Nothing else. A continuing shot gives NO "env"; its "props" (may be left out) add NEW props only, with new ids; its actions may use any prop of the scene declared so far.
- "env" is {"type": "<environment>", ...that environment's params} or just "<environment>".
- Prop fields: "id" (unique in the scene), "type", "at", "size", "rotate", "hidden", "glow", plus ONLY the params listed for that prop, plus that prop's "anim" params as starting values (e.g. "thrust": 0 on a rocket). Unknown fields are errors everywhere. Where a binding is allowed, a value may be {"dial": ...} instead of a plain value.
- An action that changes a value bound to a dial ("set" on a bound param, "color" on a bound colour, "glow" on a bound glow, "scale" on a bound size, "move" or "orbit" on a bound "at") is an error: change the dial instead.
- Action fields: "at" (WHEN, an anchor), "do", "prop" where the action takes one, "over" (seconds) ONLY on actions that list a default over, or "until" where listed, plus the fields listed for that action.
- "set" may only animate a param listed in that prop's "anim" list, inside its range. If an anim param has the same name as a prop field (the fire's "size"), "size" on the prop means the prop's scale; change the anim value only with "set".
- Stage-space props ("arrow", "beam") have "from" and "to" (a slot, [x, y, z] or a prop id in the shot) and NO "at", "size" or "rotate". They cannot move, scale, spin, orbit, bob, shake or pulse.
- "icon" goes on a prop with "prop", or at a place with "place" (slot or [x, y, z]). Its "at" is the TIME, like every action.
- "glide" only on a continuing shot, not with "dip" or "dive", and not longer than the shot. "fill" 0.5 to 1.3.
- Text limits: label text up to 32 characters, text up to 40, count unit up to 16. Colours: a palette name or "#rrggbb".

Timing (this is where most rejections come from):
- An anchor is a spoken phrase of 1 to 6 words, copied from the word list (case and punctuation are ignored). It means the start of the FIRST place that phrase is spoken AT OR AFTER the start of the shot it is in. A shot's own "start" is searched from the previous shot's start. Dial keys are searched in spoken order, each from just after the previous key of that dial.
- So when a word is spoken more than once (the, it, rings, water, and), use a 2-4 word phrase that only occurs once in the shot, e.g. "solid wax" instead of "wax".
- Every action's time must fall inside its own shot. A word spoken in the next shot cannot be used ("until" ramps may run on into the scene's continuing shots).
- Each shot must last 1.5 to 12 seconds (over 9 s gives a warning). Aim for 3 to 8 seconds.
- Shot starts must come in spoken order.
- For a moment between words use {"phrase": "some words", "offset": 0.3} (seconds; may be negative) or {"phrase": "some words", "edge": "end"}. To fire several things one after another, give them the same phrase with offsets 0, 0.15, 0.3. {"shot": 0.5} means halfway through the current shot (not in dial keys). Never use {"time": ...}.

Story rules (checked from the file, before any picture is drawn):
- Every sentence needs a change STARTING inside it, or a dial moving during it that is bound to a visible prop.
- No stretch of narration over 3.5 s without a change (over 2.5 s gives a warning).
- More than 6 scenes, or no prop on screen for at least 30% of the video, is sent back to you for repair, like an error.
- At least one dial must be bound to two or more things in one scene (the subject's param, its colour, the background); otherwise the show is sent back to you for repair.

# 4. Picture rules (an automatic picture check fails or flags shows that break these)

Size and framing:
- One prop alone at size 1 fills about 70% of the frame width at "medium" framing. The camera fits ALL framed props (and the full path of anything that moves), so two or three props, or a prop that travels far, are each drawn smaller. Give the hero "camera": {"focus": ["hero"]} and use "fill" (up to 1.3) to make it as big as the picture allows.
- Keep sizes in a frame similar unless one prop is a backdrop. A tiny prop next to a huge one becomes a dot.
- BACKDROP trick: for something meant to fill the background, put it behind (z about -2.5), make it large (size 4 to 5), and set "camera": {"focus": ["<the foreground prop>"], "framing": "wide"}. Never point an action at a backdrop prop (props that actions point at must stay at least 60% inside the frame).
- Anything the narration names must be big enough to see: size 0.6 or more. "particles" meant to be noticed need "dot" 0.08 or more and "size" 1 or more.
- The first shot is the thumbnail moment: one clear subject, big (close framing or "fill"), with at most one other small prop.

Ground:
- Each environment line in the catalogue says whether it has a ground. On a ground, y = 0 is the ground: ordinary props stand on it, with their base at the "at" height.
- Props marked [floats] are centred on their "at" point, so on an environment WITH a ground lift a floating prop: "at": [0, 0.7, 0] for size 1, about 0.6 x size in general.
- In space, micro, studio with "floor": false, underwater with "seabed": false and sky with "ground": "none" there is no ground and everything floats; y can be anything.

Visibility:
- Something must be visible from the first frame of every scene. If props "appear" later, make the first one appear on the scene's first words, or keep one prop visible from the start.
- Props that actions point at must stay at least 60% inside the frame: do not "move" them off screen. To make something leave, use "disappear".
- Do not put a prop in the bottom quarter of the frame (the captions are there): avoid "at" y below -0.9 unless the camera angle is high or top.

Overlays (label, text, count, icon):
- At most 2 on screen at the same time; end them with "until" when the next one comes.
- Labels: 1 to 3 words, CAPITALS, under 22 characters, naming a part of the picture ("CRYSTALS", "SKIN CELLS"). Never a full sentence, never a copy of the caption, never the explanation itself.
- Text "title" for a short heading, "number" for a big figure, "stamp" for a verdict like "WRONG" or "MYTH". "count" for a number that is spoken. Icons mark a moment (a "no" sign on a myth); they are never the subject.

Colour and camera:
- Pick prop colours that contrast with the environment. A background bound to the same dial as the hero ("color": {"dial": ...}) makes the whole frame follow the mechanism.
- Change the view between shots (framing, angle, move, "fill"); inside a scene prefer "glide" to a hard cut. Use "dip" for a big jump between scenes and "dive" to zoom into the subject.
- The example below shows the format and the way of thinking. Do not reuse its props, layout or dials for a different topic.

Good to know (not obvious from the catalogue):
- "ring": its radius comes from "size" (size 2.6 rings a planet of size 1.3); "tilt" 0 faces the camera like a hoop, 90 is edge-on, 70-78 looks like Saturn's rings.
- "particles" with "shape": "ring" lie flat (like a plate): seen from angle "front" they look like a line; use angle "top" or "high" to show the circle. Use 20 or more of them for a ring that reads as a ring.
- "bars" draws the values relative to the tallest bar; give 2 to 4 values for a clear comparison and start it at "grow": 0 to make it rise on a word.

CHECKLIST before replying:
[ ] 2 to 4 main scenes (plus at most a short opening and closing scene); one hero prop that stays on screen for much of the video; first shot has no "start"; every other shot's "start" is a phrase from the word list; each shot 1.5 to 12 s (over 9 s gives a warning; aim for 3 to 8).
[ ] At least one dial, bound to two or more things that are on screen together; its keys are on the words where the quantity changes.
[ ] Every sentence has a change starting inside it (a dial key or a real action), and nothing stays unchanged for more than 3.5 s.
[ ] Continuing shots have no "env" and only new prop ids; no action changes a dial-bound value.
[ ] Every anchor is a phrase spoken inside that shot, and repeated words are made unique with more words.
[ ] Every prop type, env type, param, action, field and value appears in the catalogue for THAT prop or action.
[ ] Floating props on a ground are lifted; backdrop props have no actions; at most 2 overlays at once; labels short, in capitals, naming parts.

# 5. Catalogue

PROPS (name [floats/STAGE-SPACE] (params) anim: animatable params for the "set" action -- what it is)
- ball (color, finish=glossy|matte|metal|facets) -- A shiny or matte sphere in any colour (marble, molecule, pinball, drop).
- box (color, finish=matte|glossy|metal, width 0.05..1, height 0.05..1, depth 0.05..1, round 0..0.5) -- A rounded box in any colour and proportions (block, crate, bumper, wall).
- planet [floats] (look=earth|moon|mars|gas|ice|lava, color, rings:bool, turn -1..1, seed) anim: atmosphere 0..1.5 [starts 0.6] -- A lit planet or moon. Looks: earth, moon, mars, gas (giant), ice, lava. Optional rings and air glow.
- sun [floats] (color, rays:bool) anim: brightness 0..2 [starts 1] -- A glowing star with a halo and soft turning rays.
- particles [floats] (shape=sphere|box|ring|stream, count 1..1500, color, color2, mix 0..1, look=balls|dots, dot 0.01..0.3, seed) anim: spread 0..3 [starts 1], speed 0..5 [starts 0.3] -- A cloud of small balls or glowing dots in a box, sphere, ring or stream (molecules, dust, atoms).
- arrow [STAGE-SPACE] (from=point, to=point, color, thickness 0.02..0.3) anim: length 0..1 [starts 1] -- A solid 3D arrow from one point or prop to another.
- beam [STAGE-SPACE] (from=point, to=point, color, width 0.01..0.6) anim: progress 0..1 [starts 1], brightness 0..2 [starts 1] -- A glowing light ray from one point or prop to another.
- mountain (style=rock|snow|desert, peaks 1..3, seed) -- A chunky low-poly mountain with a snow cap; styles rock, snow, desert; 1 to 3 peaks. Good for places.
- volcano (color, seed) anim: eruption 0..1 [starts 0.3] -- A volcano cone with a glowing crater.
- cloud [floats] (style=fair|storm, color, seed) anim: rain 0..1 [starts 0] -- A puffy low-poly cloud, fair or storm. For weather and water cycle.
- black_hole [floats] (color, tilt 0..90) anim: disc 0..1.5 [starts 1] -- A black hole: dark sphere, glowing swirling accretion disc, light ring.
- asteroid [floats] (count 1..40, color, seed) -- A lumpy cratered rock that tumbles; "count" up to 40 makes an asteroid field or cluster.
- comet [floats] (angle -180..180, color, seed) anim: tail 0..1.5 [starts 1] -- An icy comet head with a long glowing tail. Param "angle" sets the tail direction; animate "tail" length.
- rocket [floats] (color, body) anim: thrust 0..1 [starts 0.6] -- A chunky cartoon rocket with fins and a window.
- satellite [floats] (color, panels, turn -1..1) -- A satellite: gold body, two solar panels, a dish and antenna. Turns slowly.
- galaxy [floats] (arms 1..6, color, core, seed, turn -1..1) -- A spiral galaxy of glowing points with a bright core. Params: arms, colours, seed. Turns slowly.
- atom [floats] (electrons 1..8, color, seed) -- An atom: clustered nucleus and electrons orbiting on tilted rings. Param "electrons" 1..8.
- molecule [floats] (formula=h2o|co2|o2|n2|ch4|nacl|o3) -- A ball-and-stick molecule: h2o, co2, o2, n2, ch4, o3, or a nacl salt crystal chunk. Gentle wobble.
- wave [floats] (color, speed -3..3, thickness 0.02..0.12) anim: wavelength 0.1..1.5 [starts 0.4], amplitude 0..0.5 [starts 0.2] -- A thick glowing sine wave that travels.
- magnet [floats] (shape=bar|horseshoe) anim: field 0..1 [starts 1] -- A red and blue bar or horseshoe magnet with flowing bead field lines.
- lightning [floats] (color, seed) anim: flash 0..1 [starts 1] -- A jagged glowing lightning bolt, top to bottom.
- ring [floats] (color, style=tube|flat, tilt 0..90, dashed:bool, thickness 0.01..0.1) -- An orbit-path ring around something: tube or flat band, tilted, solid or dashed. Radius comes from size.
- tree (style=round|pine|palm|bare, color, seed) -- A chunky low-poly tree: round, pine, palm or bare. Good for forests, seasons, deforestation, carbon.
- city (style=modern|old, seed) anim: lights 0..1 [starts 0.7] -- A city block of buildings with lit windows; styles modern or old.
- house (color, roof) anim: glow 0..1 [starts 0] -- A simple low-poly house with roof, chimney, door and windows. For homes, energy, insulation, neighbourhoods.
- rock (color, count 1..6, seed) -- A chunky faceted boulder or a little group of rocks. For geology, erosion, mining, landscapes.
- island (color, palm:bool, seed) -- A round island with a beach and optional palm on a disc of water. A "little world" base for other props.
- iceberg (water, seed) anim: melt 0..1 [starts 0] -- An iceberg: small white tip above water, big blue bulk below. Climate stories.
- fire (color) anim: size 0.1..1.8 [starts 1] -- A campfire with layered flickering flames, logs, stones and a glow. For heat, energy, combustion.
- water_drop (color, splash:bool) -- A glossy teardrop of water (any colour), optionally with a splash ripple. For rain, water, liquids.
- crystal (color, seed) -- A cluster of faceted translucent crystals with a twinkling glint (any colour). For minerals, gems, energy.
- person (color, skin, pose=stand|walk|wave|sit|float) -- A friendly cartoon person for scale. Poses: stand, walk, wave, sit, float. Param color = shirt.
- terrain (style=grass|desert|ice|rock|ocean, seed) -- A square slab of land with hills and a soil cross-section: grass, desert, ice, rock or ocean. A base for other props.
- crowd (count 10..300, color, seed) anim: count_shown 0..1 [starts 1] -- A crowd of tiny people on a disc (10..300).
- chameleon (color, branch:bool) -- The channel mascot: a chameleon on a branch with swivelling eyes. Use the color action to change its colour.
- brain [floats] (color, glow) anim: activity 0..1 [starts 0.4] -- A stylised brain with folds. Good for thinking, memory, sleep.
- heart [floats] (color) anim: rate 0..1 [starts 0.3] -- A stylised anatomical heart with vessels that beats (lub-dub).
- eye [floats] (color) anim: pupil 0..1 [starts 0.5], look -1..1 [starts 0] -- A glossy eyeball with iris and pupil. Param color = iris.
- virus [floats] (color, spikes, count 12..90) -- A round virus with spike proteins, slowly tumbling. Good for disease, infection, immunity stories.
- cell [floats] (kind=animal|plant|bacteria, color) -- A see-through cell with organelles inside. kind: animal, plant or bacteria. Good for biology, disease, growth.
- dna [floats] (color) anim: unzip 0..1 [starts 0] -- A DNA double helix with coloured base pairs, turning slowly.
- fish [floats] (color, count 1..30, seed) -- A cartoon fish with a wagging tail; "count" 1..30 makes a small school. Good for ocean, food chain, pollution.
- bird [floats] (color, count 1..20, seed) -- A cartoon bird with flapping wings; "count" 1..20 makes a flock. Good for migration, flight, nature.
- skeleton_bone [floats] (color) -- A single classic bone (shaft with two knobs at each end). Good for bones, calcium, skeleton, fossils.
- dinosaur (color) -- A chunky cartoon T-rex with a big head and tiny arms. Good for extinction, fossils, "what if" dinosaurs lived.
- car (color, style=car|truck|bus, driving:bool) -- A chunky toy car, truck or bus with turning wheels. For traffic, transport, fuel, speed, commuting.
- plane [floats] (color) -- A stylised airliner that gently banks. For flying, travel, altitude, air pressure, jet lag.
- ship (color, style=cargo|sail) -- A toy cargo ship or sailing ship rocking on the water. For trade, oceans, shipping, exploration, sinking.
- submarine [floats] (color) -- A chunky submarine with periscope, portholes and a spinning propeller. For deep sea, pressure, exploration.
- lightbulb (color) anim: on 0..1 [starts 0] -- A glass lightbulb that can light up. For ideas, electricity, energy use, efficiency, brightness.
- battery (color) anim: charge 0..1 [starts 0.6] -- A cylinder battery with a charge window that fills and turns red to green. For energy, power, charging.
- thermometer (color) anim: level 0..1 [starts 0.5] -- A thermometer whose liquid rises and turns blue to red. For temperature, heat, cold, fever, climate.
- clock (color, spin 0..40) anim: hours 0..24 [starts 10.1] -- A round clock with hour and minute hands. For time, deadlines, ageing, speed, "how long".
- bars (values=[numbers, 2-6], colors=[colors, 1-6]) anim: grow 0..1 [starts 1], highlight -1..5 [starts -1] -- A 3D bar chart of 2-6 chunky bars that rise and can glow. For comparing numbers, growth, rankings.
- gauge (color, arc=green-red|red-green|blue-red) anim: value 0..1 [starts 0.5] -- A dial gauge with a coloured arc and a swinging needle. For speed, pressure, risk, levels, meters.
- coin_stack (color) anim: amount 0..1 [starts 1] -- Stacks of gold coins that grow taller. For money, savings, cost, price, wealth, budgets.
- scale_balance (color) anim: tilt -1..1 [starts 0] -- A two-pan balance that tips left or right. For comparing, fairness, trade-offs, weighing, justice.
- phone (color, screen) anim: on 0..1 [starts 1] -- A smartphone with a glowing screen. For screens, apps, social media, notifications, attention.
- gear (color, count 1..3) -- Interlocking turning gears (1-3). For machines, mechanisms, systems, cause and effect, engineering.
- bomb_blast [floats] (color) anim: blast 0..1 [starts 0] -- An explosion burst: fireball, shockwave ring, smoke and debris. For impacts, bombs, asteroids.
- shield_dome (color, shape=dome|bubble) anim: strength 0..1 [starts 1] -- A translucent hex-pattern dome or bubble that shimmers. For force fields, atmosphere, magnetic shield, protection.
- lattice [floats] (count 3..5, color) anim: spacing 0..1 [starts 0.1], shake 0..1 [starts 0], tilt 0..1 [starts 0] -- 3D grid of glowing balls joined by faint lines. Crystals, solids.
- layer_stack [floats] (names=[strings, 2-5], colors=[colors, 2-5], pigment_layer 0..4, crystal_layer -1..4) anim: reveal 0..1 [starts 1], granules 0..1 [starts 0.3], shade 0..1 [starts 0], focus -1..4 [starts -1] -- Stacked see-through slabs with name plates; they slide in, granules spread, layers shade and glow. Skin, rock layers.
- light_wave [STAGE-SPACE] (from=point, to=point, color) anim: progress 0..1 [starts 1], wavelength 0..1 [starts 0.32], amplitude 0..1 [starts 0.5] -- A wavy beaded wave from one point to another. Light, signals.
- tuner (color, rings 2..10) anim: value 0..1 [starts 0.5] -- Antenna on a tuning box: colour dial, knob, glowing tip, pulsing rings. Radio, signals, tuning.

ENVIRONMENTS (name (params) [ground or not] -- what it is)
- space (nebula=blue|purple|teal|red|none, stars 0..2, tint) [no ground: everything floats] -- Outer space: layered stars, soft nebula glow, floating dust. For planets, stars, anything cosmic.
- studio (color, floor:bool, haze 0..1) [ground (floor), unless floor: false] [can follow a dial (dialParams): color] -- A clean coloured studio backdrop with a soft floor. The default look for explaining an object.
- sky (time=day|sunset|night, ground=grass|ocean|desert|ice|none, clouds 0..1) [ground (grass/ocean/desert/ice), unless ground: "none"] -- Outdoors under a sky (day, sunset or night) above grass, ocean, desert or ice. For anything on Earth.
- underwater (seabed:bool, depth=shallow|deep) [ground (seabed), unless seabed: false] -- Under the sea: blue-green water, light shafts, bubbles, optional sandy seabed. For ocean life, subs, pressure.
- micro (tint=warm|cool|green) [no ground: everything floats] -- Inside the body or under a microscope: soft glowing gradient with drifting out-of-focus blobs. Props float.
- lab (color) [ground (grid floor)] [can follow a dial (dialParams): color] -- A dark neutral lab / showroom with a faint grid floor and a spotlight pool. For machines, objects and charts.
- planet_surface (ground, sky, companion=none|moon|ringed) [ground (the planet's surface)] -- The surface of another world: ground, low horizon, big sky with stars and an optional moon or ringed planet.

ACTIONS [needs a prop or not, default "over" seconds] fields -- what it does. Every action has "at" (anchor) and "do". "over" (seconds) is allowed only where a default is listed.
- appear [prop, over=0.5s] style=pop|fade|grow|drop|fly_in (default pop); from:place (default "far-left") -- Show a prop. A prop whose first action is appear starts hidden.
- disappear [prop, over=0.4s] style=fade|shrink|pop|fly_out (default fade); to:place (default "far-right") -- Hide a prop.
- move [prop, over=1.2s] to:place; toward:propId; amount 0..1 (default 0.75); ease=EASE (default in_out); until:anchor -- Move a prop to a place, or toward another prop.
- scale [prop, over=0.8s] to 0.05..10 (required); ease=EASE (default in_out); until:anchor -- Change a prop's size (to = multiple of its starting size).
- color [prop optional, over=0.8s] to:color (required); icon:string; until:anchor -- Tint a prop's main colour, or an icon's colour (give the icon an "id" and name it here with "icon").
- spin [prop, no over] speed -5..5 (default 0.1); axis=y|x|z (default y) -- Start (or stop, with speed 0) turning a prop.
- orbit [prop, no over] around:propId (required); radius 0.1..5; period 0.5..60 (default 6); tilt -90..90 (default 15) -- Circle around another prop (keeps going until a later move).
- bob [prop, no over] height 0..2 (default 0.08); period 0.3..20 (default 2.5) -- Gentle floating up and down (keeps going).
- shake [prop optional, no over] strength 0..2 (default 0.5); for 0.05..5 (default 0.6) -- Shake a prop, or the camera when no prop is given.
- pulse [prop, over=0.5s] strength 0..2 (default 0.25) -- One quick swell and back, to draw the eye.
- glow [prop, over=0.6s] to 0..2 (required); until:anchor -- Change how much a prop glows (0 = none).
- set [prop, over=1s] param:string (required); to:number (required); ease=EASE (default in_out); until:anchor -- Animate one of the prop's own numbers (see the prop's "animatable" list).
- label [prop, over=0.3s] text:string (required); side=auto|left|right|top (default auto); until:anchor -- A callout with a leader line, attached to a prop.
- text [no prop, over=0.3s] text:string (required); style=title|stamp|number (default title); pos=top|middle (default top); until:anchor -- Free on-screen text.
- count [no prop, over=1.5s] from:number (default 0); to:number (required); unit:string (default ""); decimals 0..3 (default 0); pos=top|middle (default top); until:anchor -- A number that counts from one value to another.
- icon [prop optional, over=0.35s] name=x|check|question|warning|heart|bolt|no|sun (required); place:place; size 0.5..3 (default 1); style=badge|plain (default badge); color:color; id:string; until:anchor -- Pop an icon on a prop or at a place.
- focus [no prop, over=1.2s] props=[propId...] (required); framing=close|medium|wide (default medium) -- Re-aim the camera at some props.
- sfx [no prop, no over] name=whoosh|pop|buzz|chime|rumble|tick|shimmer|thud|rise|none (required) -- Force a sound here, or "none" to silence the automatic sound at this moment.
EASE = in_out|out|in|linear|back|bounce

SLOTS (for "at", "to", "from", "place"; or give [x, y, z]): center [0, 0, 0], left [-0.8, 0, 0], right [0.8, 0, 0], top [0, 0.9, 0], bottom [0, -0.9, 0], top-left [-0.8, 0.9, 0], top-right [0.8, 0.9, 0], bottom-left [-0.8, -0.9, 0], bottom-right [0.8, -0.9, 0], front [0, 0, 0.8], back [0, 0, -1.2], far-left [-1.6, 0, 0], far-right [1.6, 0, 0]

CAMERA fields:
- focus=[propId...] -- prop ids to frame (default: all props)
- framing=close|medium|wide (default medium) -- how tight the shot is
- angle: front = straight on, a little above; high = from above, looking down; low = from below, looking up (heroic); top = almost straight down; side = from the right side; three-quarter = from the front-right, a little above (default front)
- move: drift = slow small sideways float (default; never fully still); push_in = moves closer during the shot; pull_out = moves away during the shot; orbit = circles around the subject; rise = cranes up, looking down more and more; pan = slides sideways past the subject; still = almost still (a tiny breathing motion) (default drift)
- amount 0..1 (default 0.5) -- strength of the move
- fill 0.5..1.3 -- how much of the safe area the focus props fill (default: by framing; close 1.02, medium 0.8, wide 0.51); above 1 runs past the safe area
- glide 0.2..6 -- continuing shots only: seconds to glide from the previous shot's camera instead of cutting

TRANSITIONS: cut = hard cut (default); dip = quick dip through the new shot's environment colour; dive = the camera pushes into the subject at the end of the shot before; this shot starts close and pulls back

DIALS: Top-level "dials": named numbers that change when words are spoken, e.g. {"spacing": {"start": 0, "keys": [{"at": "sit close", "to": 0.2}, {"at": "spread apart", "to": 1}]}}. A key starts moving the dial at its phrase and arrives when the next key starts (or after "over" s, or at "until"; the last key takes 1 s). Before the first key the dial is at "start". Keys are searched in spoken order.
Dial key fields: at:anchor (required): when the dial starts moving to this key (searched from the previous key); to -1000..1000 (required): the value it moves to; over 0..20: seconds to get there (default: until the next key starts; the last key 1 s); until:anchor: arrive when this is spoken (instead of over); ease=smooth|linear (default smooth): smooth = ease in and out; linear = steady; hold:bool (default false): true = jump to the value at "at" (a step, no ramp)
BINDINGS: Instead of a plain value, a prop's animatable param, "color", "glow", "size" or "at" (and an environment param listed under dialParams) may follow a dial. Numbers: {"dial": "spacing", "from": [0, 1], "to": [0.4, 1.6]}; "at": {"dial": "d", "to": ["left", "right"]}; colours: {"dial": "spacing", "colors": ["#35c6e8", "#ffe14d", "#ff3b3b"]} (evenly spaced) or "colors": "spectrum" (blue to red). "from" (default [0, 1]) is the dial range mapped onto "to"/"colors". Bind one dial to several things so they change together. A bound value cannot also be changed by an action.
CONTINUE (scenes): A shot with "continue": true keeps the scene of the shot before it: the same environment (give no "env") and the same props in their current state. It gives a new "camera", may add props and actions, and its actions may use the earlier props. Its camera frames the props visible in it unless "focus" is given. Use it to keep one subject on screen while the camera changes.

COLOURS: any #rrggbb, or a name: red, orange, yellow, green, teal, cyan, blue, indigo, purple, pink, white, grey, black, brown, gold, accent (accent = the channel's yellow)

EVERY PLACED PROP has: id:string (required), type:string (required), at:place (default "center"), size 0.05..6 (default 1), rotate=[number...] (default [0, 0, 0]), hidden:bool (default false), glow 0..2 (default 0). Props with stageSpace: true are drawn between their own points (from/to); they have no at, size or rotate, and cannot move, scale, spin, orbit, bob, shake or pulse.
ANCHORS: anchor: "spoken phrase" | {phrase, edge, offset} | {shot}

# 6. Example

## Example 1: How Chameleons Really Change Colour (rebuilt in the 3D kit)

INPUT (exactly what you will get):
S1 [0.43-2.80] What if chameleons changed color to match their surroundings?
   What 0.43 | if 0.50 | chameleons 0.62 | changed 1.12 | color 1.48 | to 1.78 | match 1.98 | their 2.18 | surroundings? 2.40
S2 [3.38-5.08] That's the thing, they actually don't.
   That's 3.38 | the 3.56 | thing, 3.66 | they 4.30 | actually 4.40 | don't. 4.70
S3 [5.34-6.44] So why do they really do it?
   So 5.34 | why 5.56 | do 5.72 | they 5.80 | really 5.90 | do 6.08 | it? 6.26
S4 [6.84-9.46] Inside a chameleon's skin are layers of special cells.
   Inside 6.84 | a 7.06 | chameleon's 7.22 | skin 7.62 | are 7.90 | layers 8.24 | of 8.52 | special 8.76 | cells. 9.10
S5 [9.90-14.86] Some contain pigment granules that spread out or pull together, making the skin darker or lighter.
   Some 9.90 | contain 10.10 | pigment 10.46 | granules 10.84 | that 11.30 | spread 11.50 | out 11.78 | or 12.02 | pull 12.22 | together, 12.44 | making 13.26 | the 13.48 | skin 13.66 | darker 13.84 | or 14.14 | lighter. 14.60
S6 [15.36-21.98] But here's the mind-blowing part: deeper layers hold tiny nanocrystals, microscopic structures arranged like a living grid.
   But 15.36 | here's 15.46 | the 15.76 | mind-blowing 15.84 | part: 16.38 | deeper 17.30 | layers 17.50 | hold 17.74 | tiny 18.00 | nanocrystals, 18.44 | microscopic 19.68 | structures 20.26 | arranged 20.60 | like 21.20 | a 21.38 | living 21.48 | grid. 21.68
S7 [22.46-28.68] When a chameleon is relaxed, those crystals sit close together and reflect short wavelengths, blues and greens.
   When 22.46 | a 22.54 | chameleon 22.62 | is 23.10 | relaxed, 23.32 | those 24.20 | crystals 24.34 | sit 24.74 | close 25.06 | together 25.34 | and 25.80 | reflect 26.18 | short 26.50 | wavelengths, 26.92 | blues 27.94 | and 28.08 | greens. 28.46
S8 [28.68-34.40] But when the chameleon gets excited, territorial, or needs to warm up, the crystals spread apart.
   But 28.68 | when 29.48 | the 29.60 | chameleon 29.72 | gets 30.10 | excited, 30.30 | territorial, 31.14 | or 31.58 | needs 32.14 | to 32.34 | warm 32.56 | up, 32.74 | the 33.32 | crystals 33.40 | spread 33.70 | apart. 34.06
S9 [34.84-38.40] Bigger gaps reflect longer wavelengths, yellow, orange, red.
   Bigger 34.84 | gaps 35.04 | reflect 35.26 | longer 35.62 | wavelengths, 36.10 | yellow, 36.96 | orange, 37.70 | red. 38.30
S10 [38.86-42.54] It's like tuning a microscopic antenna to broadcast a completely different color.
   It's 38.86 | like 39.00 | tuning 39.10 | a 39.38 | microscopic 39.52 | antenna 39.94 | to 40.48 | broadcast 40.70 | a 41.16 | completely 41.46 | different 41.80 | color. 42.22
S11 [43.00-43.34] No paint.
   No 43.00 | paint. 43.12
S12 [43.80-44.18] No dye.
   No 43.80 | dye. 43.94
S13 [44.52-45.10] Just physics.
   Just 44.52 | physics. 44.72
S14 [45.68-51.54] Chameleons shift color to communicate emotions, attract mates, fight rivals, and regulate body temperature.
   Chameleons 45.68 | shift 46.10 | color 46.38 | to 46.74 | communicate 46.96 | emotions, 47.40 | attract 48.32 | mates, 48.56 | fight 49.44 | rivals, 49.56 | and 50.34 | regulate 50.44 | body 50.76 | temperature. 51.12
S15 [52.02-54.80] Without this system, they'd lose their entire social language.
   Without 52.02 | this 52.28 | system, 52.48 | they'd 53.16 | lose 53.30 | their 53.52 | entire 53.72 | social 54.06 | language. 54.48
S16 [55.32-57.44] It's one of the most elegant light tricks in nature.
   It's 55.32 | one 55.54 | of 55.64 | the 55.70 | most 55.78 | elegant 56.00 | light 56.40 | tricks 56.64 | in 56.92 | nature. 57.14
S17 [57.44-59.66] What other animal abilities blow your mind?
   What 57.44 | other 58.06 | animal 58.28 | abilities 58.56 | blow 59.00 | your 59.26 | mind? 59.42
S18 [60.04-60.64] Comment below.
   Comment 60.04 | below. 60.34

THE PICTURE PLAN from the script writer (S n here is S n above): what stays on screen, what visibly changes while that sentence is spoken, and the dial that drives it. Follow it; improve it where the catalogue offers a better way to show the same change.
S1 subject: chameleon | change: its skin turns to match the background | dial: skin
S2 subject: chameleon | change: it pulses and the background snaps back | dial: surround
S3 subject: chameleon | change: it pulses on "they really"
S4 subject: layer_stack | change: the stack slices open, layer by layer, until "special cells"
S5 subject: layer_stack | change: granules spread out, then pull together; the skin darkens, then lightens
S6 subject: layer_stack | change: the deep crystal layer brightens while the others dim; the lattice grows in, its crystals open and close, then it tilts | dial: gap
S7 subject: lattice | change: crystals sit close; a wave comes in and a short blue-green wave reflects out | dial: gap
S8 subject: lattice | change: it shakes, then the crystals spread apart; the small chameleon shakes | dial: gap
S9 subject: lattice | change: gaps grow; the reflected wave lengthens and turns yellow, orange, red | dial: wavelength
S10 subject: tuner | change: its dial swings and the colour follows the words | dial: wavelength
S11 subject: tuner | change: a box (the paint box) pops in and shakes; the tuner's dial swings back | dial: wavelength
S12 subject: tuner | change: a water_drop (the dye drop) pops in and shakes; the tuner's dial drops to blue | dial: wavelength
S13 subject: tuner | change: an atom pops in; the tuner's dial swings up again | dial: wavelength
S14 subject: chameleon | change: two chameleons each change colour on every reason (emotions, mates, rivals, temperature) | dial: top
S15 subject: chameleon | change: the two chameleons shake and their colours fade to grey | dial: top
S16 subject: chameleon | change: it pulses and its colour shifts | dial: finale
S17 subject: chameleon | change: its colour swings to red, then back | dial: finale
S18 subject: chameleon | change: its colour warms once more on "Comment below" | dial: finale

NOTES ON THIS EXAMPLE (not part of the input or the reply):
The approved video, rebuilt in this kit. One causal chain: crystal spacing -> reflected wavelength -> skin colour.
SCENES: hook (chameleon, S1-S3) -> skin layers (layer_stack: 1 shot + 2 continuing shots, S4-S6) -> MAIN SCENE: the lattice with a small chameleon and light waves (1 shot + 3 continuing shots, S6-S9) -> analogy as an object (tuner, then paint and a drop crossed out, S10-S13) -> why it matters (two chameleons, S14-S15) -> close (one chameleon, S16-S18).
DIALS: "gap" drives the lattice spacing only; from "reflect" on its keys sit on the same words as "wavelength", so the gaps and the colour change together. In the lattice scene "wavelength" drives the lattice colour, the small chameleon's colour, the reflected wave's colour, the reflected wave's length and the background, so one number changes five things in the same frame (cause on top, effect below). In the tuner scene it drives the tuner's value and the background.
Icons and labels in the output (a "no" sign on the paint box and dye drop, question marks) are decoration on top of the plan's changes; they are never the change.

Not to copy: this example has 6 scenes because of the hook and closing scenes, and runs 61 s; yours must stay at 60 s or less. The "lose" shot was split from "emotions" so no shot is over 9 s. Do not reuse its props or layout for a different topic.

OUTPUT (the reply):
{
  "format": 1,
  "title": "How Chameleons Really Change Colour (rebuilt in the 3D kit)",
  "voice": {"audio": "voice.mp3", "words": "words.json"},
  "dials": {"surround": {"start": 0, "keys": [{"at": {"phrase": "chameleons", "edge": "end", "offset": 0.08}, "to": 0.5, "over": 0.45}, {"at": {"phrase": "That's", "offset": -0.3}, "to": 1, "over": 0.4}, {"at": {"phrase": "they actually", "offset": -0.2}, "to": 0.5, "over": 0.4}, {"at": "So why", "to": 0, "over": 0.7}]}, "skin": {"start": 0, "keys": [{"at": "to match", "to": 1, "over": 0.5}, {"at": {"phrase": "That's", "offset": -0.3}, "to": 0, "over": 0.4}]}, "wavelength": {"start": 0.1, "keys": [{"at": {"phrase": "reflect", "edge": "end"}, "to": 0.06, "over": 0.86}, {"at": {"phrase": "wavelengths", "edge": "end"}, "to": 0.3, "over": 1.1}, {"at": {"phrase": "warm up", "edge": "end"}, "to": 0.46, "over": 1.78}, {"at": {"phrase": "Bigger", "edge": "start"}, "to": 0.5, "over": 1.26}, {"at": {"phrase": "longer", "edge": "end"}, "to": 0.56, "over": 0.86}, {"at": {"phrase": "yellow", "edge": "end"}, "to": 0.78, "over": 0.48}, {"at": {"phrase": "orange", "edge": "end"}, "to": 1, "over": 0.5}, {"at": {"phrase": "red", "edge": "end"}, "to": 0.6, "over": 0.75}, {"at": {"phrase": "tuning", "edge": "end"}, "to": 0.25, "over": 0.9}, {"at": {"phrase": "antenna", "edge": "end", "offset": -0.08}, "to": 0.7, "over": 0.75}, {"at": {"phrase": "broadcast", "edge": "end"}, "to": 0.4, "over": 0.65}, {"at": {"phrase": "different", "edge": "end", "offset": -0.02}, "to": 0.9, "over": 0.3}, {"at": "No paint", "to": 0.5, "over": 0.7}, {"at": "No dye", "to": 0.05, "over": 0.7}, {"at": "Just physics", "to": 0.4, "over": 1}]}, "rival": {"start": 0, "keys": [{"at": {"phrase": "fight", "offset": -0.14}, "to": 1, "over": 0.35}, {"at": "and regulate", "to": 0, "over": 0.5}]}, "top": {"start": 0, "keys": [{"at": "emotions", "to": 1, "over": 1.4}, {"at": "fight", "to": 2, "over": 1.2}, {"at": "body temperature", "to": 3, "over": 0.6}, {"at": "Without", "to": 4, "over": 0.8}, {"at": {"phrase": "they'd lose", "offset": -0.25}, "to": 5, "over": 0.5}]}, "bottom": {"start": 0, "keys": [{"at": "shift", "to": 1, "over": 1}, {"at": "communicate", "to": 2, "over": 1.4}, {"at": "fight", "to": 3, "over": 1.2}, {"at": "regulate", "to": 4, "over": 1}, {"at": {"phrase": "they'd lose", "offset": -0.25}, "to": 5, "over": 0.5}]}, "finale": {"start": 0.35, "keys": [{"at": "elegant", "to": 0.65, "over": 1.4}, {"at": "What other", "to": 1, "over": 0.9}, {"at": "blow your", "to": 0.7, "over": 0.9}, {"at": "Comment below", "to": 0.9, "over": 0.5}]}, "gap": {"start": 0.1, "keys": [{"at": "tiny", "to": 0.38, "over": 0.5}, {"at": {"phrase": "nanocrystals", "edge": "start"}, "to": 0.45, "over": 1.0}, {"at": "microscopic", "to": 0.8, "over": 0.9}, {"at": "like a", "to": 0.6, "over": 0.5}, {"at": {"phrase": "When a chameleon", "edge": "start", "offset": -0.3}, "to": 0.1, "over": 0.3}, {"at": {"phrase": "reflect", "edge": "end"}, "to": 0.06, "over": 0.86}, {"at": {"phrase": "wavelengths", "edge": "end"}, "to": 0.3, "over": 1.1}, {"at": {"phrase": "warm up", "edge": "end"}, "to": 0.46, "over": 1.78}, {"at": {"phrase": "Bigger", "edge": "start"}, "to": 0.5, "over": 1.26}, {"at": {"phrase": "longer", "edge": "end"}, "to": 0.56, "over": 0.86}, {"at": {"phrase": "yellow", "edge": "end"}, "to": 0.78, "over": 0.48}, {"at": {"phrase": "orange", "edge": "end"}, "to": 1, "over": 0.5}, {"at": {"phrase": "red", "edge": "end"}, "to": 0.6, "over": 0.75}, {"at": {"phrase": "tuning", "edge": "end"}, "to": 0.25, "over": 0.9}, {"at": {"phrase": "antenna", "edge": "end", "offset": -0.08}, "to": 0.7, "over": 0.75}, {"at": {"phrase": "broadcast", "edge": "end"}, "to": 0.4, "over": 0.65}, {"at": {"phrase": "different", "edge": "end", "offset": -0.02}, "to": 0.9, "over": 0.3}, {"at": "No paint", "to": 0.5, "over": 0.7}, {"at": "No dye", "to": 0.05, "over": 0.7}, {"at": "Just physics", "to": 0.4, "over": 1}]}},
  "shots": [
    {
      "id": "myth",
      "env": {"type": "studio", "floor": false, "color": {"dial": "surround", "colors": ["#2f7d3a", "#d9722a", "#6a3fb0"]}, "haze": 0},
      "camera": {"focus": ["hero"], "framing": "close", "fill": 1.3, "angle": "front", "move": "drift", "amount": 0.3},
      "props": [
        {"id": "hero", "type": "chameleon", "at": [0, -0.15, 0], "size": 1.05, "rotate": [0, -35, 55], "color": {"dial": "skin", "colors": ["#4faa4a", "#d9937a"]}}
      ],
      "actions": [
        {"at": "That's", "do": "pulse", "prop": "hero", "strength": 0.05},
        {"at": "That's", "do": "icon", "name": "no", "style": "plain", "size": 2.5, "place": [-0.62, 1, 0.6], "until": "So why"},
        {"at": "So why", "do": "icon", "name": "question", "style": "plain", "size": 3, "color": "#d6c64a", "place": [0.45, 1, 0.6]},
        {"at": "they really", "do": "pulse", "prop": "hero", "strength": 0.4}
      ]
    },
    {
      "id": "skin",
      "start": "Inside a chameleon's",
      "env": {"type": "studio", "floor": false, "color": "#14283a", "haze": 0},
      "camera": {"focus": ["stack"], "framing": "close", "angle": "three-quarter", "move": "drift", "amount": 0.4},
      "props": [
        {"id": "stack", "type": "layer_stack", "at": "center", "size": 1.5, "rotate": [10, 0, 0], "reveal": 0.3, "granules": 0}
      ],
      "actions": [
        {"at": "Inside a", "do": "set", "prop": "stack", "param": "reveal", "to": 1, "until": {"phrase": "special cells", "edge": "end"}}
      ]
    },
    {
      "id": "granules",
      "start": "Some contain",
      "continue": true,
      "camera": {"focus": ["stack"], "framing": "close", "angle": "high", "move": "push_in", "amount": 0.4},
      "actions": [
        {"at": "spread out", "do": "set", "prop": "stack", "param": "granules", "to": 1, "over": 0.7},
        {"at": "pull together", "do": "set", "prop": "stack", "param": "granules", "to": 0, "over": 0.7},
        {"at": "darker", "do": "set", "prop": "stack", "param": "shade", "to": 1, "over": 0.5},
        {"at": "lighter", "do": "set", "prop": "stack", "param": "shade", "to": 0, "over": 0.5}
      ]
    },
    {
      "id": "crystal-layer",
      "start": "But here's",
      "continue": true,
      "camera": {"focus": ["stack"], "framing": "close", "angle": "low", "move": "push_in", "amount": 0.7, "glide": 1.2},
      "actions": [
        {"at": "But here's", "do": "set", "prop": "stack", "param": "focus", "to": 2, "over": 0.8}
      ]
    },
    {
      "id": "lattice-in",
      "start": "deeper layers",
      "transition": "dive",
      "env": {"type": "studio", "floor": false, "color": {"dial": "wavelength", "colors": ["#0a4a5a", "#0d5a2c", "#5a5a10", "#5a2c0a", "#4a0808"]}, "haze": 0},
      "camera": {"focus": ["lat"], "framing": "medium", "angle": "front", "move": "push_in", "amount": 1, "fill": 1},
      "props": [
        {"id": "lat", "type": "lattice", "at": [0, -0.5, 0], "size": 3.2, "tilt": 0.3, "spacing": {"dial": "gap", "to": [0, 1]}, "color": {"dial": "wavelength", "colors": "spectrum"}, "rotate": [-15.0, 0, 0]},
        {"id": "small", "type": "chameleon", "at": [0, 1.2, 0], "size": 1.8, "color": {"dial": "wavelength", "colors": "spectrum"}},
        {"id": "inwave", "type": "light_wave", "from": [-1, 1.7, 0.3], "to": [-0.45, 0.25, 0.3], "color": "white", "wavelength": 0.45, "progress": 0},
        {"id": "outwave", "type": "light_wave", "from": [0.35, 0.2, 0.3], "to": [1.05, 1.6, 0.3], "progress": 0, "color": {"dial": "wavelength", "colors": "spectrum"}, "wavelength": {"dial": "wavelength", "to": [0.15, 0.95]}},
        {"id": "inwave2", "type": "light_wave", "from": [-1, 1.7, 0.3], "to": [-0.45, 0.25, 0.3], "color": "white", "wavelength": 0.45, "progress": 0},
        {"id": "outwave2", "type": "light_wave", "from": [0.35, 0.2, 0.3], "to": [1.05, 1.6, 0.3], "progress": 0, "color": {"dial": "wavelength", "colors": "spectrum"}, "wavelength": {"dial": "wavelength", "to": [0.15, 0.95]}}
      ],
      "actions": [
        {"at": "hold", "do": "appear", "prop": "lat", "style": "grow", "over": 0.7},
        {"at": "microscopic structures", "do": "set", "prop": "lat", "param": "tilt", "to": 0.9, "over": 1.8}
      ]
    },
    {
      "id": "relaxed",
      "start": "When a chameleon",
      "continue": true,
      "camera": {"focus": ["lat", "small"], "framing": "medium", "angle": "front", "move": "drift", "amount": 0.3, "fill": 1.25, "glide": 1},
      "actions": [
        {"at": "When a chameleon", "do": "appear", "prop": "small", "style": "grow", "over": 0.9},
        {"at": "close together", "do": "appear", "prop": "inwave", "style": "fade", "over": 0.4},
        {"at": "close together", "do": "set", "prop": "inwave", "param": "progress", "to": 1, "over": 0.9},
        {"at": "and reflect", "do": "appear", "prop": "outwave", "style": "fade", "over": 0.4},
        {"at": "and reflect", "do": "set", "prop": "outwave", "param": "progress", "to": 1, "over": 0.9},
        {"at": {"phrase": "greens", "edge": "end", "offset": -0.2}, "do": "disappear", "prop": "inwave", "style": "fade", "over": 0.35},
        {"at": {"phrase": "greens", "edge": "end", "offset": -0.2}, "do": "disappear", "prop": "outwave", "style": "fade", "over": 0.35}
      ]
    },
    {
      "id": "excited",
      "start": "But when",
      "continue": true,
      "camera": {"focus": ["lat", "small"], "framing": "medium", "angle": "front", "move": "drift", "amount": 0.4, "fill": 1.3, "glide": 1.2},
      "actions": [
        {"at": "gets excited", "do": "set", "prop": "lat", "param": "shake", "to": 0.6, "over": 0.7},
        {"at": "gets excited", "do": "shake", "prop": "small", "strength": 0.2, "for": 3},
        {"at": "the crystals spread", "do": "set", "prop": "lat", "param": "shake", "to": 0, "over": 0.8},
        {"at": "But when", "do": "set", "prop": "lat", "param": "tilt", "to": 1.0, "over": 1.2},
        {"at": "crystals", "do": "scale", "prop": "lat", "to": 0.76, "over": 1}
      ]
    },
    {
      "id": "bigger",
      "start": "Bigger gaps",
      "continue": true,
      "camera": {"focus": ["lat", "small"], "framing": "medium", "angle": "front", "move": "drift", "amount": 0.3, "fill": 1.12, "glide": 1.2},
      "actions": [
        {"at": "Bigger gaps", "do": "appear", "prop": "inwave2", "style": "fade", "over": 0.3},
        {"at": "Bigger gaps", "do": "set", "prop": "inwave2", "param": "progress", "to": 1, "over": 0.9},
        {"at": "Bigger gaps", "do": "appear", "prop": "outwave2", "style": "fade", "over": 0.3},
        {"at": "Bigger gaps", "do": "set", "prop": "outwave2", "param": "progress", "to": 1, "over": 0.9},
        {"at": {"phrase": "red", "edge": "end", "offset": -0.3}, "do": "disappear", "prop": "inwave2", "style": "fade", "over": 0.3},
        {"at": {"phrase": "red", "edge": "end", "offset": -0.3}, "do": "disappear", "prop": "outwave2", "style": "fade", "over": 0.3},
        {"at": "Bigger gaps", "do": "scale", "prop": "lat", "to": 0.8, "over": 1.2, "ease": "linear"},
        {"at": {"phrase": "orange", "edge": "end"}, "do": "scale", "prop": "lat", "to": 0.815, "over": 0.6},
        {"at": {"phrase": "orange", "edge": "end"}, "do": "move", "prop": "lat", "to": [0, 0.14, 0], "over": 0.6}
      ]
    },
    {
      "id": "tuner",
      "start": "It's like tuning",
      "env": {"type": "studio", "floor": false, "color": {"dial": "wavelength", "colors": ["#0a4a5a", "#0d5a2c", "#5a5a10", "#5a2c0a", "#4a0808"]}, "haze": 0},
      "camera": {"focus": ["tune"], "framing": "close", "angle": "front", "move": "push_in", "amount": 0.3},
      "props": [
        {"id": "tune", "type": "tuner", "at": "center", "size": 1.7, "value": {"dial": "wavelength", "to": [0, 1]}},
        {"id": "paint", "type": "box", "at": [-0.85, 0.55, 0.5], "size": 0.55, "color": "#d33a3a"},
        {"id": "dye", "type": "water_drop", "at": [0.85, 0.55, 0.5], "size": 0.55, "color": "#7a4fd0"},
        {"id": "atom", "type": "atom", "at": [0, 1.7, 0], "size": 0.6}
      ],
      "actions": [
        {"at": "It's like tuning", "do": "appear", "prop": "tune", "style": "grow", "over": 0.8}
      ]
    },
    {
      "id": "no-paint",
      "start": "No paint",
      "continue": true,
      "camera": {"focus": ["tune", "paint", "dye"], "framing": "close", "angle": "front", "move": "drift", "amount": 0.3, "fill": 0.85},
      "actions": [
        {"at": "No paint", "do": "appear", "prop": "paint", "style": "pop"},
        {"do": "icon", "name": "no", "style": "plain", "size": 2.3, "place": [-0.85, 0.55, 0.5], "until": {"phrase": "physics", "edge": "end"}, "at": "No paint"},
        {"at": {"phrase": "paint", "edge": "end"}, "do": "shake", "prop": "paint", "strength": 0.4, "for": 0.6},
        {"at": "No dye", "do": "appear", "prop": "dye", "style": "pop"},
        {"do": "icon", "name": "no", "style": "plain", "size": 2.3, "place": [0.85, 0.55, 0.5], "until": {"phrase": "physics", "edge": "end"}, "at": "No dye"},
        {"at": {"phrase": "dye", "edge": "start"}, "do": "shake", "prop": "dye", "strength": 0.4, "for": 0.6},
        {"at": "Just physics", "do": "appear", "prop": "atom", "style": "pop"}
      ]
    },
    {
      "id": "emotions",
      "start": {"phrase": "physics", "edge": "end", "offset": 0.1},
      "env": {"type": "studio", "floor": false, "color": {"dial": "rival", "colors": ["#10161c", "#4a0a10"]}, "haze": 0},
      "camera": {"focus": ["ctop", "cbot"], "framing": "medium", "fill": 1.3, "angle": "front", "move": "drift", "amount": 0.3},
      "props": [
        {"id": "ctop", "type": "chameleon", "at": [0, 1, 0], "size": 2, "color": {"dial": "top", "from": [0, 5], "colors": ["#c0e050", "#e5b535", "#f06a3a", "#3a4a30", "#58b050", "#7d8790"]}},
        {"id": "cbot", "type": "chameleon", "at": [0, -1.1, 0], "size": 2, "rotate": [0, 180, 0], "color": {"dial": "bottom", "from": [0, 5], "colors": ["#40c0d0", "#70d040", "#c0d030", "#e8a030", "#40d060", "#7d8790"]}}
      ],
      "actions": [
        {"at": "Chameleons shift", "do": "appear", "prop": "ctop", "style": "fade", "over": 0.3},
        {"at": "Chameleons shift", "do": "appear", "prop": "cbot", "style": "fade", "over": 0.3},
        {"at": {"phrase": "Chameleons", "offset": -0.48}, "do": "sfx", "name": "none"},
        {"at": "Chameleons shift", "do": "sfx", "name": "whoosh"},
        {"at": "attract mates", "do": "icon", "name": "heart", "place": [0, 0.45, 0.6], "until": "fight", "style": "plain", "size": 1.8},
        {"at": "mates", "do": "icon", "name": "heart", "place": [-0.45, -0.1, 0.6], "until": "fight", "style": "plain", "size": 1.8},
        {"at": "fight rivals", "do": "icon", "name": "bolt", "style": "plain", "size": 2.6, "color": "#f0a43a", "place": [-0.42, -0.05, 0.6], "id": "bolt-a", "until": "temperature"},
        {"at": "rivals", "do": "icon", "name": "bolt", "style": "plain", "size": 2.6, "color": "#f0a43a", "place": [0.42, -0.05, 0.6], "id": "bolt-b", "until": "temperature"},
        {"at": "and regulate", "do": "color", "icon": "bolt-a", "to": "#8a5530", "over": 0.6},
        {"at": "and regulate", "do": "color", "icon": "bolt-b", "to": "#8a5530", "over": 0.6},
        {"at": "body temperature", "do": "icon", "name": "sun", "style": "plain", "size": 1.55, "color": "#ffc23a", "place": [-0.75, 1.75, 0.5], "until": "Without"}
      ]
    },
    {
      "id": "lose",
      "start": "Without this",
      "continue": true,
      "camera": {"focus": ["ctop", "cbot"], "framing": "medium", "fill": 1.3, "angle": "front", "move": "push_in", "amount": 0.3},
      "actions": [
        {"at": "lose their", "do": "shake", "prop": "ctop", "strength": 0.1, "for": 0.5},
        {"at": "lose their", "do": "shake", "prop": "cbot", "strength": 0.1, "for": 0.5},
        {"at": "Without this", "do": "icon", "name": "heart", "style": "plain", "size": 1.84, "color": "#c9ced4", "place": [-0.66, 0.25, 0.6], "id": "g-heart"},
        {"at": "Without this", "do": "icon", "name": "sun", "style": "plain", "size": 1.96, "color": "#c9ced4", "place": [0.66, 0.25, 0.6], "id": "g-sun"},
        {"at": {"phrase": "they'd lose", "offset": -0.25}, "do": "color", "icon": "g-heart", "to": "#59606a", "over": 0.5},
        {"at": {"phrase": "they'd lose", "offset": -0.25}, "do": "color", "icon": "g-sun", "to": "#59606a", "over": 0.5}
      ]
    },
    {
      "id": "finale",
      "start": "It's one",
      "env": {"type": "space", "nebula": "none"},
      "camera": {"focus": ["last"], "framing": "close", "angle": "front", "move": "pull_out", "amount": 0.65, "fill": 1.3},
      "props": [
        {"id": "last", "type": "chameleon", "at": "center", "size": 1.6, "rotate": [0, -35, 30], "color": {"dial": "finale", "colors": "spectrum"}}
      ],
      "actions": [
        {"at": "elegant light", "do": "pulse", "prop": "last", "strength": 0.3},
        {"at": "What other", "do": "icon", "name": "question", "style": "plain", "size": 2.1, "color": "#d6c64a", "place": [0.6, 1.1, 0.4]}
      ]
    }
  ]
}

=== USER ===

TITLE: How does a battery really light a bulb?

THE SCRIPT AS SPOKEN, sentence by sentence (S1, S2, ...), with the sentence's start and end in seconds, then each word with its start time. Anchors must be copied from these words.
S1 [0.09-3.29] Does a battery pour electricity into a bulb until it runs out?
   Does 0.09 | a 0.20 | battery 0.28 | pour 0.70 | electricity 1.00 | into 1.85 | a 2.09 | bulb 2.17 | until 2.56 | it 2.79 | runs 2.88 | out? 3.08
S2 [3.66-4.12] Not quite.
   Not 3.66 | quite. 3.79
S3 [4.51-5.54] Here is what really happens.
   Here 4.51 | is 4.62 | what 4.70 | really 4.86 | happens. 5.03
S4 [5.90-9.71] Inside the battery, a chemical reaction pushes electrons toward one end.
   Inside 5.90 | the 6.32 | battery, 6.39 | a 7.04 | chemical 7.09 | reaction 7.49 | pushes 8.05 | electrons 8.39 | toward 8.96 | one 9.23 | end. 9.42
S5 [10.08-15.13] Connect a wire, and the electrons already sitting in the metal all start to shuffle forward at once.
   Connect 10.08 | a 10.34 | wire, 10.39 | and 11.07 | the 11.13 | electrons 11.19 | already 11.92 | sitting 12.32 | in 12.70 | the 12.78 | metal 12.85 | all 13.18 | start 13.52 | to 13.75 | shuffle 13.82 | forward 14.19 | at 14.60 | once. 14.70
S6 [15.51-18.78] They creep along slowly, often less than a millimetre each second.
   They 15.51 | creep 15.61 | along 15.88 | slowly, 16.18 | often 16.99 | less 17.34 | than 17.60 | a 17.73 | millimetre 17.78 | each 18.26 | second. 18.41
S7 [19.16-23.91] But the push travels around the loop at close to the speed of light, so the bulb responds instantly.
   But 19.16 | the 19.26 | push 19.35 | travels 19.60 | around 20.00 | the 20.31 | loop 20.39 | at 20.71 | close 20.82 | to 21.18 | the 21.26 | speed 21.35 | of 21.66 | light, 21.75 | so 22.36 | the 22.49 | bulb 22.61 | responds 22.89 | instantly. 23.44
S8 [24.27-28.77] In the thin tungsten filament, the electrons must squeeze through a much narrower path.
   In 24.27 | the 24.34 | thin 24.44 | tungsten 24.78 | filament, 25.21 | the 25.93 | electrons 25.99 | must 26.53 | squeeze 26.81 | through 27.33 | a 27.50 | much 27.56 | narrower 27.89 | path. 28.32
S9 [29.15-32.44] They bump into the atoms, and every bump shakes the atoms harder.
   They 29.15 | bump 29.25 | into 29.58 | the 29.77 | atoms, 29.89 | and 30.54 | every 30.69 | bump 30.94 | shakes 31.25 | the 31.60 | atoms 31.75 | harder. 32.03
S10 [32.82-35.97] The filament heats up to well over two thousand degrees Celsius.
   The 32.82 | filament 32.88 | heats 33.29 | up 33.56 | to 33.70 | well 33.81 | over 34.24 | two 34.44 | thousand 34.71 | degrees 35.06 | Celsius. 35.38
S11 [36.35-38.21] Hot metal glows, so the bulb lights.
   Hot 36.35 | metal 36.53 | glows, 36.76 | so 37.34 | the 37.45 | bulb 37.56 | lights. 37.78
S12 [38.58-39.83] The electrons are not used up.
   The 38.58 | electrons 38.63 | are 39.10 | not 39.16 | used 39.39 | up. 39.64
S13 [40.21-42.86] They flow on back to the battery, carrying less energy.
   They 40.21 | flow 40.30 | on 40.58 | back 40.74 | to 41.04 | the 41.13 | battery, 41.22 | carrying 41.88 | less 42.27 | energy. 42.48
S14 [43.23-48.23] It is like a bicycle chain: every link moves together, and the energy is delivered at the wheel.
   It 43.23 | is 43.30 | like 43.41 | a 43.58 | bicycle 43.67 | chain: 44.21 | every 44.93 | link 45.16 | moves 45.48 | together, 45.78 | and 46.51 | the 46.56 | energy 46.67 | is 47.21 | delivered 47.33 | at 47.75 | the 47.84 | wheel. 47.92
S15 [48.60-50.10] So what else around you works like a loop?
   So 48.60 | what 48.72 | else 48.84 | around 49.02 | you 49.31 | works 49.41 | like 49.66 | a 49.79 | loop? 49.83
S16 [50.47-51.04] Comment below.
   Comment 50.47 | below. 50.73

THE PICTURE PLAN from the script writer (S n here is S n above): what stays on screen, what visibly changes while that sentence is spoken, and the dial that drives it. Follow it; improve it where the catalogue offers a better way to show the same change.
S1 subject: battery | change: the charge window drains as the battery empties | dial: charge
S2 subject: battery | change: the charge window refills and turns green | dial: charge
S3 subject: particles | change: electrons gather into a ring stream around the loop | dial: speed
S4 subject: particles | change: the electrons bunch together and drift toward one side | dial: speed
S5 subject: particles | change: the whole ring of electrons starts moving forward together | dial: speed
S6 subject: particles | change: the electrons slow to a gentle crawl | dial: speed
S7 subject: lightbulb | change: the bulb switches on and glows at once | dial: on
S8 subject: particles | change: the electron stream narrows and crowds together | dial: spread
S9 subject: particles | change: the crowded dots jitter more and more | dial: spread
S10 subject: lightbulb | change: the bulb glows brighter and warmer | dial: on
S11 subject: lightbulb | change: the bulb lights fully bright | dial: on
S12 subject: particles | change: the electron ring keeps circling and none disappear | dial: speed
S13 subject: particles | change: the electrons dim and stream back into the battery end | dial: speed
S14 subject: gear | change: the linked gears all turn together and drive the last gear
S15 subject: gear | change: the gears speed up and spin in a closed loop
S16 subject: gear | change: the gears slow and settle together

The last word ends at 51.04 s; the video is 51.44 s long. Make 2 to 4 main scenes (a scene = a shot plus its "continue": true shots), plus at most a short opening and a short closing scene. Each shot lasts 1.5 to 12 seconds (over 9 s gives a warning); aim for 3 to 8.

Think through the scenes and the changes first (section 2), then reply with the complete show.json and nothing else: no code fence, no comments, no text before or after it.
