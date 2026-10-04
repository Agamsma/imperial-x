"""Shared helpers for the real-radar baseline: finding input files, reading times, paths."""
import argparse
import csv
import glob
import hashlib
import os
import re
from datetime import datetime

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")  # put MOSDAC files here (git ignored)
WORK = os.path.join(HERE, "work")  # big intermediate arrays (git ignored)
FIGS = os.path.join(HERE, "figures")
MANIFEST = os.path.join(HERE, "input_manifest.csv")
MANIFEST_COLS = ["file", "kind", "date", "time_utc", "time_source", "bytes", "sha256", "status"]


def data_dirs():
    """Folders to search for MOSDAC files. Default: ./data. Override with --data DIR [DIR ...]."""
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--data", nargs="+", default=[DATA], help="folders holding RCTLS_*.nc and 3RIMG_*.h5 files")
    return [os.path.abspath(d) for d in p.parse_args().data]


def find(dirs, pattern):
    """All files matching pattern under dirs (recursive), one per file name, sorted by date then time."""
    seen = {}
    for d in dirs:
        for f in glob.glob(os.path.join(d, "**", pattern), recursive=True):
            seen.setdefault(os.path.basename(f), f)
    return sorted(seen.values(), key=lambda f: stamp(f))


def stamp(f):
    """Date and time in the file name, e.g. RCTLS_10MAY2026_090309 -> 2026-05-10 09:03:09."""
    b = os.path.basename(f)
    m = re.search(r"_(\d{2}[A-Z]{3}\d{4})_(\d{4,6})_", b)
    t = m.group(2).ljust(6, "0")
    return datetime.strptime(m.group(1) + t, "%d%b%Y%H%M%S")


def sha256(f):
    h = hashlib.sha256()
    with open(f, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 22), b""):
            h.update(chunk)
    return h.hexdigest()


def write_manifest(kind, rows):
    """Replace the rows of one kind (radar or satellite) in input_manifest.csv, keep the others."""
    old = []
    if os.path.exists(MANIFEST):
        with open(MANIFEST, newline="") as fh:
            old = [r for r in csv.DictReader(fh) if r["kind"] != kind]
    allrows = sorted(old + rows, key=lambda r: (r["kind"], r["date"], r["time_utc"]))
    with open(MANIFEST, "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=MANIFEST_COLS, lineterminator="\n")
        w.writeheader()
        w.writerows(allrows)
