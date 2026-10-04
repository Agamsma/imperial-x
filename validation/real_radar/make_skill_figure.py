"""Step 5. The skill figure used on the deck (slide 2) and the website.

Input:  skill_results.json (from skill.py).
Output: figures/skill_only.png.
"""
import json
import os

import matplotlib
import numpy as np

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

from common import FIGS, HERE  # noqa: E402

NAVY, GRY = "#1f4e79", "#8a94a3"
res = json.load(open(os.path.join(HERE, "skill_results.json")))
# per day and lead: (pairs, persistence CSI, motion CSI) at >=20 dBZ with 3 km tolerance
sk = {day: {lead: (s[f"{lead}min_20dBZ_tol3km"]["pairs"], s[f"{lead}min_20dBZ_tol3km"]["persistence_csi"],
                   s[f"{lead}min_20dBZ_tol3km"]["motion_csi"]) for lead in ("15", "30")}
      for day, s in ((d, v["scores"]) for d, v in sorted(res["days"].items()))}
npairs = [sk[d]["15"][0] for d in sk]


def pool(l, i):
    n = [sk[d][l][0] for d in sk]
    v = [sk[d][l][i] for d in sk]
    return np.average(v, weights=n), v


plt.rcParams.update({"axes.spines.top": False, "axes.spines.right": False, "font.size": 7})
fig = plt.figure(figsize=(4.22, 2.55), dpi=400)
ax = fig.add_axes([.14, .36, .84, .50])
w = .36
xi = np.arange(2)
for j, (i, col, lab) in enumerate([(1, GRY, "Persistence (no motion)"), (2, NAVY, "Motion extrapolation (optical flow)")]):
    vals = [pool(l, i)[0] for l in ("15", "30")]
    ax.bar(xi + (j - .5) * w, vals, w, color=col, label=lab)
    for k, l in enumerate(("15", "30")):
        ax.text(xi[k] + (j - .5) * w, .03, f"{vals[k]:.2f}", ha="center", color="white", fontsize=7.5, fontweight="bold")
        ax.plot([xi[k] + (j - .5) * w] * 2, pool(l, i)[1], "o", ms=3, mfc="white" if j else "black", mec="black", mew=.5)
ax.set_xticks(xi)
ax.set_xticklabels(["+15 min lead", "+30 min lead"], fontsize=7.5)
ax.set_ylim(0, .95)
ax.set_ylabel("CSI (higher is better)", fontsize=7.5)
ax.tick_params(labelsize=7)
ax.legend(fontsize=7, frameon=False, loc="upper right", ncol=1, bbox_to_anchor=(1.02, 1.06))
fig.text(.02, .955, "Skill vs lead time: motion does not beat persistence", fontsize=8, fontweight="bold", va="top")
fig.text(.02, .20, "CSI = hits / (hits + misses + false alarms). Echo ≥20 dBZ, 3 km tolerance.\n"
         f"TERLS radar, 10 and 11 May 2026; {sum(npairs)} forecast pairs pooled ({' + '.join(map(str, npairs))}).\n"
         "Bars: pair-weighted mean. Dots: single days (10 May, 11 May).\n"
         "Source: team analysis. Preliminary baseline, two days only.",
         fontsize=6.3, va="top", color="#333", linespacing=1.25)
os.makedirs(FIGS, exist_ok=True)
fig.savefig(os.path.join(FIGS, "skill_only.png"))
print("wrote figures/skill_only.png", {l: [round(pool(l, i)[0], 2) for i in (1, 2)] for l in ("15", "30")})
