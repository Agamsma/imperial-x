"""From reflectivity to hazards and IMD colour levels.

All thresholds below are illustrative starting points from the radar
literature. They will be set together with IMD before any real use.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .filters import neighbourhood_max

# Reflectivity to rain rate, Z = a R^b. a = 300, b = 1.4 is the common
# convective relation (the WSR-88D default). It will be tuned for Indian radars.
ZR_A = 300.0
ZR_B = 1.4
# Reflectivity above 53 dBZ is usually hail, not more rain, so rain rate is capped there
# (the 'hail cap' used by the WSR-88D rain algorithm).
HAIL_CAP_DBZ = 53.0

THRESHOLDS_DBZ = {
    "storm": 35.0,  # a thunderstorm echo
    "lightning": 40.0,  # lightning becomes likely
    "heavy": 45.0,  # heavy thunderstorm core
    "severe": 50.0,  # severe core: strong winds and very heavy rain likely
    "hail": 55.0,  # hail signal (experimental, composite reflectivity only)
}

# Rain over the next hour. IMD calls >= 100 mm in an hour over a small area a cloudburst.
RAIN_1H_HEAVY_MM = 50.0
RAIN_1H_CLOUDBURST_MM = 100.0

LEVELS = ("green", "yellow", "orange", "red")
LEVEL_TEXT = {
    "green": ("Green", "No warning"),
    "yellow": ("Yellow", "Be updated"),
    "orange": ("Orange", "Be prepared"),
    "red": ("Red", "Take action"),
}


@dataclass(frozen=True)
class LevelRules:
    yellow_p_storm: float = 0.3  # P(>= 35 dBZ)
    orange_p_heavy: float = 0.4  # P(>= 45 dBZ)
    red_p_severe: float = 0.5  # P(>= 50 dBZ)
    orange_p_rain50: float = 0.4  # P(next-hour rain >= 50 mm)
    red_p_rain100: float = 0.4  # P(next-hour rain >= 100 mm)


RULES = LevelRules()


def rain_rate(dbz: np.ndarray) -> np.ndarray:
    """Rain rate in mm/h from reflectivity, with the hail cap applied."""
    dbz = np.asarray(dbz, dtype=np.float32)
    z = 10.0 ** (np.minimum(dbz, HAIL_CAP_DBZ) / 10.0)
    r = (z / ZR_A) ** (1.0 / ZR_B)
    return np.where(dbz >= 15.0, r, 0.0).astype(np.float32)


def exceedance(member_fields: np.ndarray, thresholds: list[float], radius: int) -> dict[float, np.ndarray]:
    """P(value >= threshold within `radius` cells), from (members, ny, nx)."""
    nmax = neighbourhood_max(member_fields, radius)
    return {thr: (nmax >= thr).mean(0, dtype=np.float32) for thr in thresholds}


def level_grid(p_storm, p_heavy, p_severe, p_rain50=None, p_rain100=None, rules: LevelRules = RULES) -> np.ndarray:
    lv = np.zeros(p_storm.shape, dtype=np.int8)
    lv[p_storm >= rules.yellow_p_storm] = 1
    orange = p_heavy >= rules.orange_p_heavy
    red = p_severe >= rules.red_p_severe
    if p_rain50 is not None:
        orange |= p_rain50 >= rules.orange_p_rain50
    if p_rain100 is not None:
        red |= p_rain100 >= rules.red_p_rain100
    lv[orange] = 2
    lv[red] = 3
    return lv


def observed_level_grid(dbz: np.ndarray) -> np.ndarray:
    """Levels for what the radar shows right now."""
    z = neighbourhood_max(np.nan_to_num(dbz, nan=0.0), 1)
    lv = np.zeros(z.shape, dtype=np.int8)
    lv[z >= THRESHOLDS_DBZ["storm"]] = 1
    lv[z >= THRESHOLDS_DBZ["heavy"]] = 2
    lv[z >= THRESHOLDS_DBZ["severe"]] = 3
    return lv


def method_summary() -> dict:
    return {
        "z_r_relation": {"a": ZR_A, "b": ZR_B, "hail_cap_dbz": HAIL_CAP_DBZ, "note": "Z = a R^b, convective default, to be tuned for Indian radars"},
        "thresholds_dbz": THRESHOLDS_DBZ,
        "rain_1h_mm": {"heavy": RAIN_1H_HEAVY_MM, "cloudburst": RAIN_1H_CLOUDBURST_MM},
        "level_rules": {
            "yellow": f"P(>= 35 dBZ) >= {RULES.yellow_p_storm}",
            "orange": f"P(>= 45 dBZ) >= {RULES.orange_p_heavy} or P(rain in next hour >= 50 mm) >= {RULES.orange_p_rain50}",
            "red": f"P(>= 50 dBZ) >= {RULES.red_p_severe} or P(rain in next hour >= 100 mm) >= {RULES.red_p_rain100}",
        },
        "neighbourhood": "within about 3 km up to 60 min ahead, about 5 km from 70 to 120 min",
        "status": "Illustrative thresholds. To be agreed with IMD before any real use.",
    }
