"""Quality control for radar scans before tracking and forecasting.

* Ground clutter: pixels that stay strong, barely change between scans, and
  stand far above their surroundings. Real storms move and vary; clutter does not.
* Speckle: single strong pixels with no echo around them.
* Missing scans: gaps in the 10 minute sequence are reported, not hidden.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from .filters import box_mean, box_sum


@dataclass
class QCReport:
    clutter_pixels: int = 0
    speckle_pixels: int = 0
    missing_scans: list[int] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)


def find_clutter(scans: list[np.ndarray]) -> np.ndarray:
    """Pixels that look like fixed ground clutter across the available scans."""
    stack = np.stack([np.nan_to_num(s, nan=0.0) for s in scans])
    if stack.shape[0] < 3:
        return np.zeros(stack.shape[1:], dtype=bool)
    mean = stack.mean(0)
    persistent = (stack >= 30.0).mean(0) >= 0.8
    steady = stack.std(0) < 2.5
    # Mean of the 5 x 5 ring around each pixel (box minus the 3 x 3 centre).
    ring = (box_sum(mean, 5) - box_sum(mean, 3)) / 16.0
    spiky = (mean - ring) >= 15.0
    return persistent & steady & spiky


def remove_speckle(scan: np.ndarray, min_neighbours: int = 2) -> tuple[np.ndarray, int]:
    echo = np.nan_to_num(scan, nan=0.0) > 0
    neighbours = box_sum(echo.astype(float), 3) - echo
    speck = echo & (neighbours < min_neighbours)
    out = scan.copy()
    out[speck] = 0.0
    return out, int(speck.sum())


def clean_scans(scans: dict[int, np.ndarray | None]) -> tuple[dict[int, np.ndarray | None], QCReport]:
    report = QCReport()
    times = sorted(scans)
    available = [scans[t] for t in times if scans[t] is not None]
    report.missing_scans = [t for t in times if scans[t] is None]
    clutter = find_clutter(available)
    report.clutter_pixels = int(clutter.sum())
    out: dict[int, np.ndarray | None] = {}
    speck_total = 0
    for t in times:
        s = scans[t]
        if s is None:
            out[t] = None
            continue
        s = s.copy()
        s[clutter & ~np.isnan(s)] = 0.0
        s, n = remove_speckle(s)
        speck_total += n
        out[t] = s
    report.speckle_pixels = speck_total
    if report.clutter_pixels:
        report.notes.append(f"Removed {report.clutter_pixels} ground clutter pixels near the radar.")
    if speck_total:
        report.notes.append(f"Removed {speck_total} isolated speckle pixels across {len(available)} scans.")
    for t in report.missing_scans:
        report.notes.append(f"Radar scan at {t} min is missing. Tracking used the remaining scans.")
    return out, report


__all__ = ["QCReport", "clean_scans", "find_clutter", "remove_speckle", "box_mean"]
