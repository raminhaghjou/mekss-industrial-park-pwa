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

    def warmup(self):
        pass

    def recognize(self, data: bytes) -> dict:
        self.calls += 1
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


def test_rejects_bad_and_oversized_images():
    with client_for(FakeEngine(), max_image_bytes=10) as client:
        assert client.post("/v1/recognize", content=b"bad").status_code == 400
        assert client.post("/v1/recognize", content=b"x" * 11).status_code == 413


def test_not_ready_without_models(tmp_path):
    with client_for(None, model_dir=tmp_path) as client:
        assert client.get("/ready").status_code == 503
        assert client.post("/v1/recognize", content=b"jpeg").status_code == 503


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
