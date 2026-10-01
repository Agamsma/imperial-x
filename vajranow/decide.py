"""Decide: turn forecast fields into what an official needs.

* Storm cells: where each storm is, how fast it moves, what it carries, and
  where it is going, with an uncertainty cone.
* Arrival windows: for each place, when the storm core is expected, as a range
  taken from the ensemble, with an honest flag when timing cannot be trusted.
* New storms: areas where satellite shows fast cloud top cooling before radar
  sees much rain.
* Alerts: short, plain messages in IMD colours.
"""

from __future__ import annotations

import math
from collections import deque
from dataclasses import dataclass, field

import numpy as np

from .advection import Sampler, step_back, step_forward
from .ensemble import Ensemble
from .grid import GRID, Grid, bearing_to_compass, destination, haversine_km
from .hazards import LEVEL_TEXT, LEVELS, THRESHOLDS_DBZ, rain_rate
from .motion import MotionField
from .places import Place, nearest_district

ARRIVAL_DBZ = THRESHOLDS_DBZ["heavy"]  # "storm core" = 45 dBZ within about 3 km
KMH_PER_CELL_STEP = 12.0  # one 2 km cell per 10 minutes = 12 km/h


def label_components(mask: np.ndarray, min_size: int = 1) -> tuple[np.ndarray, int]:
    """8-connected component labelling."""
    labels = np.zeros(mask.shape, dtype=np.int32)
    ny, nx = mask.shape
    n = 0
    for r0, c0 in zip(*np.nonzero(mask)):
        if labels[r0, c0]:
            continue
        n += 1
        q = deque([(r0, c0)])
        labels[r0, c0] = n
        members = [(r0, c0)]
        while q:
            r, c = q.popleft()
            for dr in (-1, 0, 1):
                for dc in (-1, 0, 1):
                    rr, cc = r + dr, c + dc
                    if 0 <= rr < ny and 0 <= cc < nx and mask[rr, cc] and not labels[rr, cc]:
                        labels[rr, cc] = n
                        q.append((rr, cc))
                        members.append((rr, cc))
        if len(members) < min_size:
            for r, c in members:
                labels[r, c] = -1
            n -= 1
    labels[labels < 0] = 0
    return labels, n


def _motion_at(motion: MotionField, rows, cols) -> tuple[float, float]:
    """Mean motion (cols, rows per step) at the given pixels."""
    return float(motion.u[rows, cols].mean()), float(motion.v[rows, cols].mean())


def speed_bearing(u: float, v: float) -> tuple[float, float]:
    east = u * KMH_PER_CELL_STEP
    north = -v * KMH_PER_CELL_STEP
    speed = math.hypot(east, north)
    bearing = (math.degrees(math.atan2(east, north)) + 360.0) % 360.0
    return speed, bearing


def _track(motion: MotionField, r: float, c: float, steps: int, forward: bool = True):
    pr, pc = np.array([r], float), np.array([c], float)
    pts = []
    for _ in range(steps):
        pr, pc = (step_forward if forward else step_back)(pr, pc, motion.u, motion.v)
        pts.append((float(pr[0]), float(pc[0])))
    return pts


def cone_polygon(points: list[tuple[float, float]], widths_km: list[float]) -> list[list[float]]:
    """Uncertainty cone around a track of (lon, lat) points."""
    left, right = [], []
    bearings = []
    for i in range(len(points)):
        j0, j1 = (i, i + 1) if i + 1 < len(points) else (i - 1, i)
        lon0, lat0 = points[j0]
        lon1, lat1 = points[j1]
        dx = (lon1 - lon0) * math.cos(math.radians(lat0))
        dy = lat1 - lat0
        b = (math.degrees(math.atan2(dx, dy)) + 360.0) % 360.0 if (dx or dy) else 0.0
        bearings.append(b)
        left.append(list(destination(points[i][0], points[i][1], b - 90.0, widths_km[i])))
        right.append(list(destination(points[i][0], points[i][1], b + 90.0, widths_km[i])))
    cap = []
    end_lon, end_lat = points[-1]
    for k in range(1, 12):
        cap.append(list(destination(end_lon, end_lat, bearings[-1] - 90.0 + 180.0 * k / 12.0, widths_km[-1])))
    ring = left + cap + right[::-1]
    ring.append(ring[0])
    return [[round(x, 4), round(y, 4)] for x, y in ring]


