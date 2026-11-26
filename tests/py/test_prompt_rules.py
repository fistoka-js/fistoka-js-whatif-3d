"""Plain text checks that the writer prompts still carry the remake rules (hook delivery, unit-number
texts, particles inside a prop) and the planet ocean placement rules (where the bump reads as a swell,
the frozen angle after a spin, the "ocean_lon" offset) and the Earth-video lessons (glow limits, the
moon companion, crate size, the bus shot rules), the battery-bulb circuit framing bullet, the
side-prop placement bullet (outer-edge limit) and the eruption column and cloud layout bullet.
Each phrase must appear exactly once in its file, so deleting a rule breaks a test. No network.
The ocean, Earth-video, circuit, side-prop and eruption tests use the stricter once_everywhere."""
import math
import re

from pipeline import writer

SHOW = writer.read_prompt("show_system.md")
BOARD = writer.read_prompt("storyboard_system.md")
SCRIPT = writer.read_prompt("script_system.md")
# every text-like prompt file, examples included (none of them carries the ocean phrases, so no miscount)
ALL_PROMPTS = "\n".join(
    p.read_text(encoding="utf-8", errors="replace")
    for p in sorted(writer.PROMPTS.rglob("*"))
    if p.is_file() and p.suffix in (".md", ".txt", ".json")
)


def once(text, phrase):
    assert text.count(phrase) == 1, phrase


def once_everywhere(phrase):
    """Stricter than once: the phrase is in ALL prompt files (examples included) exactly once, and that place is show_system.md."""
    assert ALL_PROMPTS.count(phrase) == 1, phrase
    assert SHOW.count(phrase) == 1, phrase


def test_hook_rules_in_script_prompt():
    once(SCRIPT, "DELIVER what its hook sets up")
    once(SCRIPT, "Two cases. (1) The hook asks a question")
    once(SCRIPT, "answer it with what really happens and why")
    once(SCRIPT, "(2) The hook states a belief")
    once(SCRIPT, "say whether the belief is true, and why")
    once(SCRIPT, "the hook names its subject with a noun")
    once(SCRIPT, "it must not bring in a new subject")
    once(SCRIPT, "answer the question and also say whether the belief is true")
    once(SCRIPT, "never ask for a different one")


def test_unit_number_rules_in_show_prompt():
    once(SHOW, 'Use a "text" action of at most 40 characters, with style "number" for a big figure, never a "label"')
    once(SHOW, "A spoken number with a unit")
    once(SHOW, 'count" for a number WITHOUT a unit')
    once(SHOW, "give the text action an \"until\" that is the first 1 to 6 words of that sentence")
    once(SHOW, "so the text stays to the end of its shot (the end of the video only if it is in the last shot)")
    once(SHOW, "until the start of the FIRST later sentence that starts at least {{TEXT_SECONDS}} seconds after the text appears")
    once(SHOW, "or if no later sentence is long enough, also leave")
    once(SHOW, "3 or more unit numbers")
    once(SHOW, 'put one at "pos" "top" and the other at "pos" "middle"')
    once(SHOW, "has priority over a label when the limit of 2 overlays")
    once(SHOW, "every spoken number with a unit has a text held to the next sentence")
    assert "a temperature, speed, distance, time" in SHOW and "a temperature, speed, distance, time" in BOARD


def test_unit_number_rules_in_storyboard_prompt():
    once(BOARD, "EVERY number with a unit")
    # the storyboard has no actions or styles: its text entry just carries the number and unit as "words"
    once(BOARD, 'gets a text entry whose "words" are the number and its unit')
    assert "style" not in BOARD.split("EVERY number with a unit")[1].split("Use []")[0]
    once(BOARD, "3 or more numbers with units")
    once(BOARD, "its own sentence number plus 1")
    once(BOARD, 'or no later sentence is long enough, use "end"')
    once(BOARD, "the FIRST later sentence that starts at least {{TEXT_SECONDS}} seconds after the text appears")


def test_inside_a_prop_rules():
    once(SHOW, "To show something INSIDE a prop")
    once(SHOW, "exempt from BOTH size minimums (size 1 and size 0.6)")
    once(SHOW, "(same z, never nearer the camera)")
    once(SHOW, "about 0.65 x its size above the ground")
    once(SHOW, 'a size 1.2 bulb at [0.9, 0, 0] gets particles "at" [0.9, 0.8, 0] with "size" 0.4')
    once(BOARD, 'when the sentence says something happens "inside" a prop')


