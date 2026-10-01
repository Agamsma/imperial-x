import numpy as np
import pytest

from vajranow.fusion import WEIGHTS_PATH, FusionModel, build_features, growth_at_lead

pytestmark = pytest.mark.skipif(not WEIGHTS_PATH.exists(), reason="fusion weights not trained yet")


def test_weights_load_and_predict_shapes():
    m = FusionModel.load()
    feats = np.zeros((5, 31, 43), np.float32)
    g30, g60 = m.predict(feats)
    assert g30.shape == (31, 43) and g60.shape == (31, 43)
    assert np.isfinite(g30).all() and np.isfinite(g60).all()


def test_matches_pytorch():
    torch = pytest.importorskip("torch")
    from model import FusionNet

    m = FusionModel.load()
    net = FusionNet()
    with np.load(WEIGHTS_PATH) as d:
        mods = list(net.convs) + [net.out]
        for i, mod in enumerate(mods):
            mod.weight.data = torch.from_numpy(d[f"w{i}"])
            mod.bias.data = torch.from_numpy(d[f"b{i}"])
    x = np.random.default_rng(0).normal(0, 0.5, (5, 24, 30)).astype(np.float32)
    ref = net(torch.from_numpy(x)[None]).detach().numpy()[0] * m.out_scale
    assert np.allclose(m.forward_coarse(x), ref, atol=1e-3)


def test_cooling_cloud_tops_mean_growth():
    """A patch of fast-cooling, cold cloud tops with no radar echo yet should be read as a growing storm."""
    shape = (80, 80)
    cov = np.ones(shape, bool)
    dbz = np.zeros(shape)
    bt_prev = np.full(shape, 296.0)
    bt_now = np.full(shape, 296.0)
    rr, cc = np.mgrid[0:80, 0:80]
    patch = np.exp(-((rr - 40) ** 2 + (cc - 40) ** 2) / (2 * 6.0**2))
    bt_now -= 45 * patch
    bt_prev -= 25 * patch
    feats = build_features(dbz, None, bt_now, bt_prev, 15.0, np.zeros(shape), cov)
    g30, g60 = FusionModel.load().predict(feats)
    assert g60[38:43, 38:43].mean() > g60[:10, :10].mean() + 3.0


def test_growth_interpolation():
    a = np.full((2, 2), 6.0)
    b = np.full((2, 2), 10.0)
    assert np.allclose(growth_at_lead(a, b, 15), 3.0)
    assert np.allclose(growth_at_lead(a, b, 45), 8.0)
    assert np.allclose(growth_at_lead(a, b, 90), 10.0)
    assert np.allclose(growth_at_lead(-a, -b, 90), -3.0)  # decay is damped to 30%


def test_fusion_not_worse_than_extrapolation():
    from evaluate import evaluate

    res = evaluate(range(990_000, 990_008), leads=(60,), thresholds=(35.0,))
    csi = res["csi"]
    assert csi["fusion@60min>=35dBZ"] >= csi["extrapolation@60min>=35dBZ"] - 0.01
    assert csi["extrapolation@60min>=35dBZ"] >= csi["persistence@60min>=35dBZ"] - 0.01