@dataclass
class StormCell:
    id: str
    lon: float
    lat: float
    max_dbz: float
    area_km2: float
    speed_kmh: float
    toward_deg: float
    trend: str
    growth_30_db: float
    lightning_10min: int
    hail: bool
    gust: bool
    max_rain_mm_h: float
    near: str
    track: list[dict] = field(default_factory=list)
    past: list[list[float]] = field(default_factory=list)
    cone: list[list[float]] = field(default_factory=list)

    def to_json(self) -> dict:
        hazards = []
        if self.lightning_10min > 0 or self.max_dbz >= THRESHOLDS_DBZ["lightning"]:
            hazards.append("Lightning")
        if self.hail:
            hazards.append("Hail signal (experimental)")
        if self.gust:
            hazards.append("Damaging gusts (experimental)")
        if self.max_rain_mm_h >= 50:
            hazards.append("Very heavy rain")
        return {
            "id": self.id,
            "lon": round(self.lon, 4),
            "lat": round(self.lat, 4),
            "max_dbz": round(self.max_dbz, 1),
            "area_km2": round(self.area_km2),
            "speed_kmh": round(self.speed_kmh),
            "toward_deg": round(self.toward_deg),
            "toward": bearing_to_compass(self.toward_deg),
            "trend": self.trend,
            "growth_30_db": round(self.growth_30_db, 1),
            "lightning_10min": self.lightning_10min,
            "max_rain_mm_h": round(self.max_rain_mm_h),
            "near": self.near,
            "hazards": hazards,
            "track": self.track,
            "past": self.past,
            "cone": self.cone,
        }


def find_cells(dbz0, motion: MotionField, g30, strikes_recent, sigma_off_kmh: float, grid: Grid = GRID) -> list[StormCell]:
    z = np.nan_to_num(dbz0, nan=0.0)
    labels, n = label_components(z >= THRESHOLDS_DBZ["lightning"], min_size=3)
    cells: list[StormCell] = []
    s_lon = np.array([s[0] for s in strikes_recent]) if strikes_recent else np.zeros(0)
    s_lat = np.array([s[1] for s in strikes_recent]) if strikes_recent else np.zeros(0)
    for k in range(1, n + 1):
        rows, cols = np.nonzero(labels == k)
        w = 10 ** (z[rows, cols] / 10.0)
        r = float((rows * w).sum() / w.sum())
        c = float((cols * w).sum() / w.sum())
        lon, lat = (float(x) for x in grid.ij_to_lonlat(r, c))
        u, v = _motion_at(motion, rows, cols)
        speed, bearing = speed_bearing(u, v)
        growth = float(g30[rows, cols].mean()) if g30 is not None else 0.0
        trend = "Growing" if growth >= 3.0 else "Weakening" if growth <= -3.0 else "Steady"
        max_dbz = float(z[rows, cols].max())
        area = float(len(rows) * grid.cell_km**2)
        radius_km = math.sqrt(area / math.pi) + 4.0
        n_ltg = int((haversine_km(s_lon, s_lat, lon, lat) <= radius_km).sum()) if len(s_lon) else 0
        fwd = _track(motion, r, c, 12)
        track = [{"t": 0, "lon": round(lon, 4), "lat": round(lat, 4)}]
        pts = [(lon, lat)]
        widths = [2.0]
        for i, (fr, fc) in enumerate(fwd):
            t = 10 * (i + 1)
            flon, flat = (float(x) for x in grid.ij_to_lonlat(fr, fc))
            track.append({"t": t, "lon": round(flon, 4), "lat": round(flat, 4)})
            pts.append((flon, flat))
            h = t / 60.0
            widths.append(2.0 + 1.28 * math.hypot(sigma_off_kmh * h, 0.08 * speed * h))
        past = [[round(float(x), 4) for x in grid.ij_to_lonlat(pr, pc)] for pr, pc in _track(motion, r, c, 3, forward=False)]
        cells.append(
            StormCell(
                id="",
                lon=lon,
                lat=lat,
                max_dbz=max_dbz,
                area_km2=area,
                speed_kmh=speed,
                toward_deg=bearing,
                trend=trend,
                growth_30_db=growth,
                lightning_10min=n_ltg,
                hail=max_dbz >= THRESHOLDS_DBZ["hail"],
                gust=speed >= 30.0 and max_dbz >= THRESHOLDS_DBZ["severe"],
                max_rain_mm_h=float(rain_rate(np.array([max_dbz]))[0]),
                near=nearest_district(lon, lat),
                track=track,
                past=past[::-1] + [[round(lon, 4), round(lat, 4)]],
                cone=cone_polygon(pts, widths),
            )
        )
    cells.sort(key=lambda x: -x.max_dbz)
    for i, cell in enumerate(cells):
        cell.id = chr(ord("A") + i) if i < 26 else f"Z{i}"
    return cells


