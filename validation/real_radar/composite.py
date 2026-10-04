"""Step 1. Turn each TERLS radar volume into one cleaned column-maximum reflectivity map.

Input:  RCTLS_*_L2C_STD.nc (MOSDAC, 3D gridded TERLS DWR product), searched under --data.
Output: work/composites.npz and the radar rows of input_manifest.csv.

Cleaning, per height level: drop values above 65 dBZ, then drop isolated pixels
(a valid pixel needs at least 2 valid neighbours among its 8). Then take the
maximum over height. Files that cannot be read (for example a truncated
download) are skipped and listed as skipped in the manifest.
"""
import os

import netCDF4
import numpy as np
from scipy.ndimage import convolve

from common import WORK, data_dirs, find, sha256, stamp, write_manifest


def main():
    files = find(data_dirs(), "RCTLS_*.nc")
    if not files:
        raise SystemExit("No RCTLS_*.nc files found. Put them in validation/real_radar/data/ or pass --data DIR.")
    os.makedirs(WORK, exist_ok=True)
    ker = np.ones((1, 3, 3))
    ker[0, 1, 1] = 0
    comps, names, times, rows = [], [], [], []
    lat = lon = height = None
    for f in files:
        name = os.path.basename(f)
        row = dict(file=name, kind="radar", bytes=os.path.getsize(f), sha256=sha256(f))
        try:
            d = netCDF4.Dataset(f)
            z = np.ma.filled(np.ma.masked_invalid(d["DBZ"][0]), np.nan)  # (height, lon, lat)
            tv = d["time"]
            t = netCDF4.num2date(tv[0], tv.units, only_use_cftime_datetimes=False)
            if lat is None:
                lat, lon, height = d["latitude"][:], d["longitude"][:], d["height"][:]
        except Exception as e:
            t = stamp(f)
            row.update(date=t.strftime("%Y-%m-%d"), time_utc=t.strftime("%H:%M:%S"),
                       time_source="file name (file unreadable)", status=f"skipped: unreadable ({type(e).__name__})")
            rows.append(row)
            print("skip", name, type(e).__name__, flush=True)
            continue
        if t.replace(microsecond=0) != stamp(f):
            raise SystemExit(f"{name}: time variable {t} does not match file name {stamp(f)}")
        val = np.isfinite(z) & (z <= 65)
        cnt = convolve(val.astype("float32"), ker, mode="constant")
        keep = val & (cnt >= 2)
        zc = np.where(keep, z, np.nan)
        comp = np.nanmax(zc, axis=0) if keep.any() else np.full(z.shape[1:], np.nan)
        comps.append(comp.astype("float32"))
        names.append(name)
        times.append(t.strftime("%Y-%m-%dT%H:%M:%S"))
        row.update(date=t.strftime("%Y-%m-%d"), time_utc=t.strftime("%H:%M:%S"),
                   time_source=f"time variable ({tv.units}; no time zone stored, read as UTC)", status="used")
        rows.append(row)
        print(name, "removed", int(np.isfinite(z).sum() - keep.sum()), "of", int(np.isfinite(z).sum()),
              "| max %.1f dBZ" % np.nanmax(comp), flush=True)
    np.savez_compressed(os.path.join(WORK, "composites.npz"), comp=np.stack(comps), names=np.array(names),
                        times=np.array(times), lat=np.asarray(lat), lon=np.asarray(lon), height=np.asarray(height))
    write_manifest("radar", rows)
    print(f"{len(comps)} composites written, {len(rows) - len(comps)} files skipped")


if __name__ == "__main__":
    main()
