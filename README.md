# VajraNow

**A web dashboard that tells officials which storm hazard is coming, exactly where, how sure we are, and how many minutes they have.**

Smart India Hackathon 2026 idea by **Team OmniSense** (Team ID 167415).
Problem statement **SIH26084**: Convective scale nowcasting for Thunderstorms, Hail and Cloudbursts (06 hr). Ministry of Earth Sciences. Theme: Disaster Management. Category: Software.

- **Website:** https://vajranow.vercel.app
- **Demo dashboard:** https://vajranow.vercel.app/demo
- **How the engine works:** https://vajranow.vercel.app/method
- **API docs:** https://vajranow.vercel.app/api/py/docs

> **Status: idea stage, with a working engine.** The nowcasting engine runs end to end on **synthetic storms** made in code. It has not seen real radar data yet. Nothing here is a real forecast or an official IMD warning.

## The problem

- Thunderstorms, hail and cloudbursts can build in minutes, over an area only a few kilometres across.
- Current nowcasts are issued at district level and stay valid for 3 hours. Officials cannot tell which town is hit first, or when.
- Lightning killed 2,558 people in India in 2023 (source: NCRB, Accidental Deaths and Suicides in India 2023).

Officials need four answers, fast: **Which hazard? Exactly where? How sure? How many minutes?**

## What is in this repo

| Part | What it does | Where |
| --- | --- | --- |
| Website | Landing page and method page | [`app/`](app/) |
| Dashboard | The `/demo` page. Reads everything from the engine API | [`app/demo/`](app/demo/) |
| Engine | Python nowcasting pipeline: quality checks, tracking, extrapolation, fusion, ensemble, warnings | [`vajranow/`](vajranow/) |
| API | FastAPI app, deployed as a Vercel Python function | [`api/index.py`](api/index.py), [`vajranow/service.py`](vajranow/service.py) |
| Fusion training | PyTorch training and evaluation on synthetic storms | [`training/`](training/) |
| Tests | Engine, contours, fusion, scenario stories and API | [`tests/`](tests/) |
| Design | Architecture and warning logic | [`design/architecture.md`](design/architecture.md) |

## How the engine works

Every 10 minutes, on one 2 km grid over south Kerala (the 250 km range of the TERLS Doppler radar):

1. **Quality checks.** Removes ground clutter and speckle, and reports missing radar scans instead of hiding them.
2. **Storm motion.** TREC block matching between consecutive radar scans (30 km blocks, up to about 72 km/h), with a confidence value for every cell.
3. **Extrapolation.** Semi-Lagrangian advection moves storms along the motion. This is the baseline every other step must beat.
4. **Fusion step.** A small neural network (about 17 thousand weights) predicts growth, decay and new storms from radar, infrared cloud-top cooling, lightning and the radar trend. Trained with PyTorch on synthetic storms only, then run in numpy.
5. **Ensemble.** 20 slightly different forecasts plus a control run turn into probabilities.
6. **Warnings.** IMD colour levels, arrival windows as a range (10th to 90th percentile across the ensemble), hail, gust and cloudburst flags (experimental), new-storm zones from satellite, and honest "not reliable" labels in hilly terrain or outside radar coverage.
7. **Show.** Warning polygons (marching squares), radar frames, storm tracks with uncertainty cones, and point forecasts for any place on the map.

