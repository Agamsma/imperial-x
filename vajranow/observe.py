"""Turn a scenario into the inputs the engine sees at analysis time.

Shared by the live pipeline and by training, so both see exactly the same
kind of data.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .advection import Sampler, departure_points
from .grid import GRID, Grid
from .motion import MotionField, estimate_motion
from .qc import QCReport, clean_scans
from .synthetic import Scenario, StormWorld, lightning_density

SCAN_TIMES = list(range(-60, 1, 10))


@dataclass
class Analysis:
    world: StormWorld
    scans: dict[int, np.ndarray | None]  # cleaned radar scans, minute -> dBZ
    qc: QCReport
    motion: MotionField
    dbz0: np.ndarray
    dbz_prev_moved: np.ndarray | None
    sat_times: tuple[int, int]
    bt_now: np.ndarray
    bt_prev: np.ndarray
    strikes: list[tuple[float, float, float]]  # last 60 minutes
    lightning_recent: np.ndarray  # density over the last 10 minutes
    coverage: np.ndarray


def analyse(scenario: Scenario, grid: Grid = GRID, scan_times=SCAN_TIMES, with_strikes: bool = True) -> Analysis:
    world = StormWorld(scenario, grid)
    raw = {t: world.observe_radar(t) for t in scan_times}
    scans, qc = clean_scans(raw)
    if scans.get(0) is None:
        raise ValueError("The latest radar scan is missing; cannot run a nowcast.")
    motion = estimate_motion(scans)
    dbz0 = scans[0]

    prev = scans.get(-10)
    dbz_prev_moved = None
    if prev is not None:
        (pr, pc), = departure_points(motion.u, motion.v, 1)
        dbz_prev_moved = Sampler(pr, pc, prev.shape)(np.nan_to_num(prev, nan=0.0))

    t_now = -scenario.sat_latency_min
    t_prev = t_now - scenario.sat_interval_min
    bt_now = world.brightness_temp(t_now)
    bt_prev = world.brightness_temp(t_prev)

    rng = np.random.default_rng([scenario.seed, 77])
    strikes = world.strikes(-60, 0, rng) if with_strikes else world.strikes(-10, 0, rng)
    recent = [s for s in strikes if s[2] > -10]
    return Analysis(
        world=world,
        scans=scans,
        qc=qc,
        motion=motion,
        dbz0=dbz0,
        dbz_prev_moved=dbz_prev_moved,
        sat_times=(t_prev, t_now),
        bt_now=bt_now,
        bt_prev=bt_prev,
        strikes=strikes,
        lightning_recent=lightning_density(recent, grid),
        coverage=world.coverage,
    )
