#!/usr/bin/env python3
"""Accuracy / latency report for the ANPR pipeline on a labelled image set.

Dataset layout (either):
  * ``labels.csv`` with columns ``file,plate[,sequence]`` next to the images, or
  * file names like ``12ب34567__anything.jpg`` (label before the double underscore).

``sequence`` groups frames of the same vehicle; the report then also shows accuracy
after confidence-weighted multi-frame voting, which is what the live scanner does.

    python scripts/evaluate.py /data/gate-plates
    python scripts/evaluate.py /data/gate-plates --url http://localhost:8000
"""

from __future__ import annotations

import argparse
import csv
import json
import statistics
import sys
import time
import urllib.request
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app.pipeline.grammar import normalize_plate  # noqa: E402

IMAGE_EXT = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


def load_dataset(folder: Path) -> list[tuple[Path, str, str | None]]:
    items: list[tuple[Path, str, str | None]] = []
    csv_path = folder / "labels.csv"
    if csv_path.exists():
        with csv_path.open(encoding="utf-8") as fh:
            for row in csv.DictReader(fh):
                label = normalize_plate(row["plate"]).plate or row["plate"]
                items.append((folder / row["file"], label, row.get("sequence") or None))
        return items
    for path in sorted(folder.iterdir()):
        if path.suffix.lower() in IMAGE_EXT and "__" in path.stem:
            label = normalize_plate(path.stem.split("__", 1)[0]).plate
            if label:
                items.append((path, label, None))
    return items


def make_runner(url: str | None):
    if url:
        endpoint = url.rstrip("/") + "/v1/recognize"

        def run(data: bytes) -> dict:
            req = urllib.request.Request(endpoint, data=data, headers={"Content-Type": "image/jpeg"})
            with urllib.request.urlopen(req, timeout=30) as res:
                return json.loads(res.read())

        return run

    from app.config import load_settings
    from app.pipeline.engine import AnprEngine

    engine = AnprEngine(load_settings())
    engine.warmup()
    return engine.recognize


def char_accuracy(pred: str, truth: str) -> tuple[int, int]:
    if len(pred) != len(truth):
        return 0, len(truth)
    return sum(a == b for a, b in zip(pred, truth)), len(truth)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("dataset", type=Path)
    parser.add_argument("--url", help="evaluate a running service instead of the in-process engine")
    parser.add_argument("--json", type=Path, help="write the full report as JSON")
    args = parser.parse_args()
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    items = load_dataset(args.dataset)
    if not items:
        print("no labelled images found", file=sys.stderr)
        return 2
    run = make_runner(args.url)

    latencies: list[float] = []
    correct = top5 = read = 0
    char_ok = char_total = 0
    confusions: Counter[tuple[str, str]] = Counter()
    per_sequence: dict[str, list[tuple[str, float]]] = defaultdict(list)
    seq_truth: dict[str, str] = {}
    failures: list[dict] = []

    for path, truth, seq in items:
        data = path.read_bytes()
        t0 = time.perf_counter()
        result = run(data)
        latencies.append((time.perf_counter() - t0) * 1000)
        best = next((c for c in result.get("candidates", []) if c.get("valid")), None)
        pred = best["plate"] if best else ""
        conf = best["confidence"] if best else 0.0
        if pred:
            read += 1
        if pred == truth:
            correct += 1
        else:
            failures.append({"file": path.name, "truth": truth, "pred": pred, "confidence": conf})
            if len(pred) == len(truth):
                for a, b in zip(truth, pred):
                    if a != b:
                        confusions[(a, b)] += 1
        if best and any(alt["plate"] == truth for alt in best.get("alternatives", [])):
            top5 += 1
        ok, total = char_accuracy(pred, truth)
        char_ok += ok
        char_total += total
        if seq:
            per_sequence[seq].append((pred, conf))
            seq_truth[seq] = truth

    n = len(items)
    report = {
        "images": n,
        "plateAccuracy": round(correct / n, 4),
        "top5Accuracy": round(top5 / n, 4),
        "readRate": round(read / n, 4),
        "charAccuracy": round(char_ok / max(char_total, 1), 4),
        "latencyMs": {
            "p50": round(statistics.median(latencies), 1),
            "p95": round(sorted(latencies)[max(0, int(0.95 * n) - 1)], 1),
            "max": round(max(latencies), 1),
        },
        "topConfusions": [{"truth": a, "pred": b, "count": c} for (a, b), c in confusions.most_common(15)],
        "failures": failures[:50],
    }
    if per_sequence:
        fused_ok = 0
        for seq, reads in per_sequence.items():
            votes: Counter[str] = Counter()
            for pred, conf in reads:
                if pred:
                    votes[pred] += conf
            fused = votes.most_common(1)[0][0] if votes else ""
            fused_ok += fused == seq_truth[seq]
        report["sequences"] = len(per_sequence)
        report["fusedSequenceAccuracy"] = round(fused_ok / len(per_sequence), 4)

    print(json.dumps({k: v for k, v in report.items() if k != "failures"}, ensure_ascii=False, indent=2))
    if args.json:
        args.json.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
