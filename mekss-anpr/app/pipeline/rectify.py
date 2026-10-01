"""Plate crop geometry: padding, perspective rectification and deskew."""

from __future__ import annotations

import cv2
import numpy as np

# Iranian plates are 52 x 11.5 cm.
PLATE_ASPECT = 52.0 / 11.5


def pad_box(x: int, y: int, w: int, h: int, shape: tuple[int, int], frac: float) -> tuple[int, int, int, int]:
    H, W = shape
    px, py = int(round(w * frac)), int(round(h * frac))
    x1, y1 = max(0, x - px), max(0, y - py)
    x2, y2 = min(W, x + w + px), min(H, y + h + py)
    return x1, y1, x2 - x1, y2 - y1


def _order_corners(pts: np.ndarray) -> np.ndarray:
    pts = pts.reshape(4, 2).astype(np.float32)
    s = pts.sum(axis=1)
    d = np.diff(pts, axis=1).ravel()
    return np.array(
        [pts[np.argmin(s)], pts[np.argmin(d)], pts[np.argmax(s)], pts[np.argmax(d)]],
        dtype=np.float32,
    )


def find_plate_quad(crop: np.ndarray) -> np.ndarray | None:
    """Locate the plate's four corners inside a (padded) detection crop."""
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY) if crop.ndim == 3 else crop
    h, w = gray.shape[:2]
    if h < 12 or w < 40:
        return None
    blur = cv2.bilateralFilter(gray, 7, 40, 40)
    edges = cv2.Canny(blur, 40, 120)
    edges = cv2.dilate(edges, np.ones((3, 3), np.uint8), iterations=1)
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    # A perspective-skewed plate fills well under half of its padded axis-aligned crop.
    min_area = 0.2 * h * w
    best = None
    best_area = 0.0
    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < min_area:
            continue
        peri = cv2.arcLength(cnt, True)
        approx = cv2.approxPolyDP(cnt, 0.03 * peri, True)
        if len(approx) != 4 or not cv2.isContourConvex(approx):
            continue
        quad = _order_corners(approx)
        width = (np.linalg.norm(quad[1] - quad[0]) + np.linalg.norm(quad[2] - quad[3])) / 2
        height = (np.linalg.norm(quad[3] - quad[0]) + np.linalg.norm(quad[2] - quad[1])) / 2
        if height <= 0:
            continue
        aspect = width / height
        if not 2.8 <= aspect <= 6.5:
            continue
        if area > best_area:
            best, best_area = quad, area
    return best


def warp_quad(crop: np.ndarray, quad: np.ndarray, out_height: int = 64) -> np.ndarray:
    out_w = int(round(out_height * PLATE_ASPECT))
    dst = np.array([[0, 0], [out_w - 1, 0], [out_w - 1, out_height - 1], [0, out_height - 1]], dtype=np.float32)
    M = cv2.getPerspectiveTransform(quad, dst)
    return cv2.warpPerspective(crop, M, (out_w, out_height), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)


def deskew(crop: np.ndarray) -> np.ndarray | None:
    """Rotate the crop so text rows are horizontal, using the dominant stroke angle."""
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY) if crop.ndim == 3 else crop
    _, th = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    coords = cv2.findNonZero(th)
    if coords is None or len(coords) < 50:
        return None
    (_, _), (rw, rh), angle = cv2.minAreaRect(coords)
    if rw < rh:
        angle -= 90
    if angle > 45:
        angle -= 90
    elif angle < -45:
        angle += 90
    if abs(angle) < 1.5 or abs(angle) > 20:
        return None
    h, w = gray.shape[:2]
    M = cv2.getRotationMatrix2D((w / 2, h / 2), angle, 1.0)
    return cv2.warpAffine(crop, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)


