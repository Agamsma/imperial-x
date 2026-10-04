"""Step 2. Score persistence and motion extrapolation against the next radar scans.

Input:  work/composites.npz (from composite.py).
Output: skill_results.json.

For every scan k with a previous scan k-1 on the same day:
  persistence forecast = scan k unchanged
  motion forecast      = scan k moved along the Farneback optical flow measured
                         between scans k-1 and k, scaled to the forecast lead
Both are scored against the observed scan k+1 (lead "15 min") and k+2 (lead "30 min").
"""
import json
import os
from datetime import datetime

import cv2
import numpy as np

from common import HERE, WORK

THRESHOLDS = (20, 30)      # dBZ
TOLERANCES = (0, 3)        # km (grid pixels are about 1 km)
LEADS = (1, 2)             # scans ahead; nominal 15 and 30 min
MAX_GAP = 20               # minutes; a pair is dropped if any scan gap is longer (2 x 20 for two scans)
MIN_PIXELS = 5             # a pair is dropped if both forecast-start and target have fewer echo pixels
HEADLINE = dict(thr=20, tol=3)


def flow(a, b):
    s = lambda x: cv2.GaussianBlur(np.clip(x, 0, 60).astype("float32") / 60 * 255, (0, 0), 2).astype("uint8")
    return cv2.calcOpticalFlowFarneback(s(a), s(b), None, 0.5, 3, 25, 3, 5, 1.1, 0)


def warp(img, fl, k):
    hh, w = img.shape
    gx, gy = np.meshgrid(np.arange(w), np.arange(hh))
    return cv2.remap(img.astype("float32"), (gx - fl[..., 0] * k).astype("float32"),
                     (gy - fl[..., 1] * k).astype("float32"), cv2.INTER_LINEAR, borderValue=0)


def dil(x, k):
    return cv2.dilate(x.astype("uint8"), np.ones((2 * k + 1, 2 * k + 1), "uint8")) > 0


def csi(fc, ob, thr, tol):
    """CSI = hits / (hits + misses + false alarms), with an optional tolerance in pixels.

    With tolerance: a hit is an observed echo pixel with a forecast echo pixel within tol
    (square neighbourhood, by dilation); a miss is an observed echo pixel with none; a false
    alarm is a forecast echo pixel with no observed echo pixel within tol.
    """
    f = fc >= thr
    o = ob >= thr
    if tol:
        hf = (f & dil(o, tol)).sum()
        ho = (o & dil(f, tol)).sum()
        fa = f.sum() - hf
        miss = o.sum() - ho
        h = ho
    else:
        h = (f & o).sum()
        fa = (f & ~o).sum()
        miss = (~f & o).sum()
    return float(h / max(1, h + miss + fa))


