"""Step 4. Two-panel summary: storm life cycle on 10 May (radar and satellite) and skill vs lead time.

Input:  work/composites.npz, sat_cold_cloud.json, skill_results.json.
Output: figures/terls-may10-11.png.

Left: radar area at or above 30 dBZ (km2, one grid pixel is about 1 km2) and INSAT-3DR
cold cloud fraction (<235 K), both inside the same 1 deg x 1 deg box.
Right: pair-weighted CSI at >=20 dBZ with 3 km tolerance; dots are single days.
"""
import json
import os
from datetime import datetime

import matplotlib
import numpy as np

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

from common import FIGS, HERE, WORK  # noqa: E402

NAVY, ORG, GRY = "#1f4e79", "#e8590c", "#8a94a3"
DAY = "2026-05-10"

g = np.load(os.path.join(WORK, "composites.npz"))
sat = json.load(open(os.path.join(HERE, "sat_cold_cloud.json")))
res = json.load(open(os.path.join(HERE, "skill_results.json")))
box = sat["box"]
LA, LO = np.meshgrid(g["lat"], g["lon"], indexing="ij")
inbox = (np.abs(LA - box["lat"]) < box["half"]) & (np.abs(LO - box["lon"]) < box["half"])

x, a30 = [], []
for c, t in zip(g["comp"], g["times"]):
    t = datetime.fromisoformat(str(t))
    if t.strftime("%Y-%m-%d") != DAY:
        continue
    r = np.nan_to_num(c.T, nan=0.0)
    x.append(t.hour + t.minute / 60 + t.second / 3600)
    a30.append(int(((r >= 30) & inbox).sum()))
s = [im for im in sat["images"] if im["date"] == DAY]
sx = [int(im["time_utc"][:2]) + int(im["time_utc"][3:]) / 60 for im in s]
sy = [100 * im["cold_frac_box"] for im in s]

plt.rcParams.update({"font.size": 7, "axes.spines.top": False, "axes.spines.right": False})
fig, ax = plt.subplots(1, 2, figsize=(5.8, 2.35), dpi=300, gridspec_kw={"width_ratios": [1.5, 1]})
ax[0].fill_between(x, a30, color=NAVY, alpha=.2)
ax[0].plot(x, a30, "-", color=NAVY, lw=1.3)
ax[0].set_ylabel("Radar area ≥30 dBZ in box (km²)", color=NAVY, fontsize=6.5)
ax[0].set_xlabel("UTC hour, 10 May 2026")
ax[0].set_xlim(9, 16.3)
a2 = ax[0].twinx()
a2.spines["right"].set_visible(True)
a2.plot(sx, sy, "s--", color=ORG, ms=2.5, lw=1)
a2.set_ylabel("INSAT-3DR cold cloud <235 K in box (%)", color=ORG, fontsize=6.5)
ax[0].set_title("Storm life cycle (same 1°×1° box for both)", fontsize=7.5, fontweight="bold")

days = sorted(res["days"])
n = {lead: res["pooled"][f"{lead}min_20dBZ_tol3km"]["pairs"] for lead in (15, 30)}
w = .38
xi = np.arange(2)
for j, (col, lab, k) in enumerate([(GRY, "Persistence (no motion)", "persistence_csi"),
                                   (NAVY, "Motion extrapolation", "motion_csi")]):
    vals = [res["pooled"][f"{lead}min_20dBZ_tol3km"][k] for lead in (15, 30)]
    ax[1].bar(xi + (j - .5) * w, vals, w, color=col, label=lab)
    for i, lead in enumerate((15, 30)):
        ax[1].text(xi[i] + (j - .5) * w, .03, f"{vals[i]:.2f}", ha="center", color="white", fontsize=6.5, fontweight="bold")
        dots = [res["days"][d]["scores"][f"{lead}min_20dBZ_tol3km"][k] for d in days]
        ax[1].plot([xi[i] + (j - .5) * w] * len(dots), dots, "o", ms=2.2, mfc="white" if j else "black", mec="black", mew=.4)
ax[1].set_xticks(xi)
ax[1].set_xticklabels(["+15 min", "+30 min"])
ax[1].set_ylim(0, .9)
ax[1].set_ylabel("CSI (echo ≥20 dBZ, 3 km tolerance)", fontsize=6.5)
ax[1].legend(fontsize=5.8, frameon=False, loc="upper right", bbox_to_anchor=(1, .9))
ax[1].text(.02, .97, "dots: 10 May / 11 May", transform=ax[1].transAxes, fontsize=5.5, color="#444", va="top")
ax[1].set_title(f"Skill vs lead time ({n[15]} pairs)", fontsize=7.5, fontweight="bold")
fig.text(.01, .005, "Preliminary baseline experiment · Source: team analysis of MOSDAC (ISRO/SAC) TERLS radar and INSAT-3DR data",
         fontsize=5.5, color="#444")
fig.tight_layout(pad=0.4, rect=(0, .04, 1, 1), w_pad=1.5)
os.makedirs(FIGS, exist_ok=True)
fig.savefig(os.path.join(FIGS, "terls-may10-11.png"), facecolor="white")
print("wrote figures/terls-may10-11.png; peak area in box", max(a30), "km2")