@dataclass
class InitiationZone:
    lon: float
    lat: float
    radius_km: float
    max_growth_db: float
    near: str
    chance: str
    in_radar_range: bool

    def to_json(self) -> dict:
        return {
            "lon": round(self.lon, 4),
            "lat": round(self.lat, 4),
            "radius_km": round(self.radius_km, 1),
            "max_growth_db": round(self.max_growth_db, 1),
            "near": self.near,
            "chance": self.chance,
            "in_radar_range": self.in_radar_range,
        }


def find_initiation(dbz0, g30, coverage, grid: Grid = GRID) -> list[InitiationZone]:
    """Where the fusion step expects new echoes that radar does not show yet."""
    if g30 is None:
        return []
    z = np.nan_to_num(dbz0, nan=0.0)
    mask = (g30 >= 8.0) & (z < 20.0)
    labels, n = label_components(mask, min_size=4)
    zones = []
    for k in range(1, n + 1):
        rows, cols = np.nonzero(labels == k)
        w = np.maximum(g30[rows, cols], 0.1)
        r = float((rows * w).sum() / w.sum())
        c = float((cols * w).sum() / w.sum())
        lon, lat = (float(x) for x in grid.ij_to_lonlat(r, c))
        area = len(rows) * grid.cell_km**2
        gmax = float(g30[rows, cols].max())
        zones.append(
            InitiationZone(
                lon=lon,
                lat=lat,
                radius_km=math.sqrt(area / math.pi) + 6.0,
                max_growth_db=gmax,
                near=nearest_district(lon, lat),
                chance="likely" if gmax >= 15.0 else "possible",
                in_radar_range=bool(coverage[int(round(r)), int(round(c))]),
            )
        )
    zones.sort(key=lambda zz: -zz.max_growth_db)
    return zones


@dataclass
class Probabilities:
    """Per-lead probability grids (lead index -> grid)."""

    storm: list[np.ndarray]
    lightning: list[np.ndarray]
    heavy: list[np.ndarray]
    severe: list[np.ndarray]
    hail: list[np.ndarray]
    rain50: np.ndarray  # next hour
    rain100: np.ndarray
    rain_median_mm: np.ndarray
    rain_p90_mm: np.ndarray


def window_values(arr: np.ndarray, r: int, c: int, radius: int = 1) -> np.ndarray:
    ny, nx = arr.shape[-2:]
    return arr[..., max(0, r - radius) : min(ny, r + radius + 1), max(0, c - radius) : min(nx, c + radius + 1)]


