"""Benchmark the full reader (rectification, TTA, rescue, constrained beam search) on IR-LPR plate crops.

    ANPR_MODEL_DIR=models python training/evaluate_irlpr.py DATA/test --out report.json

The crop is used as the detection, so this measures the reader only; ``scripts/evaluate.py``
measures the whole pipeline on gate-camera frames.
"""

from __future__ import annotations

import argparse
import collections
import json
import sys
import time
from pathlib import Path

import cv2

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
sys.path.insert(0, str(HERE))

from app.config import load_settings  # noqa: E402
from app.pipeline.detector import Detection  # noqa: E402
from app.pipeline.engine import AnprEngine  # noqa: E402
from irlpr import iter_split  # noqa: E402


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("root")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--stride", type=int, default=1)
    ap.add_argument("--out", default="")
    args = ap.parse_args()

    engine = AnprEngine(load_settings())
    items = list(iter_split(Path(args.root)))[:: args.stride]
    if args.limit:
        items = items[: args.limit]

    ok = 0
    pos_err: collections.Counter = collections.Counter()
    confusions: collections.Counter = collections.Counter()
    conf_bins = collections.defaultdict(lambda: [0, 0])
    failures = []
    t0 = time.perf_counter()
    for path, lab in items:
        img = cv2.imread(str(path))
        h, w = img.shape[:2]
        cand = engine._read_detection(img, Detection(0, 0, w, h, 1.0, "crop"))
        pred = cand["plate"]
        good = pred == lab
        ok += good
        b = min(9, int(cand["confidence"] * 10))
        conf_bins[b][0] += 1
        conf_bins[b][1] += good
        if not good:
            failures.append({"file": path.name, "label": lab, "pred": pred, "conf": cand["confidence"]})
            if len(pred) == 8:
                for i, (a, c) in enumerate(zip(lab, pred)):
                    if a != c:
                        pos_err[i] += 1
                        confusions[f"{a}->{c}"] += 1
    n = len(items)
    summary = {
        "n": n,
        "plateAccuracy": round(ok / max(n, 1), 4),
        "msPerPlate": round((time.perf_counter() - t0) * 1000 / max(n, 1), 1),
        "positionErrors": dict(sorted(pos_err.items())),
        "topConfusions": confusions.most_common(25),
        "accuracyByConfidence": {f"{k / 10:.1f}": f"{v[1]}/{v[0]}" for k, v in sorted(conf_bins.items())},
    }
    if args.out:
        Path(args.out).write_text(
            json.dumps({"summary": summary, "failures": failures}, ensure_ascii=False, indent=1), encoding="utf-8"
        )
    sys.stdout.reconfigure(encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
