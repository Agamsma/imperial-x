"""Small, fast array filters built on numpy only."""

from __future__ import annotations

import numpy as np


def box_sum(a: np.ndarray, k: int) -> np.ndarray:
    """Sum over a k x k window centred on each pixel (k odd), zero outside the array."""
    r = k // 2
    p = np.pad(np.asarray(a, dtype=float), ((r + 1, r), (r + 1, r)))
    c = p.cumsum(0).cumsum(1)
    return c[k:, k:] - c[:-k, k:] - c[k:, :-k] + c[:-k, :-k]


def box_mean(a: np.ndarray, k: int) -> np.ndarray:
    """Mean over a k x k window, ignoring the area outside the array."""
    ones = np.ones_like(a, dtype=float)
    return box_sum(a, k) / box_sum(ones, k)


def neighbourhood_max(a: np.ndarray, radius: int) -> np.ndarray:
    """Maximum over a (2r+1) x (2r+1) window on the last two axes. Used for 'within a few km' checks."""
    if radius <= 0:
        return a.copy()
    tmp = a.copy()
    for d in range(1, radius + 1):
        np.maximum(tmp[..., d:, :], a[..., :-d, :], out=tmp[..., d:, :])
        np.maximum(tmp[..., :-d, :], a[..., d:, :], out=tmp[..., :-d, :])
    out = tmp.copy()
    for d in range(1, radius + 1):
        np.maximum(out[..., :, d:], tmp[..., :, :-d], out=out[..., :, d:])
        np.maximum(out[..., :, :-d], tmp[..., :, d:], out=out[..., :, :-d])
    return out


def shifted(b: np.ndarray, dy: int, dx: int) -> np.ndarray:
    """out[i, j] = b[i + dy, j + dx], zero where that falls outside."""
    ny, nx = b.shape
    out = np.zeros_like(b)
    ys = slice(max(0, -dy), ny - max(0, dy))
    yd = slice(max(0, dy), ny - max(0, -dy))
    xs = slice(max(0, -dx), nx - max(0, dx))
    xd = slice(max(0, dx), nx - max(0, -dx))
    out[ys, xs] = b[yd, xd]
    return out


def downsample2(a: np.ndarray) -> np.ndarray:
    """Average 2 x 2 blocks, padding odd edges by repeating the last row or column."""
    ny, nx = a.shape
    if ny % 2:
        a = np.vstack([a, a[-1:]])
    if nx % 2:
        a = np.hstack([a, a[:, -1:]])
    return 0.25 * (a[0::2, 0::2] + a[1::2, 0::2] + a[0::2, 1::2] + a[1::2, 1::2])
