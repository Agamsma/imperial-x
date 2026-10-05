"""Storm motion from consecutive radar scans, using TREC block matching.

TREC (Tracking Radar Echoes by Correlation) splits the earlier scan into blocks
and finds, for each block, the shift that best matches the later scan. The
best shift per block is the local motion. We then:

1. use two scan pairs when available and blend them,
2. replace vectors that disagree strongly with their neighbours,
3. fill blocks without echo from nearby good vectors, falling back to the
   average motion,
4. smooth the result into a motion field on the full grid,
5. keep a confidence value per cell, so the warning logic knows where timing
   can be trusted.

Displacements are in grid cells per 10 minute step.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .advection import Sampler
from .filters import box_mean, box_sum


@dataclass
class BlockVectors:
    rows: np.ndarray  # block centre rows (1D)
    cols: np.ndarray  # block centre cols (1D)
    u: np.ndarray  # cols per step, shape (len(rows), len(cols))
    v: np.ndarray  # rows per step
    corr: np.ndarray
    valid: np.ndarray
    echo: np.ndarray


@dataclass
class MotionField:
    u: np.ndarray  # cols per step, full grid
    v: np.ndarray  # rows per step
    confidence: np.ndarray  # 0..1 per cell
    mean_u: float
    mean_v: float
    quality: str  # good, fair, poor
    n_valid: int
    n_echo_blocks: int
    median_corr: float
    blocks: BlockVectors


def _prep(scan: np.ndarray) -> np.ndarray:
    return np.clip(np.nan_to_num(scan, nan=0.0), 0.0, 65.0)


def trec(a: np.ndarray, b: np.ndarray, steps: float = 1.0, block: int = 15, stride: int = 6,
         max_shift: int | None = None, min_echo: float = 0.08, min_corr: float = 0.45) -> BlockVectors:
    """Block-matching motion between scan a and a later scan b, `steps` steps apart."""
    a = _prep(a)
    b = _prep(b)
    ny, nx = a.shape
    m = max_shift if max_shift is not None else int(np.ceil(6 * steps))
    n = float(block * block)
    half = block // 2
    rows = np.arange(half, ny - half, stride)
    cols = np.arange(half, nx - half, stride)
    R, C = np.meshgrid(rows, cols, indexing="ij")

    sa = box_sum(a, block)[R, C]
    saa = box_sum(a * a, block)[R, C]
    echo = box_sum((a >= 15.0).astype(float), block)[R, C] / n
    var_a = saa - sa * sa / n
    sb_full = box_sum(b, block)
    sbb_full = box_sum(b * b, block)

    shifts = range(-m, m + 1)
    corr = np.full((2 * m + 1, 2 * m + 1) + R.shape, -1.0)
    for iy, dy in enumerate(shifts):
        for ix, dx in enumerate(shifts):
            rr = R + dy
            cc = C + dx
            ok = (rr >= 0) & (rr < ny) & (cc >= 0) & (cc < nx)
            rr_c = np.clip(rr, 0, ny - 1)
            cc_c = np.clip(cc, 0, nx - 1)
            sb = sb_full[rr_c, cc_c]
            sbb = sbb_full[rr_c, cc_c]
            # Product of a with b shifted by (dy, dx), summed over each block.
            prod = np.zeros_like(a)
            ys = slice(max(0, -dy), ny - max(0, dy))
            yd = slice(max(0, dy), ny - max(0, -dy))
            xs = slice(max(0, -dx), nx - max(0, dx))
            xd = slice(max(0, dx), nx - max(0, -dx))
            prod[ys, xs] = a[ys, xs] * b[yd, xd]
            sab = box_sum(prod, block)[R, C]
            var_b = sbb - sb * sb / n
            denom = np.sqrt(np.maximum(var_a, 1e-6) * np.maximum(var_b, 1e-6))
            c = (sab - sa * sb / n) / denom
            corr[iy, ix] = np.where(ok, c, -1.0)

    flat = corr.reshape((2 * m + 1) ** 2, *R.shape)
    best = flat.argmax(0)
    by, bx = np.divmod(best, 2 * m + 1)
    best_corr = np.take_along_axis(flat, best[None], 0)[0]

    def subpix(idx, axis_len, get):
        off = np.zeros(idx.shape)
        inner = (idx > 0) & (idx < axis_len - 1)
        cm, c0, cp = get(-1), get(0), get(1)
        den = cm - 2 * c0 + cp
        good = inner & (den < -1e-6)
        off[good] = 0.5 * (cm[good] - cp[good]) / den[good]
        return np.clip(off, -0.5, 0.5)

    I, J = np.meshgrid(np.arange(R.shape[0]), np.arange(R.shape[1]), indexing="ij")

    def get_y(d):
        return corr[np.clip(by + d, 0, 2 * m), bx, I, J]

    def get_x(d):
        return corr[by, np.clip(bx + d, 0, 2 * m), I, J]

    v = (by - m + subpix(by, 2 * m + 1, get_y)) / steps
    u = (bx - m + subpix(bx, 2 * m + 1, get_x)) / steps
    valid = (echo >= min_echo) & (best_corr >= min_corr) & (var_a > 50.0)
    return BlockVectors(rows=rows, cols=cols, u=u, v=v, corr=best_corr, valid=valid, echo=echo)


def _median_filter_vectors(bv: BlockVectors) -> None:
    """Replace valid vectors that disagree strongly with their valid neighbours."""
    u, v, valid = bv.u, bv.v, bv.valid
    nr, nc = u.shape
    new_u, new_v = u.copy(), v.copy()
    for i in range(nr):
        for j in range(nc):
            if not valid[i, j]:
                continue
            sl = (slice(max(0, i - 1), i + 2), slice(max(0, j - 1), j + 2))
            nb = valid[sl].copy()
            nb[min(i, 1), min(j, 1)] = False
            if nb.sum() < 3:
                continue
            mu = np.median(u[sl][nb])
            mv = np.median(v[sl][nb])
            dev = np.hypot(u[i, j] - mu, v[i, j] - mv)
            tol = max(0.7, 0.5 * np.hypot(mu, mv))
            if dev > tol:
                new_u[i, j], new_v[i, j] = mu, mv
    bv.u, bv.v = new_u, new_v


def _fill(bv: BlockVectors) -> tuple[np.ndarray, np.ndarray, np.ndarray, float, float]:
    """Fill blocks without a good vector by inverse-distance weighting."""
    u, v, valid, corr = bv.u, bv.v, bv.valid, bv.corr
    nr, nc = u.shape
    if valid.sum() == 0:
        z = np.zeros((nr, nc))
        return z, z.copy(), z.copy(), 0.0, 0.0
    w_echo = np.where(valid, np.maximum(bv.echo, 0.05) * np.maximum(corr, 0.0), 0.0)
    mean_u = float((u * w_echo).sum() / w_echo.sum())
    mean_v = float((v * w_echo).sum() / w_echo.sum())
    I, J = np.meshgrid(np.arange(nr), np.arange(nc), indexing="ij")
    vi, vj = I[valid], J[valid]
    vu, vv, vc = u[valid], v[valid], corr[valid]
    d = np.hypot(I.ravel()[:, None] - vi[None, :], J.ravel()[:, None] - vj[None, :])
    w = 1.0 / np.maximum(d, 0.5) ** 2
    fu = (w * vu).sum(1) / w.sum(1)
    fv = (w * vv).sum(1) / w.sum(1)
    dmin = d.min(1)
    # Far from any good vector, lean towards the average motion.
    blend = np.exp(-np.maximum(dmin - 1.0, 0.0) / 4.0)
    fu = blend * fu + (1 - blend) * mean_u
    fv = blend * fv + (1 - blend) * mean_v
    conf_near = (w * vc).sum(1) / w.sum(1)
    conf = conf_near * np.exp(-dmin / 3.0)
    fu, fv, conf = fu.reshape(nr, nc), fv.reshape(nr, nc), conf.reshape(nr, nc)
    fu[valid], fv[valid], conf[valid] = u[valid], v[valid], corr[valid]
    return fu, fv, np.clip(conf, 0.0, 1.0), mean_u, mean_v


def _to_grid(field: np.ndarray, bv: BlockVectors, shape: tuple[int, int]) -> np.ndarray:
    rows, cols = np.mgrid[0 : shape[0], 0 : shape[1]]
    stride_r = bv.rows[1] - bv.rows[0] if len(bv.rows) > 1 else 1
    stride_c = bv.cols[1] - bv.cols[0] if len(bv.cols) > 1 else 1
    rb = (rows - bv.rows[0]) / stride_r
    cb = (cols - bv.cols[0]) / stride_c
    return Sampler(rb, cb, field.shape, clamp=True)(field)


def estimate_motion(scans: dict[int, np.ndarray | None], step_min: int = 10) -> MotionField:
    """Motion field from the latest scans. `scans` maps minute -> dBZ (None if missing)."""
    times = sorted(t for t, s in scans.items() if s is not None)
    if len(times) < 2:
        raise ValueError("Need at least two radar scans to estimate motion.")
    t_last = times[-1]
    shape = scans[t_last].shape
    # Consecutive pairs among the latest three available scans.
    recent = times[-3:]
    pairs = []
    for t_a, t_b in zip(recent[:-1], recent[1:]):
        gap = (t_b - t_a) / step_min
        if gap <= 3:
            pairs.append((t_a, t_b, gap))
    pairs.reverse()  # most recent pair first
    if not pairs:
        raise ValueError("Radar scans are too far apart to track motion.")
    results = [trec(scans[a], scans[b], steps=gap) for a, b, gap in pairs]
    bv = results[0]
    if len(results) == 2:
        r2 = results[1]
        both = bv.valid & r2.valid
        w1 = np.where(bv.valid, bv.corr, 0.0)
        w2 = np.where(r2.valid, r2.corr, 0.0)
        tot = np.maximum(w1 + w2, 1e-9)
        u = np.where(both, (bv.u * w1 + r2.u * w2) / tot, np.where(bv.valid, bv.u, r2.u))
        v = np.where(both, (bv.v * w1 + r2.v * w2) / tot, np.where(bv.valid, bv.v, r2.v))
        bv = BlockVectors(bv.rows, bv.cols, u, v, np.maximum(bv.corr, r2.corr), bv.valid | r2.valid, np.maximum(bv.echo, r2.echo))
    _median_filter_vectors(bv)
    fu, fv, conf, mean_u, mean_v = _fill(bv)
    u = box_mean(box_mean(_to_grid(fu, bv, shape), 9), 9)
    v = box_mean(box_mean(_to_grid(fv, bv, shape), 9), 9)
    confidence = np.clip(box_mean(_to_grid(conf, bv, shape), 9), 0.0, 1.0)
    echo_blocks = bv.echo >= 0.08
    n_valid = int(bv.valid.sum())
    med = float(np.median(bv.corr[bv.valid])) if n_valid else 0.0
    if n_valid >= 8 and med >= 0.75:
        quality = "good"
    elif n_valid >= 3 and med >= 0.55:
        quality = "fair"
    else:
        quality = "poor"
    return MotionField(u=u, v=v, confidence=confidence, mean_u=mean_u, mean_v=mean_v, quality=quality,
                       n_valid=n_valid, n_echo_blocks=int(echo_blocks.sum()), median_corr=med, blocks=bv)
