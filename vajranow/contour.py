"""Marching squares: turn warning grids into clean polygons for the map.

contour_rings(field, level) traces the boundary of field >= level and returns
closed rings in grid (row, col) coordinates. polygons() groups rings into
outer rings with their holes. Everything is numpy plus a small Python loop
over boundary cells only, so it stays fast.
"""

from __future__ import annotations

import numpy as np

# Edge pairs per case. Corner bits: top-left 8, top-right 4, bottom-right 2, bottom-left 1.
# Edges: T (top), R (right), B (bottom), L (left). Saddles (5, 10) are resolved by the centre value.
_CASES: dict[int, list[tuple[str, str]]] = {
    1: [("L", "B")],
    2: [("B", "R")],
    3: [("L", "R")],
    4: [("T", "R")],
    6: [("T", "B")],
    7: [("T", "L")],
    8: [("T", "L")],
    9: [("T", "B")],
    11: [("T", "R")],
    12: [("L", "R")],
    13: [("B", "R")],
    14: [("L", "B")],
}


def contour_rings(field: np.ndarray, level: float) -> list[np.ndarray]:
    """Closed rings (each an (n, 2) array of row, col) around field >= level."""
    f = np.pad(np.asarray(field, dtype=float), 1, constant_values=-1e9)
    inside = f >= level
    tl = inside[:-1, :-1]
    tr = inside[:-1, 1:]
    br = inside[1:, 1:]
    bl = inside[1:, :-1]
    case = tl * 8 + tr * 4 + br * 2 + bl * 1
    mixed = np.nonzero((case != 0) & (case != 15))

    def edge_point(key):
        kind, i, j = key
        if kind == "h":  # between (i, j) and (i, j + 1)
            a, b = f[i, j], f[i, j + 1]
            t = (level - a) / (b - a) if b != a else 0.5
            return (i - 1.0, j + t - 1.0)
        a, b = f[i, j], f[i + 1, j]  # "v": between (i, j) and (i + 1, j)
        t = (level - a) / (b - a) if b != a else 0.5
        return (i + t - 1.0, j - 1.0)

    neighbours: dict[tuple, list[tuple]] = {}
    for i, j in zip(*mixed):
        c = int(case[i, j])
        edges = {"T": ("h", i, j), "B": ("h", i + 1, j), "L": ("v", i, j), "R": ("v", i, j + 1)}
        if c in (5, 10):
            centre = 0.25 * (f[i, j] + f[i, j + 1] + f[i + 1, j] + f[i + 1, j + 1]) >= level
            if c == 5:
                pairs = [("T", "L"), ("B", "R")] if centre else [("T", "R"), ("L", "B")]
            else:
                pairs = [("T", "R"), ("L", "B")] if centre else [("T", "L"), ("B", "R")]
        else:
            pairs = _CASES[c]
        for a, b in pairs:
            ka, kb = edges[a], edges[b]
            neighbours.setdefault(ka, []).append(kb)
            neighbours.setdefault(kb, []).append(ka)

    rings = []
    seen: set[tuple] = set()
    for start in neighbours:
        if start in seen:
            continue
        ring = [start]
        seen.add(start)
        prev, cur = None, start
        while True:
            nxt = [k for k in neighbours[cur] if k != prev and k not in seen]
            if not nxt:
                break
            prev, cur = cur, nxt[0]
            seen.add(cur)
            ring.append(cur)
        if len(ring) >= 3:
            pts = np.array([edge_point(k) for k in ring])
            rings.append(np.vstack([pts, pts[:1]]))
    return rings


def _area(ring: np.ndarray) -> float:
    y, x = ring[:, 0], ring[:, 1]
    return 0.5 * float(np.sum(x[:-1] * y[1:] - x[1:] * y[:-1]))


def _contains(ring: np.ndarray, pt: np.ndarray) -> bool:
    y, x = ring[:, 0], ring[:, 1]
    py, px = pt
    hit = False
    for k in range(len(ring) - 1):
        y1, x1, y2, x2 = y[k], x[k], y[k + 1], x[k + 1]
        if (y1 > py) != (y2 > py) and px < (x2 - x1) * (py - y1) / (y2 - y1 + 1e-12) + x1:
            hit = not hit
    return hit


def polygons(field: np.ndarray, level: float, min_area_cells: float = 2.0) -> list[list[np.ndarray]]:
    """Polygons as [outer, hole, hole, ...] around field >= level."""
    rings = [r for r in contour_rings(field, level) if abs(_area(r)) >= min_area_cells]
    if not rings:
        return []
    depth = []
    for i, r in enumerate(rings):
        probe = r[0]
        depth.append(sum(_contains(o, probe) for j, o in enumerate(rings) if j != i))
    outers = [i for i, d in enumerate(depth) if d % 2 == 0]
    result = {i: [rings[i]] for i in outers}
    for i, d in enumerate(depth):
        if d % 2 == 1:
            # Attach the hole to the smallest outer ring that contains it.
            parents = [o for o in outers if _contains(rings[o], rings[i][0])]
            if parents:
                p = min(parents, key=lambda o: abs(_area(rings[o])))
                result[p].append(rings[i])
    return list(result.values())


def simplify(ring: np.ndarray, tol: float = 0.25) -> np.ndarray:
    """Douglas-Peucker simplification of a closed ring (tolerance in grid cells)."""
    if len(ring) <= 8:
        return ring
    keep = np.zeros(len(ring), dtype=bool)
    keep[0] = keep[-1] = True
    # Split the closed ring at its farthest point so both halves are open lines.
    far = int(np.argmax(np.hypot(*(ring - ring[0]).T)))
    keep[far] = True
    stack = [(0, far), (far, len(ring) - 1)]
    while stack:
        a, b = stack.pop()
        if b - a < 2:
            continue
        seg = ring[a + 1 : b]
        p, q = ring[a], ring[b]
        d = q - p
        n = np.hypot(*d)
        dist = np.abs(d[0] * (seg[:, 1] - p[1]) - d[1] * (seg[:, 0] - p[0])) / n if n > 0 else np.hypot(*(seg - p).T)
        k = int(np.argmax(dist))
        if dist[k] > tol:
            m = a + 1 + k
            keep[m] = True
            stack += [(a, m), (m, b)]
    out = ring[keep]
    return out if len(out) >= 4 else ring


def level_features(levels: np.ndarray, to_lonlat, smooth: bool = True) -> dict:
    """GeoJSON polygons for warning levels 1..3 (yellow, orange, red), lowest first."""
    from .filters import box_mean

    field = box_mean(levels.astype(float), 3) if smooth else levels.astype(float)
    feats = []
    for lv, name in ((1, "yellow"), (2, "orange"), (3, "red")):
        if (levels >= lv).sum() == 0:
            continue
        for poly in polygons(field, lv - 0.5):
            coords = []
            for ring in poly:
                ring = simplify(ring)
                lon, lat = to_lonlat(ring[:, 0], ring[:, 1])
                coords.append([[round(float(a), 4), round(float(b), 4)] for a, b in zip(lon, lat)])
            feats.append({"type": "Feature", "properties": {"level": lv, "name": name}, "geometry": {"type": "Polygon", "coordinates": coords}})
    return {"type": "FeatureCollection", "features": feats}
