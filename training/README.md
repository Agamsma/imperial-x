# training/

Training and evaluation for the fusion step. Needs PyTorch (CPU is fine); the
live engine does not.

| File | What it does |
| --- | --- |
| `dataset.py` | Builds samples from random synthetic storms: five inputs at analysis time, and the change in reflectivity along the motion after 30 and 60 minutes as targets |
| `model.py` | The network (four dilated 3 x 3 convolutions and a 1 x 1 output, about 17 thousand weights) and the export to numpy |
| `train_fusion.py` | Trains on synthetic storms and writes `vajranow/weights/fusion_v1.npz` |
| `evaluate.py` | Compares persistence, extrapolation and extrapolation plus fusion on held-out synthetic storms (CSI and FSS) |

```bash
pip install torch --index-url https://download.pytorch.org/whl/cpu
python training/train_fusion.py --train 700 --val 80 --epochs 60
python training/evaluate.py --n 40
```

Scores on synthetic storms only show that the code behaves. They say nothing
about skill on real storms and are not published. The test suite runs a small
version of `evaluate.py` so that a change making the fusion step worse than
plain extrapolation fails the build.

Next: retrain and evaluate on archived MOSDAC radar and INSAT-3D/3DR cases.
