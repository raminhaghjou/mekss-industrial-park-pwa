"""MEKSS ANPR inference service (internal; only NestJS talks to it)."""

from __future__ import annotations

import asyncio
import logging
import os
from contextlib import asynccontextmanager
from typing import Protocol

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool

from .config import Settings, load_settings
from .pipeline.engine import AnprEngine, ImageDecodeError, ModelsMissingError

logger = logging.getLogger("mekss.anpr")
logging.basicConfig(level=os.environ.get("LOG_LEVEL", "INFO").upper())


class Engine(Protocol):
    model_version: str

    def recognize(self, data: bytes) -> dict: ...

    def warmup(self) -> None: ...


class InferenceGate:
    """Bounded concurrency: shed load quickly so the backend can fail over instead of queueing."""

    def __init__(self, concurrency: int, max_queue: int) -> None:
        self._sem = asyncio.Semaphore(max(1, concurrency))
        self._waiting = 0
        self._max_queue = max(0, max_queue)

    async def __aenter__(self):
        if self._sem.locked() and self._waiting >= self._max_queue:
            raise HTTPException(status_code=503, detail="busy")
        self._waiting += 1
        try:
            await self._sem.acquire()
        finally:
            self._waiting -= 1
        return self

    async def __aexit__(self, *exc):
        self._sem.release()


def create_app(settings: Settings | None = None, engine: Engine | None = None) -> FastAPI:
    settings = settings or load_settings()
    state: dict = {"engine": engine, "ready": engine is not None, "error": None}

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        if state["engine"] is None:
            try:
                eng = await run_in_threadpool(AnprEngine, settings)
                await run_in_threadpool(eng.warmup)
                state["engine"] = eng
                state["ready"] = True
                logger.info("ANPR engine ready (model %s)", eng.model_version)
            except ModelsMissingError as exc:
                state["error"] = str(exc)
                logger.error("ANPR engine not ready: %s", exc)
        yield

    app = FastAPI(title="MEKSS ANPR", version="1.0.0", lifespan=lifespan, docs_url=None, redoc_url=None)
    gate = InferenceGate(settings.max_concurrency, settings.max_queue)

    @app.get("/health")
    async def health():
        return {"status": "ok"}

    @app.get("/ready")
    async def ready():
        if not state["ready"]:
            return JSONResponse({"status": "not_ready", "error": state["error"]}, status_code=503)
        return {"status": "ready", "modelVersion": state["engine"].model_version}

    @app.post("/v1/recognize")
    async def recognize(request: Request):
        eng = state["engine"]
        if eng is None:
            raise HTTPException(status_code=503, detail=state["error"] or "engine not ready")
        length = request.headers.get("content-length")
        if length and int(length) > settings.max_image_bytes:
            raise HTTPException(status_code=413, detail="image too large")
        body = await request.body()
        if len(body) > settings.max_image_bytes:
            raise HTTPException(status_code=413, detail="image too large")
        async with gate:
            try:
                return await run_in_threadpool(eng.recognize, body)
            except ImageDecodeError as exc:
                raise HTTPException(status_code=400, detail=str(exc)) from exc

    return app


app = create_app()
