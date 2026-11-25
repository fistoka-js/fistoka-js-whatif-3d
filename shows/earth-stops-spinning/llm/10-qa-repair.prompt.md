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
- A planet's raised water ("ocean", "ocean_lon", "ocean_lat") reads as a swell only when the bump sits near the centre of the planet's disc as the camera sees it, measured at planet size 1.3 and camera angle "front". That centre is screen longitude 0 and screen latitude 0. East and north are positive. The numbers below are where the bump sits ON SCREEN; a planet that spun needs a different value in "ocean_lon", given further down. Keep "ocean_lon" and "ocean_lat" each between -14 and 14, and judge each one on its own. "ocean_lon" 14 with "ocean_lat" 14 is the limit at the corner, and "ocean_lon" 20 with "ocean_lat" 20 sticks out as a dark lens at the edge of the planet. South of the equator it turns dark early, so keep "ocean_lat" at -7 or higher. These limits are where the bump sits ON SCREEN. For a planet that spun and stopped, the value to write in "ocean_lon" is a different number, given by the offset rule below, so that the bump lands on screen inside these limits. A turning planet carries the bump round the globe and out of view, so the bump cannot be held in view while the planet turns. For a bump that stays, place the planet with "turn": 0 and no "spin", or put the ocean after the stop as described next. If the planet must keep turning in that shot, do not show the ocean bump in that shot. A planet that spun and then stopped with "spin" speed 0 stays frozen at the angle it reached, which is the speed times 360 times the seconds it spun (if there were several spins, add their angles together), and that frozen angle lasts for the rest of the scene, in the same shot as the spin or in a continuing shot ("continue": true). After the stop, move the bump with the "set" action on "ocean_lon" with "over": 0.1, and also on "ocean" to 0.8 if it was 0. The value for "ocean_lon" is the wanted on-screen longitude minus the frozen angle in degrees, so for the bump at the centre of the disc it is minus the frozen angle. Add or subtract 360 to stay between -180 and 180. This holds for the "spin" action around its default axis "y". For example, "spin" speed 0.1 for 3 seconds turns the planet 108 degrees, so "ocean_lon" -108 puts the bump back in front of the camera. If you re-declare the planet in a new scene instead, "ocean_lon" counts from rotation 0 again, so do not subtract the angle.
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

TITLE: What If Earth Suddenly Stopped Spinning?

THE SCRIPT AS SPOKEN, sentence by sentence (S1, S2, ...), with the sentence's start and end in seconds, then each word with its start time. Anchors must be copied from these words.
S1 [0.10-1.18] What if Earth stopped spinning?
   What 0.10 | if 0.29 | Earth 0.39 | stopped 0.58 | spinning? 0.86
S2 [1.50-5.56] Right now, Earth's surface races along at about one thousand miles an hour at the equator.
   Right 1.50 | now, 1.75 | Earth's 2.20 | surface 2.43 | races 2.77 | along 3.12 | at 3.42 | about 3.49 | one 3.75 | thousand 3.92 | miles 4.28 | an 4.57 | hour 4.65 | at 4.94 | the 5.02 | equator. 5.08
S3 [5.89-9.93] Here is what really happens: the ground would stop, but the air and the oceans would not.
   Here 5.89 | is 6.08 | what 6.18 | really 6.34 | happens: 6.56 | the 7.27 | ground 7.36 | would 7.63 | stop, 7.71 | but 8.32 | the 8.43 | air 8.53 | and 8.99 | the 9.07 | oceans 9.17 | would 9.50 | not. 9.63
S4 [10.25-13.90] Everything loose would keep its old speed and slide eastward across the ground.
   Everything 10.25 | loose 10.75 | would 11.02 | keep 11.17 | its 11.36 | old 11.49 | speed 11.69 | and 12.12 | slide 12.23 | eastward 12.67 | across 13.10 | the 13.42 | ground. 13.50
S5 [14.22-20.70] Near the equator, winds of about one thousand miles an hour would sweep across the land, stripping away soil, trees and buildings.
   Near 14.22 | the 14.46 | equator, 14.53 | winds 15.21 | of 15.41 | about 15.46 | one 15.73 | thousand 15.88 | miles 16.22 | an 16.52 | hour 16.61 | would 16.90 | sweep 17.02 | across 17.36 | the 17.67 | land, 17.76 | stripping 18.42 | away 18.73 | soil, 18.93 | trees 19.61 | and 20.03 | buildings. 20.14
