import struct
import zlib

import numpy as np

from vajranow.hazards import HAIL_CAP_DBZ, exceedance, level_grid, rain_rate
from vajranow.qc import clean_scans, remove_speckle
from vajranow.render import hazard_png, radar_png
from vajranow.scenarios import SCENARIOS
from vajranow.synthetic import StormWorld
from vajranow.verify import contingency, fss


def test_clutter_and_missing_scans():
    sc = SCENARIOS["ghats-afternoon"]
    w = StormWorld(sc)
    scans = {t: w.observe_radar(t) for t in range(-60, 1, 10)}
    clean, rep = clean_scans(scans)
    assert rep.clutter_pixels >= 20
    assert rep.missing_scans == [-30]
    assert clean[-30] is None
    for r, c, _ in w._clutter:
        assert clean[0][r, c] < 30 or np.isnan(clean[0][r, c])


def test_speckle_removed_but_blocks_kept():
    a = np.zeros((10, 10))
    a[2, 2] = 30
    a[6:9, 6:9] = 25
    out, n = remove_speckle(a)
    assert n == 1 and out[2, 2] == 0 and out[7, 7] == 25


def _png_ok(png: bytes, w: int, h: int):
    assert png[:8] == b"\x89PNG\r\n\x1a\n"
    pos, chunks = 8, {}
    while pos < len(png):
        (length,) = struct.unpack(">I", png[pos : pos + 4])
        kind = png[pos + 4 : pos + 8]
        data = png[pos + 8 : pos + 8 + length]
        (crc,) = struct.unpack(">I", png[pos + 8 + length : pos + 12 + length])
        assert crc == zlib.crc32(kind + data) & 0xFFFFFFFF
        chunks[kind] = chunks.get(kind, b"") + data
        pos += 12 + length
    ww, hh = struct.unpack(">II", chunks[b"IHDR"][:8])
    assert (ww, hh) == (w, h)
    assert len(zlib.decompress(chunks[b"IDAT"])) == h * (w + 1)


def test_png_writer():
    dbz = np.random.default_rng(0).uniform(0, 65, (30, 40))
    _png_ok(radar_png(dbz, np.ones((30, 40), bool)), 40, 30)
    _png_ok(hazard_png(np.random.default_rng(1).integers(0, 4, (30, 40))), 40, 30)
    try:
        from PIL import Image
        import io

        img = Image.open(io.BytesIO(radar_png(dbz)))
        assert img.size == (40, 30) and img.mode == "P"
    except ImportError:
        pass


def test_rain_rate_and_hail_cap():
    r = rain_rate(np.array([0.0, 14.9, 20.0, 40.0, HAIL_CAP_DBZ, 65.0]))
    assert r[0] == 0 and r[1] == 0
    assert 0 < r[2] < r[3] < r[4]
    assert np.isclose(r[4], r[5])  # hail cap
    assert 95 < r[4] < 115


def test_level_rules():
    z = np.zeros((1, 4))
    p_storm = np.array([[0.1, 0.5, 0.9, 0.9]])
    p_heavy = np.array([[0.0, 0.1, 0.5, 0.9]])
    p_severe = np.array([[0.0, 0.0, 0.1, 0.6]])
    assert level_grid(p_storm, p_heavy, p_severe).tolist() == [[0, 1, 2, 3]]
    p_rain100 = np.array([[0.5, 0, 0, 0]])
    assert level_grid(p_storm, p_heavy, p_severe, z, p_rain100).tolist() == [[3, 1, 2, 3]]


def test_exceedance():
    members = np.zeros((4, 5, 5))
    members[:2, 2, 2] = 50
    p = exceedance(members, [45.0], radius=1)[45.0]
    assert np.isclose(p[2, 2], 0.5) and np.isclose(p[1, 1], 0.5) and p[0, 0] == 0


def test_verification_scores():
    f = np.array([[50, 50, 0, 0]])
    o = np.array([[50, 0, 50, 0]])
    c = contingency(f, o, 40)
    assert (c.hits, c.misses, c.false_alarms, c.correct_negatives) == (1, 1, 1, 1)
    assert np.isclose(c.csi, 1 / 3) and np.isclose(c.pod, 0.5) and np.isclose(c.far, 0.5)
    g = np.random.default_rng(0).uniform(0, 60, (40, 40))
    assert np.isclose(fss(g, g, 35, 5), 1.0)
