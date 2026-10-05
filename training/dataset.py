"""Training samples for the fusion step, built from random synthetic storms.

Inputs are the five features at analysis time. Targets are how much
reflectivity changed along the motion over 30 and 60 minutes:

    target(x) = truth(t + lead, at where x moves to) - radar(t, at x)

So the network learns growth and decay that pure extrapolation misses,
including new storms that show up first as cooling cloud tops.
"""

from __future__ import annotations

import os
import sys
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from imperial_x.advection import Sampler, forward_points  # noqa: E402
from imperial_x.filters import downsample2  # noqa: E402
from imperial_x.fusion import build_features, to_coarse  # noqa: E402
from imperial_x.observe import analyse  # noqa: E402
from imperial_x.synthetic import random_scenario  # noqa: E402

LEADS = (30, 60)


def make_sample(seed: int):
    sc = random_scenario(seed)
    try:
        an = analyse(sc, scan_times=[-20, -10, 0], with_strikes=False)
    except ValueError:
        return None
    feats = build_features(
        an.dbz0, an.dbz_prev_moved, an.bt_now, an.bt_prev,
        sat_gap_min=sc.sat_interval_min, lightning=an.lightning_recent, coverage=an.coverage,
    )
    dbz0 = np.nan_to_num(an.dbz0, nan=0.0)
    cov = an.coverage.astype(float)
    targets, masks = [], []
    fwd = forward_points(an.motion.u, an.motion.v, max(LEADS) // 10)
    for lead in LEADS:
        pr, pc = fwd[lead // 10 - 1]
        s = Sampler(pr, pc, dbz0.shape)
        truth = an.world.truth_dbz(lead)
        moved_truth = s(truth, fill=0.0)
        inside = s(cov, fill=0.0) > 0.99
        targets.append(np.clip(moved_truth - dbz0, -40.0, 50.0) / 10.0)
        masks.append(inside & an.coverage)
    # Weight cells with storms (now or later) or cooling cloud tops more than clear air.
    t_arr = np.stack(targets)
    stormy = (dbz0 >= 20) | (np.abs(t_arr).max(0) >= 1.5) | (feats[2] > 0.2)
    weight = np.where(stormy, 5.0, 1.0) * np.stack(masks).all(0)
    x = to_coarse(feats)
    y = np.stack([downsample2(t) for t in targets]).astype(np.float32)
    w = downsample2(weight).astype(np.float32)
    return x, y, w


def build(seeds, workers: int | None = None):
    workers = workers or max(1, (os.cpu_count() or 2) - 1)
    with ProcessPoolExecutor(max_workers=workers) as ex:
        out = [s for s in ex.map(make_sample, seeds, chunksize=4) if s is not None]
    xs, ys, ws = zip(*out)
    return np.stack(xs), np.stack(ys), np.stack(ws)
