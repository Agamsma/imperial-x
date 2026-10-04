# Requirements coverage (SIH26084)

How VajraNow covers each output the problem statement asks for: what exists today, and how
each output will be built and checked. Status words match the final idea deck.

**Where things stand**

| Built | Preliminary evidence | Planned |
| --- | --- | --- |
| Synthetic engine: tracking, advection, a small CNN trained on synthetic storms, a 20-member ensemble (uncalibrated). Dashboard. API. | Two-day real-data baseline on TERLS radar and INSAT-3DR, 10 and 11 May 2026: motion extrapolation does not beat persistence ([validation/real_radar](../validation/real_radar/)). | Real replay, calibrated hazards, reliability gate, LightGBM, pysteps comparison, CAP export (no agency endorsement implied), NWP blend for 3 to 6 h, archived-file ingestion and authorised live feeds. |

Nothing below is validated. No skill scores for any hazard exist yet.

## Required outputs

The middle column is the deck's plan: **planned predictors > labels > verification**.

| Output | Planned predictors > labels > verification (not yet validated) | Status | What the demo does today |
| --- | --- | --- | --- |
| Convective initiation | IR cooling rate, new echoes > later radar echo > POD, FAR | Demo | New-storm zones where synthetic cloud tops cool fast and radar sees little yet. |
| Lightning density | Radar + IR features > IITM flashes, ISS-LIS checks > fractions skill | Proxy | Chance of echo of 40 dBZ or more (a radar proxy). Lightning shown on the map is synthetic. |
| Hail probability | Echo >= 50 dBZ above the 0 C level, VIL, growth > hail reports (sparse) > POD, FAR, reliability | Flag | Flag where column-maximum echo reaches 55 dBZ. Kept out of the alert levels. |
| Downburst velocity | Doppler velocity, echo-top collapse, ERA5 dry layer > AWS gusts > gust error, POD, FAR | Proxy | Strong-wind proxy: a cell of 50 dBZ or more moving 30 km/h or faster. No wind speed is estimated. Kept out of the alert levels. |
| Cloudburst | 1 h rain >= 100 mm from Z-R > rain gauges > POD, FAR | Experimental | Chance of 100 mm in the next hour, from reflectivity with Z = 300 R^1.4 (capped at 53 dBZ). The Z-R relation is not tuned for Indian radars. |
| 0 to 6 h horizon | See the lead-time tiers below > verify by lead time | Proposed | 0 to 120 min forecast in 10-minute steps, then a coarse area outlook to 6 h. |

**The label sources still need to be obtained.** We do not yet have IITM lightning flashes,
hail reports, AWS gust records or rain-gauge data for any test period. ISS-LIS and ERA5 are
open but are retrospective only. Until labels exist, none of the hazard outputs can be scored.

## Lead-time tiers

| Lead | Plan |
| --- | --- |
| 0 to 1 h | Main target. 2 km probability map from tracked storms. |
| 1 to 3 h | Wider probability zones. A skill-based reliability gate is proposed. |
| 3 to 6 h | Broad area outlook. Planned: blend extrapolation with NWP guidance for storm development. |

Confidence drops as lead time grows. The real-data baseline already shows CSI falling from
about 0.6 at +15 min to about 0.4 at +30 min for echo position alone.

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
- Lightning or NWP feeds down: run on radar and satellite only, those outputs off, confidence
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
