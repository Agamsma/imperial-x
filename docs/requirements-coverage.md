# Requirements coverage (SIH26084)

How VajraNow covers each output the problem statement asks for: what exists today, and how
each output will be built and checked. Status words match the final idea deck. The official
problem statement text is in [ps-statement.md](ps-statement.md).

**Where things stand**

| Built | Preliminary evidence | Planned |
| --- | --- | --- |
| Synthetic engine: tracking, advection, a small CNN trained on synthetic storms, a 20-member ensemble (uncalibrated). Dashboard. API. | Two-day real-data baseline on TERLS radar and INSAT-3DR, 10 and 11 May 2026: motion helps when storms move (11 May) but not on slow storms (10 May); pooled, motion extrapolation does not beat persistence ([validation/real_radar](../validation/real_radar/)). | Real replay, calibrated hazards, reliability gate, LightGBM, pysteps comparison, CAP export (no agency endorsement implied), blend with NCMRWF model guidance for 3 to 6 h, archived-file ingestion and authorised live feeds. |

Nothing below is validated. No skill scores for any hazard exist yet.

**Real data so far.** Archived-file ingestion is planned for the dashboard pipeline. Real MOSDAC
files have so far been processed only in the separate baseline study
([validation/real_radar](../validation/real_radar/)); the engine and the dashboard run on
synthetic data.

## Required outputs

Matches the deck (V4): **today → next**, then the planned labels and checks. The "next" step
is planned, not built. It uses the 3D TERLS volume (81 levels, 250 m apart) and the radial
velocity (`VEL`) field that are already in our radar files.

| Output | Today (demo) | Next (planned, not built) | Labels > verification (planned) | Status |
| --- | --- | --- | --- | --- |
| Convective initiation | New-storm zones where synthetic cloud tops cool fast and radar sees little yet | INSAT IR cooling before the first radar echo | Later radar echo > POD, FAR | Demo |
| Lightning density | Chance of echo of 40 dBZ or more (radar proxy). Lightning shown on the map is synthetic | Echo of 35 dBZ or more at the −10 °C level (temperature from ERA5), plus IR features | IITM flashes; ISS-LIS spot checks > fractions skill | Proxy |
| Hail probability | Flag where column-maximum echo reaches 55 dBZ; kept out of the alert levels | 45 dBZ echo at least 1.4 km above the freezing level (Waldvogel criterion), plus VIL, echo-top height and growth | Hail reports (sparse) > hit rate (POD), false alarms (FAR), reliability | Flag |
| Downburst velocity | Strong-wind proxy: a cell of 50 dBZ or more moving 30 km/h or faster; no wind speed estimated; kept out of the alert levels | Low-level radial-velocity divergence from `VEL` (in our files, not yet processed), echo-top collapse, dry layer aloft (ERA5 profiles for retrospective development; NCMRWF forecast profiles for live use) | AWS station gusts > gust error, POD, FAR | Proxy |
| Cloudburst | Radar rain of 50 mm and 100 mm or more in an hour, from Z = 300 R^1.4 (capped at 53 dBZ); 100 mm/h is the cloudburst threshold as widely reported. Z-R not tuned for Indian radars | Same thresholds; Cherrapunji radar files we hold are a planned second region | Rain gauges (planned check) > POD, FAR | Experimental |
| 0 to 6 h horizon | 0 to 120 min forecast in 10-minute steps, then a coarse area outlook to 6 h from advected storm areas and new-storm zones | 0–3 h nowcast from fresh observations; blend with NCMRWF model guidance for 3 to 6 h | Verify by lead time | 0–1 h demo |

Station gusts measure the wind at the surface. They can verify the surface wind a downburst
produces, but not the downburst velocity itself.

**The label sources still need to be obtained.** We do not yet have IITM lightning flashes,
hail reports, AWS gust records or rain-gauge data for any test period. ISS-LIS and ERA5 are
open but are retrospective only. Until labels exist, none of the hazard outputs can be scored.

## Checked against the official problem statement

Each ask in [ps-statement.md](ps-statement.md), and where VajraNow stands.

