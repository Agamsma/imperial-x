"""Fusion step: predict storm growth and decay from radar, satellite and lightning.

Extrapolation alone assumes every storm keeps its strength. The fusion step
predicts how reflectivity will change over the next 30 and 60 minutes, moving
with the storm, from five inputs:

1. radar reflectivity now,
2. infrared cloud top temperature (colder tops mean taller storms),
3. cloud top cooling rate (fast cooling means a storm is growing, often before
   radar sees much),
4. recent lightning,
5. the radar trend over the last 10 minutes, measured along the motion.

The network is small (about 17 thousand weights) and runs on a 4 km version of
the grid. It was trained with PyTorch (see training/) on synthetic storms only,
then exported to numpy so the API needs no deep learning library.

It is a stand-in for the planned AI fusion model. It shows the pipeline works
end to end. Its behaviour on real storms is unknown until it is trained and
checked on real MOSDAC data.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np

from .advection import Sampler
from .filters import downsample2

N_FEATURES = 5
FEATURE_NAMES = ("reflectivity", "cloud_top_coldness", "cloud_top_cooling", "lightning", "radar_trend")
WEIGHTS_PATH = Path(__file__).resolve().parent / "weights" / "fusion_v1.npz"
CLEAR_SKY_K = 296.0


def build_features(
    dbz0: np.ndarray,
    dbz_prev_moved: np.ndarray | None,
    bt_now: np.ndarray,
    bt_prev: np.ndarray,
    sat_gap_min: float,
    lightning: np.ndarray,
    coverage: np.ndarray,
) -> np.ndarray:
    """Stack the five normalised inputs on the 2 km grid, shape (5, ny, nx)."""
    z = np.nan_to_num(dbz0, nan=0.0)
    f = np.zeros((N_FEATURES,) + z.shape, dtype=np.float32)
    f[0] = z / 60.0
    f[1] = np.clip((CLEAR_SKY_K - bt_now) / 100.0, 0.0, 1.2)
    cooling_per_10 = (bt_prev - bt_now) / max(sat_gap_min / 10.0, 1e-6)
    f[2] = np.clip(cooling_per_10 / 10.0, -1.5, 1.5)
    f[3] = np.log1p(lightning) / 3.0
    if dbz_prev_moved is not None:
        prev = np.nan_to_num(dbz_prev_moved, nan=0.0)
        trend = np.where((z > 0) | (prev > 0), (z - prev) / 10.0, 0.0)
        f[4] = np.clip(trend, -3.0, 3.0)
    f[0] *= coverage
    f[4] *= coverage
    return f


def to_coarse(features: np.ndarray) -> np.ndarray:
    return np.stack([downsample2(ch) for ch in features]).astype(np.float32)


def _conv(x: np.ndarray, w: np.ndarray, b: np.ndarray, dilation: int) -> np.ndarray:
    """Same-size 2D convolution matching torch.nn.Conv2d (cross-correlation, zero padding)."""
    o, c, kh, kw = w.shape
    _, h, wd = x.shape
    pad = dilation * (kh // 2)
    xp = np.pad(x, ((0, 0), (pad, pad), (pad, pad)))
    out = np.zeros((o, h, wd), dtype=np.float32)
    for ky in range(kh):
        for kx in range(kw):
            patch = xp[:, ky * dilation : ky * dilation + h, kx * dilation : kx * dilation + wd]
            out += np.tensordot(w[:, :, ky, kx], patch, axes=([1], [0]))
    return out + b[:, None, None]


class FusionModel:
    """Numpy inference for the trained network."""

    def __init__(self, params: dict[str, np.ndarray]):
        self.layers = []
        i = 0
        while f"w{i}" in params:
            self.layers.append((params[f"w{i}"].astype(np.float32), params[f"b{i}"].astype(np.float32), int(params[f"d{i}"])))
            i += 1
        self.out_scale = float(params.get("out_scale", 10.0))
        self.meta = {k: params[k] for k in params if k.startswith("meta_")}

    @classmethod
    def load(cls, path: Path = WEIGHTS_PATH) -> "FusionModel":
        with np.load(path) as data:
            return cls({k: data[k] for k in data.files})

    def forward_coarse(self, x: np.ndarray) -> np.ndarray:
        h = x.astype(np.float32)
        for i, (w, b, d) in enumerate(self.layers):
            h = _conv(h, w, b, d)
            if i < len(self.layers) - 1:
                h = np.maximum(h, 0.0)
        return h * self.out_scale

    def predict(self, features: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        """Growth in dBZ over 30 and 60 minutes, on the 2 km grid."""
        ny, nx = features.shape[1:]
        coarse = self.forward_coarse(to_coarse(features))
        rows, cols = np.mgrid[0:ny, 0:nx]
        s = Sampler((rows + 0.5) / 2.0 - 0.5, (cols + 0.5) / 2.0 - 0.5, coarse.shape[1:], clamp=True)
        return s(coarse[0]), s(coarse[1])


# The network learns the average change, so it overstates how fast strong cores
# weaken. Growth is applied in full and predicted decay at 30%, which kept strong
# cores and scored better than both full decay and no fusion on held-out
# synthetic storms (see training/evaluate.py).
DECAY_WEIGHT = 0.3


def growth_at_lead(g30: np.ndarray, g60: np.ndarray, lead_min: float) -> np.ndarray:
    """Predicted change at any lead time, with decay damped."""
    if lead_min <= 30:
        g = g30 * (lead_min / 30.0)
    elif lead_min <= 60:
        g = g30 + (g60 - g30) * ((lead_min - 30.0) / 30.0)
    else:
        g = g60
    return np.where(g > 0, g, DECAY_WEIGHT * g)


_MODEL: FusionModel | None = None


def get_model() -> FusionModel | None:
    """The trained model, or None if the weights file is missing."""
    global _MODEL
    if _MODEL is None and WEIGHTS_PATH.exists():
        _MODEL = FusionModel.load()
    return _MODEL
