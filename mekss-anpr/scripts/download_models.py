#!/usr/bin/env python3
"""Download the ANPR ONNX models into the model directory and verify SHA-256.

The base URL can point to any mirror (MinIO bucket, internal nginx, ...) because
HuggingFace is often unreachable from Iranian servers:

    ANPR_MODEL_BASE_URL=https://minio.internal/models/iran-plate python scripts/download_models.py

``--pin`` writes the observed hashes back into ``models/manifest.json`` so later
downloads from any mirror are verified against them. Files with a ``bundled`` path in the
manifest ship inside this repository and are copied (and verified) instead of downloaded.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import sys
import tempfile
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "models" / "manifest.json"


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def download(url: str, dest: Path, timeout: float) -> None:
    req = urllib.request.Request(url, headers={"User-Agent": "mekss-anpr-model-fetch/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as res, tempfile.NamedTemporaryFile(
        delete=False, dir=dest.parent, suffix=".part"
    ) as tmp:
        shutil.copyfileobj(res, tmp)
        tmp_path = Path(tmp.name)
    tmp_path.replace(dest)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default=os.environ.get("ANPR_MODEL_DIR", str(ROOT / "models")))
    parser.add_argument("--base-url", default=os.environ.get("ANPR_MODEL_BASE_URL"))
    parser.add_argument("--timeout", type=float, default=120)
    parser.add_argument("--pin", action="store_true", help="record observed hashes in manifest.json")
    parser.add_argument("--force", action="store_true", help="re-download files that already verify")
    args = parser.parse_args()

    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    base = (args.base_url or manifest["source"]).rstrip("/")
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    lock: dict[str, str] = {}
    failures = 0
    for name, meta in manifest["files"].items():
        dest = out / name
        expected = meta.get("sha256")
        if dest.exists() and not args.force and (expected is None or sha256_file(dest) == expected):
            lock[name] = sha256_file(dest)
            print(f"ok       {name} (cached)")
            continue
        bundled = ROOT / "models" / meta["bundled"] if meta.get("bundled") else None
        if bundled is not None and bundled.exists():
            print(f"copy     {bundled.relative_to(ROOT)}")
            shutil.copy2(bundled, dest)
        elif name.endswith(".labels.json") and (ROOT / "models" / name).exists() and out != ROOT / "models":
            shutil.copy2(ROOT / "models" / name, dest)
        else:
            url = f"{base}/{name}"
            try:
                print(f"fetch    {url}")
                download(url, dest, args.timeout)
            except Exception as exc:  # noqa: BLE001
                level = "ERROR" if meta.get("required") else "skip"
                print(f"{level:8} {name}: {exc}", file=sys.stderr)
                failures += 1 if meta.get("required") else 0
                continue
        digest = sha256_file(dest)
        if expected and digest != expected:
            dest.unlink(missing_ok=True)
            print(f"ERROR    {name}: sha256 mismatch ({digest} != {expected})", file=sys.stderr)
            failures += 1
            continue
        lock[name] = digest
        print(f"ok       {name} {dest.stat().st_size / 1e6:.1f} MB sha256={digest[:16]}…")

    (out / "manifest.lock.json").write_text(json.dumps(lock, indent=2), encoding="utf-8")
    if args.pin:
        for name, digest in lock.items():
            manifest["files"][name]["sha256"] = digest
        MANIFEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print("pinned hashes in", MANIFEST)
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
