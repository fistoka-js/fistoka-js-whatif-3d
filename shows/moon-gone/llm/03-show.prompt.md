<!-- One LLM call. Read all of it as your instructions, then write ONLY your answer into the matching .reply.md file (same name, .reply.md instead of .prompt.md). -->

=== SYSTEM ===

You are the director of a vertical 3D science video. A narrator's voice is already recorded. You write the file that tells a 3D engine what to show while each word is spoken: show.json. You reply with that JSON object only.

# 1. How the engine works

- A show is a list of SHOTS. Each shot is its own small stage: one environment ("env"), one to three props, one camera instruction, and actions that fire when given words are spoken.
- A shot lasts from its "start" (a spoken phrase) until the next shot's start. The first shot starts at 0 s and has no "start". The last shot runs to the end of the voice.
- Props, environments, actions and camera moves come ONLY from the catalogue in section 5. Each shot is a fresh stage: a prop used in shot 2 must be declared again in shot 3 if you want it there.
- The camera frames the shot by itself. It looks at all props in the shot (or only the ids in "camera.focus") over the WHOLE shot, including where moving props travel and props that appear later, and fits them in the frame. So you never set camera positions; you choose framing, angle and move.
- Stage space: centred on [0, 0, 0]. +x is right, +y is up, +z is toward the viewer. One unit is about half the frame width at medium framing. Every prop is built to fit a 1-unit box; "size" scales it.
- Captions of the spoken words are drawn automatically in the bottom quarter of the frame. You never write captions.

# 2. How to think (do this before writing any JSON)

1. BEATS. Read the sentence table. Split it into 7 to 10 beats. A beat is one idea, usually one sentence, sometimes two short ones, lasting 3 to 8 seconds. A beat may start in the middle of a sentence, on the word that introduces the new thing ("...The secret is | the water molecule."). Never make a beat shorter than 2 seconds; only a one-sentence opening hook may be shorter (1.5 s at least).
2. ONE THING TO LOOK AT. For each beat, name the single thing the viewer should be looking at while it is spoken. It must be concrete and in the catalogue. Turn abstract ideas into a physical stand-in:
   - a comparison or a percentage -> "bars" or "scale_balance" or a "count"
   - temperature -> "thermometer"; time -> "clock"; danger or a problem -> an icon "warning" or "x"; money -> "coin_stack"; energy -> "battery" or "lightbulb"
   - a crowd of small things (air, molecules, dust, debris) -> "particles" or "asteroid" with "count"
   - something hitting or shooting -> "beam" or "arrow" growing toward a prop, then "shake" or "pulse" on it
   - a block of some material (wax, brick, ice cube) -> "box" with a colour and proportions
3. ENVIRONMENT AND PROPS. Pick the environment that says where we are (space for planets, underwater for the sea, micro for molecules and cells, sky for anything outdoors on Earth, studio or lab for objects and charts, planet_surface for standing on another world). Then one or two props, three at most (beams and arrows count). Neighbouring shots must differ in environment OR main subject; if two neighbours share an environment type, change its look (nebula, colour, tint, time of day) and the camera angle. Use the same environment with the same settings at most twice in the video.
4. MOMENTS. For every beat, find the exact spoken words where something should change: a prop appears when its noun is spoken, a label lands on the word it names, a number counts when the number is said, a thing moves on its verb ("sinks", "launch", "smashed"). Every shot needs at least one action, and a long shot needs one every 3 to 4 seconds. Give each shot a camera move that fits the feeling (push_in for a reveal, pull_out for "how big", orbit to admire an object, rise for an ending or a launch, pan or drift for a calm moment).
5. WRITE THE JSON. Then run the checklist in section 4 against it before you reply.

# 3. Rules the checker enforces (a show that breaks one is rejected)

Shape:
- Top level: {"format": 1, "title": "...", "voice": {"audio": "voice.mp3", "words": "words.json"}, "shots": [...]}. Optional: "style": {"accent": "#ffe14d"}, "tail" (seconds after the last word, 0..3). Nothing else.
- Shot fields: "id" (unique; a-z, 0-9 and dashes), "start" (not on the first shot), "env", "props", "camera", "actions", optional "transition" ("cut" or "dip"). Nothing else.
- "env" is {"type": "<environment>", ...that environment's params} or just "<environment>".
- Prop fields: "id" (unique in the shot), "type", "at", "size", "rotate", "hidden", plus ONLY the params listed for that prop, plus that prop's "anim" params as starting values (e.g. "thrust": 0 on a rocket). Unknown fields are errors everywhere.
- Action fields: "at" (WHEN, an anchor), "do", "prop" where the action takes one, "over" (seconds) ONLY on actions that list a default over, plus the fields listed for that action. "prop" must be the id of a prop in the SAME shot.
- "set" may only animate a param listed in that prop's "anim" list, inside its range. If an anim param has the same name as a prop field (the fire's "size"), "size" on the prop means the prop's scale; change the anim value only with "set".
- Stage-space props ("arrow", "beam") have "from" and "to" (a slot, [x, y, z] or a prop id in the shot) and NO "at", "size" or "rotate". They cannot move, scale, spin, orbit, bob, shake or pulse.
- "icon" goes on a prop with "prop", or at a place with "place" (slot or [x, y, z]). Its "at" is the TIME, like every action.
- Text limits: label text up to 32 characters, text up to 40, count unit up to 16. Colours: a palette name or "#rrggbb".

Timing (this is where most rejections come from):
- An anchor is a spoken phrase of 1 to 6 words, copied from the word list (case and punctuation are ignored). It means the start of the FIRST place that phrase is spoken AT OR AFTER the start of the shot it is in. A shot's own "start" is searched from the previous shot's start.
- So when a word is spoken more than once (the, it, rings, water, and), use a 2-4 word phrase that only occurs once in the shot, e.g. "solid wax" instead of "wax".
- Every action's time must fall inside its own shot. A word spoken in the next shot cannot be used.
- Each shot must last 1.5 to 12 seconds (over 9 s gives a warning). Aim for 3 to 8 seconds.
- Shot starts must come in spoken order.
- For a moment between words use {"phrase": "some words", "offset": 0.3} (seconds; may be negative) or {"phrase": "some words", "edge": "end"}. To fire several things one after another, give them the same phrase with offsets 0, 0.15, 0.3. {"shot": 0.5} means halfway through the current shot. Never use {"time": ...}.

