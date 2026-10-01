# Recogniser fine-tuning

`models/bundled/ocr_crnn.onnx` is the Platrix CRNN (MIT, sha256 `45f8c45f…fb1e`) fine-tuned on the
[IR-LPR](https://github.com/mut-deep/IR-LPR) plate split. Same architecture, labels and I/O
(`input` [B,1,32,128] → `logits` [B,31,33]), so all three engines (mekss-anpr, the NestJS fail-over
engine and the PWA's on-device worker) load it unchanged. `scripts/download_models.py` and the PWA's
`npm run models:iran-plate` copy it from the repo instead of downloading the original.

## Results

IR-LPR test split (5,009 plate crops, reader only — the crop is the detection, full reader with
rectification, TTA, rescue crops and constrained beam search):

| Model | Plate accuracy | Accuracy when confidence ≥ 0.9 |
|-------|----------------|--------------------------------|
| Platrix original | 81.3% | 98.8% (2,638 / 2,670) |
| Platrix original + rescue crops | 86.7% | 98.5% (2,896 / 2,939) |
| Fine-tuned + rescue crops (bundled) | **92.6%** | **99.0% (3,523 / 3,559)** |

Validation greedy accuracy went from 77.6% to 91.4% after 6 epochs. The ten real gate photos used for
regression testing are still all read correctly. Part of the remaining test errors are annotation
mistakes in IR-LPR itself (e.g. region `۷۳` labelled `72`), so the real figure is slightly higher.
Per-frame accuracy is not the lock criterion: the live scanner only locks after multi-frame fusion
agrees at ≥ 0.97, and the guard confirms the result.

## Licence note

IR-LPR is published under **GPL-3.0**. The bundled weights are derived from it, and they are served to
browsers for the on-device fallback. Get legal sign-off before distributing them outside the
organisation, or revert to the MIT-only original:

1. In `models/manifest.json`, remove `bundled` from the `ocr_crnn.onnx` entry and set its `sha256`
   back to `45f8c45f29eb1ee91f6274cb8d9c328da1a2050ea7d8596bae61f4a6b9f9fb1e`.
2. Re-run `python scripts/download_models.py` and `npm run models:iran-plate`.

The other datasets that were evaluated were not used: Iranis contains single-character crops only (no
whole plates for a CTC reader), truthofmatthew/persian-license-plate-recognition ships GPL YOLOv5
weights rather than data, and amirmgh1375/iranian-license-plate-recognition has fonts/templates with no
licence.

## Reproducing

```bash
pip install -r training/requirements-train.txt
# IR-LPR "plate" split: train/, validation/, test/ folders of *.jpg + per-character VOC *.xml
python training/crnn_torch.py platrix/ocr_crnn.onnx        # sanity check: PyTorch rebuild == onnxruntime
python training/finetune.py --train DATA/train --val DATA/validation \
    --base platrix/ocr_crnn.onnx --out runs/irlpr             # ~7.5 min/epoch on 4 CPU cores
ANPR_MODEL_DIR=<dir with the new ocr_crnn.onnx + detectors + labels> \
    python training/evaluate_irlpr.py DATA/test --out runs/irlpr/test.json
```

`platrix/ocr_crnn.onnx` must be the original export (`load_onnx_weights` maps its initializer names).
Training uses CTC loss plus a 0.3-weighted KL term towards the original model, AdamW with a one-cycle
schedule (max LR 3e-4), batch 64, and augmentation for detector-box jitter, tilt/perspective, low
resolution, blur, lighting, noise and JPEG artefacts. Every sample goes through `prep_crnn`, the same
transform the service uses.

To ship a new model: copy it to `models/bundled/ocr_crnn.onnx`, update its `sha256` in
`models/manifest.json`, and run the evaluation above plus `scripts/evaluate.py` on gate-camera frames.
