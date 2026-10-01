# MEKSS ANPR service

Internal Iranian licence-plate recognition service (engine A for the guard panel's live scanner).
Only the NestJS backend talks to it; it is not exposed publicly.

Pipeline: decode → YOLO plate detector (ONNX, letterboxed) → corner refinement + perspective rectification
→ CRNN/CTC recogniser → grammar-constrained beam search (`2 digits + letter + 3 digits + 2-digit region`,
free-zone formats) → plate type from the letter and plate-face colour. When the merged read is invalid or
below 0.5 probability, rescue crops (Hough de-rotated text band, horizontally widened box) are read too
and replace it only if they decode more confidently. Output includes per-character
confidences and N-best alternatives so the backend can fuse frames and do confusable-aware matching.

## API

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/health` | liveness |
| `GET` | `/ready` | `503` until models are loaded and warmed up |
| `POST` | `/v1/recognize` | raw JPEG/PNG body (≤ `ANPR_MAX_IMAGE_BYTES`); `400` undecodable, `413` too large, `503` busy/not ready |

`/v1/recognize` returns `{ ok, engine: "python", modelVersion, image: { w, h }, candidates: [{ bbox, detConf,
plate, valid, confidence, charConfidences, positions, alternatives, plateType, color, colorConflict, raw,
partial, ... }], timings: { decodeMs, detectMs, ocrMs, totalMs } }`.
The service sheds load (`503 busy`) instead of queueing, so the backend fails over to its Node engine quickly.

## Models

Model files are listed with their checksums in `models/manifest.json`. The detectors are downloaded; the
recogniser is the Platrix CRNN fine-tuned on IR-LPR, committed under `models/bundled/` and copied from
there (IR-LPR test split: 81.3% → 92.6% plate accuracy, 99.0% when confidence ≥ 0.9). See
[`training/README.md`](training/README.md) for the benchmark, the GPL-3.0 dataset licence note, how to
reproduce it and how to revert to the original weights.

```bash
python scripts/download_models.py                      # into ./models (or $ANPR_MODEL_DIR)
python scripts/download_models.py --base-url https://mirror.internal/iran-plate   # air-gapped mirror
python scripts/download_models.py --pin                # record observed SHA-256 in the manifest
```

The same files serve engine B in the backend (`ANPR_MODEL_DIR`) and the on-device fallback in the PWA
(`npm run models:iran-plate`). In Docker Compose the container downloads them on first start into the
`anpr-models` volume, which the backend mounts read-only.

## Configuration

| Variable | Default | Meaning |
|----------|---------|---------|
| `ANPR_MODEL_DIR` | `./models` (`/models` in Docker) | model directory |
| `ANPR_MODEL_BASE_URL` | – | mirror for model downloads |
| `ANPR_WORKERS` | `2` | uvicorn worker processes |
| `ANPR_INTRA_THREADS` | cpu / workers (≤4) | ONNX Runtime threads per worker |
| `ANPR_MAX_CONCURRENCY` / `ANPR_MAX_QUEUE` | `2` / `8` | in-flight inferences per worker / waiting requests before `503` |
| `ANPR_DET_SIZE` / `ANPR_DET_FALLBACK_SIZE` | `416` / `640` | detector input; the larger size is tried when nothing is found |
| `ANPR_DET_CONF` / `ANPR_DET_IOU` | `0.25` / `0.45` | detector thresholds |
| `ANPR_TTA` | `true` | second recogniser pass on a slightly wider crop |
| `ANPR_BEAM_WIDTH` | `16` | constrained beam search width |
| `ANPR_MAX_SIDE` / `ANPR_MAX_IMAGE_BYTES` | `1920` / `2000000` | input limits |

## Development

```bash
python -m venv .venv && . .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
pytest                                          # grammar vectors, decoder, geometry/colour, API
uvicorn app.main:app --reload --port 8000
```

`tests/` do not need the model files; the grammar tests share `../shared/anpr/plate-grammar.vectors.json`
with the backend and frontend so all three normalise plates identically.

The backend's Node engine and the PWA's on-device worker re-implement `prep_crnn` without OpenCV
(`src/anpr/engines/crnn-prep.ts`, `src/utils/iranPlateOcr/crnnPrep.js`) and are tested against
`../shared/anpr/crnn-prep.opencv.json`. After changing `prep_crnn`, run
`python scripts/refresh_prep_fixture.py` and port the change to both; `tests/test_prep_fixture.py` fails
until the fixture is refreshed.

## Accuracy / latency evaluation

```bash
python scripts/evaluate.py /data/gate-plates                              # in-process
python scripts/evaluate.py /data/gate-plates --url http://localhost:8000  # against a running service
```

The dataset is a folder of images with `labels.csv` (`file,plate[,sequence]`) or files named
`12ب34567__whatever.jpg`. The report gives exact-plate and per-character accuracy, accuracy after
multi-frame voting per `sequence` (what the live scanner does), and p50/p95 latency. Collect a few hundred
frames from the actual gate cameras (day, night, rain, dirty plates) before trusting the ≥99% plate-level
target; per-frame accuracy is lower by design and the multi-frame lock plus guard confirmation covers the gap.
