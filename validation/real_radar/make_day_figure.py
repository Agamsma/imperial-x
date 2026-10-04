"""Step 6. Skill by day: motion helps only when storms move.

Input:  skill_results.json (from skill.py).
Output: figures/skill_by_day.png and ../../public/real-data/skill-by-day.png (used on the website).

Grouped bars per day and lead: persistence vs motion extrapolation, CSI at >=20 dBZ with 3 km
tolerance. Storm speeds, pair counts, pooled values and the winner of each day are read from the
results, not typed in.
"""
import json
import os

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
from matplotlib import font_manager  # noqa: E402

from common import FIGS, HERE  # noqa: E402

GRY, NAVY, INK = "#8A94A3", "#1F4E79", "#333333"
KEY = "{}min_20dBZ_tol3km"
LEADS = (15, 30)

res = json.load(open(os.path.join(HERE, "skill_results.json")))
days = sorted(res["days"])


def scores(day, lead):
    s = res["days"][day]["scores"][KEY.format(lead)]
    return s["persistence_csi"], s["motion_csi"], s["pairs"]


def day_label(day):
    """Label text and colour: navy when motion wins, dark grey otherwise."""
    d = res["days"][day]
    p_wins = [scores(day, l)[0] > scores(day, l)[1] for l in LEADS]
    winner = "persistence wins" if all(p_wins) else "motion wins" if not any(p_wins) else "mixed"
    speed = d["median_cell_motion_kmh"]
    kind = "slow storms" if speed < 10 else "moving storms"
    name = f"{int(day[8:])} May"
    return f"{name}: {kind} (~{speed:.0f} km/h)\n{winner}", (NAVY if winner == "motion wins" else INK)


# The deck uses Inter; fall back to matplotlib's default font where it is not installed.
installed = {f.name for f in font_manager.fontManager.ttflist}
plt.rcParams.update({"axes.spines.top": False, "axes.spines.right": False, "font.size": 6,
                     "font.family": "Inter" if "Inter" in installed else "DejaVu Sans"})
fig = plt.figure(figsize=(4.22, 2.25), dpi=400)
ax = fig.add_axes([.10, .40, .88, .44])
w = .36
centres, ticklabels = [], []
for g, day in enumerate(days):
    for j, lead in enumerate(LEADS):
        x = g * 2.6 + j * 1.0
        centres.append(x)
        ticklabels.append(f"+{lead} min")
        p, m, _ = scores(day, lead)
        for k, (v, col) in enumerate(((p, GRY), (m, NAVY))):
            xb = x + (k - .5) * w
            ax.bar(xb, v, w, color=col, label=(["Persistence (no motion)", "Motion extrapolation"][k] if g == 0 and j == 0 else None))
            ax.text(xb, v + .015, f"{v:.2f}", ha="center", va="bottom", fontsize=6, fontweight="bold", color=(INK, NAVY)[k])
ax.set_xticks(centres)
ax.set_xticklabels(ticklabels, fontsize=6)
ax.set_ylim(0, .85)
ax.set_yticks([0, .2, .4, .6, .8])
ax.set_ylabel("CSI (higher is better)", fontsize=6)
ax.tick_params(labelsize=5.8, length=2)
ax.legend(fontsize=6, frameon=False, loc="upper left", ncol=2, bbox_to_anchor=(0.0, 1.13))
for g, day in enumerate(days):
    xc = g * 2.6 + .5
    text, colour = day_label(day)
    ax.annotate(text, xy=(xc, 0), xycoords=("data", "axes fraction"), xytext=(0, -15), textcoords="offset points",
                ha="center", va="top", fontsize=6, fontweight="bold", linespacing=1.15, color=colour)

pairs = [scores(d, 15)[2] for d in days]
pool = {l: res["pooled"][KEY.format(l)] for l in LEADS}
fig.text(.02, .975, "Real ISRO radar: motion helps only when storms move", fontsize=7.5, fontweight="bold", va="top")
fig.text(.02, .085,
         f"TERLS radar, 10–11 May 2026, team analysis. CSI, echo ≥20 dBZ, 3 km tolerance. {' + '.join(map(str, pairs))} pairs.\n"
         f"Both days pooled: {pool[15]['persistence_csi']:.2f} vs {pool[15]['motion_csi']:.2f} (+15 min), "
         f"{pool[30]['persistence_csi']:.2f} vs {pool[30]['motion_csi']:.2f} (+30 min). Two days only.",
         fontsize=4.9, color="#333", va="top", linespacing=1.25)

os.makedirs(FIGS, exist_ok=True)
public = os.path.normpath(os.path.join(HERE, "..", "..", "public", "real-data"))
os.makedirs(public, exist_ok=True)
for path in (os.path.join(FIGS, "skill_by_day.png"), os.path.join(public, "skill-by-day.png")):
    fig.savefig(path)
print("wrote figures/skill_by_day.png and public/real-data/skill-by-day.png;",
      {d: [scores(d, l)[:2] for l in LEADS] for d in days})
