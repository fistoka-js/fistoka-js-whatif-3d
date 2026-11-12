"""Word alignment with FAKE Edge events (no network)."""
import pytest

from pipeline.voice import AlignmentError, align_words, word_stats


def fake(*texts):
    """Edge-like events: 0.3 s per word, 0.1 s gap."""
    return [{"text": t, "start": i * 0.4, "end": i * 0.4 + 0.3} for i, t in enumerate(texts)]


def texts(words):
    return [w["text"] for w in words]


def test_punctuation_comes_from_script():
    w = align_words("What if the ocean. That's it!", fake("What", "if", "the", "ocean", "That's", "it"))
    assert texts(w) == ["What", "if", "the", "ocean.", "That's", "it!"]
    assert w[0]["start"] == 0.0 and w[0]["end"] == 0.3


def test_contractions_and_quotes():
    w = align_words('He said "don\'t" and it\'s fine', fake("He", "said", "don't", "and", "it's", "fine"))
    assert texts(w) == ["He", "said", '"don\'t"', "and", "it's", "fine"]


def test_number_with_decimal_and_comma():
    w = align_words("About 3.5 or 10,000 years", fake("About", "3.5", "or", "10,000", "years"))
    assert texts(w) == ["About", "3.5", "or", "10,000", "years"]


def test_number_split_by_edge():
    w = align_words("Over 10,000 years", fake("Over", "10", "000", "years"))
    assert texts(w) == ["Over", "10,000", "years"]
    assert w[1]["start"] == 0.4 and w[1]["end"] == 1.1  # spans both Edge words


def test_hyphenated_word_split_and_merged():
    split = align_words("by two-thirds today", fake("by", "two", "thirds", "today"))
    merged = align_words("by two-thirds today", fake("by", "two-thirds", "today"))
    assert texts(split) == texts(merged) == ["by", "two-thirds", "today"]


def test_dash_attaches_to_previous_word():
    w = align_words("At first — nothing.", fake("At", "first", "nothing"))
    assert texts(w) == ["At", "first —", "nothing."]
    w2 = align_words("At first -- nothing.", fake("At", "first", "nothing"))
    assert texts(w2) == ["At", "first --", "nothing."]


def test_glued_dash_between_words():
    # "first—nothing" is one script token; Edge reports two words.
    w = align_words("At first—nothing here", fake("At", "first", "nothing", "here"))
    assert texts(w) == ["At", "first—nothing", "here"]


def test_ellipsis():
    w = align_words("tilt starts to wobble... and go", fake("tilt", "starts", "to", "wobble", "and", "go"))
    assert texts(w) == ["tilt", "starts", "to", "wobble...", "and", "go"]
    w2 = align_words("wobble ... and go", fake("wobble", "and", "go"))
    assert texts(w2) == ["wobble ...", "and", "go"]


def test_edge_punctuation_only_events_are_ignored():
    w = align_words("Hi there.", fake("Hi", ".", "there"))
    assert texts(w) == ["Hi", "there."]


def test_one_edge_word_covers_two_tokens():
    w = align_words("e mail now", fake("email", "now"))
    assert texts(w) == ["e", "mail", "now"]
    assert w[0]["end"] <= w[1]["start"] + 1e-9


def test_case_and_accents_ignored():
    w = align_words("Café OPEN", fake("cafe", "open"))
    assert texts(w) == ["Café", "OPEN"]


def test_leading_symbol_joins_next_word():
    w = align_words("— Wow", fake("Wow"))
    assert texts(w) == ["— Wow"]


def test_rounding_to_three_decimals():
    w = align_words("a", [{"text": "a", "start": 0.123456, "end": 0.98765}])
    assert w == [{"text": "a", "start": 0.123, "end": 0.988}]


def test_mismatch_raises_with_both_sequences():
    with pytest.raises(AlignmentError) as e:
        align_words("The moon is big", fake("The", "mune", "is", "big"))
    msg = str(e.value)
    assert "[[moon]]" in msg and "[[mune]]" in msg and "script:" in msg and "edge" in msg


def test_extra_and_missing_words_raise():
    with pytest.raises(AlignmentError):
        align_words("one two", fake("one", "two", "three"))
    with pytest.raises(AlignmentError):
        align_words("one two three", fake("one", "two"))


def test_word_stats():
    w = align_words("a b c", [{"text": "a", "start": 0, "end": 0.5},
                              {"text": "b", "start": 1.5, "end": 2.0},
                              {"text": "c", "start": 2.0, "end": 3.0}])
    st = word_stats(w, 3.2)
    assert st["word_count"] == 3 and st["longest_pause"] == 1.0
    assert st["duration"] == 3.2 and st["words_per_second"] == 1.0
