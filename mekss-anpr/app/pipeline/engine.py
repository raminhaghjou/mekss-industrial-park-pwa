"""End-to-end plate recognition: decode → detect → rectify → read (TTA) → constrained decode."""

from __future__ import annotations

import re
import time
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np

from ..config import Settings
from .color import classify_plate_color, color_conflicts
from .decoder import DecodeResult, constrained_beam_search, merge_decodes
from .detector import Detection, YoloDetector
from .grammar import normalize_plate
from .recognizer import CrnnRecognizer, shift_variants
from .rectify import pad_box, rectify, rescue_crops

MODEL_FILES = {
    "detector": "plate_yolo.onnx",
    "detector_fallback": "plate_yolo_fallback.onnx",
    "recognizer": "ocr_crnn.onnx",
    "labels": "ocr_crnn.labels.json",
}

EARLY_EXIT_PROBABILITY = 0.9
RESCUE_BELOW_PROBABILITY = 0.5


class ModelsMissingError(RuntimeError):
    pass


class ImageDecodeError(ValueError):
    pass


@dataclass
class _Timer:
    start: float

    def lap(self) -> float:
        now = time.perf_counter()
        ms = (now - self.start) * 1000
        self.start = now
        return round(ms, 2)


def decode_image(data: bytes, max_side: int) -> np.ndarray:
    if not data:
        raise ImageDecodeError("empty image")
    arr = np.frombuffer(data, dtype=np.uint8)
    image = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if image is None:
        raise ImageDecodeError("unsupported or corrupt image")
    h, w = image.shape[:2]
    scale = max_side / max(h, w)
    if scale < 1:
        image = cv2.resize(image, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
    return image


def guided_boxes(shape: tuple[int, int]) -> list[Detection]:
    """When the detector finds nothing, trust the guard's framing inside the guide box."""
    h, w = shape
    aspect = w / max(h, 1)
    if 2.5 <= aspect <= 7.0:
        return [Detection(0, 0, w, h, 0.0, "guided")]
    bw, bh = int(w * 0.78), int(h * 0.22)
    return [Detection((w - bw) // 2, int(h * 0.39), bw, bh, 0.0, "guided")]


class AnprEngine:
    def __init__(self, settings: Settings) -> None:
        import onnxruntime as ort

        self.settings = settings
        model_dir = Path(settings.model_dir)
        missing = [
            name for key, name in MODEL_FILES.items() if key != "detector_fallback" and not (model_dir / name).exists()
        ]
        if missing:
            raise ModelsMissingError(f"missing model files in {model_dir}: {', '.join(missing)}")

        opts = ort.SessionOptions()
        opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        opts.intra_op_num_threads = settings.intra_threads
        opts.inter_op_num_threads = 1
        opts.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL

        self.detector = YoloDetector(
            model_dir / MODEL_FILES["detector"],
            model_dir / MODEL_FILES["detector_fallback"],
            settings.det_size,
            settings.det_fallback_size,
            settings.det_conf,
            settings.det_iou,
            opts,
        )
        self.recognizer = CrnnRecognizer(model_dir / MODEL_FILES["recognizer"], model_dir / MODEL_FILES["labels"], opts)
        self.model_version = self._model_version(model_dir)

    @staticmethod
    def _model_version(model_dir: Path) -> str:
        manifest = model_dir / "manifest.lock.json"
        if manifest.exists():
            import hashlib

            return hashlib.sha256(manifest.read_bytes()).hexdigest()[:12]
        return "unpinned"

    def warmup(self) -> None:
        dummy = np.full((180, 640, 3), 200, dtype=np.uint8)
        cv2.putText(dummy, "12 B 345 67", (40, 120), cv2.FONT_HERSHEY_SIMPLEX, 2.2, (0, 0, 0), 5)
        ok, buf = cv2.imencode(".jpg", dummy)
        if ok:
            self.recognize(buf.tobytes())

    def _read_detection(self, image: np.ndarray, det: Detection) -> dict:
        tight = image[det.y : det.y + det.h, det.x : det.x + det.w]
        px, py, pw, ph = pad_box(det.x, det.y, det.w, det.h, image.shape[:2], 0.12)
        padded = image[py : py + ph, px : px + pw]
        rectified, method = rectify(padded)

        crops = [tight]
        if rectified is not None:
            crops.append(rectified)
        if self.settings.tta:
            crops.extend(shift_variants(tight))

        probs = self.recognizer.probabilities(crops)
        labels = self.recognizer.labels
        decodes: list[DecodeResult] = [
            constrained_beam_search(p, labels, beam_width=self.settings.beam_width) for p in probs
        ]
        merged = merge_decodes(decodes) or decodes[0]
        if not merged.valid or merged.probability < RESCUE_BELOW_PROBABILITY:
            extra = rescue_crops(image, (det.x, det.y, det.w, det.h))
            rescued = [
                constrained_beam_search(p, labels, beam_width=self.settings.beam_width)
                for p in self.recognizer.probabilities(extra)
            ]
            best = max((r for r in rescued if r.valid), key=lambda r: r.probability, default=None)
            if best is not None and best.probability > (merged.probability if merged.valid else 0.0):
                agreeing = [r for r in rescued + decodes if r.valid and r.plate == best.plate]
                merged = merge_decodes(agreeing) or best
                crops.extend(extra)
        color = classify_plate_color(rectified if rectified is not None else tight)

        normalized = normalize_plate(merged.plate) if merged.valid else None
        plate_type = normalized.plate_type if normalized and normalized.valid else None
        partial = None
        if not merged.valid:
            digits = re.sub(r"\D", "", merged.raw)
            if len(digits) == 5 and digits == merged.raw:
                plate_type = "FREE_ZONE"
                partial = {"number": digits}

        return {
            "bbox": det.as_dict(),
            "detConf": round(det.conf, 4),
            "source": det.source,
            "rectification": method,
            "variants": len(crops),
            "color": color,
            "plateType": plate_type,
            "colorConflict": color_conflicts(color, plate_type),
            "plate": normalized.plate if normalized and normalized.valid else "",
            "valid": bool(normalized and normalized.valid),
            "confidence": round(merged.probability, 5),
            "charConfidences": [round(c, 4) for c in merged.char_confidences],
            "positions": merged.positions,
            "alternatives": merged.alternatives,
            "raw": merged.raw,
            "rawConfidence": round(merged.raw_confidence, 4),
            "partial": partial,
        }

    def recognize(self, data: bytes) -> dict:
        timer = _Timer(time.perf_counter())
        total_start = timer.start
        image = decode_image(data, self.settings.max_side)
        decode_ms = timer.lap()

        detections = self.detector.detect(image)
        if not detections:
            detections = guided_boxes(image.shape[:2])
        detect_ms = timer.lap()

        candidates: list[dict] = []
        for det in detections[: self.settings.max_candidates]:
            cand = self._read_detection(image, det)
            candidates.append(cand)
            if cand["valid"] and cand["confidence"] >= EARLY_EXIT_PROBABILITY:
                break
        ocr_ms = timer.lap()

        candidates.sort(key=lambda c: (c["valid"], c["confidence"] * (0.5 + 0.5 * min(1.0, c["detConf"] * 2))), reverse=True)
        return {
            "ok": True,
            "engine": "python",
            "modelVersion": self.model_version,
            "image": {"w": int(image.shape[1]), "h": int(image.shape[0])},
            "candidates": candidates,
            "timings": {
                "decodeMs": decode_ms,
                "detectMs": detect_ms,
                "ocrMs": ocr_ms,
                "totalMs": round((time.perf_counter() - total_start) * 1000, 2),
            },
        }
