# VajraNow

**A web dashboard that tells officials which storm hazard is coming, exactly where, how sure we are, and how many minutes they have.**

Smart India Hackathon 2026 idea by **Team OmniSense** (Team ID 167415).
Problem statement **SIH26084**: Convective scale nowcasting for Thunderstorms, Hail and Cloudbursts (06 hr). Ministry of Earth Sciences. Theme: Disaster Management. Category: Software.

- **Website:** https://vajranow.vercel.app (update this link after deployment)
- **Demo:** https://vajranow.vercel.app/demo (synthetic data only)

> **Status: idea stage. The demo uses synthetic data.** Nothing here is a real forecast, and VajraNow is not running on live data.

## The problem

- Thunderstorms, hail and cloudbursts can build in minutes, over an area only a few kilometres across.
- Current nowcasts are issued at district level and stay valid for 3 hours. Officials cannot tell which town is hit first, or when.
- Lightning killed 2,558 people in India in 2023 (source: NCRB, Accidental Deaths and Suicides in India 2023).

Officials need four answers, fast: **Which hazard? Exactly where? How sure? How many minutes?**

## Our approach

Every 10 minutes, VajraNow will:

1. **Ingest** Doppler Weather Radar, INSAT-3D/3DR infrared and lightning data.
2. **Align** all of it onto one 2 km grid.
3. **Predict** where storms move and grow, using a pysteps baseline plus an AI fusion model.
4. **Decide** the warning level using IMD colours (Green, Yellow, Orange, Red) and arrival windows with a +/- range.
5. **Show** it on a GIS dashboard for officials.

Every model result is checked against the pysteps baseline on the same storm cases.

### Lead-time tiers

| Lead time | What we show |
| --- | --- |
| 0 to 1 h | Sharp 2 km hazard map |
| 1 to 3 h | Probability zones |
| 3 to 6 h | Broad area outlook |

## Architecture

The flow diagram is on the website, in the [How it works](https://vajranow.vercel.app/#how) section. Design notes will go in the [design/](design/) folder.

```
Doppler radar   ─┐
INSAT-3D/3DR IR ─┼─> Ingest ─> Align ─> Predict ─> Decide ─> Show
Lightning data  ─┘            (2 km,    (baseline +  (IMD colours,
                               10 min)   AI fusion)   arrival windows)

Predict is always verified against the pysteps baseline.
```

## Hazards

| Hazard | Status |
| --- | --- |
| Lightning | Planned |
| New storms forming | Planned |
| Hail | Experimental |
| Extreme rain / cloudburst threshold | Experimental |
| Damaging gusts | Experimental |

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
| Data and models | Python, PyTorch, pysteps, LightGBM |
| Backend | FastAPI, PostgreSQL with PostGIS |
| Frontend | Next.js, MapLibre GL JS, Tailwind CSS |
| Hosting | Vercel |

Only the frontend exists today. The other parts are planned.

## Repo layout

```
app/             Website (Next.js App Router): landing page and /demo
lib/             Shared code, including the synthetic demo storm (lib/storm.ts)
design/          System design (planned)
docs/            Documents, including data-sources.md
data_pipeline/   Ingest and align code (planned)
models/          Baseline, fusion model and verification (planned)
api/             FastAPI service (planned)
```

## Run the website locally

Needs Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:3000. The demo is at http://localhost:3000/demo.

## Roadmap

1. **Idea** (now): problem study, design, and this demo with synthetic data.
2. **Replay prototype:** run the pipeline on past storm cases from archived radar and satellite data.
3. **Fusion model:** train the AI fusion model and check it against the pysteps baseline.
4. **Live feeds with IMD:** connect live data, only with IMD approval and partnership.

## Responsible use

- VajraNow is a **decision-support prototype. It is not an official IMD warning.** Official warnings come only from IMD.
- We will not publish accuracy numbers until they are measured on real storm cases and compared with the baseline.
- Places where the model is not reliable (for example hilly terrain, or storms with unclear motion) are marked as "Not reliable" instead of showing a confident time.
- We follow the terms of every data provider and do not redistribute restricted data.

## Team OmniSense

| Name | Role |
| --- | --- |
| Team Leader Name | Team leader |
| Member 2 Name | Member |
| Member 3 Name | Member |
| Member 4 Name | Member |
| Member 5 Name | Member |
| Member 6 Name | Member |

## Links

- Website: https://vajranow.vercel.app
- Demo: https://vajranow.vercel.app/demo
- Repo: https://github.com/Agamsma/vajranow

## Licence

[MIT](LICENSE)
