import json

import pytest

from imperial_x.pipeline import run_nowcast


@pytest.fixture(scope="module")
def runs():
    return {sid: run_nowcast(sid) for sid in ("kochi-squall", "ghats-afternoon", "tvm-cloudburst")}


def _place(bundle, pid):
    return next(p for p in bundle["places"] if p["id"] == pid)


def test_bundle_shape(runs):
    for run in runs.values():
        b = run.bundle
        assert b["engine"]["data"] == "synthetic"
        assert len(b["frames"]) == 7 + 12 + 1
        assert b["frames"][-1]["kind"] == "outlook"
        for f in b["frames"]:
            if f["radar"]:
                assert f["radar"].startswith("data:image/png;base64,")
            if f["warnings"]:
                assert f["warnings"]["type"] == "FeatureCollection"
        assert b["frames"][7]["warnings"]["features"], "forecast frames should carry warning polygons"
        assert len(b["places"]) == 10
        for p in b["places"]:
            assert len(p["frame_levels"]) == len(b["frames"])
        json.dumps(b)


def test_no_em_dashes_in_text(runs):
    for run in runs.values():
        text = json.dumps(run.bundle, ensure_ascii=False)
        assert chr(0x2014) not in text and chr(0x2013) not in text


def test_kochi_story(runs):
    b = runs["kochi-squall"].bundle
    cok = _place(b, "cok")
    assert cok["level"] in ("orange", "red")
    assert cok["arrival"]["status"] == "expected"
    lo, hi = cok["arrival"]["window"]
    assert 5 <= lo < hi <= 90
    assert _place(b, "munnar")["arrival"]["text"] == "Not reliable (terrain, low motion confidence)"
    assert _place(b, "tvm")["level"] == "green"
    assert b["cells"][0]["speed_kmh"] > 25
    assert any("Hail" in h for h in cok["hazards"])
    assert any(z["near"] == "the Arabian Sea coast" for z in b["initiation"])


def test_ghats_story(runs):
    b = runs["ghats-afternoon"].bundle
    assert b["qc"]["missing_scans"] == [-30]
    assert next(f for f in b["feeds"] if f["id"] == "radar")["status"] == "degraded"
    assert _place(b, "kottayam")["arrival"]["status"] in ("expected", "possible")
    assert _place(b, "pathanamthitta")["arrival"]["status"] in ("expected", "possible")
    assert _place(b, "idukki-dam")["arrival"]["status"] == "now"
    assert any(z["near"] == "Idukki" for z in b["initiation"])
    assert b["motion"]["mean_speed_kmh"] < 20


def test_cloudburst_story(runs):
    b = runs["tvm-cloudburst"].bundle
    tvm = _place(b, "tvm")
    assert tvm["level"] == "red"
    assert any("Cloudburst" in h for h in tvm["hazards"])
    assert any("Cloudburst" in a["title"] for a in b["alerts"])
    assert not any("Cloudburst" in a["title"] for a in runs["kochi-squall"].bundle["alerts"])


def test_point_query(runs):
    out = runs["kochi-squall"].point(76.40, 10.15)
    assert out["leads"][0] == 0 and len(out["levels"]) == 13
    assert out["arrival"]["status"] in ("expected", "now", "possible", "none", "unreliable", "outside")


@pytest.fixture(scope="module")
def client():
    pytest.importorskip("httpx")
    from fastapi.testclient import TestClient

    from imperial_x.service import create_app

    return TestClient(create_app())


def test_api_routes(client):
    h = client.get("/api/py/health").json()
    assert h["status"] == "ok" and h["data"] == "synthetic"
    sc = client.get("/api/py/v1/scenarios")
    assert sc.status_code == 200 and len(sc.json()) == 3
    assert "s-maxage" in sc.headers["cache-control"]
    r = client.get("/api/py/v1/nowcast/kochi-squall")
    assert r.status_code == 200 and r.json()["scenario"]["id"] == "kochi-squall"
    assert client.get("/api/py/v1/nowcast/nope").status_code == 404
    p = client.get("/api/py/v1/nowcast/kochi-squall/point", params={"lon": 76.4, "lat": 10.15})
    assert p.status_code == 200
    assert client.get("/api/py/v1/nowcast/kochi-squall/point", params={"lon": 80.0, "lat": 10.15}).status_code == 422
    assert client.get("/api/py/v1/method").json()["data"] == "synthetic"


def test_api_vercel_rewrite(client):
    """On Vercel, /api/py/<path> arrives at /api/index?__path=<path>."""
    r = client.get("/api/index", params={"__path": "health"})
    assert r.status_code == 200 and r.json()["status"] == "ok"
    r = client.get("/api/index", params={"__path": "v1/nowcast/kochi-squall/point", "lon": 76.4, "lat": 10.15})
    assert r.status_code == 200 and "arrival" in r.json()
