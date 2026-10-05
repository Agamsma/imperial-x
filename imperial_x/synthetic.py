"""Synthetic storms: radar reflectivity, infrared cloud tops and lightning.

This module stands in for the real MOSDAC and IITM feeds until those are wired
in. Storms are built from moving, growing and decaying cells:

* Radar reflectivity (dBZ) from a few Gaussian cores per cell, with texture that
  moves with the cell and a trailing area of lighter rain.
* Infrared brightness temperature (K). Cloud tops cool 10 to 30 minutes before
  the radar echo grows, as in real storms. This is the signal the fusion step
  learns to use for growth and new storms.
* Lightning strikes, more frequent in strong, cold-topped cores.

Observations add the problems real feeds have: noise, ground clutter near the
radar, isolated speckle, missing scans, and satellite images that arrive late.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

import numpy as np

from .grid import GRID, Grid, haversine_km

NO_ECHO_DBZ = 8.0
CLEAR_SKY_K = 296.0


@dataclass
class Cell:
    lon: float  # centre at analysis time (t = 0)
    lat: float
    speed_kmh: float
    toward_deg: float  # bearing the cell moves towards
    peak_dbz: float
    t_start: float  # minutes relative to analysis time
    t_peak: float
    t_decay: float
    t_end: float
    radius_km: float = 7.0
    aspect: float = 1.5
    orient_deg: float | None = None  # long axis bearing; default is across the motion
    cores: int = 3
    stratiform: float = 0.6
    pre_cool_min: float = 20.0  # how far cloud top cooling leads radar growth
    seed: int = 0


@dataclass
class Scenario:
    id: str
    title: str
    summary: str
    cells: list[Cell]
    seed: int = 1
    clutter: bool = True
    missing_scans: tuple[int, ...] = ()
    radar_latency_min: int = 3
    sat_latency_min: int = 12
    sat_interval_min: int = 15
    noise_db: float = 1.0
    story: list[str] = field(default_factory=list)


def lifecycle(t: float, t_start: float, t_peak: float, t_decay: float, t_end: float) -> float:
    """Smooth 0 to 1 intensity curve: grow, hold, decay."""
    if t <= t_start or t >= t_end:
        return 0.0
    if t < t_peak:
        s = (t - t_start) / max(t_peak - t_start, 1e-6)
        return s * s * (3 - 2 * s)
    if t <= t_decay:
        return 1.0
    s = (t - t_decay) / max(t_end - t_decay, 1e-6)
    return 1.0 - s * s * (3 - 2 * s)


def smooth_noise(shape: tuple[int, int], scale: float, rng: np.random.Generator) -> np.ndarray:
    """Unit-variance noise smoothed to a correlation length of about `scale` cells."""
    ny, nx = shape
    white = rng.standard_normal((ny, nx))
    ky = np.fft.fftfreq(ny)[:, None]
    kx = np.fft.fftfreq(nx)[None, :]
    filt = np.exp(-((ky**2 + kx**2) * (math.pi * scale) ** 2))
    out = np.real(np.fft.ifft2(np.fft.fft2(white) * filt))
    out -= out.mean()
    sd = out.std()
    return out / sd if sd > 0 else out


@dataclass
class _Core:
    along_km: float
    across_km: float
    db_offset: float
    size: float
    phase_min: float


class StormWorld:
    """Renders one scenario on the grid at any time."""

    def __init__(self, scenario: Scenario, grid: Grid = GRID):
        self.sc = scenario
        self.grid = grid
        self.coverage = grid.coverage()
        rng = np.random.default_rng(scenario.seed)
        self._texture = [smooth_noise((96, 96), 5.0, rng), smooth_noise((96, 96), 5.0, rng)]
        self._bt_noise = smooth_noise(grid.shape, 12.0, rng)
        self._cells = []
        for i, c in enumerate(scenario.cells):
            crng = np.random.default_rng(scenario.seed * 1000 + i * 17 + c.seed)
            r0, c0 = grid.lonlat_to_ij(c.lon, c.lat)
            b = math.radians(c.toward_deg)
            east = c.speed_kmh * math.sin(b)
            north = c.speed_kmh * math.cos(b)
            vel = (-north / 60.0 / grid.cell_km, east / 60.0 / grid.cell_km)  # rows, cols per minute
            orient = c.orient_deg if c.orient_deg is not None else c.toward_deg + 90.0
            cores = [_Core(0.0, 0.0, 0.0, 1.0, 0.0)]
            for _ in range(max(0, c.cores - 1)):
                cores.append(
                    _Core(
                        along_km=float(crng.uniform(-1.3, 1.3) * c.radius_km),
                        across_km=float(crng.uniform(-0.7, 0.7) * c.radius_km),
                        db_offset=float(crng.uniform(-8.0, -2.0)),
                        size=float(crng.uniform(0.5, 0.8)),
                        phase_min=float(crng.uniform(-10, 10)),
                    )
                )
            tex_off = (float(crng.uniform(0, 96)), float(crng.uniform(0, 96)))
            self._cells.append((c, float(r0), float(c0), vel, math.radians(orient), cores, tex_off))
        self._clutter = self._make_clutter(rng) if scenario.clutter else None
        self._speckle_rng_seed = scenario.seed * 7 + 3

    # ----- helpers -------------------------------------------------------

    def _cell_pos(self, cell_entry, t: float) -> tuple[float, float]:
        _, r0, c0, vel, *_ = cell_entry
        return r0 + vel[0] * t, c0 + vel[1] * t

    def _make_clutter(self, rng: np.random.Generator):
        g = self.grid
        rr, cc = g.lonlat_to_ij(g.radar.lon, g.radar.lat)
        pts = []
        while len(pts) < 26:
            d = rng.uniform(6, 30)  # cells, 12 to 60 km from the radar
            a = rng.uniform(0, 2 * math.pi)
            r = int(round(rr + d * math.sin(a)))
            c = int(round(cc + d * math.cos(a)))
            if 0 <= r < g.ny and 0 <= c < g.nx:
                pts.append((r, c, rng.uniform(42, 56)))
        return pts

    def _texture_at(self, rows, cols, tex_off, t):
        """Texture that moves with the cell and slowly changes over time."""
        phase = (t / 90.0) * (math.pi / 2)
        a, b = math.cos(phase), math.sin(phase)
        rr = (rows + tex_off[0]) % 96
        cc = (cols + tex_off[1]) % 96
        r0 = np.floor(rr).astype(int)
        c0 = np.floor(cc).astype(int)
        fr = rr - r0
        fc = cc - c0
        r1 = (r0 + 1) % 96
        c1 = (c0 + 1) % 96
        out = 0.0
        for w, tex in ((a, self._texture[0]), (b, self._texture[1])):
            v = (
                tex[r0, c0] * (1 - fr) * (1 - fc)
                + tex[r0, c1] * (1 - fr) * fc
                + tex[r1, c0] * fr * (1 - fc)
                + tex[r1, c1] * fr * fc
            )
            out = out + w * v
        return out

    # ----- truth fields --------------------------------------------------

    def truth_dbz(self, t: float) -> np.ndarray:
        """Noise-free reflectivity in dBZ (0 means no echo), everywhere on the grid."""
        g = self.grid
        z = np.zeros(g.shape)
        km = g.cell_km
        for entry in self._cells:
            c, _, _, vel, orient, cores, tex_off = entry
            pr, pc = self._cell_pos(entry, t)
            sin_o, cos_o = math.sin(orient), math.cos(orient)
            # Unit vectors in (rows, cols): along the long axis, and across it.
            ax = (-cos_o, sin_o)
            cx = (sin_o, cos_o)
            speed = math.hypot(*vel)
            back = (-vel[0] / speed, -vel[1] / speed) if speed > 1e-9 else (0.0, 0.0)
            for core in cores:
                lc = lifecycle(t + core.phase_min, c.t_start, c.t_peak, c.t_decay, c.t_end)
                if lc <= 0.01:
                    continue
                dbz_peak = 15.0 + (c.peak_dbz + core.db_offset - 15.0) * lc
                sig = c.radius_km / km * core.size * (0.55 + 0.45 * lc)
                sa = sig * math.sqrt(c.aspect)
                sb = sig / math.sqrt(c.aspect)
                cr = pr + (core.along_km * ax[0] + core.across_km * cx[0]) / km
                cc_ = pc + (core.along_km * ax[1] + core.across_km * cx[1]) / km
                rad = int(math.ceil(3.5 * max(sa, sb))) + 1
                r_lo, r_hi = max(0, int(cr) - rad), min(g.ny, int(cr) + rad + 1)
                c_lo, c_hi = max(0, int(cc_) - rad), min(g.nx, int(cc_) + rad + 1)
                if r_lo >= r_hi or c_lo >= c_hi:
                    continue
                rows, cols = np.mgrid[r_lo:r_hi, c_lo:c_hi]
                dr = rows - cr
                dc = cols - cc_
                a = dr * ax[0] + dc * ax[1]
                b = dr * cx[0] + dc * cx[1]
                q = (a / sa) ** 2 + (b / sb) ** 2
                tex = self._texture_at(rows - pr, cols - pc, tex_off, t)
                z[r_lo:r_hi, c_lo:c_hi] += 10 ** ((dbz_peak + 2.5 * tex) / 10.0) * np.exp(-0.5 * q)
            # Trailing light rain behind the cell.
            ls = lifecycle(t - 20.0, c.t_start, c.t_peak, c.t_decay, c.t_end + 30.0)
            if c.stratiform > 0 and ls > 0.02:
                sig = 1.7 * c.radius_km / km
                cr = pr + back[0] * 1.4 * c.radius_km / km
                cc_ = pc + back[1] * 1.4 * c.radius_km / km
                rad = int(math.ceil(3.0 * sig)) + 1
                r_lo, r_hi = max(0, int(cr) - rad), min(g.ny, int(cr) + rad + 1)
                c_lo, c_hi = max(0, int(cc_) - rad), min(g.nx, int(cc_) + rad + 1)
                if r_lo < r_hi and c_lo < c_hi:
                    rows, cols = np.mgrid[r_lo:r_hi, c_lo:c_hi]
                    q = ((rows - cr) ** 2 + (cols - cc_) ** 2) / sig**2
                    tex = self._texture_at(rows - pr + 40, cols - pc + 40, tex_off, t)
                    dbz_s = 15.0 + 9.0 * c.stratiform * ls + 2.0 * tex
                    z[r_lo:r_hi, c_lo:c_hi] += 10 ** (dbz_s / 10.0) * np.exp(-0.5 * q)
        dbz = np.where(z > 10 ** (NO_ECHO_DBZ / 10.0), 10.0 * np.log10(np.maximum(z, 1e-9)), 0.0)
        return np.clip(dbz, 0.0, 72.0)

    def brightness_temp(self, t: float) -> np.ndarray:
        """Infrared cloud top brightness temperature in kelvin."""
        g = self.grid
        bt = CLEAR_SKY_K + 1.5 * self._bt_noise
        km = g.cell_km
        for entry in self._cells:
            c, _, _, vel, *_ = entry
            pr, pc = self._cell_pos(entry, t)
            # Cloud tops lead the radar on the way up and linger as anvil on the way down.
            h = lifecycle(t, c.t_start - c.pre_cool_min, c.t_peak - c.pre_cool_min, c.t_decay + 20.0, c.t_end + 45.0)
            if h <= 0.01:
                continue
            t_min = 300.0 - 1.6 * c.peak_dbz - 10.0
            sig = 2.2 * c.radius_km / km * (0.6 + 0.4 * h)
            speed = math.hypot(*vel)
            fwd = (vel[0] / speed, vel[1] / speed) if speed > 1e-9 else (0.0, 0.0)
            cr = pr + fwd[0] * 0.5 * c.radius_km / km * h
            cc_ = pc + fwd[1] * 0.5 * c.radius_km / km * h
            rad = int(math.ceil(3.0 * sig)) + 1
            r_lo, r_hi = max(0, int(cr) - rad), min(g.ny, int(cr) + rad + 1)
            c_lo, c_hi = max(0, int(cc_) - rad), min(g.nx, int(cc_) + rad + 1)
            if r_lo >= r_hi or c_lo >= c_hi:
                continue
            rows, cols = np.mgrid[r_lo:r_hi, c_lo:c_hi]
            q = ((rows - cr) ** 2 + (cols - cc_) ** 2) / sig**2
            shape = np.clip(1.3 * np.exp(-0.5 * q), 0.0, 1.0)
            cell_bt = CLEAR_SKY_K - (CLEAR_SKY_K - t_min) * h * shape
            sub = bt[r_lo:r_hi, c_lo:c_hi]
            bt[r_lo:r_hi, c_lo:c_hi] = np.minimum(sub, cell_bt)
        return bt

    def strikes(self, t0: float, t1: float, rng: np.random.Generator) -> list[tuple[float, float, float]]:
        """Lightning strikes in the window (t0, t1], as (lon, lat, minute)."""
        g = self.grid
        out: list[tuple[float, float, float]] = []
        t_mid = 0.5 * (t0 + t1)
        for entry in self._cells:
            c, _, _, vel, orient, cores, _ = entry
            lc = lifecycle(t_mid, c.t_start, c.t_peak, c.t_decay, c.t_end)
            dbz = 15.0 + (c.peak_dbz - 15.0) * lc
            if lc <= 0 or dbz < 40.0:
                continue
            rate = 3.0 * (dbz - 40.0) ** 1.2 * (c.radius_km / 7.0) ** 2 * (t1 - t0) / 10.0
            n = int(rng.poisson(rate))
            for _ in range(n):
                t = float(rng.uniform(t0, t1))
                pr, pc = self._cell_pos(entry, t)
                core = cores[int(rng.integers(0, len(cores)))]
                sin_o, cos_o = math.sin(orient), math.cos(orient)
                r = pr + (core.along_km * -cos_o + core.across_km * sin_o) / g.cell_km
                cc_ = pc + (core.along_km * sin_o + core.across_km * cos_o) / g.cell_km
                spread = 0.5 * c.radius_km / g.cell_km * core.size
                r += rng.normal(0, spread)
                cc_ += rng.normal(0, spread)
                lon, lat = g.ij_to_lonlat(r, cc_)
                out.append((float(lon), float(lat), round(t, 1)))
        return out

    # ----- observations --------------------------------------------------

    def observe_radar(self, t: float) -> np.ndarray | None:
        """What the radar would report at time t: noise, clutter, speckle, range limit."""
        if int(round(t)) in self.sc.missing_scans:
            return None
        g = self.grid
        rng = np.random.default_rng([self._speckle_rng_seed, int(round(t)) + 10000])
        dbz = self.truth_dbz(t)
        echo = dbz > 0
        dbz = np.where(echo, dbz + rng.normal(0.0, self.sc.noise_db, g.shape), 0.0)
        dbz = np.where(echo & (dbz < NO_ECHO_DBZ), 0.0, dbz)
        n_speck = int(0.0012 * g.nx * g.ny)
        rr = rng.integers(0, g.ny, n_speck)
        cc = rng.integers(0, g.nx, n_speck)
        dbz[rr, cc] = np.maximum(dbz[rr, cc], rng.uniform(12, 30, n_speck))
        if self._clutter:
            for r, c, v in self._clutter:
                dbz[r, c] = max(dbz[r, c], v + rng.normal(0, 0.6))
        dbz = np.clip(dbz, 0.0, 75.0)
        return np.where(self.coverage, dbz, np.nan)


def lightning_density(strikes, grid: Grid = GRID) -> np.ndarray:
    """Strike counts per cell, spread over a 3 x 3 neighbourhood."""
    dens = np.zeros(grid.shape)
    for lon, lat, _ in strikes:
        r, c = grid.lonlat_to_ij(lon, lat)
        r, c = int(round(float(r))), int(round(float(c)))
        if 0 <= r < grid.ny and 0 <= c < grid.nx:
            dens[max(0, r - 1) : r + 2, max(0, c - 1) : c + 2] += 1.0
    return dens


def random_scenario(seed: int, grid: Grid = GRID) -> Scenario:
    """A random mix of storms, used to train and test the fusion step.

    Mature phases last 10 to 150 minutes, as in real convection, and about one
    set in six includes a slow, back-building cluster (the cloudburst pattern).
    """
    rng = np.random.default_rng(seed)
    steer_speed = float(rng.uniform(0, 50))
    steer_dir = float(rng.uniform(0, 360))
    radar = grid.radar
    w, s, e, n = grid.bounds

    def place(d_max: float) -> tuple[float, float]:
        d = float(rng.uniform(10, d_max))
        a = float(rng.uniform(0, 360))
        lon = radar.lon + d * math.sin(math.radians(a)) / (111.32 * math.cos(math.radians(radar.lat)))
        lat = radar.lat + d * math.cos(math.radians(a)) / 110.57
        return min(max(lon, w + 0.2), e - 0.2), min(max(lat, s + 0.2), n - 0.2)

    cells = []
    for i in range(int(rng.integers(3, 11))):
        lon, lat = place(0.85 * radar.range_km)
        late = rng.random() < 0.35
        t_start = float(rng.uniform(-10, 45) if late else rng.uniform(-150, -10))
        grow = float(rng.uniform(20, 60))
        hold = float(rng.uniform(10, 150))
        decay = float(rng.uniform(25, 80))
        cells.append(
            Cell(
                lon=lon,
                lat=lat,
                speed_kmh=max(0.0, steer_speed + float(rng.normal(0, 4))),
                toward_deg=steer_dir + float(rng.normal(0, 12)),
                peak_dbz=float(rng.uniform(38, 60)),
                t_start=t_start,
                t_peak=t_start + grow,
                t_decay=t_start + grow + hold,
                t_end=t_start + grow + hold + decay,
                radius_km=float(rng.uniform(4, 10)),
                aspect=float(rng.uniform(1.0, 2.0)),
                cores=int(rng.integers(1, 4)),
                stratiform=float(rng.uniform(0, 1)),
                pre_cool_min=float(rng.uniform(10, 45)),
                seed=i,
            )
        )
    if rng.random() < 0.17:
        # Back-building: new cores keep forming over the same spot.
        lon, lat = place(0.7 * radar.range_km)
        speed = float(rng.uniform(0, 8))
        toward = float(rng.uniform(0, 360))
        for k in range(3):
            t0 = float(rng.uniform(-90, -40)) + 40.0 * k
            cells.append(
                Cell(lon=lon + 0.02 * k, lat=lat - 0.015 * k, speed_kmh=speed, toward_deg=toward, peak_dbz=float(rng.uniform(52, 60)),
                     t_start=t0, t_peak=t0 + 35, t_decay=t0 + 110, t_end=t0 + 170, radius_km=float(rng.uniform(4, 7)), aspect=1.2,
                     cores=2, stratiform=0.7, pre_cool_min=float(rng.uniform(20, 40)), seed=100 + k)
            )
    return Scenario(id=f"random-{seed}", title="Random", summary="", cells=cells, seed=seed, clutter=rng.random() < 0.7)


def distance_to_radar_km(lon: float, lat: float, grid: Grid = GRID) -> float:
    return float(haversine_km(lon, lat, grid.radar.lon, grid.radar.lat))
