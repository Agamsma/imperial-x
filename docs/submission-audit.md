# Submission audit (4 Oct 2026, deck V4)

Scope: the SIH26084 idea deck (**final version: V4**, `VajraNow_SIH26084_Idea_V4.pptx`), this
repository, the website and the real-data baseline. Each status was checked against `main` and
deck V4 on 4 Oct 2026. Rows 1 to 32 were first written against deck V3 and are updated for V4;
the claims that are new or changed in V4 are mapped to their evidence in the second table.

Severity: **H** a claim a juror could show to be wrong, **M** weakens credibility, **L** polish.
Status: **Fixed** (the correction is in the repo or deck), **Partly**, **Open** (needs evidence
or work we do not have yet).

| # | Issue | Sev | Evidence | Correction | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | Real-data provenance unverified | H | netCDF metadata read: "ISRO RCTLS C-Band DWR", SAC ISRO, 481 × 481 grid with 81 heights; 25 scans used on 10 May, 18 on 11 May | [`validation/real_radar/README.md`](../validation/real_radar/README.md), [`input_manifest.csv`](../validation/real_radar/input_manifest.csv) with SHA-256 per file | Fixed |
| 2 | Cherrapunji (RSCHR) and TERLS files, and 10/11/12 May, mixed up | H | RSCHR files on disk: 10 May (9), 12 May (44). Results use TERLS 10 and 11 May only | The baseline README says which files are used and that the Cherrapunji files are not | Fixed |
| 3 | "Radar every 10 min" | M | Median scan spacing 15.3 min in our files (`skill_results.json`) | Deck: "about every 15 min", "scans about 15 min apart in our files". Site and docs say the demo engine steps 10 min on synthetic scans | Fixed |
| 4 | Time zone not stored in the radar files | M | `time` units have no zone | Documented as read as UTC by convention | Open (cannot be proven from the files) |
| 5 | CSI numbers not reproducible on record | H | Pipeline re-run from a clean clone: 32 pairs (18 + 14), 0.62 / 0.61 at +15 min, 0.43 / 0.39 at +30 min, identical outputs | Definitions, pair rules and pooling documented in the baseline README | Fixed |
| 6 | Life-cycle plot compared whole-domain radar with a 1° satellite box | H | Code review | `make_figure.py` counts radar in the same 1° × 1° box as the satellite | Fixed |
| 7 | Result chart too small to read on the slide | M | Slide render | Redrawn at slide size (`make_skill_figure.py`) | Partly (not checked on a projector) |
| 8 | README said "no real radar" while the deck showed real data | H | README vs slide 2 | README status block: built / preliminary evidence / planned, with the baseline section | Fixed |
| 9 | LightGBM, pysteps or Py-ART read as built | H | None is in any requirements file; pysteps is named only in a comment in `vajranow/advection.py` | Deck: "Used: numpy, OpenCV, PyTorch, FastAPI, Next.js. Planned: pysteps, LightGBM, PostGIS". README tech stack split the same way | Fixed |
| 10 | IITM status ("requested" vs "planned") | H | No record of a sent request | Deck V4, README, site and data-sources doc: "To request" | Open: send the request, then update |
| 11 | NCMRWF status | M | Same | Deck V4, README, site and data-sources doc: "NCMRWF to request" | Open: send the request, then update |
| 12 | CAP file and Sachet read as built | H | No CAP code in the repo | Site and README: planned, no agency endorsement implied. Deck V4 keeps "No agency endorsement implied" but slide 5 now says state control rooms get "Hazard zones + CAP alerts" without "planned" | Partly (deck V4 wording) |
| 13 | "Reliability gate and scorecard, tested on Indian radar" | H | Not evaluated; "Not reliable" = terrain + low tracking confidence only | Spec in [`reliability-gate.md`](reliability-gate.md), marked proposed. Deck V4 slide 2 describes "a gate built on past skill and current data quality" and a "daily public scorecard" without saying proposed (see V4 rows below) | Partly (deck V4 wording) |
| 14 | "2 runs in a row" rule | M | Not in `vajranow/decide.py` | Reliability-gate doc: proposed. Deck V4 drops "Proposed": "Raise a level only on a very high chance or 2 runs in a row" | Partly (deck V4 wording) |
| 15 | "If a source drops, the rest keep running" | M | If the latest radar scan is missing, the engine raises an error and no nowcast is run; a stale satellite image is flagged but still used | Site, README and docs describe what the code does and mark the rest planned. Deck V4: "Run on the remaining sources with those outputs off; if radar is lost, mark forecasts stale and issue no new alerts" reads as built; neither is implemented | Partly (deck wording) |
| 16 | INSAT "3D + 3DR, 15 min combined" | M | Our files: INSAT-3DR, 30 min | Deck: "INSAT-3DR (verified in our data)", "30 min frames in our order" | Fixed |
| 17 | 3 to 6 h described as a weather-model outlook | H | Code: advected storm areas plus new-storm zones | Deck V4: "3–6 h: blend with NCMRWF model guidance"; repo and site say the same, marked planned | Fixed |
| 18 | Required outputs vs proxies (lightning density, hail, downburst, cloudburst) | H | Code: radar-threshold proxies | Labelled proxy / flag / experimental in the deck, docs, site and engine labels | Fixed |
| 19 | Requirement list not checked against the portal text | H | Official text in [`ps-statement.md`](ps-statement.md) | Line-by-line table in [`requirements-coverage.md`](requirements-coverage.md). Gaps stated: DWR velocity not processed, no ground lightning network data, no live countdown clocks, aviation users not addressed | Partly (gaps remain) |
| 20 | "Exactly where?" and the 2 km claim | M | Satellite about 4 km, radar beam widens with range | "Where, and how precisely?"; effective resolution stated in the deck, site and README | Fixed |
| 21 | Fallback "ISS-LIS, radar proxy, ERA5" | M | A radar proxy needs radar; ERA5 is not live | Deck: "ISS-LIS, ERA5: retrospective only" | Fixed |
| 22 | Cost "about ₹600" | M | Assumes existing laptops and free tiers | Deck V4: prototype cash "≈ ₹0", domain row removed, IITM and NCMRWF data costs "to be confirmed" | Fixed |
| 23 | Impact stated as an outcome | M | Nothing measured | Deck V4 heading: "Benefits of the solution (intended)". README and coverage doc: intended, not measured; false-alert rate is an operational measure, not damage avoided. The new environmental row (spraying before rain) is also intended only | Fixed |
| 24 | Comparison column for other products | M | Unsourced before | Deck V4: "by design; not yet tested against these"; Damini cells now filled from [19] | Partly (thin sources) |
| 25 | Citation fit | M | [6] is deep learning, not LightGBM | [6] cited as an idea only; listed in [`NOTICE.md`](../NOTICE.md) | Partly (not every reference re-read) |
| 26 | Deck metadata "Crowdfunder 2013" | L | `docProps/core.xml` | Title and author updated; template originals kept in the comments | Fixed (template licence unverified) |
| 27 | Originality | M | Not checked | [`NOTICE.md`](../NOTICE.md) lists the methods taken from the literature | Open: no code or chart similarity scan |
| 28 | The name VajraNow is already used | M | GitHub search: 4 other repositories with the same or a near name | None yet | Open: rename is your choice |
| 29 | Dashboard screenshot placeholder | M | Deck V4 slide 2 has a screenshot of the live /demo page (REPLAY MODE, new hazard labels) | Placeholder replaced | Fixed |
| 30 | Publishing imagery derived from MOSDAC data | M | MOSDAC terms not checked | Public figures show only derived numbers (areas, fractions, CSI), no radar or satellite images | Open: check the terms |
| 31 | Validation design | M | Plan text only | Day-grouped split, independent labels, missing data never scored as negative (deck, method page, coverage doc). The baseline itself still counts missing pixels as no echo, as its README says | Partly (plan, not run) |
| 32 | Ensemble fractions called probabilities | M | No calibration | Disclosed in the deck, README, site and method page | Fixed |