S6 [21.02-26.65] The oceans would slosh forward, then drain toward the poles, because Earth would stay slightly bulged at the equator.
   The 21.02 | oceans 21.22 | would 21.58 | slosh 21.70 | forward, 22.04 | then 22.71 | drain 22.84 | toward 23.29 | the 23.52 | poles, 23.60 | because 24.20 | Earth 24.48 | would 24.69 | stay 24.82 | slightly 25.09 | bulged 25.62 | at 25.99 | the 26.09 | equator. 26.16
S7 [26.97-30.02] That would leave a huge belt of dry land around the middle of the planet.
   That 26.97 | would 27.15 | leave 27.25 | a 27.41 | huge 27.45 | belt 28.03 | of 28.23 | dry 28.32 | land 28.55 | around 28.89 | the 29.17 | middle 29.23 | of 29.50 | the 29.55 | planet. 29.63
S8 [30.34-36.18] A single day would last a whole year, so one side would bake in sunlight for about six months while the other froze in darkness.
   A 30.34 | single 30.50 | day 30.83 | would 30.99 | last 31.14 | a 31.43 | whole 31.48 | year, 31.77 | so 32.37 | one 32.48 | side 32.65 | would 32.95 | bake 33.08 | in 33.29 | sunlight 33.38 | for 33.81 | about 33.96 | six 34.18 | months 34.47 | while 34.77 | the 34.89 | other 35.02 | froze 35.26 | in 35.55 | darkness. 35.65
S9 [36.50-41.02] It is like a bus braking hard: the bus stops, but everything inside keeps flying forward.
   It 36.50 | is 36.68 | like 36.78 | a 36.90 | bus 36.96 | braking 37.23 | hard: 37.56 | the 38.17 | bus 38.26 | stops, 38.49 | but 39.09 | everything 39.25 | inside 39.60 | keeps 40.05 | flying 40.28 | forward. 40.58
S10 [41.34-47.22] Earth's slow, steady turn keeps our winds gentle, our oceans spread evenly, and our days short enough for life to thrive.
   Earth's 41.34 | slow, 41.66 | steady 42.22 | turn 42.52 | keeps 42.85 | our 43.12 | winds 43.23 | gentle, 43.47 | our 44.15 | oceans 44.26 | spread 44.56 | evenly, 44.83 | and 45.52 | our 45.62 | days 45.73 | short 45.97 | enough 46.16 | for 46.37 | life 46.48 | to 46.71 | thrive. 46.80
S11 [47.54-49.87] If you had to survive it, where on Earth would you stand?
   If 47.54 | you 47.71 | had 47.78 | to 47.95 | survive 48.01 | it, 48.44 | where 48.86 | on 49.00 | Earth 49.13 | would 49.34 | you 49.42 | stand? 49.49
S12 [50.20-51.31] Comment your answer below.
   Comment 50.20 | your 50.61 | answer 50.72 | below. 51.00

THE PICTURE PLAN from the script writer (S n here is S n above): what stays on screen, what visibly changes while that sentence is spoken, and the dial that drives it. Follow it; improve it where the catalogue offers a better way to show the same change.
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

