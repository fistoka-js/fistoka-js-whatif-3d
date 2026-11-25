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

TOPIC: How does a battery light a bulb?

THE NARRATION, sentence by sentence (S n, with its start and end in seconds):
S1 [0.10-1.38] How does a battery light a bulb?
S2 [1.70-2.87] Here is what really happens.
S3 [3.20-6.01] The battery pushes electrons around a closed loop of wire.
S4 [6.33-10.55] Inside the battery, a chemical reaction piles extra electrons onto the negative end.
S5 [10.88-14.37] Those crowded electrons shove away from each other and flow out along one wire.
S6 [14.69-18.10] They travel through the bulb, then back along the other wire to the positive end.
S7 [18.42-21.91] The wire was already full of electrons, so the whole line moves at once.
S8 [22.24-26.10] Each electron drifts slowly, only a fraction of a millimetre every second.
S9 [26.42-27.39] Now zoom into the bulb.
S10 [27.72-30.13] Its thin tungsten filament is a very narrow path.
S11 [30.45-32.94] Electrons squeeze through it and crash into the metal atoms.
S12 [33.26-35.38] Every crash makes the atoms jiggle faster.
S13 [35.71-38.48] The filament heats up to about two thousand degrees Celsius.
S14 [38.80-41.63] At that heat, the glowing metal gives off bright white light.
S15 [41.96-45.09] Think of a crowd squeezing through a narrow gate, jostling as they go.
S16 [45.42-48.44] Cut the loop anywhere and the flow stops, so the light goes out.
S17 [48.77-49.96] That is why a switch works.
S18 [50.28-52.55] If you broke the wire, where would the electrons stop?
S19 [52.87-53.99] Comment your answer below.

