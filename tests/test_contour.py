import numpy as np

from vajranow.contour import _area, contour_rings, level_features, polygons


def test_square_contour_area():
    f = np.zeros((20, 20))
    f[5:15, 5:15] = 1.0
    rings = contour_rings(f, 0.5)
    assert len(rings) == 1
    # Boundary sits half a cell outside the filled block on each side: 10 x 10 minus corner cuts.
    assert 95 <= abs(_area(rings[0])) <= 100


def test_donut_has_hole():
    f = np.zeros((30, 30))
    f[5:25, 5:25] = 1.0
    f[12:18, 12:18] = 0.0
    polys = polygons(f, 0.5)
    assert len(polys) == 1 and len(polys[0]) == 2


def test_two_blobs_two_polygons_and_closed_rings():
    f = np.zeros((30, 40))
    f[3:8, 3:8] = 1
    f[20:27, 25:35] = 1
    polys = polygons(f, 0.5)
    assert len(polys) == 2
    for p in polys:
        assert np.allclose(p[0][0], p[0][-1])


def test_level_features_geojson():
    lv = np.zeros((25, 25), dtype=np.int8)
    lv[5:20, 5:20] = 1
    lv[9:16, 9:16] = 2
    lv[11:14, 11:14] = 3
    fc = level_features(lv, lambda r, c: (76 + c * 0.02, 10 - r * 0.02))
    levels = [f["properties"]["level"] for f in fc["features"]]
    assert levels == sorted(levels) and set(levels) == {1, 2, 3}


def test_simplify_keeps_shape():
    from vajranow.contour import simplify

    t = np.linspace(0, 2 * np.pi, 200)
    ring = np.c_[50 + 20 * np.sin(t), 50 + 20 * np.cos(t)]
    ring[-1] = ring[0]
    s = simplify(ring, 0.25)
    assert len(s) < 60
    assert np.allclose(s[0], s[-1])
    assert abs(abs(_area(s)) - abs(_area(ring))) / abs(_area(ring)) < 0.03