def main():
    z = np.load(os.path.join(WORK, "composites.npz"))
    days = {}
    for c, t in zip(z["comp"], z["times"]):
        t = datetime.fromisoformat(str(t))
        r = np.nan_to_num(c.T, nan=0.0)  # (lat, lon); no echo and missing both become 0 dBZ
        days.setdefault(t.strftime("%Y-%m-%d"), []).append((t, np.where(r < 0, 0, r)))

    out = dict(
        description="Preliminary baseline, TERLS radar, persistence vs Farneback motion extrapolation. Team analysis.",
        settings=dict(thresholds_dbz=THRESHOLDS, tolerances_km=TOLERANCES, leads_scans=LEADS, max_gap_min=MAX_GAP,
                      min_echo_pixels=MIN_PIXELS, grid_km=1, opencv=cv2.__version__, numpy=np.__version__),
        days={}, pooled={}, pairs=[],
    )
    gaps_all = []
    raw = {}  # (key) -> list of (persistence, motion) over all days, for pooling
    for day, scans in sorted(days.items()):
        scans.sort(key=lambda s: s[0])
        T = [s[0] for s in scans]
        R = [s[1] for s in scans]
        mins = [t.hour * 60 + t.minute + t.second / 60 for t in T]
        gaps = [mins[k] - mins[k - 1] for k in range(1, len(R))]
        gaps_all += [g for g in gaps if g <= MAX_GAP]
        spd = []
        for k in range(1, len(R)):
            if mins[k] - mins[k - 1] > MAX_GAP or (R[k - 1] >= 20).sum() < 20 or (R[k] >= 20).sum() < 20:
                continue
            fl = flow(R[k - 1], R[k])
            m = R[k] >= 20
            spd.append(np.median(np.hypot(fl[m][:, 0], fl[m][:, 1])) / ((mins[k] - mins[k - 1]) / 60))
        d = dict(scans=len(R), first=T[0].strftime("%H:%M:%S"), last=T[-1].strftime("%H:%M:%S"),
                 gaps_over_20_min=[[T[k - 1].strftime("%H:%M:%S"), T[k].strftime("%H:%M:%S"), round(g, 1)]
                                   for k, g in enumerate(gaps, 1) if g > MAX_GAP],
                 median_cell_motion_kmh=round(float(np.median(spd)), 1), scores={})
        for lead in LEADS:
            for thr in THRESHOLDS:
                for tol in TOLERANCES:
                    P, A = [], []
                    for k in range(1, len(R) - lead):
                        if mins[k] - mins[k - 1] > MAX_GAP or mins[k + lead] - mins[k] > MAX_GAP * lead:
                            continue
                        if (R[k] >= thr).sum() < MIN_PIXELS and (R[k + lead] >= thr).sum() < MIN_PIXELS:
                            continue
                        fl = flow(R[k - 1], R[k])
                        fc = warp(R[k], fl, (mins[k + lead] - mins[k]) / (mins[k] - mins[k - 1]))
                        P.append(csi(R[k], R[k + lead], thr, tol))
                        A.append(csi(fc, R[k + lead], thr, tol))
                        if thr == HEADLINE["thr"] and tol == HEADLINE["tol"]:
                            out["pairs"].append(dict(day=day, lead=f"{lead * 15}min", motion_from=T[k - 1].strftime("%H:%M:%S"),
                                                     start=T[k].strftime("%H:%M:%S"), target=T[k + lead].strftime("%H:%M:%S"),
                                                     lead_min=round(mins[k + lead] - mins[k], 2),
                                                     persistence_csi=round(P[-1], 4), motion_csi=round(A[-1], 4)))
                    if P:
                        raw.setdefault(f"{lead * 15}min_{thr}dBZ_tol{tol}km", []).extend(zip(P, A))
                        d["scores"][f"{lead * 15}min_{thr}dBZ_tol{tol}km"] = dict(
                            pairs=len(P), persistence_csi=round(float(np.mean(P)), 3),
                            motion_csi=round(float(np.mean(A)), 3),
                            motion_better_frac=round(float(np.mean(np.array(A) > np.array(P))), 2))
        out["days"][day] = d
        print("==", day, "scans", len(R), "| median cell motion %.1f km/h" % d["median_cell_motion_kmh"])

    # Pair-weighted pooling over days: the mean over all pairs, which equals each day's mean
    # CSI weighted by its number of pairs.
    for key in sorted(raw):
        pa = np.array(raw[key])
        out["pooled"][key] = dict(
            pairs=len(pa), pairs_by_day=[d["scores"][key]["pairs"] for d in out["days"].values() if key in d["scores"]],
            persistence_csi=round(float(pa[:, 0].mean()), 4), motion_csi=round(float(pa[:, 1].mean()), 4))
    out["median_scan_spacing_min"] = round(float(np.median(gaps_all)), 1)

    h = f"_{HEADLINE['thr']}dBZ_tol{HEADLINE['tol']}km"
    out["headline"] = {lead: dict(pairs=out["pooled"][lead + h]["pairs"],
                                  persistence_csi=round(out["pooled"][lead + h]["persistence_csi"], 2),
                                  motion_csi=round(out["pooled"][lead + h]["motion_csi"], 2))
                       for lead in ("15min", "30min")}
    with open(os.path.join(HERE, "skill_results.json"), "w") as fh:
        json.dump(out, fh, indent=1)
    print("median scan spacing", out["median_scan_spacing_min"], "min")
    for lead, v in out["headline"].items():
        print(f"headline {lead} (>=20 dBZ, 3 km): pairs {v['pairs']}  persistence {v['persistence_csi']:.2f}  motion {v['motion_csi']:.2f}")


if __name__ == "__main__":
    main()
