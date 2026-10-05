"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  LEVEL_HEX,
  LEVEL_ORDER,
  fetchPoint,
  type Bundle,
  type LevelName,
  type PlaceForecast,
  type ScenarioInfo,
} from "@/lib/engine";
import type { LayerState, PointState } from "./EngineMap";

const EngineMap = dynamic(() => import("./EngineMap"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center bg-[#eef1f4] text-sm text-muted">Loading map...</div>,
});

const SHORT: Record<string, string> = {
  "kochi-squall": "Kochi squall line",
  "ghats-afternoon": "Ghats afternoon storms",
  "tvm-cloudburst": "Thiruvananthapuram heavy rain",
};

type Tab = "arrivals" | "alerts" | "storms" | "data";

const TIER_TEXT: Record<string, string> = {
  sharp: "Sharp 2 km map",
  probability: "Probability zones",
  outlook: "Area outlook, low detail",
};

function Swatch({ level, className = "" }: { level: LevelName; className?: string }) {
  return <span className={`inline-block h-3 w-3 shrink-0 rounded-sm ${className}`} style={{ background: LEVEL_HEX[level] }} />;
}

function StatusDot({ status }: { status: string }) {
  const cls =
    status === "ok" ? "bg-accent" : status === "proxy" ? "border border-[#8a94a3] bg-white" : "border-2 border-[#8a94a3] bg-[#e2e8f0]";
  return <span className={`h-2 w-2 shrink-0 rounded-full ${cls}`} />;
}

function Pill({ children }: { children: React.ReactNode }) {
  return <span className="inline-block rounded-full bg-[#eef2f7] px-2 py-0.5 text-[11px] font-medium text-ink">{children}</span>;
}

function levelLabel(level: LevelName) {
  return { green: "Green", yellow: "Yellow", orange: "Orange", red: "Red" }[level];
}

function sortPlaces(places: PlaceForecast[]) {
  const rank = (p: PlaceForecast) => LEVEL_ORDER.indexOf(p.level);
  return [...places].sort((a, b) => rank(b) - rank(a) || (a.arrival.most_likely ?? 999) - (b.arrival.most_likely ?? 999));
}

export default function EngineDashboard({
  bundle,
  scenarios,
  onScenario,
  switching,
}: {
  bundle: Bundle;
  scenarios: ScenarioInfo[];
  onScenario: (id: string) => void;
  switching: boolean;
}) {
  const nowIndex = useMemo(() => Math.max(0, bundle.frames.findIndex((f) => f.kind === "observed" && f.t === 0)), [bundle]);
  const [frameIndex, setFrameIndex] = useState(nowIndex);
  const [playing, setPlaying] = useState(false);
  const [tab, setTab] = useState<Tab>("arrivals");
  const [layers, setLayers] = useState<LayerState>({ radar: true, warnings: true, tracks: true, motion: false, lightning: true, newStorms: true });
  const [selected, setSelected] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ lon: number; lat: number; key: number } | null>(null);
  const [point, setPoint] = useState<PointState>(null);
  const pointAbort = useRef<AbortController | null>(null);
  const [lastScenario, setLastScenario] = useState(bundle.scenario.id);

  // New scenario: jump to "now" and clear selections.
  if (lastScenario !== bundle.scenario.id) {
    setLastScenario(bundle.scenario.id);
    setFrameIndex(nowIndex);
    setPlaying(false);
    setSelected(null);
    setPoint(null);
  }

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setFrameIndex((i) => {
        if (i >= bundle.frames.length - 1) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, 850);
    return () => window.clearInterval(id);
  }, [playing, bundle.frames.length]);

  // Area to frame for this scenario: storm cells and their tracks, places with a warning, new-storm zones.
  const fitTo = useMemo(() => {
    const pts: [number, number][] = [
      ...bundle.cells.flatMap((c) => [[c.lon, c.lat] as [number, number], [c.track[c.track.length - 1].lon, c.track[c.track.length - 1].lat] as [number, number]]),
      ...bundle.places.filter((p) => p.level !== "green").map((p) => [p.lon, p.lat] as [number, number]),
      ...bundle.initiation.map((z) => [z.lon, z.lat] as [number, number]),
    ];
    if (!pts.length) return null;
    const lons = pts.map((p) => p[0]);
    const lats = pts.map((p) => p[1]);
    const pad = 0.12;
    return {
      key: bundle.scenario.id,
      bounds: [
        [Math.min(...lons) - pad, Math.min(...lats) - pad],
        [Math.max(...lons) + pad, Math.max(...lats) + pad],
      ] as [[number, number], [number, number]],
    };
  }, [bundle]);

  // Keyboard: left and right step through time, space plays or pauses.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === "ArrowRight") {
        setPlaying(false);
        setFrameIndex((i) => Math.min(bundle.frames.length - 1, i + 1));
      } else if (e.key === "ArrowLeft") {
        setPlaying(false);
        setFrameIndex((i) => Math.max(0, i - 1));
      } else if (e.key === " " && !(t && t.tagName === "BUTTON")) {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bundle.frames.length]);

  const frame = bundle.frames[frameIndex];
  const places = useMemo(() => sortPlaces(bundle.places), [bundle]);
  const scenarioId = bundle.scenario.id;

  const togglePlay = () => {
    if (!playing && frameIndex >= bundle.frames.length - 1) setFrameIndex(0);
    setPlaying((p) => !p);
  };

  const selectPlace = (id: string) => {
    const p = bundle.places.find((x) => x.id === id);
    if (!p) return;
    setSelected(id);
    setTab("arrivals");
    setFocus({ lon: p.lon, lat: p.lat, key: Date.now() });
    window.setTimeout(() => document.getElementById(`place-${id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
  };

  const askPoint = (lon: number, lat: number) => {
    pointAbort.current?.abort();
    const ctrl = new AbortController();
    pointAbort.current = ctrl;
    setPoint({ lon, lat, data: null, loading: true, error: null });
    fetchPoint(scenarioId, lon, lat, ctrl.signal)
      .then((data) => setPoint({ lon, lat, data, loading: false, error: null }))
      .catch((err: unknown) => {
        if ((err as Error).name === "AbortError") return;
        setPoint({ lon, lat, data: null, loading: false, error: "failed" });
      });
  };

  const obsCount = bundle.frames.filter((f) => f.kind === "observed").length;
  const fcCount = bundle.frames.filter((f) => f.kind === "forecast").length;
  const total = bundle.frames.length;
  const tierText =
    frame.kind === "observed" ? (frame.missing ? "Scan missing (flagged by quality checks)" : frame.t === 0 ? "Latest radar scan" : "Past radar scan") : TIER_TEXT[frame.tier ?? "sharp"];

  return (
    <div className="flex min-h-screen flex-col bg-[#f4f6f8] text-ink lg:h-screen lg:min-h-0">
      <div className="bg-[#16202b] px-4 py-2 text-center text-sm font-semibold text-white">
        Illustrative demo. Synthetic data, not a real forecast.
      </div>

      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-white px-4 py-3">
        <Link href="/" className="text-lg font-bold text-accent">
          Imperial-X
        </Link>
        <span className="rounded-md bg-accent px-2 py-1 text-xs font-bold tracking-wide text-white">REPLAY MODE (demo)</span>
        <div className="flex flex-wrap gap-2">
          {bundle.feeds.map((f) => (
            <span
              key={f.id}
              title={f.source}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-white px-2.5 py-1 text-xs"
            >
              <StatusDot status={f.status} />
              {f.label}: {f.detail}
            </span>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-4 text-sm">
          <Link href="/method" className="text-muted hover:text-accent">
            Method
          </Link>
          <Link href="/" className="text-muted hover:text-accent">
            Back to site
          </Link>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-white px-4 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted">Scenario</span>
        <div role="tablist" aria-label="Scenario" className="flex flex-wrap gap-1.5">
          {scenarios.map((s) => (
            <button
              key={s.id}
              role="tab"
              aria-selected={s.id === scenarioId}
              onClick={() => s.id !== scenarioId && onScenario(s.id)}
              className={`rounded-full px-3 py-1 text-sm transition-colors ${
                s.id === scenarioId ? "bg-accent text-white" : "bg-[#eef2f7] text-ink hover:bg-[#e2e8f0]"
              }`}
            >
              {SHORT[s.id] ?? s.title}
            </button>
          ))}
        </div>
        {switching && <span className="text-xs text-muted">Running the engine...</span>}
        <p className="w-full text-sm text-muted lg:ml-2 lg:w-auto lg:flex-1">{bundle.scenario.summary}</p>
      </div>

      <div className="flex flex-1 flex-col lg:min-h-0 lg:flex-row">
        <section className="flex flex-col lg:min-h-0 lg:flex-1">
          <div className="relative h-[58vh] min-h-[340px] lg:h-auto lg:flex-1">
            <EngineMap
              bundle={bundle}
              frameIndex={frameIndex}
              layers={layers}
              selectedPlace={selected}
              onSelectPlace={selectPlace}
              onPointClick={askPoint}
              point={point}
              focus={focus}
              fitTo={fitTo}
            />
            <div className="pointer-events-none absolute right-2 top-2 rounded-lg bg-white/95 px-3 py-2 text-right shadow">
              <p className="text-xs text-muted">{frame.kind === "observed" ? "Observed (synthetic)" : frame.kind === "outlook" ? "Outlook" : "Forecast"}</p>
              <p className="text-lg font-bold text-accent">{frame.label}</p>
              <p className="text-xs text-muted">{tierText}</p>
            </div>
            <div className="absolute bottom-8 left-2 flex max-w-[calc(100%-1rem)] gap-1 overflow-x-auto rounded-lg bg-white/95 p-1.5 shadow">
              {(
                [
                  ["radar", "Radar"],
                  ["warnings", "Warnings"],
                  ["tracks", "Tracks"],
                  ["lightning", "Lightning"],
                  ["newStorms", "New storms"],
                  ["motion", "Motion"],
                ] as [keyof LayerState, string][]
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={layers[k]}
                  onClick={() => setLayers((l) => ({ ...l, [k]: !l[k] }))}
                  className={`shrink-0 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                    layers[k] ? "bg-accent text-white" : "bg-transparent text-muted hover:bg-[#eef2f7]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="pointer-events-none absolute bottom-2 left-1/2 hidden -translate-x-1/2 rounded bg-white/85 px-2 py-0.5 text-[11px] text-muted sm:block">
              Click anywhere on the map for a point forecast. Arrow keys step through time.
            </p>
          </div>

          <div className="border-t border-line bg-white px-4 py-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={togglePlay}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-white hover:bg-accent/90"
                aria-label={playing ? "Pause" : "Play"}
              >
                {playing ? (
                  <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor">
                    <rect x="3" y="2" width="3.5" height="12" rx="1" />
                    <rect x="9.5" y="2" width="3.5" height="12" rx="1" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor">
                    <path d="M4 2.5v11l9.5-5.5z" />
                  </svg>
                )}
              </button>
              <div className="w-full">
                <input
                  type="range"
                  min={0}
                  max={total - 1}
                  step={1}
                  value={frameIndex}
                  onChange={(e) => {
                    setPlaying(false);
                    setFrameIndex(Number(e.target.value));
                  }}
                  className="w-full accent-[#1F4E79]"
                  aria-label="Time"
                  aria-valuetext={frame.label}
                />
                <div className="mt-1 flex h-1.5 overflow-hidden rounded-full" aria-hidden="true">
                  <span className="bg-[#94a3b8]" style={{ width: `${(100 * (obsCount - 0.5)) / (total - 1)}%` }} />
                  <span className="bg-accent" style={{ width: `${(100 * fcCount) / (total - 1)}%` }} />
                  <span className="flex-1 bg-accent-soft" />
                </div>
              </div>
            </div>
            <div className="mt-1 flex justify-between pl-12 text-[11px] text-muted">
              <span>-60 min</span>
              <span>Now</span>
              <span className="hidden sm:inline">+60 min</span>
              <span>+120 min</span>
              <span>3 to 6 h</span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-2 text-[11px] text-muted">
              <span className="flex items-center gap-1">
                <span className="font-medium text-ink">Radar dBZ</span>
                {bundle.legend.radar_dbz.map((r) => (
                  <span key={r.label} className="flex flex-col items-center">
                    <span className="h-2.5 w-5" style={{ background: r.color }} />
                    <span>{r.label}</span>
                  </span>
                ))}
              </span>
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-ink">IMD colours</span>
                {bundle.legend.levels.map((l) => (
                  <span key={l.level} className="flex items-center gap-1">
                    <Swatch level={l.level} />
                    {l.name}, {l.action.toLowerCase()}
                  </span>
                ))}
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 rounded-full border border-white bg-[#111827]" /> Synthetic strikes (last 10 min)
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-5 border-t-2 border-dashed border-accent" /> Track cone
              </span>
            </div>
          </div>
        </section>

        <aside className="flex flex-col border-line lg:w-[400px] lg:border-l lg:bg-white">
          <div role="tablist" aria-label="Panels" className="flex border-b border-line bg-white">
            {(
              [
                ["arrivals", "Arrivals"],
                ["alerts", `Alerts (${bundle.alerts.length})`],
                ["storms", "Storms"],
                ["data", "Data"],
              ] as [Tab, string][]
            ).map(([k, label]) => (
              <button
                key={k}
                role="tab"
                aria-selected={tab === k}
                onClick={() => setTab(k)}
                className={`flex-1 border-b-2 px-2 py-2.5 text-sm font-medium transition-colors ${
                  tab === k ? "border-accent text-accent" : "border-transparent text-muted hover:text-ink"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex-1 space-y-3 p-4 lg:overflow-y-auto">
            {tab === "arrivals" && (
              <>
                <p className="text-xs text-muted">
                  When a storm core (45 dBZ or more within about 3 km) reaches each place, as a range from {bundle.engine.members} ensemble members.
                </p>
                <ul className="divide-y divide-line rounded-xl border border-line bg-white">
                  {places.map((p) => (
                    <li key={p.id} id={`place-${p.id}`}>
                      <button
                        type="button"
                        onClick={() => selectPlace(p.id)}
                        className={`w-full px-4 py-3 text-left transition-colors hover:bg-[#f7f9fb] ${selected === p.id ? "bg-accent-soft/60" : ""}`}
                      >
                        <div className="flex items-center gap-2">
                          <Swatch level={p.level} />
                          <span className="font-medium">{p.name}</span>
                          <span className="ml-auto text-xs text-muted">{levelLabel(p.level)}</span>
                        </div>
                        <p
                          className={`mt-1 pl-5 ${
                            p.arrival.status === "expected" || p.arrival.status === "now"
                              ? "text-lg font-bold"
                              : p.arrival.status === "unreliable"
                                ? "text-sm font-medium text-muted"
                                : "text-sm font-semibold"
                          }`}
                        >
                          {p.arrival.text}
                        </p>
                        <p className="pl-5 text-xs text-muted">{p.arrival.detail}</p>
                        {(p.hazards.length > 0 || p.arrival.confidence) && (
                          <div className="mt-1.5 flex flex-wrap gap-1 pl-5">
                            {p.arrival.confidence && (p.arrival.status === "expected" || p.arrival.status === "now") && (
                              <Pill>Confidence: {p.arrival.confidence}</Pill>
                            )}
                            {p.hazards.map((h) => (
                              <Pill key={h}>{h}</Pill>
                            ))}
                          </div>
                        )}
                        {p.rain_next_hour_mm.p90 >= 5 && (
                          <p className="mt-1 pl-5 text-[11px] text-muted">
                            Rain next hour: about {p.rain_next_hour_mm.median} mm, up to {p.rain_next_hour_mm.p90} mm
                          </p>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {tab === "alerts" && (
              <ul className="space-y-3">
                {bundle.alerts.length === 0 && <li className="text-sm text-muted">No alerts for this scenario.</li>}
                {bundle.alerts.map((a, i) => (
                  <li key={`${a.title}-${i}`}>
                    <button
                      type="button"
                      onClick={() => {
                        if (a.place_id) selectPlace(a.place_id);
                        else if (a.lon !== undefined && a.lat !== undefined) setFocus({ lon: a.lon, lat: a.lat, key: Date.now() });
                      }}
                      className="flex w-full gap-3 rounded-lg border border-line bg-white p-3 text-left hover:bg-[#f7f9fb]"
                    >
                      <span className="w-1 shrink-0 rounded-full" style={{ background: LEVEL_HEX[a.level] }} />
                      <span>
                        <span className="block text-sm font-semibold">{a.title}</span>
                        <span className="mt-0.5 block text-xs text-muted">{a.body}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {tab === "storms" && (
              <>
                <p className="text-xs text-muted">
                  Storm cells found in the latest scan (40 dBZ or more). Motion from TREC tracking; growth from the fusion step.
                </p>
                {bundle.cells.length === 0 && <p className="text-sm text-muted">No strong cells right now.</p>}
                {bundle.cells.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setFocus({ lon: c.lon, lat: c.lat, key: Date.now() })}
                    className="w-full rounded-xl border border-line bg-white p-4 text-left hover:bg-[#f7f9fb]"
                  >
                    <div className="flex items-center gap-2">
                      <span className="vn-cell static">{c.id}</span>
                      <span className="font-semibold">Cell {c.id}</span>
                      <span className="text-sm text-muted">near {c.near}</span>
                    </div>
                    <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                      <dt className="text-muted">Moving</dt>
                      <dd>
                        {c.speed_kmh} km/h towards {c.toward}
                      </dd>
                      <dt className="text-muted">Strongest echo</dt>
                      <dd>{c.max_dbz} dBZ</dd>
                      <dt className="text-muted">Trend</dt>
                      <dd>
                        {c.trend} ({c.growth_30_db > 0 ? "+" : ""}
                        {c.growth_30_db} dB in 30 min)
                      </dd>
                      <dt className="text-muted">Size</dt>
                      <dd>{c.area_km2} km²</dd>
                      <dt className="text-muted">Lightning</dt>
                      <dd>{c.lightning_10min} strikes in 10 min</dd>
                    </dl>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {c.hazards.map((h) => (
                        <Pill key={h}>{h}</Pill>
                      ))}
                    </div>
                  </button>
                ))}
                {bundle.initiation.length > 0 && (
                  <div className="rounded-xl border border-dashed border-accent/50 bg-white p-4">
                    <p className="font-semibold">New storms (experimental)</p>
                    <p className="mt-1 text-xs text-muted">Satellite shows cloud tops cooling fast where radar sees little rain yet.</p>
                    <ul className="mt-2 space-y-1 text-sm">
                      {bundle.initiation.map((z, i) => (
                        <li key={i}>
                          <button type="button" className="text-left hover:text-accent" onClick={() => setFocus({ lon: z.lon, lat: z.lat, key: Date.now() })}>
                            {z.chance === "likely" ? "Likely" : "Possible"} near {z.near}
                            {!z.in_radar_range && " (outside radar range)"}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}

            {tab === "data" && (
              <div className="space-y-3 text-sm">
                <div className="rounded-xl border border-line bg-white p-4">
                  <p className="font-semibold">Data feeds</p>
                  <ul className="mt-2 space-y-2">
                    {bundle.feeds.map((f) => (
                      <li key={f.id} className="flex gap-2">
                        <span className="mt-1.5">
                          <StatusDot status={f.status} />
                        </span>
                        <span>
                          <span className="font-medium">{f.label}</span>: {f.detail}
                          <span className="block text-xs text-muted">{f.source}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl border border-line bg-white p-4">
                  <p className="font-semibold">Quality checks</p>
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-muted">
                    {bundle.qc.notes.map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl border border-line bg-white p-4">
                  <p className="font-semibold">Storm motion</p>
                  <p className="mt-1 text-muted">
                    Average {bundle.motion.mean_speed_kmh} km/h towards {bundle.motion.mean_toward}. Tracking quality: {bundle.motion.quality} (
                    {bundle.motion.tracked_blocks} of {bundle.motion.echo_blocks} echo blocks matched).
                  </p>
                </div>
                <div className="rounded-xl border border-line bg-white p-4">
                  <p className="font-semibold">Engine</p>
                  <p className="mt-1 text-muted">
                    {bundle.engine.name} v{bundle.engine.version}. {bundle.engine.members} ensemble members plus a control run. Fusion step:{" "}
                    {bundle.engine.fusion}.
                  </p>
                  <ul className="mt-2 grid grid-cols-2 gap-x-3 text-xs text-muted">
                    {Object.entries(bundle.engine.timings_ms).map(([k, v]) => (
                      <li key={k}>
                        {k.replaceAll("_", " ")}: {Math.round(v)} ms
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-xs text-muted">{bundle.method.status}</p>
                  <div className="mt-3 flex gap-4">
                    <Link href="/method" className="text-accent underline">
                      How the engine works
                    </Link>
                    <a href="/api/py/docs" className="text-accent underline">
                      API docs
                    </a>
                  </div>
                </div>
              </div>
            )}

            <p className="px-1 pt-1 text-xs text-muted">
              Decision-support prototype. Not an official IMD warning. Every storm, time and alert here comes from synthetic data run through the Imperial-X engine.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