## Deck V4: new or changed claims and their evidence

| Deck V4 claim (slide) | Evidence in the repo | Status |
| --- | --- | --- |
| "Lightning killed 2,560 people in India in 2023" (2, ref [1]) | NCRB ADSI 2023 PDF: 2,560 lightning deaths, 39.7% of 6,444 deaths from forces of nature (text and Table 1.0). README and site now say 2,560 | Fixed |
| "IMD nowcasts: per district and station, with a validity time" (2) | README problem section | Fixed |
| "Fills the 0–3 h gap ... hand over to NCMRWF model guidance beyond 3 h" (2) | README, site, method page, coverage doc: 0–3 h nowcast, NCMRWF blend for 3–6 h **planned** | Fixed (planned) |
| "Fuse Doppler radar (3D reflectivity + velocity), INSAT-3DR and lightning on one 2 km grid, refreshed with every radar scan (~15 min)" (2) | Design. The demo engine fuses synthetic radar, infrared and lightning in 10-minute steps; real velocity is not processed; per-scan runs are planned | Partly (design, not built) |
| "Use the full 3D radar volume: −10 °C echo for lightning, 45 dBZ above freezing for hail, low-level divergence for downbursts" (2, 3) | README hazards table, site hazards cards, method page, coverage doc: all marked **planned, not built**. The 81-level volume and `VEL` field are in our TERLS files | Partly (planned) |
| "Running today: engine, map dashboard and open API (synthetic storms) + a real-radar test" (2) | `vajranow/`, `app/demo/`, `/api/py`, `validation/real_radar/` | Fixed |
| "Missing or late data is flagged, never hidden" (2) | Earlier missing radar scans are reported; a satellite image over 20 min old is marked stale. A missing latest scan stops the run (no nowcast, so nothing stale is shown) | Partly |
| "Not reliable" as "a gate built on past skill and current data quality" (2) | Only terrain + low tracking confidence is built; the skill gate is proposed ([`reliability-gate.md`](reliability-gate.md)) | Open (reads as built) |
| "Arrival windows that are scored: target is 8 of 10 observed arrivals inside the window" (2) | A target; arrival windows have not been scored on real data | Open (target only) |
| "Daily public scorecard vs persistence and pysteps, on real Indian radar" (2, 3) | Not built. The only real-data scoring is the two-day baseline | Open (reads as built) |
| "Every input file listed and hashed: anyone can rerun our results" (2) | [`input_manifest.csv`](../validation/real_radar/input_manifest.csv) with SHA-256; clean-clone rerun reproduces every output | Fixed |
| "Motion alone fails on slow storms, so our model must forecast growth and decay" (2) and the per-day chart | `skill_results.json`: 10 May (6.3 km/h) persistence 0.596 vs 0.567 and 0.486 vs 0.398; 11 May (12.3 km/h) motion 0.664 vs 0.642 and 0.388 vs 0.366; pooled 0.62 / 0.61 and 0.43 / 0.39. Chart rebuilt by `make_day_figure.py` (same numbers; font differs where Inter is not installed). Two days only | Fixed |
| INGEST: "Archive replay through the same interface as live feeds; real TERLS + INSAT files read today" (3) | Real files are read only by the separate baseline scripts. The engine has no archive-replay or live-feed interface yet | Open (reads as built) |
| ALIGN / PREDICT / DECIDE / SHOW "(built)" items (3) | Clutter and speckle removal, 2 km grid, tracking, advection, small CNN, 20-member ensemble, levels and arrival windows, dashboard and API are in the code. Calibration, parallax correction, pysteps, LightGBM, scorecard and CAP export are marked "Next" | Fixed |
| "Daily scorecard: every forecast checked against what radar saw next" (3) | Not built | Open (reads as built) |
| Required outputs, today → next (3) | Same rows in [`requirements-coverage.md`](requirements-coverage.md), README and site; "next" marked planned | Fixed |
| Data table: TERLS "2 days in hand, more ordered"; INSAT-3DR "in hand, more ordered"; IITM and NCMRWF "to request" (3) | README, site, [`data-sources.md`](data-sources.md); 44 TERLS and 14 INSAT-3DR files listed in the manifest | Fixed |
| "Cherrapunji radar for a cloudburst-prone second region" (4) | Files held (10 and 12 May 2026), not used anywhere in the repo; stated as planned | Fixed (planned) |
| "Lightning scored against independent flash data; missing data masked, not counted as no storm" (4) | Plan. The two-day baseline still counts missing pixels as no echo (its README says so) | Partly (plan) |
| Built / Real-data evidence: "TERLS + INSAT-3DR, 10–11 May 2026, 43 radar scans" (4) | 25 + 18 scans used (`skill_results.json`); 14 INSAT-3DR images | Fixed |
| "CAP export ... only through IMD/SDMA channels. No agency endorsement implied" (5) | No CAP code; planned in README and site | Fixed (planned); see row 12 |

## Remaining work that needs new evidence

Send the IITM and NCMRWF requests, then update their status. Reword the deck V4 claims marked "reads as built" above, or build them. Re-read every reference against
the claim it supports. Evaluate a skill-based gate and scorecard on many more storm days. Run
and score the engine on real data. Source the product comparison. Run a code and chart
similarity scan. Decide on the name. Check MOSDAC's terms for
derived imagery.
