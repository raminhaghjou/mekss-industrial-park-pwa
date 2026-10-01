import json
import sys
from pathlib import Path

import numpy as np
import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

LABELS = json.loads((ROOT / "models" / "ocr_crnn.labels.json").read_text(encoding="utf-8"))
VECTORS = json.loads((ROOT.parent / "shared" / "anpr" / "plate-grammar.vectors.json").read_text(encoding="utf-8"))


def ctc_matrix(text: str, confidence: float = 0.96, frames_per_char: int = 3, alternatives: dict | None = None) -> np.ndarray:
    """Build a T x (C+1) probability matrix whose best CTC path spells ``text``.

    ``alternatives`` maps a character index in ``text`` to ``{char: prob}`` to model
    ambiguous glyphs.
    """
    blank = len(LABELS)
    rows = []
    alternatives = alternatives or {}

    def row(dist: dict[int, float]) -> np.ndarray:
        r = np.full(blank + 1, 1e-6, dtype=np.float64)
        for idx, p in dist.items():
            r[idx] = p
        rest = 1.0 - sum(dist.values())
        r[blank] += max(rest, 0.0)
        return r / r.sum()

    rows.append(row({blank: 0.99}))
    for i, ch in enumerate(text):
        dist = {LABELS.index(ch): confidence}
        for alt, p in alternatives.get(i, {}).items():
            dist = {LABELS.index(ch): confidence - p, LABELS.index(alt): p}
        for _ in range(frames_per_char):
            rows.append(row(dist))
        rows.append(row({blank: 0.99}))
    return np.stack(rows)


@pytest.fixture
def labels():
    return LABELS


@pytest.fixture
def vectors():
    return VECTORS