@dataclass
class PlaceForecast:
    id: str
    name: str
    lon: float
    lat: float
    elev_m: float | None
    kind: str
    covered: bool
    levels: list[int]  # lead 0 (now), 10, ..., 120
    worst_level: int
    arrival: dict
    hazards: list[str]
    motion_confidence: float
    rain_next_hour_mm: dict
    probability: dict  # per lead lists

    def to_json(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "lon": self.lon,
            "lat": self.lat,
            "elev_m": self.elev_m,
            "kind": self.kind,
            "covered": self.covered,
            "levels": self.levels,
            "level": LEVELS[self.worst_level],
            "arrival": self.arrival,
            "hazards": self.hazards,
            "motion_confidence": round(self.motion_confidence, 2),
            "rain_next_hour_mm": self.rain_next_hour_mm,
            "probability": self.probability,
        }


def assess_point(
    place: Place,
    ens: Ensemble,
    levels: np.ndarray,
    obs_levels: np.ndarray,
    probs: Probabilities,
    dbz0: np.ndarray,
    motion: MotionField,
    coverage: np.ndarray,
    cells: list[StormCell],
    zones: list[InitiationZone],
    grid: Grid = GRID,
    terrain_known: bool = True,
) -> PlaceForecast:
    rf, cf = grid.lonlat_to_ij(place.lon, place.lat)
    r, c = int(round(float(rf))), int(round(float(cf)))
    r = min(max(r, 0), grid.ny - 1)
    c = min(max(c, 0), grid.nx - 1)
    covered = bool(coverage[r, c])

    # Ensemble series near the place (within about 3 km).
    win = window_values(ens.members, r, c, 1)
    series = win.reshape(win.shape[0], win.shape[1], -1).max(-1).astype(float) / 3.0  # (members, leads)
    s0 = float(window_values(np.nan_to_num(dbz0, nan=0.0), r, c, 1).max())
    full = np.concatenate([np.full((series.shape[0], 1), s0), series], axis=1)  # leads 0..120
    times = np.array([0] + ens.leads, float)
    arrivals = []
    for row in full:
        idx = np.nonzero(row >= ARRIVAL_DBZ)[0]
        if not len(idx):
            continue
        i = int(idx[0])
        if i == 0:
            arrivals.append(0.0)
        else:
            a, b = row[i - 1], row[i]
            frac = (ARRIVAL_DBZ - a) / (b - a) if b > a else 1.0
            arrivals.append(times[i - 1] + 10.0 * float(np.clip(frac, 0, 1)))
    frac_hit = len(arrivals) / full.shape[0]

    # Tracking confidence along the path the air takes to reach the place.
    pr, pc = np.array([float(rf)]), np.array([float(cf)])
    confs = []
    for _ in range(6):
        confs.append(float(Sampler(pr, pc, motion.confidence.shape, clamp=True)(motion.confidence)[0]))
        pr, pc = step_back(pr, pc, motion.u, motion.v)
    motion_conf = float(np.mean(confs))

    p_storm = [float(window_values(p, r, c, 0).max()) for p in probs.storm]
    p_ltg = [float(window_values(p, r, c, 0).max()) for p in probs.lightning]
    p_heavy = [float(window_values(p, r, c, 0).max()) for p in probs.heavy]
    p_severe = [float(window_values(p, r, c, 0).max()) for p in probs.severe]
    p_hail = [float(window_values(p, r, c, 0).max()) for p in probs.hail]
    p_r50 = float(window_values(probs.rain50, r, c, 0).max())
    p_r100 = float(window_values(probs.rain100, r, c, 0).max())

    lv_now = int(window_values(obs_levels, r, c, 0).max())
    lv = [lv_now] + [int(window_values(levels[i], r, c, 0).max()) for i in range(levels.shape[0])]
    worst = max(lv)

    near_init = any(haversine_km(z.lon, z.lat, place.lon, place.lat) <= z.radius_km + 15.0 for z in zones)
    hilly = place.elev_m is not None and place.elev_m >= 800.0

    hazards = []
    if max(p_ltg) >= 0.5:
        hazards.append("Lightning likely")
    elif max(p_ltg) >= 0.3:
        hazards.append("Lightning possible")
    if max(p_hail) >= 0.3:
        hazards.append("Hail signal (experimental)")
    if p_r100 >= 0.3:
        hazards.append("Cloudburst threshold may be crossed (experimental)")
    elif p_r50 >= 0.3:
        hazards.append("Very heavy rain burst possible (experimental)")
    for cell in cells:
        if not cell.gust:
            continue
        if any(haversine_km(p["lon"], p["lat"], place.lon, place.lat) <= 12.0 for p in cell.track):
            hazards.append("Damaging gusts possible (experimental)")
            break
    if near_init:
        hazards.append("New storms may form nearby (experimental)")

    pct = int(round(100 * frac_hit))
    if not covered:
        arrival = {
            "status": "outside",
            "text": "Outside radar coverage",
            "detail": "No radar here, so no arrival time. Satellite can still show storms forming.",
            "window": None,
            "most_likely": None,
            "chance": None,
            "confidence": None,
        }
    elif hilly and motion_conf < 0.45 and (frac_hit >= 0.1 or near_init or max(p_storm) >= 0.2):
        arrival = {
            "status": "unreliable",
            "text": "Not reliable (terrain, low motion confidence)",
            "detail": "Storms may form over the hills nearby. Check again at the next update.",
            "window": None,
            "most_likely": None,
            "chance": pct,
            "confidence": "low",
        }
    elif frac_hit >= 0.5:
        lo = int(5 * math.floor(np.percentile(arrivals, 10) / 5))
        hi = int(5 * math.ceil(np.percentile(arrivals, 90) / 5))
        mid = int(5 * round(np.percentile(arrivals, 50) / 5))
        if hi == 0:
            text = "Storm core overhead now"
            status = "now"
            detail = f"The storm core is over this place now. {pct}% of ensemble members agree."
        else:
            text = f"About {mid} min" if hi - lo <= 5 else f"{lo} to {hi} min"
            status = "expected"
            detail = f"Storm core arrival. Most likely around {mid} min. {pct}% of ensemble members agree."
        spread = hi - lo
        conf = "high" if frac_hit >= 0.8 and spread <= 20 else "medium" if frac_hit >= 0.6 and spread <= 40 else "low"
        arrival = {
            "status": status,
            "text": text,
            "detail": detail,
            "window": [lo, hi],
            "most_likely": mid,
            "chance": pct,
            "confidence": conf,
        }
    elif frac_hit >= 0.2:
        lo = int(5 * math.floor(np.percentile(arrivals, 10) / 5))
        arrival = {
            "status": "possible",
            "text": f"Possible from about {lo} min ({pct}% chance)",
            "detail": "Some ensemble members bring a storm core here, most do not.",
            "window": [lo, int(5 * math.ceil(np.percentile(arrivals, 90) / 5))],
            "most_likely": None,
            "chance": pct,
            "confidence": "low",
        }
    else:
        weak = max(p_storm) >= 0.3
        arrival = {
            "status": "none",
            "text": "No storm core expected in the next 2 h",
            "detail": "Rain or a weaker storm is possible." if weak else "Away from the forecast storm tracks.",
            "window": None,
            "most_likely": None,
            "chance": pct,
            "confidence": None,
        }
    if not terrain_known and arrival["status"] not in ("outside",):
        arrival["detail"] += " Terrain is not checked for map clicks."
    if arrival["status"] == "unreliable":
        # Storms may form nearby and timing cannot be trusted: at least "be updated".
        worst = max(worst, 1)

    rain_med = float(window_values(probs.rain_median_mm, r, c, 0).max())
    rain_p90 = float(window_values(probs.rain_p90_mm, r, c, 0).max())
    return PlaceForecast(
        id=place.id,
        name=place.name,
        lon=place.lon,
        lat=place.lat,
        elev_m=place.elev_m,
        kind=place.kind,
        covered=covered,
        levels=lv,
        worst_level=worst,
        arrival=arrival,
        hazards=hazards,
        motion_confidence=motion_conf,
        rain_next_hour_mm={"median": round(rain_med), "p90": round(rain_p90)},
        probability={
            "storm": [round(x, 2) for x in p_storm],
            "lightning": [round(x, 2) for x in p_ltg],
            "heavy": [round(x, 2) for x in p_heavy],
            "severe": [round(x, 2) for x in p_severe],
            "hail": [round(x, 2) for x in p_hail],
            "rain50": round(p_r50, 2),
            "rain100": round(p_r100, 2),
        },
    )


