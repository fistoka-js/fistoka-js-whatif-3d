"""The script length (180 to 195 words) is written in several prompts. They must agree: the shorten
prompt once kept the old 150 to 175 numbers. Plain text checks, no network."""
from pathlib import Path

from pipeline import writer


def test_shorten_prompt_carries_current_length():
    shorten = writer.read_prompt("shorten_user.md")
    assert "180 to 195 word length" in shorten
    assert "never below {{FLOOR}} words" in shorten
    assert writer.WORD_FLOOR == 180
    for old in ("150", "175", "165", "185"):
        assert old not in shorten


def test_script_prompt_carries_current_length():
    script = writer.read_prompt("script_system.md")
    assert "180 to 195" in script
    assert "165" not in script and "185 to 200" not in script


def test_script_prompt_has_aim_and_fast_read():
    script = writer.read_prompt("script_system.md")
    assert "aim for about 186" in script
    assert "a fast read is about 3.45" in script
    assert "before 60 seconds" in script


def test_script_prompt_requires_comment_line():
    script = writer.read_prompt("script_system.md")
    assert "CLOSE (required)" in script and "Comment your answer below." in script


def test_writer_shorten_text_carries_current_length():
    src = Path(writer.__file__).read_text(encoding="utf-8")
    assert "wins over the 180 to 195 word length" in src
    assert "never below the 180-word floor" in src
    assert "150 to 175" not in src


ROOT = Path(writer.__file__).parent.parent


def _text(*parts):
    return (ROOT.joinpath(*parts)).read_text(encoding="utf-8")


def test_the_real_numbers_are_in_every_prompt_and_doc():
    floor = str(writer.WORD_FLOOR)
    assert floor == "180" and writer.DEFAULTS["max_seconds"] == 60.0
    script, shorten = _text("pipeline", "prompts", "script_system.md"), _text("pipeline", "prompts", "shorten_user.md")
    doc = _text("docs", "WRITER.md")
    assert "180 to 195 words" in script and "aim for about 186" in script and "before 60 seconds" in script
    assert "180 to 195 word length" in shorten and "{{FLOOR}}" in shorten
    assert "180-195 words" in doc and f"never below {floor} words" in doc and "62 s" in doc


def test_the_old_length_numbers_are_gone_everywhere_they_were_written():
    # Whole files. docs/KNOWN-PROBLEMS.md may quote the old chameleon figure "165 words, 60.6 s" as history.
    for parts in (("pipeline", "prompts", "script_system.md"), ("pipeline", "prompts", "shorten_user.md"),
                  ("docs", "WRITER.md"), ("README.md",), ("docs", "KNOWN-PROBLEMS.md"), ("docs", "QA.md"),
                  ("pipeline", "prompts", "examples", "chameleon", "notes.md")):
        text = _text(*parts).replace("165 words, 60.6 s", "")
        for old in ("165", "172", "185 to 200", "185-200", "165-180", "165 to 180", "165-word", "55 seconds",
                    "55 s show", "runs 61 s", "at 60 s or less"):
            assert old not in text, (parts, old)


def test_the_tail_is_the_same_in_the_engine_and_the_writer():
    import re
    from pipeline import fallback
    js = _text("kit", "engine", "show.js")
    found = re.search(r"DEFAULT_TAIL\s*=\s*([0-9.]+)", js)
    assert found, "show.js has no DEFAULT_TAIL constant"
    assert float(found.group(1)) == fallback.TAIL == writer.TAIL_SECONDS