# 4. Picture rules (an automatic picture check fails or flags shows that break these)

Size and framing:
- One prop alone at size 1 fills about 70% of the frame width at "medium" framing. The camera fits ALL props in the shot (and the full path of anything that moves), so two or three props, or a prop that travels far, are each drawn smaller. Then raise "size" (1.2 to 1.8) and keep the props close together (within about 1 unit of each other).
- Keep sizes in a shot similar unless one prop is a backdrop. A tiny prop next to a huge one becomes a dot.
- BACKDROP trick: for something meant to fill the sky or background (an arch of rings, a giant planet behind a person), put it behind (z about -2.5), make it large (size 4 to 5), and set "camera": {"focus": ["<the foreground prop>"], "framing": "wide"}. The camera then frames the small subject and the backdrop spills off the edges. Never point an action at a backdrop prop (props that actions point at must stay at least 60% inside the frame).
- "close" framing makes one prop big; "wide" shows a whole scene. Use "close" for a single small object (a molecule, an eye, a coin).
- Anything the narration names must be big enough to see: size 0.6 or more. "particles" meant to be noticed need "dot" 0.08 or more and "size" 1 or more; a small cloud of tiny dots reads as noise.
- The first shot is the thumbnail moment: one clear subject, big (size 1.2 to 1.5, or "close" framing), with at most one other small prop. Props that appear later still count for framing, so anything that appears later in the first shot should sit on or right next to the main subject (like a ring growing round a planet), not far away from it.

Ground:
- Each environment line in the catalogue says whether it has a ground. On a ground, y = 0 is the ground: ordinary props stand on it, with their base at the "at" height.
- Props marked [floats] are centred on their "at" point instead, so on an environment WITH a ground a floating prop at y = 0 sinks half into the ground. Lift it: "at": [0, 0.7, 0] for size 1, about 0.6 x size in general. Examples: plane, rocket, submarine, cloud, planet, bomb_blast, fish, bird, brain, heart.
- In space, micro, studio with "floor": false, underwater with "seabed": false and sky with "ground": "none" there is no ground and everything floats; y can be anything.

Visibility and motion:
- Something must be visible from the first frame of every shot. If props "appear" later, make the first one appear on the shot's first words, or keep one prop visible from the start.
- Props that actions point at must stay at least 60% inside the frame: do not "move" them off screen. To make something leave, use "disappear" (style "fly_out" with "to": "far-right").
- A shot whose camera is "still" or "drift" must have an action at least every 7 seconds.
- Do not put a prop in the bottom quarter of the frame (the captions are there): avoid "at" y below -0.9 unless the camera angle is high or top.

Overlays (label, text, count, icon):
- At most 2 on screen at the same time; end them with "until" when the next one comes. Not every shot needs one; about half the shots is right.
- Labels: 1 to 3 words, CAPITALS, under 22 characters, naming what the picture shows ("ICE + ROCK", "SOLID WAX"). Never a full sentence and never a copy of the caption.
- Text "title" for a short heading, "number" for a big figure, "stamp" for a verdict like "WRONG" or "MYTH". "count" for a number that is spoken.
- Never rely on text to explain what the picture should show. If a label is the only thing that tells the viewer what they are looking at, choose a better prop.

Good to know (not obvious from the catalogue):
- "ring": its radius comes from "size" (size 2.6 rings a planet of size 1.3); "tilt" 0 faces the camera like a hoop, 90 is edge-on, 70-78 looks like Saturn's rings.
- "particles" with "shape": "ring" lie flat (like a plate): seen from angle "front" they look like a line; use angle "top" or "high" to show the circle. Use 20 or more of them for a ring that reads as a ring.
- "bars" draws the values relative to the tallest bar; give 2 to 4 values for a clear comparison and start it at "grow": 0 to make it rise on a word.
- A shot can show the same thing as a neighbour from a new place: change the environment and the subject's role (for example an arch seen from a field at night, then from the ocean by day).

Colour and variety:
- Pick prop colours that contrast with the environment (a white or yellow prop on a blue background, a dark or red prop on a pale sky). Do not put a teal prop in a teal studio.
- Vary the camera: do not use the same "move" in neighbouring shots, and use at least 4 different moves and 3 different angles in the video.
- Use "transition": "dip" once or twice for a big jump (for example from Earth to deep space). Everything else is a cut.
- The two examples below show the format and the way of thinking. Do not reuse their scenes, layouts or prop choices for a different topic.

CHECKLIST before replying:
[ ] 7 to 10 shots; first shot has no "start"; every other shot's "start" is a phrase from the word list; each shot 2 to 9 s (a short opening hook: 1.5 s at least).
[ ] Every anchor is a phrase spoken inside that shot, and repeated words are made unique with more words.
[ ] Every prop type, env type, param, action, field and value appears in the catalogue for THAT prop or action.
[ ] Arrows and beams have from/to and no at/size; "set" only uses anim params.
[ ] Floating props on a ground are lifted; 2-3 props in a shot have size raised; backdrop props have no actions.
[ ] Every shot has a visible subject from its first frame, at least one action, and a camera move that differs from the previous shot.
[ ] At most 2 overlays at once; labels short and in capitals.

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

