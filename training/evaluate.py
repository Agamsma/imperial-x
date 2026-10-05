"""Compare forecasts on held-out synthetic storms.

Three deterministic forecasts, scored against the synthetic truth:

* persistence: today's radar, not moved,
* extrapolation: today's radar moved along the estimated motion (the baseline),
* extrapolation + fusion: the baseline plus predicted growth and decay.

Scores are pooled over all scenarios: CSI (hits / (hits + misses + false
alarms)) and FSS over 20 km. They only show the code behaves on synthetic
storms. They are not evidence of skill on real storms and are never published
on the website.

Usage: python training/evaluate.py --n 40
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from imperial_x.advection import Sampler, departure_points  # noqa: E402
from imperial_x.fusion import build_features, get_model, growth_at_lead  # noqa: E402
from imperial_x.observe import analyse  # noqa: E402
from imperial_x.synthetic import random_scenario  # noqa: E402
from imperial_x.verify import Contingency, contingency, fss  # noqa: E402

METHODS = ("persistence", "extrapolation", "fusion")


def evaluate(seeds, leads=(30, 60), thresholds=(35.0, 45.0)) -> dict:
    model = get_model()
    pooled = {(m, lead, thr): Contingency(0, 0, 0, 0) for m in METHODS for lead in leads for thr in thresholds}
    fss_sum = {(m, lead): [] for m in METHODS for lead in leads}
    for seed in seeds:
        sc = random_scenario(seed)
        try:
            an = analyse(sc, scan_times=[-20, -10, 0], with_strikes=False)
        except ValueError:
            continue
        dbz0 = np.nan_to_num(an.dbz0, nan=0.0)
        feats = build_features(an.dbz0, an.dbz_prev_moved, an.bt_now, an.bt_prev, sc.sat_interval_min, an.lightning_recent, an.coverage)
        g30, g60 = model.predict(feats) if model else (np.zeros_like(dbz0), np.zeros_like(dbz0))
        deps = departure_points(an.motion.u, an.motion.v, max(leads) // 10)
        for lead in leads:
            s = Sampler(*deps[lead // 10 - 1], dbz0.shape)
            moved = s(dbz0)
            fused = moved + growth_at_lead(s(g30), s(g60), lead)
            fused = np.where(fused >= 10.0, fused, 0.0)
            truth = an.world.truth_dbz(lead)
            mask = an.coverage
            for name, fc in (("persistence", dbz0), ("extrapolation", moved), ("fusion", fused)):
                for thr in thresholds:
                    c = contingency(fc, truth, thr, mask)
                    p = pooled[(name, lead, thr)]
                    pooled[(name, lead, thr)] = Contingency(p.hits + c.hits, p.misses + c.misses, p.false_alarms + c.false_alarms, p.correct_negatives + c.correct_negatives)
                v = fss(fc, truth, 35.0, 11, mask)
                if not np.isnan(v):
                    fss_sum[(name, lead)].append(v)
    return {
        "csi": {f"{m}@{lead}min>={int(thr)}dBZ": round(pooled[(m, lead, thr)].csi, 3) for (m, lead, thr) in pooled},
        "fss20km": {f"{m}@{lead}min": round(float(np.mean(v)), 3) for (m, lead), v in fss_sum.items() if v},
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=40)
    ap.add_argument("--seed0", type=int, default=950_000)
    args = ap.parse_args()
    res = evaluate(range(args.seed0, args.seed0 + args.n))
    for group, scores in res.items():
        print(group)
        for k, v in scores.items():
            print(f"  {k:40s} {v}")


if __name__ == "__main__":
    main()
