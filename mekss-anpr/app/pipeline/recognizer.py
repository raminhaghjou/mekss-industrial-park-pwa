"""Platrix CRNN whole-plate reader with test-time augmentation."""

from __future__ import annotations

import json
from pathlib import Path

import cv2
import numpy as np

from .decoder import softmax

IMG_W, IMG_H = 128, 32

_CRNN_CLAHE = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))


def prep_crnn(img: np.ndarray, size: tuple[int, int] = (IMG_W, IMG_H)) -> np.ndarray:
    """Platrix CRNN preprocessing; must stay identical to the model's training transform."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if img.ndim == 3 else img
    h, w = gray.shape[:2]
    if h < 40:
        scale = 40.0 / h
        gray = cv2.resize(gray, (max(int(w * scale), 1), 40), interpolation=cv2.INTER_CUBIC)
    gray = cv2.bilateralFilter(gray, 5, 45, 45)
    gray = _CRNN_CLAHE.apply(gray)
    blurred = cv2.GaussianBlur(gray, (0, 0), 1.0)
    gray = cv2.addWeighted(gray, 1.4, blurred, -0.4, 0)
    return cv2.resize(gray, size, interpolation=cv2.INTER_AREA)


def shift_variants(crop: np.ndarray, frac: float = 0.03) -> list[np.ndarray]:
    """Slightly tighter and looser crops to cancel detector box jitter."""
    h, w = crop.shape[:2]
    dx, dy = max(1, int(round(w * frac))), max(1, int(round(h * frac)))
    variants = []
    if w > 4 * dx and h > 4 * dy:
        variants.append(crop[dy : h - dy, dx : w - dx])
    variants.append(cv2.copyMakeBorder(crop, dy, dy, dx, dx, cv2.BORDER_REPLICATE))
    return variants


class CrnnRecognizer:
    def __init__(self, model: Path, labels: Path, session_options) -> None:
        import onnxruntime as ort

        self.session = ort.InferenceSession(str(model), sess_options=session_options, providers=["CPUExecutionProvider"])
        self.input_name = self.session.get_inputs()[0].name
        batch_dim = self.session.get_inputs()[0].shape[0]
        self.batchable = not isinstance(batch_dim, int) or batch_dim != 1
        self.labels: list[str] = json.loads(labels.read_text(encoding="utf-8"))

    def probabilities(self, crops: list[np.ndarray]) -> list[np.ndarray]:
        """Return one ``T x (C+1)`` softmax matrix per crop."""
        if not crops:
            return []
        batch = np.stack([prep_crnn(c).astype(np.float32) / 255.0 for c in crops])[:, None, :, :]
        if self.batchable:
            logits = self.session.run(None, {self.input_name: batch})[0]
            return [softmax(l) for l in logits]
        out = []
        for i in range(batch.shape[0]):
            logits = self.session.run(None, {self.input_name: batch[i : i + 1]})[0][0]
            out.append(softmax(logits))
        return out
