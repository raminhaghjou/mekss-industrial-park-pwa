"""YOLOv8 plate detector (Platrix ``plate_yolo.onnx`` + optional fallback model).

Pre/post-processing mirrors the reference Platrix implementation (letterbox with 114
padding, cxcywh → xyxy, NMS) so detections match what the models were trained on.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np


@dataclass
class Detection:
    x: int
    y: int
    w: int
    h: int
    conf: float
    source: str = "yolo"

    def as_dict(self) -> dict:
        return {"x": self.x, "y": self.y, "w": self.w, "h": self.h}


def letterbox(image: np.ndarray, size: int) -> tuple[np.ndarray, float, tuple[float, float]]:
    h, w = image.shape[:2]
    ratio = min(size / h, size / w)
    nh, nw = int(round(h * ratio)), int(round(w * ratio))
    resized = cv2.resize(image, (nw, nh), interpolation=cv2.INTER_LINEAR)
    canvas = np.full((size, size, 3), 114, dtype=np.uint8)
    dw, dh = (size - nw) / 2, (size - nh) / 2
    top, left = int(round(dh - 0.1)), int(round(dw - 0.1))
    canvas[top : top + nh, left : left + nw] = resized
    rgb = cv2.cvtColor(canvas, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
    return np.transpose(rgb, (2, 0, 1)), ratio, (float(left), float(top))


def nms(boxes: np.ndarray, scores: np.ndarray, iou_threshold: float) -> list[int]:
    x1, y1, x2, y2 = boxes[:, 0], boxes[:, 1], boxes[:, 2], boxes[:, 3]
    areas = (x2 - x1) * (y2 - y1)
    order = scores.argsort()[::-1]
    keep: list[int] = []
    while order.size > 0:
        i = int(order[0])
        keep.append(i)
        xx1 = np.maximum(x1[i], x1[order[1:]])
        yy1 = np.maximum(y1[i], y1[order[1:]])
        xx2 = np.minimum(x2[i], x2[order[1:]])
        yy2 = np.minimum(y2[i], y2[order[1:]])
        inter = np.maximum(0.0, xx2 - xx1) * np.maximum(0.0, yy2 - yy1)
        iou = inter / (areas[i] + areas[order[1:]] - inter + 1e-9)
        order = order[1:][iou <= iou_threshold]
    return keep


def decode_yolo(
    output: np.ndarray,
    ratio: float,
    pad: tuple[float, float],
    image_shape: tuple[int, int],
    conf_threshold: float,
    iou_threshold: float,
) -> list[Detection]:
    preds = np.squeeze(output, 0).T  # (N, 4 + nc)
    boxes = preds[:, :4]
    scores = preds[:, 4:].max(axis=1)
    keep = scores > conf_threshold
    boxes, scores = boxes[keep], scores[keep]
    if len(boxes) == 0:
        return []
    h0, w0 = image_shape
    dw, dh = pad
    xyxy = np.empty_like(boxes)
    xyxy[:, 0] = (boxes[:, 0] - boxes[:, 2] / 2 - dw) / ratio
    xyxy[:, 1] = (boxes[:, 1] - boxes[:, 3] / 2 - dh) / ratio
    xyxy[:, 2] = (boxes[:, 0] + boxes[:, 2] / 2 - dw) / ratio
    xyxy[:, 3] = (boxes[:, 1] + boxes[:, 3] / 2 - dh) / ratio
    out: list[Detection] = []
    for i in nms(xyxy, scores, iou_threshold):
        x1, y1, x2, y2 = xyxy[i]
        x1, y1 = max(int(x1), 0), max(int(y1), 0)
        x2, y2 = min(int(x2), w0), min(int(y2), h0)
        if x2 - x1 <= 2 or y2 - y1 <= 2:
            continue
        out.append(Detection(x1, y1, x2 - x1, y2 - y1, float(scores[i])))
    return out


class YoloDetector:
    def __init__(
        self,
        primary: Path,
        fallback: Path | None,
        size: int,
        fallback_size: int,
        conf: float,
        iou: float,
        session_options,
    ) -> None:
        import onnxruntime as ort

        providers = ["CPUExecutionProvider"]
        self.session = ort.InferenceSession(str(primary), sess_options=session_options, providers=providers)
        self.input_name = self.session.get_inputs()[0].name
        self.fixed_size = _fixed_square(self.session)
        self.fallback = None
        if fallback is not None and fallback.exists():
            self.fallback = ort.InferenceSession(str(fallback), sess_options=session_options, providers=providers)
            self.fallback_input = self.fallback.get_inputs()[0].name
        self.size = self.fixed_size or size
        self.fallback_size = (_fixed_square(self.fallback) if self.fallback else None) or fallback_size
        self.conf = conf
        self.iou = iou

    def _run(self, session, input_name: str, image: np.ndarray, size: int, source: str) -> list[Detection]:
        blob, ratio, pad = letterbox(image, size)
        out = session.run(None, {input_name: blob[None]})[0]
        dets = decode_yolo(out, ratio, pad, image.shape[:2], self.conf, self.iou)
        for d in dets:
            d.source = source
        return dets

    def detect(self, image: np.ndarray) -> list[Detection]:
        dets = self._run(self.session, self.input_name, image, self.size, "yolo")
        if not dets and self.fallback is not None:
            dets = self._run(self.fallback, self.fallback_input, image, self.fallback_size, "yolo-fallback")
        dets.sort(key=lambda d: d.conf, reverse=True)
        return dets


def _fixed_square(session) -> int | None:
    shape = session.get_inputs()[0].shape
    if len(shape) == 4 and isinstance(shape[2], int) and isinstance(shape[3], int) and shape[2] == shape[3]:
        return int(shape[2])
    return None