THE STORYBOARD (entry n of its "sentences" list is S n):
{
  "hook": "How does a battery light a bulb?",
  "answer": "The battery pushes electrons around a closed loop of wire, out along one wire, through the thin filament in the bulb where they crash into atoms and heat it white-hot, and back along the other wire.",
  "hero": "wire",
  "summary": "We open on a big battery and a small bulb, then pull back to a full loop: a battery on the left, a bulb on the right, one wire carrying glowing dots from the battery to the bulb and a second wire carrying them back. Next we move into the bulb: electrons INSIDE the glass squeeze into the filament, bump the metal atoms, and a thermometer shows the heat reaching two thousand degrees as the filament turns bright white. A crowd squeezing through a gap is the analogy. Last we return to the loop, cut it so the dots stop and the bulb goes dark, close it so it relights, and end on the broken wire with the dots piled up at the gap.",
  "scenes": [{"scene": "1", "env": "studio", "idea": "Opening: the battery, with a bulb waiting beside it."}, {"scene": "2", "env": "lab", "idea": "The full loop: dots leave the battery on one wire, cross the bulb, and return on the other wire."}, {"scene": "3", "env": "lab", "idea": "Inside the bulb: electrons INSIDE the glass squeeze through the filament, heat it and make it glow white."}, {"scene": "4", "env": "studio", "idea": "Analogy: a crowd squeezing through a narrow gate."}, {"scene": "5", "env": "lab", "idea": "Back to the loop: break it, close it, and end on the gap."}],
  "ending": {"closing_question": "If you broke the wire, where would the electrons stop?", "comment_line": "Comment your answer below.", "tail": "The gap keeps glowing softly while the dots slowly pile up at its edges, still changing, until the end."},
  "sentences": [
    {"scene": "1", "objects": [{"prop": "battery", "look": "big shiny cylinder battery, charge window red", "place": "centre, large, close framing", "stands_for": "the power source"}, {"prop": "lightbulb", "look": "small dark glass bulb", "place": "right, small, behind the battery", "stands_for": "the bulb to be lit"}], "change": "the charge window fills and turns from red to green", "camera": "close on the battery, slow push in", "texts": [], "flows": []},
    {"scene": "1", "objects": [{"prop": "battery", "look": "big shiny battery, charge window green", "place": "centre, large", "stands_for": "the power source"}, {"prop": "lightbulb", "look": "small dark glass bulb", "place": "right, small, behind the battery", "stands_for": "the bulb to be lit"}], "change": "the charge window glows brighter green as the battery fills completely", "camera": "slow push in, close on the battery", "texts": [], "flows": []},
    {"scene": "2", "objects": [{"prop": "wire", "look": "two glowing copper wires forming a closed loop: an upper wire arching from battery to bulb, a lower wire running back along the floor", "place": "centre, spanning left to right between the battery and the bulb", "stands_for": "the closed loop of wire"}, {"prop": "battery", "look": "green charged battery", "place": "left, medium", "stands_for": "the power source"}, {"prop": "lightbulb", "look": "dark glass bulb", "place": "right, medium", "stands_for": "the bulb"}], "change": "glowing dots start to flow around the closed loop of wire", "camera": "pull back to a wide shot of the whole loop", "texts": [], "flows": [{"what": "electrons", "by": "wire", "from": "battery", "to": "lightbulb"}, {"what": "electrons", "by": "wire", "from": "lightbulb", "to": "battery"}]},
    {"scene": "2", "objects": [{"prop": "wire", "look": "the two glowing wires of the loop", "place": "centre, between the battery and the bulb", "stands_for": "the loop of wire"}, {"prop": "battery", "look": "green battery", "place": "left, medium, with a cloud of blue electron dots INSIDE it at its negative end", "stands_for": "where extra electrons are made"}, {"prop": "particles", "look": "small glowing blue dots", "place": "INSIDE the battery, packed at its negative end", "stands_for": "extra electrons"}], "change": "the blue dots crowd together and pile up at the negative end of the battery", "camera": "slow push in, close on the battery", "texts": [], "flows": []},
    {"scene": "2", "objects": [{"prop": "wire", "look": "the upper wire full of blue dots", "place": "centre, running from the battery to the bulb", "stands_for": "the wire leaving the negative end"}, {"prop": "battery", "look": "green battery", "place": "left, medium", "stands_for": "the source of the push"}, {"prop": "lightbulb", "look": "dark glass bulb", "place": "right, medium", "stands_for": "the bulb"}], "change": "the crowded dots spread apart and stream out along the upper wire from the battery towards the bulb", "camera": "wide shot, slow pan right along the upper wire", "texts": [], "flows": [{"what": "electrons", "by": "wire", "from": "battery", "to": "lightbulb"}]},
    {"scene": "2", "objects": [{"prop": "wire", "look": "both wires full of blue dots", "place": "centre, the upper wire and the lower wire", "stands_for": "the full loop"}, {"prop": "lightbulb", "look": "glass bulb starting to glow faintly", "place": "right, medium", "stands_for": "the bulb the dots pass through"}, {"prop": "battery", "look": "green battery", "place": "left, medium", "stands_for": "where the dots return"}], "change": "the dots pass through the bulb and stream back along the lower wire to the battery", "camera": "wide shot, slow pan back left along the lower wire", "texts": [], "flows": [{"what": "electrons", "by": "wire", "from": "battery", "to": "lightbulb"}, {"what": "electrons", "by": "wire", "from": "lightbulb", "to": "battery"}]},
    {"scene": "2", "objects": [{"prop": "wire", "look": "both wires, dots filling every inch of the loop", "place": "centre", "stands_for": "the whole loop already full of electrons"}, {"prop": "lightbulb", "look": "glowing glass bulb", "place": "right, medium", "stands_for": "the bulb"}, {"prop": "battery", "look": "green battery", "place": "left, medium", "stands_for": "the pusher"}], "change": "every dot along the whole loop starts moving together at the same moment", "camera": "wide static shot of the whole loop", "texts": [], "flows": [{"what": "electrons", "by": "wire", "from": "battery", "to": "lightbulb"}, {"what": "electrons", "by": "wire", "from": "lightbulb", "to": "battery"}]},
    {"scene": "2", "objects": [{"prop": "wire", "look": "both wires, dots moving slowly", "place": "centre", "stands_for": "the slow drift of electrons"}, {"prop": "lightbulb", "look": "glowing glass bulb", "place": "right, medium", "stands_for": "the bulb that stays lit"}, {"prop": "battery", "look": "green battery", "place": "left, medium", "stands_for": "the pusher"}], "change": "the dots slow down to a gentle crawl while the bulb stays lit", "camera": "slow push in on the wire", "texts": [], "flows": [{"what": "electrons", "by": "wire", "from": "battery", "to": "lightbulb"}, {"what": "electrons", "by": "wire", "from": "lightbulb", "to": "battery"}]},
    {"scene": "3", "objects": [{"prop": "lightbulb", "look": "big clear glass bulb with a thin tungsten filament inside, glowing warm", "place": "centre, large, filling the frame", "stands_for": "the bulb we zoom into"}, {"prop": "particles", "look": "small blue electron dots drifting near the filament", "place": "INSIDE the bulb glass, at the filament", "stands_for": "electrons"}], "change": "the bulb fills the frame and its glass starts to glow warm", "camera": "fast push in, zoom into the bulb", "texts": [], "flows": []},
    {"scene": "3", "objects": [{"prop": "lightbulb", "look": "big clear glass bulb, thin tungsten filament glowing orange", "place": "centre, large", "stands_for": "the bulb"}, {"prop": "particles", "look": "small blue electron dots lined up in a queue", "place": "INSIDE the bulb glass, at the filament, entering its narrow path", "stands_for": "electrons"}], "change": "the filament lights up orange and the electrons line up to enter it inside the glass", "camera": "slow push in, close on the filament", "texts": [], "flows": []},
    {"scene": "3", "objects": [{"prop": "lightbulb", "look": "big glass bulb, filament orange", "place": "centre, large", "stands_for": "the bulb"}, {"prop": "particles", "look": "blue electron dots", "place": "INSIDE the bulb glass, squeezing into the filament", "stands_for": "electrons"}, {"prop": "particles", "look": "bigger orange metal atoms packed along the filament", "place": "INSIDE the bulb glass, in the filament", "stands_for": "the metal atoms"}], "change": "the electrons squeeze into the filament and bump into the atoms there", "camera": "close on the filament", "texts": [], "flows": []},
    {"scene": "3", "objects": [{"prop": "lightbulb", "look": "big glass bulb, filament glowing red", "place": "centre, large", "stands_for": "the bulb"}, {"prop": "particles", "look": "orange atoms shaking in the filament and turning from orange to red", "place": "INSIDE the bulb glass, in the filament", "stands_for": "the metal atoms"}, {"prop": "particles", "look": "blue electron dots", "place": "INSIDE the bulb glass at the filament", "stands_for": "electrons"}], "change": "the atoms in the filament jiggle faster and turn from orange to red", "camera": "close on the filament", "texts": [], "flows": []},
    {"scene": "3", "objects": [{"prop": "lightbulb", "look": "big glass bulb, filament glowing red-orange", "place": "centre, large", "stands_for": "the bulb"}, {"prop": "thermometer", "look": "tall thermometer, liquid rising from blue to red", "place": "right of the bulb, medium", "stands_for": "the filament temperature"}, {"prop": "particles", "look": "jiggling red atoms", "place": "INSIDE the bulb glass, in the filament", "stands_for": "the hot metal atoms"}], "change": "the thermometer liquid rises and turns from blue to red", "camera": "slight pull back to show the bulb and the thermometer together", "texts": [{"words": "2000 °C", "starts": "about two thousand degrees Celsius", "ends": 15}], "flows": []},
    {"scene": "3", "objects": [{"prop": "lightbulb", "look": "big glass bulb, filament bright white, glass lit", "place": "centre, large", "stands_for": "the bulb giving light"}, {"prop": "particles", "look": "fast-jiggling white-hot atoms", "place": "INSIDE the bulb glass, in the filament", "stands_for": "the hot metal atoms"}], "change": "the filament glows from red to bright white and the glass lights up", "camera": "push in, close on the filament", "texts": [], "flows": []},
    {"scene": "4", "objects": [{"prop": "crowd", "look": "a crowd of tiny people packed together", "place": "centre, large, approaching the gap", "stands_for": "electrons in the filament"}, {"prop": "box", "look": "two grey walls with a narrow gap between them", "place": "centre, in front of the crowd, small", "stands_for": "the narrow filament"}], "change": "the tiny people pack together and squeeze through the narrow gap", "camera": "slow push in on the gap", "texts": [], "flows": []},
    {"scene": "5", "objects": [{"prop": "wire", "look": "the two-wire loop, the upper wire broken with a gap in the middle", "place": "centre, between the battery and the bulb", "stands_for": "the loop being cut"}, {"prop": "battery", "look": "green battery", "place": "left, medium", "stands_for": "the power source"}, {"prop": "lightbulb", "look": "glass bulb glowing white", "place": "right, medium", "stands_for": "the bulb"}], "change": "the loop breaks, the dots stop moving and the bulb fades dark", "camera": "wide shot of the whole loop", "texts": [], "flows": []},
    {"scene": "5", "objects": [{"prop": "wire", "look": "the two-wire loop, the gap closing", "place": "centre, between the battery and the bulb", "stands_for": "the switch closing"}, {"prop": "battery", "look": "green battery", "place": "left, medium", "stands_for": "the power source"}, {"prop": "lightbulb", "look": "glass bulb, dark then relighting", "place": "right, medium", "stands_for": "the bulb"}], "change": "the gap closes, the dots start moving again and the bulb relights", "camera": "wide shot of the whole loop", "texts": [], "flows": [{"what": "electrons", "by": "wire", "from": "battery", "to": "lightbulb"}, {"what": "electrons", "by": "wire", "from": "lightbulb", "to": "battery"}]},
    {"scene": "5", "objects": [{"prop": "wire", "look": "the upper wire split open with a gap, dots on both sides", "place": "centre, between the battery and the bulb", "stands_for": "the broken wire"}, {"prop": "battery", "look": "green battery", "place": "left, medium", "stands_for": "the power source"}, {"prop": "lightbulb", "look": "dark glass bulb", "place": "right, medium", "stands_for": "the bulb"}], "change": "the wire splits open and the dots bunch up on both sides of the gap", "camera": "slow push in on the gap", "texts": [], "flows": []},
    {"scene": "5", "objects": [{"prop": "wire", "look": "the upper wire with a glowing gap, dots piled at its edges", "place": "centre, between the battery and the bulb", "stands_for": "the viewer's question"}, {"prop": "battery", "look": "green battery", "place": "left, medium", "stands_for": "the power source"}, {"prop": "lightbulb", "look": "dark glass bulb", "place": "right, medium", "stands_for": "the bulb"}], "change": "the gap glows brighter as the dots pile up at its edges", "camera": "slow push in on the gap", "texts": [], "flows": []}
  ]
}

Review it now. Run every check from your instructions. Reply with the JSON object only.
