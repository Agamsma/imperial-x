# Submission audit (4 Oct 2026)

Scope: the SIH26084 idea deck, this repository, the website and the real-data baseline. Each
status was checked against `main` and the final deck on 4 Oct 2026.

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
| 10 | IITM status ("requested" vs "planned") | H | No record of a sent request | Deck and README: "Planned request" | Open: confirm the real status |
| 11 | NCMRWF status | M | Same | Deck and README: "NCMRWF planned" | Open: confirm |
| 12 | CAP file and Sachet read as built | H | No CAP code in the repo | Deck: "Planned integration ... No agency endorsement implied". Same on the site and README | Fixed |
| 13 | "Reliability gate and scorecard, tested on Indian radar" | H | Not evaluated; "Not reliable" = terrain + low tracking confidence only | Deck: "skill-based gate proposed"; spec in [`reliability-gate.md`](reliability-gate.md) | Fixed (spec only, not built) |
| 14 | "2 runs in a row" rule | M | Not in `vajranow/decide.py` | Deck: "Proposed ... (adds about 15 min; trade-off to be measured)" | Fixed |
| 15 | "If a source drops, the rest keep running" | M | If the latest radar scan is missing, the engine raises an error and no nowcast is run; a stale satellite image is flagged but still used | Site, README and docs describe what the code does and mark the rest planned. The deck's "Radar lost: stale flag, no new alerts" can read as built; the stale flag is not implemented | Partly (deck wording) |
| 16 | INSAT "3D + 3DR, 15 min combined" | M | Our files: INSAT-3DR, 30 min | Deck: "INSAT-3DR (verified in our data)", "30 min frames in our order" | Fixed |
| 17 | 3 to 6 h described as a weather-model outlook | H | Code: advected storm areas plus new-storm zones | Deck: "Planned: blend extrapolation with NWP guidance"; same in [`requirements-coverage.md`](requirements-coverage.md) | Fixed |
| 18 | Required outputs vs proxies (lightning density, hail, downburst, cloudburst) | H | Code: radar-threshold proxies | Labelled proxy / flag / experimental in the deck, docs, site and engine labels | Fixed |
| 19 | Requirement list not checked against the portal text | H | Official text in [`ps-statement.md`](ps-statement.md) | Line-by-line table in [`requirements-coverage.md`](requirements-coverage.md). Gaps stated: DWR velocity not processed, no ground lightning network data, no live countdown clocks, aviation users not addressed | Partly (gaps remain) |
| 20 | "Exactly where?" and the 2 km claim | M | Satellite about 4 km, radar beam widens with range | "Where, and how precisely?"; effective resolution stated in the deck, site and README | Fixed |
| 21 | Fallback "ISS-LIS, radar proxy, ERA5" | M | A radar proxy needs radar; ERA5 is not live | Deck: "ISS-LIS, ERA5: retrospective only" | Fixed |
| 22 | Cost "about ₹600" | M | Assumes existing laptops and free tiers | Deck: "extra cash only"; domain "planned, not bought" | Open: confirm the domain |
| 23 | Impact stated as an outcome | M | Nothing measured | "Intended", "not measured"; false-alert rate called an operational proxy, not damage avoided | Fixed |
| 24 | Comparison column for other products | M | Unsourced before | Deck names Damini [19] and the IMD nowcast [2]; "Not assessed" where unknown | Partly (thin sources) |
| 25 | Citation fit | M | [6] is deep learning, not LightGBM | [6] cited as an idea only; listed in [`NOTICE.md`](../NOTICE.md) | Partly (not every reference re-read) |
| 26 | Deck metadata "Crowdfunder 2013" | L | `docProps/core.xml` | Title and author updated; template originals kept in the comments | Fixed (template licence unverified) |
| 27 | Originality | M | Not checked | [`NOTICE.md`](../NOTICE.md) lists the methods taken from the literature | Open: no code or chart similarity scan |
| 28 | The name VajraNow is already used | M | GitHub search: 4 other repositories with the same or a near name | None yet | Open: rename is your choice |
| 29 | Dashboard screenshot placeholder | M | Slide 2 still says "Insert the /demo page capture here" | None yet | Open: add the screenshot |
| 30 | Publishing imagery derived from MOSDAC data | M | MOSDAC terms not checked | Public figures show only derived numbers (areas, fractions, CSI), no radar or satellite images | Open: check the terms |
| 31 | Validation design | M | Plan text only | Day-grouped split, independent labels, missing data never scored as negative (deck, method page, coverage doc). The baseline itself still counts missing pixels as no echo, as its README says | Partly (plan, not run) |
| 32 | Ensemble fractions called probabilities | M | No calibration | Disclosed in the deck, README, site and method page | Fixed |

## Remaining work that needs new evidence

Send the IITM and NCMRWF requests, then update their status. Re-read every reference against
the claim it supports. Evaluate a skill-based gate and scorecard on many more storm days. Run
and score the engine on real data. Source the product comparison. Run a code and chart
similarity scan. Add the dashboard screenshot. Decide on the name. Check MOSDAC's terms for
derived imagery.
