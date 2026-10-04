"use client";

import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { LEVEL_HEX, levelName, type Bundle, type PointForecast } from "@/lib/engine";

maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

const PRIMARY_STYLE = "https://tiles.openfreemap.org/styles/positron";
const FALLBACK_STYLE = "https://demotiles.maplibre.org/style.json";
const ACCENT = "#1F4E79";
const BLANK =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
// Kept well inside India so no international boundary is ever in view.
const MAX_BOUNDS: [[number, number], [number, number]] = [
  [74.0, 7.4],
  [78.6, 12.4],
];
const START_VIEW: [[number, number], [number, number]] = [
  [75.9, 8.35],
  [77.45, 10.65],
];

export type LayerState = {
  radar: boolean;
  warnings: boolean;
  tracks: boolean;
  motion: boolean;
  lightning: boolean;
  newStorms: boolean;
};

export type PointState = { lon: number; lat: number; data: PointForecast | null; loading: boolean; error: string | null } | null;

type Props = {
  bundle: Bundle;
  frameIndex: number;
  layers: LayerState;
  selectedPlace: string | null;
  onSelectPlace: (id: string) => void;
  onPointClick: (lon: number, lat: number) => void;
  point: PointState;
  focus: { lon: number; lat: number; key: number } | null;
  fitTo: { bounds: [[number, number], [number, number]]; key: string } | null;
};

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

function circle(lon: number, lat: number, km: number, n = 48): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push([lon + (km * Math.sin(a)) / (111.32 * Math.cos((lat * Math.PI) / 180)), lat + (km * Math.cos(a)) / 110.57]);
  }
  return pts;
}

function staticGeo(b: Bundle) {
  const cones: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: b.cells.map((c) => ({ type: "Feature", properties: { id: c.id }, geometry: { type: "Polygon", coordinates: [c.cone] } })),
  };
  const tracks: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: b.cells.map((c) => ({
      type: "Feature",
      properties: { id: c.id },
      geometry: { type: "LineString", coordinates: c.track.map((p) => [p.lon, p.lat]) },
    })),
  };
  const past: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: b.cells.map((c) => ({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: c.past } })),
  };
  const zones: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: b.initiation.map((z) => ({
      type: "Feature",
      properties: { chance: z.chance },
      geometry: { type: "Polygon", coordinates: [circle(z.lon, z.lat, z.radius_km)] },
    })),
  };
  const ring: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [b.radar.ring] };
  return { cones, tracks, past, zones, ring };
}

function cellPosition(c: Bundle["cells"][number], t: number): [number, number] | null {
  if (t > 120) return null;
  if (t <= 0) {
    const idx = c.past.length - 1 + Math.round(t / 10);
    const p = c.past[Math.max(0, idx)];
    return p ? [p[0], p[1]] : null;
  }
  const p = c.track[Math.min(c.track.length - 1, Math.round(t / 10))];
  return [p.lon, p.lat];
}

function esc(s: string) {
  return s.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch] as string);
}

function popupHtml(p: NonNullable<PointState>): string {
  const head = `<div class="vn-pop-title">Selected point</div><div class="vn-pop-sub">${p.lat.toFixed(3)}°N, ${p.lon.toFixed(3)}°E</div>`;
  if (p.loading) return `${head}<div class="vn-pop-body">Asking the engine...</div>`;
  if (p.error || !p.data) return `${head}<div class="vn-pop-body">Could not get a forecast here.</div>`;
  const d = p.data;
  const squares = d.levels
    .map((lv, i) => `<span title="${i === 0 ? "Now" : `+${d.leads[i]} min`}" style="background:${LEVEL_HEX[levelName(lv)]}"></span>`)
    .join("");
  const ltg = Math.round(100 * Math.max(...d.probability.lightning));
  return `${head}
    <div class="vn-pop-body"><b>${esc(d.arrival.text)}</b><br/><span>${esc(d.arrival.detail)}</span></div>
    <div class="vn-pop-strip">${squares}</div>
    <div class="vn-pop-scale"><span>Now</span><span>+60</span><span>+120 min</span></div>
    <div class="vn-pop-meta">Lightning chance (radar proxy, max): ${ltg}%<br/>Rain next hour: ${d.rain_next_hour_mm.median} mm (up to ${d.rain_next_hour_mm.p90} mm)</div>`;
}

