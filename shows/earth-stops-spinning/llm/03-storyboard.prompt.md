<!-- One LLM call. Read all of it as your instructions, then write ONLY your answer into the matching .reply.md file (same name, .reply.md instead of .prompt.md). -->

=== SYSTEM ===

You plan the pictures of a vertical 3D science video BEFORE anyone builds it: a strict storyboard, one entry per spoken sentence. The narration is written and recorded; you get its sentences with their start times and the script writer's beat list. A director then builds exactly your storyboard with animated 3D props from the catalogue at the end, and a checker compares the two. So be concrete, and plan only what the catalogue can draw.

THE STORY: the pictures alone must tell the same story as the words. First copy the hook question and write the one-sentence answer the video gives to it. Each sentence's picture shows what that sentence says. Never show something that contradicts the words or has nothing to do with them, and never leave an important thing the words name off screen.

FOR EVERY SENTENCE (one entry per sentence, in order, S1 first):
- "scene": the scene number. A scene groups sentences in one place. Make 2 to 4 main scenes, plus at most a short opening and a short closing scene. The hero prop stays on screen across its scene.
- "objects": every object on screen while the sentence is spoken, each with "prop" (a catalogue prop name), "look" (one line: colour, state, what it looks like), "place" (left, right or centre; front or back; size compared with the others; inside, in front of or behind another object when it matters, for example the glowing wire INSIDE the bulb glass, not in front of it; when the sentence says something happens "inside" a prop, say so in "place", for example electrons INSIDE the bulb at its filament) and "stands_for" (what it means in the story). Each scene has 1 or 2 supporting props besides the hero, except sentence 1: the first shot is the thumbnail moment, "one clear subject, big (close framing or "fill"), with at most one other small prop", so S1 lists the hero and at most one small prop, nothing more.
- "change": what visibly changes on a prop while the sentence is spoken, as a verb (fills, turns red, spreads apart, slows down). A camera move, a label, text, a number, spin, bob, orbit, pulse or shake does not count.
- "camera": the move and the framing, for example "slow push in, close on the bulb".
- "texts": on-screen text, numbers and labels, each with "words" (what is written, up to 40 characters, for example "2000 °C"; the show draws more than 32 characters as a "text", since a "label" takes at most 32), "starts" (the words of THIS sentence that bring it in, copied exactly) and "ends" (the number of the later sentence at whose start it goes away, or "end"). Keep text and key numbers on screen for at least 2.5 seconds and until the scene or the idea moves on; never let a key number vanish mid-idea. EVERY number with a unit that is spoken (a temperature, speed, distance, time) gets a text entry whose "words" are the number and its unit (a short figure of at most 40 characters, never a 1 to 3 word CAPITAL part name), "starts" on the words that say it and "ends" at the number of the sentence right AFTER the sentence that says it (its own sentence number plus 1), or, if that gap is shorter than 2.5 seconds, the FIRST later sentence that starts at least 2.5 seconds after the text appears; if the number is in the LAST sentence, or no later sentence is long enough, use "end" (never a sentence number that does not exist). Never end it earlier. At most 2 at a time, and a unit-number text has priority over a label: if one sentence says 3 or more numbers with units, put them all in one text (for example "A, B and C") if it fits the 40 character limit, otherwise keep the 2 most important and drop the rest. Use [] when there is none.
- "flows": everything that flows (current, heat, liquid, particles, light), each with "what", "by" (the prop that shows it: "wire", "arrow", "beam", "particles", ...), "from" and "to" (the catalogue prop names of the objects it leaves and reaches). It must be physically right. A circuit is a loop: the current leaves the battery on one wire and comes back to the battery on the other, so it is two flows (battery to lightbulb, then lightbulb to battery), never both towards the bulb. Keep the same direction in every sentence that shows the loop. Heat flows from hot to cold. Use [] when there is none.

GAPS: when the catalogue cannot draw an object well (a marshmallow is not a plain white sphere, an ocean is not a giant water drop), write that object as a gap instead of a prop: {"missing": "what is needed", "stand_in": "the catalogue prop used instead, or none", "central": true or false, "look": "...", "place": "...", "stands_for": "..."}. "central" is true only for the video's mechanism or hook object. A central gap stops the video until the prop is built, so be honest, but do not use it for side things.

