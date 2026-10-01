"""Verification scores for nowcasts.

Used by the test suite and the training scripts to check every change against
the extrapolation baseline. On synthetic storms these scores only show that
the code behaves; they say nothing about skill on real storms, so they are
never shown on the website.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .filters import box_mean


@dataclass
class Contingency:
    hits: int
    misses: int
    false_alarms: int
    correct_negatives: int

    @property
    def pod(self) -> float:
        """Probability of detection: hits / (hits + misses)."""
        d = self.hits + self.misses
        return self.hits / d if d else float("nan")

    @property
    def far(self) -> float:
        """False alarm ratio: false alarms / (hits + false alarms)."""
        d = self.hits + self.false_alarms
        return self.false_alarms / d if d else float("nan")

    @property
    def csi(self) -> float:
        """Critical success index: hits / (hits + misses + false alarms)."""
        d = self.hits + self.misses + self.false_alarms
        return self.hits / d if d else float("nan")

    @property
    def bias(self) -> float:
        d = self.hits + self.misses
        return (self.hits + self.false_alarms) / d if d else float("nan")


def contingency(forecast: np.ndarray, observed: np.ndarray, threshold: float, mask: np.ndarray | None = None) -> Contingency:
    f = np.nan_to_num(forecast, nan=0.0) >= threshold
    o = np.nan_to_num(observed, nan=0.0) >= threshold
    if mask is not None:
        f, o = f[mask], o[mask]
    return Contingency(
        hits=int((f & o).sum()),
        misses=int((~f & o).sum()),
        false_alarms=int((f & ~o).sum()),
        correct_negatives=int((~f & ~o).sum()),
    )


def fss(forecast: np.ndarray, observed: np.ndarray, threshold: float, window: int, mask: np.ndarray | None = None) -> float:
    """Fractions skill score over a window x window neighbourhood (1 is perfect)."""
    f = (np.nan_to_num(forecast, nan=0.0) >= threshold).astype(float)
    o = (np.nan_to_num(observed, nan=0.0) >= threshold).astype(float)
    pf = box_mean(f, window)
    po = box_mean(o, window)
    if mask is not None:
        pf, po = pf[mask], po[mask]
    mse = np.mean((pf - po) ** 2)
    ref = np.mean(pf**2) + np.mean(po**2)
    return float(1.0 - mse / ref) if ref > 0 else float("nan")
