"use client";

import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  LEVEL_COLOR,
  MAP_CENTER,
  MAX_BOUNDS,
  VIEW_BOUNDS,
  PLACES,
  OUTLOOK_STEP,
  levelAt,
  outlookArea,
  stormCells,
  stormCentre,
  stormTrack,
  uncertaintyCone,
} from "@/lib/storm";

const PRIMARY_STYLE = "https://tiles.openfreemap.org/styles/positron";
const FALLBACK_STYLE = "https://demotiles.maplibre.org/style.json";
const ACCENT = "#1F4E79";

// Worker files are copied here by scripts/copy-maplibre-worker.mjs.
maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

function addStormLayers(map: maplibregl.Map, step: number) {
  if (map.getSource("cone")) return;

  map.addSource("outlook", { type: "geojson", data: outlookArea(step) });
  map.addSource("cone", { type: "geojson", data: uncertaintyCone() });
  map.addSource("track", { type: "geojson", data: stormTrack() });
  map.addSource("cells", { type: "geojson", data: stormCells(step) });
  map.addSource("centre", { type: "geojson", data: stormCentre(step) });

  map.addLayer({
    id: "outlook-fill",
    type: "fill",
    source: "outlook",
    paint: { "fill-color": LEVEL_COLOR.yellow, "fill-opacity": 0.35 },
  });
  map.addLayer({
    id: "outlook-line",
    type: "line",
    source: "outlook",
    paint: { "line-color": "#c9a227", "line-width": 1.5 },
  });
  map.addLayer({
    id: "cone-fill",
    type: "fill",
    source: "cone",
    paint: { "fill-color": ACCENT, "fill-opacity": 0.05 },
  });
  map.addLayer({
    id: "cone-line",
    type: "line",
    source: "cone",
    paint: { "line-color": ACCENT, "line-width": 1.5, "line-dasharray": [3, 3], "line-opacity": 0.7 },
  });
  map.addLayer({
    id: "cells-fill",
    type: "fill",
    source: "cells",
    paint: {
      "fill-color": ["get", "color"],
      "fill-opacity": ["match", ["get", "level"], "red", 0.7, "orange", 0.6, 0.45],
    },
  });
  map.addLayer({
    id: "cells-line",
    type: "line",
    source: "cells",
    paint: { "line-color": ["get", "color"], "line-width": 1 },
  });
  map.addLayer({
    id: "track-line",
    type: "line",
    source: "track",
    paint: { "line-color": ACCENT, "line-width": 2.5 },
  });
  map.addLayer({
    id: "centre-dot",
    type: "circle",
    source: "centre",
    paint: { "circle-radius": 5, "circle-color": ACCENT, "circle-stroke-color": "#ffffff", "circle-stroke-width": 2 },
  });
}

function setData(map: maplibregl.Map, id: string, data: GeoJSON.FeatureCollection) {
  const src = map.getSource(id) as maplibregl.GeoJSONSource | undefined;
  src?.setData(data);
}

export default function DemoMap({ step }: { step: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerEls = useRef<Record<string, HTMLDivElement>>({});
  const stepRef = useRef(step);
  const [basemapNote, setBasemapNote] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: PRIMARY_STYLE,
      center: MAP_CENTER,
      zoom: 7.25,
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
    // If the main basemap does not load in time, switch to the MapLibre demo tiles.
    const timer = window.setTimeout(() => {
      if (!map.isStyleLoaded()) switchToFallback();
    }, 8000);
    map.on("error", () => {
      if (!map.isStyleLoaded()) switchToFallback();
    });

    // Fit once the container has its final size so every place is in view.
    map.once("load", () => map.fitBounds(VIEW_BOUNDS, { padding: 30, animate: false }));

    map.on("style.load", () => {
      window.clearTimeout(timer);
      addStormLayers(map, stepRef.current);
    });

    for (const place of PLACES) {
      const el = document.createElement("div");
      el.className = "vn-marker";
      el.innerHTML = `<span class="vn-dot"></span><span class="vn-label">${place.name}</span>`;
      markerEls.current[place.id] = el;
      new maplibregl.Marker({ element: el, anchor: "left", offset: [-7, 0] }).setLngLat(place.lngLat).addTo(map);
    }

    return () => {
      window.clearTimeout(timer);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    stepRef.current = step;
    const map = mapRef.current;
    if (map && map.getSource("cells")) {
      setData(map, "cells", stormCells(step));
      setData(map, "centre", stormCentre(step));
      setData(map, "outlook", outlookArea(step));
      const showNowcast = step < OUTLOOK_STEP ? "visible" : "none";
      for (const id of ["cone-fill", "cone-line", "track-line"]) {
        if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", showNowcast);
      }
    }
    for (const place of PLACES) {
      const el = markerEls.current[place.id];
      if (el) el.style.setProperty("--vn-color", LEVEL_COLOR[levelAt(place.lngLat, step)]);
    }
  }, [step]);

  return (
    <div className="relative h-full w-full">
      {/* MapLibre CSS forces position: relative on the map element, so size it inside an absolute wrapper. */}
      <div className="absolute inset-0">
        <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      </div>
      {basemapNote && (
        <span className="absolute bottom-2 left-2 rounded bg-white/90 px-2 py-1 text-xs text-muted shadow">{basemapNote}</span>
      )}
    </div>
  );
}
