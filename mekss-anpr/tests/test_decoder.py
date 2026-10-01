import numpy as np

from app.pipeline.decoder import constrained_beam_search, greedy_decode, merge_decodes
from tests.conftest import ctc_matrix


def test_decodes_clear_plate(labels):
    probs = ctc_matrix("12ب34567")
    result = constrained_beam_search(probs, labels)
    assert result.valid
    assert result.plate == "12ب34567"
    assert result.probability > 0.5
    assert len(result.char_confidences) == 8
    assert min(result.char_confidences) > 0.9


def test_repeated_characters_need_blank_separation(labels):
    probs = ctc_matrix("11ب22233")
    assert constrained_beam_search(probs, labels).plate == "11ب22233"


def test_grammar_rejects_extra_characters(labels):
    # Greedy reads a spurious 9th character; the constrained search must still yield a valid layout.
    probs = ctc_matrix("12ب345671", confidence=0.9)
    probs[-5:-1, labels.index("1")] = 0.3
    greedy, _ = greedy_decode(probs, labels)
    assert len(greedy) == 9
    result = constrained_beam_search(probs, labels)
    assert result.valid
    assert len(result.plate) == 8


def test_letter_position_only_accepts_letters(labels):
    # The model is unsure between the digit 5 and the letter ه at the letter slot.
    probs = ctc_matrix("12ه34567", alternatives={2: {"5": 0.5}})
    result = constrained_beam_search(probs, labels)
    assert result.plate[2] == "ه"


def test_ambiguous_glyph_is_reported_in_positions(labels):
    probs = ctc_matrix("12ب34567", alternatives={2: {"پ": 0.35}})
    result = constrained_beam_search(probs, labels)
    assert result.plate == "12ب34567"
    top = [entry["c"] for entry in result.positions[2]]
    assert top[:2] == ["ب", "پ"]
    assert result.char_confidences[2] < 0.9
    assert any(alt["plate"] == "12پ34567" for alt in result.alternatives)


def test_leading_zero_prior(labels):
    probs = ctc_matrix("12ب34567", alternatives={6: {"0": 0.45}})
    assert constrained_beam_search(probs, labels).plate[6] == "6"


def test_unreadable_returns_invalid(labels):
    blank = len(labels)
    probs = np.zeros((20, blank + 1))
    probs[:, blank] = 1.0
    result = constrained_beam_search(probs, labels)
    assert not result.valid
    assert result.plate == ""


def test_merge_prefers_consensus(labels):
    a = constrained_beam_search(ctc_matrix("12ب34567"), labels)
    b = constrained_beam_search(ctc_matrix("12ب34567", confidence=0.8), labels)
    c = constrained_beam_search(ctc_matrix("12پ34567", confidence=0.7), labels)
    merged = merge_decodes([a, b, c])
    assert merged.plate == "12ب34567"
    assert merged.valid