def test_wire_rules():
    once(SHOW, 'never both wires "to" the bulb')
    once(SHOW, "electrons leave the battery's negative (−) end")
    once(SHOW, "wire 1, the out wire, from [-0.35, 0.2, 0.1]")
    once(SHOW, '("arrow", "beam", "wire", "light_wave") have')
    once(SHOW, "beam, arrow or light_wave")
    once(BOARD, "Keep the same direction in every sentence that shows the loop")


def test_planet_ocean_placement_rules():
    once_everywhere('reads as a swell only when the bump sits near the centre of the planet\'s disc as the camera sees it, measured at planet size 1.3 and camera angle "front"')
    once_everywhere('That centre is screen longitude 0 and screen latitude 0')
    once_everywhere('East and north are positive.')
    once_everywhere('Keep "ocean_lon" and "ocean_lat" each between -14 and 14, and judge each one on its own')
    once_everywhere('"ocean_lon" 14 with "ocean_lat" 14 is the limit at the corner')
    once_everywhere('"ocean_lon" 20 with "ocean_lat" 20 sticks out as a dark lens at the edge of the planet')
    once_everywhere('so keep "ocean_lat" at -7 or higher')
    once_everywhere('These limits are where the bump sits ON SCREEN')
    once_everywhere('the value to write in "ocean_lon" is a different number, given by the offset rule below')
    once_everywhere('This holds for the "spin" action around its default axis "y"')
    once_everywhere('A turning planet carries the bump round the globe and out of view, so the bump cannot be held in view while the planet turns')
    once_everywhere('place the planet with "turn": 0 and no "spin", or put the ocean after the stop as described next')
    once_everywhere('If the planet must keep turning in that shot, do not show the ocean bump in that shot')
    once_everywhere('A planet that spun and then stopped with "spin" speed 0 stays frozen at the angle it reached')
    once_everywhere('the speed times 360 times the seconds it spun')
    once_everywhere('if there were several spins, add their angles together')
    once_everywhere('lasts for the rest of the scene, in the same shot as the spin or in a continuing shot ("continue": true)')
    once_everywhere('move the bump with the "set" action on "ocean_lon" with "over": 0.1, and also on "ocean" to 0.8 if it was 0')
    once_everywhere('The value for "ocean_lon" is the wanted on-screen longitude minus the frozen angle in degrees, so for the bump at the centre of the disc it is minus the frozen angle')
    once_everywhere('Add or subtract 360 to stay between -180 and 180')
    once_everywhere('South of the equator it turns dark early')
    once_everywhere('"spin" speed 0.1 for 3 seconds turns the planet 108 degrees, so "ocean_lon" -108')
    once_everywhere('If you re-declare the planet in a new scene instead, "ocean_lon" counts from rotation 0 again, so do not subtract the angle')


def test_earth_video_lessons():
    once_everywhere('sharp with its "glow" (the param or the action) at about 0.05 or lower')
    once_everywhere('At 0.1 a bluish veil is already visible over the surface, and from 0.2 up the continents fade into a pale haze')
    once_everywhere('This was seen on a planet of "size" 1.3 at "angle" "front" with the default lighting.')
    once_everywhere('Its "atmosphere" only thickens the blue rim and the surface stays readable up to 0.9 when "glow" is low, so "glow" is the value to keep small')
    once_everywhere('Write the environment as an object with "companion": "none" to remove it.')
    once_everywhere('so a box at "size" 1 is 1 unit along its longest side however small those numbers are')
    once_everywhere('Beside a vehicle give a crate a "size" of about 0.2 x the vehicle\'s "size"')
    once_everywhere('is a solid, opaque body with no cutaway')
    once_everywhere('must start hidden inside the body, toward the front, at body height')
    once_everywhere('come out through the front after the stop, never over the roof')
    once_everywhere('with an "ease" "out" so the slowing reads as a stop')
    once_everywhere('arc it down to "at" y 0 because a prop that does not float stands with its bottom at its "at" height')
    once_everywhere('land the pieces clear of the bus front with gaps between them and well inside the frame')
    # all 4 earth-video bullets must exist (a changed prefix fails here) and hold no semicolons
    prefixes = ('- A planet keeps its continents', '- The "planet_surface" environment hangs',
                '- A "box" "size" sets its longest side', '- The "car" with "style": "bus"')
    lines = [ln for ln in SHOW.splitlines() if ln.startswith(prefixes)]
    assert len(lines) == 4, lines
    for line in lines:
        assert ';' not in line, line[:60]


