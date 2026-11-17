"""The script length (165 to 180 words) is written in several prompts. They must agree: the shorten
prompt once kept the old 150 to 175 numbers. Plain text checks, no network."""
from pathlib import Path

from pipeline import writer


def test_shorten_prompt_carries_current_length():
    shorten = writer.read_prompt("shorten_user.md")
    assert "165 to 180 word length" in shorten
    assert "under 165" in shorten
    assert "150" not in shorten and "175" not in shorten


def test_script_prompt_carries_current_length():
    assert "165 to 180" in writer.read_prompt("script_system.md")


def test_script_prompt_has_aim_and_fast_read():
    script = writer.read_prompt("script_system.md")
    assert "aim for about 172" in script
    assert "a fast read is about 3.45" in script


def test_writer_doc_carries_current_length():
    doc = (Path(writer.__file__).parent.parent / "docs" / "WRITER.md").read_text(encoding="utf-8")
    assert "165-180 words" in doc
    assert "a fast read of 165 words stays near 48 s" in doc


def test_writer_shorten_text_carries_current_length():
    src = Path(writer.__file__).read_text(encoding="utf-8")
    assert "wins over the 165 to 180 word length" in src
    assert "wins over the 165-word floor" in src
    assert "150 to 175" not in src
