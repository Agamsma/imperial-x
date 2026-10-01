"""The fusion network, as a PyTorch module (training only)."""

from __future__ import annotations

import numpy as np
import torch
from torch import nn

DILATIONS = (1, 2, 4, 1)
HIDDEN = 24
OUT_SCALE = 10.0  # targets are in units of 10 dBZ


class FusionNet(nn.Module):
    """Four 3 x 3 convolutions (dilated, about 70 km of context at 4 km cells) and a 1 x 1 output."""

    def __init__(self, cin: int = 5, hidden: int = HIDDEN, cout: int = 2):
        super().__init__()
        layers = []
        c = cin
        for d in DILATIONS:
            layers.append(nn.Conv2d(c, hidden, 3, padding=d, dilation=d))
            c = hidden
        self.convs = nn.ModuleList(layers)
        self.out = nn.Conv2d(hidden, cout, 1)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        for conv in self.convs:
            x = torch.relu(conv(x))
        return self.out(x)


def export_npz(model: FusionNet, path, meta: dict | None = None) -> None:
    """Save weights in the format vajranow.fusion.FusionModel reads."""
    params: dict[str, np.ndarray] = {}
    mods = list(model.convs) + [model.out]
    dils = list(DILATIONS) + [1]
    for i, (m, d) in enumerate(zip(mods, dils)):
        params[f"w{i}"] = m.weight.detach().cpu().numpy().astype(np.float32)
        params[f"b{i}"] = m.bias.detach().cpu().numpy().astype(np.float32)
        params[f"d{i}"] = np.array(d)
    params["out_scale"] = np.array(OUT_SCALE, dtype=np.float32)
    for k, v in (meta or {}).items():
        params[f"meta_{k}"] = np.array(v)
    np.savez_compressed(path, **params)