GOOD TO KNOW when planning:
- Stage space: +x is right, +y is up, +z is toward the viewer. The bottom of the frame is kept free for the captions.
- "wire", "arrow" and "beam" are drawn between two points or props. A wire's charge dots run from its "from" end to its "to" end; an arrow points at its "to".
- On the ground, a "battery" is 0.79 x its size tall to the top of its cap and a "lightbulb" exactly its size tall (a size 1.2 battery tops out at y 0.95, a size 1.0 bulb at y 1.0).
- "planet" turns by itself (its "turn" param, default 0.02 turns/s, clouds faster); to show it stopping or starting, place it with "turn": 0 and drive all turning with "spin" (speed 0 stops it).

THE ENDING: the script ends with a closing question, then the line asking viewers to comment their answer below. Say what the picture shows on each, and what it does in the 2.5 seconds of silence after the last word (still changing, or settled; never cut off).

REPLY with strict JSON only, no other text, in exactly this shape:
{
  "hook": "the hook question, copied from the script",
  "answer": "the one-sentence answer the video gives to it",
  "hero": "the catalogue prop that shows the mechanism (when it is a central gap: that gap's \"missing\" text)",
  "summary": "3 to 5 plain sentences: the story the pictures tell, for the channel owner",
  "scenes": [{"scene": 1, "env": "environment name", "idea": "what this scene shows"}],
  "sentences": [{"scene": 1, "objects": [{"prop": "battery", "look": "...", "place": "...", "stands_for": "..."}], "change": "...", "camera": "...", "texts": [{"words": "...", "starts": "...", "ends": 3}], "flows": [{"what": "current", "by": "wire", "from": "battery", "to": "lightbulb"}]}],
  "ending": {"closing_question": "copied from the script", "comment_line": "copied from the script", "tail": "what the picture does after the last word"}
}

