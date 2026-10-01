"""Fine-tune the Platrix CRNN on IR-LPR plate crops (CPU is enough), distilling towards the original model.

    python training/finetune.py --train DATA/train --val DATA/validation \
        --base platrix/ocr_crnn.onnx --out runs/irlpr

Writes ``best.pt``, ``ocr_crnn.onnx`` (same I/O as the original) and ``history.json`` to ``--out``.
Inputs go through ``prep_crnn``, so the model sees exactly what the service feeds it.
"""

from __future__ import annotations

import argparse
import json
import pickle
import random
import sys
import time
from pathlib import Path

import cv2
import numpy as np
import torch
from torch import nn

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(HERE))

from app.pipeline.recognizer import prep_crnn  # noqa: E402
from crnn_torch import Crnn, export_onnx, load_onnx_weights  # noqa: E402
from irlpr import iter_split  # noqa: E402

LABELS: list[str] = json.loads((ROOT / "models" / "ocr_crnn.labels.json").read_text(encoding="utf-8"))
BLANK = len(LABELS)
IDX = {c: i for i, c in enumerate(LABELS)}
MAX_H = 64


def load_split(dirs: list[str]) -> list[tuple[bytes, str]]:
    """Plate crops as compact JPEG bytes (height capped at 64 px), cached next to the data.

    Keeping encoded bytes instead of decoded arrays keeps DataLoader workers small on Windows,
    where every worker gets its own copy of the dataset.
    """
    cache = Path(dirs[0]).with_suffix(".cache.pkl")
    if cache.exists():
        return pickle.loads(cache.read_bytes())
    items = []
    for d in dirs:
        for jpg, lab in iter_split(Path(d)):
            if any(c not in IDX for c in lab):
                continue
            img = cv2.imread(str(jpg))
            if img is None or img.shape[0] < 8 or img.shape[1] < 24:
                continue
            if img.shape[0] > MAX_H:
                img = cv2.resize(img, (int(img.shape[1] * MAX_H / img.shape[0]), MAX_H), interpolation=cv2.INTER_AREA)
            ok, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 95])
            if ok:
                items.append((buf.tobytes(), lab))
    cache.write_bytes(pickle.dumps(items))
    return items


def augment(img: np.ndarray, rng: random.Random) -> np.ndarray:
    """Gate-camera conditions: detector-box jitter, tilt, low resolution, blur, lighting, noise, JPEG."""
    h, w = img.shape[:2]
    if rng.random() < 0.8:
        pad = cv2.copyMakeBorder(img, h // 4, h // 4, w // 10, w // 10, cv2.BORDER_REPLICATE)
        ph, pw = pad.shape[:2]
        cx, cy = pw / 2 + rng.uniform(-0.04, 0.04) * w, ph / 2 + rng.uniform(-0.08, 0.08) * h
        sw, sh = w * rng.uniform(0.94, 1.1), h * rng.uniform(0.9, 1.25)
        x1, y1 = int(max(0, cx - sw / 2)), int(max(0, cy - sh / 2))
        x2, y2 = int(min(pw, cx + sw / 2)), int(min(ph, cy + sh / 2))
        img = pad[y1:y2, x1:x2]
        h, w = img.shape[:2]
    if rng.random() < 0.5:
        src = np.float32([[0, 0], [w, 0], [w, h], [0, h]])
        j = 0.06
        dst = src + np.float32([[rng.uniform(-j, j) * w, rng.uniform(-j, j) * h] for _ in range(4)])
        img = cv2.warpPerspective(img, cv2.getPerspectiveTransform(src, dst), (w, h), borderMode=cv2.BORDER_REPLICATE)
    if rng.random() < 0.45:
        tw = rng.randint(45, 110)
        img = cv2.resize(img, (tw, max(8, int(round(h * tw / w)))), interpolation=cv2.INTER_AREA)
    r = rng.random()
    if r < 0.2:
        k = rng.choice([3, 5])
        img = cv2.GaussianBlur(img, (k, k), 0)
    elif r < 0.3:
        k = rng.choice([3, 5, 7])
        kern = np.zeros((k, k), np.float32)
        kern[k // 2, :] = 1.0 / k
        img = cv2.filter2D(img, -1, kern)
    if rng.random() < 0.7:
        alpha, beta = rng.uniform(0.6, 1.4), rng.uniform(-40, 40)
        img = np.clip(img.astype(np.float32) * alpha + beta, 0, 255).astype(np.uint8)
    if rng.random() < 0.3:
        img = (255 * (img / 255.0) ** rng.uniform(0.6, 1.7)).astype(np.uint8)
    if rng.random() < 0.2:
        noise = np.random.default_rng(rng.randint(0, 1 << 30)).normal(0, rng.uniform(3, 12), img.shape)
        img = np.clip(img + noise, 0, 255).astype(np.uint8)
    if rng.random() < 0.5:
        ok, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, rng.randint(25, 90)])
        if ok:
            img = cv2.imdecode(buf, cv2.IMREAD_COLOR)
    return img