export default function EngineMap({ bundle, frameIndex, layers, selectedPlace, onSelectPlace, onPointClick, point, focus, fitTo }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const placeEls = useRef<Record<string, HTMLDivElement>>({});
  const placeMarkers = useRef<maplibregl.Marker[]>([]);
  const cellMarkers = useRef<Record<string, maplibregl.Marker>>({});
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const pointMarker = useRef<maplibregl.Marker | null>(null);
  const state = useRef({ bundle, frameIndex, layers, onSelectPlace, onPointClick });
  const [ready, setReady] = useState(0);
  const [basemapNote, setBasemapNote] = useState<string | null>(null);

  // Keep the latest props available to map event handlers.
  useEffect(() => {
    state.current = { bundle, frameIndex, layers, onSelectPlace, onPointClick };
  });

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: PRIMARY_STYLE,
      bounds: START_VIEW,
      minZoom: 6.4,
      maxZoom: 12,
      maxBounds: MAX_BOUNDS,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-left");

    let usedFallback = false;
    const switchToFallback = () => {
      if (usedFallback) return;
      usedFallback = true;
      setBasemapNote("Using backup basemap");
      map.setStyle(FALLBACK_STYLE);
    };
    const timer = window.setTimeout(() => {
      if (!map.isStyleLoaded()) switchToFallback();
    }, 8000);
    map.on("error", () => {
      if (!map.isStyleLoaded()) switchToFallback();
    });
    map.on("style.load", () => {
      window.clearTimeout(timer);
      const b = state.current.bundle;
      const f = b.frames[state.current.frameIndex];
      const g = staticGeo(b);
      const corners = b.grid.corners as [[number, number], [number, number], [number, number], [number, number]];
      map.addSource("radar-img", { type: "image", url: f.radar ?? BLANK, coordinates: corners });
      map.addSource("warnings", { type: "geojson", data: f.warnings ?? EMPTY });
      map.addSource("ring", { type: "geojson", data: g.ring });
      map.addSource("zones", { type: "geojson", data: g.zones });
      map.addSource("cones", { type: "geojson", data: g.cones });
      map.addSource("past", { type: "geojson", data: g.past });
      map.addSource("tracks", { type: "geojson", data: g.tracks });
      map.addSource("arrows", { type: "geojson", data: b.motion.arrows });
      map.addSource("lightning", { type: "geojson", data: f.lightning ?? EMPTY });

      map.addLayer({ id: "radar", type: "raster", source: "radar-img", paint: { "raster-opacity": 0.8, "raster-fade-duration": 0, "raster-resampling": "linear" } });
      const levelColor: maplibregl.ExpressionSpecification = ["match", ["get", "level"], 3, "#D64545", 2, "#F2994A", "#F2C94C"];
      map.addLayer({ id: "warnings-fill", type: "fill", source: "warnings", paint: { "fill-color": levelColor, "fill-opacity": 0.3 } });
      map.addLayer({ id: "warnings-line", type: "line", source: "warnings", paint: { "line-color": levelColor, "line-width": 2 } });
      map.addLayer({ id: "ring", type: "line", source: "ring", paint: { "line-color": "#64748b", "line-width": 1.2, "line-dasharray": [4, 4], "line-opacity": 0.7 } });
      map.addLayer({ id: "zones-fill", type: "fill", source: "zones", paint: { "fill-color": ACCENT, "fill-opacity": 0.06 } });
      map.addLayer({ id: "zones-line", type: "line", source: "zones", paint: { "line-color": ACCENT, "line-width": 1.6, "line-dasharray": [1.5, 2] } });
      map.addLayer({ id: "cones-fill", type: "fill", source: "cones", paint: { "fill-color": ACCENT, "fill-opacity": 0.05 } });
      map.addLayer({ id: "cones-line", type: "line", source: "cones", paint: { "line-color": ACCENT, "line-width": 1.2, "line-dasharray": [3, 3], "line-opacity": 0.75 } });
      map.addLayer({ id: "past", type: "line", source: "past", paint: { "line-color": ACCENT, "line-width": 2, "line-opacity": 0.45, "line-dasharray": [1, 1.5] } });
      map.addLayer({ id: "tracks", type: "line", source: "tracks", paint: { "line-color": ACCENT, "line-width": 2.4 } });
      map.addLayer({ id: "arrows", type: "line", source: "arrows", paint: { "line-color": "#0f2a44", "line-width": 1.6, "line-opacity": 0.8 } });
      map.addLayer({
        id: "lightning",
        type: "circle",
        source: "lightning",
        paint: { "circle-radius": 3, "circle-color": "#111827", "circle-stroke-color": "#ffffff", "circle-stroke-width": 1.2, "circle-opacity": 0.9 },
      });
      setReady((r) => r + 1);
    });

    map.on("click", (e) => state.current.onPointClick(e.lngLat.lng, e.lngLat.lat));
    map.getCanvas().style.cursor = "crosshair";

    return () => {
      window.clearTimeout(timer);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Scenario changed: refresh the static layers and markers.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const g = staticGeo(bundle);
    (map.getSource("ring") as maplibregl.GeoJSONSource | undefined)?.setData(g.ring);
    (map.getSource("zones") as maplibregl.GeoJSONSource | undefined)?.setData(g.zones);
    (map.getSource("cones") as maplibregl.GeoJSONSource | undefined)?.setData(g.cones);
    (map.getSource("past") as maplibregl.GeoJSONSource | undefined)?.setData(g.past);
    (map.getSource("tracks") as maplibregl.GeoJSONSource | undefined)?.setData(g.tracks);
    (map.getSource("arrows") as maplibregl.GeoJSONSource | undefined)?.setData(bundle.motion.arrows);

    placeMarkers.current.forEach((m) => m.remove());
    placeMarkers.current = [];
    placeEls.current = {};
    for (const p of bundle.places) {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "vn-marker vn-marker-btn";
      el.setAttribute("aria-label", `${p.name}: ${p.arrival.text}`);
      el.innerHTML = `<span class="vn-dot"></span><span class="vn-label">${esc(p.name)}</span>`;
      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        state.current.onSelectPlace(p.id);
      });
      placeEls.current[p.id] = el as unknown as HTMLDivElement;
      placeMarkers.current.push(new maplibregl.Marker({ element: el, anchor: "left", offset: [-7, 0] }).setLngLat([p.lon, p.lat]).addTo(map));
    }

    Object.values(cellMarkers.current).forEach((m) => m.remove());
    cellMarkers.current = {};
    for (const c of bundle.cells) {
      const el = document.createElement("div");
      el.className = "vn-cell";
      el.textContent = c.id;
      el.title = `Cell ${c.id}: ${c.speed_kmh} km/h towards ${c.toward}`;
      cellMarkers.current[c.id] = new maplibregl.Marker({ element: el }).setLngLat([c.lon, c.lat]).addTo(map);
    }
  }, [bundle, ready]);

  // Frame changed: swap the images and lightning, move cell labels, recolour places.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const f = bundle.frames[frameIndex];
    (map.getSource("radar-img") as maplibregl.ImageSource | undefined)?.updateImage({ url: f.radar ?? BLANK });
    (map.getSource("warnings") as maplibregl.GeoJSONSource | undefined)?.setData(f.warnings ?? EMPTY);
    (map.getSource("lightning") as maplibregl.GeoJSONSource | undefined)?.setData(f.lightning ?? EMPTY);
    for (const c of bundle.cells) {
      const m = cellMarkers.current[c.id];
      const pos = cellPosition(c, f.t);
      if (!m) continue;
      if (pos && layers.tracks) {
        m.setLngLat(pos);
        m.getElement().style.display = "";
      } else {
        m.getElement().style.display = "none";
      }
    }
    for (const p of bundle.places) {
      const el = placeEls.current[p.id];
      if (!el) continue;
      const lv = p.frame_levels?.[frameIndex];
      el.style.setProperty("--vn-color", lv === null || lv === undefined ? "#94a3b8" : LEVEL_HEX[levelName(lv)]);
    }
  }, [bundle, frameIndex, ready, layers.tracks]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const vis = (on: boolean) => (on ? "visible" : "none");
    const set = (ids: string[], on: boolean) => ids.forEach((id) => map.getLayer(id) && map.setLayoutProperty(id, "visibility", vis(on)));
    set(["radar"], layers.radar);
    set(["warnings-fill", "warnings-line"], layers.warnings);
    set(["cones-fill", "cones-line", "past", "tracks"], layers.tracks);
    set(["arrows"], layers.motion);
    set(["lightning"], layers.lightning);
    set(["zones-fill", "zones-line"], layers.newStorms);
  }, [layers, ready]);

  useEffect(() => {
    for (const [id, el] of Object.entries(placeEls.current)) el.classList.toggle("vn-selected", id === selectedPlace);
  }, [selectedPlace, bundle, ready]);

  // Frame the storms of each scenario when it loads.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !fitTo) return;
    const small = map.getContainer().clientWidth < 640;
    map.fitBounds(fitTo.bounds, { padding: small ? { top: 70, bottom: 70, left: 30, right: 30 } : 70, maxZoom: 8.4, duration: 900 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitTo?.key, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focus) return;
    map.flyTo({ center: [focus.lon, focus.lat], zoom: Math.max(map.getZoom(), 8.6), duration: 900 });
  }, [focus]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!point) {
      popupRef.current?.remove();
      pointMarker.current?.remove();
      return;
    }
    if (!pointMarker.current) {
      const el = document.createElement("div");
      el.className = "vn-point";
      pointMarker.current = new maplibregl.Marker({ element: el });
    }
    pointMarker.current.setLngLat([point.lon, point.lat]).addTo(map);
    if (!popupRef.current) {
      popupRef.current = new maplibregl.Popup({ closeButton: true, maxWidth: "260px", offset: 12, className: "vn-popup" });
    }
    popupRef.current.setLngLat([point.lon, point.lat]).setHTML(popupHtml(point)).addTo(map);
  }, [point]);

  return (
    <div className="relative h-full w-full">
      <div className="absolute inset-0">
        <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      </div>
      {basemapNote && <span className="absolute bottom-2 left-2 rounded bg-white/90 px-2 py-1 text-xs text-muted shadow">{basemapNote}</span>}
    </div>
  );
}
