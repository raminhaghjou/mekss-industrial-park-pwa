from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, default))
    except ValueError:
        return default


def _env_float(name: str, default: float) -> float:
    try:
        return float(os.environ.get(name, default))
    except ValueError:
        return default


def _env_bool(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    model_dir: Path
    det_conf: float
    det_iou: float
    det_size: int
    det_fallback_size: int
    max_candidates: int
    tta: bool
    beam_width: int
    intra_threads: int
    max_image_bytes: int
    max_side: int
    max_concurrency: int
    max_queue: int


def load_settings() -> Settings:
    cpu = os.cpu_count() or 2
    return Settings(
        model_dir=Path(os.environ.get("ANPR_MODEL_DIR", Path(__file__).resolve().parent.parent / "models")),
        det_conf=_env_float("ANPR_DET_CONF", 0.25),
        det_iou=_env_float("ANPR_DET_IOU", 0.45),
        det_size=_env_int("ANPR_DET_SIZE", 416),
        det_fallback_size=_env_int("ANPR_DET_FALLBACK_SIZE", 640),
        max_candidates=_env_int("ANPR_MAX_CANDIDATES", 3),
        tta=_env_bool("ANPR_TTA", True),
        beam_width=_env_int("ANPR_BEAM_WIDTH", 16),
        intra_threads=_env_int("ANPR_INTRA_THREADS", max(1, min(4, cpu // max(1, _env_int("ANPR_WORKERS", 2))))),
        max_image_bytes=_env_int("ANPR_MAX_IMAGE_BYTES", 2_000_000),
        max_side=_env_int("ANPR_MAX_SIDE", 1920),
        max_concurrency=_env_int("ANPR_MAX_CONCURRENCY", 2),
        max_queue=_env_int("ANPR_MAX_QUEUE", 8),
    )
