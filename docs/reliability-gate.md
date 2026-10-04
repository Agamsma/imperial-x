# Reliability gate

**Status: PROPOSED. Not implemented, not evaluated.**

## What exists today

The only reliability check in the code is the **"Not reliable"** label in
[`vajranow/decide.py`](../vajranow/decide.py). A place gets "Not reliable (terrain, low motion
confidence)" instead of an arrival time when all of these hold:

- the place is at 800 m or higher (hilly terrain),
- motion-tracking confidence along the incoming path is below 0.45,
- and there is some storm signal: at least 10% of ensemble runs bring a storm core there, a
  new-storm zone is nearby, or the storm chance reaches 20%.

Places outside radar coverage are marked "Outside radar coverage". Nothing in the running engine
measures skill: the scores in [`vajranow/verify.py`](../vajranow/verify.py) are used only in the
tests, on synthetic storms.

Everything below is **PROPOSED**.

## Purpose (PROPOSED)

Show a forecast output at a given lead time only when we have measured that it beats a baseline
there. Otherwise, say why it is withheld.

## Definition (PROPOSED)

| Part | Proposal |
| --- | --- |
| Metric | Per output and lead time: critical success index (echo, extreme-rain flag) or Brier skill score (probabilities), on validation days only |
| Baseline | Persistence for echo; climatology for probabilities; pysteps for echo once it is set up. Lightning and hail need their own baselines and independent labels |
| Pass rule | Skill above the baseline with 90% bootstrap confidence, resampling whole storm days |
| Minimum sample | At least 30 forecast pairs from at least 5 separate days, per lead-time bin |
| Lead-time rule | Evaluated per bin: 0 to 30, 30 to 60, 60 to 120, 120 to 360 min. A failing bin is hidden, and longer bins are not shown if a shorter one fails |
| Re-evaluation | Rolling window of recent days; the gate state is shown with its sample size |

For scale: the only real-data result so far, the two-day baseline in
[`validation/real_radar/`](../validation/real_radar/), has 32 pairs from 2 days, and motion
extrapolation did not beat persistence there. It would not meet the minimum sample above.

## Four reasons for "withheld", shown separately

1. **Low probability:** a valid forecast below the alert threshold. Not a reliability problem.
2. **Stale or missing inputs.** Today: if the latest radar scan is missing, no nowcast is run;
   a satellite image more than 20 minutes old is marked stale but still used. PROPOSED: a
   stale-radar flag with no new alerts, and satellite initiation cues turned off when satellite
   is lost.
3. **Terrain and low tracking confidence:** implemented today (see above).
4. **Not enough demonstrated skill:** the gate above. PROPOSED.

## Probabilities are not calibrated

Ensemble fractions (the share of 20 runs plus a control showing an event) are shown as
probabilities. They have not been checked against real outcomes. PROPOSED: a reliability diagram
on validation days, then isotonic or logistic recalibration.

## False-alarm control (PROPOSED, not implemented)

From the deck: a very high chance raises a level at once; lower levels need two qualifying runs
in a row. With scans about 15 minutes apart in our files, the second run adds about 15 minutes.
Choosing this needs measuring, on validation days, warning time against false-alarm ratio for
the one-run and two-run rules. Until then it is a proposal. Nothing like it is in
`vajranow/decide.py`.
