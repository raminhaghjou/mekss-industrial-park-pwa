#!/usr/bin/env python3
"""Container entrypoint: repair the model volume, drop root, sync models, then serve.

Starts as root only so a model volume created by an older image (or owned by another
uid) is made writable for the service user; everything after that runs unprivileged.
A model sync failure never blocks startup: the engine falls back to the models
bundled in the image.
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

SERVICE_UID = int(os.environ.get("ANPR_UID", "1001"))
SERVICE_GID = int(os.environ.get("ANPR_GID", "1001"))
ROOT = Path(__file__).resolve().parent.parent


def log(message: str) -> None:
    print(f"[entrypoint] {message}", flush=True)


def repair_model_dir(model_dir: Path) -> None:
    model_dir.mkdir(parents=True, exist_ok=True)
    repaired = 0
    for current, dirs, files in os.walk(model_dir):
        for path in [current, *(os.path.join(current, name) for name in dirs + files)]:
            try:
                stat = os.lstat(path)
                if (stat.st_uid, stat.st_gid) != (SERVICE_UID, SERVICE_GID):
                    os.lchown(path, SERVICE_UID, SERVICE_GID)
                    repaired += 1
            except OSError as exc:
                log(f"cannot fix ownership of {path}: {exc}")
    if repaired:
        log(f"fixed ownership of {repaired} path(s) in {model_dir}")


def drop_privileges() -> None:
    os.setgroups([])
    os.setgid(SERVICE_GID)
    os.setuid(SERVICE_UID)


def main() -> int:
    model_dir = Path(os.environ.get("ANPR_MODEL_DIR", "/models"))
    if os.geteuid() == 0:
        try:
            repair_model_dir(model_dir)
        except OSError as exc:
            log(f"model directory {model_dir} could not be prepared: {exc}")
        drop_privileges()

    sync = subprocess.run([sys.executable, str(ROOT / "scripts" / "download_models.py"), "--out", str(model_dir)], check=False)
    if sync.returncode != 0:
        log("model sync incomplete; the engine will use the models bundled in the image")

    workers = os.environ.get("ANPR_WORKERS", "2")
    os.execvp(
        "uvicorn",
        ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", workers, "--no-access-log"],
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