| Problem statement asks for | Where VajraNow stands |
| --- | --- |
| 0 to 6 h lead time | Demo: 0 to 120 min forecast plus a coarse outlook to 6 h. Blend with NCMRWF model guidance for 3 to 6 h planned |
| 1 to 3 km resolution | 2 km output grid. Real detail is coarser: satellite about 4 km, radar beam widens with range |
| Real-time system | Not yet. The demo replays synthetic storms. Authorised live feeds planned, after IMD and IITM approval |
| Multi-source data fusion | Demo: a small CNN fuses synthetic radar, infrared and lightning. Trained on synthetic storms only |
| Ingest high-frequency streams | Synthetic inputs today. Archived-file ingestion planned for the dashboard pipeline; real files processed only in the baseline study |
| DWR reflectivity and velocity fields | Reflectivity used (baseline study). Velocity not yet processed |
| INSAT-3D/3DR thermal infrared | INSAT-3DR TIR1 read in the baseline study; synthetic infrared in the demo |
| Ground-based lightning networks | Not yet. IITM data is a planned request; ISS-LIS (from space) planned for spot checks |
| Detect early convective initiation | Demo: new-storm zones from synthetic cloud-top cooling |
| Lightning strike density | Radar proxy (chance of echo of 40 dBZ or more) |
| Hail probability | 55 dBZ flag, not validated |
| Downburst velocity | Strong-wind proxy only; no velocity estimated |
| Cloudburst thresholds | Experimental Z-R estimate of 100 mm in an hour |
| GIS dashboard with 1 to 3 km hazard zones | Built (MapLibre, 2 km warning polygons), on synthetic data |
| Live countdown clocks for storm arrivals | Not built. The dashboard shows arrival windows as a range (for example "20 to 50 min"), not a running clock |
| Users: local administrations, aviation, farming | Local administrations and farmers are named users in the deck. Aviation is not addressed yet |

## Lead-time tiers

| Lead | Plan |
| --- | --- |
| 0 to 1 h | Main target. 2 km probability map from tracked storms. |
| 1 to 3 h | Wider probability zones. A skill-based reliability gate is proposed. |
| 3 to 6 h | Broad area outlook. Blend with NCMRWF model guidance for storm development (planned). |

Storms build in minutes, so we nowcast 0–3 h from fresh observations and hand over to NCMRWF
model guidance for 3–6 h.

Confidence drops as lead time grows. The real-data baseline already shows CSI falling from
about 0.6 at +15 min to about 0.4 at +30 min for echo position alone. It also shows that motion
helps when storms move (11 May, ~12 km/h) but not on slow storms (10 May, ~6 km/h); pooled over
both days, motion extrapolation does not beat persistence. So the model must forecast growth and
decay, not just motion. Two days are too few for a general claim.

## Verification plan (planned)

- Split by whole days, adjacent days grouped: 60% train, 20% validate, 20% test. Models are
  chosen on validation days; test days are used once.
- Targets fixed in advance (targets, not results): beat persistence and pysteps for echo at
  15, 30 and 60 min (other baselines for lightning and hail); calibrated probabilities;
  arrival error within 10 min up to 30 min lead.
- Arrival range target: the range catches 8 of 10 past arrivals, with its width reported. Not
  yet measured.
- Scores by lead time against real lightning flashes, as at DWD. Radar-proxy labels are
  reported apart. Missing data is never scored as a negative.
- A daily scorecard against observations and baselines (persistence, pysteps) is proposed.

## Missing feeds

What the engine code does today:

- An earlier radar scan is missing: reported, and tracking uses the remaining scans.
- The latest radar scan is missing: no nowcast is run.
- A satellite image more than 20 minutes old: marked stale on the dashboard; its cloud-top cues
  are still used.

Planned design, not built:

- Radar lost: stale flag, no new alerts.
- Satellite lost: initiation cues turned off.
- Lightning or NCMRWF model feeds down: run on radar and satellite only, those outputs off, confidence
  lowered.

## Alerts and dissemination

- Levels 1 to 4 follow IMD's colour meaning (green to red). Official warnings stay with IMD.
- Hail and wind are flags only and are kept out of the alert levels.
- Proposed false-alarm control: a very high chance raises a level at once; lower levels need
  two runs in a row (adds about 15 min; the trade-off is still to be measured).
- Planned integration: CAP export for authorised official dissemination (for example NDMA
  Sachet). No agency endorsement implied.

## Benefits

Intended outcomes, not measured:

| | Intended benefit | Measure |
| --- | --- | --- |
| Social | Fewer lightning deaths; safer schools and outdoor workers | Warning minutes per test storm |
| Economic | Less crop and equipment damage; response teams sent where needed | Operational proxy: false-alert rate per district per season. This is not damage avoided. |
| Operational | Earlier, place-specific decisions | Minutes of lead time gained over the baseline |
