"""Semi-Lagrangian extrapolation: move fields along the estimated motion.

For a forecast at lead n, every grid point looks back along the motion to find
where its air was at analysis time (the departure point) and takes the value
there. This is the same idea as the pysteps 'semilagrangian' method, written in
numpy so it runs anywhere.
"""

from __future__ import annotations

import numpy as np


class Sampler:
    """Bilinear sampling of many fields at the same (fractional) positions."""

    def __init__(self, rows: np.ndarray, cols: np.ndarray, shape: tuple[int, int], clamp: bool = False):
        ny, nx = shape
        self.shape = shape
        rows = np.asarray(rows, dtype=np.float32)
        cols = np.asarray(cols, dtype=np.float32)
        self.out_shape = rows.shape
        if clamp:
            rows = np.clip(rows, 0, ny - 1)
            cols = np.clip(cols, 0, nx - 1)
            self.inside = None
        else:
            self.inside = (rows >= 0) & (rows <= ny - 1) & (cols >= 0) & (cols <= nx - 1)
            rows = np.clip(rows, 0, ny - 1)
            cols = np.clip(cols, 0, nx - 1)
        r0 = np.minimum(rows.astype(np.intp), ny - 2)  # rows >= 0, so truncation is floor
        c0 = np.minimum(cols.astype(np.intp), nx - 2)
        fr = (rows - r0).ravel()
        fc = (cols - c0).ravel()
        self.i00 = (r0 * nx + c0).ravel()
        self.nx = nx
        gr = 1.0 - fr
        gc = 1.0 - fc
        self.w00 = gr * gc
        self.w01 = gr * fc
        self.w10 = fr * gc
        self.w11 = fr * fc

    def __call__(self, field: np.ndarray, fill: float = 0.0) -> np.ndarray:
        f = np.asarray(field).ravel()
        i = self.i00
        out = f[i] * self.w00 + f[i + 1] * self.w01 + f[i + self.nx] * self.w10 + f[i + self.nx + 1] * self.w11
        out = out.reshape(self.out_shape)
        if self.inside is not None:
            out = np.where(self.inside, out, fill)
        return out


def grid_positions(shape: tuple[int, int]) -> tuple[np.ndarray, np.ndarray]:
    rows, cols = np.mgrid[0 : shape[0], 0 : shape[1]]
    return rows.astype(float), cols.astype(float)


def step_back(pr: np.ndarray, pc: np.ndarray, u: np.ndarray, v: np.ndarray):
    """One 10 minute step back along the motion, using a midpoint estimate.

    u and v are displacements per step in columns and rows.
    """
    s = Sampler(pr, pc, u.shape, clamp=True)
    s2 = Sampler(pr - 0.5 * s(v), pc - 0.5 * s(u), u.shape, clamp=True)
    return pr - s2(v), pc - s2(u)


def step_forward(pr: np.ndarray, pc: np.ndarray, u: np.ndarray, v: np.ndarray):
    s = Sampler(pr, pc, u.shape, clamp=True)
    s2 = Sampler(pr + 0.5 * s(v), pc + 0.5 * s(u), u.shape, clamp=True)
    return pr + s2(v), pc + s2(u)


def step_back_nearest(pr: np.ndarray, pc: np.ndarray, u_flat: np.ndarray, v_flat: np.ndarray, shape: tuple[int, int]):
    """Faster step_back for the ensemble: the motion field is smooth, so the
    nearest cell's vector is close enough, and it avoids two bilinear setups."""
    ny, nx = shape
    k = np.clip(np.rint(pr), 0, ny - 1).astype(np.intp) * nx + np.clip(np.rint(pc), 0, nx - 1).astype(np.intp)
    mr = pr - 0.5 * v_flat[k]
    mc = pc - 0.5 * u_flat[k]
    k2 = np.clip(np.rint(mr), 0, ny - 1).astype(np.intp) * nx + np.clip(np.rint(mc), 0, nx - 1).astype(np.intp)
    return pr - v_flat[k2], pc - u_flat[k2]


def departure_points(u: np.ndarray, v: np.ndarray, n_steps: int):
    """Departure points for leads 1..n_steps (each a (rows, cols) pair)."""
    pr, pc = grid_positions(u.shape)
    out = []
    for _ in range(n_steps):
        pr, pc = step_back(pr, pc, u, v)
        out.append((pr, pc))
    return out


def forward_points(u: np.ndarray, v: np.ndarray, n_steps: int, rows=None, cols=None):
    """Where points at analysis time end up after 1..n_steps steps."""
    if rows is None:
        rows, cols = grid_positions(u.shape)
    pr, pc = np.asarray(rows, dtype=float), np.asarray(cols, dtype=float)
    out = []
    for _ in range(n_steps):
        pr, pc = step_forward(pr, pc, u, v)
        out.append((pr, pc))
    return out


def extrapolate(field: np.ndarray, u: np.ndarray, v: np.ndarray, n_steps: int, fill: float = 0.0) -> list[np.ndarray]:
    """Lagrangian persistence: the field moved along the motion, unchanged in strength."""
    f = np.nan_to_num(field, nan=fill)
    return [Sampler(pr, pc, f.shape)(f, fill=fill) for pr, pc in departure_points(u, v, n_steps)]
