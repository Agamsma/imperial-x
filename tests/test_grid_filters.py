import numpy as np
import pytest

from vajranow.filters import box_mean, box_sum, neighbourhood_max
from vajranow.grid import GRID, haversine_km


def test_lonlat_roundtrip():
    lon, lat = 76.4, 10.15
    r, c = GRID.lonlat_to_ij(lon, lat)
    lon2, lat2 = GRID.ij_to_lonlat(r, c)
    assert abs(float(lon2) - lon) < 1e-9 and abs(float(lat2) - lat) < 1e-9


@pytest.mark.parametrize("row", [5, GRID.ny // 2, GRID.ny - 6])
def test_cells_are_about_2_km(row):
    lon1, lat1 = GRID.ij_to_lonlat(row, 50)
    lon2, lat2 = GRID.ij_to_lonlat(row, 51)
    lon3, lat3 = GRID.ij_to_lonlat(row + 1, 50)
    assert abs(float(haversine_km(lon1, lat1, lon2, lat2)) - 2.0) < 0.05
    assert abs(float(haversine_km(lon1, lat1, lon3, lat3)) - 2.0) < 0.05


def test_radar_coverage():
    cov = GRID.coverage()
    r, c = GRID.lonlat_to_ij(GRID.radar.lon, GRID.radar.lat)
    assert cov[int(round(float(r))), int(round(float(c)))]
    assert not cov[0, GRID.nx - 1]  # far north-east corner is beyond 250 km


def test_corners_match_bounds():
    w, s, e, n = GRID.bounds
    assert GRID.corners() == [[w, n], [e, n], [e, s], [w, s]]


def _brute_box(a, k):
    r = k // 2
    p = np.pad(a, r)
    return np.array([[p[i : i + k, j : j + k].sum() for j in range(a.shape[1])] for i in range(a.shape[0])])


@pytest.mark.parametrize("k", [3, 5, 9])
def test_box_sum(k):
    a = np.random.default_rng(0).random((17, 23))
    assert np.allclose(box_sum(a, k), _brute_box(a, k))
    assert np.allclose(box_mean(np.ones((9, 9)), k), 1.0)


def test_neighbourhood_max_any_leading_dims():
    rng = np.random.default_rng(1)
    a = rng.random((3, 12, 15))
    out = neighbourhood_max(a, 2)
    p = np.pad(a, ((0, 0), (2, 2), (2, 2)), constant_values=-np.inf)
    ref = np.array([[[p[m, i : i + 5, j : j + 5].max() for j in range(15)] for i in range(12)] for m in range(3)])
    assert np.allclose(out, ref)