ENVIRONMENTS (name (params) [ground or not] -- what it is)
- space (nebula=blue|purple|teal|red|none, stars 0..2, tint) [no ground: everything floats] -- Outer space: layered stars, soft nebula glow, floating dust. For planets, stars, anything cosmic.
- studio (color, floor:bool) [ground (floor), unless floor: false] -- A clean coloured studio backdrop with a soft floor. The default look for explaining an object.
- sky (time=day|sunset|night, ground=grass|ocean|desert|ice|none, clouds 0..1) [ground (grass/ocean/desert/ice), unless ground: "none"] -- Outdoors under a sky (day, sunset or night) above grass, ocean, desert or ice. For anything on Earth.
- underwater (seabed:bool, depth=shallow|deep) [ground (seabed), unless seabed: false] -- Under the sea: blue-green water, light shafts, bubbles, optional sandy seabed. For ocean life, subs, pressure.
- micro (tint=warm|cool|green) [no ground: everything floats] -- Inside the body or under a microscope: soft glowing gradient with drifting out-of-focus blobs. Props float.
- lab (color) [ground (grid floor)] -- A dark neutral lab / showroom with a faint grid floor and a spotlight pool. For machines, objects and charts.
- planet_surface (ground, sky, companion=none|moon|ringed) [ground (the planet's surface)] -- The surface of another world: ground, low horizon, big sky with stars and an optional moon or ringed planet.

ACTIONS [needs a prop or not, default "over" seconds] fields -- what it does. Every action has "at" (anchor) and "do". "over" (seconds) is allowed only where a default is listed.
- appear [prop, over=0.5s] style=pop|fade|grow|drop|fly_in (default pop); from:place (default "far-left") -- Show a prop. A prop whose first action is appear starts hidden.
- disappear [prop, over=0.4s] style=fade|shrink|pop|fly_out (default fade); to:place (default "far-right") -- Hide a prop.
- move [prop, over=1.2s] to:place; toward:propId; amount 0..1 (default 0.75); ease=EASE (default in_out) -- Move a prop to a place, or toward another prop.
- scale [prop, over=0.8s] to 0.05..10 (required); ease=EASE (default in_out) -- Change a prop's size (to = multiple of its starting size).
- color [prop, over=0.8s] to:color (required) -- Tint a prop's main colour.
- spin [prop, no over] speed -5..5 (default 0.1); axis=y|x|z (default y) -- Start (or stop, with speed 0) turning a prop.
- orbit [prop, no over] around:propId (required); radius 0.1..5; period 0.5..60 (default 6); tilt -90..90 (default 15) -- Circle around another prop (keeps going until a later move).
- bob [prop, no over] height 0..2 (default 0.08); period 0.3..20 (default 2.5) -- Gentle floating up and down (keeps going).
- shake [prop optional, no over] strength 0..2 (default 0.5); for 0.05..5 (default 0.6) -- Shake a prop, or the camera when no prop is given.
- pulse [prop, over=0.5s] strength 0..2 (default 0.25) -- One quick swell and back, to draw the eye.
- glow [prop, over=0.6s] to 0..2 (required) -- Change how much a prop glows (0 = none).
- set [prop, over=1s] param:string (required); to:number (required); ease=EASE (default in_out) -- Animate one of the prop's own numbers (see the prop's "animatable" list).
- label [prop, over=0.3s] text:string (required); side=auto|left|right|top (default auto); until:anchor -- A callout with a leader line, attached to a prop.
- text [no prop, over=0.3s] text:string (required); style=title|stamp|number (default title); pos=top|middle (default top); until:anchor -- Free on-screen text.
- count [no prop, over=1.5s] from:number (default 0); to:number (required); unit:string (default ""); decimals 0..3 (default 0); pos=top|middle (default top); until:anchor -- A number that counts from one value to another.
- icon [prop optional, over=0.35s] name=x|check|question|warning|heart|bolt (required); place:place; until:anchor -- Pop an icon on a prop or at a place.
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

TRANSITIONS: cut = hard cut (default); dip = quick dip through the new shot's environment colour

COLOURS: any #rrggbb, or a name: red, orange, yellow, green, teal, cyan, blue, indigo, purple, pink, white, grey, black, brown, gold, accent (accent = the channel's yellow)

EVERY PLACED PROP has: id:string (required), type:string (required), at:place (default "center"), size 0.05..6 (default 1), rotate=[number...] (default [0, 0, 0]), hidden:bool (default false). Props with stageSpace: true are drawn between their own points (from/to); they have no at, size or rotate, and cannot move, scale, spin, orbit, bob, shake or pulse.
ANCHORS: anchor: "spoken phrase" | {phrase, edge, offset} | {time} | {shot}

# 6. Examples

## Example 1: What if Earth had rings like Saturn?

INPUT (the words, as you will get them):
S1 [0.09-1.46] What if Earth had rings like Saturn?
   What 0.09 | if 0.18 | Earth 0.29 | had 0.47 | rings 0.66 | like 0.90 | Saturn? 1.04
S2 [1.82-5.27] Look up at night, and a glowing arch would stretch across the whole sky.
   Look 1.82 | up 1.99 | at 2.11 | night, 2.21 | and 2.78 | a 2.85 | glowing 2.91 | arch 3.35 | would 3.62 | stretch 3.76 | across 4.16 | the 4.52 | whole 4.60 | sky. 4.83
S3 [5.64-8.58] You would see it in the daytime too, pale and enormous.
   You 5.64 | would 5.70 | see 5.82 | it 6.00 | in 6.08 | the 6.16 | daytime 6.25 | too, 6.70 | pale 7.38 | and 7.93 | enormous. 8.01
S4 [8.95-12.24] The rings would be made of ice and rock, circling above the equator.
   The 8.95 | rings 9.03 | would 9.31 | be 9.42 | made 9.52 | of 9.72 | ice 9.88 | and 10.19 | rock, 10.31 | circling 10.91 | above 11.34 | the 11.65 | equator. 11.73
S5 [12.61-17.69] Their shadow would fall across half the planet, so some places would probably get colder, darker winters.
   Their 12.61 | shadow 12.71 | would 13.10 | fall 13.24 | across 13.53 | half 13.86 | the 14.07 | planet, 14.16 | so 14.88 | some 14.99 | places 15.14 | would 15.53 | probably 15.67 | get 16.06 | colder, 16.24 | darker 16.94 | winters. 17.24
S6 [18.07-19.49] Satellites would have a real problem.
   Satellites 18.07 | would 18.58 | have 18.68 | a 18.78 | real 18.84 | problem. 19.09
S7 [19.86-23.27] Any orbit that crossed the rings would get smashed by countless fragments.
   Any 19.86 | orbit 20.07 | that 20.37 | crossed 20.49 | the 20.86 | rings 20.94 | would 21.22 | get 21.34 | smashed 21.48 | by 22.02 | countless 22.19 | fragments. 22.63
S8 [23.65-26.38] So rockets would launch from far north or far south instead.
   So 23.65 | rockets 23.77 | would 24.10 | launch 24.24 | from 24.50 | far 24.64 | north 24.90 | or 25.34 | far 25.43 | south 25.68 | instead. 25.98
S9 [26.75-27.81] And here's the strange part.
   And 26.75 | here's 26.83 | the 27.07 | strange 27.15 | part. 27.48
S10 [28.18-29.31] Rings don't last forever.
   Rings 28.18 | don't 28.41 | last 28.62 | forever. 28.87
S11 [29.68-32.41] Saturn's rings are slowly raining down onto the planet.
   Saturn's 29.68 | rings 30.09 | are 30.39 | slowly 30.54 | raining 31.03 | down 31.38 | onto 31.73 | the 31.90 | planet. 31.99
S12 [32.79-36.18] Scientists think they could be mostly gone in a few hundred million years.
   Scientists 32.79 | think 33.34 | they 33.54 | could 33.65 | be 33.77 | mostly 33.87 | gone 34.30 | in 34.66 | a 34.78 | few 34.83 | hundred 35.09 | million 35.40 | years. 35.74
S13 [36.55-38.15] So enjoy the view while it lasts.
   So 36.55 | enjoy 36.72 | the 37.04 | view 37.13 | while 37.39 | it 37.58 | lasts. 37.66
S14 [38.55-39.49] Follow for more what ifs.
   Follow 38.55 | for 38.74 | more 38.86 | what 39.04 | ifs. 39.19

THE BEAT PLAN (your thinking, not part of the reply):
- hook (S1, 1.8 s): Earth, then a ring band grows round it on "rings like Saturn". Space, push_in.
- night-arch (S2): what you would SEE: an arch across a night sky over a child. The arch is a backdrop (big, z -2.5, no actions on it); camera focus on the child, who pulses on "glowing arch"; a soft camera shake on "whole sky". No label: the picture says it.
- daytime (S3): same idea, new place and time: ocean by day, a sailing ship as the subject (camera focus), pan. The arch is a backdrop again, so the overlay is a title text, not a label on the arch.
- ice-rock (S4): what rings are made of: particles in a ring shape around Earth, white mixed with grey. Orbit from high. Label "ICE + ROCK" on its words.
- shadow (S5): Earth goes darker on "half the planet"; a thermometer pops in and drops on "colder". Three props, so sizes raised and kept close.
- satellites (S6-S7): a warning icon on "real problem", debris flies in on "crossed the rings", shake + x icon on "smashed", the satellite shrinks away.
- launch (S8): rocket on an ice field (far north); it floats, so it is lifted to y 0.55; thrust on, then it moves up on "launch". Camera rise, low angle.
- ring-rain (S9-S11): Saturn; a question icon on "strange part", an arrow grows toward Saturn on "raining down".
- gone (S12): a ringless gas planet with a separate ring prop that shrinks away on "mostly gone"; a count to 300 on "few hundred".
- enjoy (S13-S14): back to an arch at sunset over a sitting person (backdrop trick again, new colours, camera rise because the previous shot pulled out); title text on "Follow".

OUTPUT (the reply):
{
  "format": 1,
  "title": "What if Earth had rings like Saturn?",
  "voice": {"audio": "voice.mp3", "words": "words.json"},
  "shots": [
    {
      "id": "hook",
      "env": {"type": "space", "nebula": "purple"},
      "camera": {"move": "push_in", "angle": "three-quarter", "amount": 0.6},
      "props": [
        {"id": "earth", "type": "planet", "look": "earth", "at": "center", "size": 1.3},
        {"id": "band", "type": "ring", "style": "flat", "tilt": 72, "thickness": 0.06, "color": "#f1e2b8", "at": "center", "size": 2.7}
      ],
      "actions": [
        {"at": "rings like Saturn", "do": "appear", "prop": "band", "style": "grow", "over": 0.6}
      ]
    },
    {
      "id": "night-arch",
      "start": "Look up",
      "env": {"type": "sky", "time": "night", "ground": "grass", "clouds": 0.2},
      "camera": {"move": "rise", "angle": "low", "framing": "wide", "focus": ["kid"], "amount": 0.4},
      "props": [
        {"id": "arch", "type": "ring", "style": "flat", "tilt": 10, "thickness": 0.08, "color": "#fff0c8", "at": [0, -0.6, -2.5], "size": 5},
        {"id": "kid", "type": "person", "pose": "stand", "color": "orange", "at": [0.35, 0, 0.9], "size": 0.9}
      ],
      "actions": [
        {"at": "glowing arch", "do": "pulse", "prop": "kid", "strength": 0.15},
        {"at": "whole sky", "do": "shake", "strength": 0.3, "for": 0.5}
      ]
    },
    {
      "id": "daytime",
      "start": "You would see",
      "env": {"type": "sky", "time": "day", "ground": "ocean", "clouds": 0.5},
      "camera": {"move": "pan", "angle": "front", "framing": "wide", "focus": ["boat"], "amount": 0.5},
      "props": [
        {"id": "arch", "type": "ring", "style": "flat", "tilt": 10, "thickness": 0.05, "color": "white", "at": [0, -0.6, -2.5], "size": 5},
        {"id": "boat", "type": "ship", "style": "sail", "color": "red", "at": [-0.35, 0, 0.8], "size": 0.9}
      ],
      "actions": [
        {"at": "daytime", "do": "text", "text": "EVEN BY DAY", "style": "title", "pos": "top"},
        {"at": "pale and enormous", "do": "pulse", "prop": "boat", "strength": 0.15}
      ]
    },
    {
      "id": "ice-rock",
      "start": "The rings would",
      "transition": "dip",
      "env": {"type": "space", "nebula": "blue"},
      "camera": {"move": "orbit", "angle": "high", "amount": 0.5},
      "props": [
        {"id": "earth", "type": "planet", "look": "earth", "at": "center", "size": 1.1},
        {"id": "bits", "type": "particles", "shape": "ring", "count": 500, "color": "white", "color2": "#9a8a78", "mix": 0.45, "dot": 0.035, "at": "center", "size": 2.6, "speed": 0.4}
      ],
      "actions": [
        {"at": "ice and rock", "do": "label", "prop": "bits", "text": "ICE + ROCK", "side": "right"},
        {"at": "equator", "do": "set", "prop": "bits", "param": "speed", "to": 1.2, "over": 0.8}
      ]
    },
    {
      "id": "shadow",
      "start": "Their shadow",
      "env": {"type": "space", "nebula": "none"},
      "camera": {"move": "drift", "angle": "front", "amount": 0.5},
      "props": [
        {"id": "earth", "type": "planet", "look": "earth", "at": [-0.35, 0, 0], "size": 1.2},
        {"id": "band", "type": "ring", "style": "flat", "tilt": 78, "thickness": 0.06, "color": "#f1e2b8", "at": [-0.35, 0, 0], "size": 2.4},
        {"id": "temp", "type": "thermometer", "at": [1.05, 0, 0.2], "size": 0.75, "level": 0.7}
      ],
      "actions": [
        {"at": "half the planet", "do": "color", "prop": "earth", "to": "#5f7590", "over": 1.0},
        {"at": "colder", "do": "appear", "prop": "temp", "style": "pop"},
        {"at": "colder", "do": "set", "prop": "temp", "param": "level", "to": 0.15, "over": 1.2},
        {"at": "darker winters", "do": "label", "prop": "temp", "text": "COLDER WINTERS", "side": "top"}
      ]
    },
    {
      "id": "satellites",
      "start": "Satellites would",
      "env": {"type": "space", "nebula": "red"},
      "camera": {"move": "push_in", "angle": "three-quarter", "amount": 0.5},
      "props": [
        {"id": "sat", "type": "satellite", "at": [-0.2, 0.15, 0], "size": 1.0},
        {"id": "debris", "type": "asteroid", "count": 24, "at": [0.6, -0.1, -0.3], "size": 1.5}
      ],
      "actions": [
        {"at": "real problem", "do": "icon", "prop": "sat", "name": "warning", "until": "smashed"},
        {"at": "crossed the rings", "do": "appear", "prop": "debris", "style": "fly_in", "from": "far-right", "over": 0.8},
        {"at": "smashed", "do": "shake", "prop": "sat", "strength": 0.8, "for": 0.6},
        {"at": "smashed", "do": "icon", "prop": "sat", "name": "x"},
        {"at": "countless fragments", "do": "disappear", "prop": "sat", "style": "shrink", "over": 0.6}
      ]
    },
    {
      "id": "launch",
      "start": "So rockets",
      "env": {"type": "sky", "time": "day", "ground": "ice", "clouds": 0.3},
      "camera": {"move": "rise", "angle": "low", "framing": "medium", "amount": 0.6},
      "props": [
        {"id": "rocket", "type": "rocket", "color": "red", "at": [0, 0.55, 0], "size": 1.0, "thrust": 0}
      ],
      "actions": [
        {"at": "rockets", "do": "set", "prop": "rocket", "param": "thrust", "to": 1, "over": 0.5},
        {"at": "launch", "do": "move", "prop": "rocket", "to": [0, 1.6, 0], "over": 2.2, "ease": "in"},
        {"at": "far north", "do": "text", "text": "FAR NORTH", "style": "title", "pos": "top"}
      ]
    },
    {
      "id": "ring-rain",
      "start": "And here's",
      "transition": "dip",
      "env": {"type": "space", "nebula": "teal"},
      "camera": {"move": "orbit", "angle": "three-quarter", "amount": 0.4},
      "props": [
        {"id": "saturn", "type": "planet", "look": "gas", "rings": true, "at": "center", "size": 1.5},
        {"id": "rain", "type": "arrow", "from": [1.2, 1.0, 0.3], "to": "saturn", "color": "cyan", "length": 0}
      ],
      "actions": [
        {"at": "strange part", "do": "icon", "prop": "saturn", "name": "question", "until": "Saturn's rings"},
        {"at": "raining down", "do": "set", "prop": "rain", "param": "length", "to": 1, "over": 0.8},
        {"at": "raining down", "do": "label", "prop": "saturn", "text": "RING RAIN", "side": "left"}
      ]
    },
    {
      "id": "gone",
      "start": "Scientists think",
      "env": {"type": "space", "nebula": "purple", "stars": 1.5},
      "camera": {"move": "pull_out", "angle": "front", "amount": 0.5},
      "props": [
        {"id": "saturn", "type": "planet", "look": "gas", "at": "center", "size": 1.3},
        {"id": "band", "type": "ring", "style": "flat", "tilt": 70, "thickness": 0.07, "color": "#e8d4a0", "at": "center", "size": 2.6}
      ],
      "actions": [
        {"at": "few hundred", "do": "count", "from": 0, "to": 300, "unit": "M YEARS", "pos": "top", "over": 1.4},
        {"at": "mostly gone", "do": "disappear", "prop": "band", "style": "shrink", "over": 1.6}
      ]
    },
    {
      "id": "enjoy",
      "start": "So enjoy",
      "env": {"type": "sky", "time": "sunset", "ground": "grass", "clouds": 0.3},
      "camera": {"move": "rise", "angle": "low", "framing": "wide", "focus": ["sitter"], "amount": 0.4},
      "props": [
        {"id": "arch", "type": "ring", "style": "flat", "tilt": 10, "thickness": 0.08, "color": "#ffd9a0", "at": [0, -0.6, -2.5], "size": 5},
        {"id": "sitter", "type": "person", "pose": "sit", "color": "teal", "at": [-0.3, 0, 0.9], "size": 0.8}
      ],
      "actions": [
        {"at": "enjoy the view", "do": "bob", "prop": "sitter", "height": 0.04, "period": 2},
        {"at": "Follow", "do": "text", "text": "FOLLOW FOR MORE", "style": "title", "pos": "top"}
      ]
    }
  ]
}

## Example 2: Why does ice float?

INPUT (the words, as you will get them):
S1 [0.10-3.00] Why does ice float, when most solids sink in their own liquid?
   Why 0.10 | does 0.21 | ice 0.38 | float, 0.56 | when 1.18 | most 1.33 | solids 1.57 | sink 1.99 | in 2.30 | their 2.37 | own 2.50 | liquid? 2.65
S2 [3.37-7.47] Drop a block of solid wax into melted wax, and it sinks straight to the bottom.
   Drop 3.37 | a 3.57 | block 3.64 | of 3.96 | solid 4.05 | wax 4.44 | into 4.79 | melted 4.94 | wax, 5.31 | and 6.02 | it 6.13 | sinks 6.21 | straight 6.58 | to 6.96 | the 7.05 | bottom. 7.14
S3 [7.85-8.89] But ice bobs right back up.
   But 7.85 | ice 7.93 | bobs 8.08 | right 8.33 | back 8.48 | up. 8.72
S4 [9.28-10.90] The secret is the water molecule.
   The 9.28 | secret 9.34 | is 9.89 | the 9.99 | water 10.08 | molecule. 10.38
S5 [11.27-14.91] It is shaped like a tiny boomerang: one oxygen, two hydrogens.
   It 11.27 | is 11.35 | shaped 11.46 | like 11.82 | a 11.94 | tiny 12.01 | boomerang: 12.39 | one 13.25 | oxygen, 13.40 | two 14.14 | hydrogens. 14.31
S6 [15.28-19.48] In liquid water, these molecules tumble around and pack closely together.
   In 15.28 | liquid 15.42 | water, 15.69 | these 16.39 | molecules 16.57 | tumble 17.10 | around 17.43 | and 18.09 | pack 18.20 | closely 18.61 | together. 19.03
S7 [19.86-24.59] But when water freezes, they lock into a neat hexagon pattern, with empty space in the middle.
   But 19.86 | when 19.94 | water 20.09 | freezes, 20.39 | they 21.09 | lock 21.20 | into 21.48 | a 21.70 | neat 21.75 | hexagon 22.10 | pattern, 22.64 | with 23.29 | empty 23.56 | space 23.80 | in 24.17 | the 24.24 | middle. 24.31
S8 [24.95-28.32] That open pattern makes ice about nine percent less dense than water.
   That 24.95 | open 25.13 | pattern 25.37 | makes 25.69 | ice 26.04 | about 26.26 | nine 26.51 | percent 26.82 | less 27.27 | dense 27.52 | than 27.77 | water. 27.92
S9 [28.69-31.83] So it floats, and most of an iceberg hides below the surface.
   So 28.69 | it 28.86 | floats, 28.94 | and 29.62 | most 29.77 | of 30.01 | an 30.08 | iceberg 30.18 | hides 30.59 | below 30.93 | the 31.19 | surface. 31.27
S10 [32.21-33.17] That matters for life.
   That 32.21 | matters 32.33 | for 32.67 | life. 32.80
S11 [33.54-39.06] Lakes freeze from the top down, and the ice works like a lid, keeping fish alive in the water underneath.
   Lakes 33.54 | freeze 33.78 | from 34.19 | the 34.31 | top 34.40 | down, 34.68 | and 35.40 | the 35.47 | ice 35.59 | works 35.86 | like 36.12 | a 36.25 | lid, 36.31 | keeping 36.92 | fish 37.28 | alive 37.57 | in 38.01 | the 38.09 | water 38.19 | underneath. 38.54
S12 [39.46-41.07] Follow for more everyday science.
   Follow 39.46 | for 39.68 | more 39.81 | everyday 40.23 | science. 40.57

THE BEAT PLAN (your thinking, not part of the reply):
- hook (S1): the question as a picture: an ice block floating high, a rock resting on the seabed. Bob on "Why does ice", question icon on "float", pulse the rock on "sink".
- wax (S2): melted wax = glowing dots (particles) in an orange studio with no floor; a wax block (box) drops in and sinks on "sinks". One label.
- ice-up (S3, starts on "But ice bobs"): the ice block shoots up on "bobs" with ease "back". It travels far, so its size is raised.
- molecule (S4-S5, starts mid-sentence on "the water molecule"): one h2o molecule, close framing, orbit. Label "H2O", spin on "boomerang", a title for the formula.
- liquid (S6): many small balls tumbling; speed up on "tumble around", spread down on "pack closely".
- hexagon (S7): a title "FREEZING" on "water freezes" (until the label comes); a ring of molecules seen from the top (angle "top") grows in on "lock into"; label, then a question icon placed in the empty middle.
- density (S8): a two-bar chart grows on "open pattern"; a count to 9 on "nine percent".
- iceberg (S9): the iceberg prop shows the hidden bulk by itself; one label.
- lake (S10-S11): fish under an ice lid that drops in on "top down"; heart icon on the fish on "keeping fish alive".
- outro (S12): the channel mascot changes colour; title text.

OUTPUT (the reply):
{
  "format": 1,
  "title": "Why does ice float?",
  "voice": {"audio": "voice.mp3", "words": "words.json"},
  "shots": [
    {
      "id": "hook",
      "env": {"type": "underwater", "depth": "shallow", "seabed": true},
      "camera": {"move": "push_in", "angle": "low", "amount": 0.5},
      "props": [
        {"id": "ice", "type": "box", "color": "#dff6ff", "finish": "glossy", "width": 1, "height": 0.6, "depth": 0.8, "round": 0.25, "at": [-0.45, 1.0, 0], "size": 1.0},
        {"id": "stone", "type": "rock", "color": "#6b6f78", "at": [0.5, 0, 0.2], "size": 1.0}
      ],
      "actions": [
        {"at": "Why does ice", "do": "bob", "prop": "ice", "height": 0.06, "period": 2.2},
        {"at": "float", "do": "icon", "prop": "ice", "name": "question", "until": "most solids"},
        {"at": "sink", "do": "pulse", "prop": "stone", "strength": 0.2}
      ]
    },
    {
      "id": "wax",
      "start": "Drop a block",
      "env": {"type": "studio", "color": "orange", "floor": false},
      "camera": {"move": "drift", "angle": "front", "amount": 0.5},
      "props": [
        {"id": "melted", "type": "particles", "shape": "box", "count": 140, "look": "dots", "color": "#ffd27a", "dot": 0.07, "at": [0, -0.3, 0], "size": 2.0, "speed": 0.3},
        {"id": "block", "type": "box", "color": "#f5e2b0", "finish": "matte", "width": 0.8, "height": 0.5, "depth": 0.6, "round": 0.15, "at": [0, 1.0, 0.2], "size": 0.55}
      ],
      "actions": [
        {"at": "Drop a block", "do": "appear", "prop": "block", "style": "drop"},
        {"at": "solid wax", "do": "label", "prop": "block", "text": "SOLID WAX", "side": "right", "until": "sinks"},
        {"at": "sinks", "do": "move", "prop": "block", "to": [0, -0.7, 0.2], "over": 1.0, "ease": "in_out"}
      ]
    },
    {
      "id": "ice-up",
      "start": "But ice bobs",
      "env": {"type": "underwater", "depth": "shallow", "seabed": false},
      "camera": {"move": "still", "angle": "front", "framing": "medium"},
      "props": [
        {"id": "ice", "type": "box", "color": "#dff6ff", "finish": "glossy", "width": 1, "height": 0.6, "depth": 0.8, "round": 0.25, "at": [0, -0.6, 0], "size": 1.2}
      ],
      "actions": [
        {"at": "bobs", "do": "move", "prop": "ice", "to": [0, 0.6, 0], "over": 0.9, "ease": "back"},
        {"at": "back up", "do": "bob", "prop": "ice", "height": 0.07, "period": 1.6}
      ]
    },
    {
      "id": "molecule",
      "start": "the water molecule",
      "transition": "dip",
      "env": {"type": "micro", "tint": "cool"},
      "camera": {"move": "orbit", "angle": "three-quarter", "framing": "close", "amount": 0.5},
      "props": [
        {"id": "h2o", "type": "molecule", "formula": "h2o", "at": "center", "size": 1.3}
      ],
      "actions": [
        {"at": "water molecule", "do": "label", "prop": "h2o", "text": "H2O", "side": "top", "until": "boomerang"},
        {"at": "boomerang", "do": "spin", "prop": "h2o", "speed": 0.25},
        {"at": "one oxygen", "do": "text", "text": "1 OXYGEN + 2 HYDROGEN", "style": "title", "pos": "top"}
      ]
    },
    {
      "id": "liquid",
      "start": "In liquid water",
      "env": {"type": "studio", "color": "blue", "floor": false},
      "camera": {"move": "pan", "angle": "front", "amount": 0.6},
      "props": [
        {"id": "water", "type": "particles", "shape": "sphere", "count": 90, "color": "#7fd8ff", "color2": "white", "mix": 0.3, "dot": 0.11, "at": "center", "size": 1.8, "speed": 0.8}
      ],
      "actions": [
        {"at": "tumble around", "do": "set", "prop": "water", "param": "speed", "to": 2.2, "over": 0.6},
        {"at": "pack closely", "do": "set", "prop": "water", "param": "spread", "to": 0.6, "over": 1.0},
        {"at": "pack closely", "do": "label", "prop": "water", "text": "PACKED TIGHT", "side": "top"}
      ]
    },
    {
      "id": "hexagon",
      "start": "But when water freezes",
      "env": {"type": "micro", "tint": "cool"},
      "camera": {"move": "rise", "angle": "top", "framing": "medium", "amount": 0.4},
      "props": [
        {"id": "lattice", "type": "particles", "shape": "ring", "count": 22, "color": "white", "color2": "#7fd8ff", "mix": 0.5, "dot": 0.15, "at": "center", "size": 2.2, "speed": 0, "seed": 3}
      ],
      "actions": [
        {"at": "water freezes", "do": "text", "text": "FREEZING", "style": "title", "pos": "top", "until": "hexagon pattern"},
        {"at": "lock into", "do": "appear", "prop": "lattice", "style": "grow", "over": 0.7},
        {"at": "hexagon pattern", "do": "label", "prop": "lattice", "text": "OPEN RINGS", "side": "top"},
        {"at": "empty space", "do": "icon", "place": "center", "name": "question"}
      ]
    },
    {
      "id": "density",
      "start": "That open pattern",
      "env": {"type": "studio", "color": "indigo", "floor": true},
      "camera": {"move": "push_in", "angle": "three-quarter", "amount": 0.5},
      "props": [
        {"id": "chart", "type": "bars", "values": [100, 91], "colors": ["blue", "#dff6ff"], "at": "center", "size": 1.4, "grow": 0}
      ],
      "actions": [
        {"at": "open pattern", "do": "set", "prop": "chart", "param": "grow", "to": 1, "over": 1.2},
        {"at": "nine percent", "do": "count", "from": 0, "to": 9, "unit": "% LIGHTER", "pos": "top", "over": 1.0},
        {"at": "less dense", "do": "set", "prop": "chart", "param": "highlight", "to": 1, "over": 0.3}
      ]
    },
    {
      "id": "iceberg",
      "start": "So it floats",
      "env": {"type": "sky", "time": "day", "ground": "ocean", "clouds": 0.4},
      "camera": {"move": "pan", "angle": "front", "amount": 0.5},
      "props": [
        {"id": "berg", "type": "iceberg", "at": "center", "size": 1.5}
      ],
      "actions": [
        {"at": "most of an iceberg", "do": "label", "prop": "berg", "text": "MOSTLY BELOW", "side": "right"},
        {"at": "below the surface", "do": "pulse", "prop": "berg", "strength": 0.12}
      ]
    },
    {
      "id": "lake",
      "start": "That matters",
      "transition": "dip",
      "env": {"type": "underwater", "depth": "deep", "seabed": true},
      "camera": {"move": "drift", "angle": "low", "amount": 0.6},
      "props": [
        {"id": "fish", "type": "fish", "count": 7, "color": "orange", "at": [0, 0.35, 0], "size": 1.1},
        {"id": "lid", "type": "box", "color": "#e6f7ff", "finish": "glossy", "width": 1, "height": 0.08, "depth": 0.7, "round": 0.1, "at": [0, 1.25, 0], "size": 2.0}
      ],
      "actions": [
        {"at": "top down", "do": "appear", "prop": "lid", "style": "drop", "over": 0.6},
        {"at": "like a lid", "do": "label", "prop": "lid", "text": "ICE LID", "side": "top"},
        {"at": "keeping fish alive", "do": "icon", "prop": "fish", "name": "heart"}
      ]
    },
    {
      "id": "outro",
      "start": "Follow for more",
      "env": {"type": "studio", "color": "purple"},
      "camera": {"move": "push_in", "angle": "three-quarter", "amount": 0.4},
      "props": [
        {"id": "mascot", "type": "chameleon", "at": "center", "size": 1.1}
      ],
      "actions": [
        {"at": "Follow", "do": "color", "prop": "mascot", "to": "yellow", "over": 0.8},
        {"at": "everyday science", "do": "text", "text": "FOLLOW FOR MORE", "style": "title", "pos": "top"}
      ]
    }
  ]
}

=== USER ===

TITLE: What If the Moon Suddenly Disappeared?

THE SCRIPT AS SPOKEN, sentence by sentence (S1, S2, ...), with the sentence's start and end in seconds, then each word with its start time. Anchors must be copied from these words.
S1 [0.09-1.36] What if the Moon vanished tonight?
   What 0.09 | if 0.18 | the 0.27 | Moon 0.35 | vanished 0.62 | tonight? 0.98
S2 [1.74-3.35] The first thing you would notice is the sky.
   The 1.74 | first 1.80 | thing 2.06 | you 2.21 | would 2.30 | notice 2.43 | is 2.77 | the 2.87 | sky. 2.95
S3 [3.73-7.70] Without moonlight, nights would be much darker, and the stars would shine brighter.
   Without 3.73 | moonlight, 4.04 | nights 4.87 | would 5.13 | be 5.27 | much 5.38 | darker, 5.67 | and 6.37 | the 6.43 | stars 6.50 | would 6.88 | shine 6.99 | brighter. 7.28
S4 [8.08-9.21] Then the oceans would change.
   Then 8.08 | the 8.17 | oceans 8.28 | would 8.63 | change. 8.75
S5 [9.59-11.89] The Moon pulls on our seas and makes the tides.
   The 9.59 | Moon 9.64 | pulls 9.87 | on 10.17 | our 10.29 | seas 10.41 | and 10.99 | makes 11.12 | the 11.34 | tides. 11.42
S6 [12.27-17.62] Without it, only the Sun's weaker pull would remain, and tides would shrink to less than half their size.
   Without 12.27 | it, 12.58 | only 13.09 | the 13.27 | Sun's 13.37 | weaker 13.67 | pull 14.01 | would 14.25 | remain, 14.39 | and 15.14 | tides 15.21 | would 15.55 | shrink 15.67 | to 16.15 | less 16.26 | than 16.60 | half 16.72 | their 16.99 | size. 17.13
S7 [17.99-19.97] Coasts and the creatures living there would struggle.
   Coasts 17.99 | and 18.43 | the 18.54 | creatures 18.62 | living 19.06 | there 19.34 | would 19.44 | struggle. 19.55
S8 [20.35-21.79] The biggest effect would come slowly.
   The 20.35 | biggest 20.43 | effect 20.74 | would 21.06 | come 21.18 | slowly. 21.34
S9 [22.16-26.24] The Moon helps keep Earth's tilt steady, and that tilt gives us regular seasons.
   The 22.16 | Moon 22.23 | helps 22.48 | keep 22.73 | Earth's 23.09 | tilt 23.50 | steady, 23.76 | and 24.48 | that 24.58 | tilt 24.74 | gives 24.95 | us 25.21 | regular 25.36 | seasons. 25.73
S10 [26.62-31.61] Without it, the tilt could probably wobble over millions of years, and the climate could swing wildly.
   Without 26.62 | it, 26.92 | the 27.29 | tilt 27.38 | could 27.62 | probably 27.79 | wobble 28.21 | over 28.65 | millions 28.88 | of 29.40 | years, 29.46 | and 30.12 | the 30.21 | climate 30.29 | could 30.70 | swing 30.85 | wildly. 31.17
S11 [31.98-34.29] Earth would survive, but life would have to adapt.
   Earth 31.98 | would 32.14 | survive, 32.28 | but 33.05 | life 33.19 | would 33.44 | have 33.54 | to 33.72 | adapt. 33.83
S12 [34.66-37.27] We rely on our giant companion more than we think.
   We 34.66 | rely 34.78 | on 35.17 | our 35.27 | giant 35.39 | companion 35.76 | more 36.43 | than 36.64 | we 36.76 | think. 36.86
S13 [37.67-38.60] Follow for more what ifs.
   Follow 37.67 | for 37.86 | more 37.98 | what 38.16 | ifs. 38.30

The last word ends at 38.60 s; the video is 39.00 s long. Make about 8 shots (7 to 10), each 3 to 8 seconds.

Think through the beats first (section 2), then reply with the complete show.json and nothing else: no code fence, no comments, no text before or after it.
