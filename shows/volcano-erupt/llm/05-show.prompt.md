<!-- One LLM call. Read all of it as your instructions, then write ONLY your answer into the matching .reply.md file (same name, .reply.md instead of .prompt.md). -->

=== SYSTEM ===

You are the director of a vertical 3D science video. A narrator's voice is already recorded. You write the file that tells a 3D engine what to show while each word is spoken: show.json. You reply with that JSON object only.

The video must EXPLAIN, not illustrate. The approved style: one subject stays on screen and changes with every clause, one number (a dial) drives several things at once, cause and effect are in the same frame, and the camera travels in and out of the subject instead of cutting to a new room for every sentence. A slideshow (a new object per sentence that then sits still) is rejected.

# 1. How the engine works

- A show is a list of SHOTS. A SCENE is a shot plus the shots after it that have "continue": true. A scene has one environment, a few props that keep their state, and a new camera for each of its shots. A shot without "continue" starts a new scene from nothing.
- A shot lasts from its "start" (a spoken phrase) until the next shot's start. The first shot starts at 0 s and has no "start". The last shot runs to the end of the video: the last spoken word is the closing "comment your answer below" line, and the video then runs about 2.5 more seconds with no voice (the music fades out), so keep the last picture changing or settled, not cut off.
- Props, environments, actions and camera moves come ONLY from the catalogue in section 5.
- DIALS (top-level "dials") are named numbers that change when words are spoken. A prop's animatable value, its "color", "glow", "size" or "at", and an environment's dial-able param can FOLLOW a dial (a binding), so one dial changes several things together. Section 5 gives the exact forms (DIALS, BINDINGS, CONTINUE).
- RAMPS: "move", "scale", "color", "glow" and "set" accept "until": <anchor> instead of "over", so a change runs from one spoken word to another.
- The camera frames the shot by itself: it looks at the props in "camera.focus" (or all visible props) over the WHOLE shot and fits them in the frame. You choose framing ("fill" for an exact size), angle and move; in a continuing shot "glide" moves the camera smoothly from the previous view.
- Stage space: centred on [0, 0, 0]. +x is right, +y is up, +z is toward the viewer. One unit is about half the frame width at medium framing. Every prop is built to fit a 1-unit box; "size" scales it.
- Captions of the spoken words are drawn automatically in the lower part of the frame (the bottom 28 percent of the frame is kept free for them and for the YouTube Shorts buttons). You never write captions.

# 2. How to think (do this before writing any JSON)

