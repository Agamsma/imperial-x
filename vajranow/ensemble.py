"""Ensemble forecast: many slightly different futures, turned into probabilities.

Member 0 (the control) moves today's radar along the estimated motion and adds
the growth predicted by the fusion step. The other members each get:

* a different storm speed (scaled up or down a little),
* a small constant shift in motion, larger where tracking confidence is low,
* a different amount of growth or decay,
* intensity noise that moves with the storm and grows with lead time.

The fraction of members showing a storm at a place is the probability.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .advection import Sampler, grid_positions, step_back_nearest
from .fusion import growth_at_lead
from .motion import MotionField
from .synthetic import smooth_noise

STEP_MIN = 10
MIN_DBZ = 10.0
QUANT = 3.0  # members are stored as uint8 dBZ * 3 (0 to 85 dBZ)


@dataclass
class Ensemble:
    leads: list[int]  # minutes, 10..120
    members: np.ndarray  # (n_members + 1, n_leads, ny, nx) uint8, dBZ * QUANT; member 0 is the control
    valid: np.ndarray  # (n_leads, ny, nx) bool: departure point lies inside radar coverage
    sigma_offset_kmh: float
    n_members: int

    def member_dbz(self, lead_index: int) -> np.ndarray:
        return self.members[:, lead_index].astype(np.float32) / QUANT

    def median(self, lead_index: int) -> np.ndarray:
        return np.median(self.member_dbz(lead_index), axis=0)


def run_ensemble(
    dbz0: np.ndarray,
    motion: MotionField,
    g30: np.ndarray | None,
    g60: np.ndarray | None,
    coverage: np.ndarray,
    n_members: int = 20,
    n_steps: int = 12,
    seed: int = 0,
) -> Ensemble:
    rng = np.random.default_rng(seed)
    shape = dbz0.shape
    base = np.nan_to_num(dbz0, nan=0.0).astype(np.float32)
    g30 = None if g30 is None else np.asarray(g30, np.float32)
    g60 = None if g60 is None else np.asarray(g60, np.float32)
    cov = coverage.astype(np.float32)
    if g30 is None:
        g30 = np.zeros(shape, np.float32)
        g60 = np.zeros(shape, np.float32)
    mean_speed_kmh = float(np.hypot(motion.mean_u, motion.mean_v) * 60.0 / STEP_MIN * 2.0)
    sigma_off_kmh = 3.0 + 0.12 * mean_speed_kmh
    sigma_off = sigma_off_kmh / (60.0 / STEP_MIN * 2.0)  # cells per step
    # More spread where tracking is unsure.
    spread_map = 1.0 + 1.5 * (1.0 - motion.confidence)
    noise_bank = [smooth_noise(shape, 6.0, rng).astype(np.float32) for _ in range(6)]
    leads = [STEP_MIN * (i + 1) for i in range(n_steps)]
    out = np.zeros((n_members + 1, n_steps) + shape, dtype=np.uint8)
    valid = np.zeros((n_steps,) + shape, dtype=bool)

    for m in range(n_members + 1):
        if m == 0:
            scale, du, dv, gscale = 1.0, 0.0, 0.0, 1.0
            noise = np.zeros(shape, np.float32)
        else:
            scale = float(np.clip(rng.normal(1.0, 0.08), 0.75, 1.25))
            du, dv = rng.normal(0.0, sigma_off, 2)
            gscale = float(np.clip(rng.normal(1.0, 0.3), 0.3, 1.8))
            shift = (int(rng.integers(0, shape[0])), int(rng.integers(0, shape[1])))
            noise = np.roll(noise_bank[m % len(noise_bank)], shift, (0, 1))
        u_flat = (motion.u * scale + du * spread_map).astype(np.float32).ravel()
        v_flat = (motion.v * scale + dv * spread_map).astype(np.float32).ravel()
        pr, pc = grid_positions(shape)
        pr, pc = pr.astype(np.float32), pc.astype(np.float32)
        for li, lead in enumerate(leads):
            pr, pc = step_back_nearest(pr, pc, u_flat, v_flat, shape)
            s = Sampler(pr, pc, shape)
            f0 = s(base)
            grow = growth_at_lead(s(g30), s(g60), lead)
            f = f0 + gscale * grow
            if m:
                amp = 1.5 + 3.5 * lead / 120.0
                f = np.where(f >= 12.0, f + amp * s(noise), f)
            out[m, li] = np.clip(np.rint(np.where(f >= MIN_DBZ, f, 0.0) * QUANT), 0, 255).astype(np.uint8)
            if m == 0:
                valid[li] = s(cov) > 0.5
    return Ensemble(leads=leads, members=out, valid=valid, sigma_offset_kmh=sigma_off_kmh, n_members=n_members)
