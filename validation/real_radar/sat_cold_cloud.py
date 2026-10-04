"""Step 3. Cold cloud tops from INSAT-3DR infrared, over the radar area.

Input:  3RIMG_*_L1B_STD_V01R00.h5 (MOSDAC, INSAT-3DR Imager L1B), searched under --data,
        and work/composites.npz for the radar grid bounds.
Output: sat_cold_cloud.json and the satellite rows of input_manifest.csv.

TIR1 (10.8 um) counts are converted to brightness temperature with the lookup table
in the file. For each image we report the fraction of pixels colder than 235 K over the
whole radar grid, and inside a 1 deg x 1 deg box centred on 8.6 N, 76.6 E (where the
10 May storms were), plus the median brightness temperature in that box.
No parallax correction is applied.
"""
import json
import os

import h5py
import numpy as np

from common import HERE, WORK, data_dirs, find, sha256, stamp, write_manifest

BOX = dict(lat=8.6, lon=76.6, half=0.5)  # degrees
COLD_K = 235


def main():
    files = find(data_dirs(), "3RIMG_*.h5")
    if not files:
        raise SystemExit("No 3RIMG_*.h5 files found. Put them in validation/real_radar/data/ or pass --data DIR.")
    g = np.load(os.path.join(WORK, "composites.npz"))
    lat, lon = g["lat"], g["lon"]
    out, rows = [], []
    for f in files:
        name = os.path.basename(f)
        with h5py.File(f, "r") as h:
            t = stamp(f)  # file name time = Acquisition_Time_in_GMT (start of the 30 min slot)
            gmt = h.attrs["Acquisition_Time_in_GMT"].decode()
            if gmt != t.strftime("%H%M"):
                raise SystemExit(f"{name}: Acquisition_Time_in_GMT {gmt} does not match file name")
            la = h["Latitude"][:].astype("float32")
            lo = h["Longitude"][:].astype("float32")
            if np.abs(la).max() > 1000:  # stored as int16 x 100
                la /= 100
                lo /= 100
            m = (la >= lat.min()) & (la <= lat.max()) & (lo >= lon.min()) & (lo <= lon.max())
            r, c = np.where(m)
            win = np.s_[r.min():r.max() + 1, c.min():c.max() + 1]
            cnt = h["IMG_TIR1"][0][win]
            bt = h["IMG_TIR1_TEMP"][:][np.clip(cnt, 0, 1023)]
            bt = np.where(m[win], bt, np.nan)
            near = (np.abs(la[win] - BOX["lat"]) < BOX["half"]) & (np.abs(lo[win] - BOX["lon"]) < BOX["half"])
            rec = dict(date=t.strftime("%Y-%m-%d"), time_utc=t.strftime("%H:%M"),
                       acquisition_start=h.attrs["Acquisition_Start_Time"].decode(),
                       acquisition_end=h.attrs["Acquisition_End_Time"].decode(),
                       satellite=h.attrs["Satellite_Name"].decode(),
                       cold_frac_radar_grid=round(float(np.nanmean(bt < COLD_K)), 4),
                       cold_frac_box=round(float(np.nanmean(bt[near] < COLD_K)), 4),
                       median_bt_box_k=round(float(np.nanmedian(bt[near])), 1))
        out.append(rec)
        rows.append(dict(file=name, kind="satellite", date=rec["date"], time_utc=t.strftime("%H:%M:00"),
                         time_source=f"Acquisition_Time_in_GMT; scan {rec['acquisition_start']} to {rec['acquisition_end']}",
                         bytes=os.path.getsize(f), sha256=sha256(f), status="used"))
        print(name, "cold <235 K: radar grid %.2f, box %.2f, box median %.0f K"
              % (rec["cold_frac_radar_grid"], rec["cold_frac_box"], rec["median_bt_box_k"]), flush=True)
    res = dict(description="INSAT-3DR TIR1 cold cloud (<235 K) over the TERLS radar area. Team analysis.",
               box=BOX, cold_threshold_k=COLD_K, parallax_corrected=False, images=out)
    with open(os.path.join(HERE, "sat_cold_cloud.json"), "w") as fh:
        json.dump(res, fh, indent=1)
    write_manifest("satellite", rows)
    print(len(out), "satellite images")


if __name__ == "__main__":
    main()
