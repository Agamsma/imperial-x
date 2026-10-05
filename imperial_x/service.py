"""HTTP API for the Imperial-X engine (FastAPI).

All routes live under /api/py. On Vercel the Next.js app rewrites
/api/py/<path> to the Python function at /api/index and passes the original
path in the `__path` query parameter; the middleware below restores it, so the
same app works locally (uvicorn) and on Vercel.
"""

from __future__ import annotations

import platform
from urllib.parse import parse_qsl, urlencode

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from . import DISCLAIMER, __version__
from .grid import GRID
from .hazards import method_summary
from .places import PLACES
from .scenarios import DEFAULT_SCENARIO, SCENARIOS

PREFIX = "/api/py"
# Browsers always revalidate; the CDN keeps a copy per deployment (cleared on each deploy).
CACHE = "public, max-age=0, must-revalidate, s-maxage=86400, stale-while-revalidate=604800"


class RestorePathMiddleware:
    """Put back the original /api/py/... path after a Vercel rewrite."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http" and not scope.get("path", "").startswith(PREFIX):
            pairs = parse_qsl(scope.get("query_string", b"").decode("latin-1"), keep_blank_values=True)
            route = next((v for k, v in pairs if k == "__path"), None)
            if route is not None:
                rest = [(k, v) for k, v in pairs if k != "__path"]
                path = f"{PREFIX}/{route.lstrip('/')}" if route else PREFIX
                scope = dict(scope)
                scope["path"] = path
                scope["raw_path"] = path.encode("utf-8")
                scope["query_string"] = urlencode(rest).encode("latin-1")
        await self.app(scope, receive, send)


class Health(BaseModel):
    status: str = Field(examples=["ok"])
    engine: str
    version: str
    python: str
    data: str
    fusion_model: str
    disclaimer: str


class ScenarioInfo(BaseModel):
    id: str
    title: str
    summary: str
    story: list[str]


class PlaceInfo(BaseModel):
    id: str
    name: str
    lon: float
    lat: float
    elev_m: float
    kind: str


def _cached(payload, max_age: str = CACHE) -> JSONResponse:
    return JSONResponse(payload, headers={"Cache-Control": max_age})


def create_app() -> FastAPI:
    app = FastAPI(
        title="Imperial-X engine API",
        version=__version__,
        description=(
            "Nowcasting engine for thunderstorms, hail and cloudbursts (0 to 6 hours). "
            "Every response is computed from synthetic storms. " + DISCLAIMER
        ),
        docs_url=f"{PREFIX}/docs",
        redoc_url=None,
        openapi_url=f"{PREFIX}/openapi.json",
    )
    app.add_middleware(GZipMiddleware, minimum_size=1000)
    app.add_middleware(RestorePathMiddleware)

    @app.get(f"{PREFIX}/health", response_model=Health, tags=["status"])
    def health():
        from .fusion import WEIGHTS_PATH

        return Health(
            status="ok",
            engine="Imperial-X engine",
            version=__version__,
            python=platform.python_version(),
            data="synthetic",
            fusion_model="loaded" if WEIGHTS_PATH.exists() else "missing",
            disclaimer=DISCLAIMER,
        )

    @app.get(f"{PREFIX}/v1/scenarios", response_model=list[ScenarioInfo], tags=["nowcast"])
    def scenarios():
        return _cached([ScenarioInfo(id=s.id, title=s.title, summary=s.summary, story=s.story).model_dump() for s in SCENARIOS.values()])

    @app.get(f"{PREFIX}/v1/places", response_model=list[PlaceInfo], tags=["nowcast"])
    def places():
        return _cached([PlaceInfo(id=p.id, name=p.name, lon=p.lon, lat=p.lat, elev_m=p.elev_m, kind=p.kind).model_dump() for p in PLACES])

    @app.get(f"{PREFIX}/v1/nowcast/{{scenario_id}}", tags=["nowcast"])
    def nowcast(scenario_id: str):
        """Full nowcast for a scenario: frames, hazard maps, storm cells, arrival windows and alerts."""
        from .pipeline import run_nowcast

        if scenario_id not in SCENARIOS:
            raise HTTPException(404, f"Unknown scenario '{scenario_id}'. Try one of: {', '.join(SCENARIOS)}.")
        return _cached(run_nowcast(scenario_id).bundle)

    @app.get(f"{PREFIX}/v1/nowcast/{{scenario_id}}/point", tags=["nowcast"])
    def point(
        scenario_id: str,
        lon: float = Query(..., ge=-180, le=180, description="Longitude in degrees"),
        lat: float = Query(..., ge=-90, le=90, description="Latitude in degrees"),
    ):
        """Forecast for any point on the map: level by lead time, probabilities and arrival window."""
        from .pipeline import run_nowcast

        if scenario_id not in SCENARIOS:
            raise HTTPException(404, f"Unknown scenario '{scenario_id}'.")
        w, s, e, n = GRID.bounds
        if not (w <= lon <= e and s <= lat <= n):
            raise HTTPException(422, "Point is outside the forecast area.")
        return _cached(run_nowcast(scenario_id).point(lon, lat))

    @app.get(f"{PREFIX}/v1/method", tags=["method"])
    def method():
        """Thresholds and rules the engine uses, for transparency."""
        return _cached({"version": __version__, "data": "synthetic", **method_summary()})

    @app.get(PREFIX, include_in_schema=False)
    def root():
        return {"engine": "Imperial-X engine", "version": __version__, "docs": f"{PREFIX}/docs", "default_scenario": DEFAULT_SCENARIO}

    return app
