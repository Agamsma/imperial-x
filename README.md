# VajraNow

**A web dashboard that tells officials which storm hazard is coming, where and how precisely, how sure we are, and how many minutes they have.**

Smart India Hackathon 2026 idea by **Team OmniSense** (Team ID 167415).
Problem statement **SIH26084**: Convective scale nowcasting for Thunderstorms, Hail and Cloudbursts (06 hr). Ministry of Earth Sciences. Theme: Disaster Management. Category: Software.

- **Website:** https://vajranow.vercel.app
- **Demo dashboard:** https://vajranow.vercel.app/demo
- **How the engine works:** https://vajranow.vercel.app/method
- **API docs:** https://vajranow.vercel.app/api/py/docs

> **Status: idea stage.** Nothing here is a real forecast or an official IMD warning.
>
> - **Built:** a synthetic engine (tracking, advection, a small CNN trained on synthetic storms, a 20-member ensemble that is not calibrated), the dashboard and the API. All of it runs on **synthetic storms** made in code.
> - **Preliminary evidence:** a two-day baseline on real TERLS radar and INSAT-3DR files (10 and 11 May 2026). **Motion extrapolation does not beat persistence.** See [Real-data baseline](#real-data-baseline-preliminary).
> - **Planned:** real replay, calibrated hazards, a reliability gate, LightGBM hazard models, a pysteps comparison, CAP export (no agency endorsement implied), an NWP blend for 3 to 6 h, archived-file ingestion and authorised live feeds.

## The problem

- Thunderstorms, hail and cloudbursts can build in minutes, over an area only a few kilometres across.
- Current nowcasts are issued at district level and stay valid for 3 hours. Officials cannot tell which town is hit first, or when.
- Lightning killed 2,558 people in India in 2023 (source: NCRB, Accidental Deaths and Suicides in India 2023).

Officials need four answers, fast: **Which hazard? Where, and how precisely? How sure are we? How many minutes do we have?**

## What is in this repo

| Part | What it does | Where |
| --- | --- | --- |
| Website | Landing page and method page | [`app/`](app/) |
| Dashboard | The `/demo` page. Reads everything from the engine API | [`app/demo/`](app/demo/) |
| Engine | Python nowcasting pipeline: quality checks, tracking, extrapolation, small CNN, ensemble, warnings | [`vajranow/`](vajranow/) |
| API | FastAPI app, deployed as a Vercel Python function | [`api/index.py`](api/index.py), [`vajranow/service.py`](vajranow/service.py) |
| CNN training | PyTorch training and evaluation on synthetic storms | [`training/`](training/) |
| Real-data baseline | Persistence vs motion extrapolation on TERLS radar, 10 and 11 May 2026, with inputs listed and results | [`validation/real_radar/`](validation/real_radar/) |
| Tests | Engine, contours, fusion, scenario stories and API | [`tests/`](tests/) |
| Design | Architecture and warning logic | [`design/architecture.md`](design/architecture.md) |
| Requirements coverage | Each required output: status, planned predictors, labels and checks | [`docs/requirements-coverage.md`](docs/requirements-coverage.md) |

## How the engine works

On one 2 km grid over south Kerala (the 250 km range of the TERLS Doppler radar). The demo engine steps every 10 minutes on synthetic scans. Real TERLS scans in our files are about 15 minutes apart (median 15.3 min), so the planned real system makes a new run with each scan. Real detail is coarser than 2 km: satellite pixels are about 4 km and the radar beam widens with range.

1. **Quality checks.** Removes ground clutter and speckle, and reports missing radar scans instead of hiding them.
2. **Storm motion.** TREC block matching between consecutive radar scans (30 km blocks, up to about 72 km/h), with a confidence value for every cell.
3. **Extrapolation.** Semi-Lagrangian advection moves storms along the motion. This is the baseline every other step must beat.
4. **Small CNN.** A small neural network (about 17 thousand weights) predicts growth, decay and new storms from radar, infrared cloud-top cooling, lightning and the radar trend. Trained with PyTorch on synthetic storms only, then run in numpy.
5. **Ensemble.** 20 slightly different forecasts plus a control run turn into probabilities. These are not calibrated yet.
6. **Warnings.** IMD colour levels, arrival windows as a range (10th to 90th percentile across the ensemble), unvalidated hail, strong-wind and cloudburst flags, new-storm zones from satellite, and honest "not reliable" labels in hilly terrain or outside radar coverage.
7. **Show.** Warning polygons (marching squares), radar frames, storm tracks with uncertainty cones, and point forecasts for any place on the map.

Every number the engine uses is on the [method page](https://vajranow.vercel.app/method).

### Missing data: what the code does today

- An earlier radar scan is missing: it is reported, and tracking uses the scans that remain.
- The latest radar scan is missing: the engine does not run a nowcast.
- A satellite image more than 20 minutes old is marked stale on the dashboard. Its cloud-top cues are still used.

Planned, not built: a stale-radar flag with no new alerts when radar is lost; satellite initiation cues turned off when satellite is lost; and, when lightning or weather-model feeds are down, running on radar and satellite only with those outputs off and confidence lowered.

## Real-data baseline (preliminary)

A first check on real data, separate from the engine: TERLS radar and INSAT-3DR files from MOSDAC, 10 and 11 May 2026. Team analysis.

| Lead (nominal) | Pairs | Persistence CSI | Motion extrapolation CSI |
| --- | --- | --- | --- |
| +15 min | 32 (18 + 14) | 0.62 | 0.61 |
| +30 min | 32 (18 + 14) | 0.43 | 0.39 |

CSI = hits / (hits + misses + false alarms), echo of 20 dBZ or more, 3 km tolerance, Farneback optical flow for the motion. **Motion extrapolation does not beat persistence.** Two days are too few for a general claim, and the VajraNow engine has not been run on these files yet.

Scripts, the list of input files, results and how to rerun it: [validation/real_radar/](validation/real_radar/).

![Skill vs lead time](public/real-data/skill-only.png)

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

None of these is validated. Each is labelled with what it is today.

| Hazard | In the demo today | Status |
| --- | --- | --- |
| Lightning | Chance of echo of 40 dBZ or more (radar proxy); IITM flash data planned | Proxy |
| New storms forming | Satellite cloud-top cooling where radar sees little yet | Demo |
| Hail | Flag where echo reaches 55 dBZ; kept out of the alert levels | Flag |
| Downburst / damaging gusts | Strong-wind proxy: a cell of 50 dBZ or more moving 30 km/h or faster; kept out of the alert levels | Proxy |
| Extreme rain / cloudburst | Chance of 100 mm in an hour, estimated from reflectivity with Z = 300 R^1.4 | Experimental |

How each will be built and checked (planned predictors, labels and verification): [docs/requirements-coverage.md](docs/requirements-coverage.md).

## Data sources

| Source | What it gives | Access |
| --- | --- | --- |
| TERLS radar | Reflectivity (velocity not yet processed); scans about 15 min apart in our files | MOSDAC, ordered |
| INSAT-3D/3DR | Cloud-top imagery, 30 min frames in our order (INSAT-3DR verified in our data) | MOSDAC account, ordered |
| ISS-LIS | Lightning flashes, spot checks only | NASA Earthdata, free |
| IITM lightning | Strike locations, 80+ sensors | Planned request |
| ERA5 / NCMRWF | Weather context (ERA5 retrospective only) | ERA5 open; NCMRWF planned |
| Live IMD radar | Live runs | Needs IMD approval |

How to get each one: [docs/data-sources.md](docs/data-sources.md).
**No MOSDAC or IMD data is stored in this repo.** Their terms do not allow redistribution.

## Tech stack

| Part | Tools |
| --- | --- |
| Engine | Python, numpy (tracking, extrapolation, ensemble, contours), FastAPI |
| Small CNN | PyTorch for training, numpy for running |
| Real-data baseline | numpy, OpenCV, netCDF4, h5py, matplotlib |
| Planned | pysteps comparison, LightGBM hazard models with calibration, PostGIS, archived MOSDAC file ingestion, CAP export, NWP blend for 3 to 6 h |
| Frontend | Next.js, MapLibre GL JS, Tailwind CSS, Framer Motion |
| Hosting | Vercel (site and Python function) |

## Roadmap

1. **Now:** synthetic engine, dashboard and API; a two-day real-data baseline.
2. **Real replay:** archived-file ingestion for TERLS radar and INSAT-3D/3DR; replay past Kerala storms; compare with persistence and pysteps.
3. **Calibrated hazards:** LightGBM hazard models with calibrated probabilities, a daily scorecard and a skill-based reliability gate; an NWP blend for 3 to 6 h.
4. **CAP export and live feeds:** CAP export for authorised official dissemination (no agency endorsement implied); live runs only after IMD and IITM approval.

## Intended benefits

These are intended outcomes. None has been measured.

| | Intended benefit | How we would measure it |
| --- | --- | --- |
| Social | Fewer lightning deaths; safer schools and outdoor workers | Warning minutes per test storm |
| Economic | Less crop and equipment damage; response teams sent where needed | Operational proxy: false-alert rate per district per season. This is not damage avoided. |
| Operational | Earlier, place-specific decisions | Minutes of lead time gained over the baseline |

## Responsible use

- VajraNow is a **decision-support prototype. It is not an official IMD warning.** Official warnings come only from IMD.
- The engine runs on synthetic storms. The only real-data result is the two-day baseline above, where motion extrapolation did not beat persistence.
- Scores on synthetic storms are used only inside the tests to stop changes that make things worse than the baseline; they are never published as accuracy.
- Places where timing cannot be trusted (hilly terrain with low tracking confidence, or outside radar coverage) are marked as such instead of showing a confident time.
- Planned CAP export is for authorised official channels. No agency endorsement is implied.
- We follow the terms of every data provider and do not redistribute restricted data. The MOSDAC files used for the baseline are listed in `validation/real_radar/input_manifest.csv` but not stored here.

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
