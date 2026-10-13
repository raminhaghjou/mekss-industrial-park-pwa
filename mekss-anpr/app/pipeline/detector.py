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


def merge_detections(dets: list[Detection], iou_threshold: float) -> list[Detection]:
    """Global NMS over detections gathered from several scales / tiles."""
    if len(dets) < 2:
        return list(dets)
    boxes = np.array([[d.x, d.y, d.x + d.w, d.y + d.h] for d in dets], dtype=np.float32)
    scores = np.array([d.conf for d in dets], dtype=np.float32)
    return [dets[i] for i in nms(boxes, scores, iou_threshold)]


def tile_windows(width: int, height: int, fraction: float = 0.62) -> list[tuple[int, int, int, int]]:
    """2x2 overlapping windows (x, y, w, h) covering the image; small plates become large in each tile."""
    tw, th = max(1, int(width * fraction)), max(1, int(height * fraction))
    xs = sorted({0, width - tw})
    ys = sorted({0, height - th})
    return [(x, y, tw, th) for y in ys for x in xs]


class YoloDetector:
    """
    The bundled ``plate_yolo.onnx`` has a dynamic input, so the same weights run at several scales:
    live frames try 416 then 640; still photos try 640, 960 and finally overlapping tiles, which is
    what finds a plate that only covers a few percent of a full-scene phone photo.
    """

    def __init__(
        self,
        primary: Path,
        fallback: Path | None,
        size: int,
        fallback_size: int,
        conf: float,
        iou: float,
        session_options,
        photo_conf: float | None = None,
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
        self.photo_conf = photo_conf if photo_conf is not None else min(conf, 0.15)
        self.iou = iou

    def _sizes(self, preferred: list[int]) -> list[int]:
        if self.fixed_size:
            return [self.fixed_size]
        return list(dict.fromkeys(preferred))

    def _run(
        self, session, input_name: str, image: np.ndarray, size: int, source: str, conf: float | None = None
    ) -> list[Detection]:
        blob, ratio, pad = letterbox(image, size)
        out = session.run(None, {input_name: blob[None]})[0]
        dets = decode_yolo(out, ratio, pad, image.shape[:2], self.conf if conf is None else conf, self.iou)
        for d in dets:
            d.source = source
        return dets

    def _tiles(self, image: np.ndarray, size: int, conf: float) -> list[Detection]:
        h, w = image.shape[:2]
        if max(h, w) < 800:
            return []
        found: list[Detection] = []
        for x, y, tw, th in tile_windows(w, h):
            crop = image[y : y + th, x : x + tw]
            for d in self._run(self.session, self.input_name, crop, size, "yolo-tile", conf):
                found.append(Detection(d.x + x, d.y + y, d.w, d.h, d.conf, "yolo-tile"))
        return merge_detections(found, self.iou)

    def detect(self, image: np.ndarray, mode: str = "live") -> list[Detection]:
        if mode == "photo":
            dets: list[Detection] = []
            for size in self._sizes([640, 960]):
                dets = self._run(self.session, self.input_name, image, size, f"yolo-{size}", self.photo_conf)
                if dets:
                    break
            if not dets:
                dets = self._tiles(image, self.fixed_size or 640, self.photo_conf)
        else:
            dets = []
            for size in self._sizes([self.size, 640]):
                dets = self._run(self.session, self.input_name, image, size, "yolo")
                if dets:
                    break
        # The second detector only runs for still photos: in live mode most frames legitimately have no
        # plate, and running a third model on each of them would triple the cost of an empty frame.
        if not dets and mode == "photo" and self.fallback is not None:
            dets = self._run(self.fallback, self.fallback_input, image, self.fallback_size, "yolo-fallback", self.photo_conf)
        dets.sort(key=lambda d: d.conf, reverse=True)
        return dets


def _fixed_square(session) -> int | None:
    shape = session.get_inputs()[0].shape
    if len(shape) == 4 and isinstance(shape[2], int) and isinstance(shape[3], int) and shape[2] == shape[3]:
        return int(shape[2])
    return None