THE APPROVED STORYBOARD (entry n of "sentences" is S n above). It is the source of truth: build exactly this storyboard, with the same objects (prop types), the same flow directions (a wire or arrow runs from its "from" to its "to"), each text on the phrase in its "starts" and kept until the START of the sentence in its "ends", and the same ending. A label, text or count ends with its shot (the engine ends it with its shot): to keep it up longer, repeat the same label or text at the start of the next shot. A checker compares your show with it.
{
  "hook": "What if Earth stopped spinning?",
  "answer": "The ground would stop but the air and oceans would not, so huge winds would scour the land, the seas would drain toward the poles, and each day would last a year.",
  "hero": "planet",
  "summary": "A big Earth is shown first with a speed gauge reading about one thousand miles an hour, then the gauge drops to zero as the spin stops. On the ground a boulder and a tree are hit by a wall of fast wind and dust. Back in space, the ocean swell slides to the pole and leaves dry land around the middle, and the sun lights only one side. A toy bus braking while its crates slide forward explains why. The video ends on a calm Earth and the question of where you would stand.",
  "scenes": [{"scene": "1", "env": "space", "idea": "Earth big in space with a speed gauge, the spin stops while the air and ocean keep going"}, {"scene": "2", "env": "planet_surface", "idea": "On the ground a boulder slides and a tree is torn over by fast wind and dust"}, {"scene": "3", "env": "space", "idea": "Earth with the ocean swell moving to the pole, dry land at the equator, then one side lit by the sun"}, {"scene": "4", "env": "studio", "idea": "A toy bus brakes while the crates inside slide forward"}, {"scene": "5", "env": "space", "idea": "A calm Earth with an even ocean, ending on the question"}],
  "ending": {"closing_question": "If you had to survive it, where on Earth would you stand?", "comment_line": "Comment your answer below.", "tail": "the Earth keeps glowing softly and its air glow settles; it is still gently changing when the video ends, never cut off"},
  "sentences": [
    {"scene": "1", "objects": [{"prop": "planet", "look": "blue and green Earth with a thin air glow and a faint ocean swell at the equator, filling most of the frame", "place": "centre, very large", "stands_for": "Earth"}], "change": "the air glow brightens and the ocean swell begins to slide as the turning slows", "camera": "slow push in, close on the planet", "texts": [], "flows": []},
    {"scene": "1", "objects": [{"prop": "planet", "look": "blue and green Earth turning, air glow on", "place": "centre, large", "stands_for": "Earth"}, {"prop": "gauge", "look": "small speed dial with a green to red arc", "place": "bottom right in front, small", "stands_for": "the speed of the surface at the equator"}], "change": "the gauge needle swings up to the top of its arc", "camera": "hold close on the planet, gauge in the corner", "texts": [{"words": "1,000 mph at the equator", "starts": "about one thousand miles an hour", "ends": 4}], "flows": []},
    {"scene": "1", "objects": [{"prop": "planet", "look": "Earth with a thicker air glow, ocean swell slipping forward past the land", "place": "centre, large", "stands_for": "Earth, the ground now stopped"}, {"prop": "gauge", "look": "small speed dial", "place": "bottom right in front, small", "stands_for": "the speed of the ground"}], "change": "the needle drops to zero while the air glow thickens and the ocean swell slides forward", "camera": "hold close on the planet", "texts": [], "flows": []},
    {"scene": "2", "objects": [{"prop": "rock", "look": "grey chiselled boulder with cracks", "place": "centre on the ground, large, close", "stands_for": "anything loose on the ground"}, {"prop": "particles", "look": "small tan dust grains around the boulder's base", "place": "around the boulder's base, small", "stands_for": "loose soil"}], "change": "the boulder lurches to the right and slides along the ground, kicking up dust", "camera": "low angle, close on the boulder as it slides", "texts": [], "flows": []},
    {"scene": "2", "objects": [{"prop": "rock", "look": "grey boulder with cracks", "place": "centre-left on the ground, large", "stands_for": "the land"}, {"prop": "tree", "look": "green round tree", "place": "right of the boulder on the ground, medium", "stands_for": "trees and buildings"}, {"prop": "particles", "look": "tan dust streaks blowing from left to right", "place": "across the whole ground, in front and behind", "stands_for": "stripped soil and wind"}], "change": "the dust streaks fly sideways and the tree is bent and ripped over", "camera": "hold wide enough to see the tree and boulder", "texts": [{"words": "winds of 1,000 mph", "starts": "winds of about one thousand miles an hour", "ends": 6}], "flows": []},
    {"scene": "3", "objects": [{"prop": "planet", "look": "Earth with a clear blue ocean swell around the equator, small air glow", "place": "centre, large", "stands_for": "Earth and its oceans"}, {"prop": "gauge", "look": "small speed dial, needle at zero", "place": "bottom right in front, small", "stands_for": "the ground, now stopped"}], "change": "the ocean swell slides from the equator up toward the north pole and grows there", "camera": "slow push in, close on the planet", "texts": [], "flows": []},
    {"scene": "3", "objects": [{"prop": "planet", "look": "Earth with the water pulled to the poles and a wide brown and green land belt around the middle", "place": "centre, large", "stands_for": "Earth with a belt of dry land"}, {"prop": "gauge", "look": "small speed dial, needle at zero", "place": "bottom right in front, small", "stands_for": "the ground, now stopped"}], "change": "the ocean drains away from the middle so bare land is left around the equator", "camera": "hold close on the planet", "texts": [], "flows": []},
    {"scene": "3", "objects": [{"prop": "planet", "look": "Earth, one half bright, the other half dark", "place": "centre, large", "stands_for": "Earth that no longer spins"}, {"prop": "sun", "look": "small bright yellow sun with a halo", "place": "left, behind the planet, small", "stands_for": "the sunlight on one side"}], "change": "the sun glows brighter on one side while the far side of the planet goes dark", "camera": "hold close on the planet", "texts": [{"words": "1 day = 1 year", "starts": "A single day would last a whole year", "ends": 9}, {"words": "6 months light, 6 dark", "starts": "about six months", "ends": 9}], "flows": []},
    {"scene": "4", "objects": [{"prop": "car", "look": "chunky yellow toy bus", "place": "centre, large, side view", "stands_for": "Earth stopping"}, {"prop": "box", "look": "three small orange crates", "place": "inside the bus at the front, small", "stands_for": "air and oceans keep moving"}], "change": "the bus brakes to a halt while the crates slide forward inside", "camera": "side view, close on the bus", "texts": [], "flows": []},
    {"scene": "5", "objects": [{"prop": "planet", "look": "calm Earth with an even blue ocean around the equator and a soft thin air glow", "place": "centre, large", "stands_for": "Earth as it is now"}, {"prop": "sun", "look": "small bright yellow sun with a halo", "place": "left, behind the planet, small", "stands_for": "the sunlight that gives us short days"}], "change": "the ocean swell spreads out evenly around the equator and the air glow settles to a calm soft haze", "camera": "slow pull back, centred on the planet", "texts": [], "flows": []},
    {"scene": "5", "objects": [{"prop": "planet", "look": "Earth with a bright land belt and poles", "place": "centre, large", "stands_for": "places you could stand"}, {"prop": "sun", "look": "small bright yellow sun with a halo", "place": "left, behind the planet, small", "stands_for": "the sunlight"}], "change": "the land belt and the polar ice glow brighter as the ocean swell moves", "camera": "slow push in", "texts": [], "flows": []},
    {"scene": "5", "objects": [{"prop": "planet", "look": "warm glowing Earth, steady air glow", "place": "centre, large", "stands_for": "Earth waiting for your answer"}, {"prop": "sun", "look": "small bright yellow sun with a halo", "place": "left, behind the planet, small", "stands_for": "the sunlight"}], "change": "the whole planet and its air glow warm and brighten softly", "camera": "slow push in, ending centred", "texts": [], "flows": []}
  ]
}

