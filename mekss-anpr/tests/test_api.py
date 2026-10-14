import threading
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import load_settings
from app.main import create_app
from app.pipeline.engine import ImageDecodeError, MODEL_FILES

ROOT = Path(__file__).resolve().parent.parent


class FakeEngine:
    model_version = "test"

    def __init__(self, block: threading.Event | None = None):
        self.block = block
        self.calls = 0
        self.modes: list[str] = []

    def warmup(self):
        pass

    def recognize(self, data: bytes, mode: str = "live") -> dict:
        self.calls += 1
        self.modes.append(mode)
        if data == b"bad":
            raise ImageDecodeError("unsupported or corrupt image")
        if self.block:
            self.block.wait(2)
        return {"ok": True, "engine": "python", "candidates": [{"plate": "12ب34567", "valid": True}]}


def client_for(engine=None, **overrides):
    settings = load_settings()
    if overrides:
        settings = settings.__class__(**{**settings.__dict__, **overrides})
    return TestClient(create_app(settings, engine))


def test_health_and_ready():
    with client_for(FakeEngine()) as client:
        assert client.get("/health").json() == {"status": "ok"}
        assert client.get("/ready").json()["status"] == "ready"


def test_recognize_returns_engine_payload():
    with client_for(FakeEngine()) as client:
        res = client.post("/v1/recognize", content=b"jpeg", headers={"Content-Type": "image/jpeg"})
        assert res.status_code == 200
        assert res.json()["candidates"][0]["plate"] == "12ب34567"


def test_forwards_photo_mode_to_the_engine():
    engine = FakeEngine()
    with client_for(engine) as client:
        assert client.post("/v1/recognize?mode=photo", content=b"jpeg").status_code == 200
        assert client.post("/v1/recognize", content=b"jpeg").status_code == 200
        assert client.post("/v1/recognize?mode=weird", content=b"jpeg").status_code == 200
    assert engine.modes == ["photo", "live", "live"]


def test_rejects_bad_and_oversized_images():
    with client_for(FakeEngine(), max_image_bytes=10) as client:
        assert client.post("/v1/recognize", content=b"bad").status_code == 400
        assert client.post("/v1/recognize", content=b"x" * 11).status_code == 413


def test_not_ready_without_models(tmp_path):
    with client_for(None, model_dir=tmp_path, bundled_model_dir=None) as client:
        assert client.get("/ready").status_code == 503
        assert client.post("/v1/recognize", content=b"jpeg").status_code == 503


def _touch_models(directory: Path, *names: str) -> None:
    directory.mkdir(parents=True, exist_ok=True)
    for name in names:
        (directory / name).write_bytes(b"x")


def test_resolves_missing_models_from_the_bundled_copy(tmp_path):
    from app.pipeline.engine import resolve_model_files

    volume = tmp_path / "volume"
    bundled = tmp_path / "image" / "bundled"
    _touch_models(volume, MODEL_FILES["detector"])
    _touch_models(bundled, MODEL_FILES["detector"], MODEL_FILES["recognizer"])
    _touch_models(bundled.parent, MODEL_FILES["labels"])
    settings = load_settings().__class__(**{**load_settings().__dict__, "model_dir": volume, "bundled_model_dir": bundled})

    files = resolve_model_files(settings)

    assert files["detector"] == volume / MODEL_FILES["detector"]
    assert files["recognizer"] == bundled / MODEL_FILES["recognizer"]
    assert files["labels"] == bundled.parent / MODEL_FILES["labels"]
    assert not files["detector_fallback"].exists()


def test_reports_every_missing_model(tmp_path):
    from app.pipeline.engine import ModelsMissingError, resolve_model_files

    settings = load_settings().__class__(**{**load_settings().__dict__, "model_dir": tmp_path, "bundled_model_dir": None})
    with pytest.raises(ModelsMissingError, match="ocr_crnn.onnx"):
        resolve_model_files(settings)


def test_unexpected_engine_failure_keeps_health_up(tmp_path, monkeypatch):
    import app.main as main_module

    def boom(_settings):
        raise RuntimeError("onnxruntime exploded")

    monkeypatch.setattr(main_module, "AnprEngine", boom)
    with client_for(None, model_dir=tmp_path) as client:
        assert client.get("/health").status_code == 200
        res = client.get("/ready")
        assert res.status_code == 503
        assert "onnxruntime exploded" in res.json()["error"]


def test_sheds_load_when_saturated():
    block = threading.Event()
    engine = FakeEngine(block)
    with client_for(engine, max_concurrency=1, max_queue=0) as client:
        results = []
        first = threading.Thread(target=lambda: results.append(client.post("/v1/recognize", content=b"a").status_code))
        first.start()
        for _ in range(50):
            if engine.calls:
                break
            threading.Event().wait(0.02)
        assert client.post("/v1/recognize", content=b"b").status_code == 503
        block.set()
        first.join()
        assert results == [200]


models_present = all((ROOT / "models" / MODEL_FILES[k]).exists() for k in ("detector", "recognizer", "labels"))


@pytest.mark.skipif(not models_present, reason="ONNX models not downloaded (python scripts/download_models.py)")
def test_real_engine_smoke():
    from app.pipeline.engine import AnprEngine

    engine = AnprEngine(load_settings())
    engine.warmup()
    import cv2
    import numpy as np

    ok, buf = cv2.imencode(".jpg", np.full((200, 640, 3), 255, np.uint8))
    result = engine.recognize(buf.tobytes())
    assert result["ok"] and "timings" in result
