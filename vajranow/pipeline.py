"""The full nowcast: Ingest, Align, Predict, Decide, Show.

run_nowcast(scenario_id) runs every stage on a synthetic scenario and returns a
NowcastRun holding the arrays (for point queries) and a JSON-ready bundle for
the dashboard.
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from functools import lru_cache

import numpy as np

from . import DISCLAIMER, __version__
from .decide import (
    InitiationZone,
    PlaceForecast,
    Probabilities,
    StormCell,
    assess_point,
    build_alerts,
    find_cells,
    find_initiation,
)
from .ensemble import Ensemble, run_ensemble
from .filters import neighbourhood_max
from .fusion import FEATURE_NAMES, build_features, get_model, growth_at_lead
from .grid import GRID, bearing_to_compass, range_ring
from .hazards import LEVEL_TEXT, LEVELS, RAIN_1H_CLOUDBURST_MM, RAIN_1H_HEAVY_MM, THRESHOLDS_DBZ, exceedance, level_grid, method_summary, observed_level_grid, rain_rate
from .observe import Analysis, analyse
from .places import PLACES, Place
from .contour import level_features
from .render import RADAR_LEGEND, data_url, radar_png
from .scenarios import SCENARIOS
from .synthetic import Scenario

N_MEMBERS = 20


@dataclass
class NowcastRun:
    scenario: Scenario
    analysis: Analysis
    ens: Ensemble
    g30: np.ndarray
    g60: np.ndarray
    levels: np.ndarray  # (leads, ny, nx)
    obs_levels: np.ndarray
    probs: Probabilities
    cells: list[StormCell]
    zones: list[InitiationZone]
    places: list[PlaceForecast]
    bundle: dict
    timings_ms: dict

    def point(self, lon: float, lat: float) -> dict:
        place = Place(id="point", name="Selected point", lon=float(lon), lat=float(lat), elev_m=None, kind="point")
        pf = assess_point(place, self.ens, self.levels, self.obs_levels, self.probs, self.analysis.dbz0,
                          self.analysis.motion, self.analysis.coverage, self.cells, self.zones, terrain_known=False)
        out = pf.to_json()
        out["leads"] = [0] + self.ens.leads
        return out


def _probabilities(ens: Ensemble) -> tuple[Probabilities, np.ndarray]:
    thr = THRESHOLDS_DBZ
    storm, ltg, heavy, severe, hail, levels = [], [], [], [], [], []
    rain_hour = None
    for li, lead in enumerate(ens.leads):
        members = ens.member_dbz(li)
        radius = 1 if lead <= 60 else 2
        p = exceedance(members, [thr["storm"], thr["lightning"], thr["heavy"], thr["severe"], thr["hail"]], radius)
        storm.append(p[thr["storm"]])
        ltg.append(p[thr["lightning"]])
        heavy.append(p[thr["heavy"]])
        severe.append(p[thr["severe"]])
        hail.append(p[thr["hail"]])
        if lead <= 60:
            r = rain_rate(members) * (10.0 / 60.0)
            rain_hour = r if rain_hour is None else rain_hour + r
    rain_nmax = neighbourhood_max(rain_hour, 1)
    probs = Probabilities(
        storm=storm,
        lightning=ltg,
        heavy=heavy,
        severe=severe,
        hail=hail,
        rain50=(rain_nmax >= RAIN_1H_HEAVY_MM).mean(0),
        rain100=(rain_nmax >= RAIN_1H_CLOUDBURST_MM).mean(0),
        rain_median_mm=np.median(rain_hour, axis=0),
        rain_p90_mm=np.percentile(rain_hour, 90, axis=0),
    )
    for li, lead in enumerate(ens.leads):
        first_hour = lead <= 60
        levels.append(
            level_grid(
                probs.storm[li], probs.heavy[li], probs.severe[li],
                probs.rain50 if first_hour else None, probs.rain100 if first_hour else None,
            )
        )
    return probs, np.stack(levels)


def _outlook(ens: Ensemble, probs: Probabilities, motion, zones: list[InitiationZone]) -> np.ndarray:
    """Broad 3 to 6 hour area to watch: storms carried on by the mean motion, plus new-storm zones."""
    from .advection import Sampler, grid_positions

    base = (probs.storm[-1] >= 0.2).astype(float)
    shape = base.shape
    out = np.zeros(shape, dtype=bool)
    rows, cols = grid_positions(shape)
    for hours in (1, 2, 3, 4):
        steps = 6 * hours
        moved = Sampler(rows - motion.mean_v * steps, cols - motion.mean_u * steps, shape)(base) > 0.5
        out |= neighbourhood_max(moved.astype(float), 4 + 3 * hours) > 0.5
    for z in zones:
        rr, cc = GRID.lonlat_to_ij(z.lon, z.lat)
        rad = int(z.radius_km / GRID.cell_km) + 10
        r0, c0 = int(round(float(rr))), int(round(float(cc)))
        rr_, cc_ = np.ogrid[: shape[0], : shape[1]]
        out |= (rr_ - r0) ** 2 + (cc_ - c0) ** 2 <= rad**2
    # Coarsen to about 10 km blocks for a deliberately broad look.
    k = 5
    ny, nx = shape
    coarse = np.zeros(((ny + k - 1) // k, (nx + k - 1) // k), dtype=bool)
    for i in range(coarse.shape[0]):
        for j in range(coarse.shape[1]):
            coarse[i, j] = out[i * k : (i + 1) * k, j * k : (j + 1) * k].mean() > 0.3
    return np.kron(coarse, np.ones((k, k), dtype=bool))[:ny, :nx].astype(np.int8)


def _arrow(lon, lat, dlon, dlat) -> list[list[list[float]]]:
    """Shaft and head of a motion arrow as line segments."""
    tip = [lon + dlon, lat + dlat]
    ang = np.arctan2(dlat, dlon)
    length = np.hypot(dlon, dlat) * 0.32
    heads = []
    for da in (2.6, -2.6):
        heads.append([[round(tip[0], 4), round(tip[1], 4)], [round(tip[0] + length * np.cos(ang + da), 4), round(tip[1] + length * np.sin(ang + da), 4)]])
    return [[[round(lon, 4), round(lat, 4)], [round(tip[0], 4), round(tip[1], 4)]]] + heads


def _motion_geojson(an: Analysis) -> dict:
    m = an.motion
    feats = []
    z = np.nan_to_num(an.dbz0, nan=0.0)
    echo_near = neighbourhood_max(z, 6) >= 20.0
    step = 9
    for r in range(step // 2, GRID.ny, step):
        for c in range(step // 2, GRID.nx, step):
            if not (echo_near[r, c] and an.coverage[r, c]):
                continue
            u, v = float(m.u[r, c]), float(m.v[r, c])
            if np.hypot(u, v) < 0.15:
                continue
            lon, lat = (float(x) for x in GRID.ij_to_lonlat(r, c))
            lon2, lat2 = (float(x) for x in GRID.ij_to_lonlat(r + 3 * v, c + 3 * u))  # 30 min of motion
            speed = np.hypot(u, v) * 12.0
            feats.append(
                {
                    "type": "Feature",
                    "properties": {"speed_kmh": round(float(speed)), "confidence": round(float(m.confidence[r, c]), 2)},
                    "geometry": {"type": "MultiLineString", "coordinates": _arrow(lon, lat, lon2 - lon, lat2 - lat)},
                }
            )
    return {"type": "FeatureCollection", "features": feats}


def _strikes_geojson(strikes, t_end: int) -> dict:
    feats = [
        {"type": "Feature", "properties": {"age_min": round(t_end - t, 1)}, "geometry": {"type": "Point", "coordinates": [round(lon, 4), round(lat, 4)]}}
        for lon, lat, t in strikes
        if t_end - 10 < t <= t_end
    ]
    return {"type": "FeatureCollection", "features": feats}


def _feeds(sc: Scenario, an: Analysis) -> list[dict]:
    missing = an.qc.missing_scans
    radar_detail = f"Latest scan {sc.radar_latency_min} min old"
    if missing:
        radar_detail += f", {len(missing)} scan missing ({', '.join(str(t) for t in missing)} min)"
    return [
        {"id": "radar", "label": "Radar", "status": "ok" if not missing else "degraded", "detail": radar_detail, "source": "Synthetic stand-in for MOSDAC TERLS Doppler radar"},
        {"id": "satellite", "label": "Satellite", "status": "ok" if sc.sat_latency_min <= 20 else "stale", "detail": f"Latest image {sc.sat_latency_min} min old", "source": "Synthetic stand-in for INSAT-3D/3DR infrared"},
        {"id": "lightning", "label": "Lightning", "status": "proxy", "detail": "Synthetic strikes (IITM network planned)", "source": "Synthetic proxy"},
    ]


def _run(scenario_id: str) -> NowcastRun:
    if scenario_id not in SCENARIOS:
        raise KeyError(scenario_id)
    sc = SCENARIOS[scenario_id]
    timings: dict[str, float] = {}
    t = time.perf_counter()

    def lap(name: str):
        nonlocal t
        now = time.perf_counter()
        timings[name] = round((now - t) * 1000.0, 1)
        t = now

    an = analyse(sc)
    lap("ingest_qc_motion")

    feats = build_features(an.dbz0, an.dbz_prev_moved, an.bt_now, an.bt_prev, sc.sat_interval_min, an.lightning_recent, an.coverage)
    model = get_model()
    if model is not None:
        g30, g60 = model.predict(feats)
    else:
        g30 = np.zeros(an.dbz0.shape)
        g60 = np.zeros(an.dbz0.shape)
    lap("fusion")

    ens = run_ensemble(an.dbz0, an.motion, g30, g60, an.coverage, n_members=N_MEMBERS, seed=sc.seed)
    lap("ensemble")

    probs, levels = _probabilities(ens)
    obs_levels = observed_level_grid(an.dbz0)
    zones = find_initiation(an.dbz0, g30, an.coverage)
    recent = [s for s in an.strikes if s[2] > -10]
    cells = find_cells(an.dbz0, an.motion, growth_at_lead(g30, g60, 30), recent, ens.sigma_offset_kmh)
    places = [assess_point(p, ens, levels, obs_levels, probs, an.dbz0, an.motion, an.coverage, cells, zones) for p in PLACES]
    alerts = build_alerts(places, zones, probs)
    outlook = _outlook(ens, probs, an.motion, zones)
    lap("decide")

    frames = []
    for tt in sorted(an.scans):
        scan = an.scans[tt]
        frames.append(
            {
                "t": tt,
                "kind": "observed",
                "label": "Now" if tt == 0 else f"{tt} min",
                "radar": data_url(radar_png(scan, an.coverage)) if scan is not None else None,
                "warnings": level_features(obs_levels, GRID.ij_to_lonlat) if tt == 0 else None,
                "missing": scan is None,
                "lightning": _strikes_geojson(an.strikes, tt),
            }
        )
    for li, lead in enumerate(ens.leads):
        frames.append(
            {
                "t": lead,
                "kind": "forecast",
                "tier": "sharp" if lead <= 60 else "probability",
                "label": f"+{lead} min",
                "radar": data_url(radar_png(ens.median(li), an.coverage)),
                "warnings": level_features(levels[li], GRID.ij_to_lonlat),
                "missing": False,
                "lightning": None,
            }
        )
    frames.append(
        {"t": 360, "kind": "outlook", "tier": "outlook", "label": "3 to 6 h outlook", "radar": None,
         "warnings": level_features(outlook, GRID.ij_to_lonlat), "missing": False, "lightning": None}
    )
    lap("render")

    # Place levels per frame: none for past scans, then now, leads, and the outlook.
    place_json = []
    for pf in places:
        pj = pf.to_json()
        rr, cc = GRID.lonlat_to_ij(pf.lon, pf.lat)
        r, c = int(round(float(rr))), int(round(float(cc)))
        r = min(max(r, 0), GRID.ny - 1)
        c = min(max(c, 0), GRID.nx - 1)
        past = [None] * (len(an.scans) - 1)
        pj["frame_levels"] = past + pf.levels + [int(outlook[r, c])]
        place_json.append(pj)

    mean_speed = float(np.hypot(an.motion.mean_u, an.motion.mean_v) * 12.0)
    mean_toward = float((np.degrees(np.arctan2(an.motion.mean_u, -an.motion.mean_v)) + 360) % 360)
    w, s, e, n = GRID.bounds
    bundle = {
        "engine": {
            "name": "VajraNow engine",
            "version": __version__,
            "data": "synthetic",
            "disclaimer": DISCLAIMER,
            "members": N_MEMBERS,
            "fusion": "trained on synthetic storms" if model is not None else "not loaded (extrapolation only)",
            "timings_ms": timings,
        },
        "scenario": {"id": sc.id, "title": sc.title, "summary": sc.summary, "story": sc.story},
        "grid": {
            "nx": GRID.nx,
            "ny": GRID.ny,
            "cell_km": GRID.cell_km,
            "bounds": [round(w, 5), round(s, 5), round(e, 5), round(n, 5)],
            "corners": [[round(x, 5), round(y, 5)] for x, y in GRID.corners()],
        },
        "radar": {
            "name": GRID.radar.name,
            "lon": GRID.radar.lon,
            "lat": GRID.radar.lat,
            "range_km": GRID.radar.range_km,
            "ring": {"type": "Feature", "properties": {}, "geometry": {"type": "LineString", "coordinates": [[round(x, 4), round(y, 4)] for x, y in range_ring()]}},
        },
        "feeds": _feeds(sc, an),
        "qc": {
            "clutter_pixels": an.qc.clutter_pixels,
            "speckle_pixels": an.qc.speckle_pixels,
            "missing_scans": an.qc.missing_scans,
            "notes": an.qc.notes,
        },
        "motion": {
            "mean_speed_kmh": round(mean_speed),
            "mean_toward_deg": round(mean_toward),
            "mean_toward": bearing_to_compass(mean_toward),
            "quality": an.motion.quality,
            "tracked_blocks": an.motion.n_valid,
            "echo_blocks": an.motion.n_echo_blocks,
            "arrows": _motion_geojson(an),
        },
        "fusion_inputs": list(FEATURE_NAMES),
        "frames": frames,
        "cells": [c.to_json() for c in cells],
        "initiation": [z.to_json() for z in zones],
        "places": place_json,
        "alerts": alerts,
        "legend": {
            "radar_dbz": RADAR_LEGEND,
            "levels": [{"level": lv, "name": LEVEL_TEXT[lv][0], "action": LEVEL_TEXT[lv][1]} for lv in LEVELS],
        },
        "method": method_summary(),
    }
    lap("bundle")
    return NowcastRun(sc, an, ens, g30, g60, levels, obs_levels, probs, cells, zones, places, bundle, timings)


@lru_cache(maxsize=4)
def run_nowcast(scenario_id: str) -> NowcastRun:
    return _run(scenario_id)