0. THE STORYBOARD. When the input has an APPROVED STORYBOARD, it is the source of truth: build exactly it (same objects, same flow directions, text on the same phrases and kept as long, same ending). A planned text longer than 32 characters must be a "text" action (a "label" allows at most 32; a "text" up to 40). A label, text or count ends with its shot (the engine ends it with its shot): to keep it up longer, repeat the same label or text at the start of the next shot. The steps below say how. A gap object {"missing", "stand_in", "central"} means the catalogue cannot draw "missing": draw the "stand_in" prop instead (if "stand_in" is none, draw nothing for it). A storyboard text has "starts" (the words of that sentence where it appears) and "ends" (a sentence number: it must stay on screen until the START of that sentence; or the word "end": it stays until the end of the video, including the ending).
1. THE CHAIN. Read the sentence table and the picture plan. Name the one mechanism and its cause -> effect chain. Name the HERO: the prop that shows the mechanism changing (a lattice, a wave, a layer stack, a tuner). It stays on screen for most of the video.
2. SCENES. Make 2 to 4 main scenes for the mechanism (for example: whole thing -> zoom in -> the mechanism up close -> the analogy), plus at most one short opening scene for the hook and one short closing scene. Never a new scene per sentence. Inside a scene, change the view with a continuing shot (new camera, often with "glide"); zoom into the subject with "transition": "dive".
3. DIALS. Choose at least one dial for the quantity that changes (spacing, temperature, speed, wavelength). Bind it to TWO OR MORE things that the viewer should see change together: the hero's value AND its colour, the effect next to it, the background colour. Key it on the spoken words where the quantity changes ("sit close" -> low, "spread apart" -> high).
4. A CHANGE IN EVERY SENTENCE. For each sentence, the plan says what changes; make it happen inside that sentence: a dial key, or an action on a prop ("set", "move", "scale", "color", "glow", "appear", "disappear"), ideally ramped with "until" from one word to the next. Nothing on screen may stay unchanged for more than 3.5 seconds of narration (2.5 s is better). Camera moves, spin, bob, orbit, pulse, shake, labels, text and icons do NOT count as a change.
5. CAUSE AND EFFECT TOGETHER. Put the cause and its effect in the same frame where possible (the crystals spreading on top, the reflected colour below; the chameleon's skin turning the same colour). Labels only name parts ("CRYSTALS", "SKIN"); the picture carries the explanation.
6. EMPHASIS ONLY. "pulse" and "shake" are emphasis, never the sentence's change: at most 3 pulses and 2 shakes in the whole video (a camera shake counts as a shake), never on the same prop twice in a row. A video of things bouncing and shaking is bad; use a real change (set, move, scale, color, glow, a dial) instead.
7. CLOUDS HOLD STILL. A particle cloud's spread or speed changes only on the words that need it, then holds. Do not keep it swelling and shrinking.
8. VARIETY. Keep the one hero, but inside each scene (except the first shot, which keeps the one-small-prop limit in section 4) bring in 1 or 2 supporting props that show the thing being talked about (the real object of an analogy where the catalogue has it, the parts the script names) instead of only re-animating the hero. The scene count and the rule that at least one prop is on screen for 30% or more of the video stay as they are.
9. WRITE THE JSON. Then run the checklist in section 4 against it before you reply.

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
- Stage-space props ("arrow", "beam", "wire", "light_wave") have "from" and "to" (a slot, [x, y, z] or a prop id in the shot) and NO "at", "size" or "rotate". They cannot move, scale, spin, orbit, bob, shake or pulse.
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
- Anything the narration names must be big enough to see: size 0.6 or more. "particles" meant to be noticed need "dot" 0.08 or more and "size" 1 or more; exception: particles INSIDE a prop are exempt from BOTH size minimums (size 1 and size 0.6) and follow the inside rule below (smaller than that prop) instead.
- The first shot is the thumbnail moment: one clear subject, big (close framing or "fill"), with at most one other small prop.

Ground:
- Each environment line in the catalogue says whether it has a ground. On a ground, y = 0 is the ground: ordinary props stand on it, with their base at the "at" height.
- Props marked [floats] are centred on their "at" point, so on an environment WITH a ground lift a floating prop: "at": [0, 0.7, 0] for size 1, about 0.6 x size in general.
- In space, micro, studio with "floor": false, underwater with "seabed": false and sky with "ground": "none" there is no ground and everything floats; y can be anything.

Visibility:
- Something must be visible from the first frame of every scene. If props "appear" later, make the first one appear on the scene's first words, or keep one prop visible from the start.
- Props that actions point at must stay at least 60% inside the frame: do not "move" them off screen. To make something leave, use "disappear".
- Do not put a prop in the bottom 28 percent of the frame (the captions are there): avoid "at" y below -0.9 unless the camera angle is high or top.

Overlays (label, text, count, icon):
- At most 2 on screen at the same time; end them with "until" when the next one comes.
- Labels: 1 to 3 words, CAPITALS, under 22 characters, naming a part of the picture ("CRYSTALS", "SKIN CELLS"). Never a full sentence, never a copy of the caption, never the explanation itself.
- Text "title" for a short heading, "number" for a big figure, "stamp" for a verdict like "WRONG" or "MYTH". "count" for a number WITHOUT a unit that is spoken (a number with a unit is a text, see the rule below). Icons mark a moment (a "no" sign on a myth); they are never the subject.

Colour and camera:
- Pick prop colours that contrast with the environment. A background bound to the same dial as the hero ("color": {"dial": ...}) makes the whole frame follow the mechanism.
- Change the view between shots (framing, angle, move, "fill"); inside a scene prefer "glide" to a hard cut. Use "dip" for a big jump between scenes and "dive" to zoom into the subject.
- The example below shows the format and the way of thinking. Do not reuse its props, layout or dials for a different topic.

Good to know (not obvious from the catalogue):
- "ring": its radius comes from "size" (size 2.6 rings a planet of size 1.3); "tilt" 0 faces the camera like a hoop, 90 is edge-on, 70-78 looks like Saturn's rings.
- "particles" with "shape": "ring" lie flat (like a plate): seen from angle "front" they look like a line; use angle "top" or "high" to show the circle. Use 20 or more of them for a ring that reads as a ring.
- "planet" turns by itself (its "turn" param, default 0.02 turns/s, clouds faster); to show it stopping or starting, place it with "turn": 0 and drive all turning with "spin" (speed 0 stops it).
- "wire" is a stage-space cable (like "beam"): for a circuit use two wires between [x, y, z] points, e.g. over the top with "lift": 0.7 and a return along the floor at y 0.04 (floor is y 0, props stand on it); "current" 0 to 1 sends glowing charge along it. A wire's charge dots run from its "from" end to its "to" end; an arrow points at its "to". For a closed loop the dots must circulate one way: wire 1 "from" the battery "to" the bulb, wire 2 (the return) "from" the bulb "to" the battery; never both wires "to" the bulb. This floor layout needs an environment with a ground (with no ground, pick your own heights). On the ground, a "battery" is 0.79 x its size tall to the top of its cap and a "lightbulb" exactly its size tall (a size 1.2 battery tops out at y 0.95, a size 1.0 bulb at y 1.0); start or end a wire at a prop's x and z with the y of its top. A positive "lift" puts the top at the higher end plus "lift"; a negative "lift" bends the wire down instead (the bottom is the lower end plus "lift"), and it does not go around props. When both ends are at y 0 or above, the wire never goes into the floor (its centre is held at y 0.04 or higher, even if an end is given at y 0, so a wire already at the floor stays straight); if either end is below y 0 there is no floor clamp and the wire goes exactly where you put it.
- Only a wire, beam, arrow or light_wave has a "from" and "to". "particles" and every other prop has no point to aim at: it is placed only by its own "at" and "size". To show something INSIDE a prop (electrons in a bulb), put its "at" at that prop's x and z (same z, never nearer the camera) and at the height of the part, and make its "size" smaller than the prop's; the bulb's glass is see-through, and its filament is about 0.65 x its size above the ground. On a ground, a size 1.2 bulb at [0.9, 0, 0] gets particles "at" [0.9, 0.8, 0] with "size" 0.4.
- A spoken number with a unit (a temperature, speed, distance, time) must show as a text. Use a "text" action of at most 40 characters, with style "number" for a big figure, never a "label"; labels stay the 1 to 3 word CAPITAL names of parts. Its words are the same as the storyboard text, for example "2000 °C". It starts on those words and stays until the start of the next sentence, or, if the next sentence starts less than 2.5 seconds after the text appears, until the start of the FIRST later sentence that starts at least 2.5 seconds after the text appears (the text must stay up at least 2.5 seconds). To do that, give the text action an "until" that is the first 1 to 6 words of that sentence, copied from the word list. If the shot ends at that point, leave "until" out; for the last sentence, or if no later sentence is long enough, also leave "until" out, so the text stays to the end of its shot (the end of the video only if it is in the last shot). This is the same as the storyboard text "ends". If the shot ends first, repeat the same text at the start of the next shot. If a sentence has 3 or more unit numbers, join them in one text if it fits 40 characters, else keep the 2 most important and drop the rest. If two unit-number texts are on screen together, put one at "pos" "top" and the other at "pos" "middle", because "pos" is the only thing that sets a text's height and the default "top" would draw them on top of each other. A unit-number text has priority over a label when the limit of 2 overlays at once is reached.
- "bars" draws the values relative to the tallest bar; give 2 to 4 values for a clear comparison and start it at "grow": 0 to make it rise on a word.

CHECKLIST before replying:
[ ] 2 to 4 main scenes (plus at most a short opening and closing scene); one hero prop that stays on screen for much of the video; first shot has no "start"; every other shot's "start" is a phrase from the word list; each shot 1.5 to 12 s (over 9 s gives a warning; aim for 3 to 8).
[ ] At least one dial, bound to two or more things that are on screen together; its keys are on the words where the quantity changes.
[ ] Every sentence has a change starting inside it (a dial key or a real action), and nothing stays unchanged for more than 3.5 s.
[ ] At most 3 pulses and 2 shakes in the video (a camera shake counts), none as a sentence's change, never on the same prop twice in a row; particle clouds change only on the words that need it; the first shot keeps its one-small-prop limit; inside each scene (except the first shot) bring in 1 or 2 supporting props.
[ ] Continuing shots have no "env" and only new prop ids; no action changes a dial-bound value.
[ ] Every anchor is a phrase spoken inside that shot, and repeated words are made unique with more words.
[ ] Every prop type, env type, param, action, field and value appears in the catalogue for THAT prop or action.
[ ] Circuit wires run battery to bulb and back (never both "to" the bulb); particles inside a prop sit at its x and z and are smaller than it; every spoken number with a unit has a text held to the next sentence (or a later one if the gap is under 2.5 seconds).
[ ] Floating props on a ground are lifted; backdrop props have no actions; at most 2 overlays at once; labels short, in capitals, naming parts.

# 5. Catalogue

PROPS (name [floats/STAGE-SPACE] (params) anim: animatable params for the "set" action -- what it is)
- ball (color, finish=glossy|matte|metal|facets) -- A shiny or matte sphere in any colour (marble, molecule, pinball, drop).
- box (color, finish=matte|glossy|metal, width 0.05..1, height 0.05..1, depth 0.05..1, round 0..0.5) -- A rounded box in any colour and proportions (block, crate, bumper, wall).
- planet [floats] (look=earth|moon|mars|gas|ice|lava, color, rings:bool, turn -1..1, ocean_color, seed) anim: atmosphere 0..1.5 [starts 0.6], ocean 0..1 [starts 0], ocean_lon -180..180 [starts 0], ocean_lat -90..90 [starts 0] -- A planet or moon: earth, moon, mars, gas, ice, lava. Optional rings, air glow, a movable ocean bump.
- sun [floats] (color, rays:bool) anim: brightness 0..2 [starts 1] -- A glowing star with a halo and soft turning rays.
- particles [floats] (shape=sphere|box|ring|stream, count 1..1500, color, color2, mix 0..1, look=balls|dots, dot 0.01..0.3, seed) anim: spread 0..3 [starts 1], speed 0..5 [starts 0.3] -- A cloud of small balls or glowing dots in a box, sphere, ring or stream (molecules, dust, atoms).
- arrow [STAGE-SPACE] (from=point, to=point, color, thickness 0.02..0.3) anim: length 0..1 [starts 1] -- A flat, bold 2D-style arrow from one point or prop to another.
- beam [STAGE-SPACE] (from=point, to=point, color, width 0.01..0.6) anim: progress 0..1 [starts 1], brightness 0..2 [starts 1] -- A glowing light ray from one point or prop to another.
- wire [STAGE-SPACE] (from=point, to=point, lift -3..3, color, width 0.02..0.2) anim: current 0..1 [starts 0] -- An electric wire between two points; "lift" bends it into a loop.
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
- rock (color, count 1..6, seed) -- A chiselled boulder or group of rocks with cracks, strata and a flat base. For geology, erosion, mining.
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
- marshmallow (color, style=plain|toasted|charred) anim: toast 0..1 [starts 0], squish 0..1 [starts 0] -- Toastable, squishable marshmallow: for s'mores, campfire, food and soft-versus-hard gags.
- magma_chamber (color, chamber_color) anim: fill 0..1 [starts 0.5], heat 0..1 [starts 0.5], eruption 0..1 [starts 0] -- Cutaway volcano: rock layers, glowing magma chamber and vent pipe. Good for what lies under a volcano.

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
S2 subject: chameleon | change: the background snaps back from green to orange to purple while the chameleon stays put (one small pulse on "That's" for emphasis) | dial: surround
S3 subject: chameleon | change: it grows a little (scale up) on "they really"
S4 subject: layer_stack | change: the stack slices open, layer by layer, until "special cells"
S5 subject: layer_stack | change: granules spread out, then pull together; the skin darkens, then lightens
S6 subject: layer_stack | change: the deep crystal layer brightens while the others dim; the lattice grows in, its crystals open and close, then it tilts | dial: gap
S7 subject: lattice | change: crystals sit close; a wave comes in and a short blue-green wave reflects out | dial: gap
S8 subject: lattice | change: the lattice's own wobble builds, then settles as the crystals spread apart | dial: gap
S9 subject: lattice | change: gaps grow; the reflected wave lengthens and turns yellow, orange, red | dial: wavelength
S10 subject: tuner | change: its dial swings and the colour follows the words | dial: wavelength
S11 subject: tuner | change: a box (the paint box) pops in with one short shake for emphasis; the tuner's dial swings back | dial: wavelength
S12 subject: tuner | change: a water_drop (the dye drop) pops in with one short shake for emphasis; the tuner's dial drops to blue | dial: wavelength
S13 subject: tuner | change: an atom pops in; the tuner's dial swings up again | dial: wavelength
S14 subject: chameleon | change: two chameleons each change colour on every reason (emotions, mates, rivals, temperature) | dial: top
S15 subject: chameleon | change: the two chameleons shrink a little and their colours fade to grey | dial: top
S16 subject: chameleon | change: its colour shifts (one soft pulse on "elegant light" for emphasis) | dial: finale
S17 subject: chameleon | change: its colour swings to red, then back | dial: finale
S18 subject: chameleon | change: its colour warms once more on "Comment below" | dial: finale

NOTES ON THIS EXAMPLE (not part of the input or the reply):
The approved video, rebuilt in this kit. One causal chain: crystal spacing -> reflected wavelength -> skin colour.
SCENES: hook (chameleon, S1-S3) -> skin layers (layer_stack: 1 shot + 2 continuing shots, S4-S6) -> MAIN SCENE: the lattice with a small chameleon and light waves (1 shot + 3 continuing shots, S6-S9) -> analogy as an object (tuner, then paint and a drop crossed out, S10-S13) -> why it matters (two chameleons, S14-S15) -> close (one chameleon, S16-S18).
DIALS: "gap" drives the lattice spacing only; from "reflect" on its keys sit on the same words as "wavelength", so the gaps and the colour change together. In the lattice scene "wavelength" drives the lattice colour, the small chameleon's colour, the reflected wave's colour, the reflected wave's length and the background, so one number changes five things in the same frame (cause on top, effect below). In the tuner scene it drives the tuner's value and the background.
Icons and labels in the output (a "no" sign on the paint box and dye drop, question marks) are decoration on top of the plan's changes; they are never the change.

Not to copy: this example is shorter than a real script (under the 180-word minimum, and it ends "Comment below."); real scripts have 180 to 195 words and end with the closing question plus a line asking viewers to comment their answer below ("Comment your answer below."), so do not copy its length or its closing words. This example has 6 scenes because of the hook and closing scenes, and runs 63 s; yours must have a voice of up to 60 s (up to 62 s is accepted), and the video then runs a 2.5 s ending after the last word, so the finished video is about 57.5 to 62.5 s and at most 64.5 s. The "lose" shot was split from "emotions" so no shot is over 9 s. Do not reuse its props or layout for a different topic.

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
        {"at": "they really", "do": "scale", "prop": "hero", "to": 1.15, "over": 0.8}
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
        {"at": "lose their", "do": "scale", "prop": "ctop", "to": 0.9, "over": 2},
        {"at": "lose their", "do": "scale", "prop": "cbot", "to": 0.9, "over": 2},
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

TITLE: Why do volcanoes really erupt?

THE SCRIPT AS SPOKEN, sentence by sentence (S1, S2, ...), with the sentence's start and end in seconds, then each word with its start time. Anchors must be copied from these words.
S1 [0.10-1.23] Why do volcanoes erupt?
   Why 0.10 | do 0.29 | volcanoes 0.37 | erupt? 0.87
S2 [1.55-5.45] A volcano erupts when trapped magma and gas push harder than the rock above can hold.
   A 1.55 | volcano 1.68 | erupts 2.16 | when 2.48 | trapped 2.61 | magma 2.94 | and 3.38 | gas 3.48 | push 3.77 | harder 3.96 | than 4.29 | the 4.40 | rock 4.50 | above 4.78 | can 5.02 | hold. 5.13
S3 [5.78-6.95] Here is what really happens.
   Here 5.78 | is 5.96 | what 6.07 | really 6.23 | happens. 6.46
S4 [7.27-10.82] Deep below the cone, a chamber of rock slowly fills with glowing magma.
   Deep 7.27 | below 7.50 | the 7.68 | cone, 7.78 | a 8.45 | chamber 8.49 | of 8.85 | rock 8.96 | slowly 9.22 | fills 9.59 | with 9.96 | glowing 10.08 | magma. 10.42
S5 [11.14-14.67] Down there the heat is about one thousand degrees Celsius, hot enough to melt rock.
   Down 11.14 | there 11.37 | the 11.48 | heat 11.55 | is 11.85 | about 11.97 | one 12.21 | thousand 12.35 | degrees 12.68 | Celsius, 13.01 | hot 13.70 | enough 13.85 | to 14.07 | melt 14.16 | rock. 14.37
S6 [14.99-18.10] Melted rock is lighter than solid rock, so it starts to rise.
   Melted 14.99 | rock 15.38 | is 15.68 | lighter 15.80 | than 16.08 | solid 16.20 | rock, 16.57 | so 17.10 | it 17.20 | starts 17.28 | to 17.54 | rise. 17.63
S7 [18.42-21.58] As the chamber fills, the pressure climbs and the walls squeeze tighter.
   As 18.42 | the 18.62 | chamber 18.70 | fills, 19.03 | the 19.49 | pressure 19.59 | climbs 19.93 | and 20.40 | the 20.50 | walls 20.60 | squeeze 20.92 | tighter. 21.22
S8 [21.90-25.36] The magma also holds dissolved gas, locked in like the fizz in a bottle.
   The 21.90 | magma 22.06 | also 22.43 | holds 22.70 | dissolved 22.97 | gas, 23.38 | locked 24.00 | in 24.23 | like 24.31 | the 24.44 | fizz 24.52 | in 24.85 | a 24.92 | bottle. 24.97
S9 [25.69-30.59] Higher up, the pressure drops, so the gas forms bubbles that swell and shove the magma up a narrow pipe.
   Higher 25.69 | up, 26.04 | the 26.45 | pressure 26.53 | drops, 26.87 | so 27.45 | the 27.55 | gas 27.65 | forms 27.92 | bubbles 28.21 | that 28.51 | swell 28.63 | and 29.08 | shove 29.14 | the 29.35 | magma 29.40 | up 29.82 | a 29.94 | narrow 29.98 | pipe. 30.26
S10 [30.91-34.27] Think of a pressure cooker, where the needle keeps climbing until the lid gives way.
   Think 30.91 | of 31.16 | a 31.22 | pressure 31.29 | cooker, 31.62 | where 32.13 | the 32.23 | needle 32.29 | keeps 32.58 | climbing 32.82 | until 33.22 | the 33.48 | lid 33.57 | gives 33.78 | way. 34.03
S11 [34.59-37.13] When pressure beats the rock's strength, the pipe blows open.
   When 34.59 | pressure 34.79 | beats 35.15 | the 35.35 | rock's 35.44 | strength, 35.73 | the 36.23 | pipe 36.33 | blows 36.60 | open. 36.85
S12 [37.45-40.62] Magma, ash and gas burst out and spray high into the sky.
   Magma, 37.45 | ash 38.22 | and 38.49 | gas 38.57 | burst 38.95 | out 39.23 | and 39.41 | spray 39.50 | high 39.82 | into 40.05 | the 40.17 | sky. 40.25
S13 [40.94-44.51] Once the gas escapes, the pressure drops and the eruption slowly fades.
   Once 40.94 | the 41.21 | gas 41.31 | escapes, 41.57 | the 42.16 | pressure 42.26 | drops 42.61 | and 43.00 | the 43.17 | eruption 43.26 | slowly 43.72 | fades. 44.06
S14 [44.84-48.30] These eruptions also build new islands and feed the soil with minerals.
   These 44.84 | eruptions 45.07 | also 45.58 | build 45.88 | new 46.12 | islands 46.31 | and 46.81 | feed 46.91 | the 47.22 | soil 47.28 | with 47.61 | minerals. 47.74
S15 [48.62-51.18] Which surprises you more, the heat or the gas?
   Which 48.62 | surprises 48.82 | you 49.33 | more, 49.40 | the 50.01 | heat 50.07 | or 50.60 | the 50.67 | gas? 50.75
S16 [51.50-52.62] Comment your answer below.
   Comment 51.50 | your 51.91 | answer 52.02 | below. 52.30

THE PICTURE PLAN from the script writer (S n here is S n above): what stays on screen, what visibly changes while that sentence is spoken, and the dial that drives it. Follow it; improve it where the catalogue offers a better way to show the same change.
S1 subject: magma_chamber | change: the chamber glows a little and a first bubble rises in the pipe | dial: fill
S2 subject: magma_chamber | change: the magma level climbs and the chamber glows brighter under the rock | dial: fill
S3 subject: magma_chamber | change: the cutaway reveals the glowing chamber deep under the cone | dial: fill
S4 subject: magma_chamber | change: the chamber fills with more and more glowing magma | dial: fill
S5 subject: magma_chamber | change: the magma turns from dull red to bright orange-yellow | dial: heat
S6 subject: magma_chamber | change: the magma level rises and bubbles lift up the pipe | dial: fill
S7 subject: magma_chamber | change: the chamber fills to the top and glows hotter | dial: pressure
S8 subject: magma_chamber | change: tiny bubbles appear inside the magma and multiply | dial: pressure
S9 subject: magma_chamber | change: bubbles swell and the magma is pushed up the pipe toward the crater | dial: pressure
S10 subject: gauge | change: the needle swings from green up into the red zone | dial: pressure
S11 subject: magma_chamber | change: the top of the pipe cracks open and the first eruption flares | dial: pressure
S12 subject: magma_chamber | change: the eruption spray shoots high above the crater | dial: pressure
S13 subject: magma_chamber | change: the spray dies down and the magma level and glow sink | dial: pressure
S14 subject: magma_chamber | change: the cone grows taller as the cooled magma glow fades to dark rock | dial: pressure
S15 subject: magma_chamber | change: the chamber glows hot again and bubbles start to rise | dial: pressure
S16 subject: magma_chamber | change: the chamber fills and glows brighter again as bubbles rise | dial: pressure

THE APPROVED STORYBOARD (entry n of "sentences" is S n above). It is the source of truth: build exactly this storyboard, with the same objects (prop types), the same flow directions (a wire or arrow runs from its "from" to its "to"), each text on the phrase in its "starts" and kept until the START of the sentence in its "ends", and the same ending. A label, text or count ends with its shot (the engine ends it with its shot): to keep it up longer, repeat the same label or text at the start of the next shot. A checker compares your show with it.
{
  "hook": "Why do volcanoes erupt?",
  "answer": "A volcano erupts when hot rising magma and its dissolved gas build up more pressure than the rock above can hold, so the top of the pipe blows open.",
  "hero": "magma_chamber",
  "summary": "One cutaway volcano stays big in the middle of the frame. Its glowing chamber slowly fills and heats up, bubbles form in the magma and push it up the pipe, and a pressure gauge swings into the red as the analogy. Then the pipe blows open and lava sprays high, fades, and leaves a calm cone with a new small island. The temperature shows as text on screen while it is said, and the picture ends with the chamber glowing again as the viewer is asked to comment.",
  "scenes": [{"scene": "1", "env": "lab", "idea": "Opening: the big cutaway volcano shows the hidden chamber under the cone and the question of why it erupts."}, {"scene": "2", "env": "lab", "idea": "The chamber fills with hot magma, the thermometer rises to about 1000 degrees, the magma rises, pressure builds, gas bubbles form and push magma up the pipe."}, {"scene": "3", "env": "lab", "idea": "The pressure cooker analogy: a big gauge whose needle climbs into the red, with the volcano small behind it."}, {"scene": "4", "env": "sky", "idea": "The pipe blows open, lava sprays high, the eruption fades, and new land forms."}, {"scene": "5", "env": "sky", "idea": "Closing: the chamber heats and fills again while the viewer is asked which part surprised them, the heat or the gas."}],
  "ending": {"closing_question": "Which surprises you more, the heat or the gas?", "comment_line": "Comment your answer below.", "tail": "In the 2.5 seconds of silence the chamber keeps glowing and its bubbles keep rising slowly, then it settles calm and glowing, never cut off."},
  "sentences": [
    {"scene": "1", "objects": [{"prop": "magma_chamber", "look": "cutaway volcano with banded brown rock layers, dim red chamber and a closed vent pipe, one first bubble in the pipe", "place": "centre, huge, fills most of the frame width and height", "stands_for": "the volcano and the magma under it"}], "change": "the chamber glows brighter and a first bubble rises in the pipe", "camera": "slow push in, close on the whole cutaway", "texts": [], "flows": []},
    {"scene": "1", "objects": [{"prop": "magma_chamber", "look": "cutaway volcano, chamber glowing orange, magma level rising in the pipe", "place": "centre, huge, fills the frame", "stands_for": "the volcano"}, {"prop": "rock", "look": "small grey boulder with cracks", "place": "front left, small, standing on the ground in front of the cone", "stands_for": "the rock above that has to hold"}], "change": "the magma level climbs and the chamber glows brighter", "camera": "slow push in, close on the chamber and pipe", "texts": [], "flows": []},
    {"scene": "1", "objects": [{"prop": "magma_chamber", "look": "cutaway volcano, chamber glowing orange, pipe closed", "place": "centre, huge, fills the frame", "stands_for": "the volcano"}, {"prop": "rock", "look": "small grey boulder with cracks", "place": "front left, small", "stands_for": "the rock above that has to hold"}], "change": "the chamber glows hotter and its fill rises a little", "camera": "slow push in, close on the glowing chamber", "texts": [], "flows": []},
    {"scene": "2", "objects": [{"prop": "magma_chamber", "look": "cutaway volcano, chamber filling with glowing red-orange magma", "place": "centre, huge, fills the frame", "stands_for": "the magma chamber deep below the cone"}, {"prop": "rock", "look": "small grey boulder", "place": "front left, small", "stands_for": "solid rock around the chamber"}], "change": "the chamber fills with more and more glowing magma", "camera": "close on the chamber, slow push in", "texts": [], "flows": []},
    {"scene": "2", "objects": [{"prop": "magma_chamber", "look": "cutaway volcano, magma turning from dull red to bright orange-yellow", "place": "centre, huge, fills the frame", "stands_for": "the hot magma chamber"}, {"prop": "thermometer", "look": "tall thermometer, liquid rising from blue to red", "place": "right, front, medium-small beside the cone", "stands_for": "the heat of the rock"}, {"prop": "rock", "look": "small grey boulder", "place": "front left, small", "stands_for": "rock hot enough to melt"}], "change": "the magma turns from dull red to bright orange-yellow and the thermometer liquid climbs to red", "camera": "close on the chamber, slow push in", "texts": [{"words": "1000 °C", "starts": "one thousand degrees Celsius", "ends": 7}], "flows": []},
    {"scene": "2", "objects": [{"prop": "magma_chamber", "look": "cutaway volcano, bright orange magma level rising in the pipe", "place": "centre, huge, fills the frame", "stands_for": "magma rising"}, {"prop": "thermometer", "look": "thermometer with red liquid", "place": "right, front, medium-small", "stands_for": "the heat"}, {"prop": "rock", "look": "small grey boulder", "place": "front left, small", "stands_for": "heavier solid rock"}], "change": "the magma level rises up the pipe", "camera": "close on the pipe, slow push in", "texts": [], "flows": []},
    {"scene": "2", "objects": [{"prop": "magma_chamber", "look": "cutaway volcano, chamber full and glowing hotter", "place": "centre, huge, fills the frame", "stands_for": "the pressurised chamber"}, {"prop": "thermometer", "look": "thermometer with red liquid", "place": "right, front, medium-small", "stands_for": "the heat"}, {"prop": "rock", "look": "small grey boulder", "place": "front left, small", "stands_for": "the squeezing walls"}], "change": "the chamber fills to the top and glows hotter", "camera": "close on the chamber, slow push in", "texts": [], "flows": []},
    {"scene": "2", "objects": [{"prop": "magma_chamber", "look": "cutaway volcano, full glowing chamber with small bubbles forming inside the magma", "place": "centre, huge, fills the frame", "stands_for": "magma with dissolved gas"}, {"prop": "particles", "look": "small pale glowing bubbles rising", "place": "right, small, beside the chamber", "stands_for": "dissolved gas"}], "change": "tiny bubbles appear inside the magma and multiply", "camera": "close on the chamber, slow push in", "texts": [], "flows": []},
    {"scene": "2", "objects": [{"prop": "magma_chamber", "look": "cutaway volcano, magma filling the pipe nearly to the crater, bubbles swelling", "place": "centre, huge, fills the frame", "stands_for": "magma pushed up the pipe by gas"}, {"prop": "particles", "look": "bigger pale glowing bubbles streaming upward", "place": "right, small, beside the pipe", "stands_for": "swelling gas bubbles"}], "change": "bubbles swell and the magma is pushed up the pipe toward the crater", "camera": "tilt up along the pipe, close on the crater", "texts": [], "flows": []},
    {"scene": "3", "objects": [{"prop": "gauge", "look": "big dial gauge, coloured arc from green to red, needle starting in green", "place": "centre, large, fills most of the frame", "stands_for": "the pressure cooker pressure dial, the pressure in the chamber"}, {"prop": "magma_chamber", "look": "small cutaway volcano with a full glowing chamber", "place": "back right, small", "stands_for": "the volcano the gauge stands for"}], "change": "the needle swings from green up into the red zone", "camera": "slow push in, close on the gauge", "texts": [], "flows": []},
    {"scene": "4", "objects": [{"prop": "magma_chamber", "look": "cutaway volcano, magma at the crater and the top of the pipe cracking open with the first lava flare", "place": "centre, huge, fills the frame", "stands_for": "the volcano as the pipe blows open"}, {"prop": "cloud", "look": "dark storm cloud", "place": "back top, small, above the crater", "stands_for": "ash cloud to come"}], "change": "the pipe blows open and the first lava flares at the crater", "camera": "close on the crater, slight push in", "texts": [], "flows": []},
    {"scene": "4", "objects": [{"prop": "magma_chamber", "look": "cutaway volcano, lava spraying high from the crater, chamber bright yellow-orange", "place": "centre, huge, fills the frame", "stands_for": "the eruption"}, {"prop": "cloud", "look": "dark storm cloud", "place": "back top, small, above the crater", "stands_for": "ash"}], "change": "lava sprays high out of the crater", "camera": "tilt up with the spray, close on the crater", "texts": [], "flows": []},
    {"scene": "4", "objects": [{"prop": "magma_chamber", "look": "cutaway volcano, lava spray dying down, chamber level sinking and glow fading", "place": "centre, huge, fills the frame", "stands_for": "the pressure released"}, {"prop": "cloud", "look": "dark storm cloud", "place": "back top, small", "stands_for": "ash"}], "change": "the spray dies down and the magma level and glow sink", "camera": "slow pull back, still close on the volcano", "texts": [], "flows": []},
    {"scene": "4", "objects": [{"prop": "magma_chamber", "look": "cutaway volcano, calm, glow cooling to dull red", "place": "centre, huge, fills the frame", "stands_for": "the volcano after the eruption"}, {"prop": "island", "look": "small round green island with a beach", "place": "front right, small beside the cone", "stands_for": "new land built by eruptions"}], "change": "the glow cools to dull red and the small island beside it grows", "camera": "slow pull back, still close on the volcano", "texts": [], "flows": []},
    {"scene": "5", "objects": [{"prop": "magma_chamber", "look": "cutaway volcano, chamber heating up again, red-orange", "place": "centre, huge, fills the frame", "stands_for": "the heat and the gas inside the volcano"}, {"prop": "thermometer", "look": "thermometer with liquid rising blue to red", "place": "right, front, medium-small", "stands_for": "the heat"}, {"prop": "particles", "look": "small pale glowing bubbles", "place": "left, small", "stands_for": "the gas"}], "change": "the chamber heats up again and bubbles start to rise", "camera": "slow push in, close on the chamber", "texts": [], "flows": []},
    {"scene": "5", "objects": [{"prop": "magma_chamber", "look": "cutaway volcano, chamber filling and glowing bright orange, bubbles rising", "place": "centre, huge, fills the frame", "stands_for": "the heat and the gas inside the volcano"}, {"prop": "thermometer", "look": "thermometer with red liquid", "place": "right, front, medium-small", "stands_for": "the heat"}, {"prop": "particles", "look": "small pale glowing bubbles", "place": "left, small", "stands_for": "the gas"}], "change": "the chamber fills and glows brighter as bubbles rise", "camera": "slow push in, close on the chamber", "texts": [], "flows": []}
  ]
}

The last word ends at 52.62 s; the video is 55.12 s long. Make 2 to 4 main scenes (a scene = a shot plus its "continue": true shots), plus at most a short opening and a short closing scene. Each shot lasts 1.5 to 12 seconds (over 9 s gives a warning); aim for 3 to 8.

Think through the scenes and the changes first (section 2), then reply with the complete show.json and nothing else: no code fence, no comments, no text before or after it.
