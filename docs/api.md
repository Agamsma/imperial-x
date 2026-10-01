# VajraNow engine API

Base URL: `https://vajranow.vercel.app/api/py`
Interactive docs: `https://vajranow.vercel.app/api/py/docs`

> Every response is computed from **synthetic storms**. Not a real forecast and not an official IMD warning.

## Endpoints

### `GET /health`

Engine status.

```json
{ "status": "ok", "engine": "VajraNow engine", "version": "0.2.0", "python": "3.13", "data": "synthetic", "fusion_model": "loaded", "disclaimer": "..." }
```

### `GET /v1/scenarios`

The demo scenarios: `id`, `title`, `summary`, `story` (list of plain sentences).

Current ids: `kochi-squall`, `ghats-afternoon`, `tvm-cloudburst`.

### `GET /v1/places`

The places that get arrival windows: `id`, `name`, `lon`, `lat`, `elev_m`, `kind`.

### `GET /v1/nowcast/{scenario}`

The full nowcast for one scenario. Main fields:

| Field | Meaning |
| --- | --- |
| `engine` | Version, data type (`synthetic`), number of ensemble members, fusion status, time spent per stage (ms) |
| `grid` | Size, 2 km cells, bounds, and image corners for map overlays |
| `radar` | Radar name, position, 250 km range ring (GeoJSON) |
| `feeds` | Status of radar, satellite and lightning feeds |
| `qc` | Clutter and speckle removed, missing scans, notes |
| `motion` | Average speed and direction, tracking quality, motion arrows (GeoJSON) |
| `frames` | 7 observed scans (-60 to 0 min), 12 forecast steps (+10 to +120 min) and a 3 to 6 hour outlook. Each has a radar image (`radar`, PNG data URL), warning polygons (`warnings`, GeoJSON with `level` 1 to 3) and recent lightning (`lightning`, GeoJSON) |
| `cells` | Storm cells: position, strongest echo, speed and direction, trend, hazards, forecast track and uncertainty cone |
| `initiation` | Areas where satellite suggests new storms (experimental) |
| `places` | For each place: level, arrival window, hazards, rain in the next hour, probabilities by lead time, and the level in every frame |
| `alerts` | Plain-language alerts in IMD colours, most severe first |
| `method` | Thresholds and rules used |

### `GET /v1/nowcast/{scenario}/point?lon=&lat=`

Forecast for any point inside the forecast area (422 outside it).

| Field | Meaning |
| --- | --- |
| `levels` | Level for now and every 10 minutes to +120 (0 green, 1 yellow, 2 orange, 3 red) |
| `leads` | The minutes those levels refer to |
| `arrival` | `status` (now, expected, possible, none, unreliable, outside), `text`, `window` [from, to] in minutes, `most_likely`, `chance` (% of ensemble members), `confidence` |
| `probability` | Chance of a storm (35 dBZ), lightning (40), heavy core (45), severe core (50) and hail signal (55) by lead time, plus next-hour rain of 50 mm and 100 mm |
| `rain_next_hour_mm` | Median and 90th percentile rain total for the next hour |
| `hazards` | Plain hazard flags |

Example:

```bash
curl "https://vajranow.vercel.app/api/py/v1/nowcast/kochi-squall/point?lon=76.40&lat=10.15"
```

### `GET /v1/method`

Thresholds, the Z-R relation, level rules and neighbourhood sizes the engine uses.

## Caching

Nowcasts for the demo scenarios do not change within a deployment, so Vercel's CDN caches them (`s-maxage`), and every new deployment clears the cache. Browsers always revalidate (`max-age=0`).

## How routing works on Vercel

The Next.js site rewrites `/api/py/<path>` to the Python function `api/index.py` and passes the original path as the `__path` query parameter. A small middleware in `vajranow/service.py` puts the path back, so the same FastAPI app runs unchanged locally (uvicorn) and on Vercel.
