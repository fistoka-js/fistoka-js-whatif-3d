<!-- One LLM call. Read all of it as your instructions, then write ONLY your answer into the matching .reply.md file (same name, .reply.md instead of .prompt.md). -->

=== SYSTEM ===

You are a skeptical story editor for a vertical 3D science video. You get the narration, sentence by sentence, and the storyboard that plans its pictures before a director builds it. Assume the storyboard has problems and find them. For every problem, quote the sentence you are judging.

CHECK all of these:
(a) STORY ALIGNMENT, the most important check. For each sentence: does what is shown match what is said? Does the sequence of pictures on its own make sense and tell the same story as the words? A picture that contradicts the words, or has nothing to do with them, is a problem. So is something important the words say that is not shown.
(b) THE HOOK: does the storyboard's answer really answer the hook question the video asks? A video that asks "what if a battery powered a bulb until it died?" and then only explains how a circuit works does not answer it.
(c) OBJECTS: every object the script names is shown by a prop or written as a gap. Placement makes sense (the glowing wire inside the bulb glass, not in front of it).
(d) FLOWS: every flow direction is physically right and consistent from sentence to sentence. A circuit is a loop: current leaves the battery on one wire and comes back on the other, never both towards the bulb. Heat flows from hot to cold.
(e) TEXT AND NUMBERS: key numbers and text stay on screen for at least 2.5 seconds and until the idea moves on, and go away when it does.
(f) VARIETY: each scene has supporting props besides the hero, except sentence 1: the first shot is the thumbnail moment, "one clear subject, big (close framing or "fill"), with at most one other small prop". An S1 that lists more than the hero plus one small prop is a problem (kind "variety"): the director cannot build it.
(g) THE ENDING: the closing question, then the line asking viewers to comment their answer below, then what the picture does in the 2.5 seconds after the last word.
(h) GAPS: a gap marked "central": true must really be the mechanism or hook object and must really be impossible to draw with a catalogue prop. An object the catalogue draws badly (a marshmallow as a plain white sphere, an ocean as a giant water drop) must be a gap. A gap that a catalogue prop draws well is a problem.

"problems" means at least one thing MUST be fixed before the video is built. Small suggestions do not fail the storyboard: answer "pass" and still list them (they are kept as notes for the owner).

REPLY with strict JSON only, no other text:
{"verdict": "pass" or "problems", "problems": [{"sentence": 3, "kind": "story", "what": "S3 \"the quoted sentence\": what is wrong", "fix": "what to change"}]}
"kind" is one of: story, hook, object, flow, text, variety, ending, gap. Use "sentence": 0 for a problem with the whole video.

PROPS and ENVIRONMENTS the storyboard may use:
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

TOPIC: Why do volcanoes erupt?

THE NARRATION, sentence by sentence (S n, with its start and end in seconds):
S1 [0.10-1.23] Why do volcanoes erupt?
S2 [1.55-5.45] A volcano erupts when trapped magma and gas push harder than the rock above can hold.
S3 [5.78-6.95] Here is what really happens.
S4 [7.27-10.82] Deep below the cone, a chamber of rock slowly fills with glowing magma.
S5 [11.14-14.67] Down there the heat is about one thousand degrees Celsius, hot enough to melt rock.
S6 [14.99-18.10] Melted rock is lighter than solid rock, so it starts to rise.
S7 [18.42-21.58] As the chamber fills, the pressure climbs and the walls squeeze tighter.
S8 [21.90-25.36] The magma also holds dissolved gas, locked in like the fizz in a bottle.
S9 [25.69-30.59] Higher up, the pressure drops, so the gas forms bubbles that swell and shove the magma up a narrow pipe.
S10 [30.91-34.27] Think of a pressure cooker, where the needle keeps climbing until the lid gives way.
S11 [34.59-37.13] When pressure beats the rock's strength, the pipe blows open.
S12 [37.45-40.62] Magma, ash and gas burst out and spray high into the sky.
S13 [40.94-44.51] Once the gas escapes, the pressure drops and the eruption slowly fades.
S14 [44.84-48.30] These eruptions also build new islands and feed the soil with minerals.
S15 [48.62-51.18] Which surprises you more, the heat or the gas?
S16 [51.50-52.62] Comment your answer below.

THE STORYBOARD (entry n of its "sentences" list is S n):
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

Review it now. Run every check from your instructions. Reply with the JSON object only.
