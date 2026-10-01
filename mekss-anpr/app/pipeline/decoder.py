"""CTC decoding for the Platrix CRNN.

``constrained_beam_search`` is a CTC prefix beam search that only lets prefixes grow
along the Iranian plate grammar (``D D L D D D D D``). It returns the N-best complete
plates with their CTC label probabilities, and per-position character marginals that
downstream multi-frame fusion and the gate-pass matcher consume.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

import numpy as np

from .grammar import (
    LETTER_TYPES,
    STANDARD_LAYOUT,
    position_prior,
    region_prior,
)

_NEG_INF = -math.inf


def softmax(logits: np.ndarray) -> np.ndarray:
    x = logits - logits.max(axis=1, keepdims=True)
    e = np.exp(x)
    return e / e.sum(axis=1, keepdims=True)


def greedy_decode(probs: np.ndarray, labels: list[str]) -> tuple[str, float]:
    blank = len(labels)
    idx = probs.argmax(axis=1)
    chars: list[str] = []
    confs: list[float] = []
    prev = -1
    for t, i in enumerate(idx):
        i = int(i)
        if i != blank and i != prev and i < len(labels):
            chars.append(labels[i])
            confs.append(float(probs[t, i]))
        prev = i
    return "".join(chars), (float(np.mean(confs)) if confs else 0.0)


def _logsumexp(a: float, b: float) -> float:
    if a == _NEG_INF:
        return b
    if b == _NEG_INF:
        return a
    m = max(a, b)
    return m + math.log(math.exp(a - m) + math.exp(b - m))


@dataclass
class DecodeResult:
    plate: str
    probability: float
    char_confidences: list[float]
    positions: list[list[dict]]
    alternatives: list[dict]
    raw: str
    raw_confidence: float
    valid: bool = field(default=False)

    def as_dict(self) -> dict:
        return {
            "plate": self.plate,
            "probability": round(self.probability, 5),
            "charConfidences": [round(c, 4) for c in self.char_confidences],
            "positions": self.positions,
            "alternatives": self.alternatives,
            "raw": self.raw,
            "rawConfidence": round(self.raw_confidence, 4),
            "valid": self.valid,
        }


def _allowed_ids(labels: list[str]) -> list[set[int]]:
    digit_ids = {i for i, ch in enumerate(labels) if ch.isdigit()}
    letter_ids = {i for i, ch in enumerate(labels) if ch in LETTER_TYPES}
    return [digit_ids if kind == "digit" else letter_ids for kind in STANDARD_LAYOUT]


def constrained_beam_search(
    probs: np.ndarray,
    labels: list[str],
    beam_width: int = 16,
    nbest: int = 5,
    prune: float = 1e-4,
) -> DecodeResult:
    """Grammar-constrained CTC prefix beam search over a ``T x (C+1)`` probability matrix."""
    blank = len(labels)
    allowed = _allowed_ids(labels)
    target_len = len(STANDARD_LAYOUT)
    log_probs = np.log(np.clip(probs, 1e-12, 1.0))
    raw, raw_conf = greedy_decode(probs, labels)

    # prefix -> (log p ending in blank, log p ending in non-blank)
    beams: dict[tuple[int, ...], tuple[float, float]] = {(): (0.0, _NEG_INF)}

    for t in range(probs.shape[0]):
        row = probs[t]
        lrow = log_probs[t]
        candidates = [c for c in np.nonzero(row > prune)[0].tolist() if c != blank]
        next_beams: dict[tuple[int, ...], list[float]] = {}

        def add(prefix: tuple[int, ...], pb: float, pnb: float) -> None:
            cur = next_beams.get(prefix)
            if cur is None:
                next_beams[prefix] = [pb, pnb]
            else:
                cur[0] = _logsumexp(cur[0], pb)
                cur[1] = _logsumexp(cur[1], pnb)

        for prefix, (pb, pnb) in beams.items():
            total = _logsumexp(pb, pnb)
            add(prefix, total + lrow[blank], _NEG_INF)
            if prefix:
                last = prefix[-1]
                add(prefix, _NEG_INF, pnb + lrow[last])
            pos = len(prefix)
            if pos >= target_len:
                continue
            for c in candidates:
                if c not in allowed[pos]:
                    continue
                new_prefix = prefix + (c,)
                if prefix and c == prefix[-1]:
                    add(new_prefix, _NEG_INF, pb + lrow[c])
                else:
                    add(new_prefix, _NEG_INF, total + lrow[c])

        ranked = sorted(next_beams.items(), key=lambda kv: _logsumexp(kv[1][0], kv[1][1]), reverse=True)
        beams = {k: (v[0], v[1]) for k, v in ranked[:beam_width]}

    finals: list[tuple[str, float]] = []
    for prefix, (pb, pnb) in beams.items():
        if len(prefix) != target_len:
            continue
        text = "".join(labels[i] for i in prefix)
        score = _logsumexp(pb, pnb)
        prior = 1.0
        for pos, ch in enumerate(text):
            prior *= position_prior(pos, ch)
        prior *= region_prior(text[6:8])
        finals.append((text, score + math.log(prior)))

    if not finals:
        return DecodeResult("", 0.0, [], [], [], raw, raw_conf, valid=False)

    finals.sort(key=lambda kv: kv[1], reverse=True)
    finals = finals[: max(nbest, 1) * 2]
    abs_probs = [math.exp(s) for _, s in finals]
    mass = sum(abs_probs) or 1.0
    weights = [p / mass for p in abs_probs]

    positions: list[list[dict]] = []
    char_conf: list[float] = []
    best_text = finals[0][0]
    for pos in range(target_len):
        dist: dict[str, float] = {}
        for (text, _), w in zip(finals, weights):
            dist[text[pos]] = dist.get(text[pos], 0.0) + w
        top = sorted(dist.items(), key=lambda kv: kv[1], reverse=True)[:3]
        positions.append([{"c": ch, "p": round(p, 4)} for ch, p in top])
        char_conf.append(dist.get(best_text[pos], 0.0))

    alternatives = [
        {"plate": text, "p": round(w, 4)} for (text, _), w in zip(finals[:nbest], weights[:nbest])
    ]
    probability = min(1.0, abs_probs[0])
    return DecodeResult(best_text, probability, char_conf, positions, alternatives, raw, raw_conf, valid=True)


def merge_decodes(results: list[DecodeResult]) -> DecodeResult | None:
    """Label-level ensemble of several decodes of the same plate (test-time augmentation).

    Each variant votes with its N-best distribution scaled by its own CTC probability, so a
    sharp rectified crop outweighs a blurry shifted one. Per-position marginals are
    recomputed from the pooled distribution.
    """
    valid = [r for r in results if r.valid and r.alternatives]
    if not valid:
        return results[0] if results else None
    if len(valid) == 1:
        return valid[0]

    pooled: dict[str, float] = {}
    for r in valid:
        for alt in r.alternatives:
            pooled[alt["plate"]] = pooled.get(alt["plate"], 0.0) + alt["p"] * max(r.probability, 1e-6)
    total = sum(pooled.values()) or 1.0
    ranked = sorted(((k, v / total) for k, v in pooled.items()), key=lambda kv: kv[1], reverse=True)
    best = ranked[0][0]

    positions: list[list[dict]] = []
    char_conf: list[float] = []
    for pos in range(len(best)):
        dist: dict[str, float] = {}
        for plate, w in ranked:
            if len(plate) == len(best):
                dist[plate[pos]] = dist.get(plate[pos], 0.0) + w
        top = sorted(dist.items(), key=lambda kv: kv[1], reverse=True)[:3]
        positions.append([{"c": ch, "p": round(p, 4)} for ch, p in top])
        char_conf.append(dist.get(best[pos], 0.0))

    supporting = [r.probability for r in valid if r.plate == best]
    probability = float(np.mean(supporting)) * (len(supporting) / len(valid)) if supporting else ranked[0][1]
    anchor = max(valid, key=lambda r: r.probability)
    return DecodeResult(
        best,
        probability,
        char_conf,
        positions,
        [{"plate": k, "p": round(v, 4)} for k, v in ranked[:5]],
        anchor.raw,
        anchor.raw_confidence,
        valid=True,
    )
