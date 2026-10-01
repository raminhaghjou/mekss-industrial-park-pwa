"""Recompute ../shared/anpr/crnn-prep.opencv.json from its stored inputs.

The NestJS engine (src/anpr/engines/crnn-prep.ts) and the on-device worker
(src/utils/iranPlateOcr/crnnPrep.js) re-implement ``prep_crnn`` without OpenCV
and are tested against this fixture. Run this after changing ``prep_crnn`` and
port the change to both re-implementations.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.pipeline.recognizer import prep_crnn  # noqa: E402

FIXTURE = ROOT.parent / "shared" / "anpr" / "crnn-prep.opencv.json"


def expected(fixture: dict) -> dict:
    out = {"generator": f"OpenCV {cv2.__version__} via mekss-anpr prep_crnn"}
    for key in ("small", "plate"):
        case = fixture[key]
        img = np.array(case["data"], np.uint8).reshape(case["h"], case["w"])
        out[key] = {**case, "prep": prep_crnn(img).flatten().tolist()}
    st = fixture["stage"]
    img = np.array(st["data"], np.uint8).reshape(st["h"], st["w"])
    out["stage"] = {
        "w": st["w"],
        "h": st["h"],
        "data": st["data"],
        "bilateral": cv2.bilateralFilter(img, 5, 45, 45).flatten().tolist(),
        "clahe": cv2.createCLAHE(2.0, (8, 8)).apply(img).flatten().tolist(),
        "gaussian": cv2.GaussianBlur(img, (0, 0), 1.0).flatten().tolist(),
        "cubic_40x60": cv2.resize(img, (60, 40), interpolation=cv2.INTER_CUBIC).flatten().tolist(),
        "area_20x8": cv2.resize(img, (20, 8), interpolation=cv2.INTER_AREA).flatten().tolist(),
        "area_40x8": cv2.resize(img, (40, 8), interpolation=cv2.INTER_AREA).flatten().tolist(),
    }
    return out


if __name__ == "__main__":
    data = expected(json.loads(FIXTURE.read_text(encoding="utf-8")))
    FIXTURE.write_text(json.dumps(data, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {FIXTURE}")