Every number the engine uses is on the [method page](https://vajranow.vercel.app/method).

### Demo scenarios (all synthetic)

| Scenario | What it shows |
| --- | --- |
| Squall line moving into Kochi | Fast storms (about 38 km/h), a hail signal heading for Kochi Airport, a new cell forming offshore, and a "not reliable" flag for Munnar |
| Afternoon storms over the Western Ghats | Slow storms over Idukki, arrival windows for Kottayam and Pathanamthitta, new storms seen by satellite first, and a missing radar scan |
| Slow heavy-rain cell near Thiruvananthapuram | A back-building storm that may cross the cloudburst threshold (100 mm in an hour) |

Open a scenario directly: `/demo?scenario=ghats-afternoon`.

## API

| Endpoint | Returns |
| --- | --- |
| `GET /api/py/health` | Engine status and version |
| `GET /api/py/v1/scenarios` | The demo scenarios |
| `GET /api/py/v1/nowcast/{scenario}` | Full nowcast: frames, warning polygons, storm cells, arrival windows, alerts, feed status |
| `GET /api/py/v1/nowcast/{scenario}/point?lon=&lat=` | Forecast for any point: level by lead time, probabilities, arrival window |
| `GET /api/py/v1/method` | Thresholds and rules, for transparency |

```bash
curl "https://vajranow.vercel.app/api/py/v1/nowcast/kochi-squall/point?lon=76.40&lat=10.15"
```

Full reference: [docs/api.md](docs/api.md).

## Run it locally

Needs Node.js 20+ and Python 3.12+.

```bash
npm install
pip install -r requirements-dev.txt

npm run dev:api   # engine API on http://127.0.0.1:8000
npm run dev       # website on http://localhost:3000 (forwards /api/py to the engine)
```

Checks:

```bash
python -m pytest     # engine, fusion, scenario and API tests
npm run lint
npm run build
```

Retrain the fusion step (optional, needs PyTorch):

```bash
pip install torch --index-url https://download.pytorch.org/whl/cpu
python training/train_fusion.py --train 700 --val 80 --epochs 60
python training/evaluate.py --n 40
```

## Deployment

Vercel builds the Next.js site and the Python function from the same repo:

- `next.config.ts` forwards `/api/py/*` to the Python function `api/index.py` on Vercel, and to the local engine in development.
- `vercel.json` keeps the Next.js build and `node_modules` out of the Python bundle.
- `requirements.txt` holds the runtime dependencies (FastAPI, numpy) and `.python-version` pins Python 3.13.
- Engine responses are cached by Vercel's CDN for each deployment and cleared on every new deploy.

## Hazards

| Hazard | Status |
| --- | --- |
| Lightning | In the engine (reflectivity proxy until IITM data arrives) |
| New storms forming | In the engine (satellite cloud-top cooling, experimental) |
| Hail | Experimental (reflectivity only) |
| Extreme rain / cloudburst threshold | Experimental (hourly rain from reflectivity) |
| Damaging gusts | Experimental (fast, strong cells) |

## Data sources

| Source | Access status |
| --- | --- |
| MOSDAC TERLS Doppler radar | Access approved |
| MOSDAC INSAT-3D/3DR | Access approved |
| ERA5 (Copernicus) | Open |
| SEVIR benchmark | Open |
| IITM lightning network | Planned request |
| Live IMD radar | Future, needs approval |

How to get each one: [docs/data-sources.md](docs/data-sources.md).
**No MOSDAC or IMD data is stored in this repo.** Their terms do not allow redistribution.

## Tech stack

| Part | Tools |
| --- | --- |
| Engine | Python, numpy (tracking, extrapolation, ensemble, contours), FastAPI |
| Fusion step | PyTorch for training, numpy for running |
| Planned | pysteps baseline comparison, LightGBM hazard models, PostgreSQL with PostGIS, real MOSDAC ingestion |
| Frontend | Next.js, MapLibre GL JS, Tailwind CSS, Framer Motion |
| Hosting | Vercel (site and Python function) |

## Roadmap

1. **Idea** (now): problem study, design, and a working engine on synthetic storms.
2. **Replay prototype:** read archived TERLS radar and INSAT-3D/3DR files and replay past Kerala storms.
3. **Fusion model:** retrain the fusion step on real cases and score it against the extrapolation baseline.
4. **Live feeds with IMD:** connect live data, only with IMD approval and partnership.

## Responsible use

- VajraNow is a **decision-support prototype. It is not an official IMD warning.** Official warnings come only from IMD.
- The engine runs on synthetic storms. Scores on synthetic storms are used only inside the tests to stop changes that make things worse than the baseline; they are never published as accuracy.
- Places where timing cannot be trusted (hilly terrain with low tracking confidence, or outside radar coverage) are marked as such instead of showing a confident time.
- We follow the terms of every data provider and do not redistribute restricted data.

## Team OmniSense

| Name | Role |
| --- | --- |
| Agam Sharma | Team leader |
| Abdeali Jhabuawala | Member |
| Samar Kuril | Member |
| Krish Patel | Member |
| Vipul Singh Adhikari | Member |
| Pritika Pangotra | Member |

## Licence

[MIT](LICENSE)
