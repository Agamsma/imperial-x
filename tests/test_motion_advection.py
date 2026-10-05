import numpy as np

from imperial_x.advection import Sampler, extrapolate
from imperial_x.motion import estimate_motion
from imperial_x.scenarios import SCENARIOS
from imperial_x.synthetic import StormWorld, smooth_noise


def _pattern(shape, seed=3):
    n = smooth_noise(shape, 4.0, np.random.default_rng(seed))
    return np.where(n > 0.3, 20 + 15 * n, 0.0)


def test_trec_recovers_known_translation():
    big = _pattern((260, 280))
    dy, dx = 2, -3  # cells per 10 minutes
    scans = {}
    for k, t in enumerate((-20, -10, 0)):
        r0, c0 = 40 + k * dy, 40 + k * dx
        scans[t] = big[r0 : r0 + 150, c0 : c0 + 160]
    # The pattern moves opposite to the window shift.
    m = estimate_motion(scans)
    assert abs(m.mean_u - (-dx)) < 0.35
    assert abs(m.mean_v - (-dy)) < 0.35
    assert m.quality == "good"


def test_scenario_motion_matches_truth():
    sc = SCENARIOS["kochi-squall"]
    w = StormWorld(sc)
    scans = {t: w.observe_radar(t) for t in (-20, -10, 0)}
    m = estimate_motion(scans)
    speed = np.hypot(m.mean_u, m.mean_v) * 12.0
    toward = (np.degrees(np.arctan2(m.mean_u, -m.mean_v)) + 360) % 360
    assert abs(speed - 38) < 6
    assert abs(toward - 45) < 15


def test_extrapolation_moves_blob():
    shape = (80, 90)
    rr, cc = np.mgrid[0:80, 0:90]
    blob = 50 * np.exp(-((rr - 30) ** 2 + (cc - 30) ** 2) / 20.0)
    u = np.full(shape, 2.0)
    v = np.full(shape, 1.0)
    out = extrapolate(blob, u, v, 3)
    r, c = np.unravel_index(np.argmax(out[-1]), shape)
    assert (r, c) == (33, 36)
    same = extrapolate(blob, np.zeros(shape), np.zeros(shape), 2)
    assert np.allclose(same[-1], blob)


def test_sampler_exact_on_grid_points():
    f = np.arange(20.0).reshape(4, 5)
    s = Sampler(np.array([[0.0, 3.0]]), np.array([[0.0, 4.0]]), f.shape)
    assert np.allclose(s(f), [[0.0, 19.0]])
    s2 = Sampler(np.array([1.5]), np.array([2.5]), f.shape)
    assert np.isclose(s2(f)[0], (7 + 8 + 12 + 13) / 4)
