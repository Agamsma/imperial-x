"""Tiny PNG writer (palette images) and the colour scales, no imaging library needed."""

from __future__ import annotations

import base64
import struct
import zlib

import numpy as np

# Radar echoes use a cool scale so that yellow, orange and red always mean IMD warning levels.
RADAR_EDGES = [10, 20, 30, 35, 40, 45, 50, 55, 60]
RADAR_COLOURS = [
    (0, 0, 0, 0),  # 0: no echo
    (148, 163, 184, 38),  # 1: outside radar coverage
    (196, 224, 255, 120),  # 2: 10-20 dBZ
    (132, 186, 247, 155),  # 3: 20-30
    (74, 140, 232, 180),  # 4: 30-35
    (45, 98, 207, 195),  # 5: 35-40
    (58, 62, 178, 210),  # 6: 40-45
    (104, 46, 172, 220),  # 7: 45-50
    (152, 40, 162, 230),  # 8: 50-55
    (206, 64, 192, 238),  # 9: 55-60
    (255, 236, 255, 245),  # 10: 60+
]
RADAR_LEGEND = [
    {"label": "10", "color": "#c4e0ff"},
    {"label": "20", "color": "#84baf7"},
    {"label": "30", "color": "#4a8ce8"},
    {"label": "35", "color": "#2d62cf"},
    {"label": "40", "color": "#3a3eb2"},
    {"label": "45", "color": "#682eac"},
    {"label": "50", "color": "#9828a2"},
    {"label": "55", "color": "#ce40c0"},
    {"label": "60+", "color": "#ffecff"},
]

HAZARD_COLOURS = [
    (0, 0, 0, 0),
    (242, 201, 76, 125),  # yellow
    (242, 153, 74, 150),  # orange
    (214, 69, 69, 165),  # red
]


def _chunk(kind: bytes, data: bytes) -> bytes:
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)


def png_indexed(indices: np.ndarray, palette: list[tuple[int, int, int, int]]) -> bytes:
    """Encode an (h, w) uint8 index array as a palette PNG with transparency."""
    idx = np.ascontiguousarray(indices, dtype=np.uint8)
    h, w = idx.shape
    raw = b"".join(b"\x00" + idx[r].tobytes() for r in range(h))
    plte = b"".join(bytes(c[:3]) for c in palette)
    trns = bytes(c[3] for c in palette)
    return (
        b"\x89PNG\r\n\x1a\n"
        + _chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 3, 0, 0, 0))
        + _chunk(b"PLTE", plte)
        + _chunk(b"tRNS", trns)
        + _chunk(b"IDAT", zlib.compress(raw, 9))
        + _chunk(b"IEND", b"")
    )


def data_url(png: bytes) -> str:
    return "data:image/png;base64," + base64.b64encode(png).decode("ascii")


def radar_png(dbz: np.ndarray, coverage: np.ndarray | None = None) -> bytes:
    z = np.nan_to_num(dbz, nan=0.0)
    idx = np.digitize(z, RADAR_EDGES).astype(np.uint8)  # 0 below 10 dBZ, 1..9 above
    idx = np.where(idx > 0, idx + 1, 0).astype(np.uint8)
    if coverage is not None:
        idx = np.where(~coverage, 1, idx).astype(np.uint8)
    return png_indexed(idx, RADAR_COLOURS)


def hazard_png(levels: np.ndarray) -> bytes:
    return png_indexed(np.clip(levels, 0, 3).astype(np.uint8), HAZARD_COLOURS)
