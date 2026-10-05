"""Places we issue arrival windows for, and district centres used to name areas.

Coordinates and elevations are approximate public values, good to a few hundred
metres. Elevation is only used to flag complex terrain.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .grid import haversine_km

HILLY_M = 800.0  # above this, forecasts of storm motion are treated with care


@dataclass(frozen=True)
class Place:
    id: str
    name: str
    lon: float
    lat: float
    elev_m: float
    kind: str  # airport, city, town, dam, pilgrimage

    @property
    def hilly(self) -> bool:
        return self.elev_m >= HILLY_M


PLACES: tuple[Place, ...] = (
    Place("cok", "Kochi Airport", 76.401, 10.152, 9, "airport"),
    Place("thrissur", "Thrissur", 76.214, 10.527, 3, "city"),
    Place("alappuzha", "Alappuzha", 76.338, 9.498, 1, "town"),
    Place("kottayam", "Kottayam", 76.522, 9.591, 3, "town"),
    Place("munnar", "Munnar", 77.060, 10.089, 1532, "town"),
    Place("idukki-dam", "Idukki Dam", 76.976, 9.843, 730, "dam"),
    Place("sabarimala", "Sabarimala", 77.080, 9.435, 914, "pilgrimage"),
    Place("pathanamthitta", "Pathanamthitta", 76.787, 9.264, 40, "town"),
    Place("kollam", "Kollam", 76.614, 8.893, 5, "city"),
    Place("tvm", "Thiruvananthapuram", 76.936, 8.524, 10, "city"),
)

PLACE_BY_ID = {p.id: p for p in PLACES}

# District headquarters, for naming areas such as "near Idukki".
DISTRICTS: tuple[tuple[str, float, float], ...] = (
    ("Thiruvananthapuram", 76.936, 8.524),
    ("Kollam", 76.614, 8.893),
    ("Pathanamthitta", 76.787, 9.264),
    ("Alappuzha", 76.338, 9.498),
    ("Kottayam", 76.522, 9.591),
    ("Idukki", 76.970, 9.850),
    ("Ernakulam", 76.300, 10.000),
    ("Thrissur", 76.214, 10.527),
    ("Palakkad", 76.651, 10.787),
    ("Kanyakumari", 77.410, 8.180),
    ("Tirunelveli", 77.756, 8.714),
    ("Tenkasi", 77.315, 8.959),
    ("Theni", 77.476, 10.010),
    ("the Arabian Sea coast", 75.700, 9.600),
)


def nearest_district(lon: float, lat: float) -> str:
    names = [d[0] for d in DISTRICTS]
    lons = np.array([d[1] for d in DISTRICTS])
    lats = np.array([d[2] for d in DISTRICTS])
    d = haversine_km(lon, lat, lons, lats)
    # Far offshore cells are named by the sea, not the nearest town.
    if lon < 75.9:
        return "the Arabian Sea coast"
    return names[int(np.argmin(d))]