class PlateDataset(torch.utils.data.Dataset):
    def __init__(self, items, train: bool, seed: int = 0) -> None:
        self.items, self.train, self.seed = items, train, seed
        self.epoch = 0

    def __len__(self) -> int:
        return len(self.items)

    def __getitem__(self, i: int):
        data, lab = self.items[i]
        img = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
        if self.train:
            img = augment(img, random.Random(hash((self.seed, self.epoch, i)) & 0xFFFFFFFF))
        x = prep_crnn(img).astype(np.float32) / 255.0
        return torch.from_numpy(x)[None], torch.tensor([IDX[c] for c in lab], dtype=torch.long)


def collate(batch):
    xs, ys = zip(*batch)
    return torch.stack(xs), torch.cat(ys), torch.tensor([len(y) for y in ys], dtype=torch.long)


def greedy(logits: torch.Tensor) -> list[str]:
    out = []
    for seq in logits.argmax(-1).tolist():
        prev, chars = -1, []
        for k in seq:
            if k != BLANK and k != prev:
                chars.append(LABELS[k])
            prev = k
        out.append("".join(chars))
    return out


@torch.no_grad()
def evaluate(model, loader, labels: list[str]) -> float:
    model.eval()
    preds = []
    for x, _, _ in loader:
        preds.extend(greedy(model(x)))
    return sum(p == l for p, l in zip(preds, labels)) / max(1, len(labels))


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--train", nargs="+", required=True, help="IR-LPR plate-split folder(s)")
    ap.add_argument("--val", required=True)
    ap.add_argument("--base", required=True, help="original Platrix ocr_crnn.onnx")
    ap.add_argument("--out", required=True)
    ap.add_argument("--epochs", type=int, default=6)
    ap.add_argument("--bs", type=int, default=64)
    ap.add_argument("--lr", type=float, default=3e-4)
    ap.add_argument("--distill", type=float, default=0.3, help="KL weight towards the original model")
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--threads", type=int, default=0)
    args = ap.parse_args()

    if args.threads:
        torch.set_num_threads(args.threads)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    t0 = time.time()
    train_items = load_split(args.train)
    val_items = load_split([args.val])
    print(f"train={len(train_items)} val={len(val_items)} load={time.time() - t0:.0f}s", flush=True)

    model = load_onnx_weights(Crnn(), args.base)
    teacher = load_onnx_weights(Crnn(), args.base).eval()
    for p in teacher.parameters():
        p.requires_grad_(False)

    train_ds = PlateDataset(train_items, train=True)
    train_dl = torch.utils.data.DataLoader(
        train_ds, batch_size=args.bs, shuffle=True, collate_fn=collate, num_workers=args.workers,
        persistent_workers=args.workers > 0, drop_last=True,
    )
    val_dl = torch.utils.data.DataLoader(
        PlateDataset(val_items, train=False), batch_size=256, collate_fn=collate, num_workers=args.workers,
    )
    val_labels = [lab for _, lab in val_items]

    base_acc = evaluate(model, val_dl, val_labels)
    print(f"baseline val greedy acc={base_acc:.4f}", flush=True)
    best = base_acc
    torch.save(model.state_dict(), out / "best.pt")

    ctc = nn.CTCLoss(blank=BLANK, zero_infinity=True)
    opt = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-4)
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=args.lr, total_steps=args.epochs * len(train_dl), pct_start=0.1)
    history = []
    for epoch in range(args.epochs):
        train_ds.epoch = epoch
        model.train()
        total, n, te = 0.0, 0, time.time()
        for step, (x, y, ylen) in enumerate(train_dl, 1):
            logp = model(x).log_softmax(-1)  # B T C
            loss = ctc(logp.permute(1, 0, 2), y, torch.full((x.shape[0],), logp.shape[1], dtype=torch.long), ylen)
            if args.distill > 0:
                with torch.no_grad():
                    tp = teacher(x).softmax(-1)
                loss = loss + args.distill * nn.functional.kl_div(logp, tp, reduction="batchmean") / logp.shape[1]
            opt.zero_grad(set_to_none=True)
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), 5.0)
            opt.step()
            sched.step()
            total += float(loss) * x.shape[0]
            n += x.shape[0]
            if step % 50 == 0:
                print(f"  epoch {epoch + 1} {n}/{len(train_ds)} loss={total / n:.4f} {time.time() - te:.0f}s", flush=True)
        acc = evaluate(model, val_dl, val_labels)
        history.append({"epoch": epoch + 1, "loss": total / n, "valAcc": acc, "sec": round(time.time() - te)})
        print(json.dumps(history[-1]), flush=True)
        if acc > best:
            best = acc
            torch.save(model.state_dict(), out / "best.pt")
    model.load_state_dict(torch.load(out / "best.pt"))
    export_onnx(model, str(out / "ocr_crnn.onnx"))
    (out / "history.json").write_text(json.dumps({"baseline": base_acc, "best": best, "history": history}, indent=1))
    print(f"done best={best:.4f} baseline={base_acc:.4f} total={time.time() - t0:.0f}s", flush=True)


if __name__ == "__main__":
    main()