The last word ends at 51.31 s; the video is 53.81 s long. Make 2 to 4 main scenes (a scene = a shot plus its "continue": true shots), plus at most a short opening and a short closing scene. Each shot lasts 1.5 to 12 seconds (over 9 s gives a warning); aim for 3 to 8.

Think through the scenes and the changes first (section 2), then reply with the complete show.json and nothing else: no code fence, no comments, no text before or after it.


---
Your show below is valid, but the automatic picture check found problems when it drew the frames (sizes are in pixels of a 540x960 frame). Fix every FAIL, and the WARNs where you can, by changing sizes, positions, camera framing/focus or overlay timing. Keep the story, the shots and their start phrases the same. Reply with the complete corrected show.json only: no code fence, no text before or after it.

YOUR SHOW:
{
  "format": 1,
  "title": "What If Earth Suddenly Stopped Spinning?",
  "voice": {"audio": "voice.mp3", "words": "words.json"},
  "dials": {"airglow": {"start": 0, "keys": [{"at": "What if", "to": 0.4, "over": 1.0}, {"at": "air and", "to": 1, "over": 1.4}]}, "speed": {"start": 0, "keys": [{"at": "races along", "to": 1, "over": 1.6}, {"at": "would stop", "to": 0, "over": 0.8}]}, "day": {"start": 0, "keys": [{"at": "A single day", "to": 0.4, "over": 1.5}, {"at": "bake in", "to": 1, "over": 1.8}, {"at": "froze in", "to": 0.15, "over": 1.2}]}, "calm": {"start": 0, "keys": [{"at": "Earth's slow", "to": 1, "over": 3.5}]}},
  "shots": [
    {
      "id": "hook",
      "env": {"type": "space", "nebula": "blue"},
      "camera": {"focus": ["earth"], "framing": "medium", "fill": 1.0, "angle": "front", "move": "drift", "amount": 0.3},
      "props": [
        {"id": "earth", "type": "planet", "look": "earth", "at": "center", "size": 1.3, "turn": 0, "atmosphere": {"dial": "airglow", "from": [0, 1], "to": [0.6, 0.9]}},
        {"id": "gauge", "type": "gauge", "at": [0.75, -0.55, 0.9], "size": 0.55, "arc": "green-red", "hidden": true, "value": {"dial": "speed", "to": [0.05, 0.95]}, "glow": {"dial": "speed", "to": [0, 0.6]}}
      ],
      "actions": [
        {"at": "What if", "do": "spin", "prop": "earth", "speed": 0.08},
        {"at": "Right now", "do": "appear", "prop": "gauge", "style": "pop"},
        {"at": "about one thousand", "do": "text", "text": "1,000 mph at the equator", "style": "number"}
      ]
    },
    {
      "id": "stop",
      "start": "Here is what",
      "continue": true,
      "camera": {"focus": ["earth"], "framing": "medium", "fill": 1.05, "angle": "front", "move": "push_in", "amount": 0.3, "glide": 1.0},
      "actions": [
        {"at": "Here is what", "do": "text", "text": "1,000 mph at the equator", "style": "number"},
        {"at": "would stop", "do": "spin", "prop": "earth", "speed": 0},
        {"at": "would stop", "do": "set", "prop": "earth", "param": "ocean_lon", "to": 131.14, "over": 0.1},
        {"at": "the oceans", "do": "set", "prop": "earth", "param": "ocean", "to": 0.8, "over": 0.6},
        {"at": "the oceans", "do": "set", "prop": "earth", "param": "ocean_lon", "to": 153.14, "over": 1.0}
      ]
    },
    {
      "id": "slide",
      "start": "Everything loose",
      "env": "planet_surface",
      "camera": {"focus": ["rock"], "framing": "close", "fill": 1.0, "angle": "low", "move": "push_in", "amount": 0.3},
      "props": [
        {"id": "rock", "type": "rock", "at": [-0.9, 0, 0], "size": 1.3},
        {"id": "dust", "type": "particles", "shape": "box", "count": 90, "color": "#c8a46a", "dot": 0.1, "size": 1.4, "at": [-0.5, 0.35, 0.4], "spread": 0.5, "speed": 0.3}
      ],
      "actions": [
        {"at": "Everything loose", "do": "move", "prop": "rock", "to": [0.7, 0, 0], "until": {"phrase": "ground", "edge": "end"}, "ease": "out"},
        {"at": "keep its", "do": "set", "prop": "dust", "param": "speed", "to": 1.5, "over": 0.8},
        {"at": "slide", "do": "set", "prop": "dust", "param": "spread", "to": 2, "over": 1.0}
      ]
    },
    {
      "id": "wind",
      "start": "Near the equator",
      "continue": true,
      "camera": {"focus": ["rock", "tree"], "framing": "medium", "fill": 1.0, "angle": "front", "move": "drift", "amount": 0.3, "glide": 1.0},
      "props": [
        {"id": "tree", "type": "tree", "style": "round", "at": [1.0, 0, 0], "size": 1.2},
        {"id": "gale", "type": "particles", "shape": "stream", "count": 300, "color": "#d9c08a", "dot": 0.1, "size": 2.0, "at": [0, 0.7, 0.5], "speed": 0.3, "hidden": true}
      ],
      "actions": [
        {"at": "Near the equator", "do": "appear", "prop": "tree", "style": "grow"},
        {"at": "winds of about one", "do": "text", "text": "winds of 1,000 mph", "style": "number"},
        {"at": "winds of about one", "do": "appear", "prop": "gale", "style": "fade"},
        {"at": "winds of about one", "do": "set", "prop": "gale", "param": "speed", "to": 3, "over": 1.5},
        {"at": "sweep across", "do": "set", "prop": "gale", "param": "spread", "to": 2, "over": 1.0},
        {"at": "stripping away", "do": "set", "prop": "dust", "param": "spread", "to": 3, "over": 1.0},
        {"at": "stripping away", "do": "move", "prop": "rock", "to": [1.2, 0, 0], "over": 1.5},
        {"at": "trees", "do": "disappear", "prop": "tree", "style": "fly_out", "to": "far-right"},
        {"at": "buildings", "do": "set", "prop": "gale", "param": "spread", "to": 3, "over": 0.8}
      ]
    },
    {
      "id": "drain",
      "start": "The oceans",
      "env": {"type": "space", "nebula": "blue"},
      "transition": "dip",
      "camera": {"focus": ["sea"], "framing": "medium", "fill": 1.0, "angle": "front", "move": "drift", "amount": 0.3},
      "props": [
        {"id": "sea", "type": "planet", "look": "earth", "at": "center", "size": 1.3, "turn": 0, "ocean": 0.8, "ocean_lon": 0, "ocean_lat": 0, "glow": {"dial": "day", "to": [0, 0.3]}},
        {"id": "dial2", "type": "gauge", "at": [0.75, -0.55, 0.9], "size": 0.55, "arc": "green-red", "value": {"dial": "speed", "to": [0.05, 0.95]}}
      ],
      "actions": [
        {"at": "slosh forward", "do": "set", "prop": "sea", "param": "ocean_lon", "to": 9, "over": 0.9},
        {"at": "drain toward", "do": "set", "prop": "sea", "param": "ocean_lat", "to": 13, "over": 2.2},
        {"at": "because Earth", "do": "set", "prop": "sea", "param": "ocean_lon", "to": 0, "over": 1.2},
        {"at": "slightly bulged", "do": "set", "prop": "sea", "param": "ocean", "to": 1.0, "over": 1.0}
      ]
    },
    {
      "id": "belt",
      "start": "That would leave",
      "continue": true,
      "camera": {"focus": ["sea"], "framing": "medium", "fill": 1.1, "angle": "front", "move": "push_in", "amount": 0.3, "glide": 1.0},
      "actions": [
        {"at": "huge belt", "do": "set", "prop": "sea", "param": "ocean", "to": 0.2, "over": 1.5},
        {"at": "dry land", "do": "set", "prop": "sea", "param": "atmosphere", "to": 0.4, "over": 1.0},
        {"at": "around the middle", "do": "set", "prop": "sea", "param": "ocean_lon", "to": -8, "over": 1.0}
      ]
    },
    {
      "id": "day",
      "start": "A single day",
      "continue": true,
      "camera": {"focus": ["sea"], "framing": "medium", "fill": 1.0, "angle": "front", "move": "drift", "amount": 0.3, "glide": 1.0},
      "props": [
        {"id": "star", "type": "sun", "at": [-1.15, 0.35, -0.8], "size": 0.5, "hidden": true, "brightness": {"dial": "day", "to": [0.5, 1.7]}}
      ],
      "actions": [
        {"at": "A single day", "do": "appear", "prop": "star", "style": "grow"},
        {"at": "A single day", "do": "text", "text": "1 day = 1 year", "style": "number"},
        {"at": "for about six", "do": "text", "text": "6 months light, 6 dark", "style": "number", "pos": "middle"},
        {"at": "bake in", "do": "set", "prop": "sea", "param": "atmosphere", "to": 0.7, "over": 1.5},
        {"at": "froze in", "do": "set", "prop": "sea", "param": "ocean", "to": 0.5, "over": 1.5}
      ]
    },
    {
      "id": "bus",
      "start": "It is like",
      "continue": true,
      "camera": {"focus": ["sea", "bus"], "framing": "medium", "fill": 1.0, "angle": "front", "move": "drift", "amount": 0.3, "glide": 1.0},
      "props": [
        {"id": "bus", "type": "car", "style": "bus", "color": "#ffd23a", "driving": true, "at": [-0.9, -0.6, 0.3], "size": 1.3},
        {"id": "crate1", "type": "box", "color": "#e0762a", "width": 0.35, "height": 0.35, "depth": 0.35, "at": [-1.15, 0.45, 0.4], "size": 1.0},
        {"id": "crate2", "type": "box", "color": "#e0762a", "width": 0.35, "height": 0.35, "depth": 0.35, "at": [-0.9, 0.45, 0.4], "size": 1.0},
        {"id": "crate3", "type": "box", "color": "#e0762a", "width": 0.35, "height": 0.35, "depth": 0.35, "at": [-0.65, 0.45, 0.4], "size": 1.0}
      ],
      "actions": [
        {"at": "It is like", "do": "disappear", "prop": "star", "style": "fade"},
        {"at": "It is like", "do": "disappear", "prop": "dial2", "style": "fade"},
        {"at": "It is like", "do": "move", "prop": "sea", "to": [0, 1.2, 0], "over": 0.8},
        {"at": "It is like", "do": "scale", "prop": "sea", "to": 0.55, "over": 0.8},
        {"at": "like a", "do": "move", "prop": "bus", "to": [0.5, -0.6, 0.3], "until": {"phrase": "stops", "edge": "start"}, "ease": "out"},
        {"at": "like a", "do": "move", "prop": "crate1", "to": [0.25, 0.45, 0.4], "until": {"phrase": "stops", "edge": "start"}, "ease": "out"},
        {"at": "like a", "do": "move", "prop": "crate2", "to": [0.5, 0.45, 0.4], "until": {"phrase": "stops", "edge": "start"}, "ease": "out"},
        {"at": "like a", "do": "move", "prop": "crate3", "to": [0.75, 0.45, 0.4], "until": {"phrase": "stops", "edge": "start"}, "ease": "out"},
        {"at": "but everything", "do": "move", "prop": "crate1", "to": [1.05, 0.45, 0.4], "over": 1.0, "ease": "in"},
        {"at": "but everything", "do": "move", "prop": "crate2", "to": [1.3, 0.45, 0.4], "over": 1.0, "ease": "in"},
        {"at": "but everything", "do": "move", "prop": "crate3", "to": [1.55, 0.45, 0.4], "over": 1.0, "ease": "in"},
        {"at": "flying forward", "do": "glow", "prop": "crate2", "to": 0.5, "over": 0.6}
      ]
    },
    {
      "id": "calm",
      "start": "Earth's slow",
      "env": {"type": "space", "nebula": "blue"},
      "transition": "dip",
      "camera": {"focus": ["home"], "framing": "medium", "fill": 1.0, "angle": "front", "move": "pull_out", "amount": 0.3},
      "props": [
        {"id": "home", "type": "planet", "look": "earth", "at": "center", "size": 1.3, "turn": 0.05, "atmosphere": {"dial": "calm", "to": [0.9, 0.55]}},
        {"id": "star2", "type": "sun", "at": [-1.15, 0.35, -0.8], "size": 0.5, "brightness": {"dial": "calm", "to": [1.7, 1.0]}}
      ],
      "actions": [
        {"at": "our oceans", "do": "glow", "prop": "home", "to": 0.12, "over": 1.0},
        {"at": "our days", "do": "scale", "prop": "star2", "to": 1.3, "over": 1.2}
      ]
    },
    {
      "id": "question",
      "start": "If you had",
      "continue": true,
      "camera": {"focus": ["home"], "framing": "medium", "fill": 1.05, "angle": "front", "move": "push_in", "amount": 0.3, "glide": 1.0},
      "actions": [
        {"at": "If you had", "do": "glow", "prop": "home", "to": 0.3, "over": 1.5},
        {"at": "where on Earth", "do": "scale", "prop": "star2", "to": 1.0, "over": 1.0},
        {"at": "Comment your", "do": "glow", "prop": "home", "to": 0.45, "over": 3.0}
      ]
    }
  ]
}

