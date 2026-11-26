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
    once(SHOW, "give the text action an \"until\" that is the first 1 to 6 words of the sentence where it should go away")
    once(SHOW, "3 or more unit numbers")
    once(SHOW, 'put one at "pos" "top" and the other at "pos" "middle"')
    once(SHOW, "has priority over a label when the limit of 2 overlays")
    once(SHOW, "every spoken number with a unit has a text kept until the idea changes")
    once(SHOW, "stays on screen until the idea changes, at least {{TEXT_SECONDS}} seconds (that minimum wins even if the scene moves on sooner")
    assert "a temperature, speed, distance, time" in SHOW and "a temperature, speed, distance, time" in BOARD


def test_unit_number_rules_in_storyboard_prompt():
    once(BOARD, "EVERY number with a unit")
    # the storyboard has no actions or styles: its text entry just carries the number and unit as "words"
    once(BOARD, 'gets a text entry whose "words" are the number and its unit')
    assert "style" not in BOARD.split("EVERY number with a unit")[1].split("Use []")[0]
    once(BOARD, "3 or more numbers with units")
    once(BOARD, "Keep it on screen until the idea changes, at least {{TEXT_SECONDS}} seconds (that minimum always wins")
    assert "plus 1" not in BOARD


def test_inside_a_prop_rules():
    once(SHOW, "To show something INSIDE a prop")
    once(SHOW, "exempt from BOTH size minimums (size 1 and size 0.6)")
    once(SHOW, "(same z, never nearer the camera)")
    once(BOARD, 'when the sentence says something happens "inside" a prop')


def test_wire_rules():
    once(SHOW, 'never both wires "to" the bulb')
    once(SHOW, "electrons leave the battery's negative (−) end")
    once(SHOW, '("arrow", "beam", "wire", "light_wave") have')
    once(SHOW, "beam, arrow or light_wave")
    once(BOARD, "Keep the same direction in every sentence that shows the loop")


def test_no_bullet_glued_onto_a_sentence():
    """A new bullet must start its own line: '.- ' or ':- ' inside a line means two bullets got fused."""
    for name, text in (("show", SHOW), ("storyboard", BOARD), ("script", SCRIPT), ("all", ALL_PROMPTS)):
        glued = [ln[:80] for ln in text.splitlines() if re.search(r'[.!?)"]- |:- ', ln)]
        assert not glued, (name, glued)
    assert any(ln.startswith('- "wire" is a stage-space cable') for ln in SHOW.splitlines())


def test_show_prompt_fills_the_text_seconds_number():
    filled = writer.show_system_prompt()
    assert "{{TEXT_SECONDS}}" not in filled
    assert f"at least {writer.TEXT_MIN_SECONDS:g} seconds (that minimum wins even if the scene moves on sooner" in filled


def test_one_video_recipes_are_gone():
    """No exact coordinates for the eruption, the battery circuit or the ocean bump; no prop quota."""
    for gone in ('ocean_lon', 'ocean_lat', '[0.27, 1.64, 0]', '[-0.8, 0, 0]', '"size" 1.6', '0.79 x', 'fill": 1.25',
                 '0.05 or lower', 'companion', 'z 0.9'):
        assert gone not in SHOW, gone
    for phrase in ('Beside a vehicle give a crate', 'cargo meant to be inside it', 'the bus front', 'An eruption starts at the hero',
                   'an ash cloud centred at y', 'rotate" [0, 0, 90]'):
        assert phrase not in SHOW, phrase
    assert 'rim at y' not in SHOW
    once(SHOW, "electrons leave the battery's negative (−) end")
    once(SHOW, 'Separate props never touch or overlap unless one is inside the other')
    once(SHOW, 'a clear gap')


def test_planet_surface_moon_note_lives_in_the_catalogue():
    cat = (writer.PROMPTS.parents[1] / "kit" / "catalog.json").read_text(encoding="utf-8")
    assert '\\"none\\" removes it' in cat and "companion" not in SHOW


def test_no_prop_quota():
    review = writer.read_prompt("storyboard_review_system.md")
    for name, text in (("show", SHOW), ("board", BOARD), ("review", review)):
        assert "supporting props" not in text.replace("do not ask for supporting props", ""), name
        assert "1 or 2 supporting" not in text, name
    ask = "Add a second prop only when the sentence names it or something visibly happens to it. A single hero alone is fine. Never add a prop the words do not name or clearly imply; stand-ins and the analogy's own objects are allowed."
    once(BOARD, ask)
    assert "Add a second prop only when the sentence names it" in SHOW


def test_storyboard_change_is_an_event():
    once(BOARD, "the visible EVENT on a named object")
    once(BOARD, "Do not let 3 sentences in a row show the same objects in the same state")
    once(BOARD, "An analogy gets its own picture.")
    assert "A glow or a needle alone" in BOARD


def test_review_checks_picture_matches_words():
    review = writer.read_prompt("storyboard_review_system.md")
    once(review, "(i) PICTURE MATCHES WORDS: for EACH sentence write what the words say and what the picture shows")
    assert "shows something the words do not mention" in review and "misses something the words name" in review



def test_catalogue_text_carries_the_relocated_facts():
    """The facts moved out of the show prompt reach the model through the catalogue notes."""
    from pipeline import catalog_text
    text = catalog_text.catalog_text()
    for fact in ("0.79 x its size tall", "The − end is at the base", "0.65 x its size high", "dark lens",
                 "opaque body", "never over the roof", "within about 14 degrees", "-7 or higher",
                 "frozen angle", "resets the angle to 0", "glow param at or below 0.05", "1.3 x the volcano height",
                 "set companion none", "0.2 x the vehicle size", "quarter of the hero size", "subject-small"):
        assert text.count(fact) == 1, fact
