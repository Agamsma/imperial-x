# vajranow/ (the engine)

The VajraNow nowcasting engine, in Python. Runtime needs only numpy and FastAPI.
Everything runs on synthetic storms; reading archived MOSDAC files is planned. The
separate two-day real-data baseline is in [`validation/real_radar/`](../validation/real_radar/).

| Module | Step | What it does |
| --- | --- | --- |
| `grid.py` | Align | 2 km grid aligned to Web Mercator, TERLS radar coverage, geodesy helpers |
| `places.py` | | Places that get arrival windows, district centres for naming areas |
| `synthetic.py`, `scenarios.py` | Ingest (stand-in) | Synthetic radar, infrared and lightning, plus the three demo scenarios |
| `qc.py` | Ingest | Ground clutter, speckle and missing-scan checks |
| `observe.py` | Ingest | Builds what the engine sees at analysis time (shared by the API and training) |
| `motion.py` | Predict | TREC block-matching motion with confidence |
| `advection.py` | Predict | Bilinear sampling and semi-Lagrangian extrapolation |
| `fusion.py` | Predict | Features and numpy inference for the small CNN trained on synthetic storms (`weights/fusion_v1.npz`) |
| `ensemble.py` | Predict | 20-member ensemble plus control (probabilities not calibrated) |
| `hazards.py` | Decide | Z-R rain rate with hail cap, thresholds, IMD level rules |
| `decide.py` | Decide | Storm cells, arrival windows, reliability flags, new-storm zones, alerts |
| `contour.py` | Show | Marching squares and simplification for warning polygons |
| `render.py` | Show | Palette PNG writer for radar frames |
| `verify.py` | Verify | POD, FAR, CSI and fractions skill score |
| `pipeline.py` | All | Runs every step and builds the JSON the dashboard reads |
| `service.py` | API | FastAPI app (entry point: `api/index.py`) |

Quick start:

```python
from vajranow.pipeline import run_nowcast

run = run_nowcast("kochi-squall")
print(run.bundle["alerts"][0]["title"])
print(run.point(76.40, 10.15)["arrival"]["text"])
```