def build_alerts(places: list[PlaceForecast], zones: list[InitiationZone], probs: Probabilities, grid: Grid = GRID) -> list[dict]:
    alerts = []
    for p in places:
        status = p.arrival["status"]
        if p.worst_level == 0 and status not in ("unreliable",):
            continue
        name, action = LEVEL_TEXT[LEVELS[p.worst_level]]
        parts = []
        if status == "now":
            parts.append("Storm core overhead now.")
        elif status == "expected":
            parts.append(f"Storm core in {p.arrival['text'].replace('About', 'about')} (most likely {p.arrival['most_likely']} min).")
        elif status == "possible":
            parts.append(f"A storm core may arrive from about {p.arrival['window'][0]} min ({p.arrival['chance']}% chance).")
        elif status == "unreliable":
            parts.append("Storms may form over the hills nearby. Arrival time is not reliable here (terrain, low motion confidence).")
        elif status == "outside":
            parts.append("Outside radar coverage.")
        else:
            parts.append("Rain or weaker storms possible in the next 2 h.")
        extra = [h for h in p.hazards if not h.startswith("New storms")]
        if extra:
            parts.append(". ".join(extra) + ".")
        if p.arrival.get("confidence") and status in ("expected", "now"):
            parts.append(f"Confidence: {p.arrival['confidence']}.")
        alerts.append(
            {
                "kind": "place",
                "place_id": p.id,
                "level": LEVELS[p.worst_level],
                "title": f"{p.name}: {name}, {action.lower()}",
                "body": " ".join(parts),
                "sort": (-p.worst_level, 0, p.arrival.get("most_likely") or 999),
            }
        )
    for z in zones:
        body = "Satellite shows cloud tops cooling fast where radar sees little rain yet. Storms may appear here in the next 30 to 60 min (experimental)."
        if not z.in_radar_range:
            body += " This area is outside radar coverage, so only satellite sees it."
        alerts.append(
            {
                "kind": "area",
                "place_id": None,
                "level": "yellow",
                "title": f"New storms {'likely' if z.chance == 'likely' else 'possible'} near {z.near}",
                "body": body,
                "lon": round(z.lon, 4),
                "lat": round(z.lat, 4),
                "sort": (-1, 1, 999),
            }
        )
    cb = probs.rain100 >= 0.4
    if cb.any():
        labels, n = label_components(cb, min_size=2)
        for k in range(1, n + 1):
            rows, cols = np.nonzero(labels == k)
            r, c = rows.mean(), cols.mean()
            lon, lat = (float(x) for x in grid.ij_to_lonlat(r, c))
            alerts.append(
                {
                    "kind": "area",
                    "place_id": None,
                    "level": "red",
                    "title": f"Cloudburst threshold may be crossed near {nearest_district(lon, lat)}",
                    "body": "More than 100 mm of rain in the next hour is possible over a small area (experimental). Watch for flash floods and landslides on slopes.",
                    "lon": round(lon, 4),
                    "lat": round(lat, 4),
                    "sort": (-3, 1, 0),
                }
            )
    alerts.sort(key=lambda a: a["sort"])
    for a in alerts:
        a.pop("sort")
    return alerts
