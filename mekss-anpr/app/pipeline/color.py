"""Plate background colour classification (HSV), used as a plate-type hint."""

from __future__ import annotations

import cv2
import numpy as np

COLOR_TYPE_HINTS: dict[str, tuple[str, ...]] = {
    "yellow": ("TAXI", "PUBLIC"),
    "red": ("GOVERNMENT",),
    "green": ("POLICE", "MILITARY"),
    "blue": ("MILITARY", "OTHER"),
    "white": ("PRIVATE", "DISABLED", "AGRICULTURAL", "FREE_ZONE", "OTHER"),
}


def classify_plate_color(crop: np.ndarray) -> str:
    if crop is None or crop.ndim != 3 or crop.size == 0:
        return "unknown"
    h, w = crop.shape[:2]
    # Skip the blue "I.R. IRAN" strip on the left and the plate borders.
    body = crop[int(h * 0.15) : int(h * 0.85), int(w * 0.14) : int(w * 0.95)]
    if body.size == 0:
        return "unknown"
    hsv = cv2.cvtColor(body, cv2.COLOR_BGR2HSV).reshape(-1, 3).astype(np.float32)
    # The background covers most of the body on every plate type (characters are dark on
    # white/yellow plates but white on red/green/blue ones), so whole-body medians describe it.
    sat = float(np.median(hsv[:, 1]))
    val = float(np.median(hsv[:, 2]))
    # Bright pastel = white plate under a colour cast (shade, sodium lights).
    colored = sat >= 90 or (sat >= 55 and val <= 200)
    if not colored:
        return "white" if val > 110 else "unknown"
    hue = hsv[hsv[:, 1] >= 55, 0]
    if hue.size == 0:
        return "unknown"
    # Vote over hue bins instead of a median: red wraps around 0/180.
    bins = {
        "yellow": (hue >= 15) & (hue <= 38),
        "red": (hue < 9) | (hue > 165),
        "green": (hue >= 40) & (hue <= 88),
        "blue": (hue >= 90) & (hue <= 130),
    }
    name, mask = max(bins.items(), key=lambda kv: int(kv[1].sum()))
    return name if mask.sum() > 0.5 * hue.size else "unknown"


def color_conflicts(color: str, plate_type: str | None) -> bool:
    if not plate_type or color == "unknown":
        return False
    hints = COLOR_TYPE_HINTS.get(color)
    return bool(hints) and plate_type not in hints
