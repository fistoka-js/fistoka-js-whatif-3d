"""Plain text checks that the writer prompts still carry the remake rules (hook delivery, unit-number
texts, particles inside a prop). Each phrase must appear exactly once in its file, so deleting a rule
breaks a test. No network."""
from pipeline import writer

SHOW = writer.read_prompt("show_system.md")
BOARD = writer.read_prompt("storyboard_system.md")
SCRIPT = writer.read_prompt("script_system.md")


def once(text, phrase):
    assert text.count(phrase) == 1, phrase


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
    once(SHOW, '("arrow", "beam", "wire", "light_wave") have')
    once(SHOW, "beam, arrow or light_wave")
    once(BOARD, "Keep the same direction in every sentence that shows the loop")


def test_show_prompt_fills_the_text_seconds_number():
    filled = writer.show_system_prompt()
    assert "{{TEXT_SECONDS}}" not in filled
    assert f"less than {writer.TEXT_MIN_SECONDS:g} seconds after the text appears" in filled
