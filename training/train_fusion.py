"""Train the fusion network on synthetic storms and export it for the engine.

Usage (from the repo root):

    python training/train_fusion.py --train 480 --val 60 --epochs 60

Needs PyTorch (CPU is fine). Writes imperial_x/weights/fusion_v1.npz.
Training data is synthetic only, so the result shows the pipeline works.
It says nothing about skill on real storms.
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

import numpy as np
import torch

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from dataset import build  # noqa: E402
from model import OUT_SCALE, FusionNet, export_npz  # noqa: E402

TRAIN_SEED0 = 100_000
VAL_SEED0 = 900_000


def weighted_huber(pred, target, weight, delta=1.0):
    err = pred - target
    a = err.abs()
    loss = torch.where(a < delta, 0.5 * err**2, delta * (a - 0.5 * delta))
    w = weight[:, None]
    return (loss * w).sum() / (w.sum() * pred.shape[1] + 1e-6)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--train", type=int, default=480)
    ap.add_argument("--val", type=int, default=60)
    ap.add_argument("--epochs", type=int, default=60)
    ap.add_argument("--batch", type=int, default=16)
    ap.add_argument("--lr", type=float, default=2e-3)
    ap.add_argument("--out", default=str(ROOT / "imperial_x" / "weights" / "fusion_v1.npz"))
    args = ap.parse_args()

    torch.manual_seed(0)
    np.random.seed(0)
    t0 = time.time()
    xtr, ytr, wtr = build(range(TRAIN_SEED0, TRAIN_SEED0 + args.train))
    xva, yva, wva = build(range(VAL_SEED0, VAL_SEED0 + args.val))
    print(f"data: train {xtr.shape} val {xva.shape} in {time.time() - t0:.0f}s", flush=True)

    xtr_t, ytr_t, wtr_t = map(torch.from_numpy, (xtr, ytr, wtr))
    xva_t, yva_t, wva_t = map(torch.from_numpy, (xva, yva, wva))
    model = FusionNet()
    opt = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-4)
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=args.epochs)
    n = xtr_t.shape[0]
    best = (float("inf"), None)
    for epoch in range(args.epochs):
        model.train()
        perm = torch.randperm(n)
        total = 0.0
        for i in range(0, n, args.batch):
            idx = perm[i : i + args.batch]
            xb, yb, wb = xtr_t[idx], ytr_t[idx], wtr_t[idx]
            # Flips are valid augmentations: growth does not depend on map orientation.
            if torch.rand(1) < 0.5:
                xb, yb, wb = xb.flip(-1), yb.flip(-1), wb.flip(-1)
            if torch.rand(1) < 0.5:
                xb, yb, wb = xb.flip(-2), yb.flip(-2), wb.flip(-2)
            loss = weighted_huber(model(xb), yb, wb)
            opt.zero_grad()
            loss.backward()
            opt.step()
            total += loss.item() * len(idx)
        sched.step()
        model.eval()
        with torch.no_grad():
            val = float(weighted_huber(model(xva_t), yva_t, wva_t))
            zero = float(weighted_huber(torch.zeros_like(yva_t), yva_t, wva_t))
        if val < best[0]:
            best = (val, {k: v.clone() for k, v in model.state_dict().items()})
        if epoch % 5 == 0 or epoch == args.epochs - 1:
            print(f"epoch {epoch:3d} train {total / n:.4f} val {val:.4f} (no-growth baseline {zero:.4f})", flush=True)

    model.load_state_dict(best[1])
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    export_npz(model, out, meta={"train_scenarios": args.train, "epochs": args.epochs, "data": "synthetic"})
    print(f"saved {out} (best val {best[0]:.4f}); out_scale {OUT_SCALE}; total {time.time() - t0:.0f}s")


if __name__ == "__main__":
    main()
