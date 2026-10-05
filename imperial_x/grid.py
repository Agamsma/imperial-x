"""The analysis grid: about 2 km cells over south Kerala, aligned to Web Mercator.

Cells are square in Web Mercator, so a rendered grid drops straight onto a web
map as an image overlay with no warping. Row 0 is the northern edge, matching
image order. Ground size is 2 km at the centre latitude and varies by under
2 percent across the domain.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

import numpy as np

R_EARTH = 6378137.0  # Web Mercator sphere radius, metres
EARTH_MEAN_KM = 6371.0


def lonlat_to_merc(lon, lat):
    lon = np.asarray(lon, dtype=float)
    lat = np.asarray(lat, dtype=float)
    x = R_EARTH * np.radians(lon)
    y = R_EARTH * np.log(np.tan(np.pi / 4 + np.radians(lat) / 2))
    return x, y


def merc_to_lonlat(x, y):
    x = np.asarray(x, dtype=float)
    y = np.asarray(y, dtype=float)
    lon = np.degrees(x / R_EARTH)
    lat = np.degrees(2 * np.arctan(np.exp(y / R_EARTH)) - np.pi / 2)
    return lon, lat


def haversine_km(lon1, lat1, lon2, lat2):
    lon1, lat1, lon2, lat2 = (np.radians(np.asarray(v, dtype=float)) for v in (lon1, lat1, lon2, lat2))
    a = np.sin((lat2 - lat1) / 2) ** 2 + np.cos(lat1) * np.cos(lat2) * np.sin((lon2 - lon1) / 2) ** 2
    return 2 * EARTH_MEAN_KM * np.arcsin(np.sqrt(np.clip(a, 0, 1)))


def destination(lon: float, lat: float, bearing_deg: float, dist_km: float) -> tuple[float, float]:
    """Point reached from (lon, lat) after dist_km along an initial bearing."""
    b = math.radians(bearing_deg)
    d = dist_km / EARTH_MEAN_KM
    p1 = math.radians(lat)
    l1 = math.radians(lon)
    p2 = math.asin(math.sin(p1) * math.cos(d) + math.cos(p1) * math.sin(d) * math.cos(b))
    l2 = l1 + math.atan2(math.sin(b) * math.sin(d) * math.cos(p1), math.cos(d) - math.sin(p1) * math.sin(p2))
    return math.degrees(l2), math.degrees(p2)


@dataclass(frozen=True)
class Radar:
    name: str
    lon: float
    lat: float
    range_km: float


# ISRO Doppler Weather Radar at TERLS, Thumba (Thiruvananthapuram).
TERLS = Radar(name="TERLS Doppler Weather Radar (Thumba)", lon=76.8695, lat=8.5378, range_km=250.0)


@dataclass(frozen=True)
class Grid:
    lon_min: float = 74.6
    lon_max: float = 78.4
    lat_min: float = 7.6
    lat_max: float = 11.0
    cell_km: float = 2.0
    radar: Radar = TERLS
    # Filled in by __post_init__.
    dx: float = field(init=False)
    x0: float = field(init=False)
    y_top: float = field(init=False)
    nx: int = field(init=False)
    ny: int = field(init=False)

    def __post_init__(self):
        lat_c = (self.lat_min + self.lat_max) / 2
        dx = self.cell_km * 1000.0 / math.cos(math.radians(lat_c))
        x0, y_bot = lonlat_to_merc(self.lon_min, self.lat_min)
        x1, y_top = lonlat_to_merc(self.lon_max, self.lat_max)
        object.__setattr__(self, "dx", float(dx))
        object.__setattr__(self, "x0", float(x0))
        object.__setattr__(self, "y_top", float(y_top))
        object.__setattr__(self, "nx", int(round((float(x1) - float(x0)) / dx)))
        object.__setattr__(self, "ny", int(round((float(y_top) - float(y_bot)) / dx)))

    @property
    def shape(self) -> tuple[int, int]:
        return self.ny, self.nx

    @property
    def bounds(self) -> tuple[float, float, float, float]:
        """Exact (west, south, east, north) edges of the grid in degrees."""
        west, north = merc_to_lonlat(self.x0, self.y_top)
        east, south = merc_to_lonlat(self.x0 + self.nx * self.dx, self.y_top - self.ny * self.dx)
        return float(west), float(south), float(east), float(north)

    def corners(self) -> list[list[float]]:
        """Image corners for a MapLibre image source: NW, NE, SE, SW."""
        w, s, e, n = self.bounds
        return [[w, n], [e, n], [e, s], [w, s]]

    def ij_to_lonlat(self, row, col):
        x = self.x0 + (np.asarray(col, dtype=float) + 0.5) * self.dx
        y = self.y_top - (np.asarray(row, dtype=float) + 0.5) * self.dx
        return merc_to_lonlat(x, y)

    def lonlat_to_ij(self, lon, lat):
        x, y = lonlat_to_merc(lon, lat)
        col = (x - self.x0) / self.dx - 0.5
        row = (self.y_top - y) / self.dx - 0.5
        return row, col

    def centres(self) -> tuple[np.ndarray, np.ndarray]:
        rows, cols = np.mgrid[0 : self.ny, 0 : self.nx]
        lon, lat = self.ij_to_lonlat(rows, cols)
        return lon, lat

    def coverage(self) -> np.ndarray:
        """True where the cell centre is inside the radar's quantitative range."""
        lon, lat = self.centres()
        return haversine_km(lon, lat, self.radar.lon, self.radar.lat) <= self.radar.range_km

    def km_per_cell(self) -> float:
        return self.cell_km

    def kmh_per_cell_step(self, step_min: float = 10.0) -> float:
        """Speed in km/h of a displacement of one cell per time step."""
        return self.cell_km * 60.0 / step_min


GRID = Grid()


def range_ring(radar: Radar = TERLS, n: int = 128) -> list[list[float]]:
    pts = [list(destination(radar.lon, radar.lat, 360.0 * i / n, radar.range_km)) for i in range(n)]
    pts.append(pts[0])
    return pts


def bearing_to_compass(deg: float) -> str:
    names = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
    return names[int(((deg % 360) + 22.5) // 45) % 8]