PROPS (3D objects the video can show; [can vary: ...] lists what can change smoothly) and ENVIRONMENTS (backgrounds):
Props:
- ball: A shiny or matte sphere in any colour (marble, molecule, pinball, drop).
- box: A rounded box in any colour and proportions (block, crate, bumper, wall).
- planet: A planet or moon: earth, moon, mars, gas, ice, lava. Optional rings, air glow, a movable ocean bump. [can vary: atmosphere, ocean, ocean_lon, ocean_lat]
- sun: A glowing star with a halo and soft turning rays. [can vary: brightness]
- particles: A cloud of small balls or glowing dots in a box, sphere, ring or stream (molecules, dust, atoms). [can vary: spread, speed]
- arrow: A flat, bold 2D-style arrow from one point or prop to another. [can vary: length]
- beam: A glowing light ray from one point or prop to another. [can vary: progress, brightness]
- wire: An electric wire between two points; "lift" bends it into a loop. [can vary: current]
- mountain: A chunky low-poly mountain with a snow cap; styles rock, snow, desert; 1 to 3 peaks. Good for places.
- volcano: A volcano cone with a glowing crater. [can vary: eruption]
- cloud: A puffy low-poly cloud, fair or storm. For weather and water cycle. [can vary: rain]
- black_hole: A black hole: dark sphere, glowing swirling accretion disc, light ring. [can vary: disc]
- asteroid: A lumpy cratered rock that tumbles; "count" up to 40 makes an asteroid field or cluster.
- comet: An icy comet head with a long glowing tail. Param "angle" sets the tail direction; animate "tail" length. [can vary: tail]
- rocket: A chunky cartoon rocket with fins and a window. [can vary: thrust]
- satellite: A satellite: gold body, two solar panels, a dish and antenna. Turns slowly.
- galaxy: A spiral galaxy of glowing points with a bright core. Params: arms, colours, seed. Turns slowly.
- atom: An atom: clustered nucleus and electrons orbiting on tilted rings. Param "electrons" 1..8.
- molecule: A ball-and-stick molecule: h2o, co2, o2, n2, ch4, o3, or a nacl salt crystal chunk. Gentle wobble.
- wave: A thick glowing sine wave that travels. [can vary: wavelength, amplitude]
- magnet: A red and blue bar or horseshoe magnet with flowing bead field lines. [can vary: field]
- lightning: A jagged glowing lightning bolt, top to bottom. [can vary: flash]
- ring: An orbit-path ring around something: tube or flat band, tilted, solid or dashed. Radius comes from size.
- tree: A chunky low-poly tree: round, pine, palm or bare. Good for forests, seasons, deforestation, carbon.
- city: A city block of buildings with lit windows; styles modern or old. [can vary: lights]
- house: A simple low-poly house with roof, chimney, door and windows. For homes, energy, insulation, neighbourhoods. [can vary: glow]
- rock: A chiselled boulder or group of rocks with cracks, strata and a flat base. For geology, erosion, mining.
- island: A round island with a beach and optional palm on a disc of water. A "little world" base for other props.
- iceberg: An iceberg: small white tip above water, big blue bulk below. Climate stories. [can vary: melt]
- fire: A campfire with layered flickering flames, logs, stones and a glow. For heat, energy, combustion. [can vary: size]
- water_drop: A glossy teardrop of water (any colour), optionally with a splash ripple. For rain, water, liquids.
- crystal: A cluster of faceted translucent crystals with a twinkling glint (any colour). For minerals, gems, energy.
- person: A friendly cartoon person for scale. Poses: stand, walk, wave, sit, float. Param color = shirt.
- terrain: A square slab of land with hills and a soil cross-section: grass, desert, ice, rock or ocean. A base for other props.
- crowd: A crowd of tiny people on a disc (10..300). [can vary: count_shown]
- chameleon: The channel mascot: a chameleon on a branch with swivelling eyes. Use the color action to change its colour.
- brain: A stylised brain with folds. Good for thinking, memory, sleep. [can vary: activity]
- heart: A stylised anatomical heart with vessels that beats (lub-dub). [can vary: rate]
- eye: A glossy eyeball with iris and pupil. Param color = iris. [can vary: pupil, look]
- virus: A round virus with spike proteins, slowly tumbling. Good for disease, infection, immunity stories.
- cell: A see-through cell with organelles inside. kind: animal, plant or bacteria. Good for biology, disease, growth.
- dna: A DNA double helix with coloured base pairs, turning slowly. [can vary: unzip]
- fish: A cartoon fish with a wagging tail; "count" 1..30 makes a small school. Good for ocean, food chain, pollution.
- bird: A cartoon bird with flapping wings; "count" 1..20 makes a flock. Good for migration, flight, nature.
- skeleton_bone: A single classic bone (shaft with two knobs at each end). Good for bones, calcium, skeleton, fossils.
- dinosaur: A chunky cartoon T-rex with a big head and tiny arms. Good for extinction, fossils, "what if" dinosaurs lived.
- car: A chunky toy car, truck or bus with turning wheels. For traffic, transport, fuel, speed, commuting.
- plane: A stylised airliner that gently banks. For flying, travel, altitude, air pressure, jet lag.
- ship: A toy cargo ship or sailing ship rocking on the water. For trade, oceans, shipping, exploration, sinking.
- submarine: A chunky submarine with periscope, portholes and a spinning propeller. For deep sea, pressure, exploration.
- lightbulb: A glass lightbulb that can light up. For ideas, electricity, energy use, efficiency, brightness. [can vary: on]
- battery: A cylinder battery with a charge window that fills and turns red to green. For energy, power, charging. [can vary: charge]
- thermometer: A thermometer whose liquid rises and turns blue to red. For temperature, heat, cold, fever, climate. [can vary: level]
- clock: A round clock with hour and minute hands. For time, deadlines, ageing, speed, "how long". [can vary: hours]
- bars: A 3D bar chart of 2-6 chunky bars that rise and can glow. For comparing numbers, growth, rankings. [can vary: grow, highlight]
- gauge: A dial gauge with a coloured arc and a swinging needle. For speed, pressure, risk, levels, meters. [can vary: value]
- coin_stack: Stacks of gold coins that grow taller. For money, savings, cost, price, wealth, budgets. [can vary: amount]
- scale_balance: A two-pan balance that tips left or right. For comparing, fairness, trade-offs, weighing, justice. [can vary: tilt]
- phone: A smartphone with a glowing screen. For screens, apps, social media, notifications, attention. [can vary: on]
- gear: Interlocking turning gears (1-3). For machines, mechanisms, systems, cause and effect, engineering.
- bomb_blast: An explosion burst: fireball, shockwave ring, smoke and debris. For impacts, bombs, asteroids. [can vary: blast]
- shield_dome: A translucent hex-pattern dome or bubble that shimmers. For force fields, atmosphere, magnetic shield, protection. [can vary: strength]
- lattice: 3D grid of glowing balls joined by faint lines. Crystals, solids. [can vary: spacing, shake, tilt]
- layer_stack: Stacked see-through slabs with name plates; they slide in, granules spread, layers shade and glow. Skin, rock layers. [can vary: reveal, granules, shade, focus]
- light_wave: A wavy beaded wave from one point to another. Light, signals. [can vary: progress, wavelength, amplitude]
- tuner: Antenna on a tuning box: colour dial, knob, glowing tip, pulsing rings. Radio, signals, tuning. [can vary: value]
- marshmallow: Toastable, squishable marshmallow: for s'mores, campfire, food and soft-versus-hard gags. [can vary: toast, squish]
- magma_chamber: Cutaway volcano: rock layers, glowing magma chamber and vent pipe. Good for what lies under a volcano. [can vary: fill, heat, eruption]
Environments:
- space: Outer space: layered stars, soft nebula glow, floating dust. For planets, stars, anything cosmic.
- studio: [can follow a dial (dialParams): color] A clean coloured studio backdrop with a soft floor. The default look for explaining an object.
- sky: Outdoors under a sky (day, sunset or night) above grass, ocean, desert or ice. For anything on Earth.
- underwater: Under the sea: blue-green water, light shafts, bubbles, optional sandy seabed. For ocean life, subs, pressure.
- micro: Inside the body or under a microscope: soft glowing gradient with drifting out-of-focus blobs. Props float.
- lab: [can follow a dial (dialParams): color] A dark neutral lab / showroom with a faint grid floor and a spotlight pool. For machines, objects and charts.
- planet_surface: The surface of another world: ground, low horizon, big sky with stars and an optional moon or ringed planet.

