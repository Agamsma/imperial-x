"""Named demo scenarios. Each tells a different storm story; all are synthetic."""

from __future__ import annotations

from .synthetic import Cell, Scenario

KOCHI_SQUALL = Scenario(
    id="kochi-squall",
    title="Squall line moving into Kochi",
    summary="A line of strong storms crosses the coast near Alappuzha and races north-east towards Kochi.",
    seed=11,
    story=[
        "Fast storms (about 38 km/h) moving north-east along the coast.",
        "The strongest cell carries a hail signal and is on course for Kochi Airport.",
        "A new cell is forming offshore, seen first as cooling cloud tops on satellite.",
        "Storms may also form over the hills near Munnar, where timing is hard to trust.",
    ],
    cells=[
        Cell(76.18, 9.93, 38, 45, 58, -80, -15, 60, 150, radius_km=8, aspect=1.8, cores=3, stratiform=0.8, pre_cool_min=20, seed=1),
        Cell(76.30, 9.62, 37, 47, 52, -90, -40, 20, 110, radius_km=7, aspect=1.6, cores=3, stratiform=0.7, seed=2),
        Cell(76.45, 9.36, 36, 44, 47, -100, -60, -20, 50, radius_km=6, aspect=1.4, cores=2, stratiform=0.6, seed=3),
        Cell(75.92, 10.20, 36, 46, 50, 5, 45, 80, 150, radius_km=6, aspect=1.3, cores=2, stratiform=0.5, pre_cool_min=40, seed=4),
        Cell(77.12, 10.02, 6, 260, 46, 10, 70, 100, 160, radius_km=5, aspect=1.2, cores=2, stratiform=0.3, pre_cool_min=35, seed=5),
    ],
)

GHATS_AFTERNOON = Scenario(
    id="ghats-afternoon",
    title="Afternoon storms over the Western Ghats",
    summary="Slow storms grow over the hills of Idukki and Pathanamthitta and drift west towards the plains.",
    seed=23,
    missing_scans=(-30,),
    story=[
        "Weak steering winds: storms drift west at about 10 to 20 km/h.",
        "Storm cores are over Idukki Dam and Sabarimala now. Kottayam and Pathanamthitta are next, about an hour away.",
        "Satellite shows new storms forming near Idukki and the southern hills before radar sees them.",
        "One radar scan (-30 min) is missing. Quality checks note it and tracking uses the rest.",
    ],
    cells=[
        Cell(77.00, 9.90, 10, 250, 52, -70, -20, 30, 90, radius_km=6, aspect=1.2, cores=3, stratiform=0.5, seed=1),
        Cell(77.15, 9.45, 10, 250, 50, -40, 5, 40, 100, radius_km=6, aspect=1.2, cores=2, stratiform=0.4, seed=2),
        Cell(77.08, 10.12, 9, 250, 49, 5, 50, 80, 140, radius_km=5, aspect=1.1, cores=2, stratiform=0.3, pre_cool_min=40, seed=3),
        Cell(77.12, 8.78, 9, 255, 47, 15, 55, 90, 150, radius_km=5, aspect=1.1, cores=2, stratiform=0.3, pre_cool_min=40, seed=4),
        Cell(77.35, 9.95, 10, 250, 45, -100, -60, -30, 30, radius_km=6, aspect=1.2, cores=2, stratiform=0.6, seed=5),
        Cell(76.80, 9.70, 14, 255, 51, -50, -5, 50, 130, radius_km=7, aspect=1.4, cores=3, stratiform=0.6, seed=6),
    ],
)

TVM_CLOUDBURST = Scenario(
    id="tvm-cloudburst",
    title="Slow heavy-rain cell near Thiruvananthapuram",
    summary="An intense storm barely moves and keeps rebuilding over the same area, so rain piles up fast.",
    seed=37,
    story=[
        "The main cell moves at only about 4 km/h and new cores keep forming behind it.",
        "Rain totals for the next hour may cross the cloudburst threshold (100 mm in an hour).",
        "A weaker, faster storm passes Kollam to the north.",
    ],
    cells=[
        Cell(76.99, 8.60, 4, 300, 58, -60, -10, 90, 170, radius_km=6, aspect=1.2, cores=3, stratiform=0.9, seed=1),
        Cell(77.03, 8.57, 4, 300, 55, -10, 30, 100, 170, radius_km=5, aspect=1.2, cores=2, stratiform=0.6, pre_cool_min=25, seed=2),
        Cell(77.06, 8.55, 4, 300, 54, 30, 70, 110, 180, radius_km=5, aspect=1.2, cores=2, stratiform=0.6, pre_cool_min=25, seed=3),
        Cell(76.50, 8.80, 25, 20, 48, -60, -20, 20, 80, radius_km=6, aspect=1.4, cores=2, stratiform=0.6, seed=4),
    ],
)

SCENARIOS = {s.id: s for s in (KOCHI_SQUALL, GHATS_AFTERNOON, TVM_CLOUDBURST)}
DEFAULT_SCENARIO = KOCHI_SQUALL.id