def estimate_tilt(crop: np.ndarray, max_angle: float = 25.0) -> float | None:
    """Dominant near-horizontal edge angle (degrees, image coordinates) from the plate's long borders."""
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY) if crop.ndim == 3 else crop
    h, w = gray.shape[:2]
    if h < 12 or w < 30:
        return None
    edges = cv2.Canny(cv2.GaussianBlur(gray, (3, 3), 0), 50, 150)
    lines = cv2.HoughLinesP(edges, 1, np.pi / 180, threshold=max(12, w // 6), minLineLength=max(15, w // 3), maxLineGap=4)
    if lines is None:
        return None
    angles, weights = [], []
    for x1, y1, x2, y2 in lines[:, 0]:
        if x2 == x1:
            continue
        angle = float(np.degrees(np.arctan2(y2 - y1, x2 - x1)))
        if angle > 90:
            angle -= 180
        elif angle < -90:
            angle += 180
        if abs(angle) <= max_angle:
            angles.append(angle)
            weights.append(float(np.hypot(x2 - x1, y2 - y1)))
    if not angles:
        return None
    order = np.argsort(angles)
    cum = np.cumsum(np.asarray(weights)[order])
    return float(np.asarray(angles)[order][np.searchsorted(cum, cum[-1] / 2)])


def text_band(crop: np.ndarray) -> np.ndarray:
    """Trim a roughly level plate crop to the rows/columns that carry character strokes."""
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY) if crop.ndim == 3 else crop
    h, w = gray.shape[:2]
    gx = np.abs(cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3))
    rows = cv2.GaussianBlur(gx.sum(axis=1).reshape(-1, 1), (1, 5), 0).ravel()
    if rows.max() <= 0:
        return crop
    on = rows >= 0.45 * rows.max()
    best, start = (0, h), None
    best_len = 0
    for y, flag in enumerate(np.append(on, False)):
        if flag and start is None:
            start = y
        elif not flag and start is not None:
            if y - start > best_len:
                best, best_len = (start, y), y - start
            start = None
    y1, y2 = best
    band_h = y2 - y1
    if band_h < 6:
        return crop
    y1, y2 = max(0, int(y1 - 0.25 * band_h)), min(h, int(y2 + 0.25 * band_h))
    cols = gx[y1:y2].sum(axis=0)
    xs = np.nonzero(cols >= 0.12 * cols.max())[0]
    x1, x2 = (int(xs[0]), int(xs[-1]) + 1) if len(xs) else (0, w)
    pad = int(0.03 * (x2 - x1))
    x1, x2 = max(0, x1 - pad), min(w, x2 + pad)
    if x2 - x1 < 2.0 * (y2 - y1):
        return crop[y1:y2]
    return crop[y1:y2, x1:x2]


def rotate_level(crop: np.ndarray, angle: float) -> np.ndarray:
    h, w = crop.shape[:2]
    M = cv2.getRotationMatrix2D((w / 2, h / 2), angle, 1.0)
    return cv2.warpAffine(crop, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)


def rescue_crops(image: np.ndarray, box: tuple[int, int, int, int]) -> list[np.ndarray]:
    """Extra geometric hypotheses for a weak read: de-rotated text band and a widened box."""
    x, y, w, h = box
    H, W = image.shape[:2]
    out: list[np.ndarray] = []
    px, py, pw, ph = pad_box(x, y, w, h, (H, W), 0.2)
    padded = image[py : py + ph, px : px + pw]
    angle = estimate_tilt(padded)
    if angle is not None and abs(angle) >= 2.0:
        out.append(text_band(rotate_level(padded, angle)))
    elif w / max(h, 1) < 2.8:
        for a in (-12.0, 12.0):
            out.append(text_band(rotate_level(padded, a)))
    wx1, wx2 = max(0, x - int(0.35 * w)), min(W, x + w + int(0.35 * w))
    wide = image[y : y + h, wx1:wx2]
    if wide.shape[1] > w:
        out.append(text_band(wide))
    return [c for c in out if c.shape[0] >= 8 and c.shape[1] >= 24]


def rectify(crop: np.ndarray) -> tuple[np.ndarray | None, str]:
    quad = find_plate_quad(crop)
    if quad is not None:
        return warp_quad(crop, quad), "perspective"
    rotated = deskew(crop)
    if rotated is not None:
        return rotated, "deskew"
    return None, "none"