PICTURE CHECK FINDINGS (level, shot, time, what is wrong, how to fix):
- FAIL shot "wind" at 15.506 s: prop "gale" is 61% outside the frame (box x -480..311 of 540, y 87..835 of 960) Fix: move it toward the centre (its "at" is [0,0.7,0.5]) or lower the camera "fill" (now 1; it overrides "framing") and list the props to keep in view under "focus".
- FAIL shot "wind" at 17.623 s: prop "dust" is 84% outside the frame (box x -466..90 of 540, y 301..785 of 960) Fix: move it toward the centre (its "at" is [-0.5,0.35,0.4]) or lower the camera "fill" (now 1; it overrides "framing") and list the props to keep in view under "focus".
- FAIL shot "bus" at 40.584 s: prop "crate2" is 52% outside the frame (shape x 437..653 of 540, y 270..473 of 960) Fix: move it toward the centre (its "at" is [-0.9,0.45,0.4]) or lower the camera "fill" (now 1; it overrides "framing") and list the props to keep in view under "focus".
- FAIL shot "calm" at 44.442 s: prop "star2" is 100% outside the frame (shape x -196..-23 of 540, y 175..343 of 960) Fix: move it toward the centre (its "at" is [-1.15,0.35,-0.8]) or lower the camera "fill" (now 1; it overrides "framing") and list the props to keep in view under "focus".
- FAIL shot "question" at 49.156 s: prop "star2" is 74% outside the frame (box x -168..59 of 540, y 193..383 of 960) Fix: move it toward the centre (its "at" is [-1.15,0.35,-0.8]) or lower the camera "fill" (now 1.05; it overrides "framing") and list the props to keep in view under "focus".