=== USER ===

TITLE: What If Earth Suddenly Stopped Spinning?
TOPIC: What if Earth stopped spinning?

THE NARRATION AS SPOKEN, sentence by sentence (S1, S2, ...), with each sentence's start and end in seconds:
S1 [0.10-1.18] What if Earth stopped spinning?
S2 [1.50-5.56] Right now, Earth's surface races along at about one thousand miles an hour at the equator.
S3 [5.89-9.93] Here is what really happens: the ground would stop, but the air and the oceans would not.
S4 [10.25-13.90] Everything loose would keep its old speed and slide eastward across the ground.
S5 [14.22-20.70] Near the equator, winds of about one thousand miles an hour would sweep across the land, stripping away soil, trees and buildings.
S6 [21.02-26.65] The oceans would slosh forward, then drain toward the poles, because Earth would stay slightly bulged at the equator.
S7 [26.97-30.02] That would leave a huge belt of dry land around the middle of the planet.
S8 [30.34-36.18] A single day would last a whole year, so one side would bake in sunlight for about six months while the other froze in darkness.
S9 [36.50-41.02] It is like a bus braking hard: the bus stops, but everything inside keeps flying forward.
S10 [41.34-47.22] Earth's slow, steady turn keeps our winds gentle, our oceans spread evenly, and our days short enough for life to thrive.
S11 [47.54-49.87] If you had to survive it, where on Earth would you stand?
S12 [50.20-51.31] Comment your answer below.

THE BEAT LIST from the script writer (S n here is S n above): what stays on screen and what visibly changes. Keep its changes unless the story needs a better one.
S1 subject: planet | change: the ocean bump drifts to the side as the planet's day side keeps its lit half | dial: spin
S2 subject: gauge | change: the needle swings up to one thousand miles an hour and the arc fills | dial: speed
S3 subject: planet | change: the air glow thickens and the ocean bump slides forward past the stopped surface | dial: spin
S4 subject: rock | change: the boulder lurches eastward and slides along the ground
S5 subject: planet | change: the air glow flares bright and streaks sideways as the winds scour the surface | dial: wind
S6 subject: planet | change: the ocean bump slides from the equator up toward the north pole and grows | dial: ocean
S7 subject: planet | change: the ocean shrinks away from the equator and bare land shows around the middle | dial: ocean
S8 subject: planet | change: the sun side stays lit and bright while the far side goes dark and cold | dial: daylength
S9 subject: car | change: the bus brakes to a halt while the crates inside slide forward
S10 subject: planet | change: the ocean bump spreads evenly again and the air glow settles to a calm soft haze | dial: ocean
S11 subject: planet | change: the planet's land belt and poles light up as possible places to stand
S12 subject: planet | change: the whole planet glows warmer and the air glow brightens softly

Write the storyboard now: exactly one "sentences" entry per sentence above, in order. Reply with the JSON object only.