def test_no_bullet_glued_onto_a_sentence():
    """A new bullet must start its own line: '.- ' or ':- ' inside a line means two bullets got fused."""
    for name, text in (("show", SHOW), ("storyboard", BOARD), ("script", SCRIPT), ("all", ALL_PROMPTS)):
        glued = [ln[:80] for ln in text.splitlines() if re.search(r'[.!?)"]- |:- ', ln)]
        assert not glued, (name, glued)
    assert any(ln.startswith('- "wire" is a stage-space cable') for ln in SHOW.splitlines())


def test_show_prompt_fills_the_text_seconds_number():
    filled = writer.show_system_prompt()
    assert "{{TEXT_SECONDS}}" not in filled
    assert f"less than {writer.TEXT_MIN_SECONDS:g} seconds after the text appears" in filled


def test_circuit_framing_bullet():
    """A battery-bulb-wire circuit is told to be big: sizes, positions, medium framing with fill 1.25."""
    once_everywhere('use a battery "size" 1.6 at [-0.8, 0, 0] and a bulb "size" 1.5 at [0.8, 0, 0]')
    once_everywhere('"framing": "medium" with "fill": 1.25 (about 85% of the frame width')
    assert any(ln.startswith('- To make a battery, bulb and wire circuit fill the frame') for ln in SHOW.splitlines())


def bullet(start):
    """The one show-prompt line that starts with this text."""
    lines = [ln for ln in SHOW.splitlines() if ln.startswith(start)]
    assert len(lines) == 1, start
    return lines[0]


def test_side_prop_placement_bullet():
    """Side props: outer edge at most a quarter of hero size past its side, z -0.5 to 0.5."""
    once_everywhere('Measure it by its outer edge: its "at" x plus half its "size"')
    once_everywhere("may reach no more than a quarter of the hero's \"size\" past the hero's side")
    once_everywhere('Its "at" z is between -0.5 and 0.5.')
    once_everywhere('This is a rule of thumb, not what the engine measures')
    once_everywhere('so the rule errs on the safe side.')
    once_everywhere('A ground prop toward the camera (z 0.9) sinks into the captions.')
    # Read the worked example from the prompt and check it against the rule it states.
    line = bullet('- A side prop beside a wide hero')
    hero = re.search(r'beside a hero of "size" ([\d.]+) at x ([\d.-]+) \(side at x ([\d.]+), limit x ([\d.]+)\)', line)
    size, x = float(hero[1]), float(hero[2])
    side, limit = float(hero[3]), float(hero[4])
    assert side == round(x + size / 2, 2) and limit == round(x + size / 2 + size / 4, 2)
    good = re.search(r'a thermometer of "size" ([\d.]+) at x ([\d.]+) \(outer edge ([\d.]+)\) is fine', line)
    bad = re.search(r'but one at x ([\d.]+) \(outer edge ([\d.]+)\) breaks the rule', line)
    prop = float(good[1])
    assert float(good[3]) == round(float(good[2]) + prop / 2, 2) <= limit
    assert float(bad[2]) == round(float(bad[1]) + prop / 2, 2) > limit


def test_eruption_column_and_cloud_bullet():
    """Eruption starts at the crater, cloud above it; all within 1.3 x hero height of its top."""
    once_everywhere("- An eruption starts at the hero's crater: its column may start a little below")
    once_everywhere('A cloud above it sits higher, over the eruption.')
    once_everywhere("within about 1.3 times the hero's height above the hero's top")
    once_everywhere('so it starts inside the crater with no gap')
    once_everywhere('"at" [0.27, 1.64, 0] with "rotate" [0, 0, 65] and "at" [-0.27, 1.64, 0]')
    # Read the worked example from the prompt and check it against the rule it states.
    line = bullet("- An eruption starts at the hero's crater")
    k = float(re.search(r"within about ([\d.]+) times the hero's height", line)[1])
    m = re.search(r'\(([\d.]+) tall, rim at y ([\d.]+), so everything stays below y ([\d.]+)\)', line)
    height, rim, top = float(m[1]), float(m[2]), float(m[3])
    assert round(rim + k * height, 2) == top
    col = re.search(r'from y ([\d.]+) to ([\d.]+), so it starts inside the crater', line)
    assert float(col[1]) < rim < float(col[2]) <= top
    fan = re.search(r'\("size" ([\d.]+), "at" \[([\d.]+), ([\d.]+), 0\] with "rotate" \[0, 0, (\d+)\]', line)
    half, y, angle = float(fan[1]) / 2, float(fan[3]), math.radians(float(fan[4]))
    assert y - half * math.sin(angle) < rim and y + half * math.sin(angle) <= top
    cloud = re.search(r'an ash cloud centred at y ([\d.]+) \(top about y ([\d.]+)\)', line)
    assert float(cloud[1]) > rim and float(cloud[2]) <= top
