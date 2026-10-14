FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    ANPR_MODEL_DIR=/models \
    ANPR_FETCH_OPTIONAL=0 \
    ANPR_WORKERS=2

RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 dumb-init curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 1001 mekss \
    && useradd --uid 1001 --gid mekss --no-create-home --shell /usr/sbin/nologin mekss

WORKDIR /srv
COPY requirements.txt ./
RUN pip install -r requirements.txt

COPY app ./app
COPY scripts ./scripts
COPY models/manifest.json models/ocr_crnn.labels.json ./models/
COPY models/bundled ./models/bundled

RUN mkdir -p /models && cp models/ocr_crnn.labels.json /models/ && chown -R mekss:mekss /models

# The entrypoint starts as root only to repair the ownership of the shared model volume,
# then drops to uid 1001 before syncing models and serving.
EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=3s --start-period=30s --retries=6 \
  CMD curl -fsS http://127.0.0.1:8000/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["python", "scripts/entrypoint.py"]

LABEL org.opencontainers.image.title="MEKSS ANPR" \
      org.opencontainers.image.description="Iranian licence plate recognition service (OpenCV + ONNX Runtime)"
